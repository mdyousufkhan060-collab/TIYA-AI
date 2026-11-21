/**
 * Mobile-optimized Voice Input (Noise Cancellation + Primary Speaker VAD)
 * and Voice Output (Speaker Loudness & Clarity Mastering) Pipeline.
 */
import { FEMALE_VOICES, FemaleVoiceId } from '../types/tiya';

export const TARGET_MIC_SAMPLE_RATE = 16000;
export const OUTPUT_LOUDNESS_GAIN = 2.75;
export const MIN_ACTIVE_OUTPUT_GAIN = 0.45;
export const DEFAULT_LOCKED_FEMALE_VOICE: FemaleVoiceId = FEMALE_VOICES[0].id;

/**
 * Mobile Chrome & Android WebView optimized getUserMedia constraints.
 * Enables hardware/WebRTC echo cancellation, noise suppression, high-pass filter,
 * and auto gain control while remaining spec-safe across browsers.
 */
export function getMobileVoiceMediaConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      channelCount: { ideal: 1 },
      sampleRate: { ideal: TARGET_MIC_SAMPLE_RATE },
      advanced: [
        { googEchoCancellation: true },
        { googAutoGainControl: true },
        { googNoiseSuppression: true },
        { googNoiseSuppression2: true },
        { googHighpassFilter: true },
        { googTypingNoiseDetection: true },
      ] as unknown as MediaTrackConstraintSet[],
    },
    video: false,
  };
}

/**
 * Fallback constraints if a strict browser rejects advanced Chromium constraints.
 */
export function getFallbackVoiceMediaConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  };
}

/**
 * Linearly resamples mono Float32 PCM to 16 kHz when mobile hardware AudioContext
 * ignores requested sampleRate (e.g. runs at 48 kHz or 44.1 kHz).
 */
export function resampleTo16kHz(
  samples: Float32Array,
  sourceSampleRate: number,
): Float32Array {
  if (
    !sourceSampleRate ||
    sourceSampleRate === TARGET_MIC_SAMPLE_RATE ||
    samples.length === 0
  ) {
    return samples;
  }

  const ratio = sourceSampleRate / TARGET_MIC_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const idx0 = Math.floor(srcIndex);
    const idx1 = Math.min(idx0 + 1, samples.length - 1);
    const frac = srcIndex - idx0;
    result[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }

  return result;
}

/**
 * Zero-Crossing Rate in [0, 1].
 * Near-field human speech sits roughly in [0.012, 0.38]; pure DC/hum is < 0.01,
 * broadband hiss/static is > 0.42.
 */
export function computeZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (samples.length - 1);
}

/**
 * Fast O(N) estimate of how much frame energy resides in the primary human vocal band
 * (roughly 150 Hz – 3400 Hz) relative to total frame energy.
 * Rejects deep rumble (AC/traffic/TV bass) and pure high-frequency hiss/clatter.
 */
export function computeVoiceBandRatio(
  samples: Float32Array,
  sampleRate: number = TARGET_MIC_SAMPLE_RATE,
): number {
  if (samples.length === 0) return 0;

  const dt = 1 / sampleRate;
  const rcHp = 1 / (2 * Math.PI * 150);
  const alphaHp = rcHp / (rcHp + dt);
  const rcLp = 1 / (2 * Math.PI * 3400);
  const alphaLp = dt / (rcLp + dt);

  let totalEnergy = 0;
  let voiceEnergy = 0;
  let prevIn = samples[0];
  let hpOut = 0;
  let lpOut = 0;

  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    totalEnergy += x * x;

    hpOut = alphaHp * (hpOut + x - prevIn);
    prevIn = x;

    lpOut = lpOut + alphaLp * (hpOut - lpOut);
    voiceEnergy += lpOut * lpOut;
  }

  if (totalEnergy <= 1e-12) return 0;
  return Math.min(1, voiceEnergy / totalEnergy);
}

export function computeFrameRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Applies a short cosine fade-in or fade-out to avoid gate clicks/pops.
 */
function applyEdgeFade(
  samples: Float32Array,
  fadeSamples: number,
  direction: 'in' | 'out',
): Float32Array {
  const out = new Float32Array(samples);
  const count = Math.min(fadeSamples, out.length);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const gain = 0.5 - 0.5 * Math.cos(Math.PI * t);
    if (direction === 'in') {
      out[i] *= gain;
    } else {
      const idx = out.length - 1 - i;
      out[idx] *= gain;
    }
  }
  return out;
}

export interface PrimarySpeakerGateOptions {
  sampleRate?: number;
  minNoiseFloor?: number;
  maxNoiseFloor?: number;
  openSnrRatio?: number;
  holdSnrRatio?: number;
  minSpeechRms?: number;
  speakingBargeInMultiplier?: number;
  onsetFramesRequired?: number;
  preRollMs?: number;
  hangoverMs?: number;
}

export interface VoiceGateFrameResult {
  /** Audio chunks ready to send as 16 kHz PCM (includes pre-roll on speech onset, or clean silence when closed). */
  chunksToSend: Float32Array[];
  /** Whether the primary speaker gate is currently open. */
  isSpeechActive: boolean;
  /** Calibrated ambient noise floor RMS. */
  noiseFloor: number;
  /** Smoothed display level [0..1] for UI animation (calm during background noise). */
  displayLevel: number;
}

/**
 * Primary-Speaker Adaptive VAD & Noise Gate.
 *
 * - Continuously learns background ambient noise (TV, fans, distant chatter) while closed.
 * - Opens ONLY when a near-field speaker exceeds the adaptive noise floor with speech-like
 *   spectral concentration and zero-crossing characteristics.
 * - Uses a pre-roll ring buffer (~320 ms) so word beginnings are NEVER cut off.
 * - Uses a hangover window (~800 ms) so natural pauses and word endings are NEVER cut off.
 * - Raises barge-in threshold slightly while TIYA is speaking so loud speaker output does not
 *   falsely interrupt TIYA, while still allowing deliberate user barge-in.
 */
export class PrimarySpeakerVoiceGate {
  private readonly sampleRate: number;
  private readonly minNoiseFloor: number;
  private readonly maxNoiseFloor: number;
  private readonly openSnrRatio: number;
  private readonly holdSnrRatio: number;
  private readonly minSpeechRms: number;
  private readonly speakingBargeInMultiplier: number;
  private readonly onsetFramesRequired: number;
  private readonly preRollMs: number;
  private readonly hangoverMs: number;

  private noiseFloor: number;
  private isOpen = false;
  private onsetStreak = 0;
  private hangoverRemainingMs = 0;
  private preRollFrames: Float32Array[] = [];
  private preRollDurationMs = 0;
  private smoothedDisplay = 0;
  private initializedFloor = false;

  constructor(options: PrimarySpeakerGateOptions = {}) {
    this.sampleRate = options.sampleRate ?? TARGET_MIC_SAMPLE_RATE;
    this.minNoiseFloor = options.minNoiseFloor ?? 0.006;
    this.maxNoiseFloor = options.maxNoiseFloor ?? 0.14;
    this.openSnrRatio = options.openSnrRatio ?? 2.6;
    this.holdSnrRatio = options.holdSnrRatio ?? 1.65;
    this.minSpeechRms = options.minSpeechRms ?? 0.018;
    this.speakingBargeInMultiplier = options.speakingBargeInMultiplier ?? 1.55;
    this.onsetFramesRequired = options.onsetFramesRequired ?? 2;
    this.preRollMs = options.preRollMs ?? 320;
    this.hangoverMs = options.hangoverMs ?? 800;

    this.noiseFloor = this.minNoiseFloor;
  }

  public reset(): void {
    this.noiseFloor = this.minNoiseFloor;
    this.isOpen = false;
    this.onsetStreak = 0;
    this.hangoverRemainingMs = 0;
    this.preRollFrames = [];
    this.preRollDurationMs = 0;
    this.smoothedDisplay = 0;
    this.initializedFloor = false;
  }

  public getNoiseFloor(): number {
    return this.noiseFloor;
  }

  public processFrame(
    rawFrame16k: Float32Array,
    sensitivity: number = 1.0,
    isAssistantSpeaking: boolean = false,
  ): VoiceGateFrameResult {
    const frameDurationMs = (rawFrame16k.length / this.sampleRate) * 1000;
    const clampedSensitivity = Math.max(0.35, Math.min(2.0, sensitivity || 1.0));
    const rms = computeFrameRms(rawFrame16k);
    const zcr = computeZeroCrossingRate(rawFrame16k);
    const voiceBandRatio = computeVoiceBandRatio(rawFrame16k, this.sampleRate);

    // Quick initial noise-floor calibration on first quiet/ambient frame
    if (!this.initializedFloor && rms > 0) {
      this.noiseFloor = Math.max(
        this.minNoiseFloor,
        Math.min(this.maxNoiseFloor, rms * 0.95),
      );
      this.initializedFloor = true;
    }

    // Speech-like spectral & temporal signature:
    // rejects low-frequency hum (<250 Hz), broadband static/hiss (ZCR > 0.44),
    // and ultra-muffled distant noise.
    const hasSpeechSignature =
      zcr >= 0.01 && zcr <= 0.44 && voiceBandRatio >= 0.34;

    // Sensitivity smoothly scales the effective trigger threshold (higher sensitivity = easier trigger)
    const sensScale = 1 / Math.sqrt(clampedSensitivity);
    const bargeInMult = isAssistantSpeaking ? this.speakingBargeInMultiplier : 1.0;

    const openThreshold = Math.max(
      this.minSpeechRms * sensScale * bargeInMult,
      this.noiseFloor * this.openSnrRatio * sensScale * bargeInMult,
    );
    const holdThreshold = Math.max(
      this.minSpeechRms * 0.65 * sensScale,
      this.noiseFloor * this.holdSnrRatio * sensScale,
    );

    const isStrongNearField = hasSpeechSignature && rms >= openThreshold;
    const isVeryLoudNearField = hasSpeechSignature && rms >= openThreshold * 1.85;
    const isContinuingSpeech = hasSpeechSignature && rms >= holdThreshold;

    const chunksToSend: Float32Array[] = [];

    if (!this.isOpen) {
      // Update adaptive noise floor while closed, ignoring abrupt strong near-field spikes
      if (!isStrongNearField) {
        const clampedRms = Math.max(this.minNoiseFloor, Math.min(this.maxNoiseFloor, rms));
        const alpha = clampedRms < this.noiseFloor ? 0.09 : 0.045;
        this.noiseFloor = this.noiseFloor * (1 - alpha) + clampedRms * alpha;
      }

      if (isStrongNearField) {
        this.onsetStreak += isVeryLoudNearField ? this.onsetFramesRequired : 1;
      } else {
        this.onsetStreak = 0;
      }

      if (this.onsetStreak >= this.onsetFramesRequired) {
        // Transition CLOSED -> OPEN: flush pre-roll buffer so initial syllables are preserved!
        this.isOpen = true;
        this.onsetStreak = 0;
        this.hangoverRemainingMs = this.hangoverMs;

        const fadeLen = Math.min(128, Math.floor(this.sampleRate * 0.008));
        for (let i = 0; i < this.preRollFrames.length; i++) {
          const preChunk = this.preRollFrames[i];
          chunksToSend.push(i === 0 ? applyEdgeFade(preChunk, fadeLen, 'in') : preChunk);
        }
        this.preRollFrames = [];
        this.preRollDurationMs = 0;

        chunksToSend.push(this.conditionOutputSpeechFrame(rawFrame16k, clampedSensitivity));
      } else {
        // Stay closed: store frame in pre-roll ring buffer and emit clean silence
        this.pushPreRoll(this.conditionOutputSpeechFrame(rawFrame16k, clampedSensitivity), frameDurationMs);
        chunksToSend.push(new Float32Array(rawFrame16k.length));
      }
    } else {
      // Gate is currently OPEN
      if (isContinuingSpeech || isStrongNearField) {
        this.hangoverRemainingMs = this.hangoverMs;
        // Allow very gentle downward floor relaxation only
        if (rms < this.noiseFloor) {
          this.noiseFloor = Math.max(
            this.minNoiseFloor,
            this.noiseFloor * 0.99 + rms * 0.01,
          );
        }
        chunksToSend.push(this.conditionOutputSpeechFrame(rawFrame16k, clampedSensitivity));
      } else {
        this.hangoverRemainingMs -= frameDurationMs;
        if (this.hangoverRemainingMs > 0) {
          // Keep gate open cleanly during natural pauses / word endings
          chunksToSend.push(this.conditionOutputSpeechFrame(rawFrame16k, clampedSensitivity));
        } else {
          // Close gate gracefully with a short fade-out so endings never click
          this.isOpen = false;
          this.hangoverRemainingMs = 0;
          const fadeLen = Math.min(160, Math.floor(this.sampleRate * 0.01));
          chunksToSend.push(
            applyEdgeFade(
              this.conditionOutputSpeechFrame(rawFrame16k, clampedSensitivity),
              fadeLen,
              'out',
            ),
          );
        }
      }
    }

    const rawLevel = this.isOpen
      ? Math.min(1, Math.max(0, (rms - this.noiseFloor * 0.6) * clampedSensitivity * 6.5))
      : 0;
    this.smoothedDisplay = this.smoothedDisplay * 0.55 + rawLevel * 0.45;

    return {
      chunksToSend,
      isSpeechActive: this.isOpen,
      noiseFloor: this.noiseFloor,
      displayLevel: this.smoothedDisplay,
    };
  }

  private pushPreRoll(frame: Float32Array, durationMs: number): void {
    this.preRollFrames.push(frame);
    this.preRollDurationMs += durationMs;
    while (this.preRollFrames.length > 1 && this.preRollDurationMs > this.preRollMs) {
      const removed = this.preRollFrames.shift();
      if (removed) {
        this.preRollDurationMs -= (removed.length / this.sampleRate) * 1000;
      }
    }
  }

  /**
   * Gentle speech conditioning: applies modest sensitivity scaling and soft saturation
   * so near-field plosives never hard-clip into distortion.
   */
  private conditionOutputSpeechFrame(
    samples: Float32Array,
    sensitivity: number,
  ): Float32Array {
    // Subtle gain lift (1.15x baseline) with soft limiting
    const gain = Math.min(1.6, Math.max(0.7, 1.15 * Math.sqrt(sensitivity)));
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] * gain;
      // Soft tanh limiter above +/- 0.85 to preserve natural speech dynamics cleanly
      out[i] = Math.abs(v) > 0.85 ? Math.tanh(v) : v;
    }
    return out;
  }
}

/**
 * Computes the Web Audio master makeup gain for mobile speaker loudness.
 * Keeps volume comfortably loud & audible on mobile phone speakers while
 * respecting mute (0) and the user's volume slider smoothly.
 */
export function computeOutputMasterGain(userVolume: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(userVolume) ? userVolume : 0.9));
  if (clamped <= 0.001) return 0;
  return Math.max(MIN_ACTIVE_OUTPUT_GAIN, clamped * OUTPUT_LOUDNESS_GAIN);
}

/**
 * Builds a smooth tanh soft-clipping curve for the output WaveShaperNode.
 * Ensures boosted speech never hard-clips, crackles, or distorts on phone speakers.
 */
export function createSoftLimiterCurve(samples: number = 2048): Float32Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const drive = 1.15;
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/**
 * Applies a tiny 1.5 ms cosine fade-in to the start of a new spoken utterance
 * to prevent speaker clicks when resuming from silence.
 */
export function applyStartAntiClick(
  samples: Float32Array,
  sampleRate: number = 24000,
): Float32Array {
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.0015), samples.length);
  if (fadeSamples <= 1) return samples;
  const out = new Float32Array(samples);
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    out[i] *= 0.5 - 0.5 * Math.cos(Math.PI * t);
  }
  return out;
}

export interface VoiceInputChain {
  processor: ScriptProcessorNode;
  disconnect: () => void;
}

/**
 * Creates a speech-focused Web Audio input conditioning chain:
 *   MediaStream -> HighPass (100 Hz) -> LowPass (4200 Hz) -> Vocal Presence (+2.5 dB @ 1.8 kHz)
 *   -> ScriptProcessor (2048) -> Silent Gain (0) -> destination
 *
 * The silent sink ensures ScriptProcessor stays clocked on all mobile browsers without
 * ever leaking microphone audio back into the speaker!
 */
export function createVoiceInputChain(
  inputCtx: AudioContext,
  stream: MediaStream,
): VoiceInputChain {
  const source = inputCtx.createMediaStreamSource(stream);

  const highpass = inputCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 100;
  highpass.Q.value = 0.707;

  const lowpass = inputCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 4200;
  lowpass.Q.value = 0.707;

  const vocalPresence = inputCtx.createBiquadFilter();
  vocalPresence.type = 'peaking';
  vocalPresence.frequency.value = 1800;
  vocalPresence.Q.value = 1.0;
  vocalPresence.gain.value = 2.5;

  const processor = inputCtx.createScriptProcessor(2048, 1, 1);

  const silentSink = inputCtx.createGain();
  silentSink.gain.value = 0;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(vocalPresence);
  vocalPresence.connect(processor);
  processor.connect(silentSink);
  silentSink.connect(inputCtx.destination);

  const disconnect = () => {
    try {
      processor.onaudioprocess = null;
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      vocalPresence.disconnect();
      processor.disconnect();
      silentSink.disconnect();
    } catch {
      // ignore already disconnected nodes
    }
  };

  return { processor, disconnect };
}

export interface VoiceOutputChain {
  inputNode: GainNode;
  setVolume: (userVolume: number) => void;
  ensureActive: () => Promise<void>;
  cleanup: () => void;
}

/**
 * Creates a mobile-speaker-optimized AI voice playback mastering chain:
 *   Source -> Master Makeup Gain -> HighPass (120 Hz) -> Warmth EQ (+1.5 dB @ 450 Hz)
 *   -> Vocal Clarity EQ (+3.5 dB @ 2400 Hz) -> De-Harsh Shelf (-1.5 dB @ 6500 Hz)
 *   -> Speech Compressor (-15 dB, 4.5:1) -> Soft Limiter (tanh) -> Ceiling Limiter (-1.5 dB, 20:1)
 *   -> Mobile Speaker Output (<audio playsinline> MediaStream sink with automatic direct destination fallback)
 */
export function createVoiceOutputChain(
  outputCtx: AudioContext,
  initialVolume: number,
): VoiceOutputChain {
  const inputNode = outputCtx.createGain();
  inputNode.gain.value = computeOutputMasterGain(initialVolume);

  // Strip sub-bass below 120 Hz that distorts small mobile speakers
  const hpFilter = outputCtx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 120;
  hpFilter.Q.value = 0.707;

  // Natural vocal body warmth
  const warmthEq = outputCtx.createBiquadFilter();
  warmthEq.type = 'peaking';
  warmthEq.frequency.value = 450;
  warmthEq.Q.value = 0.8;
  warmthEq.gain.value = 1.5;

  // Vocal clarity & projection on phone speakers in noisy environments
  const presenceEq = outputCtx.createBiquadFilter();
  presenceEq.type = 'peaking';
  presenceEq.frequency.value = 2400;
  presenceEq.Q.value = 1.0;
  presenceEq.gain.value = 3.5;

  // Gentle top-end smoothing to prevent harshness or sibilance
  const deHarshEq = outputCtx.createBiquadFilter();
  deHarshEq.type = 'highshelf';
  deHarshEq.frequency.value = 6500;
  deHarshEq.gain.value = -1.5;

  // Broadcast speech dynamics compressor to lift quieter syllables cleanly
  const speechCompressor = outputCtx.createDynamicsCompressor();
  speechCompressor.threshold.value = -15;
  speechCompressor.knee.value = 12;
  speechCompressor.ratio.value = 4.5;
  speechCompressor.attack.value = 0.004;
  speechCompressor.release.value = 0.14;

  // Smooth soft-clipper prevents digital harshness
  const softLimiter = outputCtx.createWaveShaper();
  softLimiter.curve = createSoftLimiterCurve();
  softLimiter.oversample = '2x';

  // Final brickwall ceiling limiter guarantees zero clipping/crackling
  const ceilingLimiter = outputCtx.createDynamicsCompressor();
  ceilingLimiter.threshold.value = -1.5;
  ceilingLimiter.knee.value = 2;
  ceilingLimiter.ratio.value = 20;
  ceilingLimiter.attack.value = 0.001;
  ceilingLimiter.release.value = 0.05;

  inputNode.connect(hpFilter);
  hpFilter.connect(warmthEq);
  warmthEq.connect(presenceEq);
  presenceEq.connect(deHarshEq);
  deHarshEq.connect(speechCompressor);
  speechCompressor.connect(softLimiter);
  softLimiter.connect(ceilingLimiter);

  // Route via <audio playsinline> MediaStream destination on mobile browsers for
  // full speaker volume & hardware AEC alignment, with guaranteed direct destination fallback.
  let audioEl: HTMLAudioElement | null = null;
  let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  let usingDirectDestination = false;

  const fallbackToDirectDestination = () => {
    if (usingDirectDestination) return;
    usingDirectDestination = true;
    try {
      if (mediaStreamDest) {
        ceilingLimiter.disconnect(mediaStreamDest);
      }
    } catch {
      // ignore
    }
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch {
        // ignore
      }
      audioEl = null;
    }
    mediaStreamDest = null;
    try {
      ceilingLimiter.connect(outputCtx.destination);
    } catch {
      // ignore
    }
  };

  if (
    typeof document !== 'undefined' &&
    typeof outputCtx.createMediaStreamDestination === 'function'
  ) {
    try {
      mediaStreamDest = outputCtx.createMediaStreamDestination();
      ceilingLimiter.connect(mediaStreamDest);

      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.srcObject = mediaStreamDest.stream;
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          fallbackToDirectDestination();
        });
      }
    } catch {
      fallbackToDirectDestination();
    }
  } else {
    fallbackToDirectDestination();
  }

  const setVolume = (userVolume: number) => {
    const targetGain = computeOutputMasterGain(userVolume);
    try {
      inputNode.gain.setTargetAtTime(targetGain, outputCtx.currentTime, 0.02);
    } catch {
      inputNode.gain.value = targetGain;
    }
    if (audioEl) {
      audioEl.volume = 1.0;
    }
  };

  const ensureActive = async () => {
    if (outputCtx.state === 'suspended') {
      try {
        await outputCtx.resume();
      } catch {
        // ignore
      }
    }
    if (audioEl && !usingDirectDestination && audioEl.paused) {
      try {
        await audioEl.play();
        if (audioEl.paused) {
          fallbackToDirectDestination();
        }
      } catch {
        fallbackToDirectDestination();
      }
    }
  };

  const cleanup = () => {
    try {
      inputNode.disconnect();
      hpFilter.disconnect();
      warmthEq.disconnect();
      presenceEq.disconnect();
      deHarshEq.disconnect();
      speechCompressor.disconnect();
      softLimiter.disconnect();
      ceilingLimiter.disconnect();
    } catch {
      // ignore
    }
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch {
        // ignore
      }
      audioEl = null;
    }
    mediaStreamDest = null;
  };

  return {
    inputNode,
    setVolume,
    ensureActive,
    cleanup,
  };
}

/**
 * Resolves and locks a voice ID strictly to TIYA's approved female voice catalog.
 * Prevents male voices, unknown IDs, or empty values from ever substituting in.
 */
export function resolveCanonicalFemaleVoice(voiceName?: string | null): FemaleVoiceId {
  const candidate = String(voiceName || '').trim();
  const match = FEMALE_VOICES.find((v) => v.id === candidate);
  return match ? match.id : DEFAULT_LOCKED_FEMALE_VOICE;
}

/**
 * Decodes either raw 16-bit LE PCM or a RIFF/WAVE audio payload into Float32
 * samples with its exact sample rate. Stripping 44-byte WAV headers and reading
 * the real rate prevents clicks, pops, and thick/thin pitch warping.
 */
export function decodeAudioChunkPayload(
  base64Data: string,
  mimeType?: string,
): { samples: Float32Array; sampleRate: number } {
  const rateMatch = /rate=(\d+)/i.exec(String(mimeType || ''));
  let sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000) {
    sampleRate = 24000;
  }

  let binary = '';
  try {
    binary = atob(base64Data);
  } catch {
    return { samples: new Float32Array(0), sampleRate };
  }

  const totalBytes = binary.length;
  if (totalBytes < 2) return { samples: new Float32Array(0), sampleRate };

  let dataOffset = 0;
  let dataLength = totalBytes;

  // Detect RIFF....WAVE header (returned by unary Gemini 3.8 TTS)
  if (
    totalBytes >= 44 &&
    binary.charCodeAt(0) === 0x52 && // R
    binary.charCodeAt(1) === 0x49 && // I
    binary.charCodeAt(2) === 0x46 && // F
    binary.charCodeAt(3) === 0x46 && // F
    binary.charCodeAt(8) === 0x57 && // W
    binary.charCodeAt(9) === 0x41 && // A
    binary.charCodeAt(10) === 0x56 && // V
    binary.charCodeAt(11) === 0x45 // E
  ) {
    const readUint32LE = (off: number) =>
      (binary.charCodeAt(off) |
        (binary.charCodeAt(off + 1) << 8) |
        (binary.charCodeAt(off + 2) << 16) |
        (binary.charCodeAt(off + 3) << 24)) >>>
      0;

    const wavRate = readUint32LE(24);
    if (wavRate >= 8000 && wavRate <= 96000) {
      sampleRate = wavRate;
    }

    // Locate the 'data' subchunk safely (handles non-44-byte WAV headers too)
    let pos = 12;
    while (pos + 8 <= totalBytes) {
      const chunkId =
        String.fromCharCode(
          binary.charCodeAt(pos),
          binary.charCodeAt(pos + 1),
          binary.charCodeAt(pos + 2),
          binary.charCodeAt(pos + 3),
        );
      const chunkSize = readUint32LE(pos + 4);
      if (chunkId === 'data') {
        dataOffset = pos + 8;
        dataLength = Math.min(chunkSize, totalBytes - dataOffset);
        break;
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }
    if (dataOffset === 0) {
      dataOffset = 44;
      dataLength = totalBytes - 44;
    }
  }

  const sampleCount = Math.floor(dataLength / 2);
  if (sampleCount <= 0) return { samples: new Float32Array(0), sampleRate };

  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const byteIdx = dataOffset + i * 2;
    const lo = binary.charCodeAt(byteIdx);
    const hi = binary.charCodeAt(byteIdx + 1);
    let val = (hi << 8) | lo;
    if (val >= 0x8000) val -= 0x10000;
    samples[i] = val / 32768;
  }

  return { samples, sampleRate };
}

/**
 * Pitch-faithful playback rate factor.
 * Web Audio AudioBufferSourceNode.playbackRate shifts BOTH speed and pitch
 * (0.90x lowers female voice pitch by -1.82 semitones, making it sound thicker/deeper).
 * Keeping the default at 1.0 preserves the exact female vocal identity without
 * artificial stretching, while Gemini Live / TTS native prosody delivers the
 * unhurried 0.85x-0.95x conversational pace cleanly.
 */
export const NATURAL_SPEECH_RATE_FACTOR = 1.0;
export const MIN_NATURAL_PLAYBACK_RATE = 0.92;
export const MAX_NATURAL_PLAYBACK_RATE = 1.15;

/**
 * Computes a pitch-faithful playback rate for TIYA's spoken voice.
 * Default speed (1.0) maps to 1.0 so the female vocal timbre stays 100% consistent
 * and undistorted, while explicit user adjustments remain gently clamped.
 */
export function computeNaturalPlaybackRate(userSpeed?: number): number {
  const base =
    typeof userSpeed === 'number' && Number.isFinite(userSpeed) && userSpeed > 0
      ? userSpeed
      : 1.0;
  const scaled = base * NATURAL_SPEECH_RATE_FACTOR;
  return Math.max(MIN_NATURAL_PLAYBACK_RATE, Math.min(MAX_NATURAL_PLAYBACK_RATE, scaled));
}

interface ScheduledTranscriptChunk {
  text: string;
  releaseAtSec: number;
}

/**
 * Synchronizes genuine streaming assistant output_transcript chunks with the
 * Web Audio playback timeline (AudioContext.currentTime).
 *
 * - Never splits an already completed sentence into fake words.
 * - Releases each real server transcript chunk when its corresponding queued
 *   audio segment actually plays out of the speaker.
 * - Cancels unplayed future chunks on user interruption (barge-in) so spoken
 *   audio and displayed text never contradict each other.
 */
export class VoiceTranscriptSynchronizer {
  private queue: ScheduledTranscriptChunk[] = [];
  private lastAssignedSec = 0;

  public enqueue(
    text: string,
    audioNowSec: number,
    scheduledStartSec: number,
    scheduledEndSec: number,
  ): void {
    if (!text) return;
    const baseStart = Math.max(audioNowSec, scheduledStartSec);
    const windowEnd = Math.max(baseStart, scheduledEndSec);

    let releaseAtSec = baseStart;
    if (this.queue.length > 0 && this.lastAssignedSec >= baseStart) {
      const remaining = Math.max(0, windowEnd - this.lastAssignedSec);
      const step = remaining > 0.04 ? Math.min(0.18, remaining * 0.45) : 0.03;
      releaseAtSec = Math.min(windowEnd, this.lastAssignedSec + step);
    }

    this.lastAssignedSec = releaseAtSec;
    this.queue.push({ text, releaseAtSec });
  }

  public drainReady(audioNowSec: number): string[] {
    const ready: string[] = [];
    while (this.queue.length > 0 && this.queue[0].releaseAtSec <= audioNowSec + 0.015) {
      ready.push(this.queue.shift()!.text);
    }
    return ready;
  }

  public nextDelayMs(audioNowSec: number): number | null {
    if (this.queue.length === 0) return null;
    const deltaSec = this.queue[0].releaseAtSec - audioNowSec;
    return Math.max(16, Math.min(400, Math.round(deltaSec * 1000)));
  }

  public flushAll(): string[] {
    if (this.queue.length === 0) return [];
    const all = this.queue.map((item) => item.text);
    this.queue = [];
    this.lastAssignedSec = 0;
    return all;
  }

  public cancelPending(): void {
    this.queue = [];
    this.lastAssignedSec = 0;
  }

  public pendingCount(): number {
    return this.queue.length;
  }
}

