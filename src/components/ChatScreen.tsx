import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { ChatMessage, PhoneAction, TiyaSettings } from '../types/tiya';
import { ActionConfirmCard } from './ActionConfirmCard';

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
}) => {
  const [input, setInput] = useState('');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState('');

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: settings.reduceMotion ? 'auto' : 'smooth' });
  }, [messages.length, isSending, settings.reduceMotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const stopRecordingAndTranscribe = () => {
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

    if (!settings.apiKey.trim()) {
      setMicError('No API key. Add your key in Connections.');
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

  const assistantTitle = settings.assistantName.trim() || 'TIYA';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top Bar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-white/[0.08]">
        <div>
          <h1 className="font-display text-base font-semibold text-slate-900 dark:text-[#F4F5F7]">
            Chat with {assistantTitle}
          </h1>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChats}
            aria-label="Clear chat history"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:text-slate-400 dark:hover:bg-white/[0.06]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Scrollable Message History */}
      <div
        data-testid="chat-message-list"
        className="tiya-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center px-6">
            <p className="font-display text-sm font-semibold text-slate-700 dark:text-slate-200">
              Start a conversation
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Type or tap the mic to chat with {assistantTitle}. Shared memory works across both voice and chat.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                <span>
                  {msg.role === 'user'
                    ? settings.yourName.trim() || 'You'
                    : assistantTitle}
                </span>
                <span aria-hidden="true">·</span>
                <span>{msg.source === 'voice' ? 'Voice' : 'Text'}</span>
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-800 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              </div>
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
            <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Inline Error Banner */}
      {(chatError || micError) && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          <span>{micError || chatError}</span>
          {(chatError.includes('No API key') || micError.includes('No API key')) && (
            <button
              type="button"
              onClick={onOpenConnections}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Connections
            </button>
          )}
        </div>
      )}

      {/* Bottom Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-200 bg-white/90 px-3 py-2.5 dark:border-white/[0.08] dark:bg-[#0D1017]/90"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMicInput}
            aria-label={isRecordingMic ? 'Stop voice dictation' : 'Record voice message'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors active:scale-95 ${
              isRecordingMic
                ? 'bg-rose-600 text-white'
                : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
            }`}
          >
            {isRecordingMic ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isTranscribing
                ? 'Transcribing audio...'
                : isRecordingMic
                  ? 'Recording... tap stop'
                  : 'Message TIYA...'
            }
            aria-label="Chat message input"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#141923] dark:text-white dark:placeholder:text-slate-500"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-500 disabled:opacity-40 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
