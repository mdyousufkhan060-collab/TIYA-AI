import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PrimarySpeakerVoiceGate,
  computeFrameRms,
  computeOutputMasterGain,
  computeVoiceBandRatio,
  computeZeroCrossingRate,
  createSoftLimiterCurve,
  getMobileVoiceMediaConstraints,
  resampleTo16kHz,
} from './voiceAudioPipeline';

/** Generates a synthetic speech-like signal (multi-harmonic vocal formants at 16 kHz). */
function makeSpeechFrame(length: number, amplitude: number, sampleRate = 16000): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const fundamental = Math.sin(2 * Math.PI * 220 * t);
    const formant1 = 0.7 * Math.sin(2 * Math.PI * 680 * t);
    const formant2 = 0.45 * Math.sin(2 * Math.PI * 1650 * t);
    const formant3 = 0.2 * Math.sin(2 * Math.PI * 2600 * t);
    out[i] = amplitude * 0.55 * (fundamental + formant1 + formant2 + formant3);
  }
  return out;
}

/** Generates steady low-frequency rumble (AC / traffic / TV bass). */
function makeLowRumbleFrame(length: number, amplitude: number, sampleRate = 16000): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    out[i] = amplitude * Math.sin(2 * Math.PI * 60 * t);
  }
  return out;
}

test('resamples 48 kHz mobile hardware audio cleanly down to 16 kHz', () => {
  const src48k = makeSpeechFrame(2048, 0.3, 48000);
  const resampled = resampleTo16kHz(src48k, 48000);
  assert.equal(resampled.length, Math.round(2048 / 3));

  const passthrough = resampleTo16kHz(src48k, 16000);
  assert.equal(passthrough.length, src48k.length);
});

test('distinguishes vocal-band speech from low rumble and high-frequency hiss', () => {
  const speech = makeSpeechFrame(1024, 0.25);
  const rumble = makeLowRumbleFrame(1024, 0.25);

  const speechRatio = computeVoiceBandRatio(speech, 16000);
  const rumbleRatio = computeVoiceBandRatio(rumble, 16000);
  const speechZcr = computeZeroCrossingRate(speech);

  assert.ok(speechRatio > 0.6, `Expected high vocal band ratio, got ${speechRatio}`);
  assert.ok(rumbleRatio < 0.25, `Expected low vocal band ratio for rumble, got ${rumbleRatio}`);
  assert.ok(speechZcr > 0.01 && speechZcr < 0.4, `Unexpected speech ZCR: ${speechZcr}`);
});

test('PrimarySpeakerVoiceGate blocks steady TV/background audio and opens for primary near-field speaker with pre-roll & hangover', () => {
  const gate = new PrimarySpeakerVoiceGate({ sampleRate: 16000 });
  const frameLen = 1024; // 64 ms at 16 kHz

  // 1. Feed steady background TV / distant conversation (~0.025 amplitude) for 15 frames
  const tvBackground = makeSpeechFrame(frameLen, 0.028);
  let openedDuringTv = false;
  for (let i = 0; i < 15; i++) {
    const res = gate.processFrame(tvBackground, 1.0, false);
    if (res.isSpeechActive) openedDuringTv = true;
    // Closed gate outputs clean digital silence
    if (!res.isSpeechActive) {
      assert.equal(computeFrameRms(res.chunksToSend[0]), 0);
    }
  }
  assert.equal(openedDuringTv, false, 'Gate must not open on steady background TV/chatter');

  // 2. Now primary speaker speaks closer to the microphone (amplitude 0.22)
  const primaryVoice = makeSpeechFrame(frameLen, 0.22);
  const onset1 = gate.processFrame(primaryVoice, 1.0, false);
  const onset2 = gate.processFrame(primaryVoice, 1.0, false);
  const opened = onset1.isSpeechActive || onset2.isSpeechActive;
  assert.equal(opened, true, 'Gate must open cleanly for primary near-field speaker');

  // Pre-roll buffer should have flushed earlier frames so the word start is never cut off
  const totalChunksOnOpen = onset1.chunksToSend.length + onset2.chunksToSend.length;
  assert.ok(totalChunksOnOpen >= 3, `Expected pre-roll chunks on onset, got ${totalChunksOnOpen}`);

  // 3. Natural brief pause (~300 ms = 4 frames of low ambient noise) must NOT cut off sentence
  for (let i = 0; i < 4; i++) {
    const pauseRes = gate.processFrame(tvBackground, 1.0, false);
    assert.equal(pauseRes.isSpeechActive, true, 'Hangover must preserve brief natural pauses');
  }

  // 4. After hangover expires (~15 more frames of background only), gate closes cleanly
  let finalOpen = true;
  for (let i = 0; i < 16; i++) {
    finalOpen = gate.processFrame(tvBackground, 1.0, false).isSpeechActive;
  }
  assert.equal(finalOpen, false, 'Gate must close after hangover when speaker stops');
});

test('PrimarySpeakerVoiceGate protects against self-barge-in while assistant is speaking', () => {
  const gate = new PrimarySpeakerVoiceGate({ sampleRate: 16000 });
  const frameLen = 1024;
  const ambient = makeSpeechFrame(frameLen, 0.015);
  for (let i = 0; i < 8; i++) gate.processFrame(ambient, 1.0, false);

  // Moderate speaker bleed while TIYA is talking should NOT trigger interruption
  const moderateBleed = makeSpeechFrame(frameLen, 0.055);
  const bleedRes1 = gate.processFrame(moderateBleed, 1.0, true);
  const bleedRes2 = gate.processFrame(moderateBleed, 1.0, true);
  assert.equal(bleedRes1.isSpeechActive || bleedRes2.isSpeechActive, false);

  // Strong deliberate near-field user voice DOES barge in
  const loudUser = makeSpeechFrame(frameLen, 0.28);
  const barge1 = gate.processFrame(loudUser, 1.0, true);
  const barge2 = gate.processFrame(loudUser, 1.0, true);
  assert.equal(barge1.isSpeechActive || barge2.isSpeechActive, true);
});

test('Output loudness mastering boosts mobile volume safely without clipping', () => {
  assert.equal(computeOutputMasterGain(0), 0);
  const defaultGain = computeOutputMasterGain(0.9);
  const maxGain = computeOutputMasterGain(1.0);
  const lowGain = computeOutputMasterGain(0.1);

  assert.ok(defaultGain >= 2.2 && defaultGain <= 3.0, `Expected strong default loudness gain, got ${defaultGain}`);
  assert.ok(maxGain > defaultGain, 'Max volume should exceed default volume');
  assert.ok(lowGain >= 0.45, 'Non-zero volume should not become inaudibly quiet');

  const curve = createSoftLimiterCurve(1024);
  for (let i = 0; i < curve.length; i++) {
    assert.ok(curve[i] >= -1.0001 && curve[i] <= 1.0001, 'Soft limiter must stay within [-1, 1]');
  }
});

test('Mobile voice media constraints enable noise suppression, echo cancellation, and AGC', () => {
  const constraints = getMobileVoiceMediaConstraints();
  assert.ok(constraints.audio && typeof constraints.audio === 'object');
  const audio = constraints.audio as MediaTrackConstraints;
  assert.deepEqual(audio.echoCancellation, { ideal: true });
  assert.deepEqual(audio.noiseSuppression, { ideal: true });
  assert.deepEqual(audio.autoGainControl, { ideal: true });
});

test('computeNaturalPlaybackRate tunes default speed to 0.90x without stretching/distortion', async () => {
  const { computeNaturalPlaybackRate } = await import('./voiceAudioPipeline.ts');
  const defaultRate = computeNaturalPlaybackRate(1.0);
  assert.ok(defaultRate >= 0.85 && defaultRate <= 0.95, `expected 0.85-0.95, got ${defaultRate}`);
  assert.equal(defaultRate, 0.9);

  // Extreme low slider clamps cleanly to avoid distorted audio
  assert.equal(computeNaturalPlaybackRate(0.5), 0.84);
  // Faster user setting still speeds up smoothly within safe bounds
  assert.ok(computeNaturalPlaybackRate(1.25) > 1.05);
  assert.equal(computeNaturalPlaybackRate(2.0), 1.3);
});

test('VoiceTranscriptSynchronizer releases real server chunks in sync with audio clock and cancels on barge-in', async () => {
  const { VoiceTranscriptSynchronizer } = await import('./voiceAudioPipeline.ts');
  const sync = new VoiceTranscriptSynchronizer();

  // Audio chunk 1 plays [1.0s .. 1.6s], chunk 2 plays [1.6s .. 2.2s], chunk 3 plays [2.2s .. 2.8s]
  sync.enqueue('স্যার,', 1.0, 1.0, 1.6);
  sync.enqueue(' তুমি', 1.0, 1.6, 2.2);
  sync.enqueue(' কেমন আছো?', 1.0, 2.2, 2.8);

  // At t=1.0s: only first chunk is released
  assert.deepEqual(sync.drainReady(1.0), ['স্যার,']);
  assert.equal(sync.pendingCount(), 2);

  // At t=1.65s: second chunk is released right when audio chunk 2 plays
  assert.deepEqual(sync.drainReady(1.65), [' তুমি']);
  assert.equal(sync.pendingCount(), 1);

  // User interrupts mid-sentence -> unplayed chunk 3 is cancelled so audio & text never contradict
  sync.cancelPending();
  assert.equal(sync.pendingCount(), 0);
  assert.deepEqual(sync.flushAll(), []);

  // Normal completion flushes any final pending chunk cleanly
  sync.enqueue('ভালো আছি।', 3.0, 3.4, 3.8);
  assert.deepEqual(sync.flushAll(), ['ভালো আছি।']);
});

