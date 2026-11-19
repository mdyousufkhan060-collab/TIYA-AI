import { createLiveSocket } from '../lib/clientApi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, MemoryItem, PhoneAction, TiyaSettings, VoiceState } from '../types/tiya';
import {
  base64Pcm16ToFloat32,
  computeRmsEnergy,
  float32ToPcm16Base64,
} from '../utils/audioPcm';
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
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
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

  // Sync live volume changes to GainNode immediately
  useEffect(() => {
    if (gainNodeRef.current && outputCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        settings.volume,
        outputCtxRef.current.currentTime,
        0.02,
      );
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

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

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

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    gainNodeRef.current = null;

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
    const gainNode = gainNodeRef.current;
    if (!ctx || !gainNode) return;

    const float32 = base64Pcm16ToFloat32(base64Data);
    if (float32.length === 0) return;

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
    source.connect(gainNode);

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

    if (!apiKey) {
      setErrorLabel('No API key');
      setErrorDetail('Add your Gemini API key in Settings > Connections.');
      setVoiceState('error');
      return;
    }

    if (checkReplyUsageRef.current) {
      const decision = await checkReplyUsageRef.current();
      if (!decision.allowed) {
        const msg = decision.messageBn || 'আজকের লিমিট শেষ';
        setErrorLabel(msg);
        setErrorDetail('');
        setVoiceState('error');
        callbacksRef.current.onAppendVoiceMessage('assistant', msg);
        return;
      }
    }

    cleanupResources();
    setErrorLabel('');
    setErrorDetail('');
    setVoiceState('connecting');

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
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
    const outputCtx = new AudioContext({ sampleRate: 24000 });
    const gainNode = outputCtx.createGain();
    gainNode.gain.value = currentSettings.volume;
    gainNode.connect(outputCtx.destination);

    inputCtxRef.current = inputCtx;
    outputCtxRef.current = outputCtx;
    gainNodeRef.current = gainNode;

    if (inputCtx.state === 'suspended') await inputCtx.resume();
    if (outputCtx.state === 'suspended') await outputCtx.resume();

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
    }, 12000);

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

          // Begin continuous 16kHz mic streaming
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          source.connect(processor);
          processor.connect(inputCtx.destination);

          processor.onaudioprocess = (audioEvent) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const channelData = audioEvent.inputBuffer.getChannelData(0);
            const sensitivity = settingsRef.current.micListening?.sensitivity ?? 1.0;
            const rms = computeRmsEnergy(channelData) * sensitivity;
            if (voiceStateRef.current === 'listening') {
              setAudioLevel(Math.min(1, rms * 6));
            }
            const base64 = float32ToPcm16Base64(channelData);
            wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
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
