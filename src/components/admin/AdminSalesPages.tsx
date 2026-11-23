import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */
const card = 'rounded-2xl border border-white/[0.08] bg-[#11151E] p-3.5';
const input =
  'h-10 w-full rounded-xl border border-white/10 bg-[#090B10] px-3 text-xs text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none';
const label = 'mb-1 block text-[10px] font-semibold tracking-wider text-slate-400';
const btn =
  'flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold tracking-wide text-white disabled:opacity-50 active:scale-[0.98]';

const taka = (n: number | string | null | undefined) => `৳${Number(n || 0).toLocaleString('en-US')}`;
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const Status: React.FC<{ text: string; error?: boolean }> = ({ text, error }) =>
  text ? <p className={`px-1 text-[11px] ${error ? 'text-rose-400' : 'text-teal-400'}`}>{text}</p> : null;

/* ------------------------------------------------------------------ */
/* 03 PAYMENTS — approve / reject bKash, Nagad requests                */
/* ------------------------------------------------------------------ */
interface PayReq {
  id: string;
  user_id: string;
  plan_name: string | null;
  amount_bdt: number;
  method: string;
  sender_number: string | null;
  trx_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  email?: string | null;
}

export const AdminPaymentsPage: React.FC<{ onCountChange?: (n: number) => void }> = ({ onCountChange }) => {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rows, setRows] = useState<PayReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    const list = (data || []) as PayReq[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,email').in('id', ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p.email]));
      list.forEach((r) => (r.email = map.get(r.user_id) || null));
    }
    setRows(list);
    if (tab === 'pending') onCountChange?.(list.length);
    setLoading(false);
  }, [tab, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, approve: boolean) => {
    let note: string | null = null;
    if (!approve) {
      note = window.prompt('Reason for user (optional):', 'Transaction ID মেলেনি।');
      if (note === null) return;
    }
    setBusy(id);
    setMsg('');
    const { data, error } = await supabase.rpc('admin_review_payment', { p_id: id, p_approve: approve, p_note: note });
    setBusy(null);
    if (error || !(data as any)?.ok) {
      setMsg(error?.message || (data as any)?.message || 'Failed');
      return;
    }
    setMsg(approve ? 'Approved. Premium is on for this user.' : 'Rejected. User was notified.');
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1">
        {(['pending', 'approved', 'rejected'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-10 rounded-xl border text-[10.5px] font-semibold uppercase ${
              tab === t ? 'border-teal-500 bg-teal-500/15 text-teal-300' : 'border-white/[0.08] bg-[#11151E] text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <Status text={msg} error={/fail|error|denied/i.test(msg)} />
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className={`${card} text-center text-xs text-slate-400`}>No {tab} payments.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className={`${card} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-white">{r.plan_name || 'Plan'}</p>
              <p className="font-mono-code text-sm font-bold text-teal-300">{taka(r.amount_bdt)}</p>
            </div>
            <p className="truncate text-[11px] text-slate-300">{r.email || r.user_id}</p>
            <div className="grid grid-cols-2 gap-x-2 text-[10.5px] text-slate-400">
              <span>Method: <b className="text-slate-200">{r.method}</b></span>
              <span>From: <b className="text-slate-200">{r.sender_number || '—'}</b></span>
              <span className="col-span-2">
                TrxID: <b className="font-mono-code text-amber-300">{r.trx_id}</b>
              </span>
              <span className="col-span-2">{when(r.created_at)}</span>
              {r.admin_note && <span className="col-span-2 text-slate-300">Note: {r.admin_note}</span>}
            </div>
            {r.status === 'pending' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" disabled={busy === r.id} onClick={() => review(r.id, true)} className={`${btn} bg-teal-600`}>
                  {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  APPROVE
                </button>
                <button type="button" disabled={busy === r.id} onClick={() => review(r.id, false)} className={`${btn} bg-rose-600/80`}>
                  <X className="h-3.5 w-3.5" />
                  REJECT
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 04 PLANS & PRICES — packages + payment numbers + free limit         */
/* ------------------------------------------------------------------ */
interface Plan {
  id: string;
  name: string;
  price_bdt: number;
  months: number;
  voice_credits: number;
  text_credits: number;
  is_active: boolean;
  sort: number;
}

export const AdminPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pay, setPay] = useState({ bkash_number: '', nagad_number: '', rocket_number: '', payment_note: '', free_daily_limit: 20 });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('premium_plans').select('*').order('sort'),
      supabase.from('premium_settings').select('bkash_number,nagad_number,rocket_number,payment_note,free_daily_limit').eq('id', 1).maybeSingle(),
    ]);
    setPlans((p || []) as Plan[]);
    if (s) {
      setPay({
        bkash_number: (s as any).bkash_number || '',
        nagad_number: (s as any).nagad_number || '',
        rocket_number: (s as any).rocket_number || '',
        payment_note: (s as any).payment_note || '',
        free_daily_limit: Number((s as any).free_daily_limit ?? 20),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePlan = async (pl: Plan) => {
    setSaving(pl.id);
    const { id, ...rest } = pl;
    const { error } = await supabase.from('premium_plans').update(rest).eq('id', id);
    setSaving(null);
    setMsg(error ? error.message : `${pl.name} saved.`);
  };

  const addPlan = async () => {
    const { error } = await supabase.from('premium_plans').insert({
      name: 'New plan',
      price_bdt: 0,
      months: 1,
      voice_credits: 100,
      text_credits: 300,
      sort: plans.length + 1,
    });
    if (error) setMsg(error.message);
    void load();
  };

  const deletePlan = async (pl: Plan) => {
    if (!window.confirm(`Delete ${pl.name}?`)) return;
    const { error } = await supabase.from('premium_plans').delete().eq('id', pl.id);
    if (error) setMsg(error.message);
    void load();
  };

  const savePay = async () => {
    setSaving('pay');
    const { error } = await supabase.from('premium_settings').update({ ...pay, updated_at: new Date().toISOString() }).eq('id', 1);
    setSaving(null);
    setMsg(error ? error.message : 'Payment numbers saved.');
  };

  const setPlan = (id: string, patch: Partial<Plan>) => setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-3">
      <Status text={msg} error={/error|violat|denied/i.test(msg)} />

      <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400">PAYMENT NUMBERS</p>
      <div className={`${card} space-y-2`}>
        {(
          [
            ['bkash_number', 'BKASH'],
            ['nagad_number', 'NAGAD'],
            ['rocket_number', 'ROCKET'],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <span className={label}>{l}</span>
            <input className={input} inputMode="tel" value={pay[k]} onChange={(e) => setPay({ ...pay, [k]: e.target.value })} placeholder="01XXXXXXXXX" />
          </div>
        ))}
        <div>
          <span className={label}>NOTE FOR USERS</span>
          <input className={input} value={pay.payment_note} onChange={(e) => setPay({ ...pay, payment_note: e.target.value })} placeholder="Send Money করে TrxID দিন" />
        </div>
        <div>
          <span className={label}>FREE USER DAILY LIMIT</span>
          <input className={input} type="number" min={0} value={pay.free_daily_limit} onChange={(e) => setPay({ ...pay, free_daily_limit: Number(e.target.value) })} />
        </div>
        <button type="button" onClick={savePay} disabled={saving === 'pay'} className={`${btn} w-full bg-teal-600`}>
          {saving === 'pay' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} SAVE
        </button>
      </div>

      <p className="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400">PACKAGES</p>
      {plans.map((pl) => (
        <div key={pl.id} className={`${card} space-y-2`}>
          <div className="flex items-center gap-2">
            <input className={`${input} flex-1 font-semibold uppercase`} value={pl.name} onChange={(e) => setPlan(pl.id, { name: e.target.value })} />
            <button type="button" onClick={() => deletePlan(pl)} aria-label="Delete plan" className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 text-rose-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['price_bdt', 'PRICE ৳'],
                ['months', 'MONTHS'],
                ['voice_credits', 'VOICE REPLIES'],
                ['text_credits', 'TEXT REPLIES'],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <span className={label}>{l}</span>
                <input className={input} type="number" min={0} value={pl[k]} onChange={(e) => setPlan(pl.id, { [k]: Number(e.target.value) } as Partial<Plan>)} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
              <input type="checkbox" checked={pl.is_active} onChange={(e) => setPlan(pl.id, { is_active: e.target.checked })} className="h-4 w-4 accent-teal-500" />
              SHOW TO USERS
            </label>
            <button type="button" onClick={() => savePlan(pl)} disabled={saving === pl.id} className={`${btn} bg-teal-600`}>
              {saving === pl.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} SAVE
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addPlan} className={`${btn} w-full border border-dashed border-teal-500/50 bg-transparent text-teal-300`}>
        <Plus className="h-4 w-4" /> ADD PACKAGE
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 05 GIFT CODES                                                        */
/* ------------------------------------------------------------------ */
interface Gift {
  code: string;
  months: number;
  voice_credits: number;
  text_credits: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
}

const randomCode = () => 'ROSE-' + Math.random().toString(36).slice(2, 8).toUpperCase();

export const AdminGiftCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<Gift[]>([]);
  const [form, setForm] = useState({ code: randomCode(), months: 1, voice_credits: 100, text_credits: 300, max_uses: 1, days_valid: 30, note: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('gift_codes').select('*').order('created_at', { ascending: false }).limit(100);
    setCodes((data || []) as Gift[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    const { error } = await supabase.from('gift_codes').insert({
      code,
      months: form.months,
      voice_credits: form.voice_credits,
      text_credits: form.text_credits,
      max_uses: Math.max(1, form.max_uses),
      expires_at: form.days_valid > 0 ? new Date(Date.now() + form.days_valid * 86400000).toISOString() : null,
      note: form.note || null,
    });
    setSaving(false);
    if (error) {
      setMsg(error.message.includes('duplicate') ? 'This code already exists.' : error.message);
      return;
    }
    setMsg(`Code ${code} created. Share it with the user.`);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
    setForm({ ...form, code: randomCode(), note: '' });
    void load();
  };

  const toggle = async (g: Gift) => {
    await supabase.from('gift_codes').update({ is_active: !g.is_active }).eq('code', g.code);
    void load();
  };

  return (
    <div className="space-y-3">
      <div className={`${card} space-y-2`}>
        <p className="text-[10px] font-semibold tracking-wider text-teal-300">NEW GIFT CODE</p>
        <div>
          <span className={label}>CODE</span>
          <input className={`${input} font-mono-code uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['months', 'MONTHS'],
              ['max_uses', 'HOW MANY USERS'],
              ['voice_credits', 'VOICE REPLIES'],
              ['text_credits', 'TEXT REPLIES'],
              ['days_valid', 'VALID FOR (DAYS)'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <span className={label}>{l}</span>
              <input className={input} type="number" min={0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div>
          <span className={label}>NOTE (ONLY YOU SEE)</span>
          <input className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Facebook giveaway" />
        </div>
        <Status text={msg} error={/exists|error/i.test(msg)} />
        <button type="button" onClick={create} disabled={saving} className={`${btn} w-full bg-teal-600`}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} CREATE & COPY CODE
        </button>
      </div>

      <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400">ALL CODES ({codes.length})</p>
      {codes.map((g) => (
        <div key={g.code} className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#11151E] px-3">
          <div className="min-w-0 flex-1">
            <p className={`font-mono-code truncate text-xs font-semibold ${g.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>{g.code}</p>
            <p className="truncate text-[10px] text-slate-400">
              {g.months}m · {g.voice_credits}V · {g.text_credits}T · used {g.used_count}/{g.max_uses}
              {g.note ? ` · ${g.note}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => toggle(g)} className="h-8 rounded-lg border border-white/10 px-2 text-[10px] font-semibold text-slate-300">
            {g.is_active ? 'OFF' : 'ON'}
          </button>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 06 INCOME                                                            */
/* ------------------------------------------------------------------ */
export const AdminIncomePage: React.FC = () => {
  const [sum, setSum] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('admin_income_summary');
      if (error) setErr(error.message);
      setSum(data);
      const { data: pays } = await supabase
        .from('premium_payments')
        .select('id,user_id,amount_bdt,method,months,trx_id,note,created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      const list = pays || [];
      const ids = Array.from(new Set(list.map((p: any) => p.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id,email').in('id', ids);
        const map = new Map((profs || []).map((p: any) => [p.id, p.email]));
        list.forEach((p: any) => (p.email = map.get(p.user_id)));
      }
      setRecent(list);
    })();
  }, []);

  const tiles = sum
    ? [
        ['TODAY', taka(sum.today)],
        ['THIS MONTH', taka(sum.month)],
        ['TOTAL', taka(sum.total)],
        ['ACTIVE PREMIUM', String(sum.active_premium)],
        ['PENDING PAYMENTS', String(sum.pending)],
        ['ALL PAYMENTS', String(sum.payments)],
      ]
    : [];

  return (
    <div className="space-y-3">
      <Status text={err} error />
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([l, v]) => (
          <div key={l} className={card}>
            <p className="text-[10px] font-semibold tracking-wider text-slate-400">{l}</p>
            <p className="font-mono-code mt-1 text-lg font-bold text-white">{v}</p>
          </div>
        ))}
      </div>
      <p className="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400">RECENT</p>
      {recent.length === 0 ? (
        <p className={`${card} text-center text-xs text-slate-400`}>No payments yet.</p>
      ) : (
        recent.map((p) => (
          <div key={p.id} className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#11151E] px-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-slate-100">{p.email || p.user_id}</p>
              <p className="truncate text-[10px] text-slate-400">
                {p.method || 'manual'} · {p.months}m · {when(p.created_at)}
              </p>
            </div>
            <p className="font-mono-code text-xs font-bold text-teal-300">{taka(p.amount_bdt)}</p>
          </div>
        ))
      )}
    </div>
  );
};
