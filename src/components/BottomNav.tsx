import React from 'react';
import { Home, MessageSquare, Settings } from 'lucide-react';
import { MainTab, VoiceState } from '../types/tiya';

interface BottomNavProps {
  activeTab: MainTab;
  voiceState: VoiceState;
  onSelectTab: (tab: MainTab) => void;
  onToggleOrb: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  voiceState,
  onSelectTab,
  onToggleOrb,
}) => {
  const isVoiceLive =
    voiceState === 'listening' ||
    voiceState === 'thinking' ||
    voiceState === 'speaking' ||
    voiceState === 'interrupted' ||
    voiceState === 'connecting';

  return (
    <nav
      aria-label="Primary navigation"
      className="shrink-0 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0D1017]/95"
    >
      <div className="grid h-16 grid-cols-4 items-center">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl whitespace-nowrap ${
            activeTab === 'home'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={activeTab === 'home' ? 2.25 : 1.75} />
          <span className="text-[10px] font-semibold tracking-wide">HOME</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('chat')}
          aria-current={activeTab === 'chat' ? 'page' : undefined}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl whitespace-nowrap ${
            activeTab === 'chat'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-5 w-5" strokeWidth={activeTab === 'chat' ? 2.25 : 1.75} />
          <span className="text-[10px] font-semibold tracking-wide">CHAT</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'home') {
                onSelectTab('home');
              }
              onToggleOrb();
            }}
            aria-label={isVoiceLive ? 'End live voice call' : 'Start live voice call'}
            data-testid="nav-orb-button"
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${
              isVoiceLive
                ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white ring-4 ring-rose-500/20'
                : 'bg-gradient-to-br from-teal-400 to-cyan-600 text-white ring-2 ring-teal-400/25'
            }`}
          >
            <span className="flex items-center gap-0.5" aria-hidden="true">
              <span className="h-2.5 w-0.5 rounded-full bg-white" />
              <span className="h-4 w-0.5 rounded-full bg-white" />
              <span className="h-2.5 w-0.5 rounded-full bg-white" />
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl whitespace-nowrap ${
            activeTab === 'settings'
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="h-5 w-5" strokeWidth={activeTab === 'settings' ? 2.25 : 1.75} />
          <span className="text-[10px] font-semibold tracking-wide">SETTINGS</span>
        </button>
      </div>
    </nav>
  );
};
