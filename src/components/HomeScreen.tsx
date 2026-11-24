import React, { useMemo } from 'react';
import { Bell, Camera, CameraOff, Crown } from 'lucide-react';
import { ChatMessage, PhoneAction, TiyaSettings, VoiceState } from '../types/tiya';
import { ActionConfirmCard } from './ActionConfirmCard';
import { TiyaNeonNav } from './TiyaNeonNav';
import { RoseOrb } from './RoseOrb';

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
  /** Premium customers / admin can chat without their own key */
  canUseWithoutKey?: boolean;
  onToggleVoice: () => void;
  onOpenConnections: () => void;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onOpenMotivation: () => void;
  onOpenHome: () => void;
  onOpenChatHistory: () => void;
  onOpenChat: () => void;
  onOpenTools: () => void;
  onOpenMore: () => void;
  onConfirmAction: (msgId: string, action: PhoneAction) => void;
  onCancelAction: (msgId: string) => void;
  cameraOn?: boolean;
  onToggleCamera?: () => void;
}

/**
 * ROSE HOME — Rose-style: full-screen ROSE picture, small ADMIN pill (admin only),
 * ROSE title, bell, live caption, and a bottom bar with two buttons on each side of
 * the round voice button. The round button ONLY turns voice on/off.
 */
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
  canUseWithoutKey = false,
  onToggleVoice,
  onOpenConnections,
  onOpenNotifications,
  onOpenAdmin,
  onOpenChatHistory,
  onOpenChat,
  onOpenTools,
  onOpenMore,
  onConfirmAction,
  onCancelAction,
  cameraOn = false,
  onToggleCamera,
}) => {
  const isVoiceOn =
    voiceState === 'connecting' ||
    voiceState === 'listening' ||
    voiceState === 'thinking' ||
    voiceState === 'speaking';
  const isSpeaking = voiceState === 'speaking';
  const hasKey = Boolean(settings.apiKey.trim());
  const assistantTitle = (settings.assistantName.trim() || 'ROSE').toUpperCase();

  const status = (() => {
    switch (voiceState) {
      case 'connecting':
        return { text: 'CONNECTING', tone: 'text-amber-300' };
      case 'listening':
        return { text: 'LISTENING', tone: 'text-emerald-300' };
      case 'thinking':
        return { text: 'THINKING', tone: 'text-cyan-300' };
      case 'speaking':
        return { text: 'SPEAKING', tone: 'text-emerald-300' };
      case 'error':
        return { text: errorLabel || 'ERROR', tone: 'text-rose-400' };
      default:
        return { text: 'TAP TO TALK', tone: 'text-sky-200/80' };
    }
  })();

  const captionLines = useMemo(
    () =>
      messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim())
        .slice(-2),
    [messages],
  );

  const pendingActionMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.pendingAction && (m.actionStatus === 'pending' || !m.actionStatus)) return m;
    }
    return null;
  }, [messages]);

  // 5 little voice bars that follow the sound level
  const level = Math.max(0, Math.min(1, audioLevel || 0));
  const bars = [0.55, 0.8, 1, 0.8, 0.55].map((f) =>
    isVoiceOn ? 6 + Math.round(level * 18 * f) + (isSpeaking ? 4 : 0) : 5,
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#020714] text-slate-100">
      {/* Full-screen ROSE picture */}
      <img
        src="/tiya-home.jpg?v=3"
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-top select-none transition-all duration-700 ${
          isSpeaking && !settings.reduceMotion ? 'scale-[1.015]' : 'scale-100'
        } ${isVoiceOn ? 'opacity-15 blur-[2px]' : 'opacity-100'}`}
      />
      {/* Voice mode: the living ROSE ball (spins, grows and bounces with her voice) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-[8%] bottom-[22%] z-10 transition-all duration-700 ${
          isVoiceOn ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      >
        {isVoiceOn && <RoseOrb voiceState={voiceState} audioLevel={audioLevel} reduceMotion={settings.reduceMotion} />}
      </div>
      {/* soft dark fade at top and bottom so text stays readable */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#020714]/85 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#020714] via-[#020714]/80 to-transparent" />

      {/* Top row: small ADMIN (admin only) · ROSE · bell */}
      <header className="relative z-20 grid shrink-0 grid-cols-3 items-center px-3 pt-[env(safe-area-inset-top)] [min-height:calc(3.5rem+env(safe-area-inset-top))]">
        <div className="flex justify-start">
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              data-testid="home-admin-bar"
              className="flex h-7 items-center gap-1 rounded-full border border-amber-300/50 bg-[#0A1428]/80 px-2.5 text-[10px] font-bold tracking-wider text-amber-200 backdrop-blur-sm active:scale-95"
            >
              <Crown className="h-3 w-3" />
              ADMIN
            </button>
          )}
        </div>
        <h1 className="font-display text-center text-lg font-bold tracking-[0.35em] text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">
          {assistantTitle}
        </h1>
        <div className="flex justify-end gap-2">
          {onToggleCamera && (
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              data-testid="home-camera-button"
              className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm active:scale-95 ${
                cameraOn ? 'bg-rose-500/80 text-white ring-1 ring-rose-300/60' : 'bg-[#0A1428]/70 text-cyan-100 ring-1 ring-cyan-300/40'
              }`}
            >
              {cameraOn ? <Camera className="h-[18px] w-[18px]" /> : <CameraOff className="h-[18px] w-[18px]" />}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
            data-testid="notifications-bell-button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0A1428]/70 text-cyan-100 ring-1 ring-cyan-300/40 backdrop-blur-sm active:scale-95"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadNotifications > 0 && (
              <span
                data-testid="notifications-unread-count"
                className="font-mono-code absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#020714]"
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Picture area (empty space so the face stays visible) */}
      <div className="relative z-10 min-h-0 flex-1" />

      {/* Lower deck: phone-action card / notice / caption, status, nav */}
      <div className="relative z-20 shrink-0 space-y-2 px-3 pb-3">
        {pendingActionMessage?.pendingAction && (
          <ActionConfirmCard
            action={pendingActionMessage.pendingAction}
            status={pendingActionMessage.actionStatus || 'pending'}
            note={pendingActionMessage.actionNote}
            fallbackUrl={actionLinks[pendingActionMessage.id]}
            onConfirm={() => onConfirmAction(pendingActionMessage.id, pendingActionMessage.pendingAction!)}
            onCancel={() => onCancelAction(pendingActionMessage.id)}
          />
        )}

        {voiceState === 'error' ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-[#080D1B]/90 px-3 py-1.5">
            <p className="truncate text-[11px] font-medium text-rose-300">{errorDetail || errorLabel || 'Voice error'}</p>
            {(errorLabel === 'No API key' || errorLabel === 'Invalid API key') && (
              <button
                type="button"
                onClick={onOpenConnections}
                className="shrink-0 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-200"
              >
                Connections
              </button>
            )}
          </div>
        ) : !hasKey && !canUseWithoutKey ? (
          <button
            type="button"
            onClick={onOpenConnections}
            className="mx-auto block text-[11px] font-medium text-cyan-300/90 underline underline-offset-4"
          >
            Add Gemini API key in Settings
          </button>
        ) : null}


        {/* voice bars + status */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div className="flex h-7 items-end gap-1" aria-hidden="true">
            {bars.map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-100 ${isVoiceOn ? 'bg-emerald-300' : 'bg-sky-300/50'}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <p data-testid="voice-status-text" className={`text-[10px] font-semibold tracking-[0.25em] ${status.tone}`}>
            {status.text}
          </p>
        </div>

      </div>

      {/* Bottom bar fixed to the screen bottom: CHAT · HISTORY · (voice) · TOOLS · SETTINGS */}
      <TiyaNeonNav
        isVoiceOn={isVoiceOn}
        onToggleVoice={onToggleVoice}
        onOpenChat={onOpenChat}
        onOpenChatHistory={onOpenChatHistory}
        onOpenTools={onOpenTools}
        onOpenMore={onOpenMore}
      />
    </div>
  );
};
