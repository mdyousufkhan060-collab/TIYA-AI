/**
 * WEBSITE ADMIN › AUTO-PILOT (BUSINESS PREMIUM only).
 * LOCKED (owner MD YOUSUF KHAN, Nov 28 2026 10:16 PM). Do not change unless the owner asks.
 *  01 CONNECTIONS   website live chat (on), Facebook Page and WhatsApp Business (next step, after Meta approval)
 *  02 DISCOUNT RULES  most discount per product; above it ROSE asks the owner (app notice, then e-mail after the wait time)
 *  03 APPROVALS     YES / GIVE LIMIT / NO; the answer goes to the customer's chat at once
 *  04 INBOX & TODAY  today's chats and asks, TAKE OVER = open LIVE CHAT
 * The server checks the plan too (store_autopilot_allowed); the same screen runs in the demo admin, the owner's admin and ROSE admin.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Store = { id: string; name: string; whatsapp?: string | null; phone?: string | null };
type Prod = { id: string; name: string; price: number };
type Rule = { product_id: string; max_pct: number | null; max_tk: number | null };
type Ask = { id: string; product_name: string; price: number; asked_price: number | null; limit_price: number | null; status: string; answer_price: number | null; created_at: string; decided_via: string | null; emailed_at: string | null };
type Settings = { discount_on: boolean; wait_min: number; email_on: boolean; owner_whatsapp: string };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold text-white disabled:opacity-60';
const tk = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString('en-IN')} Tk`;
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const Bar: React.FC<{ n: string; icon: string; color: string; title: string; value?: string; onClick: () => void }> = ({ n, icon, color, title, value, onClick }) => (
  <button type="button" onClick={onClick} className="mb-1.5 flex h-[50px] w-full items-center gap-2.5 rounded-xl border border-[#1e293b] bg-[#11151e] px-2.5 text-left text-slate-200 transition-colors hover:border-teal-500/40">
    <span className="rounded-md bg-[#1e293b] px-1.5 py-[3px] font-mono text-[10px] font-bold text-teal-400">{n}</span>
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[17px]" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>{icon}</span>
    <span className="min-w-0 flex-1 truncate text-[12px] font-bold tracking-[0.06em]">{title}</span>
    {value ? <span className="max-w-[45%] truncate text-[10.5px] text-slate-400">{value}</span> : null}
    <span className="text-base text-slate-600">›</span>
  </button>
);

export const AutoPilotTab: React.FC<{ store: Store; owner: boolean; onUpgrade: () => void; onOpenChat: () => void }> = ({ store, owner, onUpgrade, onOpenChat }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [part, setPart] = useState<'' | 'connections' | 'rules' | 'approvals' | 'inbox'>('');
  const [set, setSet] = useState<Settings>({ discount_on: true, wait_min: 5, email_on: true, owner_whatsapp: '' });
  const [prods, setProds] = useState<Prod[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [asks, setAsks] = useState<Ask[]>([]);
  const [today, setToday] = useState({ chats: 0, replies: 0, asks: 0 });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const { data: ok } = await supabase.rpc('store_autopilot_allowed', { p_store: store.id });
    setAllowed(ok !== false && ok !== null);
    if (!ok) return;
    const since = new Date(Date.now() - 864e5).toISOString();
    const [s, p, r, a, c] = await Promise.all([
      supabase.from('store_autopilot').select('*').eq('store_id', store.id).maybeSingle(),
      supabase.from('store_products').select('id,name,price').eq('store_id', store.id).order('sort').limit(300),
      supabase.from('store_discount_rules').select('product_id,max_pct,max_tk').eq('store_id', store.id),
      supabase.from('store_discount_requests').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(40),
      supabase.from('rose_chat').select('sender,created_at').eq('store_id', store.id).gt('created_at', since).limit(1000),
    ]);
    if (s.data) setSet({ discount_on: s.data.discount_on !== false, wait_min: Number(s.data.wait_min) || 5, email_on: s.data.email_on !== false, owner_whatsapp: s.data.owner_whatsapp || '' });
    setProds(((p.data as Prod[]) || []).map((x) => ({ ...x, price: Number(x.price) || 0 })));
    setRules(Object.fromEntries(((r.data as Rule[]) || []).map((x) => [x.product_id, x])));
    const list = (a.data as Ask[]) || [];
    setAsks(list);
    const ch = (c.data as Array<{ sender: string }>) || [];
    setToday({ chats: ch.filter((x) => x.sender === 'customer').length, replies: ch.filter((x) => x.sender === 'rose').length, asks: list.filter((x) => x.created_at > since).length });
  }, [store.id]);
  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (v: Settings) => {
    setSet(v);
    await supabase.from('store_autopilot').delete().eq('store_id', store.id);
    const { error } = await supabase.from('store_autopilot').insert({ store_id: store.id, ...v, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : 'Saved.');
  };
  const saveRule = async (pid: string, kind: string, val: string) => {
    setBusy(pid);
    await supabase.from('store_discount_rules').delete().eq('store_id', store.id).eq('product_id', pid);
    let error: { message: string } | null = null;
    if (kind !== 'ask') {
      const n = Math.max(0, Number(val) || 0);
      const row = { store_id: store.id, product_id: pid, max_pct: kind === 'pct' ? Math.min(90, n) : kind === 'none' ? 0 : null, max_tk: kind === 'tk' ? n : null, updated_at: new Date().toISOString() };
      ({ error } = await supabase.from('store_discount_rules').insert(row));
    }
    setBusy('');
    setMsg(error ? error.message : 'Saved.');
    void load();
  };
  const answer = async (id: string, d: 'yes' | 'limit' | 'no') => {
    setBusy(id);
    const { data, error } = await supabase.rpc('store_answer_discount', { p_id: id, p_decision: d, p_via: 'app' });
    setBusy('');
    const r = data as { ok?: boolean; message?: string } | null;
    setMsg(error ? error.message : r?.ok ? 'Sent to the customer.' : r?.message || '');
    void load();
  };

  if (allowed === null) return <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-teal-300" /></div>;
  if (!allowed)
    return (
      <div className={box + ' space-y-2'}>
        <p className="text-[14px] font-extrabold text-white">🔒 AUTO-PILOT · BUSINESS PREMIUM</p>
        <p className="text-[12.5px] leading-relaxed text-slate-300">ROSE runs the shop by herself: replies to customers at once, follows your discount rules and asks you only when a customer wants more. Only BUSINESS PREMIUM has it.</p>
        <button type="button" onClick={onUpgrade} className={btn + ' w-full bg-amber-500 text-black'}>UPGRADE TO BUSINESS PREMIUM</button>
      </div>
    );

  const pending = asks.filter((a) => a.status === 'pending');
  const back = <button type="button" onClick={() => { setPart(''); setMsg(''); }} className="mb-2 text-[12px] font-bold text-teal-300">‹ AUTO-PILOT</button>;
  const note = msg ? <p className="text-[12px] text-teal-200">{msg}</p> : null;

  if (part === 'connections')
    return (
      <div className="space-y-2">
        {back}
        <div className={box}>
          <div className="flex items-center gap-2"><span className="text-xl">💬</span><div className="flex-1"><p className="text-[13px] font-bold text-white">Website live chat</p><p className="text-[11px] text-slate-400">ROSE replies at once and follows your DISCOUNT RULES</p></div><span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">ON</span></div>
        </div>
        <div className={box}>
          <div className="flex items-center gap-2"><span className="text-xl">📘</span><div className="flex-1"><p className="text-[13px] font-bold text-white">Facebook Page · comments and Messenger</p><p className="text-[11px] text-slate-400">Next step: turns on after ROSE gets Meta approval</p></div><span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300">SOON</span></div>
        </div>
        <div className={box}>
          <div className="flex items-center gap-2"><span className="text-xl">🟢</span><div className="flex-1"><p className="text-[13px] font-bold text-white">WhatsApp Business</p><p className="text-[11px] text-slate-400">Next step: needs a WhatsApp Business number</p></div><span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300">SOON</span></div>
        </div>
        {owner && (
          <div className={box + ' space-y-1.5'}>
            <p className="text-[11px] font-bold tracking-wider text-teal-300">YOUR WHATSAPP FOR ALERTS</p>
            <input className={input} inputMode="numeric" value={set.owner_whatsapp} onChange={(e) => setSet({ ...set, owner_whatsapp: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder={store.whatsapp || '01XXXXXXXXX'} />
            <button type="button" className={btn + ' w-full bg-teal-600'} onClick={() => void saveSettings(set)}>SAVE</button>
            <p className="text-[10.5px] text-slate-400">WhatsApp alerts start with the WhatsApp Business step. Until then you get the app notice and e-mail.</p>
          </div>
        )}
        {note}
      </div>
    );

  if (part === 'rules')
    return (
      <div className="space-y-2">
        {back}
        <div className={box + ' space-y-2'}>
          <label className="flex items-center gap-2 text-[13px] font-bold text-white"><input type="checkbox" checked={set.discount_on} onChange={(e) => void saveSettings({ ...set, discount_on: e.target.checked })} /> Discounts ON</label>
          <label className="block text-[11.5px] text-slate-300">If a customer wants more than the limit, wait for my answer in the app for
            <select className={input + ' mt-1'} value={set.wait_min} onChange={(e) => void saveSettings({ ...set, wait_min: Number(e.target.value) })}>
              {[2, 5, 10, 15, 30].map((m) => <option key={m} value={m} className="bg-[#0d1016]">{m} minutes, then e-mail me</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" checked={set.email_on} onChange={(e) => void saveSettings({ ...set, email_on: e.target.checked })} /> E-mail me with YES / NO buttons</label>
        </div>
        <p className="px-1 text-[11px] text-slate-400">For each product: ASK ME = ROSE always asks you · % or Tk = ROSE gives up to that by herself · NO DISCOUNT = ROSE says no.</p>
        {prods.map((p) => {
          const r = rules[p.id];
          const kind = !r ? 'ask' : r.max_tk != null ? 'tk' : Number(r.max_pct) > 0 ? 'pct' : 'none';
          const val = r ? String(r.max_tk ?? r.max_pct ?? '') : '';
          return <RuleRow key={p.id} p={p} kind={kind} val={val} busy={busy === p.id} onSave={(k, v) => void saveRule(p.id, k, v)} />;
        })}
        {!prods.length && <p className="text-[12px] text-slate-400">Add products first.</p>}
        {note}
      </div>
    );

  if (part === 'approvals')
    return (
      <div className="space-y-2">
        {back}
        {!asks.length && <p className={box + ' text-[12px] text-slate-400'}>No discount asks yet.</p>}
        {asks.map((a) => (
          <div key={a.id} className={box + ' space-y-1.5' + (a.status === 'pending' ? ' border-amber-400/50' : '')}>
            <div className="flex items-baseline justify-between gap-2"><p className="text-[13px] font-bold text-white">{a.product_name}</p><span className="text-[10.5px] text-slate-400">{when(a.created_at)}</span></div>
            <p className="text-[12px] text-slate-300">Price {tk(a.price)} · customer wants <b className="text-amber-300">{a.asked_price ? tk(a.asked_price) : 'a discount'}</b>{a.limit_price != null ? ` · your limit ${tk(a.limit_price)}` : ''}</p>
            {a.status === 'pending' ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" disabled={busy === a.id} className={btn + ' bg-emerald-600'} onClick={() => void answer(a.id, 'yes')}>YES{a.asked_price ? ` ${Math.round(a.asked_price)}` : ''}</button>
                <button type="button" disabled={busy === a.id || a.limit_price == null} className={btn + ' bg-teal-700'} onClick={() => void answer(a.id, 'limit')}>{a.limit_price != null ? `GIVE ${Math.round(a.limit_price)}` : 'NO LIMIT SET'}</button>
                <button type="button" disabled={busy === a.id} className={btn + ' bg-rose-600'} onClick={() => void answer(a.id, 'no')}>NO</button>
              </div>
            ) : (
              <p className="text-[11.5px] font-bold text-slate-400">{a.status.toUpperCase()}{a.answer_price != null && a.status !== 'rejected' ? ` · ${tk(a.answer_price)}` : ''}{a.decided_via ? ` · by ${a.decided_via}` : ''}</p>
            )}
            {a.status === 'pending' && <p className="text-[10.5px] text-slate-500">{a.emailed_at ? 'E-mail sent to you.' : `E-mail goes after ${set.wait_min} minutes.`}</p>}
          </div>
        ))}
        {note}
      </div>
    );

  if (part === 'inbox')
    return (
      <div className="space-y-2">
        {back}
        <div className="grid grid-cols-3 gap-1.5">
          {([['CUSTOMER MSGS', today.chats], ['ROSE REPLIES', today.replies], ['DISCOUNT ASKS', today.asks]] as Array<[string, number]>).map(([k, v]) => (
            <div key={k} className={box}><p className="text-[9.5px] font-bold tracking-wider text-slate-400">{k}</p><p className="text-[20px] font-bold text-white">{v}</p></div>
          ))}
        </div>
        <p className="px-1 text-[11px] text-slate-400">Last 24 hours. Facebook and WhatsApp join this list when their step turns on.</p>
        <button type="button" className={btn + ' w-full bg-teal-600'} onClick={onOpenChat}>TAKE OVER · OPEN LIVE CHAT</button>
      </div>
    );

  return (
    <div className="space-y-1">
      <p className="px-1 pb-1 text-[11px] text-slate-400">BUSINESS PREMIUM · ROSE runs the shop by herself and asks you only when needed.</p>
      {owner && <Bar n="01" icon="🔗" color="#2563eb" title="CONNECTIONS" value="CHAT ON · FB SOON" onClick={() => setPart('connections')} />}
      <Bar n={owner ? '02' : '01'} icon="🏷️" color="#ea580c" title="DISCOUNT RULES" value={set.discount_on ? `${Object.keys(rules).length} PRODUCTS` : 'OFF'} onClick={() => setPart('rules')} />
      <Bar n={owner ? '03' : '02'} icon="✅" color="#16a34a" title="APPROVALS" value={pending.length ? `${pending.length} WAITING` : 'NONE'} onClick={() => setPart('approvals')} />
      <Bar n={owner ? '04' : '03'} icon="📥" color="#7c3aed" title="INBOX & TODAY" value={`${today.replies} REPLIES`} onClick={() => setPart('inbox')} />
    </div>
  );
};

const RuleRow: React.FC<{ p: Prod; kind: string; val: string; busy: boolean; onSave: (kind: string, val: string) => void }> = ({ p, kind, val, busy, onSave }) => {
  const [k, setK] = useState(kind);
  const [v, setV] = useState(val);
  useEffect(() => { setK(kind); setV(val); }, [kind, val]);
  const limit = k === 'pct' ? p.price - Math.floor((p.price * (Number(v) || 0)) / 100) : k === 'tk' ? p.price - (Number(v) || 0) : null;
  return (
    <div className={box + ' space-y-1.5'}>
      <div className="flex items-baseline justify-between gap-2"><p className="truncate text-[12.5px] font-bold text-white">{p.name}</p><span className="shrink-0 text-[11.5px] text-slate-400">{tk(p.price)}</span></div>
      <div className="grid grid-cols-[1fr_80px_70px] gap-1.5">
        <select className={input + ' px-2 py-1.5 text-[12px]'} value={k} onChange={(e) => setK(e.target.value)}>
          <option value="ask" className="bg-[#0d1016]">ASK ME</option>
          <option value="pct" className="bg-[#0d1016]">UP TO %</option>
          <option value="tk" className="bg-[#0d1016]">UP TO Tk</option>
          <option value="none" className="bg-[#0d1016]">NO DISCOUNT</option>
        </select>
        <input className={input + ' px-2 py-1.5 text-[12px]'} inputMode="numeric" disabled={k === 'ask' || k === 'none'} value={k === 'ask' || k === 'none' ? '' : v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} placeholder={k === 'pct' ? '5' : '50'} />
        <button type="button" disabled={busy} className={btn + ' h-auto bg-teal-600'} onClick={() => onSave(k, v)}>{busy ? '…' : 'SAVE'}</button>
      </div>
      {limit != null && <p className="text-[10.5px] text-slate-400">ROSE can sell down to {tk(Math.max(0, limit))} by herself.</p>}
    </div>
  );
};
