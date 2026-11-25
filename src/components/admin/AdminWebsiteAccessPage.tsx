import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { STORE_DURATIONS, STORE_PLANS, storePrice, tk, type StorePlanId } from '../../utils/storePlans';

/**
 * Admin > 23 WEBSITE ACCESS: give the Store Builder to anyone by Gmail
 * (Personal, Student or Business). Separate from ROSE text / voice credits.
 */
type Row = {
  email: string;
  plan: StorePlanId;
  months: number;
  stores_limit: number;
  storage_gb: number;
  staff_limit: number;
  ends_at: string;
  amount: number | null;
  note: string | null;
};
type StoreRow = { id: string; slug: string; name: string; published: boolean; suspended: boolean; owner_id: string; created_at: string };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';

export const AdminWebsiteAccessPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<StorePlanId>('starter');
  const [months, setMonths] = useState(3);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from('website_access').select('*').order('created_at', { ascending: false }),
      supabase.from('stores').select('id,slug,name,published,suspended,owner_id,created_at').order('created_at', { ascending: false }),
    ]);
    setRows((a.data as Row[]) || []);
    setStores((s.data as StoreRow[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const price = plan === 'trial' ? 0 : storePrice(plan, months);

  const give = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setMsg('Type a valid Gmail.');
    setBusy(true);
    setMsg('');
    const p = STORE_PLANS[plan];
    const existing = rows.find((r) => r.email === e);
    const base = existing && new Date(existing.ends_at) > new Date() ? new Date(existing.ends_at) : new Date();
    const ends = new Date(base);
    if (plan === 'trial') ends.setDate(ends.getDate() + 5);
    else ends.setMonth(ends.getMonth() + months);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('website_access').upsert({
      email: e,
      plan,
      months: plan === 'trial' ? 0 : months,
      stores_limit: p.stores,
      products_limit: p.products,
      storage_gb: p.storageGb,
      staff_limit: p.staff,
      ends_at: ends.toISOString(),
      trial_used: plan === 'trial' || Boolean(existing),
      amount: amount ? Number(amount) : price,
      note: note.trim() || null,
      granted_by: u.user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`${e}: ${p.label} until ${ends.toLocaleDateString('en-GB')}. They sign in with this Gmail and open Workspace > MY STORE.`);
    setEmail('');
    setAmount('');
    setNote('');
    void load();
  };

  const remove = async (e: string) => {
    if (!window.confirm(`Remove website access for ${e}? Their stores stay but they cannot edit them.`)) return;
    await supabase.from('website_access').delete().eq('email', e);
    void load();
  };
  const toggleSuspend = async (s: StoreRow) => {
    await supabase.from('stores').update({ suspended: !s.suspended }).eq('id', s.id);
    void load();
  };

  const active = (r: Row) => new Date(r.ends_at) > new Date();

  return (
    <div className="space-y-3 pb-4">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">GIVE ACCESS BY GMAIL</p>
        <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@gmail.com" inputMode="email" />
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={plan} onChange={(e) => setPlan(e.target.value as StorePlanId)}>
            {(Object.keys(STORE_PLANS) as StorePlanId[]).map((k) => (
              <option key={k} value={k}>
                {STORE_PLANS[k].label}
              </option>
            ))}
          </select>
          <select className={input} value={months} disabled={plan === 'trial'} onChange={(e) => setMonths(Number(e.target.value))}>
            {STORE_DURATIONS.map((d) => (
              <option key={d.months} value={d.months}>
                {d.months} MONTHS{d.off ? ` (-${d.off}%)` : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11.5px] text-slate-300">
          {plan === 'trial'
            ? '5 days free, 50 products, 1 store.'
            : `Price ${tk(price)} · ${STORE_PLANS[plan].stores} store · ${STORE_PLANS[plan].storageGb} GB · ${STORE_PLANS[plan].staff} staff`}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder={`Paid (Tk) ${price}`} inputMode="numeric" />
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (TrxID…)" />
        </div>
        <button type="button" onClick={() => void give()} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-bold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} GIVE ACCESS
        </button>
        {msg && <p className="text-[11.5px] text-teal-200">{msg}</p>}
      </div>

      <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400">PEOPLE WITH ACCESS ({rows.length})</p>
      {loading ? (
        <p className="px-1 text-xs text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-1 text-xs text-slate-400">Nobody yet.</p>
      ) : (
        rows.map((r) => (
          <div key={r.email} className={box + ' flex items-center gap-2'}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{r.email}</p>
              <p className={`text-[10.5px] ${active(r) ? 'text-teal-300' : 'text-rose-300'}`}>
                {STORE_PLANS[r.plan]?.label || r.plan} · {active(r) ? 'until' : 'ended'} {new Date(r.ends_at).toLocaleDateString('en-GB')}
                {r.amount ? ` · ${tk(Number(r.amount))}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => { setEmail(r.email); setPlan(r.plan === 'trial' ? 'starter' : r.plan); }} className="h-8 rounded-lg border border-white/15 px-2 text-[10px] font-bold text-slate-200">
              EXTEND
            </button>
            <button type="button" onClick={() => void remove(r.email)} className="h-8 rounded-lg bg-rose-600/80 px-2 text-[10px] font-bold text-white">
              REMOVE
            </button>
          </div>
        ))
      )}

      <p className="px-1 pt-2 text-[10px] font-semibold tracking-wider text-slate-400">ALL STORES ({stores.length})</p>
      {stores.map((s) => (
        <div key={s.id} className={box + ' flex items-center gap-2'}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">{s.name}</p>
            <a href={`/shop/${s.slug}`} target="_blank" rel="noreferrer" className="text-[10.5px] text-teal-300 underline">
              myrosebd.com/shop/{s.slug}
            </a>
            <span className="ml-2 text-[10px] text-slate-400">{s.suspended ? 'SUSPENDED' : s.published ? 'LIVE' : 'DRAFT'}</span>
          </div>
          <button type="button" onClick={() => void toggleSuspend(s)} className={`h-8 rounded-lg px-2 text-[10px] font-bold ${s.suspended ? 'bg-teal-600 text-white' : 'border border-rose-400/50 text-rose-300'}`}>
            {s.suspended ? 'RESTORE' : 'SUSPEND'}
          </button>
        </div>
      ))}
    </div>
  );
};
