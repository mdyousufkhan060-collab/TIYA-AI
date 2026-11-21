import { createLiveSocket } from '../lib/clientApi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CharacterProfile,
  ChatMessage,
  MemoryItem,
  PhoneAction,
  TiyaSettings,
  VoiceState,
} from '../types/tiya';
import {
  computeRmsEnergy,
  float32ToPcm16Base64,
} from '../utils/audioPcm';
import {
  applyStartAntiClick,
  computeNaturalPlaybackRate,
  createVoiceInputChain,
  createVoiceOutputChain,
  decodeAudioChunkPayload,
  getFallbackVoiceMediaConstraints,
  getMobileVoiceMediaConstraints,
  PrimarySpeakerVoiceGate,
  resampleTo16kHz,
  resolveCanonicalFemaleVoice,
  VoiceInputChain,
  VoiceOutputChain,
  VoiceTranscriptSynchronizer,
} from '../utils/voiceAudioPipeline';
import { TranscriptStreamBuffer } from '../utils/transcriptBuffer';
import { classifyGeminiError } from '../utils/errorClassifier';
import { ReplyUsageDecision } from '../utils/authErrors';
import { buildProactiveVoiceCue, resolveActiveCharacter } from '../utils/characters';
import { buildTiyaSystemPrompt } from '../utils/prompts';
import { appendErrorLog } from '../utils/storage';
import { NavigationCommand, parseNavigationCommand } from '../utils/tiyaNavigation';

interface UseTiyaLiveVoiceOptions {
  settings: TiyaSettings;
  messages: ChatMessage[];
  memories?: MemoryItem[];
  userAge?: number | null;
  /** Backend-verified Admin session flag (from Supabase is_admin RPC + active session) */
  isOwner?: boolean;
  checkReplyUsage?: () => Promise<ReplyUsageDecision>;
  onAppendVoiceMessage: (role: 'user' | 'assistant', text: string, action?: PhoneAction) => void;
  onUpdateLastVoiceMessage: (role: 'user' | 'assistant', text: string) => void;
  onUserTranscriptFinalized?: (text: string) => void;
  onPhoneAction: (action: PhoneAction) => void;
  onNavigate?: (cmd: NavigationCommand) => void;
  onRequestLatestMotivation?: () => Promise<{ title?: string | null; body: string } | null>;
}

const CAMERA_FPS_INTERVAL_MS = 1000; // <= 1 FPS per Gemini Live API guidelines
const PROACTIVE_OPENING_DELAY_MS = 550;
const INTERRUPT_DISPLAY_MS = 320;
const STOPPED_DISPLAY_MS = 280;

export function useTiyaLiveVoice({
  settings,
  messages,
  memories = [],
  userAge,
  isOwner = false,
  checkReplyUsage,
  onAppendVoiceMessage,
  onUpdateLastVoiceMessage,
  onUserTranscriptFinalized,
  onPhoneAction,
  onNavigate,
  onRequestLatestMotivation,
}: UseTiyaLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorLabel, setErrorLabel] = useState<string>('');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');

  const isMinor = typeof userAge === 'number' && userAge < 18;
  const activeCharacter: CharacterProfile = useMemo(
    () => resolveActiveCharacter(settings, isOwner, isMinor),
    [settings, isOwner, isMinor],
  );

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;
  const userAgeRef = useRef(userAge);
  userAgeRef.current = userAge;
  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;
  const activeCharacterRef = useRef<CharacterProfile>(activeCharacter);
  activeCharacterRef.current = activeCharacter;
  const checkReplyUsageRef = useRef(checkReplyUsage);
  checkReplyUsageRef.current = checkReplyUsage;
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const cameraActiveRef = useRef(cameraActive);
  cameraActiveRef.current = cameraActive;

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputChainRef = useRef<VoiceInputChain | null>(null);
  const outputChainRef = useRef<VoiceOutputChain | null>(null);
  const voiceGateRef = useRef<PrimarySpeakerVoiceGate>(new PrimarySpeakerVoiceGate());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const lastAudioChunkStartRef = useRef<number>(0);
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionGenRef = useRef<number>(0);

  // Proactive initiation & state transition timers
  const proactiveOpeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCheckInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proactiveStreakRef = useRef<number>(0);
  const hasSpokenInSessionRef = useRef<boolean>(false);

  // Opt-in camera streaming resources (OFF by default, verified Admin only)
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userTurnBufferRef = useRef<TranscriptStreamBuffer>(new TranscriptStreamBuffer());
  const assistantTurnBufferRef = useRef<TranscriptStreamBuffer>(new TranscriptStreamBuffer());
  const assistantSyncRef = useRef<VoiceTranscriptSynchronizer>(new VoiceTranscriptSynchronizer());
  const assistantSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnCompletePendingRef = useRef<boolean>(false);

  const hasStartedUserBubbleRef = useRef<boolean>(false);
  const hasStartedAssistantBubbleRef = useRef<boolean>(false);
  const lastNavHandledRef = useRef<string>('');
  const lastFinalizedUserMemoryTextRef = useRef<string>('');

  const callbacksRef = useRef({
    onAppendVoiceMessage,
    onUpdateLastVoiceMessage,
    onUserTranscriptFinalized,
    onPhoneAction,
    onNavigate,
    onRequestLatestMotivation,
  });
  callbacksRef.current = {
    onAppendVoiceMessage,
    onUpdateLastVoiceMessage,
    onUserTranscriptFinalized,
    onPhoneAction,
    onNavigate,
    onRequestLatestMotivation,
  };

  // Sync live volume changes to the mobile speaker output chain immediately
  useEffect(() => {
    if (outputChainRef.current) {
      outputChainRef.current.setVolume(settings.volume);
    }
  }, [settings.volume]);

  const clearProactiveTimers = useCallback(() => {
    if (proactiveOpeningTimerRef.current) {
      clearTimeout(proactiveOpeningTimerRef.current);
      proactiveOpeningTimerRef.current = null;
    }
    if (idleCheckInTimerRef.current) {
      clearTimeout(idleCheckInTimerRef.current);
      idleCheckInTimerRef.current = null;
    }
  }, []);

  const clearStateTransitionTimer = useCallback(() => {
    if (stateTransitionTimerRef.current) {
      clearTimeout(stateTransitionTimerRef.current);
      stateTransitionTimerRef.current = null;
    }
  }, []);

  const clearAssistantSyncTimer = useCallback(() => {
    if (assistantSyncTimerRef.current) {
      clearTimeout(assistantSyncTimerRef.current);
      assistantSyncTimerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraFrameTimerRef.current) {
      clearInterval(cameraFrameTimerRef.current);
      cameraFrameTimerRef.current = null;
    }
    if (cameraVideoRef.current) {
      try {
        cameraVideoRef.current.pause();
        cameraVideoRef.current.srcObject = null;
      } catch {
        // ignore
      }
      cameraVideoRef.current = null;
    }
    cameraCanvasRef.current = null;
    if (cameraStreamRef.current) {
      for (const track of cameraStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      cameraStreamRef.current = null;
    }
    cameraActiveRef.current = false;
    setCameraActive(false);
    setCameraError('');
  }, []);

  const sendCameraFrame = useCallback(() => {
    const ws = wsRef.current;
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !video || !canvas) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    try {
      const targetW = 320;
      const targetH = Math.max(180, Math.round((video.videoHeight / video.videoWidth) * targetW));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      if (base64) {
        ws.send(JSON.stringify({ type: 'video', data: base64, mimeType: 'image/jpeg' }));
      }
    } catch {
      // Skip transient frame capture errors
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    setCameraError('');
    if (cameraActiveRef.current) {
      stopCamera();
      return;
    }
    // Strict backend-verified Admin & capability gate
    if (!isOwnerRef.current || !activeCharacterRef.current.capabilities.cameraVisualContext) {
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setCameraError('Start voice mode first to enable camera visual context.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera is not supported in this browser.');
      return;
    }

    const mySessionGen = sessionGenRef.current;
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (mySessionGen !== sessionGenRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        for (const t of videoStream.getTracks()) t.stop();
        return;
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = videoStream;
      await video.play().catch(() => {});

      const canvas = document.createElement('canvas');
      cameraStreamRef.current = videoStream;
      cameraVideoRef.current = video;
      cameraCanvasRef.current = canvas;
      cameraActiveRef.current = true;
      setCameraActive(true);
      setCameraError('');

      // Send an initial frame once metadata is available, then <= 1 FPS
      setTimeout(() => {
        if (cameraActiveRef.current && mySessionGen === sessionGenRef.current) {
          sendCameraFrame();
        }
      }, 250);
      cameraFrameTimerRef.current = setInterval(() => {
        if (cameraActiveRef.current && mySessionGen === sessionGenRef.current) {
          sendCameraFrame();
        }
      }, CAMERA_FPS_INTERVAL_MS);
    } catch {
      stopCamera();
      setCameraError('Camera permission denied or unavailable.');
    }
  }, [sendCameraFrame, stopCamera]);

  const scheduleIdleCheckIn = useCallback(
    (mySessionGen: number) => {
      if (idleCheckInTimerRef.current) {
        clearTimeout(idleCheckInTimerRef.current);
        idleCheckInTimerRef.current = null;
      }

      const char = activeCharacterRef.current;
      if (
        !isOwnerRef.current ||
        !char.initiationBehavior.enabled ||
        !char.initiationBehavior.allowIdleFollowUp ||
        proactiveStreakRef.current >= char.initiationBehavior.maxConsecutiveProactiveTurns
      ) {
        return;
      }

      const waitMs = Math.max(15000, char.initiationBehavior.idleCheckInMinMs || 45000);
      idleCheckInTimerRef.current = setTimeout(() => {
        idleCheckInTimerRef.current = null;
        if (mySessionGen !== sessionGenRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (voiceStateRef.current !== 'listening' || activeSourcesRef.current.size > 0) return;

        const latestChar = activeCharacterRef.current;
        if (
          !isOwnerRef.current ||
          !latestChar.initiationBehavior.enabled ||
          !latestChar.initiationBehavior.allowIdleFollowUp ||
          proactiveStreakRef.current >= latestChar.initiationBehavior.maxConsecutiveProactiveTurns
        ) {
          return;
        }

        proactiveStreakRef.current += 1;
        const cue = buildProactiveVoiceCue({
          kind: 'idle_checkin',
          language: settingsRef.current.language || 'Bengali',
          recentMessages: messagesRef.current,
          cameraActive: cameraActiveRef.current,
        });
        setVoiceState('thinking');
        wsRef.current.send(JSON.stringify({ type: 'proactive_prompt', text: cue }));
      }, waitMs);
    },
    [],
  );

  const pushUserBubble = useCallback((displayText: string) => {
    const trimmed = displayText.trim();
    if (!trimmed) return;
    if (!hasStartedUserBubbleRef.current) {
      hasStartedUserBubbleRef.current = true;
      callbacksRef.current.onAppendVoiceMessage('user', displayText);
    } else {
      callbacksRef.current.onUpdateLastVoiceMessage('user', displayText);
    }
  }, []);

  const finalizePendingUserBubble = useCallback(() => {
    if (!hasStartedUserBubbleRef.current) return;
    const finalizedUser = userTurnBufferRef.current.finalize();
    if (finalizedUser) {
      pushUserBubble(finalizedUser);
      const clean = finalizedUser.trim();
      if (clean && clean !== lastFinalizedUserMemoryTextRef.current) {
        lastFinalizedUserMemoryTextRef.current = clean;
        callbacksRef.current.onUserTranscriptFinalized?.(clean);
      }
    }
    hasStartedUserBubbleRef.current = false;
    userTurnBufferRef.current.reset();
  }, [pushUserBubble]);

  const pushAssistantBubble = useCallback((displayText: string) => {
    const trimmed = displayText.trim();
    if (!trimmed) return;
    if (!hasStartedAssistantBubbleRef.current) {
      hasStartedAssistantBubbleRef.current = true;
      callbacksRef.current.onAppendVoiceMessage('assistant', displayText);
    } else {
      callbacksRef.current.onUpdateLastVoiceMessage('assistant', displayText);
    }
  }, []);

  const flushRemainingAssistantChunks = useCallback(() => {
    clearAssistantSyncTimer();
    const remaining = assistantSyncRef.current.flushAll();
    if (remaining.length === 0) return;
    let latest = '';
    for (const chunk of remaining) {
      latest = assistantTurnBufferRef.current.commitFinal(chunk, { isDelta: true });
    }
    if (latest) {
      pushAssistantBubble(latest);
    }
  }, [clearAssistantSyncTimer, pushAssistantBubble]);

  const resetTurnState = useCallback(() => {
    clearAssistantSyncTimer();
    assistantSyncRef.current.cancelPending();
    userTurnBufferRef.current.reset();
    assistantTurnBufferRef.current.reset();
    hasStartedUserBubbleRef.current = false;
    hasStartedAssistantBubbleRef.current = false;
    turnCompletePendingRef.current = false;
    lastNavHandledRef.current = '';
  }, [clearAssistantSyncTimer]);

  const stopPlaybackQueue = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
      lastAudioChunkStartRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
      lastAudioChunkStartRef.current = 0;
    }
  }, []);

  const cleanupResources = useCallback(() => {
    // Advance generation immediately so no in-flight async setup or stale socket can overlap audio
    sessionGenRef.current += 1;

    clearProactiveTimers();
    clearStateTransitionTimer();
    stopCamera();

    if (connectWatchdogRef.current) {
      clearTimeout(connectWatchdogRef.current);
      connectWatchdogRef.current = null;
    }

    stopPlaybackQueue();

    if (inputChainRef.current) {
      inputChainRef.current.disconnect();
      inputChainRef.current = null;
    }

    voiceGateRef.current.reset();

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputChainRef.current) {
      outputChainRef.current.cleanup();
      outputChainRef.current = null;
    }

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      try {
        // Detach all handlers before closing so stale audio frames never overlap a new session
        oldWs.onopen = null;
        oldWs.onmessage = null;
        oldWs.onerror = null;
        oldWs.onclose = null;
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.send(JSON.stringify({ type: 'stop' }));
        }
        oldWs.close();
      } catch {
        // ignore
      }
    }

    proactiveStreakRef.current = 0;
    hasSpokenInSessionRef.current = false;
    resetTurnState();
    setAudioLevel(0);
  }, [clearProactiveTimers, clearStateTransitionTimer, resetTurnState, stopCamera, stopPlaybackQueue]);

  const stopVoice = useCallback(() => {
    cleanupResources();
    const stoppedGen = sessionGenRef.current;
    setActiveModel('');
    setVoiceState('stopped');
    stateTransitionTimerRef.current = setTimeout(() => {
      stateTransitionTimerRef.current = null;
      if (sessionGenRef.current === stoppedGen && voiceStateRef.current === 'stopped') {
        setVoiceState('idle');
      }
    }, STOPPED_DISPLAY_MS);
  }, [cleanupResources]);

  const playPcmChunk = useCallback(
    (base64Data: string, mimeType: string | undefined, mySessionGen: number) => {
      const ctx = outputCtxRef.current;
      const outputChain = outputChainRef.current;
      if (!ctx || !outputChain) return;

      if (ctx.state === 'suspended') {
        void outputChain.ensureActive();
      }

      const { samples: decoded, sampleRate } = decodeAudioChunkPayload(base64Data, mimeType);
      if (decoded.length === 0) return;

      const float32 =
        activeSourcesRef.current.size === 0
          ? applyStartAntiClick(decoded, sampleRate)
          : decoded;

      const rms = computeRmsEnergy(float32);
      setAudioLevel(Math.min(1, rms * 4.5));

      const buffer = ctx.createBuffer(1, float32.length, sampleRate);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Pitch-faithful playback rate (1.0 at default preserves exact female vocal identity without deepening)
      const effectiveRate = computeNaturalPlaybackRate(settingsRef.current.speechSpeed);
      source.playbackRate.value = effectiveRate;
      const pitchRatio = settingsRef.current.pitch || 1.0;
      if (typeof source.detune !== 'undefined' && Math.abs(pitchRatio - 1.0) > 0.005) {
        source.detune.value = (pitchRatio - 1.0) * 1200;
      }
      source.connect(outputChain.inputNode);

      const now = ctx.currentTime;
      const startAt = Math.max(now, nextStartTimeRef.current);
      source.start(startAt);
      lastAudioChunkStartRef.current = startAt;
      nextStartTimeRef.current = startAt + buffer.duration / effectiveRate;

      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          // Flush any remaining synchronized assistant text right as speech completes
          flushRemainingAssistantChunks();
          if (turnCompletePendingRef.current) {
            resetTurnState();
          }
          if (voiceStateRef.current === 'speaking' && mySessionGen === sessionGenRef.current) {
            // Hands-free loop: return seamlessly to listening once TIYA finishes speaking
            setVoiceState('listening');
            setAudioLevel(0);
            scheduleIdleCheckIn(mySessionGen);
          }
        }
      };
    },
    [flushRemainingAssistantChunks, resetTurnState, scheduleIdleCheckIn],
  );

  const startVoice = useCallback(async () => {
    const currentSettings = settingsRef.current;
    const apiKey = currentSettings.apiKey.trim();

    const hasGroq = Boolean((currentSettings.providerConnections?.groq?.apiKey || '').trim());
    if (!apiKey && !hasGroq) {
      setErrorLabel('No API key');
      setErrorDetail('Add your Gemini or Groq API key in Settings > Connections.');
      setVoiceState('error');
      return;
    }

    cleanupResources();
    const mySessionGen = sessionGenRef.current;
    setErrorLabel('');
    setErrorDetail('');
    setCameraError('');
    setVoiceState('connecting');

    // Create and unlock output audio context synchronously inside user tap gesture
    // so mobile Chrome & Android WebView route playback cleanly to the phone speaker.
    const outputCtx = new AudioContext({ sampleRate: 24000 });
    const outputChain = createVoiceOutputChain(outputCtx, currentSettings.volume);
    outputCtxRef.current = outputCtx;
    outputChainRef.current = outputChain;
    void outputChain.ensureActive();

    if (checkReplyUsageRef.current) {
      const decision = await checkReplyUsageRef.current();
      if (mySessionGen !== sessionGenRef.current) return;
      if (!decision.allowed) {
        const msg = decision.messageBn || 'আজকের লিমিট শেষ';
        cleanupResources();
        setErrorLabel(msg);
        setErrorDetail('');
        setVoiceState('error');
        callbacksRef.current.onAppendVoiceMessage('assistant', msg);
        return;
      }
    }

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          getMobileVoiceMediaConstraints(),
        );
      } catch (constraintErr: unknown) {
        const errName =
          constraintErr instanceof Error ? constraintErr.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          throw constraintErr;
        }
        stream = await navigator.mediaDevices.getUserMedia(
          getFallbackVoiceMediaConstraints(),
        );
      }
      if (mySessionGen !== sessionGenRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      mediaStreamRef.current = stream;
    } catch (err: unknown) {
      if (mySessionGen !== sessionGenRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(msg);
      setErrorLabel(classified.label);
      setErrorDetail(classified.detail);
      setVoiceState('error');
      cleanupResources();
      return;
    }

    const inputCtx = new AudioContext({ sampleRate: 16000 });
    inputCtxRef.current = inputCtx;

    if (inputCtx.state === 'suspended') await inputCtx.resume();
    await outputChain.ensureActive();
    if (mySessionGen !== sessionGenRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Runs on the device (Vercel has no voice server) — see src/lib/clientApi.ts
    void protocol;
    const ws = createLiveSocket();
    wsRef.current = ws;

    connectWatchdogRef.current = setTimeout(() => {
      if (mySessionGen === sessionGenRef.current && voiceStateRef.current === 'connecting') {
        cleanupResources();
        setErrorLabel('Model not available');
        setErrorDetail('Timed out connecting to Gemini Live. Check your key or model.');
        setVoiceState('error');
      }
    }, 40000);

    ws.onopen = () => {
      if (mySessionGen !== sessionGenRef.current) return;
      const char = activeCharacterRef.current;
      const systemInstruction = buildTiyaSystemPrompt(
        settingsRef.current,
        messagesRef.current,
        'voice',
        userAgeRef.current,
        memoriesRef.current,
        isOwnerRef.current,
        {
          cameraActive: false,
          character: char,
        },
      );
      const primaryModel =
        settingsRef.current.customLiveModel.trim() || settingsRef.current.selectedLiveModel;
      const fallbackModels = settingsRef.current.availableLiveModels.map((m) => m.id);
      const lockedVoiceName = resolveCanonicalFemaleVoice(settingsRef.current.voiceName);

      ws.send(
        JSON.stringify({
          type: 'start',
          apiKey,
          model: primaryModel,
          fallbackModels,
          autoFallback: settingsRef.current.autoFallback,
          voiceName: lockedVoiceName,
          language: settingsRef.current.language,
          speechSpeed: settingsRef.current.speechSpeed,
          isOwner: isOwnerRef.current,
          systemInstruction,
        }),
      );
    };

    ws.onmessage = (event) => {
      if (mySessionGen !== sessionGenRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          model?: string;
          data?: string;
          mimeType?: string;
          text?: string;
          final?: boolean;
          label?: string;
          detail?: string;
          action?: PhoneAction;
          command?: NavigationCommand;
          callId?: string;
          name?: string;
        };

        const runAssistantSyncPump = () => {
          clearAssistantSyncTimer();
          const audioNow = outputCtxRef.current ? outputCtxRef.current.currentTime : 0;
          const ready = assistantSyncRef.current.drainReady(audioNow);
          if (ready.length > 0) {
            let latest = '';
            for (const chunk of ready) {
              latest = assistantTurnBufferRef.current.commitFinal(chunk, { isDelta: true });
            }
            if (latest) {
              pushAssistantBubble(latest);
            }
          }
          const delayMs = assistantSyncRef.current.nextDelayMs(audioNow);
          if (delayMs !== null) {
            assistantSyncTimerRef.current = setTimeout(runAssistantSyncPump, delayMs);
          }
        };

        if (msg.type === 'ready') {
          if (connectWatchdogRef.current) {
            clearTimeout(connectWatchdogRef.current);
            connectWatchdogRef.current = null;
          }
          setActiveModel(msg.model || settingsRef.current.selectedLiveModel);
          setVoiceState('listening');
          proactiveStreakRef.current = 0;
          hasSpokenInSessionRef.current = false;

          // Begin noise-cancelled, primary-speaker gated 16 kHz mic streaming
          voiceGateRef.current.reset();
          const inputChain = createVoiceInputChain(inputCtx, stream);
          inputChainRef.current = inputChain;

          inputChain.processor.onaudioprocess = (audioEvent) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const rawChannel = audioEvent.inputBuffer.getChannelData(0);
            const pcm16k = resampleTo16kHz(rawChannel, inputCtx.sampleRate);
            const sensitivity = settingsRef.current.micListening?.sensitivity ?? 1.0;
            const isSpeaking = voiceStateRef.current === 'speaking';

            const gateResult = voiceGateRef.current.processFrame(
              pcm16k,
              sensitivity,
              isSpeaking,
            );

            if (voiceStateRef.current === 'listening') {
              setAudioLevel(gateResult.displayLevel);
              // If user begins speaking strongly before the opening proactive cue fires, yield immediately
              if (gateResult.displayLevel > 0.2 && proactiveOpeningTimerRef.current) {
                clearTimeout(proactiveOpeningTimerRef.current);
                proactiveOpeningTimerRef.current = null;
              }
            }

            for (const chunk of gateResult.chunksToSend) {
              const base64 = float32ToPcm16Base64(chunk);
              wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
            }
          };

          // Proactive natural voice initiation ONLY for verified Admin / enabled characters
          const char = activeCharacterRef.current;
          if (
            isOwnerRef.current &&
            char.initiationBehavior.enabled &&
            char.initiationBehavior.allowVoiceOpening
          ) {
            proactiveOpeningTimerRef.current = setTimeout(() => {
              proactiveOpeningTimerRef.current = null;
              if (mySessionGen !== sessionGenRef.current) return;
              if (hasSpokenInSessionRef.current) return;
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
              if (voiceStateRef.current !== 'listening') return;

              proactiveStreakRef.current += 1;
              const cue = buildProactiveVoiceCue({
                kind: 'session_opening',
                language: settingsRef.current.language || 'Bengali',
                recentMessages: messagesRef.current,
                cameraActive: cameraActiveRef.current,
              });
              setVoiceState('thinking');
              wsRef.current.send(JSON.stringify({ type: 'proactive_prompt', text: cue }));
            }, PROACTIVE_OPENING_DELAY_MS);
          }
        } else if (msg.type === 'input_interim' && msg.text) {
          clearProactiveTimers();
          clearStateTransitionTimer();
          proactiveStreakRef.current = 0;
          hasSpokenInSessionRef.current = true;
          if (voiceStateRef.current === 'interrupted') {
            setVoiceState('listening');
          }
          // User started or continues speaking: flush/close any prior assistant turn cleanly
          if (hasStartedAssistantBubbleRef.current) {
            flushRemainingAssistantChunks();
            hasStartedAssistantBubbleRef.current = false;
            assistantTurnBufferRef.current.reset();
            turnCompletePendingRef.current = false;
          }
          const wasFirstBubble = !hasStartedUserBubbleRef.current;
          const display = userTurnBufferRef.current.setInterim(msg.text);
          pushUserBubble(display);
          if (wasFirstBubble && hasStartedUserBubbleRef.current && checkReplyUsageRef.current) {
            void checkReplyUsageRef.current().then((decision) => {
              if (!decision.allowed && wsRef.current) {
                const limitMsg = decision.messageBn || 'আজকের লিমিট শেষ';
                cleanupResources();
                setErrorLabel(limitMsg);
                setErrorDetail('');
                setVoiceState('error');
                callbacksRef.current.onAppendVoiceMessage('assistant', limitMsg);
              }
            });
          }
        } else if (msg.type === 'input_transcript' && msg.text) {
          clearProactiveTimers();
          clearStateTransitionTimer();
          proactiveStreakRef.current = 0;
          hasSpokenInSessionRef.current = true;
          if (hasStartedAssistantBubbleRef.current) {
            flushRemainingAssistantChunks();
            hasStartedAssistantBubbleRef.current = false;
            assistantTurnBufferRef.current.reset();
            turnCompletePendingRef.current = false;
          }
          const wasFirstBubble = !hasStartedUserBubbleRef.current;
          const display = userTurnBufferRef.current.commitFinal(msg.text, { isDelta: true });
          pushUserBubble(display);
          if (wasFirstBubble && hasStartedUserBubbleRef.current && checkReplyUsageRef.current) {
            void checkReplyUsageRef.current().then((decision) => {
              if (!decision.allowed && wsRef.current) {
                const limitMsg = decision.messageBn || 'আজকের লিমিট শেষ';
                cleanupResources();
                setErrorLabel(limitMsg);
                setErrorDetail('');
                setVoiceState('error');
                callbacksRef.current.onAppendVoiceMessage('assistant', limitMsg);
              }
            });
          }
          const navCmd = parseNavigationCommand(display);
          if (navCmd && lastNavHandledRef.current !== display.trim()) {
            lastNavHandledRef.current = display.trim();
            callbacksRef.current.onNavigate?.(navCmd);
          }
          if (voiceStateRef.current === 'listening' || voiceStateRef.current === 'interrupted') {
            setVoiceState('thinking');
          }
        } else if (msg.type === 'output_transcript' && msg.text) {
          clearProactiveTimers();
          // Finalize any pending user interim text before switching to assistant bubble
          finalizePendingUserBubble();

          const ctx = outputCtxRef.current;
          const audioNow = ctx ? ctx.currentTime : 0;
          const schedStart = ctx ? Math.max(audioNow, lastAudioChunkStartRef.current) : 0;
          const schedEnd = ctx ? Math.max(schedStart, nextStartTimeRef.current) : 0;

          assistantSyncRef.current.enqueue(msg.text, audioNow, schedStart, schedEnd);
          runAssistantSyncPump();
        } else if (msg.type === 'output_transcript_sync' && msg.text) {
          clearProactiveTimers();
          finalizePendingUserBubble();
          const display = msg.final
            ? assistantTurnBufferRef.current.commitFinal(msg.text, {
                isDelta: false,
                deduplicateBoundaryWord: true,
              })
            : assistantTurnBufferRef.current.setInterim(msg.text);
          pushAssistantBubble(display);
        } else if (msg.type === 'audio' && msg.data) {
          clearProactiveTimers();
          clearStateTransitionTimer();
          finalizePendingUserBubble();
          setVoiceState('speaking');
          playPcmChunk(msg.data, msg.mimeType, mySessionGen);
          // Pump synchronized text immediately as new audio playback begins
          if (assistantSyncRef.current.pendingCount() > 0) {
            runAssistantSyncPump();
          }
        } else if (msg.type === 'interrupted') {
          // User barged in: stop playback immediately, cancel queued text & pending proactive cues,
          // surface explicit 'interrupted' state briefly, then resume listening seamlessly.
          clearProactiveTimers();
          clearStateTransitionTimer();
          stopPlaybackQueue();
          clearAssistantSyncTimer();
          assistantSyncRef.current.cancelPending();
          turnCompletePendingRef.current = false;
          setAudioLevel(0);
          setVoiceState('interrupted');
          stateTransitionTimerRef.current = setTimeout(() => {
            stateTransitionTimerRef.current = null;
            if (mySessionGen === sessionGenRef.current && voiceStateRef.current === 'interrupted') {
              setVoiceState('listening');
            }
          }, INTERRUPT_DISPLAY_MS);
        } else if (msg.type === 'turn_complete') {
          finalizePendingUserBubble();
          if (activeSourcesRef.current.size === 0) {
            flushRemainingAssistantChunks();
            resetTurnState();
            setVoiceState('listening');
            scheduleIdleCheckIn(mySessionGen);
          } else {
            // Keep synchronized text draining until the last scheduled audio buffer ends
            turnCompletePendingRef.current = true;
          }
        } else if (msg.type === 'phone_action' && msg.action) {
          callbacksRef.current.onPhoneAction(msg.action);
        } else if (msg.type === 'navigate' && msg.command) {
          callbacksRef.current.onNavigate?.(msg.command);
        } else if (msg.type === 'request_latest_motivation' && msg.callId) {
          const callId = msg.callId;
          const fnName = msg.name || 'get_latest_motivation';
          void (async () => {
            let post: { title?: string | null; body: string } | null = null;
            try {
              if (callbacksRef.current.onRequestLatestMotivation) {
                post = await callbacksRef.current.onRequestLatestMotivation();
              }
            } catch {
              post = null;
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'motivation_response',
                  callId,
                  name: fnName,
                  post,
                }),
              );
            }
          })();
        } else if (msg.type === 'error') {
          cleanupResources();
          const lbl = msg.label || 'Connection failed';
          const dtl = msg.detail || 'Unable to keep Gemini Live session open.';
          appendErrorLog('voice', lbl, dtl);
          setErrorLabel(lbl);
          setErrorDetail(dtl);
          setVoiceState('error');
        } else if (msg.type === 'closed') {
          cleanupResources();
          setVoiceState('idle');
        }
      } catch {
        // ignore malformed message
      }
    };

    ws.onerror = () => {
      cleanupResources();
      appendErrorLog('voice', 'Connection failed', 'WebSocket connection to TIYA voice server failed.');
      setErrorLabel('Connection failed');
      setErrorDetail('WebSocket connection to TIYA voice server failed.');
      setVoiceState('error');
    };

    ws.onclose = () => {
      if (voiceStateRef.current === 'connecting') {
        cleanupResources();
        appendErrorLog('voice', 'Connection failed', 'Voice connection closed before ready.');
        setErrorLabel('Connection failed');
        setErrorDetail('Voice connection closed before ready.');
        setVoiceState('error');
      }
    };
  }, [
    cleanupResources,
    clearAssistantSyncTimer,
    clearProactiveTimers,
    clearStateTransitionTimer,
    finalizePendingUserBubble,
    flushRemainingAssistantChunks,
    playPcmChunk,
    pushAssistantBubble,
    pushUserBubble,
    resetTurnState,
    scheduleIdleCheckIn,
    stopPlaybackQueue,
  ]);

  const toggleVoice = useCallback(() => {
    if (
      voiceStateRef.current === 'idle' ||
      voiceStateRef.current === 'stopped' ||
      voiceStateRef.current === 'error'
    ) {
      startVoice();
    } else {
      stopVoice();
    }
  }, [startVoice, stopVoice]);

  const sendActionFeedbackToLive = useCallback((feedbackText: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text: feedbackText }));
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    voiceState,
    errorLabel,
    errorDetail,
    activeModel,
    audioLevel,
    activeCharacter,
    cameraActive,
    cameraError,
    toggleVoice,
    startVoice,
    stopVoice,
    toggleCamera,
    stopCamera,
    sendActionFeedbackToLive,
  };
}
