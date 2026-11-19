import React from 'react';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import { SettingsPageId, TiyaSettings, UserProfile } from '../../types/tiya';
import { isProfilePremium } from './PremiumPage';
import { SettingsBar } from './SettingsShell';

interface SettingsHubProps {
  settings: TiyaSettings;
  profile: UserProfile | null;
  chatCount: number;
  userEmail?: string | null;
  onOpenPage: (page: SettingsPageId) => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  settings,
  profile,
  chatCount,
  userEmail,
  onOpenPage,
}) => {
  const hasNativeBridge =
    typeof window !== 'undefined' && typeof window.TiyaNative?.run === 'function';

  const geminiReady = settings.connectionStatus === 'ready';
  const groqReady = settings.providerConnections.groq?.status === 'ready';
  const connectionValue = geminiReady || groqReady ? 'READY' : 'NO KEY';

  const premiumValue = isProfilePremium(profile) ? 'PREMIUM' : 'FREE';

  const mainItems: Array<{
    num: string;
    id: SettingsPageId;
    title: string;
    value?: string;
  }> = [
    {
      num: '01',
      id: 'about',
      title: 'ABOUT & GUIDE',
    },
    {
      num: '02',
      id: 'connections',
      title: 'CONNECTIONS',
      value: connectionValue,
    },
    {
      num: '03',
      id: 'voice_language',
      title: 'VOICE & LANGUAGE',
      value: `${settings.language} · ${settings.voiceName}`,
    },
    {
      num: '04',
      id: 'phone_control',
      title: 'PHONE CONTROL',
      value: hasNativeBridge ? 'Android' : 'App only',
    },
    {
      num: '05',
      id: 'chats_memory',
      title: 'CHATS & MEMORY',
      value: `${chatCount}`,
    },
    {
      num: '06',
      id: 'premium',
      title: 'PREMIUM',
      value: premiumValue,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-white/[0.08] px-4">
        <h1 className="font-display text-sm font-semibold tracking-wider text-[#F4F5F7] uppercase">
          Settings
        </h1>
      </header>

      <div className="tiya-scroll flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
        {/* Main Numbered Bars (01 to 06) */}
        <div className="space-y-1.5">
          {mainItems.map((item) => (
            <SettingsBar
              key={item.id}
              badge={item.num}
              title={item.title}
              value={item.value}
              onClick={() => onOpenPage(item.id)}
              testId={`settings-item-${item.id}`}
            />
          ))}
        </div>

        {/* ABOUT section */}
        <section aria-label="About and privacy" className="space-y-1.5 pt-0.5">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            ABOUT
          </p>
          <SettingsBar
            badge={<ShieldCheck className="h-3.5 w-3.5" />}
            title="PRIVACY CONTROLS"
            onClick={() => onOpenPage('privacy_controls')}
            testId="settings-item-privacy_controls"
          />
        </section>

        {/* SESSION section */}
        <section aria-label="Account session" className="space-y-1.5 pb-2 pt-0.5">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            SESSION
          </p>
          <SettingsBar
            badge={<UserIcon className="h-3.5 w-3.5" />}
            title="MY ACCOUNT"
            value={userEmail || undefined}
            onClick={() => onOpenPage('my_account')}
            testId="settings-item-my_account"
          />
        </section>
      </div>
    </div>
  );
};
