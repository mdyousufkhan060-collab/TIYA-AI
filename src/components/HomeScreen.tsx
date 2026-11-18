import React, { useEffect, useRef } from 'react';
import { Bell, Shield } from 'lucide-react';
import { ChatMessage, PhoneAction, TiyaSettings, VoiceState } from '../types/tiya';
import { VoiceOrb } from './VoiceOrb';
import { ActionConfirmCard } from './ActionConfirmCard';

interface HomeScreenProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  errorLabel: string;
  errorDetail: string;
  audioLevel: number;
  messages: ChatMessage[];
  actionLinks: Record<string, string>;
  unreadNotifications: number;
  isAdmin: boolean;
  onToggleVoice: () => void;
  onOpenConnections: () => void;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onConfirmAction: (msgId: string, action: PhoneAction) => void;
  onCancelAction: (msgId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  settings,
  voiceState,
  errorLabel,
  errorDetail,
  audioLevel,
  messages,
  actionLinks,
  unreadNotifications,
  isAdmin,
  onToggleVoice,
  onOpenConnections,
  onOpenNotifications,
  onOpenAdmin,
  onConfirmAction,
  onCancelAction,
}) => {
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const recentTranscript = messages.slice(-16);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: settings.reduceMotion ? 'auto' : 'smooth' });
  }, [recentTranscript.length, actionLinks, settings.reduceMotion]);

  const getStatusDisplay = () => {
    switch (voiceState) {
      case 'connecting':
        return { text: 'CONNECTING', tone: 'text-amber-500 dark:text-amber-400' };
      case 'listening':
        return { text: 'LISTENING', tone: 'text-sky-600 dark:text-sky-400' };
      case 'thinking':
        return { text: 'THINKING', tone: 'text-amber-600 dark:text-amber-300' };
      case 'speaking':
        return { text: 'SPEAKING', tone: 'text-teal-600 dark:text-teal-400' };
      case 'error':
        return { text: errorLabel || 'ERROR', tone: 'text-rose-600 dark:text-rose-400' };
      case 'idle':
      default:
        return { text: 'TAP ORB TO TALK', tone: 'text-slate-500 dark:text-slate-400' };
    }
  };

  const statusInfo = getStatusDisplay();
  const assistantTitle = settings.assistantName.trim() || 'TIYA';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Compact Top Header */}
      <header className="flex h-13 shrink-0 items-center justify-between px-4">
        <div className="w-11" aria-hidden="true" />

        <h1 className="font-display text-lg font-bold tracking-[0.18em] text-slate-900 dark:text-[#F4F5F7]">
          {assistantTitle}
        </h1>

        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
          data-testid="notifications-bell-button"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]"
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 && (
            <span
              data-testid="notifications-unread-count"
              className="font-mono-code absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white"
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
      </header>

      {/* Conditional ADMIN bar (only when rpc is_admin() === true) */}
      {isAdmin && (
        <div className="mx-4 mb-1 shrink-0">
          <button
            type="button"
            onClick={onOpenAdmin}
            data-testid="home-admin-bar"
            className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-500/15 dark:text-teal-300"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              <span>ADMIN</span>
            </span>
            <span className="text-[11px] font-medium">Open Panel →</span>
          </button>
        </div>
      )}

      {/* Center Orb Stage */}
      <section className="flex shrink-0 flex-col items-center justify-center px-6 pt-3 pb-4">
        <VoiceOrb
          voiceState={voiceState}
          audioLevel={audioLevel}
          reduceMotion={settings.reduceMotion}
          onToggle={onToggleVoice}
        />

        <div className="mt-5 flex flex-col items-center text-center">
          <p
            data-testid="voice-status-text"
            className={`text-xs font-semibold tracking-[0.2em] ${statusInfo.tone}`}
          >
            {statusInfo.text}
          </p>

          {voiceState === 'error' && (
            <div className="mt-2 flex flex-col items-center gap-2">
              {errorDetail && (
                <p className="max-w-[280px] text-balance text-xs text-slate-600 dark:text-slate-300">
                  {errorDetail}
                </p>
              )}
              {(errorLabel === 'No API key' || errorLabel === 'Invalid API key') && (
                <button
                  type="button"
                  onClick={onOpenConnections}
                  className="min-h-[40px] rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500 active:scale-95"
                >
                  Open Connections
                </button>
              )}
            </div>
          )}

          {voiceState === 'idle' && !settings.apiKey.trim() && (
            <button
              type="button"
              onClick={onOpenConnections}
              className="mt-2 min-h-[36px] text-xs font-medium text-teal-600 underline underline-offset-4 hover:text-teal-500 dark:text-teal-400"
            >
              Add Gemini API key in Settings
            </button>
          )}
        </div>
      </section>

      {/* Transcript Box */}
      <section
        aria-label="Live conversation transcript"
        className="mx-4 mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white/80 dark:border-white/[0.08] dark:bg-[#11151E]/90"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 dark:border-white/[0.06]">
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            TRANSCRIPT
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {settings.language} · {settings.personality}
          </span>
        </div>

        <div
          data-testid="home-transcript-list"
          className="tiya-scroll flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3"
        >
          {recentTranscript.length === 0 ? (
            <div className="flex h-full min-h-[90px] flex-col items-center justify-center text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tap the orb above to start a voice call.
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Speaks {settings.language} by default · Switch language anytime
              </p>
            </div>
          ) : (
            recentTranscript.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="mb-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {msg.role === 'user'
                    ? settings.yourName.trim() || 'You'
                    : assistantTitle}
                </span>
                <div
                  className={`max-w-[86%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:text-slate-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                {msg.pendingAction && (
                  <div className="w-full max-w-[86%]">
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
          <div ref={transcriptEndRef} />
        </div>
      </section>
    </div>
  );
};
