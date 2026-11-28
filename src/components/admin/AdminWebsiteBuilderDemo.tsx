import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { SettingsBar } from '../settings/SettingsShell';
import { supabase } from '../../lib/supabase';

/**
 * Admin > 20 WEBSITE BUILDER: the full live history of ROSE Store Builder.
 * Every bar opens real data from Supabase (stores, orders, sign-ups, payments, chats, alerts).
 * Giving access and plan prices live in 21 WEBSITE ACCESS. ROSE (app) history stays in its own bars.
 */
type HubStore = {
  id: string; slug: string; name: string; owner_email?: string; published: boolean; suspended: boolean; custom_domain?: string | null;
  plan?: string | null; ends_at?: string | null; products?: number; orders?: number; created_at: string; whatsapp?: string; phone?: string; address?: string;
};
type HubOrder = { id: string; store_id: string; order_no: number; customer_name: string; phone: string; district: string; total: number; payment_method: string; status: string; created_at: string; items: Array<{ name: string; q: number }> };
type Access = { email: string; plan: string; months: number; ends_at: string; amount: number | null; note: string | null; created_at: string; updated_at: string | null };
type Pay = { id: string; email: string; plan: string; months: number; amount: number; method: string; sender_number: string; trx_id: string; status: string; created_at: string };
type Sms = { id: string; method: string; trx_id: string; amount: number; sender: string; received_at: string; used_for: string | null };
type Chat = { id: string; store_id: string | null; business_id: string | null; demo: string | null; visitor: string; sender: string; body: string; created_at: string };
type Alert = { id: string; title: string; body: string; created_at: string };

const DEMOS: Array<[string, string]> = [
  ['foodbazaar', 'FoodBazaar · food'], ['fashionhub', 'FashionHub · fashion'], ['sotadari', 'Sotadari · grocery'],
  ['shopshotoi', 'ShopShotoi · mixed'], ['homenest', 'HomeNest · furniture'], ['medicare', 'MediCare · pharmacy'], ['printpack', 'PrintPack · labels & packaging'],
  ['glowbeauty', 'GlowBeauty · beauty'], ['gadgetzone', 'GadgetZone · electronics'], ['noorislamic', 'Noor Islamic · Islamic store'], ['boighor', 'BoiGhor · books'], ['cakehouse', 'CakeHouse · cake & gifts'],
];
const card = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const rowCls = 'rounded-lg bg-black/30 p-2';
const tk = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const daysLeft = (d?: string | null) => (d ? Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)) : 0);
const storeUrl = (s: HubStore) => (s.custom_domain ? `https://${s.custom_domain}` : `https://${s.slug}.myrosebd.com`);
const STATUS_COLOR: Record<string, string> = { new: 'text-amber-300', confirmed: 'text-sky-300', packed: 'text-sky-300', shipped: 'text-indigo-300', delivered: 'text-emerald-300', cancelled: 'text-rose-300', returned: 'text-rose-300' };

type Page = 'stores' | 'orders' | 'signups' | 'payments' | 'chats' | 'alerts' | 'demos';

/** What the admin sees in each bar, and one sample row shown while the list is still empty. */
const INFO: Record<Page, { what: string[]; example?: string[] }> = {
  stores: {
    what: ['Every real store: name, owner Gmail, LIVE / DRAFT / CLOSED', 'Plan and days left, products and orders count', 'Phone, address, opening date', 'OPEN STORE button (opens the live site)'],
    example: ['Tazu Mart · LIVE', 'owner@gmail.com', 'STARTER · 87 days left · 42 products · 18 orders', '01XXXXXXXXX · Mirpur, Dhaka'],
  },
  orders: {
    what: ['Every order from every store, newest first', 'Order no., store name, total', 'Customer name, phone, district, items', 'Status (NEW, SHIPPED, DELIVERED…), payment, time'],
    example: ['#1024 · Tazu Mart · ৳1,280', 'Rahim Uddin · 01712XXXXXX · Dhaka', 'Panjabi ×1, Cap ×2', 'NEW · COD · 25 Nov 2026, 21:10'],
  },
  signups: {
    what: ['Every Gmail that got the Store Builder (trial, paid, or given by you)', 'Plan, months, days left, amount paid', 'Their store name, or "no store yet"', 'Start and end date'],
    example: ['shop.owner@gmail.com', 'STARTER · 3 months · 87 days left · paid ৳2,997', 'Store: Tazu Mart', 'Started 25 Nov 2026 · ends 25/02/2027'],
  },
  payments: {
    what: ['Every plan payment sent from the website (bKash, Nagad, Rocket)', 'Gmail, plan, months, amount, sender number, TrxID', 'APPROVED / PENDING / REJECTED', 'Money SMS received on your phone, MATCHED or WAITING'],
    example: ['shop.owner@gmail.com · APPROVED', 'STARTER · 3 months · ৳2,997 · bKash from 01XXXXXXXXX', 'TrxID CKP3ABC123 · 25 Nov 2026'],
  },
  chats: {
    what: ['Every customer chat: real stores, own websites (widget), demo stores', 'Where it came from and how many messages', 'Last message and who wrote it (Customer, ROSE, Owner)'],
    example: ['Tazu Mart · 4 msg', 'ROSE: Delivery inside Dhaka is 60 Tk, 1-2 days.', '25 Nov 2026, 21:12'],
  },
  alerts: {
    what: ['New store opened (Gmail, link, phone, address)', 'Store info changed by the owner', 'Payment to check'],
    example: ['New store: Tazu Mart', 'owner@gmail.com · tazumart.myrosebd.com · 01XXXXXXXXX · Mirpur', '25 Nov 2026, 20:40'],
  },
  demos: { what: ['The 6 demo designs with STORE, ADMIN and PHONE+PC buttons'] },
};

export const AdminWebsiteBuilderDemo: React.FC = () => {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<HubStore[]>([]);
  const [orders, setOrders] = useState<HubOrder[]>([]);
  const [access, setAccess] = useState<Access[]>([]);
  const [users, setUsers] = useState(0);
  const [pays, setPays] = useState<Pay[]>([]);
  const [sms, setSms] = useState<Sms[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: me } = await supabase.auth.getUser();
    const [s, o, a, u, p, m, c, n] = await Promise.all([
      supabase.rpc('admin_store_list'),
      supabase.from('store_orders').select('id,store_id,order_no,customer_name,phone,district,total,payment_method,status,created_at,items').order('created_at', { ascending: false }).limit(300),
      supabase.from('website_access').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('store_payment_requests').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payment_sms').select('*').order('received_at', { ascending: false }).limit(100),
      supabase.from('rose_chat').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('notifications').select('id,title,body,created_at').eq('user_id', me.user?.id || '').or('title.ilike.%store%').order('created_at', { ascending: false }).limit(200),
    ]);
    setStores((s.data as HubStore[]) || []);
    setOrders((o.data as HubOrder[]) || []);
    setAccess((a.data as Access[]) || []);
    setUsers(u.count || 0);
    setPays((p.data as Pay[]) || []);
    setSms((m.data as Sms[]) || []);
    setChats((c.data as Chat[]) || []);
    setAlerts((n.data as Alert[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const storeName = (id: string | null) => stores.find((x) => x.id === id)?.name || 'Store';
  const activeAccess = access.filter((x) => new Date(x.ends_at) > new Date());
  const pending = pays.filter((x) => x.status === 'pending');
  const sales = orders.filter((x) => x.status !== 'cancelled' && x.status !== 'returned').reduce((t, x) => t + Number(x.total || 0), 0);
  // one row per conversation (store / website / demo + visitor)
  const threads = Object.values(
    chats.reduce<Record<string, { key: string; where: string; last: Chat; n: number }>>((acc, c) => {
      const k = `${c.store_id || c.business_id || c.demo}|${c.visitor}`;
      const where = c.store_id ? storeName(c.store_id) : c.business_id ? 'Own website (widget)' : `Demo: ${c.demo}`;
      if (!acc[k]) acc[k] = { key: k, where, last: c, n: 0 };
      acc[k].n += 1;
      return acc;
    }, {}),
  );
  const ql = q.trim().toLowerCase();
  const has = (...v: Array<string | number | null | undefined>) => !ql || v.some((x) => String(x ?? '').toLowerCase().includes(ql));

  const stat = (v: number | string, l: string, go?: Page) => (
    <button type="button" onClick={() => go && setPage(go)} className="rounded-lg bg-black/30 p-2 text-center">
      <b className="block text-lg text-white">{loading ? '…' : v}</b>
      <span className="text-[9.5px] font-bold tracking-wider text-slate-400">{l}</span>
    </button>
  );
  const ext = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 text-[11px] font-bold text-white">
      <ExternalLink className="h-3.5 w-3.5" />{label}
    </a>
  );
  const empty = (t: string) => (
    <div className="space-y-1.5">
      <p className="px-1 text-[12px] text-slate-400">{loading ? 'Loading…' : t}</p>
      {!loading && page && INFO[page].example && (
        <div className="rounded-lg border border-dashed border-white/15 p-2 opacity-70">
          <p className="mb-1 text-[9.5px] font-bold tracking-wider text-amber-300">EXAMPLE · a real row will look like this</p>
          {INFO[page].example!.map((l, i) => <p key={l} className={i ? 'text-[11px] text-slate-400' : 'text-[12.5px] font-bold text-white'}>{l}</p>)}
        </div>
      )}
    </div>
  );

  if (!page) {
    return (
      <div className="space-y-2">
        <div className={card + ' space-y-2'}>
          <p className="text-[11px] font-bold tracking-wider text-teal-300">LIVE NOW</p>
          <div className="grid grid-cols-3 gap-1.5">
            {stat(users, 'SIGNED IN', 'signups')}
            {stat(activeAccess.length, 'ACCESS ON', 'signups')}
            {stat(stores.length, 'STORES', 'stores')}
            {stat(orders.length, 'ORDERS', 'orders')}
            {stat(tk(sales), 'SALES', 'orders')}
            {stat(pending.length, 'TO CHECK', 'payments')}
          </div>
          <p className="text-[10.5px] text-slate-400">Every Gmail and GIVE ACCESS: 21 WEBSITE ACCESS. ROSE branding and download links: 22 SITE SWITCHES.</p>
          <div className="grid grid-cols-2 gap-2">
            {ext('/demos/', 'DEMO STORES')}
            {ext('/start', 'STORE SIGN-UP PAGE')}
          </div>
        </div>
        <div className="space-y-1.5">
          <SettingsBar badge="01" title="ALL STORES" value={String(stores.length)} onClick={() => setPage('stores')} />
          <SettingsBar badge="02" title="ALL ORDERS" value={`${orders.length} · ${tk(sales)}`} onClick={() => setPage('orders')} />
          <SettingsBar badge="03" title="SIGN-UPS & PLANS" value={`${access.length} GMAIL`} onClick={() => setPage('signups')} />
          <SettingsBar badge="04" title="PAYMENTS" value={pending.length ? `${pending.length} TO CHECK` : String(pays.length)} onClick={() => setPage('payments')} />
          <SettingsBar badge="05" title="LIVE CHATS" value={String(threads.length)} onClick={() => setPage('chats')} />
          <SettingsBar badge="06" title="STORE ALERTS" value={String(alerts.length)} onClick={() => setPage('alerts')} />
          <SettingsBar badge="07" title="DEMO STORES" value="6" onClick={() => setPage('demos')} />
        </div>
      </div>
    );
  }

  const TITLES: Record<Page, string> = { stores: 'ALL STORES', orders: 'ALL ORDERS', signups: 'SIGN-UPS & PLANS', payments: 'PAYMENTS', chats: 'LIVE CHATS', alerts: 'STORE ALERTS', demos: 'DEMO STORES' };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setPage(null); setQ(''); }} className="flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-[11px] font-bold tracking-wider text-teal-400">
          <ChevronLeft className="h-4 w-4" />{TITLES[page]}
        </button>
        <button type="button" onClick={() => void load()} className="ml-auto text-[11px] font-bold text-slate-300">RELOAD</button>
      </div>
      <div className={card + ' space-y-1'}>
        <p className="text-[10.5px] font-bold tracking-wider text-teal-300">WHAT YOU SEE HERE</p>
        {INFO[page].what.map((w) => <p key={w} className="flex gap-2 text-[11.5px] text-slate-300"><span className="text-teal-400">•</span>{w}</p>)}
      </div>
      {page !== 'demos' && (
        <input className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Gmail, name, phone, TrxID…" />
      )}

      {page === 'stores' && (
        <div className="space-y-1.5">
          {!stores.length && empty('No real store yet. When someone opens a store (from /start or Workspace → MY STORE) it shows here.')}
          {stores.filter((s) => has(s.name, s.slug, s.owner_email, s.phone, s.whatsapp)).map((s) => (
            <div key={s.id} className={rowCls + ' space-y-1'}>
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-[13px] text-white">{s.name}</b>
                <span className={`text-[10.5px] font-bold ${s.suspended ? 'text-rose-300' : s.published ? 'text-emerald-300' : 'text-amber-300'}`}>{s.suspended ? 'CLOSED' : s.published ? 'LIVE' : 'DRAFT'}</span>
              </div>
              <p className="select-all truncate text-[11px] text-slate-300">{s.owner_email || '—'}</p>
              <p className="text-[11px] text-slate-400">
                {(s.plan || 'no plan').toUpperCase()}{s.ends_at ? ` · ${daysLeft(s.ends_at)} days left` : ''} · {s.products ?? 0} products · {s.orders ?? 0} orders
              </p>
              <p className="text-[11px] text-slate-400">{[s.whatsapp || s.phone, s.address].filter(Boolean).join(' · ')}</p>
              <p className="text-[10.5px] text-slate-500">Opened {when(s.created_at)}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">{ext(storeUrl(s), 'OPEN STORE')}<span className="flex items-center justify-center text-[10.5px] text-slate-400">Plan & switches: 21</span></div>
            </div>
          ))}
        </div>
      )}

      {page === 'orders' && (
        <div className="space-y-1.5">
          {!orders.length && empty('No orders yet in any store.')}
          {orders.filter((o) => has(o.customer_name, o.phone, o.order_no, storeName(o.store_id))).map((o) => (
            <div key={o.id} className={rowCls}>
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-[12.5px] text-white">#{o.order_no} · {storeName(o.store_id)}</b>
                <b className="text-[12.5px] text-white">{tk(o.total)}</b>
              </div>
              <p className="text-[11px] text-slate-300">{o.customer_name} · {o.phone} · {o.district || '—'}</p>
              <p className="truncate text-[11px] text-slate-400">{(o.items || []).map((i) => `${i.name} ×${i.q}`).join(', ')}</p>
              <p className="text-[10.5px]"><b className={STATUS_COLOR[o.status] || 'text-slate-300'}>{(o.status || 'new').toUpperCase()}</b> <span className="text-slate-500">· {String(o.payment_method || '').toUpperCase()} · {when(o.created_at)}</span></p>
            </div>
          ))}
        </div>
      )}

      {page === 'signups' && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10.5px] text-slate-400">Everyone who got the Store Builder (free trial from /start, paid, or given by you). To give access to a new Gmail, use 21 WEBSITE ACCESS.</p>
          {!access.length && empty('Nobody has website access yet.')}
          {access.filter((a) => has(a.email, a.plan, a.note)).map((a) => {
            const on = new Date(a.ends_at) > new Date();
            const mine = stores.filter((s) => (s.owner_email || '').toLowerCase() === a.email.toLowerCase());
            return (
              <div key={a.email} className={rowCls}>
                <p className="select-all truncate text-[12.5px] font-bold text-white">{a.email}</p>
                <p className="text-[11px] text-slate-300">
                  {a.plan.toUpperCase()}{a.months ? ` · ${a.months} months` : ''} · <b className={on ? 'text-emerald-300' : 'text-rose-300'}>{on ? `${daysLeft(a.ends_at)} days left` : 'ENDED'}</b> · paid {a.amount ? tk(a.amount) : '—'}
                </p>
                <p className="text-[11px] text-slate-400">{mine.length ? `Store: ${mine.map((s) => s.name).join(', ')}` : 'No store opened yet'}{a.note ? ` · ${a.note}` : ''}</p>
                <p className="text-[10.5px] text-slate-500">Started {when(a.created_at)} · ends {new Date(a.ends_at).toLocaleDateString('en-GB')}</p>
              </div>
            );
          })}
        </div>
      )}

      {page === 'payments' && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10.5px] text-slate-400">APPROVE / REJECT is in 21 WEBSITE ACCESS → PAYMENTS TO CHECK. This is the full history.</p>
          {!pays.length && empty('No store payments yet.')}
          {pays.filter((p) => has(p.email, p.trx_id, p.sender_number, p.method)).map((p) => (
            <div key={p.id} className={rowCls}>
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-[12.5px] text-white">{p.email}</b>
                <b className={`text-[10.5px] ${p.status === 'approved' ? 'text-emerald-300' : p.status === 'pending' ? 'text-amber-300' : 'text-rose-300'}`}>{p.status.toUpperCase()}</b>
              </div>
              <p className="text-[11px] text-slate-300">{p.plan.toUpperCase()} · {p.months} months · <b className="text-white">{tk(p.amount)}</b> · {p.method} from {p.sender_number}</p>
              <p className="select-all text-[11px] text-teal-200">TrxID {p.trx_id} <span className="text-slate-500">· {when(p.created_at)}</span></p>
            </div>
          ))}
          <p className="px-1 pt-2 text-[11px] font-bold tracking-wider text-slate-300">MONEY SMS RECEIVED · {sms.length}</p>
          {!sms.length && !loading && <p className="px-1 text-[12px] text-slate-400">No payment SMS yet.</p>}
          {sms.filter((m) => has(m.trx_id, m.sender, m.method)).map((m) => (
            <p key={m.id} className={rowCls + ' text-[11px] text-slate-300'}>
              {m.method} <b className="text-white">{tk(m.amount)}</b> · {m.sender || '—'} · <span className="select-all">{m.trx_id}</span> · <b className={m.used_for ? 'text-emerald-300' : 'text-amber-300'}>{m.used_for ? 'MATCHED' : 'WAITING'}</b>
              <span className="block text-[10.5px] text-slate-500">{when(m.received_at)}</span>
            </p>
          ))}
        </div>
      )}

      {page === 'chats' && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10.5px] text-slate-400">Customer chats from every store, own websites (widget) and demo stores. Owners reply from their 13 LIVE CHAT.</p>
          {!threads.length && empty('No chats yet.')}
          {threads.filter((t) => has(t.where, t.last.body, t.last.visitor)).map((t) => (
            <div key={t.key} className={rowCls}>
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 truncate text-[12.5px] text-white">{t.where}</b>
                <span className="text-[10.5px] text-slate-400">{t.n} msg</span>
              </div>
              <p className="truncate text-[11.5px] text-slate-300"><b className="text-slate-400">{t.last.sender === 'customer' ? 'Customer' : t.last.sender === 'rose' ? 'ROSE' : 'Owner'}:</b> {t.last.body}</p>
              <p className="text-[10.5px] text-slate-500">{when(t.last.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {page === 'alerts' && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10.5px] text-slate-400">New stores, changed store info and payments to check, newest first.</p>
          {!alerts.length && empty('No store alerts yet.')}
          {alerts.filter((a) => has(a.title, a.body)).map((a) => (
            <div key={a.id} className={rowCls}>
              <b className="block text-[12.5px] text-white">{a.title}</b>
              <p className="text-[11px] text-slate-300">{a.body}</p>
              <p className="text-[10.5px] text-slate-500">{when(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {page === 'demos' && (
        <div className="space-y-1.5">
          {DEMOS.map(([k, label]) => (
            <div key={k} className={rowCls + ' space-y-1.5'}>
              <b className="block text-[12.5px] text-white">{label}</b>
              <div className="grid grid-cols-3 gap-1.5">
                {ext(`/demos/store.html?s=${k}`, 'STORE')}
                {ext(`/demos/admin.html?s=${k}`, 'ADMIN')}
                {ext(`/demos/view.html?s=${k}`, 'PHONE+PC')}
              </div>
            </div>
          ))}
          <p className="px-1 text-[10.5px] text-slate-400">People open a demo and tap "Use this design · 5 days free" to get the same design as a real store.</p>
        </div>
      )}
    </div>
  );
};
