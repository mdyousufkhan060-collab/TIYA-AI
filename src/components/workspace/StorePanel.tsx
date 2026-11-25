import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SettingsBar } from '../settings/SettingsShell';
import { STORE_DURATIONS, STORE_PLANS, tk, type StorePlanId } from '../../utils/storePlans';
import { AdminBrandPage, RoseSupportCard } from '../admin/AdminBrandPage';
import { INVOICE_SIZES, PRINT_CSS, STICKER_SIZES, printOrders, stickerHTML, stickerSize, type PrintOrder, type PrintSettings } from '../../utils/storePrint';

/**
 * Workspace > MY STORE: the ROSE Store Builder for the store owner.
 * Pick a demo design, then manage Products, Categories, Orders and Homepage.
 * Access comes from Admin > 23 WEBSITE ACCESS (or the 5-day free trial).
 */
type Access = { plan: StorePlanId; ends_at: string; stores_limit: number; products_limit: number } | null;
type Store = {
  id: string; owner_id?: string; slug: string; name: string; tagline: string; logo: string; logo_url: string; color: string; accent: string; template: string;
  city: string; phone: string; email: string; address: string; licence: string; note: string;
  name_bn?: string; email2?: string; whatsapp?: string; phone2?: string;
  delivery_inside: number; delivery_outside: number; banners: Banner[]; trust: string[];
  pay_numbers: Record<string, string>; published: boolean; suspended: boolean; print_settings: PrintSettings; subdomain_ready?: boolean; custom_domain?: string | null; domain_ready?: boolean;
};
type Banner = { title: string; badge: string; icon: string; bg?: string; img?: string };
type Cat = { id: string; name: string; icon: string; sort: number };
type Prod = {
  id: string; name: string; category_id: string | null; price: number; old_price: number | null; stock: number; emoji: string;
  description: string; images: string[]; options_label: string; options: string[]; rx: boolean; active: boolean;
  short_description: string; specs: Record<string, string>;
};
type Order = {
  id: string; order_no: number; customer_name: string; phone: string; address: string; area: string;
  items: Array<{ name: string; q: number; price: number; opt?: string }>; total: number; payment_method: string; trx_id: string; status: string; created_at: string;
  email: string; division: string; district: string; upazila: string; courier: string; tracking: string; note: string; subtotal: number; delivery: number;
};
export type Demo = {
  name: string; tagline: string; logo: string; type: string; color: string; accent: string; banners: Banner[]; trust: string[];
  categories: [string, string][]; products: Array<[string, string, string, number, number, string?, string?]>;
  options?: { label: string; values: string[] }; note: string; pharmacy?: boolean;
};

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-60';
const STATUSES = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const SIZE_SETS: Array<[string, string[]]> = [['Shirt / T-shirt: S-XXL', ['S', 'M', 'L', 'XL', 'XXL']], ['Pant / waist: 28-38', ['28', '30', '32', '34', '36', '38']], ['Shoe: 39-44', ['39', '40', '41', '42', '43', '44']], ['Kids: 1-8 years', ['1-2Y', '3-4Y', '5-6Y', '7-8Y']], ['Free size', ['Free size']]];
const QUICK: Record<string, string[]> = { Size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free size'], Colour: ['Black', 'White', 'Red', 'Blue', 'Green', 'Navy', 'Grey'], Weight: ['250g', '500g', '1kg', '2kg', '5kg'], Pack: ['1 pc', '2 pcs', '3 pcs'], Model: [] };
type Kind = { tabs: Array<[string, string, string]>; specs: Array<[string, string, string, string]> };
const kindOf = (template: string): Kind | null => { const w = window as any; return (w.ROSE_KINDS && w.ROSE_KINDS[(w.ROSE_KIND_OF || {})[template] || 'fashion']) || null; };

export function loadDemos(): Promise<Record<string, Demo>> {
  const w = window as any;
  if (w.ROSE_STORES) return Promise.resolve(w.ROSE_STORES);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = '/demos/stores.js';
    s.onload = () => resolve(w.ROSE_STORES || {});
    s.onerror = () => resolve({});
    document.head.appendChild(s);
  });
}
/** Phone photo -> small WebP in the store's own folder; returns the public link. */
export async function uploadImage(storeId: string, file: File, max = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read the photo'));
    i.src = url;
  });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not convert the photo'))), 'image/webp', 0.82));
  const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from('store-media').upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('store-media').getPublicUrl(path).data.publicUrl;
}

export const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
/** Names that cannot become yourshop.myrosebd.com (site pages, mail, demo stores). */
export const RESERVED_SLUGS = ['www', 'app', 'api', 'admin', 'mail', 'webmail', 'shop', 'demos', 'demo', 'autodiscover', 'autoconfig', 'ftp', 'cpanel', 'ns1', 'ns2', 'rose', 'help', 'support', 'blog', 'foodbazaar', 'fashionhub', 'sotadari', 'shopshotoi', 'homenest', 'medicare'];

export const StorePanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<Access>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [tab, setTab] = useState<'home' | 'orders' | 'products' | 'categories' | 'design' | 'delivery' | 'domain' | 'staff' | 'rose' | 'plan' | 'company' | 'create'>('home');
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [showRose, setShowRose] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: adm }, { data: acc }, { data: st }, d, { data: mine }, { data: flags }] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('my_website_access'),
      supabase.from('stores').select('*').eq('owner_id', userId).order('created_at'),
      loadDemos(),
      supabase.rpc('my_staff_stores'),
      supabase.from('site_settings').select('key, value'),
    ]);
    const staffRows = ((mine as Array<{ store_id: string; role: string }>) || []);
    const r: Record<string, string> = {};
    staffRows.forEach((x) => { r[x.store_id] = x.role; });
    let staffStores: Store[] = [];
    if (staffRows.length) {
      const { data: ss } = await supabase.from('stores').select('*').in('id', staffRows.map((x) => x.store_id));
      staffStores = ((ss as Store[]) || []).filter((x) => x.owner_id !== userId);
    }
    setRoles(r);
    setShowRose(!((flags as Array<{ key: string; value: unknown }>) || []).some((f) => f.key === 'store_admin_rose_card' && f.value === false));
    setIsAdmin(Boolean(adm));
    setAccess(acc && (acc as any).email ? (acc as Access) : null);
    const list = [...((st as Store[]) || []), ...staffStores];
    setStores(list);
    setStore((cur) => (cur ? list.find((x) => x.id === cur.id) || list[0] || null : list[0] || null));
    setDemos(d);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  const active = isAdmin || (access && new Date(access.ends_at) > new Date()) || Object.keys(roles).length > 0;

  if (loading) return <p className="px-1 text-xs text-slate-400">Loading…</p>;

  // ---------- no access: demos, free trial, plans ----------
  if (!active) {
    const startTrial = async () => {
      const { error } = await supabase.rpc('start_website_trial');
      if (error) return setMsg(error.message.includes('already') ? 'Free trial already used. Choose a plan below.' : error.message);
      setMsg('5-day free trial started!');
      void load();
    };
    return (
      <div className="space-y-3">
        <div className={box}>
          {stores.length > 0 && (
            <p className="mb-2 border border-amber-400/50 bg-amber-500/10 p-2 text-[12px] font-bold text-amber-200">
              ⏸ Your store {stores[0].name} is paused because the {access?.plan === 'trial' ? '5-day free trial' : 'plan'} ended. Choose a plan below and it opens again at once. Nothing is deleted.
            </p>
          )}
          <p className="text-sm font-bold text-white">Make your own online store</p>
          <p className="mt-1 text-[12px] text-slate-300">Food, fashion, grocery, furniture, pharmacy and more. ROSE sets it up; you add products and get orders.</p>
          <a href="/demos" target="_blank" rel="noreferrer" className={btn + ' mt-2 w-full'}>
            <ExternalLink className="h-3.5 w-3.5" /> SEE DEMO STORES
          </a>
          {!access && (
            <button type="button" onClick={() => void startTrial()} className={btn + ' mt-2 w-full bg-amber-500 text-black'}>
              START 5-DAY FREE TRIAL
            </button>
          )}
          {access && <p className="mt-2 text-[12px] text-rose-300">Your plan ended on {new Date(access.ends_at).toLocaleDateString('en-GB')}. Your store is saved; renew to edit it.</p>}
          {msg && <p className="mt-2 text-[12px] text-teal-200">{msg}</p>}
        </div>
        <BuyPlan current={access || undefined} onPaid={() => void load()} />
      </div>
    );
  }

  // ---------- create a store ----------
  const limit = isAdmin ? 99 : access?.stores_limit || 1;
  if (!stores.length || tab === 'create') {
    return <CreateStore demos={demos} canCreate={stores.length < limit} onBack={stores.length ? () => setTab('home') : undefined} onDone={() => { setTab('home'); void load(); }} />;
  }
  if (!store) return null;
  const myRole = roles[store.id] && store.owner_id !== userId && !isAdmin ? roles[store.id] : 'owner';
  const can = (area: 'orders' | 'products' | 'design' | 'owner') =>
    myRole === 'owner' ||
    (myRole === 'manager' && area !== 'owner') ||
    (area === 'orders' && ['orders', 'support', 'accounts'].includes(myRole)) ||
    (area === 'products' && ['products', 'marketing'].includes(myRole));

  const url = store.custom_domain && store.domain_ready ? `https://${store.custom_domain}` : store.subdomain_ready ? `https://${store.slug}.myrosebd.com` : `${window.location.origin}/shop/${store.slug}`;
  const makeSubdomain = async () => {
    setMsg('Setting up your address…');
    const { data, error } = await supabase.functions.invoke('store-subdomain', { body: { store_id: store.id } });
    const err = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j.error).catch(() => error.message) : '');
    if (err) return setMsg(String(err));
    setMsg((data as any)?.ok ? `Your store is live at ${(data as any).address}` : (data as any)?.message || 'Please try again.');
    void load();
  };
  const header = (
    <div className={box + ' space-y-2'}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{store.logo}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{store.name}</p>
          <a href={url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-teal-300 underline">{url.replace(/^https?:\/\//, '')}</a>
        </div>
        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${store.suspended ? 'bg-rose-600 text-white' : store.published ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300'}`}>
          {store.suspended ? 'SUSPENDED' : store.published ? 'LIVE' : 'DRAFT'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={btn + (store.published ? ' bg-white/10' : '')}
          onClick={async () => {
            const going = !store.published;
            await supabase.from('stores').update({ published: going, updated_at: new Date().toISOString() }).eq('id', store.id);
            if (going && !store.subdomain_ready) {
              const { data } = await supabase.functions.invoke('store-subdomain', { body: { store_id: store.id } });
              if ((data as any)?.ok) setMsg(`Your store is live at ${(data as any).address}`);
            }
            void load();
          }}
        >
          {store.published ? 'UNPUBLISH' : 'PUBLISH'}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className={btn + ' bg-white/10'}>
          <ExternalLink className="h-3.5 w-3.5" /> OPEN STORE
        </a>
      </div>
      {!store.published && <p className="text-[11px] text-slate-400">Customers can see the store only after PUBLISH.</p>}
      {store.published && !store.subdomain_ready && (
        <button type="button" onClick={() => void makeSubdomain()} className={btn + ' w-full bg-white/10'}>
          GET MY ADDRESS: {store.slug}.myrosebd.com
        </button>
      )}
      {msg && <p className="text-[11px] text-teal-200">{msg}</p>}
      {!isAdmin && access && <p className="text-[11px] text-slate-400">{STORE_PLANS[access.plan]?.label} until {new Date(access.ends_at).toLocaleDateString('en-GB')}</p>}
    </div>
  );

  if (tab !== 'home') {
    const back = (
      <button type="button" onClick={() => setTab('home')} className="px-1 text-[11px] font-bold tracking-wider text-teal-400">
        ‹ {store.name.toUpperCase()}
      </button>
    );
    return (
      <div className="space-y-3">
        {back}
        {tab === 'orders' && <OrdersTab store={store} />}
        {tab === 'products' && <ProductsTab store={store} limit={isAdmin ? 100000 : access?.products_limit || 50} />}
        {tab === 'categories' && <CategoriesTab store={store} />}
        {tab === 'design' && <DesignTab store={store} onSaved={() => void load()} />}
        {tab === 'delivery' && <DeliveryTab store={store} onSaved={() => void load()} />}
        {tab === 'domain' && <DomainTab store={store} onSaved={() => void load()} />}
        {tab === 'staff' && <StaffTab store={store} limit={isAdmin ? 50 : access?.staff_limit || 0} />}
        {tab === 'rose' && <AdminBrandPage />}
        {tab === 'plan' && <BuyPlan current={access || undefined} onPaid={() => void load()} />}
        {tab === 'company' && <CompanyTab store={store} onSaved={() => void load()} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stores.length > 1 && (
        <select className={input} value={store.id} onChange={(e) => setStore(stores.find((s) => s.id === e.target.value) || null)}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
      {showRose && <RoseSupportCard onOpen={() => setTab('rose')} />}
      {header}
      {myRole !== 'owner' && <p className="px-1 text-[11px] font-bold text-amber-300">You are STAFF here · role: {myRole.toUpperCase()}</p>}
      <div className="space-y-1.5">
        {can('orders') && <SettingsBar badge="01" title="ORDERS" onClick={() => setTab('orders')} testId="store-orders" />}
        {can('products') && <SettingsBar badge="02" title="PRODUCTS" onClick={() => setTab('products')} testId="store-products" />}
        {can('products') && <SettingsBar badge="03" title="CATEGORIES" onClick={() => setTab('categories')} testId="store-categories" />}
        {can('design') && <SettingsBar badge="04" title="HOMEPAGE & DESIGN" value="BANNERS · COLOURS" onClick={() => setTab('design')} testId="store-design" />}
        {can('design') && <SettingsBar badge="05" title="DELIVERY & COURIER" value="STICKER · INVOICE" onClick={() => setTab('delivery')} testId="store-delivery" />}
        {can('owner') && <SettingsBar badge="06" title="OWN DOMAIN" value={store.custom_domain ? (store.domain_ready ? 'LIVE' : 'WAITING') : 'CONNECT'} onClick={() => setTab('domain')} testId="store-domain" />}
        {can('owner') && <SettingsBar badge="07" title="STAFF" value="GMAIL · ROLES" onClick={() => setTab('staff')} testId="store-staff" />}
        {can('owner') && !isAdmin && <SettingsBar badge="08" title="PLAN & RENEW" value={access ? `${STORE_PLANS[access.plan]?.label || access.plan} · ${new Date(access.ends_at).toLocaleDateString('en-GB')}` : 'BUY'} onClick={() => setTab('plan')} testId="store-plan" />}
        {can('design') && <SettingsBar badge="09" title="COMPANY INFO" value="NAME · EMAIL · PHONE · ADDRESS" onClick={() => setTab('company')} testId="store-company" />}
        {can('owner') && stores.length < limit && <SettingsBar badge="+" title="NEW STORE" onClick={() => setTab('create')} testId="store-new" />}
      </div>
      <p className="px-1 text-[11px] text-slate-400">Coming next: Payments, Pixels & Analytics, Live chat.</p>
    </div>
  );
};

// ---------------------------------------------------------------- buy / renew a plan (bKash · Nagad · Rocket)
type PriceRow = { plan: StorePlanId; monthly: number; stores: number; products: number; storage_gb: number; staff: number; own_domain: boolean };
const DISC: Record<number, number> = { 3: 0, 6: 5, 9: 10, 12: 15, 24: 25 };
const BuyPlan: React.FC<{ current?: Access; onPaid?: () => void }> = ({ current, onPaid }) => {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pay, setPay] = useState<{ bkash?: string; nagad?: string; rocket?: string }>({});
  const [plan, setPlan] = useState<StorePlanId>('starter');
  const [months, setMonths] = useState(3);
  const [method, setMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [sender, setSender] = useState('');
  const [trx, setTrx] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Array<{ id: string; plan: string; months: number; amount: number; status: string; created_at: string; admin_note: string | null }>>([]);
  const loadMine = useCallback(async () => {
    const { data } = await supabase.from('store_payment_requests').select('id, plan, months, amount, status, created_at, admin_note').order('created_at', { ascending: false }).limit(5);
    setMine((data as typeof mine) || []);
  }, []);
  useEffect(() => {
    void supabase.from('store_plan_prices').select('*').order('sort').then(({ data }) => {
      const rows = (data as PriceRow[]) || [];
      setPrices(rows.length ? rows : (['starter', 'pro', 'business'] as StorePlanId[]).map((k) => ({ plan: k, monthly: STORE_PLANS[k].monthly, stores: STORE_PLANS[k].stores, products: STORE_PLANS[k].products, storage_gb: STORE_PLANS[k].storageGb, staff: STORE_PLANS[k].staff, own_domain: STORE_PLANS[k].ownDomain })));
    });
    void supabase.rpc('get_payment_info').then(({ data }) => setPay((data as typeof pay) || {}));
    void loadMine();
  }, [loadMine]);
  const row = prices.find((p) => p.plan === plan);
  const total = row ? Math.round((row.monthly * months * (100 - (DISC[months] || 0))) / 100) : 0;
  const number = method === 'bKash' ? pay.bkash : method === 'Nagad' ? pay.nagad : pay.rocket;
  const send = async () => {
    setBusy(true);
    setMsg('');
    const { data, error } = await supabase.rpc('submit_store_payment', { p_plan: plan, p_months: months, p_method: method, p_sender: sender, p_trx: trx });
    setBusy(false);
    const r = data as { ok: boolean; message: string; auto?: boolean } | null;
    setMsg(error ? error.message : r?.message || '');
    if (r?.ok) { setTrx(''); void loadMine(); if (r.auto && onPaid) setTimeout(onPaid, 1500); }
  };
  return (
    <div className="space-y-2">
      {current && current.plan !== 'trial' && (
        <div className={box + ' text-[12px] text-slate-200'}>
          Now: <b>{STORE_PLANS[current.plan]?.label || current.plan}</b> until {new Date(current.ends_at).toLocaleDateString('en-GB')}. Renewing the same plan adds the months after this date.
        </div>
      )}
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">1 · CHOOSE A PLAN</p>
        {prices.map((p) => (
          <button key={p.plan} type="button" onClick={() => setPlan(p.plan)} className={`w-full border p-2 text-left ${plan === p.plan ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-black/30'}`}>
            <span className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-bold text-white">{STORE_PLANS[p.plan]?.label || p.plan.toUpperCase()}</span>
              <span className="text-[13px] font-bold text-teal-300">{tk(p.monthly)} / month</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              {p.stores} store{p.stores > 1 ? 's' : ''} · {p.products > 10000 ? 'unlimited' : p.products} products · {p.storage_gb} GB photos · {p.staff} staff · {p.own_domain ? 'own domain' : 'name.myrosebd.com'}
            </span>
          </button>
        ))}
        <p className="pt-1 text-[11px] font-bold tracking-wider text-teal-300">2 · HOW LONG</p>
        <div className="grid grid-cols-5 gap-1">
          {STORE_DURATIONS.map((d) => (
            <button key={d.months} type="button" onClick={() => setMonths(d.months)} className={`border py-1.5 text-center ${months === d.months ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-black/30'}`}>
              <span className="block text-[12.5px] font-bold text-white">{d.months}m</span>
              <span className="block text-[9.5px] text-amber-300">{d.off ? `-${d.off}%` : ' '}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center border border-amber-400/40 bg-amber-500/10 p-2">
          <span className="flex-1 text-[12px] text-amber-100">{STORE_PLANS[plan]?.label} · {months} months</span>
          <span className="text-[17px] font-extrabold text-amber-300">{tk(total)}</span>
        </div>
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">3 · PAY AND SEND THE TrxID</p>
        <div className="grid grid-cols-3 gap-1">
          {(['bKash', 'Nagad', 'Rocket'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={`border py-2 text-[12px] font-bold ${method === m ? 'border-teal-400 bg-teal-500/10 text-white' : 'border-white/10 bg-black/30 text-slate-300'}`}>{m}</button>
          ))}
        </div>
        <p className="text-[12px] text-slate-200">
          Send Money <b className="text-amber-300">{tk(total)}</b> to {method} <b className="select-all text-white">{number || '(number not set)'}</b>, then write the number you paid from and the TrxID.
        </p>
        <input className={input} value={sender} onChange={(e) => setSender(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="Your number 01XXXXXXXXX" inputMode="numeric" />
        <input className={input} value={trx} onChange={(e) => setTrx(e.target.value.trim())} placeholder="Transaction ID (TrxID)" autoCapitalize="characters" />
        <button type="button" disabled={busy || !number} onClick={() => void send()} className={btn + ' w-full bg-amber-500 text-black'}>{busy ? 'SENDING…' : 'SEND FOR CHECKING'}</button>
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
        <p className="text-[10.5px] text-slate-400">The plan turns on by itself as soon as the payment is matched. See <a className="underline" href="/refund.html" target="_blank" rel="noreferrer">Refund Policy</a>.</p>
      </div>
      {mine.length > 0 && (
        <div className={box + ' space-y-1'}>
          <p className="text-[11px] font-bold tracking-wider text-teal-300">MY PAYMENTS</p>
          {mine.map((r) => (
            <p key={r.id} className="text-[11.5px] text-slate-300">
              {new Date(r.created_at).toLocaleDateString('en-GB')} · {r.plan.toUpperCase()} {r.months}m · {tk(r.amount)} ·{' '}
              <b className={r.status === 'approved' ? 'text-emerald-300' : r.status === 'rejected' ? 'text-rose-300' : 'text-amber-300'}>{r.status.toUpperCase()}</b>
              {r.admin_note ? ` · ${r.admin_note}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- company info (owner changes it any time; admin gets a notice)
const CompanyTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [s, setS] = useState({
    name: store.name || '', name_bn: store.name_bn || '', email: store.email || '', email2: store.email2 || '',
    whatsapp: store.whatsapp || store.phone || '', phone2: store.phone2 || '', address: store.address || '', city: store.city || '',
  });
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof s, v: string) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const ph = (p: string) => !p || /^01[3-9]\d{8}$/.test(p);
    if (s.name.trim().length < 3) return setMsg('Write the company name.');
    if (!ph(s.whatsapp) || !ph(s.phone2)) return setMsg('Phone numbers must be 11 digits (01XXXXXXXXX).');
    const { error } = await supabase
      .from('stores')
      .update({ ...s, name: s.name.trim(), phone: s.whatsapp || store.phone, updated_at: new Date().toISOString() })
      .eq('id', store.id);
    setMsg(error ? error.message : 'Saved. Your store shows the new details now.');
    if (!error) onSaved();
  };
  const row = (k: keyof typeof s, label: string, ph = '', mode?: 'email' | 'numeric') => (
    <label className="block text-[11px] font-bold text-slate-300">
      {label}
      <input
        className={input + ' mt-1'}
        value={s[k]}
        placeholder={ph}
        inputMode={mode}
        onChange={(e) => set(k, mode === 'numeric' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
      />
    </label>
  );
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">COMPANY</p>
        {row('name', 'Company name (English)', 'Rahim Fashion')}
        {row('name_bn', 'Company name (Bangla)', 'রহিম ফ্যাশন')}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">EMAIL</p>
        {row('email', 'Company Gmail 1', '', 'email')}
        {row('email2', 'Email 2 (optional)', '', 'email')}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">PHONE</p>
        {row('whatsapp', 'WhatsApp number', '01XXXXXXXXX', 'numeric')}
        {row('phone2', 'Other phone (optional)', '01XXXXXXXXX', 'numeric')}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ADDRESS</p>
        <label className="block text-[11px] font-bold text-slate-300">
          Full address (where customers find you)
          <textarea className={input + ' mt-1'} rows={2} value={s.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        {row('city', 'City / District')}
      </div>
      <button type="button" onClick={() => void save()} className={btn + ' w-full'}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      <p className="px-1 text-[11px] text-slate-400">Logo, banners and colours: 04 HOMEPAGE & DESIGN. The login Gmail stays the same; to move the store to another Gmail, contact ROSE.</p>
    </div>
  );
};

// ---------------------------------------------------------------- create
const CreateStore: React.FC<{ demos: Record<string, Demo>; canCreate: boolean; onBack?: () => void; onDone: () => void }> = ({ demos, canCreate, onBack, onDone }) => {
  const [tpl, setTpl] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Dhaka');
  const [sample, setSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!canCreate) return <p className="text-xs text-slate-400">Your plan allows no more stores.</p>;

  const create = async () => {
    const d = demos[tpl];
    const s = slugify(slug || name);
    if (!d) return setMsg('Choose a design first.');
    if (!name.trim() || s.length < 3) return setMsg('Write the store name (3+ letters).');
    if (RESERVED_SLUGS.includes(s)) return setMsg('This address is taken. Choose another name.');
    setBusy(true);
    setMsg('');
    const { data: st, error } = await supabase
      .from('stores')
      .insert({
        slug: s, template: tpl, name: name.trim(), tagline: d.tagline, logo: d.logo, color: d.color, accent: d.accent,
        city, phone, banners: d.banners, trust: d.trust, note: d.note,
      })
      .select('*')
      .single();
    if (error || !st) {
      setBusy(false);
      return setMsg(error?.message.includes('duplicate') ? 'This link is taken. Try another.' : error?.message || 'Could not create.');
    }
    if (sample) {
      const cats = d.categories.map((c, i) => ({ store_id: st.id, name: c[0], icon: c[1], sort: i }));
      const { data: made } = await supabase.from('store_categories').insert(cats).select('id,name');
      const byName = new Map(((made as Array<{ id: string; name: string }>) || []).map((c) => [c.name, c.id]));
      const prods = d.products.map((p, i) => ({
        store_id: st.id, name: p[0], category_id: byName.get(p[1]) || null, emoji: p[2], price: p[3], old_price: p[4], stock: 50,
        rx: p[5] === 'rx', options_label: d.options?.label || '', options: d.options?.values || [], sort: i,
        images: p[6] ? [String(p[6])] : [],
      }));
      await supabase.from('store_products').insert(prods);
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="space-y-3">
      {onBack && (
        <button type="button" onClick={onBack} className="px-1 text-[11px] font-bold tracking-wider text-teal-400">‹ BACK</button>
      )}
      <p className="px-1 text-[11px] font-bold tracking-wider text-slate-300">1 · CHOOSE A DESIGN</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(demos).map(([k, d]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTpl(k)}
            className={`rounded-xl border p-2 text-left ${tpl === k ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-[#11151E]'}`}
          >
            <span className="text-2xl">{d.logo}</span>
            <p className="text-[12px] font-bold text-white">{d.name}</p>
            <p className="text-[10.5px] text-slate-400">{d.type}</p>
            <a href={`/demos/store.html?s=${k}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10.5px] text-teal-300 underline">
              view demo
            </a>
          </button>
        ))}
      </div>
      <p className="px-1 text-[11px] font-bold tracking-wider text-slate-300">2 · YOUR STORE</p>
      <div className={box + ' space-y-2'}>
        <input className={input} value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(''); }} placeholder="Store name (e.g. Rahim Fashion)" />
        <div className="flex items-center gap-1 text-[12px] text-slate-400">
          <input className={input} value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="rahim-fashion" />
          <span className="shrink-0">.myrosebd.com</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
          <input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-slate-300">
          <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Start with the demo products (edit or delete later)
        </label>
        <button type="button" onClick={() => void create()} disabled={busy} className={btn + ' w-full'}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} CREATE STORE
        </button>
        {msg && <p className="text-[12px] text-rose-300">{msg}</p>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- orders
const OrdersTab: React.FC<{ store: Store }> = ({ store }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<string>('');
  const [edit, setEdit] = useState<Partial<Order> | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const ps = (store.print_settings || {}) as PrintSettings;
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(200);
    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const setStatus = async (o: Order, status: string) => {
    await supabase.from('store_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id);
    void load();
  };
  const saveEdit = async () => {
    if (!edit?.id) return;
    const ph = String(edit.phone || '').replace(/\D/g, '');
    if (!/^01[3-9]\d{8}$/.test(ph)) return setMsg('Mobile must be 11 digits (01XXXXXXXXX).');
    if (String(edit.customer_name || '').trim().split(/\s+/).length < 2) return setMsg('Write the full name.');
    if (String(edit.address || '').trim().length < 15) return setMsg('Write the full address.');
    const del = Number(edit.delivery) || 0;
    const sub = (edit.items || []).reduce((a, i) => a + Number(i.price) * Number(i.q), 0);
    const { error } = await supabase.from('store_orders').update({
      customer_name: String(edit.customer_name).trim(), phone: ph, email: edit.email || '', division: edit.division || '', district: edit.district || '', upazila: edit.upazila || '',
      address: String(edit.address).trim(), note: edit.note || '', items: edit.items, subtotal: sub, delivery: del, total: sub + del, updated_at: new Date().toISOString(),
    }).eq('id', edit.id);
    if (error) return setMsg(error.message);
    setEdit(null); setMsg('Order saved.'); void load();
  };
  const book = async (o: Order) => {
    setBusy(o.id); setMsg('');
    const { data, error } = await supabase.functions.invoke('store-courier', { body: { order_id: o.id, courier: 'steadfast' } });
    setBusy('');
    const err = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j.error).catch(() => error.message) : '');
    if (err) return setMsg(String(err));
    setMsg(`Booked with Steadfast · tracking ${(data as any).tracking}`); void load();
  };
  const print = (kind: 'sticker' | 'invoice', list: Order[]) => { const e = printOrders(kind, list, ps, store); if (e) setMsg(e); };

  if (loading) return <p className="text-xs text-slate-400">Loading…</p>;
  if (!orders.length) return <div className={box}><p className="text-[12px] text-slate-300">No orders yet. Share your store link to get orders.</p></div>;
  const today = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString());
  const list = orders.filter((o) => filter === 'all' || o.status === filter);
  const openOnes = orders.filter((o) => ['new', 'confirmed', 'packed'].includes(o.status));

  if (edit) {
    const set = (k: keyof Order, v: unknown) => setEdit((e) => ({ ...(e || {}), [k]: v }));
    return (
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">EDIT ORDER #{edit.order_no}</p>
        <input className={input} value={edit.customer_name || ''} onChange={(e) => set('customer_name', e.target.value)} placeholder="Full name" />
        <input className={input} value={edit.phone || ''} maxLength={11} inputMode="numeric" onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01XXXXXXXXX" />
        <input className={input} value={edit.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
        <div className="grid grid-cols-3 gap-2">
          <input className={input} value={edit.division || ''} onChange={(e) => set('division', e.target.value)} placeholder="Division" />
          <input className={input} value={edit.district || ''} onChange={(e) => set('district', e.target.value)} placeholder="District" />
          <input className={input} value={edit.upazila || ''} onChange={(e) => set('upazila', e.target.value)} placeholder="Upazila" />
        </div>
        <textarea className={input} rows={2} value={edit.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Full address" />
        {(edit.items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px] text-slate-300">
            <span className="min-w-0 flex-1 truncate">{it.name}{it.opt ? ` (${it.opt})` : ''}</span>
            <input className={input + ' w-16 text-center'} inputMode="numeric" value={it.q} onChange={(e) => set('items', (edit.items || []).map((x, j) => (j === i ? { ...x, q: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) } : x)))} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <input className={input} inputMode="numeric" value={edit.delivery ?? ''} onChange={(e) => set('delivery', e.target.value.replace(/\D/g, ''))} placeholder="Delivery charge" />
          <input className={input} value={edit.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Note for courier" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEdit(null)} className={btn + ' bg-white/10'}>CANCEL</button>
          <button type="button" onClick={() => void saveEdit()} className={btn}>SAVE</button>
        </div>
        {msg && <p className="text-[12px] text-rose-300">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={box + ' grid grid-cols-2 gap-2 text-center'}>
        <div><p className="text-lg font-bold text-white">{today.length}</p><p className="text-[10.5px] text-slate-400">ORDERS TODAY</p></div>
        <div><p className="text-lg font-bold text-white">{tk(today.reduce((a, o) => a + Number(o.total), 0))}</p><p className="text-[10.5px] text-slate-400">SALES TODAY</p></div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {['all', ...STATUSES].map((s) => {
          const n = orders.filter((o) => s === 'all' || o.status === s).length;
          return (
            <button key={s} type="button" onClick={() => setFilter(s)} className={`shrink-0 rounded-full border px-3 py-1 text-[10.5px] font-bold ${filter === s ? 'border-teal-500 bg-teal-500 text-black' : 'border-white/15 text-slate-300'}`}>
              {s.toUpperCase()} {n}
            </button>
          );
        })}
      </div>
      {openOnes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btn + ' bg-white/10'} onClick={() => print('sticker', openOnes)}>🏷️ STICKERS ({openOnes.length})</button>
          <button type="button" className={btn + ' bg-white/10'} onClick={() => print('invoice', openOnes)}>🧾 INVOICES ({openOnes.length})</button>
        </div>
      )}
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      {list.map((o) => (
        <div key={o.id} className={box + ' space-y-1'}>
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === o.id ? '' : o.id)}>
            <p className="text-[12.5px] font-bold text-white">#{o.order_no} · {tk(Number(o.total))}</p>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">{o.status.toUpperCase()}</span>
          </button>
          <p className="text-[11.5px] text-slate-300">{o.customer_name} · <a className="text-teal-300" href={`tel:${o.phone}`}>{o.phone}</a></p>
          <p className="text-[11px] text-slate-400">{[o.address, o.upazila, o.district, o.division].filter(Boolean).join(', ')} ({o.area})</p>
          <p className="text-[11px] text-slate-300">{o.items.map((i) => `${i.name}${i.opt ? ` (${i.opt})` : ''} ×${i.q}`).join(', ')}</p>
          <p className="text-[10.5px] text-slate-500">{o.payment_method.toUpperCase()}{o.trx_id ? ` · TrxID ${o.trx_id}` : ''}{o.email ? ` · ${o.email}` : ''} · {new Date(o.created_at).toLocaleString('en-GB')}</p>
          {o.tracking && <p className="text-[11px] text-emerald-300">🚚 {o.courier} · {o.tracking}</p>}
          {open === o.id && (
            <div className="space-y-2 pt-2">
              <select className={input} value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={btn + ' bg-white/10'} onClick={() => { setMsg(''); setEdit({ ...o, items: o.items.map((x) => ({ ...x })) }); }}>✏️ EDIT</button>
                <button type="button" className={btn} disabled={Boolean(o.tracking) || busy === o.id} onClick={() => void book(o)}>{busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '🚚'} {o.tracking ? 'BOOKED' : 'BOOK STEADFAST'}</button>
                <button type="button" className={btn + ' bg-white/10'} onClick={() => print('invoice', [o])}>🧾 INVOICE</button>
                <button type="button" className={btn + ' bg-white/10'} onClick={() => print('sticker', [o])}>🏷️ STICKER</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- delivery & courier + printing
const COURIERS: Array<[string, string, string]> = [
  ['steadfast', 'Steadfast', 'Book parcels from ROSE (works now)'],
  ['pathao', 'Pathao', 'Save keys now, booking comes next'],
  ['redx', 'RedX', 'Save keys now, booking comes next'],
  ['paperfly', 'Paperfly', 'Save keys now, booking comes next'],
  ['ecourier', 'eCourier', 'Save keys now, booking comes next'],
];
const DeliveryTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [conn, setConn] = useState<string[]>([]);
  const [open, setOpen] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [inside, setInside] = useState(String(store.delivery_inside));
  const [outside, setOutside] = useState(String(store.delivery_outside));
  const [ps, setPs] = useState<PrintSettings>({ stk: '4x6', inv: 'a4', sender: store.name, phone: store.phone, logo: true, cod: true, items: true, bar: true, note: 'Handle with care', ...(store.print_settings || {}) });
  const [msg, setMsg] = useState('');
  const loadConn = useCallback(async () => {
    const { data } = await supabase.rpc('courier_status', { p_store: store.id });
    setConn(((data as Array<{ courier: string }>) || []).map((x) => x.courier));
  }, [store.id]);
  useEffect(() => {
    void loadConn();
  }, [loadConn]);
  const saveKeys = async (c: string, remove = false) => {
    if (!remove && (!key.trim() || !secret.trim())) return setMsg('Paste both keys.');
    const { error } = await supabase.rpc('save_courier_keys', { p_store: store.id, p_courier: c, p_key: remove ? '' : key, p_secret: remove ? '' : secret });
    if (error) return setMsg(error.message);
    setKey(''); setSecret(''); setOpen(''); setMsg(remove ? 'Disconnected.' : 'Connected. Keys are kept on the server only.'); void loadConn();
  };
  const saveStore = async () => {
    const { error } = await supabase.from('stores').update({ delivery_inside: Number(inside) || 0, delivery_outside: Number(outside) || 0, print_settings: ps, updated_at: new Date().toISOString() }).eq('id', store.id);
    setMsg(error ? error.message : 'Saved.');
    if (!error) onSaved();
  };
  const [w, h] = stickerSize(ps);
  const sample: PrintOrder = { order_no: 1001, customer_name: 'Rahim Uddin', phone: '01712345678', address: 'House 12, Road 5, Mirpur 10', upazila: 'Mirpur', district: 'Dhaka', division: 'Dhaka', items: [{ name: 'Sample product', q: 1, price: 450 }], total: 510, delivery: 60, payment_method: 'cod' };
  const scale = Math.min(1, 280 / (w * 3.78));
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">DELIVERY CHARGE</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-400">Inside Dhaka<input className={input} inputMode="numeric" value={inside} onChange={(e) => setInside(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="text-[11px] text-slate-400">Outside Dhaka<input className={input} inputMode="numeric" value={outside} onChange={(e) => setOutside(e.target.value.replace(/\D/g, ''))} /></label>
        </div>
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">COURIERS</p>
        {COURIERS.map(([id, name, note]) => (
          <div key={id} className="rounded-lg bg-black/30 p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-20 shrink-0 items-center justify-center rounded-md bg-white px-1">
                <img src={`/brand/${id}.png`} alt={name} className="max-h-7 max-w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; const t = e.currentTarget.nextElementSibling as HTMLElement | null; if (t) t.style.display = 'inline'; }} />
                <b className="hidden text-[11px] text-slate-900">{name}</b>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-white">{name} {conn.includes(id) && <span className="text-emerald-400">· CONNECTED</span>}</p>
                <p className="text-[10.5px] text-slate-400">{note}</p>
              </div>
              {conn.includes(id)
                ? <button type="button" className={btn + ' h-8 bg-white/10'} onClick={() => void saveKeys(id, true)}>REMOVE</button>
                : <button type="button" className={btn + ' h-8'} onClick={() => { setOpen(open === id ? '' : id); setKey(''); setSecret(''); }}>CONNECT</button>}
            </div>
            {open === id && (
              <div className="mt-2 space-y-2">
                <input className={input} value={key} onChange={(e) => setKey(e.target.value)} placeholder={`${name} API key`} autoComplete="off" />
                <input className={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={`${name} secret key`} autoComplete="off" />
                <button type="button" className={btn + ' w-full'} onClick={() => void saveKeys(id)}>SAVE & CONNECT</button>
                <p className="text-[10.5px] text-slate-400">Get the keys from your {name} merchant panel. You type them yourself; nobody can read them back, not even staff.</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">INVOICE & STICKER</p>
        <select className={input} value={ps.stk} onChange={(e) => setPs({ ...ps, stk: e.target.value })}>
          {STICKER_SIZES.map((s) => <option key={s[0]} value={s[0]}>Sticker: {s[1]}</option>)}
        </select>
        {ps.stk === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input className={input} inputMode="numeric" value={ps.cw || ''} onChange={(e) => setPs({ ...ps, cw: Number(e.target.value.replace(/\D/g, '')) })} placeholder="Width mm" />
            <input className={input} inputMode="numeric" value={ps.ch || ''} onChange={(e) => setPs({ ...ps, ch: Number(e.target.value.replace(/\D/g, '')) })} placeholder="Height mm" />
          </div>
        )}
        <select className={input} value={ps.inv} onChange={(e) => setPs({ ...ps, inv: e.target.value })}>
          {INVOICE_SIZES.map((s) => <option key={s[0]} value={s[0]}>Invoice: {s[1]}</option>)}
        </select>
        <input className={input} value={ps.sender || ''} onChange={(e) => setPs({ ...ps, sender: e.target.value })} placeholder="Company name on the sticker" />
        <input className={input} value={ps.phone || ''} onChange={(e) => setPs({ ...ps, phone: e.target.value })} placeholder="Sender phone" />
        <input className={input} value={ps.note || ''} onChange={(e) => setPs({ ...ps, note: e.target.value })} placeholder="Bottom note" />
        <div className="grid grid-cols-2 gap-1 text-[12px] text-slate-300">
          {([['logo', 'Logo'], ['cod', 'COD amount'], ['items', 'Product name'], ['bar', 'Barcode']] as Array<[keyof PrintSettings, string]>).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={ps[k] !== false} onChange={(e) => setPs({ ...ps, [k]: e.target.checked })} /> {l}</label>
          ))}
        </div>
        <style>{PRINT_CSS}</style>
        <div className="overflow-hidden rounded-lg bg-slate-200 p-2" style={{ height: Math.round(h * 3.78 * scale + 16) }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }} dangerouslySetInnerHTML={{ __html: stickerHTML(sample, ps, store) }} />
        </div>
        <button type="button" className={btn + ' w-full bg-white/10'} onClick={() => { const e = printOrders('sticker', [sample], ps, store); if (e) setMsg(e); }}>TEST PRINT 1 STICKER</button>
      </div>
      <button type="button" className={btn + ' w-full'} onClick={() => void saveStore()}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};

// ---------------------------------------------------------------- own domain
const DomainTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [domain, setDomain] = useState(store.custom_domain || '');
  const [records, setRecords] = useState<Array<{ type: string; name: string; value: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const call = async (action: 'add' | 'check' | 'remove') => {
    setBusy(true);
    setMsg('');
    const { data, error } = await supabase.functions.invoke('store-domain', { body: { store_id: store.id, domain, action } });
    setBusy(false);
    const err = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j.error).catch(() => error.message) : '');
    if (err) return setMsg(String(err));
    setRecords((data as any)?.records || []);
    setMsg((data as any)?.message || (action === 'remove' ? 'Domain removed.' : 'Done.'));
    if (action === 'remove') setDomain('');
    onSaved();
  };
  const sub = `${store.slug}.myrosebd.com`;
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-1'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">YOUR FREE ADDRESS</p>
        <p className="text-[12.5px] text-white">{store.subdomain_ready ? sub : `myrosebd.com/shop/${store.slug}`}</p>
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">OWN DOMAIN</p>
        <p className="text-[11.5px] text-slate-300">Bought a domain like yourshop.com (Hostinger, Namecheap, GoDaddy or a BD seller)? Connect it here. Your store opens on your own name, and Google shows your own domain.</p>
        <input className={input} value={domain} onChange={(e) => setDomain(e.target.value.trim().toLowerCase())} placeholder="yourshop.com" autoCapitalize="off" />
        {store.custom_domain && (
          <p className={`text-[12px] font-bold ${store.domain_ready ? 'text-emerald-400' : 'text-amber-300'}`}>
            {store.domain_ready ? `✅ LIVE: https://${store.custom_domain}` : `⏳ WAITING FOR DNS: ${store.custom_domain}`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || !domain} onClick={() => void call('add')} className={btn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} CONNECT</button>
          <button type="button" disabled={busy || !store.custom_domain} onClick={() => void call('check')} className={btn + ' bg-white/10'}>CHECK</button>
        </div>
        {records.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-black/30 p-2">
            <p className="text-[11px] text-slate-300">Add these records in your domain's DNS page:</p>
            {records.map((r, i) => (
              <div key={i} className="grid grid-cols-[48px_56px_1fr_auto] items-center gap-1.5 text-[11.5px]">
                <b className="text-teal-300">{r.type}</b>
                <span className="text-slate-300">{r.name}</span>
                <span className="truncate font-mono text-white">{r.value}</span>
                <button type="button" className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white" onClick={() => { void navigator.clipboard?.writeText(r.value); setMsg('Copied'); }}>COPY</button>
              </div>
            ))}
          </div>
        )}
        {store.custom_domain && (
          <button type="button" disabled={busy} onClick={() => void call('remove')} className={btn + ' w-full bg-rose-600/80'}>REMOVE DOMAIN</button>
        )}
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
      <div className={box + ' space-y-1 text-[11.5px] text-slate-300'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">HOW IT WORKS</p>
        <p>1. Write your domain and press CONNECT.</p>
        <p>2. Open the DNS page where you bought it and add the records shown (A for @, CNAME for www).</p>
        <p>3. Wait 10 minutes to a few hours, then press CHECK. When it says LIVE, the free SSL lock is on.</p>
        <p>4. Ask ROSE: "আমার ডোমেইন বসাও" and she guides you step by step.</p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- staff (owner adds by Gmail with a role)
const ROLES: Array<[string, string]> = [
  ['manager', 'Manager · everything except domain & staff'],
  ['orders', 'Orders · see, edit, book courier, print'],
  ['products', 'Products · products, photos, categories'],
  ['support', 'Support · see orders, help customers'],
  ['marketing', 'Marketing · see products for posts & ads'],
  ['accounts', 'Accounts · see orders & sales'],
];
const StaffTab: React.FC<{ store: Store; limit: number }> = ({ store, limit }) => {
  const [list, setList] = useState<Array<{ email: string; role: string }>>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('orders');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_staff').select('email, role').eq('store_id', store.id).order('created_at');
    setList((data as Array<{ email: string; role: string }>) || []);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async () => {
    setMsg('');
    const { error } = await supabase.rpc('add_store_staff', { p_store: store.id, p_email: email, p_role: role });
    if (error) return setMsg(error.message);
    setEmail('');
    setMsg('Added. They log in to ROSE with this Gmail (Continue with Google) and open Workspace → MY STORE.');
    void load();
  };
  const remove = async (e: string) => {
    await supabase.from('store_staff').delete().eq('store_id', store.id).eq('email', e);
    setMsg('Access removed.');
    void load();
  };
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">STAFF · {list.length} / {limit}</p>
        {list.length === 0 && <p className="text-[12px] text-slate-400">No staff yet.</p>}
        {list.map((s) => (
          <div key={s.email} className="flex items-center gap-2 rounded-lg bg-black/30 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-white">{s.email}</p>
              <p className="text-[10.5px] text-teal-300">{s.role.toUpperCase()}</p>
            </div>
            <button type="button" onClick={() => void remove(s.email)} className={btn + ' h-8 bg-white/10'}>REMOVE</button>
          </div>
        ))}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ADD STAFF</p>
        <input className={input} value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="staff@gmail.com" type="email" autoCapitalize="off" />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button type="button" disabled={!email || list.length >= limit} onClick={() => void add()} className={btn + ' w-full'}>GIVE ACCESS</button>
        {list.length >= limit && <p className="text-[11px] text-amber-300">Your plan allows {limit} staff. Upgrade for more.</p>}
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
      <div className={box + ' text-[11.5px] text-slate-300'}>
        Staff see only their part. Courier keys, domain, staff and the plan stay with the owner. When the plan ends, staff access stops too.
      </div>
    </div>
  );
};


// ---------------------------------------------------------------- categories
const CategoriesTab: React.FC<{ store: Store }> = ({ store }) => {
  const [cats, setCats] = useState<Cat[]>([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_categories').select('*').eq('store_id', store.id).order('sort');
    setCats((data as Cat[]) || []);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async () => {
    if (!name.trim()) return;
    await supabase.from('store_categories').insert({ store_id: store.id, name: name.trim(), icon: icon || '🏷️', sort: cats.length });
    setName('');
    void load();
  };
  return (
    <div className="space-y-2">
      <div className={box + ' flex gap-2'}>
        <input className={input + ' w-14 text-center'} value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Icon" />
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
        <button type="button" onClick={() => void add()} className={btn}><Plus className="h-4 w-4" /></button>
      </div>
      {cats.map((c) => (
        <div key={c.id} className={box + ' flex items-center gap-2'}>
          <span className="text-xl">{c.icon}</span>
          <p className="flex-1 text-[12.5px] text-white">{c.name}</p>
          <button type="button" aria-label="Delete" onClick={async () => { if (window.confirm(`Delete ${c.name}? Products stay without a category.`)) { await supabase.from('store_categories').delete().eq('id', c.id); void load(); } }} className="text-rose-300">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- products
const emptyProd = (): Partial<Prod> => ({ name: '', price: 0, old_price: null, stock: 10, emoji: '📦', description: '', images: [], options_label: 'Size', options: [], rx: false, active: true, category_id: null, short_description: '', specs: {} });

const ProductsTab: React.FC<{ store: Store; limit: number }> = ({ store, limit }) => {
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [edit, setEdit] = useState<Partial<Prod> | null>(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [optIn, setOptIn] = useState('');
  const kind = kindOf(store.template);
  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('store_products').select('*').eq('store_id', store.id).order('sort'),
      supabase.from('store_categories').select('*').eq('store_id', store.id).order('sort'),
    ]);
    setProds((p.data as Prod[]) || []);
    setCats((c.data as Cat[]) || []);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!edit) return;
    if (!edit.name?.trim() || !(Number(edit.price) > 0)) return setMsg('Name and price are needed.');
    if (!edit.id && prods.length >= limit) return setMsg(`Your plan allows ${limit} products.`);
    const row = {
      store_id: store.id, name: edit.name.trim(), category_id: edit.category_id || null, price: Number(edit.price),
      old_price: edit.old_price ? Number(edit.old_price) : null, stock: Number(edit.stock) || 0, emoji: edit.emoji || '📦',
      description: edit.description || '', images: (edit.images || []).filter(Boolean),
      options_label: (edit.options || []).filter(Boolean).length ? edit.options_label || 'Size' : '', options: (edit.options || []).filter(Boolean), rx: Boolean(edit.rx), active: edit.active !== false,
      short_description: (edit.short_description || '').slice(0, 160), specs: edit.specs || {},
      updated_at: new Date().toISOString(),
    };
    const { error } = edit.id ? await supabase.from('store_products').update(row).eq('id', edit.id) : await supabase.from('store_products').insert({ ...row, sort: prods.length });
    if (error) return setMsg(error.message);
    setEdit(null);
    setMsg('Saved.');
    void load();
  };

  if (edit) {
    const set = (k: keyof Prod, v: unknown) => setEdit((e) => ({ ...(e || {}), [k]: v }));
    return (
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">{edit.id ? 'EDIT PRODUCT' : 'ADD PRODUCT'}</p>
        <div className="flex gap-2">
          <input className={input + ' w-14 text-center'} value={edit.emoji || ''} onChange={(e) => set('emoji', e.target.value)} aria-label="Icon" />
          <input className={input} value={edit.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Product name" />
        </div>
        <select className={input} value={edit.category_id || ''} onChange={(e) => set('category_id', e.target.value || null)}>
          <option value="">No category</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <input className={input} value={edit.price ?? ''} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="Price" inputMode="decimal" />
          <input className={input} value={edit.old_price ?? ''} onChange={(e) => set('old_price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="Old price" inputMode="decimal" />
          <input className={input} value={edit.stock ?? ''} onChange={(e) => set('stock', e.target.value.replace(/[^\d]/g, ''))} placeholder="Stock" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <p className="text-[10.5px] text-slate-400">Photos · up to 8 · ★ = main photo</p>
          <div className="flex flex-wrap gap-2">
            {(edit.images || []).filter(Boolean).map((u, i) => (
              <div key={u + i} className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 ${i ? 'border-white/10' : 'border-teal-400'}`}>
                <img src={u.startsWith('http') ? u : `https://images.unsplash.com/${u}?w=160&q=60&auto=format&fit=crop`} alt="" className="h-full w-full object-cover" />
                {i > 0 && <button type="button" aria-label="Main photo" onClick={() => { const l = (edit.images || []).filter(Boolean); set('images', [l[i], ...l.filter((_, j) => j !== i)]); }} className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] text-black">★</button>}
                <button type="button" aria-label="Remove photo" onClick={() => set('images', (edit.images || []).filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] text-white">✕</button>
                {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-teal-500 text-center text-[8px] font-bold text-black">MAIN</span>}
              </div>
            ))}
          </div>
          {(edit.images || []).filter(Boolean).length < 8 && (
            <label className={btn + ' w-full cursor-pointer bg-white/10'}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ADD PHOTOS (GALLERY / CAMERA)
              <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
                const room = 8 - (edit.images || []).filter(Boolean).length;
                const files = Array.from(e.target.files || []).slice(0, room);
                e.target.value = '';
                if (!files.length) return;
                setUploading(true);
                setMsg('');
                try {
                  const urls: string[] = [];
                  for (const f of files) urls.push(await uploadImage(store.id, f));
                  setEdit((x) => ({ ...(x || {}), images: [...((x?.images || []).filter(Boolean)), ...urls].slice(0, 8) }));
                } catch (err: any) {
                  setMsg(String(err?.message || err));
                } finally {
                  setUploading(false);
                }
              }} />
            </label>
          )}
        </div>
        <div className="space-y-2 rounded-lg border border-teal-900 bg-teal-950/30 p-2">
          <div className="grid grid-cols-2 gap-2">
            <select className={input} value={edit.options_label || 'Size'} onChange={(e) => set('options_label', e.target.value)}>
              {['Size', 'Colour', 'Weight', 'Pack', 'Model'].map((x) => <option key={x}>{x}</option>)}
            </select>
            <select className={input} value="" onChange={(e) => { const s = SIZE_SETS[Number(e.target.value)]; if (s) { set('options_label', 'Size'); set('options', s[1]); } }}>
              <option value="">Quick pick…</option>
              {SIZE_SETS.map((s, i) => <option key={s[0]} value={i}>{s[0]}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 p-1.5">
            {(edit.options || []).filter(Boolean).map((o, i) => (
              <span key={o + i} className="flex items-center gap-1 rounded-md bg-teal-500 py-0.5 pl-2 pr-0.5 text-[12px] font-bold text-black">
                {o}<button type="button" aria-label={`Remove ${o}`} onClick={() => set('options', (edit.options || []).filter((_, j) => j !== i))} className="flex h-5 w-5 items-center justify-center rounded bg-black/15 text-[10px]">✕</button>
              </span>
            ))}
            <input className="min-w-[110px] flex-1 bg-transparent px-1 py-1 text-[12.5px] text-white outline-none" value={optIn} onChange={(e) => setOptIn(e.target.value)} placeholder="Write, then Enter" onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const add = optIn.split(',').map((x) => x.trim()).filter((x) => x && !(edit.options || []).includes(x));
              if (add.length) set('options', [...(edit.options || []).filter(Boolean), ...add]);
              setOptIn('');
            }} />
          </div>
          <div className="flex flex-wrap gap-1">
            {(QUICK[edit.options_label || 'Size'] || []).filter((x) => !(edit.options || []).includes(x)).map((x) => (
              <button key={x} type="button" onClick={() => set('options', [...(edit.options || []).filter(Boolean), x])} className="rounded-md border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-slate-300">+ {x}</button>
            ))}
          </div>
        </div>
        {kind && (
          <div className="space-y-1.5 rounded-lg border border-blue-900 bg-blue-950/30 p-2">
            <p className="text-[10.5px] font-bold tracking-wider text-blue-300">PRODUCT INFO · shows in the "{kind.tabs[1][1]}" tab</p>
            {kind.specs.map((f) => (
              <input key={f[0]} className={input} value={(edit.specs || {})[f[0]] || ''} onChange={(e) => set('specs', { ...(edit.specs || {}), [f[0]]: e.target.value })} placeholder={`${f[1]} · e.g. ${f[3]}`} />
            ))}
          </div>
        )}
        <textarea className={input} rows={2} maxLength={160} value={edit.short_description || ''} onChange={(e) => set('short_description', e.target.value)} placeholder="Short description · next to the price (max 160)" />
        <p className="-mt-1 text-right text-[10px] text-slate-500">{(edit.short_description || '').length} / 160</p>
        <textarea className={input} rows={5} value={edit.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Long description · material, size chart, care, delivery, return (helps Google)" />
        <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={edit.active !== false} onChange={(e) => set('active', e.target.checked)} /> Show in store</label>
        <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={Boolean(edit.rx)} onChange={(e) => set('rx', e.target.checked)} /> Needs prescription (pharmacy)</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEdit(null)} className={btn + ' bg-white/10'}>CANCEL</button>
          <button type="button" onClick={() => void save()} className={btn}>SAVE</button>
        </div>
        {edit.id && (
          <button type="button" onClick={async () => { if (window.confirm('Delete this product?')) { await supabase.from('store_products').delete().eq('id', edit.id!); setEdit(null); void load(); } }} className="w-full text-[11px] font-bold text-rose-300">
            DELETE PRODUCT
          </button>
        )}
        {msg && <p className="text-[12px] text-rose-300">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => { setMsg(''); setEdit(emptyProd()); }} className={btn + ' w-full'}>
        <Plus className="h-4 w-4" /> ADD PRODUCT
      </button>
      <p className="px-1 text-[11px] text-slate-400">{prods.length} / {limit > 10000 ? 'unlimited' : limit} products. Tip: tell ROSE "add a product" by voice (coming next).</p>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      {prods.map((p) => (
        <button key={p.id} type="button" onClick={() => { setMsg(''); setEdit(p); }} className={box + ' flex w-full items-center gap-2 text-left'}>
          {p.images?.[0] ? <img src={p.images[0].startsWith('http') ? p.images[0] : `https://images.unsplash.com/${p.images[0]}?w=120&q=60&auto=format&fit=crop`} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="text-2xl">{p.emoji}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{p.name}</p>
            <p className="text-[11px] text-slate-400">{tk(Number(p.price))}{p.old_price ? ` (was ${tk(Number(p.old_price))})` : ''} · stock {p.stock}{p.active ? '' : ' · HIDDEN'}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- homepage & design
const DesignTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [s, setS] = useState<Store>(store);
  const [msg, setMsg] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const set = (k: keyof Store, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const setBanner = (i: number, k: keyof Banner, v: string) =>
    setS((x) => ({ ...x, banners: x.banners.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));
  const save = async () => {
    const { error } = await supabase
      .from('stores')
      .update({
        name: s.name, tagline: s.tagline, logo: s.logo, logo_url: s.logo_url || '', color: s.color, accent: s.accent, city: s.city, phone: s.phone, email: s.email,
        address: s.address, licence: s.licence, note: s.note, delivery_inside: Number(s.delivery_inside) || 0,
        delivery_outside: Number(s.delivery_outside) || 0, banners: s.banners, trust: s.trust, pay_numbers: s.pay_numbers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', store.id);
    setMsg(error ? error.message : 'Saved. Open the store to see it.');
    if (!error) onSaved();
  };
  const field = (k: keyof Store, ph: string) => (
    <input className={input} value={(s[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />
  );
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">STORE</p>
        <p className="text-[11px] text-slate-400">LOGO (picture) and NAME are separate.</p>
        <div className="flex items-center gap-2">
          {s.logo_url ? <img src={s.logo_url} alt="Logo" className="h-12 w-12 rounded-lg bg-white object-contain" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-black/30 text-2xl">{s.logo}</span>}
          <label className={btn + ' flex-1 cursor-pointer bg-white/10'}>
            {logoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} UPLOAD LOGO
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setLogoBusy(true);
              try {
                set('logo_url', await uploadImage(store.id, f, 400));
              } catch (err: any) {
                setMsg(String(err?.message || err));
              } finally {
                setLogoBusy(false);
              }
            }} />
          </label>
          {s.logo_url && <button type="button" onClick={() => set('logo_url', '')} className="text-[11px] font-bold text-rose-300">REMOVE</button>}
        </div>
        <div className="flex gap-2">
          <input className={input + ' w-14 text-center'} value={s.logo} onChange={(e) => set('logo', e.target.value)} aria-label="Icon if no logo" />
          {field('name', 'Store name')}
        </div>
        {field('tagline', 'Tagline')}
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          Main colour <input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} />
          Accent <input type="color" value={s.accent} onChange={(e) => set('accent', e.target.value)} />
        </div>
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">BANNERS</p>
        {s.banners.map((b, i) => (
          <div key={i} className="space-y-1 rounded-lg bg-black/30 p-2">
            <div className="flex gap-2">
              <input className={input + ' w-14 text-center'} value={b.icon} onChange={(e) => setBanner(i, 'icon', e.target.value)} aria-label="Icon" />
              <input className={input} value={b.title} onChange={(e) => setBanner(i, 'title', e.target.value)} placeholder="Banner title" />
            </div>
            <input className={input} value={b.badge} onChange={(e) => setBanner(i, 'badge', e.target.value)} placeholder="Offer text (Up to 50% OFF)" />
            <div className="flex items-center gap-2">
              {b.img && <img src={b.img} alt="" className="h-10 w-16 rounded object-cover" />}
              <label className="cursor-pointer text-[11px] font-bold text-teal-300">
                {b.img ? 'CHANGE PHOTO' : '+ BANNER PHOTO'}
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setBanner(i, 'img', await uploadImage(store.id, f, 1400));
                  } catch (err: any) {
                    setMsg(String(err?.message || err));
                  }
                }} />
              </label>
              {b.img && <button type="button" onClick={() => setBanner(i, 'img', '')} className="text-[11px] font-bold text-rose-300">REMOVE</button>}
              <button type="button" onClick={() => set('banners', s.banners.filter((_, j) => j !== i))} className="ml-auto text-[11px] font-bold text-slate-400">DELETE</button>
            </div>
          </div>
        ))}
        {s.banners.length < 4 && (
          <button type="button" onClick={() => set('banners', [...s.banners, { title: 'New offer', badge: 'Shop now', icon: '🎉', bg: `linear-gradient(120deg,#fef3c7,${s.color})` }])} className="text-[11px] font-bold text-teal-300">
            + ADD BANNER
          </button>
        )}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">CONTACT & FOOTER</p>
        {field('phone', 'Phone')}
        {field('email', 'E-mail')}
        {field('address', 'Full address')}
        {field('city', 'City')}
        {field('licence', 'Trade / drug licence no. (optional)')}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">DELIVERY & PAYMENT</p>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={s.delivery_inside} onChange={(e) => set('delivery_inside', e.target.value.replace(/[^\d]/g, ''))} placeholder="Inside Dhaka Tk" inputMode="numeric" />
          <input className={input} value={s.delivery_outside} onChange={(e) => set('delivery_outside', e.target.value.replace(/[^\d]/g, ''))} placeholder="Outside Dhaka Tk" inputMode="numeric" />
        </div>
        {(['bkash', 'nagad', 'rocket'] as const).map((m) => (
          <input key={m} className={input} value={s.pay_numbers?.[m] || ''} onChange={(e) => set('pay_numbers', { ...(s.pay_numbers || {}), [m]: e.target.value })} placeholder={`${m} number (customers send money here)`} inputMode="tel" />
        ))}
        <textarea className={input} rows={2} value={s.note} onChange={(e) => set('note', e.target.value)} placeholder="Delivery note shown on product pages" />
      </div>
      <button type="button" onClick={() => void save()} className={btn + ' w-full'}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};
