import React, { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types/tiya';
import { adminGrantPremium, loadPremiumPayments, PremiumPayment } from '../../lib/premium';

interface PremiumGrantCardProps {
  user: UserProfile;
  onUpdated: (patch: Partial<UserProfile>) => void;
}

const METHODS = ['bKash', 'Nagad', 'Rocket', 'Cash', 'Free', 'Other'];
const inputCls =
  'font-mono-code mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white';
const labelCls = 'block text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400';

export const PremiumGrantCard: React.FC<PremiumGrantCardProps> = ({ user, onUpdated }) => {
  const [months, setMonths] = useState<0 | 1 | 3 | 6 | 12>(0);
  const [voice, setVoice] = useState('');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bKash');
  const [trx, setTrx] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [payments, setPayments] = useState<PremiumPayment[]>([]);

  useEffect(() => {
    let alive = true;
    loadPremiumPayments(user.id).then((rows) => {
      if (alive) setPayments(rows);
    });
    return () => {
      alive = false;
    };
  }, [user.id]);

  const toInt = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  const handleGrant = async () => {
    setMsg('');
    const v = toInt(voice);
    const t = toInt(text);
    if (months === 0 && v === 0 && t === 0) {
      setMsg('Choose months or enter text / voice credits.');
      return;
    }
    setBusy(true);
    const res = await adminGrantPremium({
      userId: user.id,
      months,
      voice: v,
      text: t,
      amount: Number(amount) || 0,
      method,
      trx: trx.trim() || null,
      note: note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error || 'Could not grant Premium.');
      return;
    }
    onUpdated({
      plan: 'premium',
      paid_until: res.paidUntil ?? user.paid_until,
      premium_voice_left: res.voiceLeft,
      premium_text_left: res.textLeft,
    });
    setVoice('');
    setText('');
    setAmount('');
    setTrx('');
    setNote('');
    setMsg(`Done. Text ${res.textLeft ?? 0} · Voice ${res.voiceLeft ?? 0}. The user got a notification.`);
    setPayments(await loadPremiumPayments(user.id));
  };

  const until = user.paid_until ? new Date(user.paid_until).toLocaleDateString('en-GB') : '—';

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">GIVE PREMIUM & CREDITS</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { l: 'TEXT CREDITS', v: user.premium_text_left ?? 0 },
          { l: 'VOICE CREDITS', v: user.premium_voice_left ?? 0 },
          { l: 'VALID UNTIL', v: until },
        ].map((c) => (
          <div key={c.l} className="rounded-xl bg-slate-50 py-2 dark:bg-white/[0.04]">
            <p className="text-[9px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">{c.l}</p>
            <p className="font-mono-code text-xs font-semibold text-teal-600 dark:text-teal-400">{c.v}</p>
          </div>
        ))}
      </div>

      <div>
        <p className={labelCls}>ADD MONTHS</p>
        <div className="mt-1 grid grid-cols-5 gap-1.5">
          {([0, 1, 3, 6, 12] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`min-h-[36px] rounded-xl text-xs font-semibold ${
                months === m
                  ? 'bg-teal-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
              }`}
            >
              {m === 0 ? '0' : `${m}m`}
            </button>
          ))}
        </div>
      </div>

      {([
        ['+ TEXT CREDITS (TYPING)', text, setText],
        ['+ VOICE CREDITS', voice, setVoice],
      ] as Array<[string, string, (v: string) => void]>).map(([label, val, set]) => (
        <div key={label}>
          <p className={labelCls}>{label}</p>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto_auto] gap-1.5">
            <input type="number" min={0} value={val} onChange={(e) => set(e.target.value)} placeholder="0" className={`${inputCls} !mt-0`} />
            {[100, 500, 1000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set(String((Number(val) || 0) + n))}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200"
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
        Only text, only voice, or both. Credits without months on a free account also turn Premium on for 1 month.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className={labelCls}>
          AMOUNT (BDT)
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
        </label>
        <label className={labelCls}>
          METHOD
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelCls}>
        TRX ID
        <input type="text" value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="Optional" className={inputCls} />
      </label>
      <label className={labelCls}>
        NOTE
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputCls} />
      </label>

      {msg && <p className="text-xs font-medium text-teal-600 dark:text-teal-400">{msg}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={handleGrant}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>GIVE NOW</span>
      </button>

      {payments.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className={labelCls}>PAYMENT HISTORY</p>
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <span>{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
              <span>
                {p.months ? `${p.months}m · ` : ''}V{p.voice_credits} · T{p.text_credits}
              </span>
              <span className="font-semibold">
                ৳{p.amount_bdt} {p.method || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
