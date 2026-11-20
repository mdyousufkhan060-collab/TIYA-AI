import { createLiveSocket } from '../lib/clientApi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, MemoryItem, PhoneAction, TiyaSettings, VoiceState } from '../types/tiya';
import {
  base64Pcm16ToFloat32,
  computeRmsEnergy,
  float32ToPcm16Base64,
} from '../utils/audioPcm';
import {
  applyStartAntiClick,
  createVoiceInputChain,
  createVoiceOutputChain,
  getFallbackVoiceMediaConstraints,
  getMobileVoiceMediaConstraints,
  PrimarySpeakerVoiceGate,
  resampleTo16kHz,
  VoiceInputChain,
  VoiceOutputChain,
} from '../utils/voiceAudioPipeline';
import { classifyGeminiError } from '../utils/errorClassifier';
import { ReplyUsageDecision } from '../utils/authErrors';
import { buildTiyaSystemPrompt } from '../utils/prompts';
import { appendErrorLog } from '../utils/storage';
import { NavigationCommand, parseNavigationCommand } from '../utils/tiyaNavigation';

interface UseTiyaLiveVoiceOptions {
  settings: TiyaSettings;
  messages: ChatMessage[];
  memories?: MemoryItem[];
  userAge?: number | null;
  /** owner Gmail → emotional persona */
  isOwner?: boolean;
  checkReplyUsage?: () => Promise<ReplyUsageDecision>;
  onAppendVoiceMessage: (role: 'user' | 'assistant', text: string, action?: PhoneAction) => void;
  onUpdateLastVoiceMessage: (role: 'user' | 'assistant', text: string) => void;
  onPhoneAction: (action: PhoneAction) => void;
  onNavigate?: (cmd: NavigationCommand) => void;
  onRequestLatestMotivation?: () => Promise<{ title?: string | null; body: string } | null>;
}

export function useTiyaLiveVoice({
  settings,
  messages,
  memories = [],
  userAge,
  isOwner = false,
  checkReplyUsage,
  onAppendVoiceMessage,
  onUpdateLastVoiceMessage,
  onPhoneAction,
  onNavigate,
  onRequestLatestMotivation,
}: UseTiyaLiveVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorLabel, setErrorLabel] = useState<string>('');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [activeModel, setActiveModel] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

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
  const checkReplyUsageRef = useRef(checkReplyUsage);
  checkReplyUsageRef.current = checkReplyUsage;
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputChainRef = useRef<VoiceInputChain | null>(null);
  const outputChainRef = useRef<VoiceOutputChain | null>(null);
  const voiceGateRef = useRef<PrimarySpeakerVoiceGate>(new PrimarySpeakerVoiceGate());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserTurnRef = useRef<string>('');
  const currentAssistantTurnRef = useRef<string>('');
  const hasStartedUserBubbleRef = useRef<boolean>(false);
  const hasStartedAssistantBubbleRef = useRef<boolean>(false);
  const lastNavHandledRef = useRef<string>('');

  const callbacksRef = useRef({
    onAppendVoiceMessage,
    onUpdateLastVoiceMessage,
    onPhoneAction,
    onNavigate,
    onRequestLatestMotivation,
  });
  callbacksRef.current = {
    onAppendVoiceMessage,
    onUpdateLastVoiceMessage,
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

  const stopPlaybackQueue = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const cleanupResources = useCallback(() => {
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
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    currentUserTurnRef.current = '';
    currentAssistantTurnRef.current = '';
    hasStartedUserBubbleRef.current = false;
    hasStartedAssistantBubbleRef.current = false;
    setAudioLevel(0);
  }, [stopPlaybackQueue]);

  const stopVoice = useCallback(() => {
    cleanupResources();
    setVoiceState('idle');
    setActiveModel('');
  }, [cleanupResources]);

  const playPcmChunk = useCallback((base64Data: string) => {
    const ctx = outputCtxRef.current;
    const outputChain = outputChainRef.current;
    if (!ctx || !outputChain) return;

    if (ctx.state === 'suspended') {
      void outputChain.ensureActive();
    }

    const decoded = base64Pcm16ToFloat32(base64Data);
    if (decoded.length === 0) return;

    const float32 =
      activeSourcesRef.current.size === 0
        ? applyStartAntiClick(decoded, 24000)
        : decoded;

    const rms = computeRmsEnergy(float32);
    setAudioLevel(Math.min(1, rms * 4.5));

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = settingsRef.current.speechSpeed || 1.0;
    const pitchRatio = settingsRef.current.pitch || 1.0;
    if (typeof source.detune !== 'undefined' && pitchRatio !== 1.0) {
      source.detune.value = (pitchRatio - 1.0) * 1200;
    }
    source.connect(outputChain.inputNode);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration / source.playbackRate.value;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (
        activeSourcesRef.current.size === 0 &&
        voiceStateRef.current === 'speaking'
      ) {
        // Hands-free loop: return seamlessly to listening once TIYA finishes speaking
        setVoiceState('listening');
        setAudioLevel(0);
      }
    };
  }, []);

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
    setErrorLabel('');
    setErrorDetail('');
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
      mediaStreamRef.current = stream;
    } catch (err: unknown) {
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Runs on the device (Vercel has no voice server) — see src/lib/clientApi.ts
    void protocol;
    const ws = createLiveSocket();
    wsRef.current = ws;

    connectWatchdogRef.current = setTimeout(() => {
      if (voiceStateRef.current === 'connecting') {
        cleanupResources();
        setErrorLabel('Model not available');
        setErrorDetail('Timed out connecting to Gemini Live. Check your key or model.');
        setVoiceState('error');
      }
    }, 40000);

    ws.onopen = () => {
      const systemInstruction = buildTiyaSystemPrompt(
        settingsRef.current,
        messagesRef.current,
        'voice',
        userAgeRef.current,
        memoriesRef.current,
        isOwnerRef.current,
      );
      const primaryModel =
        settingsRef.current.customLiveModel.trim() || settingsRef.current.selectedLiveModel;
      const fallbackModels = settingsRef.current.availableLiveModels.map((m) => m.id);

      ws.send(
        JSON.stringify({
          type: 'start',
          apiKey,
          model: primaryModel,
          fallbackModels,
          autoFallback: settingsRef.current.autoFallback,
          voiceName: settingsRef.current.voiceName,
          language: settingsRef.current.language,
          systemInstruction,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          model?: string;
          data?: string;
          text?: string;
          label?: string;
          detail?: string;
          action?: PhoneAction;
          command?: NavigationCommand;
          callId?: string;
          name?: string;
        };

        if (msg.type === 'ready') {
          if (connectWatchdogRef.current) {
            clearTimeout(connectWatchdogRef.current);
            connectWatchdogRef.current = null;
          }
          setActiveModel(msg.model || settingsRef.current.selectedLiveModel);
          setVoiceState('listening');

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
            }

            for (const chunk of gateResult.chunksToSend) {
              const base64 = float32ToPcm16Base64(chunk);
              wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
            }
          };
        } else if (msg.type === 'input_transcript' && msg.text) {
          hasStartedAssistantBubbleRef.current = false;
          currentAssistantTurnRef.current = '';
          currentUserTurnRef.current += msg.text;
          if (!hasStartedUserBubbleRef.current) {
            hasStartedUserBubbleRef.current = true;
            callbacksRef.current.onAppendVoiceMessage('user', currentUserTurnRef.current);
            if (checkReplyUsageRef.current) {
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
          } else {
            callbacksRef.current.onUpdateLastVoiceMessage('user', currentUserTurnRef.current);
          }
          const navCmd = parseNavigationCommand(currentUserTurnRef.current);
          if (navCmd && lastNavHandledRef.current !== currentUserTurnRef.current.trim()) {
            lastNavHandledRef.current = currentUserTurnRef.current.trim();
            callbacksRef.current.onNavigate?.(navCmd);
          }
          if (voiceStateRef.current === 'listening') {
            setVoiceState('thinking');
          }
        } else if (msg.type === 'output_transcript' && msg.text) {
          hasStartedUserBubbleRef.current = false;
          currentUserTurnRef.current = '';
          currentAssistantTurnRef.current += msg.text;
          if (!hasStartedAssistantBubbleRef.current) {
            hasStartedAssistantBubbleRef.current = true;
            callbacksRef.current.onAppendVoiceMessage(
              'assistant',
              currentAssistantTurnRef.current,
            );
          } else {
            callbacksRef.current.onUpdateLastVoiceMessage(
              'assistant',
              currentAssistantTurnRef.current,
            );
          }
        } else if (msg.type === 'audio' && msg.data) {
          setVoiceState('speaking');
          playPcmChunk(msg.data);
        } else if (msg.type === 'interrupted') {
          stopPlaybackQueue();
          setVoiceState('listening');
        } else if (msg.type === 'turn_complete') {
          hasStartedUserBubbleRef.current = false;
          hasStartedAssistantBubbleRef.current = false;
          currentUserTurnRef.current = '';
          currentAssistantTurnRef.current = '';
          lastNavHandledRef.current = '';
          if (activeSourcesRef.current.size === 0) {
            setVoiceState('listening');
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
  }, [cleanupResources, playPcmChunk, stopPlaybackQueue]);

  const toggleVoice = useCallback(() => {
    if (
      voiceStateRef.current === 'idle' ||
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
    toggleVoice,
    startVoice,
    stopVoice,
    sendActionFeedbackToLive,
  };
}
