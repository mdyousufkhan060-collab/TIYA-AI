import React, { useEffect, useState } from 'react';
import { ChevronRight, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react';
import { SettingsPageId, TiyaSettings } from '../../types/tiya';

interface SettingsHubProps {
  settings: TiyaSettings;
  messageCount: number;
  userEmail?: string | null;
  onOpenPage: (page: SettingsPageId) => void;
  onClearAllChats: () => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  settings,
  messageCount,
  userEmail,
  onOpenPage,
  onClearAllChats,
}) => {
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>(
    'unknown',
  );
  const [confirmClear, setConfirmClear] = useState(false);

  const checkMicPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        setMicPermission(res.state);
        res.onchange = () => setMicPermission(res.state);
      }
    } catch {
      setMicPermission('unknown');
    }
  };

  useEffect(() => {
    checkMicPermission();
  }, []);

  const requestMicCheck = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setMicPermission('granted');
    } catch {
      setMicPermission('denied');
    }
  };

  const items: Array<{
    num: string;
    id: SettingsPageId;
    title: string;
    subtitle: string;
  }> = [
    {
      num: '1',
      id: 'about',
      title: 'ABOUT & GUIDE',
      subtitle: 'Capabilities, how to use, developer credit',
    },
    {
      num: '2',
      id: 'connections',
      title: 'CONNECTIONS',
      subtitle:
        settings.connectionStatus === 'ready'
          ? 'Gemini API · READY'
          : settings.apiKey.trim()
            ? `Gemini API · ${settings.connectionStatus.toUpperCase()}`
            : 'Gemini API · No API key',
    },
    {
      num: '3',
      id: 'live_model',
      title: 'LIVE VOICE MODEL',
      subtitle: `${settings.selectedLiveModel} · Auto fallback ${settings.autoFallback ? 'On' : 'Off'}`,
    },
    {
      num: '4',
      id: 'voice_language',
      title: 'VOICE & LANGUAGE',
      subtitle: `${settings.language} · ${settings.personality} · ${settings.voiceName}`,
    },
    {
      num: '5',
      id: 'chats_memory',
      title: 'CHATS & MEMORY',
      subtitle: `${messageCount} saved messages`,
    },
    {
      num: '6',
      id: 'look_feel',
      title: 'LOOK & FEEL',
      subtitle: `${settings.theme === 'dark' ? 'Dark' : 'Light'} theme · Reduce motion ${settings.reduceMotion ? 'On' : 'Off'}`,
    },
    {
      num: '7',
      id: 'phone_control',
      title: 'PHONE CONTROL',
      subtitle: 'Android app bridge & supported actions',
    },
  ];

  const micLabel =
    micPermission === 'granted'
      ? 'Allowed'
      : micPermission === 'denied'
        ? 'Blocked'
        : micPermission === 'prompt'
          ? 'Ask on use'
          : 'Check browser';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-13 shrink-0 items-center border-b border-slate-200 px-4 dark:border-white/[0.08]">
        <h1 className="font-display text-base font-semibold text-slate-900 dark:text-[#F4F5F7]">
          Settings
        </h1>
      </header>

      <div className="tiya-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Numbered Compact Settings Bars */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenPage(item.id)}
              data-testid={`settings-item-${item.id}`}
              className="flex min-h-[58px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04] active:bg-slate-100 dark:active:bg-white/[0.07]"
            >
              <span className="font-mono-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                {item.num}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {item.subtitle}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            </button>
          ))}
        </div>

        {/* Bottom Section: PRIVACY CONTROLS */}
        <section
          aria-labelledby="privacy-controls-heading"
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2
              id="privacy-controls-heading"
              className="text-xs font-semibold tracking-wider text-slate-900 dark:text-slate-100"
            >
              PRIVACY CONTROLS
            </h2>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Microphone Permission
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Status: {micLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={requestMicCheck}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
              >
                Check Mic
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/[0.06]">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Delete All Chats
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {messageCount} stored locally
                </p>
              </div>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={messageCount === 0}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-40 dark:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete All</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllChats();
                      setConfirmClear(false);
                    }}
                    className="min-h-[40px] rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[40px] rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Your Gemini API key and chat memory stay only on this phone inside browser localStorage.
            </p>
          </div>
        </section>

        {/* Bottom Section: SESSION / MY ACCOUNT (last bar) */}
        <section aria-label="Account session" className="pb-2">
          <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            SESSION
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#11151E]">
            <button
              type="button"
              onClick={() => onOpenPage('my_account')}
              data-testid="settings-item-my_account"
              className="flex min-h-[58px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                <UserIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                  MY ACCOUNT
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {userEmail || 'Profile, password & sign out'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
