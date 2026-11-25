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
  useEffect(() => {
    void supabase.from('store_plan_prices').select('*').order('sort').then(({ data }) => setRows((data as typeof rows) || []));
  }, []);
  const set = (i: number, k: string, v: number | boolean) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    const { error } = await supabase.from('store_plan_prices').upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
    setMsg(error ? error.message : 'Saved. New buyers see these prices now.');
  };
  const num = (i: number, k: string, v: number) => (
    <input className={input + ' py-1 text-[12px]'} type="number" value={v} onChange={(e) => set(i, k, Number(e.target.value))} />
  );
  return (
    <div className={box + ' space-y-2'}>
      <p className="text-[11px] font-bold tracking-wider text-teal-300">STORE PLAN PRICES</p>
      {rows.map((r, i) => (
        <div key={r.plan} className="space-y-1 rounded-lg bg-black/30 p-2">
          <p className="text-[12px] font-bold text-white">{r.plan.toUpperCase()}</p>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400">
            <label>Tk / month{num(i, 'monthly', r.monthly)}</label>
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
      <p className="text-[10.5px] text-slate-400">Months and discounts: 3m 0% · 6m 5% · 9m 10% · 12m 15% · 24m 25%. Free trial: 5 days, once per Gmail.</p>
    </div>
  );
};

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
  const [openEmail, setOpenEmail] = useState('');
  const [gPlan, setGPlan] = useState<StorePlanId>('starter');
  const [gMonths, setGMonths] = useState(3);
  const [gDays, setGDays] = useState('');
  const sw = (label: string, on: boolean, fn: () => void) => (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-[11px] text-slate-300">{label}</span>
      <button type="button" role="switch" aria-checked={on} onClick={fn} className={`relative h-6 w-11 shrink-0 ${on ? 'bg-teal-500' : 'bg-slate-600'}`}>
        <span className={`absolute top-1 h-4 w-4 bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from('website_access').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_store_list'),
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

  const extend = async (r: Row) => {
    const p = STORE_PLANS[gPlan];
    const base = new Date(r.ends_at) > new Date() && r.plan === gPlan ? new Date(r.ends_at) : new Date();
    const ends = new Date(base);
    ends.setMonth(ends.getMonth() + gMonths);
    ends.setDate(ends.getDate() + (Number(gDays) || 0));
    if (ends <= new Date()) return setMsg('Choose months or days.');
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('website_access').update({
      plan: gPlan, months: gMonths, stores_limit: p.stores, products_limit: p.products, storage_gb: p.storageGb, staff_limit: p.staff,
      ends_at: ends.toISOString(), trial_used: true, granted_by: u.user?.id ?? null, updated_at: new Date().toISOString(),
    }).eq('email', r.email);
    setMsg(error ? error.message : `${r.email}: ${p.label} until ${ends.toLocaleDateString('en-GB')}.`);
    setGDays('');
    void load();
  };

  const toggleRose = async (s: StoreRow) => {
    await supabase.from('stores').update({ hide_rose: !s.hide_rose }).eq('id', s.id);
    void load();
  };

  const active = (r: Row) => new Date(r.ends_at) > new Date();

  return (
    <div className="space-y-3 pb-4">
      <StorePayments onDone={() => void load()} />
      <PaymentSms />
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
        rows.map((r) => {
          const mine = stores.filter((x) => (x.owner_email || '').toLowerCase() === r.email.toLowerCase());
          const isOpen = openEmail === r.email;
          return (
            <div key={r.email} className={box + ' space-y-2'}>
              <button type="button" onClick={() => setOpenEmail(isOpen ? '' : r.email)} className="flex w-full items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-white">{r.email}</span>
                  <span className={`block text-[10.5px] ${active(r) ? 'text-teal-300' : 'text-rose-300'}`}>
                    {STORE_PLANS[r.plan]?.label || r.plan} · {active(r) ? 'until' : 'ended'} {new Date(r.ends_at).toLocaleDateString('en-GB')} · {mine.length} store{mine.length === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-slate-300">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-white/10 pt-2">
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                    <span>Plan: <b className="text-white">{STORE_PLANS[r.plan]?.label || r.plan}</b></span>
                    <span>Paid: <b className="text-white">{r.amount ? tk(Number(r.amount)) : '—'}</b></span>
                    <span>Ends: <b className="text-white">{new Date(r.ends_at).toLocaleDateString('en-GB')}</b></span>
                    <span>Days left: <b className="text-white">{Math.max(0, Math.ceil((new Date(r.ends_at).getTime() - Date.now()) / 864e5))}</b></span>
                    {r.note && <span className="col-span-2">Note: {r.note}</span>}
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-black/30 p-2">
                    <p className="text-[10.5px] font-bold tracking-wider text-teal-300">GIVE OR EXTEND BY HAND</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select className={input + ' py-1.5 text-[12px]'} value={gPlan} onChange={(e) => setGPlan(e.target.value as StorePlanId)}>
                        {(Object.keys(STORE_PLANS) as StorePlanId[]).map((k) => <option key={k} value={k}>{STORE_PLANS[k].label}</option>)}
                      </select>
                      <select className={input + ' py-1.5 text-[12px]'} value={gMonths} onChange={(e) => setGMonths(Number(e.target.value))}>
                        {[0, 1, 2, 3, 6, 9, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
                      </select>
                      <input className={input + ' py-1.5 text-[12px]'} inputMode="numeric" value={gDays} onChange={(e) => setGDays(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="+ days" />
                    </div>
                    <button type="button" onClick={() => void extend(r)} className="h-9 w-full rounded-lg bg-teal-600 text-[11px] font-bold text-white">
                      SAVE · {STORE_PLANS[gPlan].label} +{gMonths}m {Number(gDays) || 0}d
                    </button>
                  </div>
                  {mine.map((st) => (
                    <div key={st.id} className="space-y-1 rounded-lg bg-black/30 p-2">
                      <p className="text-[12px] font-bold text-white">{st.name}{st.name_bn ? ` · ${st.name_bn}` : ''}</p>
                      <a href={st.custom_domain ? `https://${st.custom_domain}` : `/shop/${st.slug}`} target="_blank" rel="noreferrer" className="text-[10.5px] text-teal-300 underline">{st.custom_domain || `${st.slug}.myrosebd.com`}</a>
                      <p className="text-[10.5px] text-slate-400">{st.products ?? 0} products · {st.orders ?? 0} orders · {st.whatsapp || st.phone || ''}</p>
                      {sw('"Made with ROSE" in footer', !st.hide_rose, () => void toggleRose(st))}
                      {sw('Store is open', !st.suspended, () => void toggleSuspend(st))}
                    </div>
                  ))}
                  {mine.length === 0 && <p className="text-[11px] text-slate-400">No store yet.</p>}
                  <button type="button" onClick={() => void remove(r.email)} className="h-8 w-full rounded-lg border border-rose-400/40 text-[10.5px] font-bold text-rose-300">REMOVE ACCESS</button>
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="px-1 pt-2 text-[10px] font-semibold tracking-wider text-slate-400">ALL STORES ({stores.length})</p>
      {stores.map((s) => (
        <div key={s.id} className={box + ' space-y-1'}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-white">{s.name}{s.name_bn ? ` · ${s.name_bn}` : ''}</p>
              <a href={s.custom_domain ? `https://${s.custom_domain}` : `/shop/${s.slug}`} target="_blank" rel="noreferrer" className="text-[10.5px] text-teal-300 underline">
                {s.custom_domain || `${s.slug}.myrosebd.com`}
              </a>
              <span className="ml-2 text-[10px] text-slate-400">{s.suspended ? 'SUSPENDED' : s.published ? 'LIVE' : 'DRAFT'}</span>
            </div>
            <button type="button" onClick={() => void toggleSuspend(s)} className={`h-8 rounded-lg px-2 text-[10px] font-bold ${s.suspended ? 'bg-teal-600 text-white' : 'border border-rose-400/50 text-rose-300'}`}>
              {s.suspended ? 'RESTORE' : 'SUSPEND'}
            </button>
          </div>
          <p className="text-[11px] text-slate-300">
            {(s.plan || 'no plan').toUpperCase()}
            {s.ends_at ? ` until ${new Date(s.ends_at).toLocaleDateString('en-GB')}` : ''} · {s.products ?? 0} products · {s.orders ?? 0} orders · joined {new Date(s.created_at).toLocaleDateString('en-GB')}
          </p>
          <p className="break-all text-[11px] text-slate-400">
            Login: {s.owner_email || '-'}
            {s.email && s.email !== s.owner_email ? ` · ${s.email}` : ''}
            {s.email2 ? ` · ${s.email2}` : ''}
          </p>
          <p className="text-[11px] text-slate-400">
            {s.whatsapp && <a className="text-emerald-300 underline" href={`https://wa.me/88${s.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp {s.whatsapp}</a>}
            {s.phone && s.phone !== s.whatsapp ? <> · <a className="underline" href={`tel:${s.phone}`}>{s.phone}</a></> : null}
            {s.phone2 ? <> · <a className="underline" href={`tel:${s.phone2}`}>{s.phone2}</a></> : null}
          </p>
          {s.address && <p className="text-[11px] text-slate-400">📍 {s.address}</p>}
          <div className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5">
            <span className="flex-1 text-[11px] text-slate-300">"Made with ROSE" in this store's footer</span>
            <button type="button" role="switch" aria-checked={!s.hide_rose} onClick={() => void toggleRose(s)} className={`relative h-6 w-11 shrink-0 ${!s.hide_rose ? 'bg-teal-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-1 h-4 w-4 bg-white transition-all ${!s.hide_rose ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      ))}
      <PlanPrices />
    </div>
  );
};
