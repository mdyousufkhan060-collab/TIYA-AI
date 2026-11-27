import { openQuietMic, type QuietMic } from '../lib/quietMic';
import { premiumStt } from '../lib/premium';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createTranscribeSocket } from '../lib/clientApi';
import { TiyaSettings } from '../types/tiya';
import { float32ToPcm16Base64 } from '../utils/audioPcm';
import {
  TranscriptStreamBuffer,
  getLanguageCodesForLiveTranscribe,
  getSpeechRecognitionLang,
} from '../utils/transcriptBuffer';
import {
  computeFrameRms,
  createVoiceInputChain,
  getFallbackVoiceMediaConstraints,
  getMobileVoiceMediaConstraints,
  resampleTo16kHz,
  VoiceInputChain,
} from '../utils/voiceAudioPipeline';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getBrowserSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return binary ? btoa(binary) : '';
}

/** Pause duration (ms) after detected speech before auto-finalizing the transcript. */
const AUTO_FINALIZE_SILENCE_MS = 3200;
/** Max wait time (ms) for server finalization flush after audio_end before promoting interim. */
const FINAL_FLUSH_WITH_INTERIM_MS = 1100;
const FINAL_FLUSH_IDLE_MS = 450;
/** Max pre-connect PCM frames buffered (~1.5s) so opening syllables are never dropped. */
const MAX_PRECONNECT_CHUNKS = 20;
/** Minimum speech RMS to mark active voice activity for auto-finalize silence tracking. */
const SPEECH_ACTIVITY_RMS = 0.015;

export interface UseRealtimeDictationOptions {
  settings: TiyaSettings;
  onTranscriptChange: (value: string) => void;
}

export interface UseRealtimeDictationResult {
  isRecordingMic: boolean;
  isTranscribing: boolean;
  micError: string;
  clearMicError: () => void;
  toggleMicInput: (currentInput: string) => Promise<void>;
  stopMicInput: () => Promise<string>;
  syncManualEdit: (value: string) => void;
}

/**
 * Real-time streaming speech-to-text hook for TIYA Chat dictation.
 *
 * Engine priority (preserves existing Gemini + Groq connections without changes):
 *  1. Gemini Live Real-Time Transcribe (/ws/transcribe -> gemini-3.5-transcribe-live)
 *     when a Gemini API key is configured: genuine low-latency streaming with
 *     separate interim & final events and Bengali + English code-switching.
 *  2. Browser SpeechRecognition streaming fallback when Gemini Live Transcribe
 *     is unavailable or no Gemini key is set.
 *  3. Single-pass Groq Whisper (/api/groq/transcribe) or Gemini (/api/gemini/transcribe)
 *     fallback only when no streaming engine is available in the environment.
 */
export function useRealtimeDictation({
  settings,
  onTranscriptChange,
}: UseRealtimeDictationOptions): UseRealtimeDictationResult {
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const premMicRef = useRef<QuietMic | null>(null);
  const [micError, setMicError] = useState('');

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;

  const sessionIdRef = useRef(0);
  const isRecordingRef = useRef(false);
  const activeEngineRef = useRef<'none' | 'gemini_live' | 'web_speech' | 'batch_recorder'>('none');

  // Dual-buffer transcript manager
  const bufferRef = useRef<TranscriptStreamBuffer>(new TranscriptStreamBuffer());

  // Gemini Live Transcribe resources
  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const pendingAudioQueueRef = useRef<string[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const inputChainRef = useRef<VoiceInputChain | null>(null);
  const isStoppingRef = useRef(false);
  const flushResolverRef = useRef<(() => void) | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receivedAnyTranscriptRef = useRef(false);

  // Silence tracking (tolerates brief mid-sentence pauses, auto-finalizes after extended silence)
  const hasSpeechActivityRef = useRef(false);
  const lastSpeechActivityAtRef = useRef(0);
  const silenceMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Browser SpeechRecognition fallback resources
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const webSpeechRestartBoundaryRef = useRef(false);

  // Single-pass batch recorder fallback resources
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);

  const clearTimers = useCallback(() => {
    if (silenceMonitorRef.current) {
      clearInterval(silenceMonitorRef.current);
      silenceMonitorRef.current = null;
    }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (flushResolverRef.current) {
      const resolve = flushResolverRef.current;
      flushResolverRef.current = null;
      resolve();
    }
  }, []);

  const releaseMicResources = useCallback(() => {
    if (inputChainRef.current) {
      try {
        inputChainRef.current.disconnect();
      } catch {
        // ignore
      }
      inputChainRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      mediaStreamRef.current = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    clearTimers();
    wsReadyRef.current = false;
    pendingAudioQueueRef.current = [];
    isStoppingRef.current = false;

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'stop' }));
        }
        ws.close();
      } catch {
        // ignore
      }
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }

    if (mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        // ignore
      }
    }
    recorderChunksRef.current = [];

    releaseMicResources();
    activeEngineRef.current = 'none';
    isRecordingRef.current = false;
    setIsRecordingMic(false);
    setIsTranscribing(false);
  }, [clearTimers, releaseMicResources]);

  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      cleanupAll();
    };
  }, [cleanupAll]);

  const acquireMobileMicStream = useCallback(async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia(getMobileVoiceMediaConstraints());
    } catch {
      return await navigator.mediaDevices.getUserMedia(getFallbackVoiceMediaConstraints());
    }
  }, []);

  const resolvePendingFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (flushResolverRef.current) {
      const resolve = flushResolverRef.current;
      flushResolverRef.current = null;
      resolve();
    }
  }, []);

  const stopMicInput = useCallback(async (): Promise<string> => {
    // ROSE PREMIUM dictation (no own key): send the last words, then close the mic
    if (premMicRef.current) {
      const mic = premMicRef.current;
      premMicRef.current = null;
      mic.flush();
      mic.close();
      isRecordingRef.current = false;
      setIsRecordingMic(false);
      return bufferRef.current.getValue();
    }
    if (!isRecordingRef.current && activeEngineRef.current === 'none') {
      return bufferRef.current.getValue();
    }

    const sessionId = sessionIdRef.current;
    const engine = activeEngineRef.current;
    isStoppingRef.current = true;
    isRecordingRef.current = false;
    setIsRecordingMic(false);

    if (silenceMonitorRef.current) {
      clearInterval(silenceMonitorRef.current);
      silenceMonitorRef.current = null;
    }

    if (engine === 'gemini_live') {
      // Stop capturing new audio immediately so speaker silence is crisp
      releaseMicResources();
      pendingAudioQueueRef.current = [];

      const ws = wsRef.current;
      const hadPendingInterim = bufferRef.current.getInterim().length > 0;
      const shouldFlush = ws && ws.readyState === WebSocket.OPEN && wsReadyRef.current;

      if (shouldFlush) {
        setIsTranscribing(true);
        try {
          ws.send(JSON.stringify({ type: 'audio_end' }));
        } catch {
          // ignore
        }

        const waitMs = hadPendingInterim ? FINAL_FLUSH_WITH_INTERIM_MS : FINAL_FLUSH_IDLE_MS;
        await new Promise<void>((resolve) => {
          flushResolverRef.current = resolve;
          flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            flushResolverRef.current = null;
            resolve();
          }, waitMs);
        });
      }

      if (sessionId !== sessionIdRef.current) {
        return bufferRef.current.getValue();
      }

      const finalText = bufferRef.current.finalize();
      onTranscriptChangeRef.current(finalText);
      cleanupAll();
      return finalText;
    }

    if (engine === 'web_speech') {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        rec.onend = null;
        rec.onerror = null;
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      const finalText = bufferRef.current.finalize();
      onTranscriptChangeRef.current(finalText);
      cleanupAll();
      return finalText;
    }

    if (engine === 'batch_recorder') {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      return bufferRef.current.getValue();
    }

    cleanupAll();
    return bufferRef.current.getValue();
  }, [cleanupAll, releaseMicResources]);

  const startSilenceMonitor = useCallback(
    (sessionId: number) => {
      if (silenceMonitorRef.current) {
        clearInterval(silenceMonitorRef.current);
      }
      silenceMonitorRef.current = setInterval(() => {
        if (sessionId !== sessionIdRef.current || !isRecordingRef.current || isStoppingRef.current) {
          return;
        }
        if (!hasSpeechActivityRef.current || lastSpeechActivityAtRef.current <= 0) {
          return;
        }
        const quietMs = Date.now() - lastSpeechActivityAtRef.current;
        if (quietMs >= AUTO_FINALIZE_SILENCE_MS) {
          void stopMicInput();
        }
      }, 250);
    },
    [stopMicInput],
  );

  // Fallback 2: Single-pass batch transcription (only if neither Gemini Live nor Web Speech API works)
  const startBatchRecorderFallback = useCallback(
    async (sessionId: number, existingStream?: MediaStream) => {
      const currentSettings = settingsRef.current;
      const geminiKey = currentSettings.apiKey.trim();
      const groqKey = currentSettings.providerConnections?.groq?.apiKey?.trim() || '';

      if (!geminiKey && !groqKey) {
        setMicError('No API key. Add your key in Connections.');
        cleanupAll();
        return;
      }

      try {
        const stream = existingStream || (await acquireMobileMicStream());
        if (sessionId !== sessionIdRef.current) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }

        mediaStreamRef.current = stream;
        recorderChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        activeEngineRef.current = 'batch_recorder';

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recorderChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          releaseMicResources();
          if (sessionId !== sessionIdRef.current) return;

          const blob = new Blob(recorderChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          recorderChunksRef.current = [];
          mediaRecorderRef.current = null;
          activeEngineRef.current = 'none';

          if (blob.size < 100) {
            setIsTranscribing(false);
            return;
          }

          setIsTranscribing(true);
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBase64 = arrayBufferToBase64(arrayBuffer);
            const s = settingsRef.current;
            const gKey = s.apiKey.trim();

            // /api/gemini/transcribe is handled by clientApi.ts on Vercel/Android & server.ts in preview;
            // clientApi.ts automatically uses Groq Whisper first when GROQ KEY is ready, then Gemini.
            const res = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(gKey ? { 'x-gemini-api-key': gKey } : {}),
              },
              body: JSON.stringify({
                audioBase64,
                mimeType: blob.type || 'audio/webm',
                language: s.language,
              }),
            });
            const data = (await res.json()) as { ok?: boolean; text?: string; detail?: string };

            if (sessionId !== sessionIdRef.current) return;

            if (data.ok && data.text) {
              const updated = bufferRef.current.commitFinal(data.text, { isDelta: false });
              onTranscriptChangeRef.current(updated);
            } else {
              setMicError(data.detail || 'Could not transcribe audio.');
            }
          } catch {
            if (sessionId === sessionIdRef.current) {
              setMicError('Transcription request failed.');
            }
          } finally {
            if (sessionId === sessionIdRef.current) {
              setIsTranscribing(false);
            }
          }
        };

        recorder.start();
        isRecordingRef.current = true;
        setIsRecordingMic(true);
      } catch {
        if (sessionId === sessionIdRef.current) {
          setMicError('Microphone permission denied.');
          cleanupAll();
        }
      }
    },
    [acquireMobileMicStream, cleanupAll, releaseMicResources],
  );

  // Fallback 1: Native Browser Streaming SpeechRecognition (real-time interim + final)
  const startWebSpeechFallback = useCallback(
    (sessionId: number): boolean => {
      const RecognitionCtor = getBrowserSpeechRecognitionCtor();
      if (!RecognitionCtor) return false;

      // Release raw WebAudio mic stream first so mobile OS does not block SpeechRecognition
      releaseMicResources();

      const launchInstance = (isRestart: boolean) => {
        if (sessionId !== sessionIdRef.current || !isRecordingRef.current || isStoppingRef.current) {
          return;
        }

        const rec = new RecognitionCtor();
        rec.lang = getSpeechRecognitionLang(settingsRef.current.language);
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        let processedFinalIndex = 0;
        webSpeechRestartBoundaryRef.current = isRestart;
        recognitionRef.current = rec;
        activeEngineRef.current = 'web_speech';

        rec.onresult = (event: BrowserSpeechRecognitionEvent) => {
          if (sessionId !== sessionIdRef.current || isStoppingRef.current) return;

          hasSpeechActivityRef.current = true;
          lastSpeechActivityAtRef.current = Date.now();
          receivedAnyTranscriptRef.current = true;

          let interimCombined = '';
          if (event.results.length <= processedFinalIndex) {
            processedFinalIndex = event.resultIndex || 0;
          }
          const startIdx = Math.max(processedFinalIndex, event.resultIndex || 0);

          for (let i = startIdx; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result?.[0]?.transcript || '';
            if (!transcript) continue;

            if (result.isFinal) {
              processedFinalIndex = i + 1;
              // Android Chrome SpeechRecognition can emit cumulative or boundary-overlapping finals
              bufferRef.current.commitFinal(transcript, {
                isDelta: false,
                deduplicateBoundaryWord: true,
              });
              webSpeechRestartBoundaryRef.current = false;
            } else {
              interimCombined = interimCombined
                ? `${interimCombined} ${transcript.trim()}`
                : transcript.trim();
            }
          }

          const displayValue = interimCombined
            ? bufferRef.current.setInterim(interimCombined)
            : bufferRef.current.setInterim('');
          onTranscriptChangeRef.current(displayValue);
        };

        rec.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
          if (sessionId !== sessionIdRef.current || isStoppingRef.current) return;

          // 'no-speech' and 'aborted' are normal during natural pauses; ignore and keep alive
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setMicError('Microphone permission denied.');
            cleanupAll();
            return;
          }

          // If network/audio-capture fails before any transcript, gracefully fall back to batch
          if (!receivedAnyTranscriptRef.current) {
            recognitionRef.current = null;
            void startBatchRecorderFallback(sessionId);
          } else {
            setMicError('Speech recognition interrupted.');
            void stopMicInput();
          }
        };

        rec.onend = () => {
          if (sessionId !== sessionIdRef.current) return;
          if (!isRecordingRef.current || isStoppingRef.current) return;

          // Promote any pending interim before mobile Chrome restarts the recognition session
          const promoted = bufferRef.current.finalize();
          onTranscriptChangeRef.current(promoted);

          // If extended silence already elapsed after speaking, finalize cleanly
          if (
            hasSpeechActivityRef.current &&
            lastSpeechActivityAtRef.current > 0 &&
            Date.now() - lastSpeechActivityAtRef.current >= AUTO_FINALIZE_SILENCE_MS
          ) {
            void stopMicInput();
            return;
          }

          // Otherwise transparently continue listening (prevents mobile Chrome mid-sentence stop!)
          setTimeout(() => {
            if (sessionId === sessionIdRef.current && isRecordingRef.current && !isStoppingRef.current) {
              launchInstance(true);
            }
          }, 80);
        };

        try {
          rec.start();
        } catch {
          if (sessionId === sessionIdRef.current && !receivedAnyTranscriptRef.current) {
            recognitionRef.current = null;
            void startBatchRecorderFallback(sessionId);
          }
        }
      };

      isRecordingRef.current = true;
      setIsRecordingMic(true);
      startSilenceMonitor(sessionId);
      launchInstance(false);
      return true;
    },
    [cleanupAll, releaseMicResources, startBatchRecorderFallback, startSilenceMonitor, stopMicInput],
  );

  // Primary Engine: Gemini Live Real-Time Streaming Transcription (/ws/transcribe)
  const startGeminiLiveTranscribe = useCallback(
    async (sessionId: number) => {
      const currentSettings = settingsRef.current;
      const apiKey = currentSettings.apiKey.trim();

      let stream: MediaStream;
      try {
        stream = await acquireMobileMicStream();
      } catch {
        if (sessionId === sessionIdRef.current) {
          setMicError('Microphone permission denied.');
          cleanupAll();
        }
        return;
      }

      if (sessionId !== sessionIdRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      mediaStreamRef.current = stream;
      activeEngineRef.current = 'gemini_live';
      wsReadyRef.current = false;
      pendingAudioQueueRef.current = [];
      isRecordingRef.current = true;
      setIsRecordingMic(true);

      // Start low-latency 16 kHz PCM capture immediately so first syllables are buffered
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const inputCtx = new AudioCtx({ sampleRate: 16000 });
        if (inputCtx.state === 'suspended') {
          void inputCtx.resume().catch(() => undefined);
        }
        audioCtxRef.current = inputCtx;

        const chain = createVoiceInputChain(inputCtx, stream);
        inputChainRef.current = chain;

        chain.processor.onaudioprocess = (event: AudioProcessingEvent) => {
          if (
            sessionId !== sessionIdRef.current ||
            !isRecordingRef.current ||
            isStoppingRef.current
          ) {
            return;
          }

          const rawInput = event.inputBuffer.getChannelData(0);
          const pcm16k = resampleTo16kHz(rawInput, inputCtx.sampleRate);

          // Track voice activity purely for post-speech auto-finalize timer (never drops syllables)
          const rms = computeFrameRms(pcm16k);
          if (rms >= SPEECH_ACTIVITY_RMS) {
            hasSpeechActivityRef.current = true;
            lastSpeechActivityAtRef.current = Date.now();
          }

          const b64 = float32ToPcm16Base64(pcm16k);
          const ws = wsRef.current;

          if (ws && ws.readyState === WebSocket.OPEN && wsReadyRef.current) {
            ws.send(JSON.stringify({ type: 'audio', data: b64 }));
          } else {
            pendingAudioQueueRef.current.push(b64);
            if (pendingAudioQueueRef.current.length > MAX_PRECONNECT_CHUNKS) {
              pendingAudioQueueRef.current.shift();
            }
          }
        };
      } catch {
        // If Web Audio fails on an unusual browser, fall back cleanly
        if (startWebSpeechFallback(sessionId)) return;
        await startBatchRecorderFallback(sessionId, stream);
        return;
      }

      // Open direct client-side Gemini Live Transcribe socket (works on Vercel, Android APK, and preview)
      const ws = createTranscribeSocket();
      wsRef.current = ws;

      const fallbackFromGeminiLive = (errorDetail?: string) => {
        if (sessionId !== sessionIdRef.current || isStoppingRef.current) return;

        // Close failing WS
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        wsReadyRef.current = false;
        pendingAudioQueueRef.current = [];
        try {
          ws.close();
        } catch {
          // ignore
        }

        // If we haven't received any transcript yet, fall back seamlessly to Web Speech or batch
        if (!receivedAnyTranscriptRef.current) {
          const isAuthOrQuota =
            errorDetail &&
            (errorDetail.toLowerCase().includes('invalid api key') ||
              errorDetail.toLowerCase().includes('quota'));

          if (!isAuthOrQuota && startWebSpeechFallback(sessionId)) {
            return;
          }

          const groqKey = settingsRef.current.providerConnections?.groq?.apiKey?.trim() || '';
          if (groqKey || !isAuthOrQuota) {
            const existingStream = mediaStreamRef.current || undefined;
            // Detach audioCtx/processor while keeping mic stream open for batch fallback
            if (inputChainRef.current) {
              inputChainRef.current.disconnect();
              inputChainRef.current = null;
            }
            if (audioCtxRef.current) {
              void audioCtxRef.current.close().catch(() => undefined);
              audioCtxRef.current = null;
            }
            mediaStreamRef.current = null;
            void startBatchRecorderFallback(sessionId, existingStream);
            return;
          }
        }

        // Already received partial transcript: finalize cleanly without losing recognized words
        const saved = bufferRef.current.finalize();
        onTranscriptChangeRef.current(saved);
        if (errorDetail) {
          setMicError(errorDetail);
        }
        cleanupAll();
      };

      ws.onopen = () => {
        if (sessionId !== sessionIdRef.current) {
          ws.close();
          return;
        }
        ws.send(
          JSON.stringify({
            type: 'start',
            apiKey,
            languageCodes: getLanguageCodesForLiveTranscribe(settingsRef.current.language),
          }),
        );
      };

      ws.onmessage = (event) => {
        if (sessionId !== sessionIdRef.current) return;

        try {
          const msg = JSON.parse(String(event.data)) as {
            type: string;
            text?: string;
            label?: string;
            detail?: string;
          };

          if (msg.type === 'ready') {
            wsReadyRef.current = true;
            // Flush pre-connect buffered PCM frames in exact order
            const queued = pendingAudioQueueRef.current;
            pendingAudioQueueRef.current = [];
            for (const chunk of queued) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'audio', data: chunk }));
              }
            }
            startSilenceMonitor(sessionId);
          } else if (msg.type === 'interim' && typeof msg.text === 'string') {
            hasSpeechActivityRef.current = true;
            lastSpeechActivityAtRef.current = Date.now();
            receivedAnyTranscriptRef.current = true;

            const updated = bufferRef.current.setInterim(msg.text);
            onTranscriptChangeRef.current(updated);
          } else if (msg.type === 'final' && typeof msg.text === 'string') {
            hasSpeechActivityRef.current = true;
            lastSpeechActivityAtRef.current = Date.now();
            receivedAnyTranscriptRef.current = true;

            const updated = bufferRef.current.commitFinal(msg.text, { isDelta: true });
            onTranscriptChangeRef.current(updated);

            if (isStoppingRef.current) {
              resolvePendingFlush();
            }
          } else if (msg.type === 'turn_complete') {
            if (isStoppingRef.current) {
              resolvePendingFlush();
            }
          } else if (msg.type === 'error') {
            if (isStoppingRef.current) {
              resolvePendingFlush();
            } else {
              fallbackFromGeminiLive(msg.detail || msg.label || 'Transcription connection failed.');
            }
          } else if (msg.type === 'closed') {
            if (isStoppingRef.current) {
              resolvePendingFlush();
            } else if (receivedAnyTranscriptRef.current) {
              // Unexpected server close after speaking: finalize gracefully without losing text
              const saved = bufferRef.current.finalize();
              onTranscriptChangeRef.current(saved);
              cleanupAll();
            } else {
              fallbackFromGeminiLive();
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        if (sessionId !== sessionIdRef.current) return;
        if (isStoppingRef.current) {
          resolvePendingFlush();
        } else {
          fallbackFromGeminiLive('Real-time transcription connection error.');
        }
      };

      ws.onclose = () => {
        if (sessionId !== sessionIdRef.current) return;
        if (isStoppingRef.current) {
          resolvePendingFlush();
        } else if (wsRef.current === ws) {
          if (receivedAnyTranscriptRef.current) {
            const saved = bufferRef.current.finalize();
            onTranscriptChangeRef.current(saved);
            cleanupAll();
          } else {
            fallbackFromGeminiLive();
          }
        }
      };
    },
    [
      acquireMobileMicStream,
      cleanupAll,
      resolvePendingFlush,
      startBatchRecorderFallback,
      startSilenceMonitor,
      startWebSpeechFallback,
    ],
  );

  const toggleMicInput = useCallback(
    async (currentInput: string) => {
      setMicError('');

      if (isRecordingRef.current) {
        await stopMicInput();
        return;
      }

      const currentSettings = settingsRef.current;
      const geminiKey = currentSettings.apiKey.trim();
      const groqKey = currentSettings.providerConnections?.groq?.apiKey?.trim() || '';
      const hasWebSpeech = getBrowserSpeechRecognitionCtor() !== null;

      // No own key: Premium customers and the admin dictate through the ROSE server (the mic stays open,
      // each sentence is turned into text when he pauses). Others get the server's clear message.
      if (!geminiKey && !groqKey) {
        let acc = currentInput;
        try {
          const mic = await openQuietMic(async (wav) => {
            setIsTranscribing(true);
            const r = await premiumStt(wav, String(settingsRef.current.language || 'Bengali'));
            setIsTranscribing(false);
            if (r.ok && r.text) {
              acc = acc.trim() ? `${acc.trim()} ${r.text}` : r.text;
              bufferRef.current.reset(acc);
              onTranscriptChangeRef.current(acc);
            } else if (!r.ok) {
              setMicError(r.message || 'শুনতে সমস্যা হলো।');
            }
          });
          bufferRef.current.reset(currentInput);
          premMicRef.current = mic;
          mic.setListening(true);
          isRecordingRef.current = true;
          setIsRecordingMic(true);
        } catch {
          if (!hasWebSpeech) setMicError('মাইক চালু করা যায়নি। মাইকের অনুমতি দিন, অথবা Connections-এ নিজের ফ্রি key দিন।');
          else {
            sessionIdRef.current += 1;
            bufferRef.current.reset(currentInput);
            startWebSpeechFallback(sessionIdRef.current);
          }
        }
        return;
      }

      // Initialize new monotonic dictation session
      sessionIdRef.current += 1;
      const sessionId = sessionIdRef.current;

      bufferRef.current.reset(currentInput);
      hasSpeechActivityRef.current = false;
      lastSpeechActivityAtRef.current = 0;
      receivedAnyTranscriptRef.current = false;
      isStoppingRef.current = false;

      if (geminiKey) {
        await startGeminiLiveTranscribe(sessionId);
      } else if (groqKey) {
        // Groq key: record and let Groq Whisper write it. The phone's speech recognizer is not used here,
        // because on Android it plays a start beep every time it starts.
        await startBatchRecorderFallback(sessionId);
      } else if (startWebSpeechFallback(sessionId)) {
        return;
      } else {
        await startBatchRecorderFallback(sessionId);
      }
    },
    [startBatchRecorderFallback, startGeminiLiveTranscribe, startWebSpeechFallback, stopMicInput],
  );

  const clearMicError = useCallback(() => {
    setMicError('');
  }, []);

  const syncManualEdit = useCallback((value: string) => {
    if (isRecordingRef.current) {
      bufferRef.current.reset(value);
    }
  }, []);

  return {
    isRecordingMic,
    isTranscribing,
    micError,
    clearMicError,
    toggleMicInput,
    stopMicInput,
    syncManualEdit,
  };
}
