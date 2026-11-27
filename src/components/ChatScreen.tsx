import React, { useEffect, useRef, useState } from 'react';
import { Flag, Home, Mic, Send, Square, Trash2 } from 'lucide-react';
import { ChatMessage, PhoneAction, TiyaSettings } from '../types/tiya';
import { ActionConfirmCard } from './ActionConfirmCard';
import { TiyaNeonNav } from './TiyaNeonNav';
import { MessageActions } from './MessageActions';
import { ReportSheet } from './ReportSheet';
import { MiniFace } from './MiniFace';
import { phoneStepTitle } from '../utils/phoneActions';
import { openQuietMic, type QuietMic } from '../lib/quietMic';
import { premiumStt } from '../lib/premium';

interface ChatScreenProps {
  settings: TiyaSettings;
  messages: ChatMessage[];
  isSending: boolean;
  chatError: string;
  actionLinks: Record<string, string>;
  onSendMessage: (text: string) => Promise<void>;
  onConfirmAction: (msgId: string, action: PhoneAction) => void;
  onCancelAction: (msgId: string) => void;
  onClearChats: () => void;
  onOpenConnections: () => void;
  isVoiceOn: boolean;
  onToggleVoice: () => void;
  onOpenHome: () => void;
  onOpenChatHistory: () => void;
  onOpenTools: () => void;
  onOpenMore: () => void;
  userAvatar?: string | null;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  settings,
  messages,
  isSending,
  chatError,
  actionLinks,
  onSendMessage,
  onConfirmAction,
  onCancelAction,
  onClearChats,
  onOpenConnections,
  isVoiceOn,
  onToggleVoice,
  onOpenHome,
  onOpenChatHistory,
  onOpenTools,
  onOpenMore,
  userAvatar = null,
}) => {
  const [input, setInput] = useState('');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // scroll only the message list (scrollIntoView also pushed the whole page up)
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: settings.reduceMotion ? 'auto' : 'smooth' });
  }, [messages.length, isSending, settings.reduceMotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const premMicRef = useRef<QuietMic | null>(null);
  useEffect(() => () => premMicRef.current?.close(), []);
  const stopRecordingAndTranscribe = () => {
    // ROSE PREMIUM dictation: send the last words, then close the mic
    if (premMicRef.current) {
      const mic = premMicRef.current;
      premMicRef.current = null;
      mic.flush();
      mic.close();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMic(false);
  };

  const toggleMicInput = async () => {
    setMicError('');
    if (isRecordingMic) {
      stopRecordingAndTranscribe();
      return;
    }

    // No own key (Gemini or Groq): Premium customers and the admin dictate through the ROSE server. The mic
    // stays open (no phone beep) and each sentence is written into the box when he pauses; tap again to stop.
    if (!settings.apiKey.trim() && !(settings.providerConnections?.groq?.apiKey || '').trim()) {
      try {
        const mic = await openQuietMic(async (wav) => {
          setIsTranscribing(true);
          const r = await premiumStt(wav, String(settings.language || 'Bengali'));
          setIsTranscribing(false);
          if (r.ok && r.text) setInput((prev) => (prev.trim() ? `${prev.trim()} ${r.text}` : r.text!));
          else if (!r.ok) setMicError(r.message || 'শুনতে সমস্যা হলো।');
        });
        premMicRef.current = mic;
        mic.setListening(true);
        setIsRecordingMic(true);
      } catch {
        setMicError('মাইক চালু করা যায়নি। মাইকের অনুমতি দিন।');
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 100) return;

        setIsTranscribing(true);
        try {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const step = 0x8000;
          for (let i = 0; i < bytes.length; i += step) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
          }
          const audioBase64 = btoa(binary);

          const res = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-gemini-api-key': settings.apiKey.trim(),
            },
            body: JSON.stringify({
              audioBase64,
              mimeType: blob.type || 'audio/webm',
              language: settings.language,
            }),
          });
          const data = (await res.json()) as { ok?: boolean; text?: string; detail?: string };
          if (data.ok && data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text!));
          } else {
            setMicError(data.detail || 'Could not transcribe audio.');
          }
        } catch {
          setMicError('Transcription request failed.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecordingMic(true);
    } catch {
      setMicError('Microphone permission denied.');
    }
  };

  const assistantTitle = settings.assistantName.trim() || 'ROSE';

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#020714] text-slate-100">
      {/* Same ROSE picture as HOME, blurred and darkened behind the chat */}
      <img
        src="/tiya-home.jpg?v=3"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-top blur-[6px] select-none"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#020714]/70" />

      {/* Top row: HOME · ROSE · clear */}
      <header className="relative z-20 grid shrink-0 grid-cols-3 items-center px-3 pt-[env(safe-area-inset-top)] [min-height:calc(3.5rem+env(safe-area-inset-top))]">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onOpenHome}
            aria-label="Home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1428]/70 text-cyan-100 ring-1 ring-cyan-300/40 backdrop-blur-sm active:scale-95"
          >
            <Home className="h-[18px] w-[18px]" />
          </button>
        </div>
        <h1 className="font-display text-center text-lg font-bold tracking-[0.35em] text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">
          {assistantTitle.toUpperCase()}
        </h1>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleVoice}
            aria-label={isVoiceOn ? 'Stop talking with ROSE' : 'Talk with ROSE'}
            aria-pressed={isVoiceOn}
            className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 backdrop-blur-sm active:scale-95 ${
              isVoiceOn
                ? 'bg-emerald-500/80 text-white ring-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.7)]'
                : 'bg-[#0A1428]/70 text-cyan-100 ring-cyan-300/40'
            }`}
          >
            {isVoiceOn ? <Square className="h-4 w-4" /> : <Mic className="h-[18px] w-[18px]" />}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChats}
              aria-label="Clear chat history"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1428]/70 text-cyan-100 ring-1 ring-cyan-300/40 backdrop-blur-sm hover:text-rose-400 active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={listRef} data-testid="chat-message-list" className="tiya-scroll relative z-10 min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-sm font-semibold text-white">Start a conversation</p>
            <p className="mt-1.5 text-xs leading-relaxed text-cyan-100/70">
              Type a message or tap the mic.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-cyan-100/60">
                <span>{msg.role === 'user' ? settings.yourName.trim() || 'You' : assistantTitle}</span>
                <span aria-hidden="true">·</span>
                <span>{msg.source === 'voice' ? 'Voice' : 'Text'}</span>
              </div>
              <div className={`flex max-w-full items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'user' ? (
                <MiniFace src={userAvatar} name={settings.yourName || 'You'} />
              ) : (
                <MiniFace src="/agents/rose.png?v=3" name="ROSE" rose />
              )}
              {!(msg.pendingAction && phoneStepTitle(msg.pendingAction) && /খোলা হচ্ছে…?$/.test(msg.text.trim())) && <div
                className={`max-w-[80vw] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed backdrop-blur-sm sm:max-w-[320px] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-sky-500/90 to-blue-700/90 text-white'
                    : 'border border-cyan-400/25 bg-[#06122A]/80 text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              </div>}
              </div>
              {msg.role === 'assistant' && msg.text.trim() && !(msg.pendingAction && phoneStepTitle(msg.pendingAction) && /খোলা হচ্ছে…?$/.test(msg.text.trim())) && (() => {
                const i = messages.findIndex((m) => m.id === msg.id);
                const prevUser = [...messages.slice(0, i)].reverse().find((m) => m.role === 'user');
                return (
                  <MessageActions
                    apiKey={settings.apiKey}
                    text={msg.text}
                    question={prevUser?.text}
                    voiceName={settings.voiceName}
                    onRegenerate={prevUser && !isSending ? () => void onSendMessage(prevUser.text) : undefined}
                  />
                );
              })()}
              {msg.pendingAction && (
                <div className="w-full max-w-[85%]">
                  <ActionConfirmCard
                    action={msg.pendingAction}
                    status={msg.actionStatus || 'pending'}
                    note={msg.actionNote}
                    fallbackUrl={actionLinks[msg.id]}
                    onConfirm={() => onConfirmAction(msg.id, msg.pendingAction!)}
                    onCancel={() => onCancelAction(msg.id)}
                  />
                </div>
              )}
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-2xl border border-cyan-400/25 bg-[#06122A]/80 px-3.5 py-2.5 text-xs text-cyan-100/80">
              Thinking...
            </div>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Lower deck: error · input · same bottom bar as HOME */}
      <div className="relative z-20 shrink-0 space-y-2 px-3 pb-3 pt-1">
        {(chatError || micError) && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-[#080D1B]/90 px-3 py-1.5 text-[11px] text-rose-300">
            <span className="min-w-0 truncate">{micError || chatError}</span>
            {(chatError.includes('No API key') || micError.includes('No API key')) && (
              <button
                type="button"
                onClick={onOpenConnections}
                className="shrink-0 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-200"
              >
                Connections
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMicInput}
            aria-label={isRecordingMic ? 'Stop voice dictation' : 'Record voice message'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 transition-colors active:scale-95 ${
              isRecordingMic
                ? 'bg-rose-600 text-white ring-rose-400'
                : 'bg-[#06122A]/90 text-cyan-100 ring-cyan-400/40'
            }`}
          >
            {isRecordingMic ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isTranscribing ? 'Transcribing...' : isRecordingMic ? 'Recording... tap stop' : `Message ${assistantTitle}...`}
            aria-label="Chat message input"
            className="h-11 min-w-0 flex-1 rounded-full border border-cyan-400/30 bg-[#06122A]/90 px-4 text-sm text-white placeholder:text-cyan-100/40 focus:border-cyan-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            aria-label="Report a problem"
            title="Report a problem"
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-cyan-100/50 hover:text-rose-300 active:scale-95"
          >
            <Flag className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-[0_0_14px_rgba(56,189,248,0.5)] disabled:opacity-40 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} page="chat" />

      {/* Same bottom bar as HOME, fixed to the screen bottom */}
      <TiyaNeonNav
        active="chat"
        isVoiceOn={isVoiceOn}
        onToggleVoice={onToggleVoice}
        onOpenChat={() => undefined}
        onOpenChatHistory={onOpenChatHistory}
        onOpenTools={onOpenTools}
        onOpenMore={onOpenMore}
      />
    </div>
  );
};
