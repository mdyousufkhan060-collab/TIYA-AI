import React from 'react';
import { History, MessageSquare, Settings, Wrench } from 'lucide-react';

interface TiyaNeonNavProps {
  isVoiceOn: boolean;
  active?: 'home' | 'chat';
  onToggleVoice: () => void;
  onOpenChat: () => void;
  onOpenChatHistory: () => void;
  onOpenTools: () => void;
  onOpenMore: () => void;
}

/** The HOME bottom bar — shared by HOME and CHAT so both look the same. */
export const TiyaNeonNav: React.FC<TiyaNeonNavProps> = ({
  isVoiceOn,
  active = 'home',
  onToggleVoice,
  onOpenChat,
  onOpenChatHistory,
  onOpenTools,
  onOpenMore,
}) => {
  const navBtn =
    'flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-cyan-100/85 transition-colors hover:text-white active:scale-95';
  const activeCls = 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]';

  return (
            <nav
      aria-label="Main navigation"
      data-testid="home-neon-bottom-bar"
      className="relative z-30 shrink-0 border-t border-cyan-400/25 bg-[#050E22]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_rgba(34,211,238,0.12)] backdrop-blur-md"
    >
      <div className="grid h-[64px] grid-cols-5 items-center px-1">
      <button type="button" onClick={onOpenChat} className={`${navBtn} ${active === 'chat' ? activeCls : ''}`}>
        <MessageSquare className="h-5 w-5" />
        <span className="text-[9.5px] font-semibold tracking-wide">CHAT</span>
      </button>
      <button type="button" onClick={onOpenChatHistory} data-testid="home-pill-chat-history" className={navBtn}>
        <History className="h-5 w-5" />
        <span className="text-[9.5px] font-semibold tracking-wide">HISTORY</span>
      </button>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onToggleVoice}
          data-testid="tiya-voice-orb"
          aria-label={isVoiceOn ? 'Turn ROSE voice off' : 'Turn ROSE voice on'}
          aria-pressed={isVoiceOn}
          className={`-mt-7 flex h-[66px] w-[66px] items-center justify-center rounded-full border-4 border-[#020714] transition-all active:scale-95 ${
            isVoiceOn
              ? 'bg-gradient-to-br from-emerald-400 to-cyan-600 shadow-[0_0_26px_rgba(52,211,153,0.8)]'
              : 'bg-gradient-to-br from-sky-500 to-blue-700 shadow-[0_0_18px_rgba(56,189,248,0.55)]'
          }`}
        >
          {isVoiceOn ? (
            <span className="text-[11px] font-bold tracking-wider text-white">STOP</span>
          ) : (
            <span className="flex items-center gap-[3px]" aria-hidden="true">
              <span className="h-3 w-1 rounded-full bg-white" />
              <span className="h-5 w-1 rounded-full bg-white" />
              <span className="h-3 w-1 rounded-full bg-white" />
            </span>
          )}
        </button>
      </div>

      <button type="button" onClick={onOpenTools} className={navBtn}>
        <Wrench className="h-5 w-5" />
        <span className="text-[9.5px] font-semibold tracking-wide">TOOLS</span>
      </button>
      <button type="button" onClick={onOpenMore} className={navBtn}>
        <Settings className="h-5 w-5" />
        <span className="text-[9.5px] font-semibold tracking-wide">SETTINGS</span>
      </button>
      </div>
    </nav>
  );
};
