import React from 'react';
import { Lock } from 'lucide-react';
import { UserProfile } from '../../types/tiya';
import { SettingsShell } from './SettingsShell';

interface PremiumPageProps {
  profile: UserProfile | null;
  isAdmin?: boolean;
  onBack: () => void;
}

export function isProfilePremium(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if ((profile.plan || '').toLowerCase() !== 'premium') return false;
  if (profile.paid_until) {
    const expiry = new Date(profile.paid_until).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) {
      return false;
    }
  }
  return true;
}

function formatValidUntil(paidUntil: string | null | undefined, isPremium: boolean): string {
  if (!isPremium || !paidUntil) return '—';
  const date = new Date(paidUntil);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRepliesLeft(profile: UserProfile | null): string {
  if (!profile) return '—';
  if (typeof profile.daily_limit === 'number') {
    const remaining = Math.max(0, profile.daily_limit - (profile.used_today ?? 0));
    return `${remaining} / ${profile.daily_limit}`;
  }
  return 'Unlimited';
}

export const PremiumPage: React.FC<PremiumPageProps> = ({ profile, isAdmin = false, onBack }) => {
  const isPremium = isProfilePremium(profile);
  const planLabel = isAdmin ? 'ADMIN' : isPremium ? 'PREMIUM' : 'FREE';
  const validUntil = formatValidUntil(profile?.paid_until, isPremium);
  const repliesLeft = formatRepliesLeft(profile);
  const voiceLeft = isAdmin ? 'Unlimited' : isPremium ? String(Math.max(0, profile?.premium_voice_left ?? 0)) : '—';
  const textLeft = isAdmin ? 'Unlimited' : isPremium ? String(Math.max(0, profile?.premium_text_left ?? 0)) : '—';

  const rows = [
    { id: 'plan', label: 'PLAN', value: planLabel, accent: isPremium || isAdmin },
    { id: 'valid_until', label: 'VALID UNTIL', value: validUntil, accent: false },
    { id: 'voice_left', label: 'VOICE REPLIES LEFT', value: voiceLeft, accent: false },
    { id: 'text_left', label: 'TEXT REPLIES LEFT', value: textLeft, accent: false },
    { id: 'daily', label: 'DAILY LIMIT', value: repliesLeft, accent: false },
  ];

  return (
    <SettingsShell title="06 PREMIUM" onBack={onBack}>
      <div className="space-y-3 pb-3">
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.id}
              data-testid={`premium-row-${row.id}`}
              className="flex h-11 items-center justify-between rounded-xl border border-white/[0.08] bg-[#11151E] px-3.5 text-xs"
            >
              <span className="font-semibold tracking-wide text-slate-200">{row.label}</span>
              <span
                className={`font-mono-code text-[11px] font-semibold ${
                  row.accent ? 'text-teal-400' : 'text-slate-300'
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-[#11151E] px-3 py-2.5 text-[11px] text-slate-400">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span>
            Read-only plan status. Only the admin can grant or update Premium from the Admin Panel.
          </span>
        </div>
      </div>
    </SettingsShell>
  );
};
