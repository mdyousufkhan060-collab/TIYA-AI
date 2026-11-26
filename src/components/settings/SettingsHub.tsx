import React from 'react';
import { SettingsPageId, TiyaSettings, UserProfile } from '../../types/tiya';
import { isProfilePremium } from './PremiumPage';
import { SettingsBar } from './SettingsShell';
import { supabase } from '../../lib/supabase';
import { AdminBrandPage, RoseSupportCard } from '../admin/AdminBrandPage';

interface SettingsHubProps {
  settings: TiyaSettings;
  profile: UserProfile | null;
  chatCount: number;
  userEmail?: string | null;
  isAdmin?: boolean;
  onOpenPage: (page: SettingsPageId) => void;
  /** PC two-pane view: highlight the open page */
  activePage?: SettingsPageId | null;
  /** website owners and their staff: top button back to their 6-bar website page */
  onBackToWebsite?: () => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  settings,
  profile,
  chatCount,
  userEmail,
  isAdmin = false,
  onOpenPage,
  activePage = null,
  onBackToWebsite,
}) => {
  const hasNativeBridge =
    typeof window !== 'undefined' && typeof window.TiyaNative?.run === 'function';

  const geminiReady = settings.connectionStatus === 'ready';
  const groqReady = settings.providerConnections.groq?.status === 'ready';
  const connectionValue = geminiReady || groqReady ? 'FREE KEY' : isAdmin || isProfilePremium(profile) ? 'PREMIUM' : 'NO KEY';

  const [myTasks, setMyTasks] = React.useState<{ total: number; done: number }>({ total: 0, done: 0 });
  React.useEffect(() => {
    if (isAdmin) return;
    void supabase
      .from('team_checklist')
      .select('done')
      .then(({ data }) => {
        const list = (data as Array<{ done: boolean }>) || [];
        setMyTasks({ total: list.length, done: list.filter((x) => x.done).length });
      });
  }, [isAdmin, activePage]);

  const [roseOpen, setRoseOpen] = React.useState(false);
  const [roseOn, setRoseOn] = React.useState(true);
  React.useEffect(() => {
    void supabase.from('site_settings').select('value').eq('key', 'app_rose_card').maybeSingle().then(({ data }) => setRoseOn((data as { value?: unknown } | null)?.value !== false));
  }, []);

  const premiumValue = isAdmin ? 'ADMIN' : isProfilePremium(profile) ? 'PREMIUM' : 'FREE';

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
      value:
        settings.language === 'Bengali' && settings.bengaliDialect && settings.bengaliDialect !== 'Standard'
          ? `Bangla (${settings.bengaliDialect}) · ${settings.voiceName}`
          : `${settings.language} · ${settings.voiceName}`,
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
  // WORKSPACE (business) is always the last bar, under ROSE's own bars
  const workspaceItem = {
    num: '',
    id: 'workspace' as SettingsPageId,
    title: 'WORKSPACE',
    value: isAdmin ? 'BUSINESS' : (profile?.account_mode || 'personal').toUpperCase(),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-white/[0.08] px-4">
        <h1 className="font-display text-sm font-semibold tracking-wider text-[#F4F5F7] uppercase">
          Settings
        </h1>
      </header>

      <div className="tiya-scroll flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
        {onBackToWebsite && (
          <button
            type="button"
            onClick={onBackToWebsite}
            data-testid="settings-back-to-website"
            className="flex h-12 w-full items-center gap-2.5 rounded-xl px-3.5 text-left text-[12.5px] font-extrabold tracking-wider text-white"
            style={{ background: 'linear-gradient(90deg,#6d28d9,#7c3aed)' }}
          >
            <span className="text-base">‹</span> BACK TO MY WEBSITE ADMIN
          </button>
        )}
        {roseOn && (
          <div className="space-y-2">
            <RoseSupportCard open={roseOpen} onOpen={() => setRoseOpen((v) => !v)} />
            {roseOpen && <AdminBrandPage />}
          </div>
        )}
        {/* One numbered list, no gaps: ROSE's bars, (TEAM) MY TASK LIST, PRIVACY CONTROLS, MY ACCOUNT, then WORKSPACE last */}
        <div className="space-y-1.5 pb-2">
          {[
            ...mainItems,
            ...(myTasks.total > 0 ? [{ num: '', id: 'team_list' as SettingsPageId, title: 'MY TASK LIST', value: `${myTasks.done}/${myTasks.total}` }] : []),
            { num: '', id: 'privacy_controls' as SettingsPageId, title: 'PRIVACY CONTROLS', value: undefined as string | undefined },
            { num: '', id: 'my_account' as SettingsPageId, title: 'MY ACCOUNT', value: userEmail || undefined },
            workspaceItem,
          ].map((item, i) => (
            <SettingsBar
              key={item.id}
              badge={String(i + 1).padStart(2, '0')}
              title={item.title}
              value={item.value}
              onClick={() => onOpenPage(item.id)}
              tone={activePage === item.id ? 'accent' : 'default'}
              testId={`settings-item-${item.id}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
