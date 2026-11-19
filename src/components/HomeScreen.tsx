import React from 'react';
import {
  Bell,
  ChevronRight,
  Crown,
  History,
  Home,
  MessageSquare,
  MoreHorizontal,
  Shield,
  Star,
  Wrench,
} from 'lucide-react';
import { ChatMessage, PhoneAction, TiyaSettings, VoiceState } from '../types/tiya';
import { TiyaHologramStage } from './TiyaHologramStage';

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
  onOpenMotivation: () => void;
  onOpenHome: () => void;
  onOpenChatHistory: () => void;
  onOpenChat: () => void;
  onOpenTools: () => void;
  onOpenMore: () => void;
  onConfirmAction: (msgId: string, action: PhoneAction) => void;
  onCancelAction: (msgId: string) => void;
}

const RobotFaceIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    viewBox="0 0 36 28"
    className={`h-6 w-7 transition-colors ${active ? 'text-emerald-200' : 'text-cyan-200'}`}
    fill="none"
    aria-hidden="true"
  >
    {/* Antenna */}
    <line x1="18" y1="2" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="18" cy="2" r="1.7" fill="currentColor" />
    {/* Head frame */}
    <rect
      x="5"
      y="6.5"
      width="26"
      height="18"
      rx="6"
      stroke="currentColor"
      strokeWidth="2"
      fill="rgba(2, 18, 40, 0.7)"
    />
    {/* Side ears */}
    <rect x="2" y="12" width="2.5" height="7" rx="1.2" fill="currentColor" />
    <rect x="31.5" y="12" width="2.5" height="7" rx="1.2" fill="currentColor" />
    {/* Glowing eyes */}
    <circle cx="13" cy="14.5" r="2.2" fill={active ? '#6EE7B7' : '#38BDF8'} />
    <circle cx="23" cy="14.5" r="2.2" fill={active ? '#6EE7B7' : '#38BDF8'} />
    {/* Smile */}
    <path
      d="M14 20C15.5 21.3 20.5 21.3 22 20"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

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
  onOpenMotivation,
  onOpenHome,
  onOpenChatHistory,
  onOpenChat,
  onOpenTools,
  onOpenMore,
  onConfirmAction,
  onCancelAction,
}) => {
  const isVoiceOn =
    voiceState === 'connecting' ||
    voiceState === 'listening' ||
    voiceState === 'thinking' ||
    voiceState === 'speaking';

  const getStatusDisplay = () => {
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
      case 'idle':
      default:
        return { text: 'TAP AI TO TALK', tone: 'text-sky-300/70' };
    }
  };

  const statusInfo = getStatusDisplay();
  const assistantTitle = settings.assistantName.trim() || 'TIYA';

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#020714] text-slate-100">
      {/* 1. Top Row: Admin-only neon pill buttons + top-right notification bell */}
      {isAdmin ? (
        <header className="z-20 flex shrink-0 items-center gap-2 bg-[#020714] px-3 pt-2.5 pb-1.5">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenMotivation}
              data-testid="home-motivation-bar"
              className="flex h-9 min-w-0 items-center justify-between gap-1 rounded-full border border-cyan-400/55 bg-gradient-to-r from-[#071B3D] to-[#051128] px-3 text-[11px] font-semibold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.22)] transition-all hover:border-cyan-300 active:scale-[0.98]"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Star className="h-3.5 w-3.5 shrink-0 fill-cyan-300 text-cyan-300" />
                <span className="truncate">Motivation</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              data-testid="home-admin-bar"
              className="flex h-9 min-w-0 items-center justify-between gap-1 rounded-full border border-sky-400/55 bg-gradient-to-r from-[#071B3D] to-[#051128] px-3 text-[11px] font-semibold text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.22)] transition-all hover:border-sky-300 active:scale-[0.98]"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-sky-300" />
                  <Crown className="absolute -top-1 h-2 w-2 text-amber-300" />
                </span>
                <span className="truncate">Admin Panel</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
            data-testid="notifications-bell-button"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-[#061530]/90 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.18)] transition-colors hover:border-cyan-300 hover:bg-[#0B224A]"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span
                data-testid="notifications-unread-count"
                className="font-mono-code absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[9.5px] font-bold text-slate-950"
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        </header>
      ) : (
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
          data-testid="notifications-bell-button"
          className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/40 bg-[#041026]/80 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.22)] backdrop-blur-sm transition-colors hover:border-cyan-300 hover:bg-[#0B224A]"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span
              data-testid="notifications-unread-count"
              className="font-mono-code absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[9.5px] font-bold text-slate-950"
            >
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>
      )}

      {/* 2. Middle Hero: Full-width animated Hologram image */}
      <TiyaHologramStage
        voiceState={voiceState}
        audioLevel={audioLevel}
        reduceMotion={settings.reduceMotion}
        assistantName={assistantTitle}
        userName={settings.yourName}
        messages={messages}
        actionLinks={actionLinks}
        errorLabel={errorLabel}
        errorDetail={errorDetail}
        hasApiKey={Boolean(settings.apiKey.trim())}
        onOpenConnections={onOpenConnections}
        onConfirmAction={onConfirmAction}
        onCancelAction={onCancelAction}
      />

      {/* Lower Controls Deck — compact, zero scroll */}
      <div className="shrink-0 bg-gradient-to-b from-[#020714] via-[#030C1E] to-[#020612] px-3.5 pt-2 pb-2.5">
        {/* 3. Two Neon Pill Buttons: Home & Chat History */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenHome}
            data-testid="home-pill-home"
            className="flex h-10 items-center justify-between rounded-full border border-cyan-400/60 bg-gradient-to-r from-[#081F47] to-[#05122B] px-3.5 text-xs font-semibold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.24)] transition-all hover:border-cyan-300 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <Home className="h-3.5 w-3.5 text-cyan-300" />
              <span>Home</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-cyan-300" />
          </button>

          <button
            type="button"
            onClick={onOpenChatHistory}
            data-testid="home-pill-chat-history"
            className="flex h-10 items-center justify-between rounded-full border border-sky-400/50 bg-gradient-to-r from-[#07193A] to-[#051128] px-3.5 text-xs font-semibold text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.18)] transition-all hover:border-cyan-300 active:scale-[0.98]"
          >
            <span className="flex items-center gap-1.5 truncate">
              <History className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="truncate">Chat History</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-300" />
          </button>
        </div>

        {/* 4. Center: Big Round Glowing AI Voice ON/OFF Button */}
        <div className="flex flex-col items-center justify-center py-2.5">
          <button
            type="button"
            onClick={onToggleVoice}
            data-testid="tiya-voice-orb"
            aria-label={isVoiceOn ? 'Turn TIYA voice off' : 'Turn TIYA voice on'}
            aria-pressed={isVoiceOn}
            className="group relative flex h-[78px] w-[78px] items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
          >
            {/* Outer Green/Blue Glowing Ring */}
            <span
              aria-hidden="true"
              className={`absolute inset-0 rounded-full p-[3px] transition-all duration-300 ${
                isVoiceOn
                  ? 'bg-gradient-to-tr from-emerald-400 via-cyan-300 to-green-400 shadow-[0_0_26px_rgba(52,211,153,0.78),0_0_10px_rgba(34,211,238,0.55)]'
                  : 'bg-gradient-to-tr from-sky-500/45 via-cyan-400/35 to-emerald-500/35 shadow-[0_0_14px_rgba(56,189,248,0.25)]'
              }`}
            >
              <span className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_25%,#0D2B59,#041026_72%)] transition-transform duration-150 group-active:scale-95">
                <RobotFaceIcon active={isVoiceOn} />
                <span
                  className={`font-display mt-0.5 text-[11px] font-bold tracking-[0.2em] ${
                    isVoiceOn ? 'text-emerald-200' : 'text-cyan-200'
                  }`}
                >
                  AI
                </span>
              </span>
            </span>
          </button>

          <p
            data-testid="voice-status-text"
            className={`mt-1.5 text-[10px] font-semibold tracking-[0.22em] ${statusInfo.tone}`}
          >
            {statusInfo.text}
          </p>
        </div>

        {/* 5. Bottom Rounded Neon Bar: Chat | Tools | More */}
        <nav
          aria-label="Home navigation"
          data-testid="home-neon-bottom-bar"
          className="grid h-12 grid-cols-3 items-center divide-x divide-cyan-400/20 rounded-full border border-cyan-400/50 bg-[#051229]/95 px-1 shadow-[0_0_18px_rgba(34,211,238,0.2)]"
        >
          <button
            type="button"
            onClick={onOpenChat}
            className="flex h-full items-center justify-center gap-1.5 rounded-l-full text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/10 hover:text-white active:scale-[0.98]"
          >
            <MessageSquare className="h-3.5 w-3.5 text-cyan-300" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={onOpenTools}
            className="flex h-full items-center justify-center gap-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/10 hover:text-white active:scale-[0.98]"
          >
            <Wrench className="h-3.5 w-3.5 text-sky-300" />
            <span>Tools</span>
          </button>

          <button
            type="button"
            onClick={onOpenMore}
            className="flex h-full items-center justify-center gap-1.5 rounded-r-full text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/10 hover:text-white active:scale-[0.98]"
          >
            <MoreHorizontal className="h-4 w-4 text-cyan-300" />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
