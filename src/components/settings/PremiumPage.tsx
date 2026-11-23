import React, { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types/tiya';
import { SettingsBar, SettingsShell } from './SettingsShell';

interface PremiumPageProps {
  profile: UserProfile | null;
  isAdmin?: boolean;
  onBack: () => void;
  /** reload the profile after a gift code turns Premium on */
  onRefreshProfile?: () => void;
  /** plan chosen on the website (GET STANDARD…) — opened ready to pay */
  initialPlanId?: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  price_bdt: number;
  months: number;
  voice_credits: number;
  text_credits: number;
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

export const PremiumPage: React.FC<PremiumPageProps> = ({ profile, isAdmin = false, onBack, onRefreshProfile, initialPlanId = null }) => {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [payInfo, setPayInfo] = useState<{ bkash?: string; nagad?: string; rocket?: string; note?: string } | null>(null);
  const [myReqs, setMyReqs] = useState<any[]>([]);
  const [buying, setBuying] = useState<PlanRow | null>(null);
  const [method, setMethod] = useState('bKash');
  const [sender, setSender] = useState('');
  const [trx, setTrx] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // Admin can open the CUSTOMER PANEL to see exactly what buyers see
  const [customerView, setCustomerView] = useState(false);
  const showCustomer = !isAdmin || customerView;

  const load = useCallback(async () => {
    const [{ data: p }, { data: info }, { data: reqs }] = await Promise.all([
      supabase.from('premium_plans').select('id,name,price_bdt,months,voice_credits,text_credits').eq('is_active', true).order('sort'),
      supabase.rpc('get_payment_info'),
      supabase.from('payment_requests').select('id,plan_name,amount_bdt,trx_id,status,admin_note,created_at').order('created_at', { ascending: false }).limit(5),
    ]);
    setPlans((p || []) as PlanRow[]);
    setPayInfo((info as any) || null);
    setMyReqs(reqs || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const numberFor = (m: string) => (m === 'bKash' ? payInfo?.bkash : m === 'Nagad' ? payInfo?.nagad : payInfo?.rocket) || '';
  const methods = (['bKash', 'Nagad', 'Rocket'] as const).filter((m) => numberFor(m));

  // open the plan picked on the website, once the plans are loaded
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (autoPicked || !initialPlanId || isAdmin || plans.length === 0) return;
    const pl = plans.find((x) => x.id === initialPlanId);
    if (pl) {
      setBuying(pl);
      setMethod(methods[0] || 'bKash');
    }
    setAutoPicked(true);
  }, [autoPicked, initialPlanId, isAdmin, plans, methods]);

  const submit = async () => {
    if (!buying) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('submit_payment_request', {
      p_plan: buying.id,
      p_method: method,
      p_sender: sender.trim(),
      p_trx: trx.trim(),
    });
    setBusy(false);
    const ok = !error && (data as any)?.ok;
    setMsg({ text: error?.message || (data as any)?.message || '', ok: Boolean(ok) });
    if (ok) {
      setBuying(null);
      setTrx('');
      setSender('');
      void load();
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('redeem_gift_code', { p_code: code.trim() });
    setBusy(false);
    const ok = !error && (data as any)?.ok;
    setMsg({ text: error?.message || (data as any)?.message || '', ok: Boolean(ok) });
    if (ok) {
      setCode('');
      onRefreshProfile?.();
    }
  };

  const inputCls =
    'h-10 w-full rounded-xl border border-white/10 bg-[#090B10] px-3 text-xs text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none';
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

        {isAdmin && (
          <SettingsBar
            badge="CP"
            title="CUSTOMER PANEL"
            value={customerView ? 'OPEN' : 'VIEW'}
            tone={customerView ? 'accent' : 'default'}
            onClick={() => {
              setCustomerView((v) => !v);
              setBuying(null);
              setMsg(null);
            }}
            testId="premium-customer-panel"
          />
        )}

        {showCustomer && (
          <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-teal-200">
            <b>AUTO:</b> Pay, then send your TrxID. Premium turns on by itself as soon as it is approved, and you get a notification.
            {isAdmin && <span className="block text-amber-300">Preview only: you are Admin, buttons are off.</span>}
          </div>
        )}

        {msg && (
          <p className={`rounded-xl border px-3 py-2 text-[11px] ${msg.ok ? 'border-teal-500/30 text-teal-300' : 'border-rose-500/30 text-rose-300'}`}>
            {msg.text}
          </p>
        )}

        {showCustomer && plans.length > 0 && (
          <>
            <p className="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400">BUY PREMIUM</p>
            <div className="space-y-1.5">
              {plans.map((pl, i) => (
                <SettingsBar
                  key={pl.id}
                  badge={String(i + 1).padStart(2, '0')}
                  title={`${pl.name} · ${pl.months}M`}
                  value={`৳${pl.price_bdt}`}
                  tone={buying?.id === pl.id ? 'accent' : 'default'}
                  onClick={() => {
                    setBuying(buying?.id === pl.id ? null : pl);
                    setMethod(methods[0] || 'bKash');
                    setMsg(null);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {buying && (
          <div className="space-y-2 rounded-2xl border border-teal-500/40 bg-[#0B1A1C] p-3.5">
            <p className="text-[11px] text-slate-300">
              {buying.voice_credits} voice + {buying.text_credits} text replies, {buying.months} month
            </p>
            {methods.length === 0 ? (
              <p className="text-[11px] text-amber-300">Payment numbers are not set yet. Please try later.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {methods.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`h-10 rounded-xl border text-[11px] font-semibold ${
                        method === m ? 'border-teal-500 bg-teal-500/15 text-teal-300' : 'border-white/[0.08] bg-[#11151E] text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-200">
                  Send Money <b className="text-teal-300">৳{buying.price_bdt}</b> to {method}{' '}
                  <b className="font-mono-code text-teal-300">{numberFor(method)}</b>
                </p>
                {payInfo?.note && <p className="text-[10.5px] text-slate-400">{payInfo.note}</p>}
                <input className={inputCls} inputMode="tel" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Your number (sent from)" />
                <input className={`${inputCls} font-mono-code uppercase`} value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="Transaction ID (TrxID)" />
                <button
                  type="button"
                  disabled={busy || !trx.trim() || isAdmin}
                  onClick={submit}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} SUBMIT PAYMENT
                </button>
              </>
            )}
          </div>
        )}

        {showCustomer && (
          <>
            <p className="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400">GIFT CODE</p>
            <div className="flex gap-2">
              <input className={`${inputCls} font-mono-code uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ROSE-XXXXXX" />
              <button
                type="button"
                disabled={busy || !code.trim() || isAdmin}
                onClick={redeem}
                className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                <Gift className="h-3.5 w-3.5" /> REDEEM
              </button>
            </div>
          </>
        )}

        {showCustomer && myReqs.length > 0 && (
          <>
            <p className="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400">MY PAYMENTS</p>
            <div className="space-y-1.5">
              {myReqs.map((r) => (
                <div key={r.id} className="flex h-11 items-center justify-between rounded-xl border border-white/[0.08] bg-[#11151E] px-3.5 text-[11px]">
                  <span className="truncate font-semibold uppercase text-slate-200">
                    {r.plan_name} · ৳{r.amount_bdt}
                  </span>
                  <span
                    className={`font-mono-code text-[10.5px] font-semibold uppercase ${
                      r.status === 'approved' ? 'text-teal-400' : r.status === 'rejected' ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </SettingsShell>
  );
};
