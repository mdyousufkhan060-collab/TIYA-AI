import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { livePrice, useLiveStorePrices } from '../../utils/liveStorePrices';
import { SELL_PLANS, STORE_DURATIONS, STORE_PLANS, STORE_TOTALS, TRIAL_DAYS, tk, type StorePlanId } from '../../utils/storePlans';

/**
 * Admin > 21 WEBSITE ACCESS: give the Store Builder to anyone by Gmail
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
type StoreRow = { id: string; slug: string; name: string; name_bn?: string; published: boolean; suspended: boolean; created_at: string; owner_email?: string; email?: string; email2?: string; phone?: string; phone2?: string; whatsapp?: string; address?: string; custom_domain?: string | null; plan?: string | null; ends_at?: string | null; products?: number; orders?: number; hide_rose?: boolean };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';


/** Store plan payments sent by users (bKash / Nagad / Rocket TrxID). APPROVE turns the plan on. */
const StorePayments: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [list, setList] = useState<Array<{ id: string; email: string; plan: string; months: number; amount: number; method: string; sender_number: string; trx_id: string; status: string; created_at: string }>>([]);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_payment_requests').select('*').order('created_at', { ascending: false }).limit(30);
    setList((data as typeof list) || []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const review = async (id: string, ok: boolean) => {
    const note = ok ? null : window.prompt('Reason (the user sees this):', 'TrxID did not match.') || null;
    const { data, error } = await supabase.rpc('admin_review_store_payment', { p_id: id, p_approve: ok, p_note: note });
    const r = data as { ok: boolean; message?: string } | null;
    setMsg(error ? error.message : r?.ok ? (ok ? 'Approved. Plan is on.' : 'Rejected.') : r?.message || '');
    void load();
    onDone();
  };
  const pending = list.filter((r) => r.status === 'pending');
  return (
    <div className={box + ' space-y-2'}>
      <p className="text-[11px] font-bold tracking-wider text-amber-300">PAYMENTS TO CHECK · {pending.length}</p>
      {list.length === 0 && <p className="text-[12px] text-slate-400">No store payments yet.</p>}
      {list.map((r) => (
        <div key={r.id} className="space-y-1 rounded-lg bg-black/30 p-2">
          <p className="truncate text-[12.5px] font-bold text-white">{r.email}</p>
          <p className="text-[11.5px] text-slate-300">
            {r.plan.toUpperCase()} · {r.months} months · <b className="text-amber-300">{tk(r.amount)}</b> · {r.method} from {r.sender_number}
          </p>
          <p className="select-all text-[11.5px] text-teal-200">TrxID {r.trx_id} · {new Date(r.created_at).toLocaleString('en-GB')}</p>
          {r.status === 'pending' ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void review(r.id, true)} className="h-9 rounded-lg bg-emerald-600 text-[12px] font-bold text-white">APPROVE</button>
              <button type="button" onClick={() => void review(r.id, false)} className="h-9 rounded-lg bg-white/10 text-[12px] font-bold text-rose-200">REJECT</button>
            </div>
          ) : (
            <p className={`text-[11px] font-bold ${r.status === 'approved' ? 'text-emerald-300' : 'text-rose-300'}`}>{r.status.toUpperCase()}</p>
          )}
        </div>
      ))}
      {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      <p className="text-[10.5px] text-slate-400">Check the TrxID in your bKash / Nagad / Rocket app first. Prices are in STORE PLAN PRICES below.</p>
    </div>
  );
};

/** Money-received SMS forwarded from the admin's phone. Matching TrxID + amount turns the plan on by itself. */
const PaymentSms: React.FC = () => {
  const [rows, setRows] = useState<Array<{ id: string; method: string; trx_id: string; amount: number; sender: string; received_at: string; used_for: string | null }>>([]);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const base = 'https://ukgwipazzjstjkdfaozg.supabase.co/functions/v1/payment-sms?key=';
  useEffect(() => {
    void supabase.from('payment_sms').select('*').order('received_at', { ascending: false }).limit(10).then(({ data }) => setRows((data as typeof rows) || []));
    void supabase.from('admin_secrets').select('value').eq('key', 'payment_sms_key').maybeSingle().then(({ data }) => setLink(data ? base + (data as { value: string }).value : ''));
  }, []);
  const newKey = async () => {
    if (link && !window.confirm('Make a new link? The old link in the SMS forwarder app stops working.')) return;
    const { data, error } = await supabase.rpc('admin_new_sms_key');
    if (!error && data) setLink(base + String(data));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className={box + ' space-y-1'}>
      <p className="text-[11px] font-bold tracking-wider text-teal-300">AUTO PAYMENT · SMS ({rows.length})</p>
      <div className="space-y-1 rounded-lg bg-black/30 p-2">
        <p className="text-[11px] text-slate-300">FORWARD LINK for the SMS forwarder app on your bKash phone (keep it private):</p>
        {link ? <p className="break-all text-[10.5px] text-slate-400">{link.slice(0, base.length + 6)}…</p> : <p className="text-[11px] text-amber-300">No link yet. Tap MAKE LINK.</p>}
        <div className="grid grid-cols-2 gap-2">
          {link && <button type="button" onClick={() => void copy()} className="h-8 rounded-lg bg-teal-600 text-[11px] font-bold text-white">{copied ? 'COPIED ✓' : 'COPY LINK'}</button>}
          <button type="button" onClick={() => void newKey()} className="h-8 rounded-lg bg-white/10 text-[11px] font-bold text-slate-200">{link ? 'NEW LINK' : 'MAKE LINK'}</button>
        </div>
        <p className="text-[10.5px] text-slate-500">In the forwarder app: Webhook / URL = this link, method POST, only SMS from bKash, NAGAD and 16216.</p>
      </div>
      {rows.length === 0 && <p className="text-[11.5px] text-slate-400">No payment SMS yet. Set up the SMS forwarder on the bKash phone (see the guide) and payments turn plans on by themselves.</p>}
      {rows.map((r) => (
        <p key={r.id} className="text-[11.5px] text-slate-300">
          {new Date(r.received_at).toLocaleString('en-GB')} · {r.method} {tk(r.amount)} · {r.sender || '-'} · <span className="select-all">{r.trx_id}</span> ·{' '}
          <b className={r.used_for ? 'text-emerald-300' : 'text-amber-300'}>{r.used_for ? 'MATCHED' : 'WAITING'}</b>
        </p>
      ))}
    </div>
  );
};

/** Admin edits the monthly price and limits of each store plan. */
const PlanPrices: React.FC = () => {
  const [rows, setRows] = useState<Array<{ plan: string; monthly: number; stores: number; products: number; storage_gb: number; staff: number; own_domain: boolean }>>([]);
  const [msg, setMsg] = useState('');
  // LOCKED (owner, Nov 28 2026): the price of every plan + months lives in store_plan_totals (the server charges from it)
  const [tot, setTot] = useState<Record<string, number>>({ ...STORE_TOTALS });
  useEffect(() => {
    void supabase.from('store_plan_prices').select('*').order('sort').then(({ data }) => setRows((data as typeof rows) || []));
    void supabase.from('store_plan_totals').select('plan,months,price').then(({ data }) => {
      const r = (data as Array<{ plan: string; months: number; price: number }>) || [];
      if (r.length) setTot((x) => ({ ...x, ...Object.fromEntries(r.map((y) => [`${y.plan}:${y.months}`, Number(y.price)])) }));
    });
  }, []);
  const set = (i: number, k: string, v: number | boolean) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    const { error } = await supabase.from('store_plan_prices').upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
    const now = new Date().toISOString();
    const { error: e2 } = await supabase.from('store_plan_totals').upsert(
      SELL_PLANS.flatMap((pl) => STORE_DURATIONS.map((d) => ({ plan: pl, months: d.months, price: Number(tot[`${pl}:${d.months}`]) || 0, updated_at: now }))),
    );
    setMsg(error || e2 ? (error || e2)!.message : 'Saved. New buyers see these prices now.');
  };
  const num = (i: number, k: string, v: number) => (
    <input className={input + ' py-1 text-[12px]'} type="number" value={v} onChange={(e) => set(i, k, Number(e.target.value))} />
  );
  return (
    <div className={box + ' space-y-2'}>
      <p className="text-[11px] font-bold tracking-wider text-teal-300">STORE PLAN PRICES</p>
      {SELL_PLANS.map((pl) => (
        <div key={'t' + pl} className="space-y-1 rounded-lg bg-black/30 p-2">
          <p className="text-[12px] font-bold text-white">{STORE_PLANS[pl].label} · total Tk</p>
          <div className="grid grid-cols-5 gap-1 text-[10px] text-slate-400">
            {STORE_DURATIONS.map((d) => (
              <label key={d.months}>{d.months}m
                <input className={input + ' py-1 text-[12px]'} type="number" value={tot[`${pl}:${d.months}`] ?? 0} onChange={(e) => setTot((x) => ({ ...x, [`${pl}:${d.months}`]: Number(e.target.value) }))} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10.5px] font-bold tracking-wider text-slate-400">LIMITS OF EACH PLAN</p>
      {rows.map((r, i) => (
        <div key={r.plan} className="space-y-1 rounded-lg bg-black/30 p-2">
          <p className="text-[12px] font-bold text-white">{r.plan === 'lifetime' ? 'LIFETIME WEBSITE (one-time)' : STORE_PLANS[r.plan as StorePlanId]?.label || r.plan.toUpperCase()}</p>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400">
            <label>{r.plan === 'lifetime' ? 'Tk once' : '1 month Tk'}{num(i, 'monthly', r.monthly)}</label>
            <label>Stores{num(i, 'stores', r.stores)}</label>
            <label>Products{num(i, 'products', r.products)}</label>
            <label>Photos GB{num(i, 'storage_gb', r.storage_gb)}</label>
            <label>Staff{num(i, 'staff', r.staff)}</label>
            <label className="flex items-end gap-1 pb-1"><input type="checkbox" checked={r.own_domain} onChange={(e) => set(i, 'own_domain', e.target.checked)} /> Own domain</label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => void save()} className="h-9 w-full rounded-lg bg-teal-600 text-[12px] font-bold text-white">SAVE PRICES</button>
      {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      <p className="text-[10.5px] text-slate-400">Months: 1 · 3 · 6 · 9 · 12. BUSINESS PREMIUM = PERSONAL · STUDENT + 1,500 Tk. Free trial: 10 days, once per Gmail. A bought plan starts on the day it is bought.</p>
    </div>
  );
};

type Person = { email: string; name: string; joined: string | null; seen: string | null; signedIn: boolean };
type PayRow = { id: string; email: string; plan: string; months: number; amount: number; method: string; trx_id: string; status: string; created_at: string };
const MONTHS = [0, 1, 3, 6, 9, 12, 24];
const daysLeftOf = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 864e5));
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

/**
 * One list of every Gmail (signed in, or given access by hand). Tap a Gmail: everything about it opens right
 * under it (account, plan, give / extend, "Made with ROSE" switch, stores, payments). Tap another: that one opens.
 */
export const AdminWebsiteAccessPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [pays, setPays] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState('');
  const [gPlan, setGPlan] = useState<StorePlanId>('starter');
  const [gMonths, setGMonths] = useState(3);
  const [gDays, setGDays] = useState('');
  const [gPaid, setGPaid] = useState('');
  const [gNote, setGNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s, u, f, p] = await Promise.all([
      supabase.from('website_access').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_store_list'),
      supabase.from('profiles').select('email,full_name,created_at,last_seen_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('website_user_flags').select('email,hide_rose'),
      supabase.from('store_payment_requests').select('id,email,plan,months,amount,method,trx_id,status,created_at').order('created_at', { ascending: false }).limit(500),
    ]);
    const acc = (a.data as Row[]) || [];
    setRows(acc);
    setStores((s.data as StoreRow[]) || []);
    setPays((p.data as PayRow[]) || []);
    const fl: Record<string, boolean> = {};
    ((f.data as Array<{ email: string; hide_rose: boolean }>) || []).forEach((x) => { fl[x.email.toLowerCase()] = x.hide_rose; });
    setFlags(fl);
    const list: Person[] = ((u.data as Array<{ email: string | null; full_name: string | null; created_at: string; last_seen_at: string | null }>) || [])
      .filter((x) => x.email)
      .map((x) => ({ email: x.email!.toLowerCase(), name: x.full_name || '', joined: x.created_at, seen: x.last_seen_at, signedIn: true }));
    acc.forEach((r) => { if (!list.some((x) => x.email === r.email.toLowerCase())) list.push({ email: r.email.toLowerCase(), name: '', joined: null, seen: null, signedIn: false }); });
    setPeople(list);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const accessOf = (e: string) => rows.find((r) => r.email.toLowerCase() === e);
  const storesOf = (e: string) => stores.filter((s) => (s.owner_email || '').toLowerCase() === e);
  const hideOf = (e: string) => (e in flags ? flags[e] : storesOf(e).some((s) => s.hide_rose));
  const live = useLiveStorePrices();
  const price = gPlan === 'trial' || !gMonths ? 0 : livePrice(live, gPlan, gMonths);

  const openRow = (e: string) => {
    if (open === e) return setOpen('');
    const a = accessOf(e);
    setOpen(e);
    setGPlan(a && a.plan !== 'trial' ? a.plan : 'starter');
    setGMonths(3);
    setGDays('');
    setGPaid('');
    setGNote('');
    setMsg('');
  };

  const save = async (e: string) => {
    const a = accessOf(e);
    const p = STORE_PLANS[gPlan];
    const plusDays = gPlan === 'trial' ? TRIAL_DAYS : Number(gDays) || 0;
    if (gPlan !== 'trial' && !gMonths && !plusDays) return setMsg('Choose months or days.');
    const base = a && new Date(a.ends_at) > new Date() && a.plan === gPlan ? new Date(a.ends_at) : new Date();
    const ends = new Date(base);
    if (gPlan !== 'trial') ends.setMonth(ends.getMonth() + gMonths);
    ends.setDate(ends.getDate() + plusDays);
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('website_access').upsert({
      email: e, plan: gPlan, months: gPlan === 'trial' ? 0 : gMonths, stores_limit: p.stores, products_limit: p.products, storage_gb: p.storageGb, staff_limit: p.staff,
      ends_at: ends.toISOString(), trial_used: true, amount: gPaid ? Number(gPaid) : price || null, note: gNote.trim() || a?.note || null,
      granted_by: u.user?.id ?? null, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    setMsg(error ? error.message : `Saved: ${p.label} until ${ends.toLocaleDateString('en-GB')} (${daysLeftOf(ends.toISOString())} days). They sign in with this Gmail → Workspace → STORE · WEBSITE.`);
    if (!error) void load();
  };
  const remove = async (e: string) => {
    if (!window.confirm(`Remove website access for ${e}? Their stores stay but go offline until a plan is given again.`)) return;
    await supabase.from('website_access').delete().eq('email', e);
    void load();
  };
  const setHide = async (e: string, hide: boolean) => {
    setFlags((f) => ({ ...f, [e]: hide }));
    const { error } = await supabase.rpc('admin_set_hide_rose', { p_email: e, p_hide: hide });
    setMsg(error ? error.message : hide ? '"Made with ROSE" is OFF for this Gmail (all its stores, now and later).' : '"Made with ROSE" is ON for this Gmail.');
    void load();
  };
  const toggleSuspend = async (s: StoreRow) => {
    await supabase.from('stores').update({ suspended: !s.suspended }).eq('id', s.id);
    void load();
  };

  const sw = (label: string, on: boolean, fn: () => void, hint?: string) => (
    <div className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-2">
      <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-bold text-white">{label}</span>{hint && <span className="block text-[10px] text-slate-400">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={on} onClick={fn} className={`relative h-6 w-11 shrink-0 ${on ? 'bg-teal-500' : 'bg-slate-600'}`}>
        <span className={`absolute top-1 h-4 w-4 bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  const panel = (e: string) => {
    const a = accessOf(e);
    const person = people.find((x) => x.email === e);
    const on = a && new Date(a.ends_at) > new Date();
    const mine = storesOf(e);
    const myPays = pays.filter((x) => x.email.toLowerCase() === e);
    return (
      <div className="space-y-2 border-t border-white/10 pt-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-2 text-[11px] text-slate-300">
          <span>Name: <b className="text-white">{person?.name || '—'}</b></span>
          <span>Signed in: <b className="text-white">{person?.signedIn ? fmt(person.joined) : 'not yet'}</b></span>
          <span>Last seen: <b className="text-white">{fmt(person?.seen)}</b></span>
          <span>Stores: <b className="text-white">{mine.length}</b></span>
        </div>

        <div className="space-y-1 rounded-lg bg-black/30 p-2">
          <p className="text-[10.5px] font-bold tracking-wider text-teal-300">WEBSITE PLAN</p>
          {a ? (
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
              <span>Plan: <b className="text-white">{STORE_PLANS[a.plan]?.label || a.plan}</b></span>
              <span>Status: <b className={on ? 'text-emerald-300' : 'text-rose-300'}>{on ? 'ON' : 'ENDED'}</b></span>
              <span>Months: <b className="text-white">{a.months || '—'}</b></span>
              <span>Paid: <b className="text-white">{a.amount ? tk(Number(a.amount)) : '—'}</b></span>
              <span>Ends: <b className="text-white">{fmt(a.ends_at)}</b></span>
              <span>Days left: <b className="text-white">{daysLeftOf(a.ends_at)}</b></span>
              {a.note && <span className="col-span-2">Note: {a.note}</span>}
            </div>
          ) : (
            <p className="text-[11px] text-amber-300">No website access yet. Give a plan below.</p>
          )}
        </div>

        <div className="space-y-1.5 rounded-lg border border-teal-500/30 p-2">
          <p className="text-[10.5px] font-bold tracking-wider text-teal-300">{a ? 'GIVE NEW PLAN OR EXTEND' : 'GIVE PLAN'}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <select className={input + ' px-2 py-1.5 text-[12px]'} value={gPlan} onChange={(ev) => setGPlan(ev.target.value as StorePlanId)}>
              {(Object.keys(STORE_PLANS) as StorePlanId[]).map((k) => <option key={k} value={k}>{STORE_PLANS[k].label}</option>)}
            </select>
            <select className={input + ' px-2 py-1.5 text-[12px]'} value={gMonths} disabled={gPlan === 'trial'} onChange={(ev) => setGMonths(Number(ev.target.value))}>
              {MONTHS.map((m) => <option key={m} value={m}>{m} MONTHS</option>)}
            </select>
            <input className={input + ' px-2 py-1.5 text-[12px]'} inputMode="numeric" value={gDays} disabled={gPlan === 'trial'} onChange={(ev) => setGDays(ev.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="+ days" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input className={input + ' px-2 py-1.5 text-[12px]'} inputMode="numeric" value={gPaid} onChange={(ev) => setGPaid(ev.target.value.replace(/\D/g, ''))} placeholder={`Paid Tk (${price})`} />
            <input className={input + ' px-2 py-1.5 text-[12px]'} value={gNote} onChange={(ev) => setGNote(ev.target.value)} placeholder="Note / TrxID" />
          </div>
          <p className="text-[10.5px] text-slate-400">
            {gPlan === 'trial' ? `${TRIAL_DAYS} days free.` : `${STORE_PLANS[gPlan].label}: ${STORE_PLANS[gPlan].stores} store · ${STORE_PLANS[gPlan].products >= 100000 ? 'unlimited' : STORE_PLANS[gPlan].products} products · ${STORE_PLANS[gPlan].staff} staff. Same plan still on → added to the end date.`}
          </p>
          <button type="button" disabled={busy} onClick={() => void save(e)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-[11.5px] font-bold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} SAVE · {STORE_PLANS[gPlan].label}{gPlan === 'trial' ? '' : ` +${gMonths}m ${Number(gDays) || 0}d`}
          </button>
        </div>

        {sw('"Made with ROSE" in the footer', !hideOf(e), () => void setHide(e, !hideOf(e)), 'For every store of this Gmail, now and later. Only you can change it.')}

        <p className="px-1 text-[10.5px] font-bold tracking-wider text-slate-300">STORES · {mine.length}</p>
        {mine.length === 0 && <p className="px-1 text-[11px] text-slate-400">No store yet. After a plan, they open one from Workspace → STORE · WEBSITE or /start.</p>}
        {mine.map((st) => (
          <div key={st.id} className="space-y-1 rounded-lg bg-black/30 p-2">
            <p className="text-[12px] font-bold text-white">{st.name}{st.name_bn ? ` · ${st.name_bn}` : ''} <span className={`text-[10px] ${st.suspended ? 'text-rose-300' : st.published ? 'text-emerald-300' : 'text-amber-300'}`}>{st.suspended ? 'CLOSED' : st.published ? 'LIVE' : 'DRAFT'}</span></p>
            <a href={st.custom_domain ? `https://${st.custom_domain}` : `https://${st.slug}.myrosebd.com`} target="_blank" rel="noreferrer" className="text-[10.5px] text-teal-300 underline">{st.custom_domain || `${st.slug}.myrosebd.com`}</a>
            <p className="text-[10.5px] text-slate-400">{st.products ?? 0} products · {st.orders ?? 0} orders · {[st.whatsapp || st.phone, st.address].filter(Boolean).join(' · ')}</p>
            {sw('Store is open', !st.suspended, () => void toggleSuspend(st))}
          </div>
        ))}

        <p className="px-1 text-[10.5px] font-bold tracking-wider text-slate-300">PAYMENTS · {myPays.length}</p>
        {myPays.length === 0 && <p className="px-1 text-[11px] text-slate-400">No payments sent from the website yet.</p>}
        {myPays.map((x) => (
          <p key={x.id} className="rounded-lg bg-black/30 px-2 py-1.5 text-[11px] text-slate-300">
            {fmt(x.created_at)} · {x.plan.toUpperCase()} {x.months}m · <b className="text-white">{tk(x.amount)}</b> · {x.method} <span className="select-all">{x.trx_id}</span> · <b className={x.status === 'approved' ? 'text-emerald-300' : x.status === 'pending' ? 'text-amber-300' : 'text-rose-300'}>{x.status.toUpperCase()}</b>
          </p>
        ))}

        {a && <button type="button" onClick={() => void remove(e)} className="h-8 w-full rounded-lg border border-rose-400/40 text-[10.5px] font-bold text-rose-300">REMOVE ACCESS</button>}
        {msg && <p className="text-[11.5px] text-teal-200">{msg}</p>}
      </div>
    );
  };

  const ql = q.trim().toLowerCase();
  const list = people.filter((x) => !ql || x.email.includes(ql) || x.name.toLowerCase().includes(ql));
  const shown = showAll || ql ? list : list.slice(0, 15);
  const newEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ql) && !people.some((x) => x.email === ql) ? ql : '';
  const withAccess = rows.filter((r) => new Date(r.ends_at) > new Date()).length;

  return (
    <div className="space-y-3 pb-4">
      <StorePayments onDone={() => void load()} />

      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ALL GMAIL · {people.length} · {withAccess} WITH WEBSITE</p>
        <p className="text-[10.5px] text-slate-400">Everyone who signed in, newest first. Tap a Gmail to see everything and give or extend a plan. To give a Gmail that has not signed in yet, type it in the search.</p>
        <input className={input} value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Search or type a Gmail" inputMode="email" />
        {loading && <p className="text-[12px] text-slate-400">Loading…</p>}
        {[...(newEmail ? [{ email: newEmail, name: '', joined: null, seen: null, signedIn: false } as Person] : []), ...shown].map((x) => {
          const a = accessOf(x.email);
          const on = a && new Date(a.ends_at) > new Date();
          const isOpen = open === x.email;
          return (
            <div key={x.email} className={`rounded-lg p-2 ${isOpen ? 'border border-teal-500/40 bg-black/40' : 'bg-black/30'}`}>
              <button type="button" onClick={() => openRow(x.email)} className="flex w-full items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-white">{x.email}</span>
                  <span className="block text-[10.5px] text-slate-400">
                    {x.name ? `${x.name} · ` : ''}{x.signedIn ? `joined ${fmt(x.joined)}` : 'not signed in yet'} ·{' '}
                    <b className={on ? 'text-emerald-300' : a ? 'text-rose-300' : 'text-amber-300'}>{on ? `${STORE_PLANS[a!.plan]?.label || a!.plan} · ${daysLeftOf(a!.ends_at)} days` : a ? 'ENDED' : 'NO WEBSITE'}</b>
                    {hideOf(x.email) ? ' · ROSE footer OFF' : ''}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-slate-300">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && panel(x.email)}
            </div>
          );
        })}
        {!ql && list.length > 15 && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="w-full text-[11px] font-bold text-teal-300">{showAll ? 'SHOW LESS' : `SHOW ALL ${list.length}`}</button>
        )}
        {!loading && !list.length && !newEmail && <p className="text-[12px] text-slate-400">No Gmail found.</p>}
      </div>

      <PaymentSms />
      <PlanPrices />
    </div>
  );
};
