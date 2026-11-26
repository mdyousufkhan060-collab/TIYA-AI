import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SettingsBar } from '../settings/SettingsShell';
import { STORE_DURATIONS, STORE_PLANS, tk, type StorePlanId } from '../../utils/storePlans';
import { AdminBrandPage } from '../admin/AdminBrandPage';
import { StoreChatTab } from './RoseChatInbox';
import { INVOICE_SIZES, PRINT_CSS, invoiceDims, kgText, invoicePreviewHTML, STICKER_SIZES, printOrders, stickerHTML, stickerSize, type PrintOrder, type PrintSettings } from '../../utils/storePrint';

/**
 * Workspace > MY STORE: the ROSE Store Builder for the store owner.
 * Pick a demo design, then manage Products, Categories, Orders and Homepage.
 * Access comes from Admin > 21 WEBSITE ACCESS (or the 5-day free trial).
 */
type Access = { plan: StorePlanId; ends_at: string; stores_limit: number; products_limit: number } | null;
type Store = {
  id: string; owner_id?: string; slug: string; name: string; tagline: string; logo: string; logo_url: string; color: string; accent: string; template: string;
  city: string; phone: string; email: string; address: string; licence: string; note: string;
  name_bn?: string; email2?: string; whatsapp?: string; phone2?: string; pixels?: Record<string, string>; chat_ai?: boolean;
  delivery_inside: number; delivery_outside: number; delivery_kg_inside?: number; delivery_kg_outside?: number; banners: Banner[]; trust: string[]; offer_banners?: OfferBanner[];
  pay_numbers: Record<string, string>; published: boolean; suspended: boolean; print_settings: PrintSettings; subdomain_ready?: boolean; custom_domain?: string | null; domain_ready?: boolean; seo?: Record<string, string>;
};
/** Courier charge: base up to 1 kg, then each started extra kg (same as the server). */
const delByKg = (base: number, perKg: number, kg: number) => (base || 0) + (kg > 1 ? Math.ceil(kg - 1 - 1e-9) * (perKg || 0) : 0);
type Banner = { title: string; badge: string; icon: string; bg?: string; img?: string };
type OfferBanner = { img: string; title?: string; link?: string };
type Cat = { id: string; name: string; icon: string; sort: number };
type Prod = {
  id: string; name: string; category_id: string | null; price: number; old_price: number | null; stock: number; emoji: string;
  description: string; images: string[]; options_label: string; options: string[]; rx: boolean; active: boolean;
  short_description: string; specs: Record<string, string>; cost_price?: number; on_offer?: boolean; sort?: number; weight_kg?: number | string;
};
type Order = {
  id: string; order_no: number; customer_name: string; phone: string; address: string; area: string;
  items: Array<{ name: string; q: number; price: number; opt?: string; kg?: number }>; weight_kg?: number; total: number; payment_method: string; trx_id: string; status: string; created_at: string; payment_status?: string; pay_proof?: string | null; paid_amount?: number | null;
  email: string; division: string; district: string; upazila: string; courier: string; tracking: string; note: string; subtotal: number; delivery: number; courier_cost?: number;
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
type KindOpt = { labels: string[]; sets: Array<[string, string[]]>; quick: Record<string, string[]> };
/** Option names and quick picks that fit the shop (food: portion, medicine: pack, grocery: weight...). */
const optOf = (k: Kind | null): KindOpt =>
  ((k as any)?.opt as KindOpt) || { labels: ['Size', 'Colour', 'Weight', 'Pack', 'Model'], sets: SIZE_SETS, quick: QUICK };
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
/** Image size hints shown next to every upload. Any size works: ROSE shrinks it. */
export const IMG_HINT = {
  product: 'Best 1000 × 1000 px (square). Any size works: ROSE makes it small and fast, it still looks sharp.',
  logo: 'Best 400 × 400 px, PNG with a clear background.',
  banner: 'Best 1600 × 600 px (wide). Big photos are made small by themselves.',
};
/**
 * Phone photo -> sharp, small WebP in the store's own folder; returns the public link.
 * Big photos (5-20 MB) become about 80-250 KB: scaled down in steps (keeps details), quality 0.85.
 */
export async function uploadImage(storeId: string, file: File, max = 1200): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error('Choose a photo (JPG, PNG or WebP).');
  if (file.size > 40 * 1024 * 1024) throw new Error('This photo is too big (over 40 MB).');
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read the photo'));
    i.src = url;
  });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * k));
  const H = Math.max(1, Math.round(img.height * k));
  // step down by halves for a sharp result, then the final size
  let src: CanvasImageSource = img;
  let w = img.width;
  let h = img.height;
  while (w / 2 > W && h / 2 > H) {
    const c2 = document.createElement('canvas');
    c2.width = Math.round(w / 2);
    c2.height = Math.round(h / 2);
    const x2 = c2.getContext('2d')!;
    x2.imageSmoothingQuality = 'high';
    x2.drawImage(src, 0, 0, c2.width, c2.height);
    src = c2;
    w = c2.width;
    h = c2.height;
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, W, H);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not convert the photo'))), 'image/webp', 0.85));
  const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from('store-media').upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('store-media').getPublicUrl(path).data.publicUrl;
}

/** Web address from a name. People often type a domain ("Tazumart BD.com", "www.tazumarbd.com.bd"):
 *  the www, http and the ending (.com, .com.bd, .net, .shop …) are dropped, so the address is tazumarbd.myrosebd.com. */
export const slugify = (t: string) =>
  t
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\.(com|net|org|info|shop|store|online|site|xyz|biz|co)(\.bd)?$|\.(bd|com\.bd)$/, '')
    .replace(/\.myrosebd$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
/** Names that cannot become yourshop.myrosebd.com (site pages, mail, demo stores). */
export const RESERVED_SLUGS = ['www', 'app', 'api', 'admin', 'mail', 'webmail', 'shop', 'demos', 'demo', 'autodiscover', 'autoconfig', 'ftp', 'cpanel', 'ns1', 'ns2', 'rose', 'help', 'support', 'blog', 'foodbazaar', 'fashionhub', 'sotadari', 'shopshotoi', 'homenest', 'medicare', 'printpack'];

export const StorePanel: React.FC<{ userId: string; forceStoreId?: string; startTab?: 'viewas' }> = ({ userId, forceStoreId, startTab }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<Access>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [tab, setTab] = useState<'home' | 'dashboard' | 'orders' | 'products' | 'categories' | 'design' | 'customers' | 'reviews' | 'payments' | 'delivery' | 'print' | 'seo' | 'domain' | 'staff' | 'rose' | 'plan' | 'company' | 'reports' | 'expenses' | 'pixels' | 'chat' | 'offers' | 'create' | 'viewas'>(startTab || 'home');
  const [roles, setRoles] = useState<Record<string, string>>({});
  // owner can look at the admin the way a staff role sees it (nothing opens or saves in this view)
  const [previewRole, setPreviewRole] = useState('');
  // MY STAFF (WORKSPACE): the owner's staff list, and the one being looked at
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [staffSel, setStaffSel] = useState<StaffRow | null>(null);
  const [myMoney, setMyMoney] = useState<Record<string, boolean>>({});
  const [, setShowRose] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: adm }, { data: acc }, { data: st }, d, { data: mine }, { data: flags }] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('my_website_access'),
      forceStoreId ? supabase.from('stores').select('*').eq('id', forceStoreId) : supabase.from('stores').select('*').eq('owner_id', userId).order('created_at'),
      loadDemos(),
      forceStoreId ? Promise.resolve({ data: [] as unknown[] }) : supabase.rpc('my_staff_stores'),
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
    if (staffRows.length) {
      // a MANAGER may also have MONEY ACCESS (the owner turns it on)
      const { data: me } = await supabase.auth.getUser();
      const { data: mm } = await supabase.from('store_staff').select('store_id, money_access').eq('email', (me.user?.email || '').toLowerCase());
      const m: Record<string, boolean> = {};
      ((mm as Array<{ store_id: string; money_access: boolean }>) || []).forEach((x) => { m[x.store_id] = x.money_access; });
      setMyMoney(m);
    }
    setShowRose(!((flags as Array<{ key: string; value: unknown }>) || []).some((f) => f.key === 'store_admin_rose_card' && f.value === false));
    setIsAdmin(Boolean(adm));
    setAccess(acc && (acc as any).email ? (acc as Access) : null);
    const list = [...((st as Store[]) || []), ...staffStores];
    setStores(list);
    setStore((cur) => (cur ? list.find((x) => x.id === cur.id) || list[0] || null : list[0] || null));
    setDemos(d);
    setLoading(false);
  }, [userId, forceStoreId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (tab !== 'viewas' || !store?.id) return;
    void supabase.rpc('store_staff_list', { p_store: store.id }).then(({ data }) => setStaffList((data as StaffRow[]) || []));
  }, [tab, store?.id]);

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
  const realRole = roles[store.id] && store.owner_id !== userId && !isAdmin ? roles[store.id] : 'owner';
  const myRole = previewRole || realRole;
  // what each staff role may open (the server enforces the same rules)
  const ROLE_AREAS: Record<string, string[]> = {
    manager: ['orders', 'ordersWrite', 'chat', 'products', 'categories', 'design', 'marketing', 'reviews', 'coupons', 'customers'],
    moderator: ['orders', 'products', 'reviews', 'customers'],
    support: ['orders', 'productsView', 'chat', 'customers'],
  };
  const areasOf = (r: string, money: boolean) => [...(ROLE_AREAS[r] || []), ...(r === 'manager' && money ? ['money'] : [])];
  const myMoneyOn = previewRole ? Boolean(staffSel?.money_access) : Boolean(myMoney[store.id]);
  const can = (area: string) => myRole === 'owner' || (area !== 'owner' && areasOf(myRole, myMoneyOn).includes(area));

  // the bars a role sees in WEBSITE ADMIN (same rules as the server)
  const barsFor = (r: string, money = false) => {
    const c = (area: string) => r === 'owner' || (area !== 'owner' && areasOf(r, money).includes(area));
    return (
      [
            [true, 'dashboard', 'DASHBOARD', '📊', '#1d4ed8', 'TODAY'],
            [c('owner') && !isAdmin, 'plan', 'PLAN & PAYMENT', '⭐', '#f59e0b', access ? `${STORE_PLANS[access.plan]?.label || access.plan} · ${new Date(access.ends_at).toLocaleDateString('en-GB')}` : 'BUY'],
            [c('orders'), 'orders', 'ORDERS', '🧾', '#7c3aed', ''],
            [c('products') || c('productsView'), 'products', 'PRODUCTS', '📦', '#0d9488', ''],
            [c('categories'), 'categories', 'CATEGORIES', '🗂️', '#ca8a04', ''],
            [c('design'), 'design', 'HOMEPAGE & DESIGN', '🎨', '#db2777', 'BANNERS'],
            [c('customers'), 'customers', 'CUSTOMERS', '👥', '#2563eb', ''],
            [c('coupons'), 'offers', 'OFFERS & COUPONS', '🏷️', '#ea580c', ''],
            [c('reviews'), 'reviews', 'REVIEWS', '⭐', '#eab308', ''],
            [c('chat'), 'chat', 'LIVE CHAT', '💬', '#059669', 'ROSE'],
            [r === 'owner', 'payments', 'PAYMENTS', '💳', '#4f46e5', ''],
            [c('design'), 'delivery', 'DELIVERY & COURIER', '🚚', '#b45309', ''],
            [c('ordersWrite'), 'print', 'INVOICE & STICKER', '🏷️', '#e11d48', 'PRINT'],
            [c('marketing'), 'pixels', 'TRACKING & PIXELS', '📈', '#0284c7', 'ADS'],
            [c('marketing'), 'seo', 'SEO', '🔍', '#16a34a', 'GOOGLE'],
            [c('owner'), 'staff', 'STAFF', '👤', '#9333ea', ''],
            [c('owner'), 'domain', 'DOMAIN', '🌐', '#0891b2', store.custom_domain ? (store.domain_ready ? 'LIVE' : 'WAITING') : 'LINK'],
            [c('money'), 'reports', 'REPORTS', '📑', '#64748b', 'MONTH'],
      ] as Array<[boolean, string, string, string, string, string]>
    ).filter((x) => x[0]);
  };
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
      previewRole ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/10 p-3">
          <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-sky-200">👁️ {staffSel?.email || 'STAFF'} · {previewRole.toUpperCase()} · their view</p>
          <button type="button" className={btn} onClick={() => { setPreviewRole(''); setTab('viewas'); }}>EXIT</button>
        </div>
      ) : tab === 'viewas' ? (
        staffSel ? (
          <button type="button" onClick={() => setStaffSel(null)} className="px-1 text-[11px] font-bold tracking-wider text-teal-400">‹ ALL STAFF</button>
        ) : null
      ) : (
        <button type="button" onClick={() => setTab('home')} className="px-1 text-[11px] font-bold tracking-wider text-teal-400">
          ‹ {store.name.toUpperCase()}
        </button>
      )
    );
    return (
      <div className="space-y-3">
        {back}
        {tab === 'dashboard' && <DashboardTab store={store} seeOrders={can('orders') || can('money')} onOpen={(t) => setTab(t as typeof tab)} />}
        {tab === 'customers' && <CustomersTab store={store} />}
        {tab === 'viewas' && realRole !== 'owner' && <p className="px-1 text-[12px] text-amber-300">Only the shop owner can see this.</p>}
        {tab === 'viewas' && realRole === 'owner' && !staffSel && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-bold tracking-wider text-teal-300">MY STAFF · {staffList.length}</p>
            {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
            {staffList.length === 0 && (
              <div className={box}>
                <p className="text-[12px] text-slate-300">No staff yet. Add staff in 03 WEBSITE ADMIN → STAFF. They show here by themselves.</p>
              </div>
            )}
            {staffList.map((s2) => (
              <button key={s2.email} type="button" onClick={() => { setMsg(""); setStaffSel(s2); }} className="mb-1.5 flex h-[58px] w-full items-center gap-2.5 rounded-xl border border-[#1e293b] bg-[#11151e] px-2.5 text-left transition-colors hover:border-teal-500/40">
                <StaffFace s={s2} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-slate-100">{s2.email}</span>
                  <span className="block text-[10.5px] font-bold tracking-wider">
                    <span className="text-teal-300">{s2.role.toUpperCase()}</span>
                    {s2.suspended && <span className="text-rose-300"> · SUSPENDED</span>}
                    {s2.role === 'manager' && s2.money_access && !s2.suspended && <span className="text-amber-300"> · MONEY</span>}
                  </span>
                </span>
                <span className="text-base text-slate-600">›</span>
              </button>
            ))}
            <p className="px-1 pt-3 text-[11px] font-bold tracking-wider text-teal-300">ROLES · WHAT EACH ONE CAN OPEN</p>
            {([['manager', '🧑‍💼', '#38bdf8'], ['moderator', '🛡️', '#a78bfa'], ['support', '🎧', '#34d399']] as Array<[string, string, string]>).map(([rk, ic, col], i) => (
              <DemoBar key={rk} n={i + 1} icon={ic} color={col} title={rk.toUpperCase()} value={`${barsFor(rk).length} BARS`} onClick={() => setStaffSel({ email: rk.toUpperCase(), role: rk, suspended: false, money_access: false, isRole: true })} testId={`role-${rk}`} />
            ))}
          </div>
        )}
        {tab === 'viewas' && realRole === 'owner' && staffSel && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-teal-500/30 bg-teal-500/5 p-2.5">
              {staffSel.isRole ? <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-sky-700 text-xl">👥</span> : <StaffFace s={staffSel} size={42} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{staffSel.isRole ? `${staffSel.role.toUpperCase()} ROLE` : staffSel.email}</span>
                <span className="block text-[11px] font-bold tracking-wider">
                  <span className="text-teal-300">{staffSel.role.toUpperCase()}</span>
                  {!staffSel.isRole && <span className={staffSel.suspended ? 'text-rose-300' : 'text-emerald-300'}>{staffSel.suspended ? ' · SUSPENDED' : ' · ACTIVE'}</span>}
                  {staffSel.role === 'manager' && staffSel.money_access && <span className="text-amber-300"> · MONEY</span>}
                </span>
              </span>
            </div>
            {!staffSel.isRole && (
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className={btn + ' h-9'} style={{ background: staffSel.suspended ? '#0d9488' : '#d97706' }}
                  onClick={async () => {
                    const next = !staffSel.suspended;
                    const { error } = await supabase.rpc('set_store_staff', { p_store: store.id, p_email: staffSel.email, p_suspended: next });
                    if (error) return setMsg(error.message);
                    setStaffSel({ ...staffSel, suspended: next });
                    setStaffList((l) => l.map((x) => (x.email === staffSel.email ? { ...x, suspended: next } : x)));
                    setMsg(next ? `${staffSel.email} is SUSPENDED. They cannot open anything now.` : `${staffSel.email} is ACTIVE again.`);
                  }}>
                  {staffSel.suspended ? '▶ RESUME' : '⏸ SUSPEND'}
                </button>
                <button type="button" className={btn + ' h-9'} style={{ background: '#e11d48' }}
                  onClick={async () => {
                    if (!window.confirm(`Remove ${staffSel.email}? Their access is deleted everywhere at once. You can add the same Gmail again later in 03 WEBSITE ADMIN → STAFF.`)) return;
                    const { error } = await supabase.from('store_staff').delete().eq('store_id', store.id).eq('email', staffSel.email);
                    if (error) return setMsg(error.message);
                    setStaffList((l) => l.filter((x) => x.email !== staffSel.email));
                    setMsg(`${staffSel.email} is removed. To give access again, add the Gmail in 03 WEBSITE ADMIN → STAFF.`);
                    setStaffSel(null);
                  }}>
                  ✕ REMOVE
                </button>
              </div>
            )}
            {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
            {staffSel.suspended && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-2.5 text-[11.5px] text-rose-200">
                SUSPENDED · these bars are closed for them now. Tap RESUME to open them again.
              </div>
            )}
            <p className="px-1 pt-1 text-[11px] font-bold tracking-wider text-slate-400">THE BARS THEY SEE · {barsFor(staffSel.role, staffSel.money_access).length} OF {barsFor('owner').length}</p>
            <div className={staffSel.suspended ? 'opacity-50' : ''}>
              {barsFor(staffSel.role, staffSel.money_access).map(([, k, title, icon, color, value]) => (
                <DemoBar key={k} n={barsFor('owner').findIndex((x) => x[1] === k) + 1} icon={icon} color={color} title={title} value={value} onClick={() => { setPreviewRole(staffSel.role); setTab(k as typeof tab); }} testId={`staff-job-${k}`} />
              ))}
            </div>
            <p className="px-1 text-[11px] text-slate-500">Same bars and numbers as your WEBSITE ADMIN. Tap one to see it the way they see it · EXIT brings you back here</p>
          </div>
        )}
        {tab === 'reviews' && <ReviewsTab store={store} />}
        {tab === 'payments' && <PaymentsTab store={store} onSaved={() => void load()} />}
        {tab === 'print' && <DeliveryTab store={store} part="print" onSaved={() => void load()} />}
        {tab === 'seo' && <SeoTab store={store} onSaved={() => void load()} />}
        {tab === 'orders' && <OrdersTab store={store} readOnly={!can('ordersWrite')} />}
        {tab === 'products' && <ProductsTab store={store} limit={isAdmin ? 100000 : access?.products_limit || 50} canEdit={can('products')} canDelete={myRole === 'owner'} />}
        {tab === 'categories' && <CategoriesTab store={store} />}
        {tab === 'design' && <DesignTab store={store} onSaved={() => void load()} />}
        {tab === 'delivery' && <DeliveryTab store={store} part="delivery" onSaved={() => void load()} />}
        {tab === 'domain' && <DomainTab store={store} onSaved={() => void load()} />}
        {tab === 'staff' && <StaffTab store={store} limit={isAdmin ? 50 : access?.staff_limit || 0} />}
        {tab === 'rose' && <AdminBrandPage />}
        {tab === 'plan' && <BuyPlan current={access || undefined} onPaid={() => void load()} />}
        {tab === 'company' && <CompanyTab store={store} onSaved={() => void load()} />}
        {tab === 'reports' && <ReportsWithExpenses store={store} />}
        {tab === 'expenses' && <ExpensesTab store={store} />}
        {tab === 'pixels' && <PixelsTab store={store} onSaved={() => void load()} />}
        {tab === 'chat' && <StoreChatTab store={store} />}
        {tab === 'offers' && <OffersWithCoupons store={store} limit={isAdmin ? 100000 : access?.products_limit || 50} onSaved={() => void load()} />}
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
      {header}
      {previewRole ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-400/50 bg-sky-500/10 p-3">
          <p className="min-w-0 flex-1 text-[12px] font-bold text-sky-200">👁️ {staffSel ? staffSel.email : 'VIEW AS'} · {previewRole.toUpperCase()} · these are the only bars they see</p>
          <button type="button" className={btn} onClick={() => { setPreviewRole(''); setTab(staffSel ? 'viewas' : 'home'); }}>EXIT</button>
        </div>
      ) : (
        myRole !== 'owner' && <p className="px-1 text-[11px] font-bold text-amber-300">You are STAFF here · role: {myRole.toUpperCase()}</p>
      )}
      <div>
        {barsFor(myRole).map(([, k, title, icon, color, value], i) => (
            <DemoBar key={k} n={i + 1} icon={icon} color={color} title={title} value={value} onClick={() => setTab(k as typeof tab)} testId={`store-${k}`} />
          ))}
        {can('owner') && !forceStoreId && stores.length < limit && <SettingsBar badge="+" title="NEW STORE" onClick={() => setTab('create')} testId="store-new" />}
      </div>
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

// ---------------------------------------------------------------- reports & profit (date range)
type Report = {
  orders: number; by_status: Record<string, number>; sales: number; delivery_collected: number; cod_collected: number; cod_waiting: number; pipeline: number;
  cogs: number; courier_cost: number; return_loss: number; expenses: Record<string, number>; expenses_total: number; products: number; stock: number; stock_value: number;
  missing_cost: number; months: Array<{ mon: string; orders: number; sales: number; gross: number }>;
};
const EXP_KINDS: Array<[string, string]> = [
  ['purchase', 'Product purchase'], ['packaging', 'Packaging'], ['courier', 'Courier bill'], ['facebook_ads', 'Facebook ads'], ['tiktok_ads', 'TikTok ads'],
  ['google_ads', 'Google ads'], ['other_ads', 'Other ads'], ['office', 'Office'], ['salary', 'Salary / staff'], ['rent', 'Rent'], ['other', 'Other'],
];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const RANGES: Array<[string, string]> = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7', '7 days'], ['30', '30 days'], ['180', '6 months'], ['365', '1 year'], ['custom', 'Custom']];
const rangeOf = (k: string): [string, string] => {
  const t = new Date();
  if (k === 'today') return [ymd(t), ymd(t)];
  if (k === 'yesterday') { const y = new Date(t.getTime() - 864e5); return [ymd(y), ymd(y)]; }
  return [ymd(new Date(t.getTime() - (Number(k) - 1) * 864e5)), ymd(t)];
};
const ReportsTab: React.FC<{ store: Store }> = ({ store }) => {
  const [range, setRange] = useState('30');
  const [from, setFrom] = useState(rangeOf('30')[0]);
  const [to, setTo] = useState(rangeOf('30')[1]);
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (range !== 'custom') { const [a, b] = rangeOf(range); setFrom(a); setTo(b); }
  }, [range]);
  useEffect(() => {
    setErr('');
    void supabase.rpc('store_report', { p_store: store.id, p_from: from, p_to: to }).then(({ data, error }) => {
      if (error) setErr(error.message); else setR(data as Report);
    });
  }, [store.id, from, to]);
  const gross = r ? r.sales - r.cogs : 0;
  const net = r ? gross + r.delivery_collected - r.courier_cost - r.expenses_total : 0;
  const card = (label: string, v: string | number, tone = 'text-white', sub = '') => (
    <div className="rounded-lg bg-black/30 p-2">
      <p className="text-[10px] font-bold tracking-wider text-slate-400">{label}</p>
      <p className={`text-[16px] font-extrabold ${tone}`}>{v}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
  const st = r?.by_status || {};
  const done = (st.delivered || 0) + (st.returned || 0);
  const maxSale = Math.max(1, ...(r?.months || []).map((m) => m.sales));
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <div className="flex flex-wrap gap-1">
          {RANGES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setRange(k)} className={`rounded-md px-2 py-1 text-[11px] font-bold ${range === k ? 'bg-teal-600 text-white' : 'bg-white/10 text-slate-300'}`}>{l}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10.5px] text-slate-400">From<input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-[10.5px] text-slate-400">To<input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        <p className="text-[10.5px] text-slate-400">{from} → {to}</p>
      </div>
      {err && <p className="text-[12px] text-rose-300">{err}</p>}
      {r && (
        <>
          <div className={box + ' space-y-2'}>
            <p className="text-[11px] font-bold tracking-wider text-teal-300">PROFIT & LOSS</p>
            <div className="grid grid-cols-2 gap-2">
              {card('SALES (DELIVERED)', tk(r.sales))}
              {card('PRODUCT COST', tk(r.cogs), 'text-slate-200', r.missing_cost ? `${r.missing_cost} products have no purchase price` : '')}
              {card('GROSS PROFIT', tk(gross), gross >= 0 ? 'text-emerald-300' : 'text-rose-300')}
              {card('DELIVERY CHARGE TAKEN', tk(r.delivery_collected))}
              {card('COURIER COST', tk(r.courier_cost), 'text-slate-200', r.return_loss ? `returns cost ${tk(r.return_loss)}` : '')}
              {card('OTHER EXPENSES', tk(r.expenses_total))}
            </div>
            <div className={`rounded-lg p-3 ${net >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
              <p className="text-[10.5px] font-bold tracking-wider text-slate-300">{net >= 0 ? 'NET PROFIT' : 'NET LOSS'}</p>
              <p className={`text-[22px] font-extrabold ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{tk(Math.abs(net))}</p>
              <p className="text-[10px] text-slate-400">Sales − product cost + delivery charge − courier cost − expenses. Only DELIVERED orders count as sales.</p>
            </div>
          </div>
          <div className={box + ' space-y-2'}>
            <p className="text-[11px] font-bold tracking-wider text-teal-300">ORDERS · {r.orders}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUSES.map((s) => card(s.toUpperCase(), st[s] || 0))}
              {card('SUCCESS', done ? `${Math.round(((st.delivered || 0) / done) * 100)}%` : '-', 'text-emerald-300')}
            </div>
          </div>
          <div className={box + ' space-y-2'}>
            <p className="text-[11px] font-bold tracking-wider text-teal-300">MONEY</p>
            <div className="grid grid-cols-2 gap-2">
              {card('COD COLLECTED', tk(r.cod_collected))}
              {card('COD WITH COURIER', tk(r.cod_waiting), 'text-amber-300', 'shipped, not delivered yet')}
              {card('ORDERS IN PROGRESS', tk(r.pipeline))}
              {card('STOCK VALUE', tk(r.stock_value), 'text-white', `${r.stock} pcs · ${r.products} products`)}
            </div>
          </div>
          {Object.keys(r.expenses).length > 0 && (
            <div className={box + ' space-y-1'}>
              <p className="text-[11px] font-bold tracking-wider text-teal-300">EXPENSES</p>
              {Object.entries(r.expenses).map(([k, v]) => (
                <p key={k} className="flex text-[12px] text-slate-300"><span className="flex-1">{EXP_KINDS.find((x) => x[0] === k)?.[1] || k}</span><b>{tk(v)}</b></p>
              ))}
            </div>
          )}
          {r.months.length > 1 && (
            <div className={box + ' space-y-2'}>
              <p className="text-[11px] font-bold tracking-wider text-teal-300">MONTH BY MONTH</p>
              {r.months.map((m) => (
                <div key={m.mon} className="space-y-0.5">
                  <p className="flex text-[11px] text-slate-300"><span className="flex-1">{m.mon} · {m.orders} orders</span><span>{tk(m.sales)} · profit {tk(m.gross)}</span></p>
                  <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-teal-500" style={{ width: `${(m.sales / maxSale) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- expenses & purchases
const ExpensesTab: React.FC<{ store: Store }> = ({ store }) => {
  const [list, setList] = useState<Array<{ id: string; kind: string; amount: number; spent_on: string; supplier: string; note: string }>>([]);
  const [f, setF] = useState({ kind: 'purchase', amount: '', spent_on: ymd(new Date()), supplier: '', note: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_expenses').select('*').eq('store_id', store.id).order('spent_on', { ascending: false }).limit(100);
    setList((data as typeof list) || []);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async () => {
    const amount = Number(f.amount);
    if (!(amount > 0)) return setMsg('Write the amount.');
    const { error } = await supabase.from('store_expenses').insert({ store_id: store.id, kind: f.kind, amount, spent_on: f.spent_on, supplier: f.supplier.trim(), note: f.note.trim() });
    if (error) return setMsg(error.message);
    setF((x) => ({ ...x, amount: '', supplier: '', note: '' }));
    setMsg('Added.');
    void load();
  };
  const del = async (id: string) => {
    await supabase.from('store_expenses').delete().eq('id', id);
    void load();
  };
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ADD EXPENSE OR PURCHASE</p>
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {EXP_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className={input} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Amount Tk" inputMode="decimal" />
          <input className={input} type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} />
          <input className={input} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder={f.kind === 'purchase' ? 'Supplier name' : 'Paid to (optional)'} />
        </div>
        <input className={input} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note (e.g. 50 T-shirts, invoice no.)" />
        <button type="button" onClick={() => void add()} className={btn + ' w-full'}>ADD</button>
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
        <p className="text-[10.5px] text-slate-400">Tip: set each product's PURCHASE PRICE in 02 PRODUCTS, and the courier charge on each order, for a correct profit. Then add here only extra costs (ads, packaging, rent, salary).</p>
      </div>
      <div className={box + ' space-y-1'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">RECENT · {list.length}</p>
        {list.length === 0 && <p className="text-[12px] text-slate-400">Nothing yet.</p>}
        {list.map((x) => (
          <div key={x.id} className="flex items-center gap-2 rounded-lg bg-black/30 p-2 text-[12px]">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">{EXP_KINDS.find((k) => k[0] === x.kind)?.[1] || x.kind} · {tk(x.amount)}</p>
              <p className="truncate text-[10.5px] text-slate-400">{x.spent_on}{x.supplier ? ` · ${x.supplier}` : ''}{x.note ? ` · ${x.note}` : ''}</p>
            </div>
            <button type="button" onClick={() => void del(x.id)} className="text-[11px] font-bold text-rose-300">DELETE</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Facebook Pixel, Google Analytics 4, TikTok Pixel
const PIXELS: Array<[string, string, RegExp, string, string]> = [
  ['fb', 'FACEBOOK (META) PIXEL ID', /^\d{10,20}$/, '123456789012345', 'business.facebook.com → Events Manager → Data sources → your Pixel → copy the number'],
  ['ga4', 'GOOGLE ANALYTICS 4 · MEASUREMENT ID', /^G-[A-Z0-9]{4,15}$/, 'G-XXXXXXXXXX', 'analytics.google.com → Admin → Data streams → Web → Measurement ID'],
  ['tiktok', 'TIKTOK PIXEL ID', /^[A-Z0-9]{10,30}$/, 'CXXXXXXXXXXXXXXXXXXX', 'ads.tiktok.com → Tools → Events → Web events → your Pixel → copy the ID'],
];
const PixelsTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [v, setV] = useState<Record<string, string>>((store.pixels as Record<string, string>) || {});
  const [msg, setMsg] = useState('');
  const save = async () => {
    const clean: Record<string, string> = {};
    for (const [k, label, re] of PIXELS) {
      const x = (v[k] || '').trim().toUpperCase();
      if (!x) continue;
      if (!re.test(x)) return setMsg(`${label}: this ID does not look right.`);
      clean[k] = x;
    }
    const { error } = await supabase.from('stores').update({ pixels: clean, updated_at: new Date().toISOString() }).eq('id', store.id);
    setMsg(error ? error.message : 'Saved. Open your store once, then check Test Events in Facebook / Realtime in Google / TikTok.');
    if (!error) onSaved();
  };
  return (
    <div className="space-y-2">
      {PIXELS.map(([k, label, re, ph, how]) => {
        const x = (v[k] || '').trim().toUpperCase();
        return (
          <div key={k} className={box + ' space-y-1'}>
            <p className="text-[11px] font-bold tracking-wider text-teal-300">{label} {x && (re.test(x) ? <span className="text-emerald-300">· READY</span> : <span className="text-rose-300">· CHECK</span>)}</p>
            <input className={input} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value.trim() })} placeholder={ph} autoCapitalize="characters" />
            <p className="text-[10.5px] text-slate-400">{how}</p>
          </div>
        );
      })}
      <button type="button" onClick={() => void save()} className={btn + ' w-full'}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      <p className="px-1 text-[10.5px] text-slate-400">Your store sends these events by itself: PageView, ViewContent (product page), AddToCart, InitiateCheckout, Purchase (with the order total in BDT).</p>
    </div>
  );
};

// ---------------------------------------------------------------- company info (owner changes it any time; admin gets a notice)
const CompanyTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [s, setS] = useState({
    name: store.name || '', name_bn: store.name_bn || '', email: store.email || '', email2: store.email2 || '',
    whatsapp: store.whatsapp || store.phone || '', phone2: store.phone2 || '', address: store.address || '', city: store.city || '', licence: store.licence || '',
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
    <label className="block text-[10.5px] font-bold tracking-wide text-slate-400">
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
    <div className={box + ' space-y-2.5'}>
      <p className="text-[11px] font-bold tracking-wider text-teal-300">SHOP DETAILS</p>
      <div className="grid grid-cols-2 gap-2">
        {row('name', 'NAME (ENGLISH)', 'Rahim Fashion')}
        {row('name_bn', 'NAME (BANGLA)', 'রহিম ফ্যাশন')}
        {row('email', 'GMAIL 1', '', 'email')}
        {row('email2', 'GMAIL 2', 'optional', 'email')}
        {row('whatsapp', 'WHATSAPP', '01XXXXXXXXX', 'numeric')}
        {row('phone2', 'OTHER PHONE', 'optional', 'numeric')}
      </div>
      <label className="block text-[10.5px] font-bold tracking-wide text-slate-400">
        ADDRESS
        <input className={input + ' mt-1'} value={s.address} onChange={(e) => set('address', e.target.value)} placeholder="House, road, area" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {row('city', 'CITY / DISTRICT')}
        {row('licence', 'LICENCE NO.', 'optional')}
      </div>
      <button type="button" onClick={() => void save()} className={btn + ' w-full'}>SAVE</button>
      {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
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
const OrdersTab: React.FC<{ store: Store; readOnly?: boolean }> = ({ store, readOnly = false }) => {
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
      address: String(edit.address).trim(), note: edit.note || '', items: edit.items, subtotal: sub, delivery: del, total: sub + del, courier_cost: Number(edit.courier_cost) || 0, updated_at: new Date().toISOString(),
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
        <label className="block text-[10.5px] text-slate-400">
          Courier charge you pay for this parcel (for profit)
          <input className={input + ' mt-1'} inputMode="numeric" value={edit.courier_cost ?? ''} onChange={(e) => set('courier_cost', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 60 inside Dhaka, 110 outside" />
        </label>
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
          <p className="text-[11px] text-slate-300">{o.items.map((i) => `${i.name}${i.opt ? ` (${i.opt})` : ''} ×${i.q}`).join(', ')}{Number(o.weight_kg) > 0 ? ` · ⚖️ ${kgText(Number(o.weight_kg))}` : ''}</p>
          <p className="text-[10.5px] text-slate-500">{o.payment_method.toUpperCase()}{o.trx_id ? ` · TrxID ${o.trx_id}` : ''}{o.email ? ` · ${o.email}` : ''} · {new Date(o.created_at).toLocaleString('en-GB')}</p>
          {o.trx_id && (
            <p className="text-[10.5px]">
              <b className={o.payment_status === 'paid' ? 'text-emerald-300' : o.payment_status === 'partial' ? 'text-amber-300' : 'text-sky-300'}>
                {o.payment_status === 'paid' ? `✅ PAID ৳${o.paid_amount ?? ''} · checked by ROSE` : o.payment_status === 'partial' ? `⚠️ PART PAID ৳${o.paid_amount ?? ''}` : '⏳ PAYMENT CHECKING · no SMS yet'}
              </b>
              {o.pay_proof && <button type="button" className="ml-2 font-bold text-teal-300 underline" onClick={async () => { const { data } = await supabase.storage.from('pay-proofs').createSignedUrl(o.pay_proof as string, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank'); }}>SCREENSHOT</button>}
            </p>
          )}
          {o.tracking && <p className="text-[11px] text-emerald-300">🚚 {o.courier} · {o.tracking}</p>}
          {open === o.id && (
            <div className="space-y-2 pt-2">
              {readOnly ? (
                <p className="text-[11px] font-bold text-amber-300">STATUS: {o.status.toUpperCase()} · your role can only see orders</p>
              ) : (
              <select className={input} value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                {!readOnly && <button type="button" className={btn + ' bg-white/10'} onClick={() => { setMsg(''); setEdit({ ...o, items: o.items.map((x) => ({ ...x })) }); }}>✏️ EDIT</button>}
                {!readOnly && <button type="button" className={btn} disabled={Boolean(o.tracking) || busy === o.id} onClick={() => void book(o)}>{busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '🚚'} {o.tracking ? 'BOOKED' : 'BOOK STEADFAST'}</button>}
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
const DeliveryTab: React.FC<{ store: Store; onSaved: () => void; part?: 'delivery' | 'print' }> = ({ store, onSaved, part = 'delivery' }) => {
  const [note, setNote] = useState(store.note || '');
  const [conn, setConn] = useState<string[]>([]);
  const [open, setOpen] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [inside, setInside] = useState(String(store.delivery_inside));
  const [outside, setOutside] = useState(String(store.delivery_outside));
  const [kgIn, setKgIn] = useState(String(store.delivery_kg_inside ?? 15));
  const [kgOut, setKgOut] = useState(String(store.delivery_kg_outside ?? 25));
  const [ps, setPs] = useState<PrintSettings>({ stk: '100x70', inv: 'a4', photos: true, sender: store.name, phone: store.phone, logo: true, cod: true, items: true, bar: true, note: 'Handle with care', ...(store.print_settings || {}) });
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
    const { error } = await supabase.from('stores').update({ delivery_inside: Number(inside) || 0, delivery_outside: Number(outside) || 0, delivery_kg_inside: Number(kgIn) || 0, delivery_kg_outside: Number(kgOut) || 0, note, print_settings: ps, updated_at: new Date().toISOString() }).eq('id', store.id);
    setMsg(error ? error.message : 'Saved.');
    if (!error) onSaved();
  };
  const [w, h] = stickerSize(ps);
  const sample: PrintOrder = { order_no: 1001, customer_name: 'Rahim Uddin', phone: '01712345678', address: 'House 12, Road 5, Mirpur 10', upazila: 'Mirpur', district: 'Dhaka', division: 'Dhaka', items: [{ name: 'Sample product', q: 1, price: 450 }], total: 510, delivery: 60, payment_method: 'cod' };
  const scale = Math.min(1, 280 / (w * 3.78));
  return (
    <div className="space-y-2">
      {part === 'delivery' && (<>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">DELIVERY CHARGE BY WEIGHT</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-400">Inside Dhaka · up to 1 kg<input className={input} inputMode="numeric" value={inside} onChange={(e) => setInside(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="text-[11px] text-slate-400">Outside Dhaka · up to 1 kg<input className={input} inputMode="numeric" value={outside} onChange={(e) => setOutside(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="text-[11px] text-slate-400">Inside · each extra kg<input className={input} inputMode="numeric" value={kgIn} onChange={(e) => setKgIn(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="text-[11px] text-slate-400">Outside · each extra kg<input className={input} inputMode="numeric" value={kgOut} onChange={(e) => setKgOut(e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        <table className="w-full text-[11px] text-slate-300">
          <thead><tr className="text-slate-500"><td>Parcel</td><td>Inside Dhaka</td><td>Outside Dhaka</td></tr></thead>
          <tbody>{[0.5, 1, 1.5, 2, 3, 5].map((wt) => <tr key={wt}><td>{kgText(wt)}</td><td>{delByKg(Number(inside), Number(kgIn), wt)} Tk</td><td>{delByKg(Number(outside), Number(kgOut), wt)} Tk</td></tr>)}</tbody>
        </table>
        <p className="text-[10.5px] text-slate-400">The store adds up the weight of the whole cart and charges the customer from this table. 1.2 kg counts as 2 kg, like the couriers count. Put a weight on every product (PRODUCTS → edit → WEIGHT).</p>
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
        <p className="text-[11px] font-bold tracking-wider text-teal-300">DELIVERY NOTE</p>
        <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown on product pages, e.g. Delivery in 1–3 days" />
      </div>
      </>)}
      {part === 'print' && (
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
          {([['logo', 'Logo'], ['cod', 'COD amount'], ['items', 'Product name'], ['bar', 'Barcode'], ['photos', 'Product photos on invoice']] as Array<[keyof PrintSettings, string]>).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={ps[k] !== false} onChange={(e) => setPs({ ...ps, [k]: e.target.checked })} /> {l}</label>
          ))}
        </div>
        <input className={input} value={ps.terms || ''} onChange={(e) => setPs({ ...ps, terms: e.target.value })} placeholder="Invoice terms (e.g. 7-day return with this invoice)" />
        <p className="text-[10.5px] text-slate-400">Your logo, name, WhatsApp, bKash number, emails and address come on the invoice and sticker by themselves (HOMEPAGE & DESIGN, MY DETAILS). Best sticker: 100 × 70 mm.</p>
        <style>{PRINT_CSS}</style>
        <p className="text-[11px] font-bold tracking-wider text-slate-300">INVOICE PREVIEW · {invoiceDims(ps.inv)[2]}</p>
        <div dangerouslySetInnerHTML={{ __html: invoicePreviewHTML(sample, ps, store, 280) }} />
        <p className="text-[10.5px] text-slate-400">{invoiceDims(ps.inv)[1] ? `Prints on ${invoiceDims(ps.inv)[2]} paper. If the print window shows another paper (Letter), change Paper size to ${(ps.inv || 'a4').toUpperCase()}.` : 'For a POS roll printer. The paper length fits the items by itself.'}</p>
        <button type="button" className={btn + ' w-full bg-white/10'} onClick={() => { const e = printOrders('invoice', [sample], ps, store); if (e) setMsg(e); }}>TEST PRINT 1 INVOICE</button>
        <p className="text-[11px] font-bold tracking-wider text-slate-300">STICKER PREVIEW</p>
        <div className="overflow-hidden rounded-lg bg-slate-200 p-2" style={{ height: Math.round(h * 3.78 * scale + 16) }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }} dangerouslySetInnerHTML={{ __html: stickerHTML(sample, ps, store) }} />
        </div>
        <button type="button" className={btn + ' w-full bg-white/10'} onClick={() => { const e = printOrders('sticker', [sample], ps, store); if (e) setMsg(e); }}>TEST PRINT 1 STICKER</button>
      </div>
      )}
      <button type="button" className={btn + ' w-full'} onClick={() => void saveStore()}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};


// ---------------------------------------------------------------- dashboard (today at a glance)
const DashboardTab: React.FC<{ store: Store; seeOrders: boolean; onOpen: (t: string) => void }> = ({ store, seeOrders, onOpen }) => {
  const [d, setD] = useState<{ today: number; todayTk: number; month: number; monthTk: number; fresh: number; prods: number; low: Array<{ name: string; stock: number }> } | null>(null);
  useEffect(() => {
    void (async () => {
      const now = new Date();
      const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const mon0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [{ data: o }, { data: p }] = await Promise.all([
        seeOrders ? supabase.from('store_orders').select('total,status,created_at').eq('store_id', store.id).gte('created_at', mon0).limit(5000) : Promise.resolve({ data: [] as unknown[] }),
        supabase.from('store_products').select('name,stock,active').eq('store_id', store.id).limit(5000),
      ]);
      const rows = ((o as Array<{ total: number; status: string; created_at: string }>) || []).filter((x) => x.status !== 'cancelled');
      const t = rows.filter((x) => x.created_at >= day0);
      const prods = ((p as Array<{ name: string; stock: number; active: boolean }>) || []).filter((x) => x.active);
      setD({
        today: t.length, todayTk: t.reduce((a, x) => a + Number(x.total || 0), 0), month: rows.length, monthTk: rows.reduce((a, x) => a + Number(x.total || 0), 0),
        fresh: rows.filter((x) => x.status === 'new').length, prods: prods.length, low: prods.filter((x) => Number(x.stock) <= 3).slice(0, 8),
      });
    })();
  }, [store.id, seeOrders]);
  if (!d) return <p className="px-1 text-xs text-slate-400">Loading…</p>;
  const tile = (label: string, value: string, go?: string) => (
    <button type="button" onClick={() => go && onOpen(go)} className="rounded-xl border border-white/[0.08] bg-[#11151E] p-3 text-left">
      <p className="text-[10px] font-bold tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-white">{value}</p>
    </button>
  );
  return (
    <div className="space-y-2">
      {seeOrders && (
        <div className="grid grid-cols-2 gap-2">
          {tile('ORDERS TODAY', String(d.today), 'orders')}
          {tile('SALES TODAY', tk(d.todayTk), 'orders')}
          {tile('NEW · NOT CONFIRMED', String(d.fresh), 'orders')}
          {tile('THIS MONTH', `${d.month} · ${tk(d.monthTk)}`, 'orders')}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {tile('PRODUCTS ON SALE', String(d.prods), 'products')}
        {tile('LOW STOCK (3 OR LESS)', String(d.low.length), 'products')}
      </div>
      {d.low.length > 0 && (
        <div className={box + ' space-y-1'}>
          <p className="text-[11px] font-bold tracking-wider text-amber-300">LOW STOCK</p>
          {d.low.map((x) => <p key={x.name} className="flex justify-between text-[12px] text-slate-200"><span className="truncate">{x.name}</span><b>{x.stock}</b></p>)}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- customers (from the orders)
const CustomersTab: React.FC<{ store: Store }> = ({ store }) => {
  const [rows, setRows] = useState<Array<{ name: string; phone: string; email: string; district: string; n: number; spent: number; last: string }> | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    void supabase.from('store_orders').select('customer_name,phone,email,district,total,status,created_at').eq('store_id', store.id).order('created_at', { ascending: false }).limit(5000).then(({ data }) => {
      const m = new Map<string, { name: string; phone: string; email: string; district: string; n: number; spent: number; last: string }>();
      ((data as Array<{ customer_name: string; phone: string; email: string; district: string; total: number; status: string; created_at: string }>) || []).forEach((o) => {
        const k = o.phone || o.email || o.customer_name;
        const c = m.get(k) || { name: o.customer_name, phone: o.phone, email: o.email || '', district: o.district || '', n: 0, spent: 0, last: o.created_at };
        c.n += 1;
        if (o.status !== 'cancelled' && o.status !== 'returned') c.spent += Number(o.total || 0);
        m.set(k, c);
      });
      setRows([...m.values()]);
    });
  }, [store.id]);
  if (!rows) return <p className="px-1 text-xs text-slate-400">Loading…</p>;
  const f = q.trim().toLowerCase();
  const list = f ? rows.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.district}`.toLowerCase().includes(f)) : rows;
  return (
    <div className="space-y-2">
      <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${rows.length} customers: name, phone, district`} />
      {list.length === 0 && <p className="px-1 text-[12px] text-slate-400">No customers yet. Everyone who orders comes here by themselves.</p>}
      {list.slice(0, 300).map((c) => (
        <div key={c.phone + c.name} className={box + ' flex items-center gap-2'}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{c.name}</p>
            <p className="truncate text-[11px] text-slate-400">{c.phone}{c.district ? ` · ${c.district}` : ''} · last {new Date(c.last).toLocaleDateString('en-GB')}</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-bold text-teal-300">{tk(c.spent)}</p>
            <p className="text-[10.5px] text-slate-400">{c.n} order{c.n > 1 ? 's' : ''}</p>
          </div>
          {c.phone && <a href={`https://wa.me/88${c.phone}`} target="_blank" rel="noreferrer" className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">WA</a>}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- reviews (buyers write, the shop checks and replies)
const ReviewsTab: React.FC<{ store: Store }> = ({ store }) => {
  type Rev = { id: string; product_id: string | null; name: string; stars: number; body: string; reply: string; approved: boolean; created_at: string; order_no: number | null };
  const [rows, setRows] = useState<Rev[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [{ data: r, error }, { data: p }] = await Promise.all([
      supabase.from('store_reviews').select('id,product_id,name,stars,body,reply,approved,created_at,order_no').eq('store_id', store.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('store_products').select('id,name').eq('store_id', store.id).limit(5000),
    ]);
    if (error) setMsg(error.message);
    const m: Record<string, string> = {};
    ((p as Array<{ id: string; name: string }>) || []).forEach((x) => { m[x.id] = x.name; });
    setNames(m);
    setRows((r as Rev[]) || []);
  }, [store.id]);
  useEffect(() => { void load(); }, [load]);
  const patch = async (id: string, v: Partial<Rev>, note: string) => {
    const { error } = await supabase.from('store_reviews').update(v).eq('id', id);
    setMsg(error ? error.message : note);
    void load();
  };
  if (!rows) return <p className="px-1 text-xs text-slate-400">Loading…</p>;
  const waiting = rows.filter((x) => !x.approved).length;
  const avg = rows.filter((x) => x.approved).reduce((a, x, _i, all) => a + x.stars / all.length, 0);
  return (
    <div className="space-y-2">
      <p className="px-1 text-[12px] text-slate-300">{rows.length} reviews · {waiting} waiting · average {avg ? avg.toFixed(1) : '–'} ★. Only buyers can write (the server checks their order phone). A review shows on the store after you press SHOW.</p>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      {rows.map((x) => (
        <ReviewRow key={x.id} x={x} product={x.product_id ? names[x.product_id] || 'Product' : 'Store'}
          onToggle={() => void patch(x.id, { approved: !x.approved }, x.approved ? 'Hidden from the store.' : 'Now shown on the store.')}
          onReply={(t) => void patch(x.id, { reply: t.slice(0, 400) }, 'Reply saved.')}
          onDelete={() => { if (window.confirm('Delete this review?')) void supabase.from('store_reviews').delete().eq('id', x.id).then(() => void load()); }} />
      ))}
      {rows.length === 0 && <p className="px-1 text-[12px] text-slate-400">No reviews yet. After an order, buyers can review the product on the product page.</p>}
    </div>
  );
};
const ReviewRow: React.FC<{ x: { name: string; stars: number; body: string; reply: string; approved: boolean; created_at: string; order_no: number | null }; product: string; onToggle: () => void; onReply: (t: string) => void; onDelete: () => void }> = ({ x, product, onToggle, onReply, onDelete }) => {
  const [rep, setRep] = useState(x.reply || '');
  return (
    <div className={box + ' space-y-1.5'}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white">{x.name} · <span className="text-amber-300">{'★'.repeat(x.stars)}</span></p>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${x.approved ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-black'}`}>{x.approved ? 'SHOWN' : 'WAITING'}</span>
      </div>
      <p className="text-[11px] text-slate-400">{product}{x.order_no ? ` · order #${x.order_no}` : ''} · {new Date(x.created_at).toLocaleDateString('en-GB')}</p>
      <p className="text-[12.5px] text-slate-200">{x.body}</p>
      <input className={input} value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Reply from the shop (optional)" />
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className={btn} onClick={onToggle}>{x.approved ? 'HIDE' : 'SHOW'}</button>
        <button type="button" className={btn + ' bg-white/10'} onClick={() => onReply(rep)}>SAVE REPLY</button>
        <button type="button" className={btn + ' bg-rose-600/80'} onClick={onDelete}>DELETE</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- payments (owner only: where the money goes)
const PaymentsTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => (
  <div className="space-y-2">
    <PaySetup value={store.pay_numbers || {}} onChange={() => onSaved()} storeId={store.id} />
  </div>
);

// ---------------------------------------------------------------- SEO (Google search)
const SeoTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [title, setTitle] = useState(store.seo?.title || '');
  const [desc, setDesc] = useState(store.seo?.description || '');
  const [info, setInfo] = useState<{ prods: number; withPic: number; withText: number } | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    void supabase.from('store_products').select('images,description,active').eq('store_id', store.id).limit(5000).then(({ data }) => {
      const p = ((data as Array<{ images: string[]; description: string; active: boolean }>) || []).filter((x) => x.active);
      setInfo({ prods: p.length, withPic: p.filter((x) => (x.images || []).length > 0).length, withText: p.filter((x) => (x.description || '').length >= 40).length });
    });
  }, [store.id]);
  const checks: Array<[string, boolean]> = [
    ['Search title written (30–60 letters)', title.trim().length >= 30 && title.trim().length <= 60],
    ['Search description written (80–160 letters)', desc.trim().length >= 80 && desc.trim().length <= 160],
    ['Logo uploaded', Boolean(store.logo_url)],
    ['Banner with a photo', (store.banners || []).some((b) => b.img)],
    ['At least 5 products', (info?.prods || 0) >= 5],
    ['Every product has a photo', Boolean(info && info.prods > 0 && info.withPic === info.prods)],
    ['Every product has a description (40+ letters)', Boolean(info && info.prods > 0 && info.withText === info.prods)],
    ['Store is published', store.published],
    ['Own address (shop.myrosebd.com or own domain)', Boolean(store.subdomain_ready || store.domain_ready)],
    ['Phone and address in COMPANY INFO', Boolean((store.whatsapp || store.phone) && store.address)],
  ];
  const score = Math.round((checks.filter((c) => c[1]).length / checks.length) * 100);
  const save = async () => {
    const { error } = await supabase.from('stores').update({ seo: { title: title.trim().slice(0, 70), description: desc.trim().slice(0, 180) }, updated_at: new Date().toISOString() }).eq('id', store.id);
    setMsg(error ? error.message : 'Saved. Google reads the new title and description on its next visit.');
    if (!error) onSaved();
  };
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">SEO SCORE · {score} / 100</p>
        {checks.map(([t, ok]) => <p key={t} className={`text-[12px] ${ok ? 'text-emerald-300' : 'text-slate-400'}`}>{ok ? '✓' : '○'} {t}</p>)}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">GOOGLE SEARCH</p>
        <label className="block text-[11px] font-bold text-slate-300">Search title · {title.trim().length} letters
          <input className={input + ' mt-1'} value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} placeholder={`${store.name} · ${store.tagline || 'Online shop in Bangladesh'}`} /></label>
        <label className="block text-[11px] font-bold text-slate-300">Search description · {desc.trim().length} letters
          <textarea className={input + ' mt-1'} rows={3} maxLength={180} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What you sell, where you deliver, how to pay. Example: Cotton T-shirts and polo shirts. Home delivery all over Bangladesh, cash on delivery." /></label>
        <div className="rounded-lg bg-white p-2.5">
          <p className="truncate text-[14px] text-[#1a0dab]">{title.trim() || `${store.name}${store.tagline ? ' · ' + store.tagline : ''}`}</p>
          <p className="truncate text-[11px] text-[#006621]">{store.slug}.myrosebd.com</p>
          <p className="line-clamp-2 text-[11.5px] text-[#545454]">{desc.trim() || `${store.name}: ${store.tagline || 'online shop'}. Home delivery, ${store.city || 'Bangladesh'}.`}</p>
        </div>
        <button type="button" className={btn + ' w-full'} onClick={() => void save()}>SAVE</button>
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
    </div>
  );
};


// ---------------------------------------------------------------- the same bar as the demo admin (number, coloured icon, title, value)
const DemoBar: React.FC<{ n: number | string; icon: string; color: string; title: string; value?: string; onClick: () => void; testId?: string }> = ({ n, icon, color, title, value, onClick, testId }) => (
  <button type="button" onClick={onClick} data-testid={testId} className="mb-1.5 flex h-[50px] w-full items-center gap-2.5 rounded-xl border border-[#1e293b] bg-[#11151e] px-2.5 text-left text-slate-200 transition-colors hover:border-teal-500/40">
    <span className="rounded-md bg-[#1e293b] px-1.5 py-[3px] font-mono text-[10px] font-bold text-teal-400">{typeof n === 'number' ? String(n).padStart(2, '0') : n}</span>
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[17px]" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>{icon}</span>
    <span className="min-w-0 flex-1 truncate text-[12px] font-bold tracking-[0.06em]">{title}</span>
    {value ? <span className="max-w-[45%] truncate text-[10.5px] text-slate-400">{value}</span> : null}
    <span className="text-base text-slate-600">›</span>
  </button>
);

const ReportsWithExpenses: React.FC<{ store: Store }> = ({ store }) => {
  const [part, setPart] = useState<'reports' | 'expenses'>('reports');
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {(['reports', 'expenses'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setPart(k)} className={btn + (part === k ? '' : ' bg-white/10')}>{k === 'reports' ? 'REPORTS & PROFIT' : 'EXPENSES & PURCHASES'}</button>
        ))}
      </div>
      {part === 'reports' ? <ReportsTab store={store} /> : <ExpensesTab store={store} />}
    </div>
  );
};

const OffersWithCoupons: React.FC<{ store: Store; limit: number; onSaved: () => void }> = ({ store, limit, onSaved }) => {
  const [part, setPart] = useState<'offers' | 'coupons'>('offers');
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {(['offers', 'coupons'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setPart(k)} className={btn + (part === k ? '' : ' bg-white/10')}>{k === 'offers' ? 'OFFERS' : 'COUPONS'}</button>
        ))}
      </div>
      {part === 'offers' ? <OffersTab store={store} limit={limit} onSaved={onSaved} /> : <CouponsTab store={store} />}
    </div>
  );
};

const CouponsTab: React.FC<{ store: Store }> = ({ store }) => {
  type Cp = { id: string; code: string; kind: 'pct' | 'tk'; value: number; min_total: number; max_uses: number; used: number; active: boolean; ends_at: string | null };
  const [rows, setRows] = useState<Cp[]>([]);
  const [f, setF] = useState({ code: '', kind: 'pct' as 'pct' | 'tk', value: '', min: '', max: '', ends: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_coupons').select('*').eq('store_id', store.id).order('created_at', { ascending: false });
    setRows((data as Cp[]) || []);
  }, [store.id]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const v = Number(f.value);
    if (code.length < 3) return setMsg('Write a code of 3+ letters or numbers, e.g. EID10.');
    if (!(v > 0) || (f.kind === 'pct' && v > 90)) return setMsg(f.kind === 'pct' ? 'Percent must be 1 to 90.' : 'Write the Tk amount.');
    const { error } = await supabase.from('store_coupons').insert({
      store_id: store.id, code, kind: f.kind, value: v, min_total: Number(f.min) || 0, max_uses: Number(f.max) || 0,
      ends_at: f.ends ? new Date(`${f.ends}T23:59:59`).toISOString() : null,
    });
    if (error) return setMsg(error.message.includes('duplicate') ? 'This code already exists.' : error.message);
    setF({ code: '', kind: 'pct', value: '', min: '', max: '', ends: '' });
    setMsg(`Coupon ${code} is ON. Customers type it at checkout.`);
    void load();
  };
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">NEW COUPON</p>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="Code, e.g. EID10" />
          <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as 'pct' | 'tk' })}>
            <option value="pct">% off</option>
            <option value="tk">Tk off</option>
          </select>
          <input className={input} inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/\D/g, '') })} placeholder={f.kind === 'pct' ? 'Percent (10)' : 'Tk (100)'} />
          <input className={input} inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, '') })} placeholder="Minimum shopping Tk" />
          <input className={input} inputMode="numeric" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, '') })} placeholder="How many times (0 = no limit)" />
          <input className={input} type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} aria-label="Last day" />
        </div>
        <button type="button" className={btn + ' w-full'} onClick={() => void add()}>ADD COUPON</button>
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
      {rows.map((c) => (
        <div key={c.id} className={box + ' flex items-center gap-2'}>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">{c.code} · {c.kind === 'pct' ? `${c.value}% off` : `${tk(c.value)} off`}</p>
            <p className="text-[11px] text-slate-400">
              Used {c.used}{c.max_uses ? ` / ${c.max_uses}` : ''}{c.min_total ? ` · min ${tk(c.min_total)}` : ''}{c.ends_at ? ` · until ${new Date(c.ends_at).toLocaleDateString('en-GB')}` : ''}
            </p>
          </div>
          <Switch on={c.active} label={c.code} onClick={() => void supabase.from('store_coupons').update({ active: !c.active }).eq('id', c.id).then(() => void load())} />
          <button type="button" className="text-[11px] font-bold text-rose-300" onClick={() => { if (window.confirm(`Delete ${c.code}?`)) void supabase.from('store_coupons').delete().eq('id', c.id).then(() => void load()); }}>DELETE</button>
        </div>
      ))}
      {rows.length === 0 && <p className="px-1 text-[12px] text-slate-400">No coupons yet. Customers type the code at checkout; the server checks it and lowers the total.</p>}
    </div>
  );
};

// ---------------------------------------------------------------- my details (WORKSPACE: second bar for website owners and staff)
export const SiteProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const [me, setMe] = useState<{ email: string; name: string; pic: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [own, setOwn] = useState<Store | null | undefined>(undefined);
  const [staffOf, setStaffOf] = useState<Array<{ name: string; role: string }>>([]);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const md = (u.user?.user_metadata || {}) as Record<string, string>;
    setMe({ email: u.user?.email || '', name: md.full_name || md.name || '', pic: md.avatar_url || md.picture || '' });
    const [{ data: st }, { data: sf }] = await Promise.all([
      supabase.from('stores').select('*').eq('owner_id', userId).order('created_at').limit(1),
      supabase.rpc('my_staff_stores'),
    ]);
    setOwn(((st as Store[]) || [])[0] || null);
    const rows = (sf as Array<{ store_id: string; role: string }>) || [];
    if (rows.length) {
      const { data: names } = await supabase.from('stores').select('id,name').in('id', rows.map((x) => x.store_id));
      const m = new Map(((names as Array<{ id: string; name: string }>) || []).map((x) => [x.id, x.name]));
      setStaffOf(rows.map((x) => ({ name: m.get(x.store_id) || 'Store', role: x.role })));
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  const setPassword = async () => {
    if (pw.length < 8) return setMsg('Password needs at least 8 characters.');
    if (pw !== pw2) return setMsg('The two passwords are not the same.');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPw(''); setPw2('');
    setMsg(error ? error.message : 'Password saved.');
  };
  if (!me || own === undefined) return <p className="px-1 text-xs text-slate-400">Loading…</p>;
  const sid = (own as (Store & { support_code?: string }) | null)?.support_code || '';
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-3'}>
        <div className="flex items-center gap-3">
          {me.pic ? <img src={me.pic} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-600 text-xl font-bold text-white">{(me.name || me.email).charAt(0).toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            {me.name && <p className="truncate text-[15px] font-bold text-white">{me.name}</p>}
            <p className="truncate text-[12px] text-slate-400">{me.email}</p>
            <p className="mt-0.5 text-[10.5px] font-bold tracking-wider text-teal-300">{own ? 'STORE OWNER' : staffOf.length ? `STAFF · ${staffOf.map((x) => `${x.name} · ${x.role.toUpperCase()}`).join(', ')}` : ''}</p>
          </div>
        </div>
        {sid && (
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(sid); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="flex w-full items-center justify-between rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-left">
            <span>
              <span className="block text-[10px] font-bold tracking-wider text-teal-300">SUPPORT ID</span>
              <span className="block font-mono text-[17px] font-bold tracking-widest text-white">{sid}</span>
            </span>
            <span className="text-[10.5px] font-bold text-teal-200">{copied ? 'COPIED ✓' : 'COPY'}</span>
          </button>
        )}
      </div>
      {own && <CompanyTab store={own} onSaved={() => void load()} />}
      <div className={box}>
        <button type="button" onClick={() => setPwOpen(!pwOpen)} className="flex w-full items-center justify-between text-left">
          <span className="text-[11px] font-bold tracking-wider text-teal-300">PASSWORD</span>
          <span className="text-[11px] text-slate-400">{pwOpen ? 'CLOSE' : 'SET ›'}</span>
        </button>
        {pwOpen && (
          <div className="mt-2 space-y-2">
            <input className={input} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" />
            <input className={input} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" />
            <button type="button" className={btn + ' w-full'} onClick={() => void setPassword()}>SAVE PASSWORD</button>
          </div>
        )}
        {msg && <p className="mt-2 text-[12px] text-teal-200">{msg}</p>}
      </div>
      <button type="button" className="h-10 w-full rounded-lg border border-rose-500/40 text-[11px] font-bold text-rose-300" onClick={() => { if (window.confirm('Log out from ROSE on this phone?')) void supabase.auth.signOut(); }}>LOG OUT</button>
    </div>
  );
};

// ---------------------------------------------------------------- ROSE admin: open any shop by its support ID (server allows admin only)
export const AdminSupportOpen: React.FC = () => {
  const [code, setCode] = useState('');
  const [shop, setShop] = useState<{ id: string; name: string; slug: string; owner_email: string; support_code: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    setMsg('');
    const { data, error } = await supabase.rpc('admin_store_by_code', { p_code: code });
    setBusy(false);
    if (error) return setMsg(error.message);
    const d = data as { ok: boolean; id: string; name: string; slug: string; owner_email: string; support_code: string };
    if (!d?.ok) return setMsg('No shop has this ID. Check the number and try again.');
    setShop(d);
  };
  if (shop)
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{shop.name} · {shop.support_code}</p>
            <p className="truncate text-[11px] text-amber-200">Owner {shop.owner_email} · you are working as ROSE admin</p>
          </div>
          <button type="button" className={btn + ' bg-white/10'} onClick={() => { setShop(null); setCode(''); }}>CLOSE</button>
        </div>
        <StorePanel userId="" forceStoreId={shop.id} />
      </div>
    );
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">OPEN A SHOP BY SUPPORT ID</p>
        <p className="text-[11.5px] text-slate-400">The owner finds the ID under their Gmail in WORKSPACE. Only ROSE admin can open a shop with it.</p>
        <input className={input + ' font-mono uppercase tracking-wider'} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RS-123456" onKeyDown={(e) => { if (e.key === 'Enter') void open(); }} />
        <button type="button" disabled={busy || code.replace(/\D/g, '').length < 6} className={btn + ' w-full'} onClick={() => void open()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} OPEN SHOP</button>
        {msg && <p className="text-[12px] text-rose-300">{msg}</p>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- own domain
const DomainTab: React.FC<{ store: Store; onSaved: () => void }> = ({ store, onSaved }) => {
  const [domain, setDomain] = useState(store.custom_domain || '');
  const BASE_DNS = [
    { type: 'A', name: '@', value: '216.198.79.1' },
    { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
  ];
  const [records, setRecords] = useState<Array<{ type: string; name: string; value: string }>>(BASE_DNS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const call = async (action: 'add' | 'check' | 'remove') => {
    setBusy(true);
    setMsg('');
    const { data, error } = await supabase.functions.invoke('store-domain', { body: { store_id: store.id, domain, action } });
    setBusy(false);
    const err = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j.error).catch(() => error.message) : '');
    if (err) return setMsg(String(err));
    setRecords((data as any)?.records?.length ? (data as any).records : BASE_DNS);
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
            {store.domain_ready ? `✅ LIVE: https://${store.custom_domain}` : `⏳ WAITING: ${store.custom_domain} · add the DNS records below`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || !domain} onClick={() => void call('add')} className={btn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} CONNECT</button>
          <button type="button" disabled={busy || !store.custom_domain} onClick={() => void call('check')} className={btn + ' bg-white/10'}>CHECK</button>
        </div>
        {records.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-black/30 p-2">
            <p className="text-[11px] font-bold tracking-wider text-teal-300">DNS RECORDS · add these where you bought the domain</p>
            <div className="grid grid-cols-[48px_56px_1fr_auto] gap-1.5 text-[10px] font-bold tracking-wider text-slate-500"><span>TYPE</span><span>NAME</span><span>VALUE</span><span /></div>
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
        <p>2. Open the DNS page where you bought it and add the 2 records above: A (name @) and CNAME (name www). Delete any old A record for @ first. TTL: leave as it is.</p>
        <p className="text-slate-400">Hostinger: Domains → your domain → DNS / Nameservers → DNS records. Namecheap: Domain List → Manage → Advanced DNS. GoDaddy: My Products → DNS.</p>
        <p>3. Wait 10 minutes to a few hours, then press CHECK. When it says LIVE, the free SSL lock is on.</p>
        <p>4. Ask ROSE: "আমার ডোমেইন বসাও" and she guides you step by step.</p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- staff (owner adds by Gmail with a role)
const ROLES: Array<[string, string]> = [
  ['manager', 'Manager · runs the shop: orders, products, design, chat'],
  ['moderator', 'Moderator · adds and edits products, checks reviews'],
  ['support', 'Support · chats with customers, sees order status'],
];
type StaffRow = { email: string; role: string; suspended: boolean; money_access: boolean; isRole?: boolean; added_at?: string; name?: string; pic?: string; joined?: boolean };
const StaffFace: React.FC<{ s: StaffRow; size?: number }> = ({ s, size = 36 }) =>
  s.pic ? (
    <img src={s.pic} alt="" referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>{s.email.charAt(0).toUpperCase()}</span>
  );
const StaffTab: React.FC<{ store: Store; limit: number }> = ({ store, limit }) => {
  const [list, setList] = useState<StaffRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('store_staff_list', { p_store: store.id });
    if (error) return setMsg(error.message);
    setList((data as StaffRow[]) || []);
  }, [store.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const add = async () => {
    setMsg('');
    setBusy('add');
    const { error } = await supabase.rpc('add_store_staff', { p_store: store.id, p_email: email, p_role: role });
    setBusy('');
    if (error) return setMsg(error.message);
    setEmail('');
    setMsg('Access given. Send them this link: www.myrosebd.com/app?open=store · they tap Continue with Google with this Gmail and the shop admin opens.');
    void load();
  };
  const change = async (e: string, patch: { p_role?: string; p_suspended?: boolean; p_money?: boolean }) => {
    setBusy(e);
    const { error } = await supabase.rpc('set_store_staff', { p_store: store.id, p_email: e, ...patch });
    setBusy('');
    setMsg(error ? error.message : patch.p_suspended === true ? `${e} is SUSPENDED. They cannot open anything now.` : patch.p_suspended === false ? `${e} is ACTIVE again.` : 'Saved. It works at once.');
    void load();
  };
  const remove = async (e: string) => {
    if (!window.confirm(`Remove ${e}? Their access stops at once.`)) return;
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
          <div key={s.email} className={'space-y-2 rounded-lg p-2 ' + (s.suspended ? 'bg-rose-950/40' : 'bg-black/30')}>
            <div className="flex items-center gap-2">
              <StaffFace s={s} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-white">{s.email}</p>
                <p className="text-[10.5px] font-bold tracking-wider">
                  <span className="text-teal-300">{s.role.toUpperCase()}</span>
                  <span className={s.suspended ? 'text-rose-300' : 'text-emerald-300'}> · {s.suspended ? 'SUSPENDED' : 'ACTIVE'}</span>
                  {!s.joined && <span className="text-slate-500"> · NOT SIGNED IN YET</span>}
                </p>
              </div>
            </div>
            <select className={input} value={s.role} disabled={busy === s.email} onChange={(e) => void change(s.email, { p_role: e.target.value })}>
              {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {s.role === 'manager' && (
              <label className="flex items-center gap-2 text-[12px] text-slate-200">
                <input type="checkbox" checked={s.money_access} disabled={busy === s.email} onChange={(e) => void change(s.email, { p_money: e.target.checked })} />
                MONEY ACCESS · reports, expenses, payment SMS
              </label>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" disabled={busy === s.email} onClick={() => void change(s.email, { p_suspended: !s.suspended })} className={btn + ' h-8'} style={{ background: s.suspended ? '#0d9488' : '#d97706' }}>{s.suspended ? '▶ RESUME' : '⏸ SUSPEND'}</button>
              <button type="button" onClick={() => void remove(s.email)} className={btn + ' h-8'} style={{ background: '#e11d48' }}>✕ REMOVE</button>
            </div>
          </div>
        ))}
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ADD STAFF</p>
        <input className={input} value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="staff@gmail.com" type="email" autoCapitalize="off" />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button type="button" disabled={!email || list.length >= limit || busy === 'add'} onClick={() => void add()} className={btn + ' w-full'}>GIVE ACCESS</button>
        {list.length >= limit && <p className="text-[11px] text-amber-300">Your plan allows {limit} staff. Upgrade for more.</p>}
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
      <div className={box + ' text-[11.5px] text-slate-300'}>
        Each staff member signs in with their own Gmail and sees only their part. Money, payments, staff, domain and the plan stay with the owner. SUSPEND or REMOVE stops access at once.
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

const ProductsTab: React.FC<{ store: Store; limit: number; canEdit?: boolean; canDelete?: boolean }> = ({ store, limit, canEdit = true, canDelete = true }) => {
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
      short_description: (edit.short_description || '').slice(0, 160), specs: edit.specs || {}, cost_price: Number(edit.cost_price) || 0, on_offer: Boolean(edit.on_offer), weight_kg: Math.min(1000, Number(edit.weight_kg) || 0),
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
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2">
          <p className="text-[10.5px] font-bold tracking-wider text-amber-300">⚖️ WEIGHT FOR ONE PIECE (KG) · THE COURIER CHARGE COMES FROM THIS</p>
          <input className={input + ' mt-1'} value={edit.weight_kg ?? ''} onChange={(e) => set('weight_kg', e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 0.5 = 500 g" inputMode="decimal" />
          <div className="mt-1 flex flex-wrap gap-1">
            {([['250 g', 0.25], ['500 g', 0.5], ['1 kg', 1], ['2 kg', 2], ['5 kg', 5], ['10 kg', 10]] as Array<[string, number]>).map(([l, v]) => (
              <button key={l} type="button" className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-slate-200" onClick={() => set('weight_kg', String(v))}>{l}</button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Weigh it with the box. If an option has a weight in it (5kg, 1 L), the store uses that option's weight.</p>
        </div>
        <label className="block text-[10.5px] text-slate-400">
          Purchase price (your cost, customers never see it) · for profit reports
          <input className={input + ' mt-1'} value={edit.cost_price ?? ''} onChange={(e) => set('cost_price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 300" inputMode="decimal" />
        </label>
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
                  for (const f of files) urls.push(await uploadImage(store.id, f, 1200));
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
        <p className="px-1 text-[10.5px] text-slate-400">{IMG_HINT.product}</p>
        <div className="space-y-2 rounded-lg border border-teal-900 bg-teal-950/30 p-2">
          <p className="text-[10.5px] font-bold tracking-wider text-teal-300">OPTIONS (optional) · e.g. {optOf(kind).labels.join(', ')}</p>
          <div className="grid grid-cols-2 gap-2">
            <select className={input} value={edit.options_label || optOf(kind).labels[0]} onChange={(e) => set('options_label', e.target.value)}>
              {[...optOf(kind).labels, ...(edit.options_label && !optOf(kind).labels.includes(edit.options_label) ? [edit.options_label] : [])].map((x) => <option key={x}>{x}</option>)}
            </select>
            <select className={input} value="" onChange={(e) => { const s = optOf(kind).sets[Number(e.target.value)]; if (s) set('options', s[1]); }}>
              <option value="">Quick pick…</option>
              {optOf(kind).sets.map((s, i) => <option key={s[0]} value={i}>{s[0]}</option>)}
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
            {(optOf(kind).quick[edit.options_label || optOf(kind).labels[0]] || QUICK[edit.options_label || ''] || []).filter((x) => !(edit.options || []).includes(x)).map((x) => (
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
        <label className="flex items-center gap-2 text-[12px] text-slate-300"><input type="checkbox" checked={Boolean(edit.on_offer)} onChange={(e) => set('on_offer', e.target.checked)} /> Show in OFFERS page (a product with an old price shows there by itself)</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEdit(null)} className={btn + ' bg-white/10'}>CANCEL</button>
          <button type="button" onClick={() => void save()} className={btn}>SAVE</button>
        </div>
        {edit.id && canDelete && (
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
      {canEdit ? (
        <button type="button" onClick={() => { setMsg(''); setEdit({ ...emptyProd(), options_label: optOf(kind).labels[0] }); }} className={btn + ' w-full'}>
          <Plus className="h-4 w-4" /> ADD PRODUCT
        </button>
      ) : (
        <p className="px-1 text-[11.5px] font-bold text-amber-300">View only · prices and stock to tell customers</p>
      )}
      <p className="px-1 text-[11px] text-slate-400">{prods.length} / {limit > 10000 ? 'unlimited' : limit} products. Tip: tell ROSE "add a product" by voice (coming next).</p>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
      {prods.map((p) => (
        <button key={p.id} type="button" onClick={() => { if (!canEdit) return; setMsg(''); setEdit(p); }} className={box + ' flex w-full items-center gap-2 text-left'}>
          {p.images?.[0] ? <img src={p.images[0].startsWith('http') ? p.images[0] : `https://images.unsplash.com/${p.images[0]}?w=120&q=60&auto=format&fit=crop`} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="text-2xl">{p.emoji}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{p.name}</p>
            <p className="text-[11px] text-slate-400">{tk(Number(p.price))}{p.old_price ? ` (was ${tk(Number(p.old_price))})` : ''} · stock {p.stock}{Number(p.weight_kg) > 0 ? ` · ⚖️ ${kgText(Number(p.weight_kg))}` : ''}{p.active ? '' : ' · HIDDEN'}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- offers
/**
 * 14 OFFERS: offer banners for the store's Offers page, plus offer products.
 * Two ways a product shows in Offers: (1) any product with an old price (from 02 PRODUCTS),
 * (2) a product added or marked here (on_offer).
 */
const OffersTab: React.FC<{ store: Store; limit: number; onSaved: () => void }> = ({ store, limit, onSaved }) => {
  const [banners, setBanners] = useState<OfferBanner[]>(store.offer_banners || []);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [add, setAdd] = useState<{ name: string; price: string; old: string; stock: string; cat: string; img: string } | null>(null);
  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('store_products').select('*').eq('store_id', store.id).order('sort'),
      supabase.from('store_categories').select('*').eq('store_id', store.id).order('sort'),
    ]);
    setProds((p.data as Prod[]) || []);
    setCats((c.data as Cat[]) || []);
  }, [store.id]);
  useEffect(() => { void load(); }, [load]);
  const offPct = (p: Prod) => (p.old_price && Number(p.old_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : 0);
  const inOffers = prods.filter((p) => p.on_offer || offPct(p) > 0);
  const others = prods.filter((p) => !p.on_offer && !offPct(p));

  const saveBanners = async (list: OfferBanner[]) => {
    setBanners(list);
    const { error } = await supabase.from('stores').update({ offer_banners: list, updated_at: new Date().toISOString() }).eq('id', store.id);
    setMsg(error ? error.message : 'Offer banners saved.');
    if (!error) onSaved();
  };
  const upload = async (f: File, max: number) => { setBusy('img'); try { return await uploadImage(store.id, f, max); } finally { setBusy(''); } };
  const setOffer = async (p: Prod, on: boolean) => {
    const { error } = await supabase.from('store_products').update({ on_offer: on, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) return setMsg(error.message);
    void load();
  };
  const setPrice = async (p: Prod, price: string, old: string) => {
    const np = Number(price), no = Number(old);
    if (!(np > 0)) return setMsg('Write the offer price.');
    const { error } = await supabase.from('store_products').update({ price: np, old_price: no > np ? no : null, updated_at: new Date().toISOString() }).eq('id', p.id);
    setMsg(error ? error.message : 'Price saved.');
    void load();
  };
  const addProduct = async () => {
    if (!add) return;
    if (!add.name.trim() || !(Number(add.price) > 0)) return setMsg('Name and offer price are needed.');
    if (prods.length >= limit) return setMsg(`Your plan allows ${limit} products.`);
    const np = Number(add.price), no = Number(add.old);
    const { error } = await supabase.from('store_products').insert({
      store_id: store.id, name: add.name.trim(), category_id: add.cat || null, price: np, old_price: no > np ? no : null, stock: Number(add.stock) || 0,
      emoji: '🏷️', images: add.img ? [add.img] : [], description: '', options_label: '', options: [], rx: false, active: true, short_description: '', specs: {},
      on_offer: true, sort: prods.length,
    });
    if (error) return setMsg(error.message);
    setAdd(null);
    setMsg('Offer product added. It also shows in 02 PRODUCTS.');
    void load();
  };

  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">OFFER BANNERS · top of the Offers page</p>
        <p className="text-[10.5px] text-slate-400">{IMG_HINT.banner} Up to 5 banners.</p>
        {banners.map((b, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-white/10 p-2">
            <img src={b.img} alt="" className="aspect-[8/3] w-full rounded-md bg-black/30 object-cover" />
            <input className={input} value={b.title || ''} onChange={(e) => setBanners(banners.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Text on banner (optional), e.g. Eid Sale 30% OFF" />
            <select className={input} value={b.link || ''} onChange={(e) => setBanners(banners.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))}>
              <option value="">Tap opens: nothing</option>
              {inOffers.map((p) => <option key={p.id} value={p.id}>Tap opens: {p.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button type="button" className="text-[11px] font-bold text-teal-300" onClick={() => void saveBanners(banners)}>SAVE</button>
              {i > 0 && <button type="button" className="text-[11px] font-bold text-slate-300" onClick={() => { const l = banners.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; void saveBanners(l); }}>MOVE UP</button>}
              <button type="button" className="ml-auto text-[11px] font-bold text-rose-300" onClick={() => void saveBanners(banners.filter((_, j) => j !== i))}>DELETE</button>
            </div>
          </div>
        ))}
        {banners.length < 5 && (
          <label className={btn + ' cursor-pointer bg-white/10'}>
            {busy === 'img' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} UPLOAD OFFER BANNER
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try { const url = await upload(f, 1600); await saveBanners([...banners, { img: url, title: '' }]); } catch (err: any) { setMsg(String(err?.message || err)); }
            }} />
          </label>
        )}
      </div>

      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">OFFER PRODUCTS · {inOffers.length}</p>
        <p className="text-[10.5px] text-slate-400">A product with an old price (02 PRODUCTS) shows here by itself. You can also add a new offer product here, or put any product in Offers.</p>
        {inOffers.map((p) => <OfferRow key={p.id} p={p} pct={offPct(p)} onPrice={setPrice} onRemove={p.on_offer ? () => void setOffer(p, false) : undefined} />)}
        {!inOffers.length && <p className="text-[12px] text-slate-400">No offer products yet.</p>}
        {add ? (
          <div className="space-y-2 rounded-lg border border-teal-500/40 p-2">
            <p className="text-[11px] font-bold text-teal-300">NEW OFFER PRODUCT</p>
            <div className="flex items-center gap-2">
              {add.img ? <img src={add.img} alt="" className="h-12 w-12 rounded-md object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-md bg-black/30">🏷️</span>}
              <label className={btn + ' flex-1 cursor-pointer bg-white/10'}>
                {busy === 'img' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} PHOTO
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  try { const url = await upload(f, 1200); setAdd((a) => (a ? { ...a, img: url } : a)); } catch (err: any) { setMsg(String(err?.message || err)); }
                }} />
              </label>
            </div>
            <input className={input} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Product name" />
            <select className={input} value={add.cat} onChange={(e) => setAdd({ ...add, cat: e.target.value })}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input className={input} value={add.price} onChange={(e) => setAdd({ ...add, price: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Offer price" inputMode="decimal" />
              <input className={input} value={add.old} onChange={(e) => setAdd({ ...add, old: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Old price" inputMode="decimal" />
              <input className={input} value={add.stock} onChange={(e) => setAdd({ ...add, stock: e.target.value.replace(/[^\d]/g, '') })} placeholder="Stock" inputMode="numeric" />
            </div>
            <div className="flex gap-2">
              <button type="button" className={btn + ' flex-1'} onClick={() => void addProduct()}>ADD TO OFFERS</button>
              <button type="button" className={btn + ' bg-white/10'} onClick={() => setAdd(null)}>CANCEL</button>
            </div>
            <p className="text-[10.5px] text-slate-400">More details (sizes, long description) later from 02 PRODUCTS.</p>
          </div>
        ) : (
          <button type="button" className={btn + ' w-full'} onClick={() => setAdd({ name: '', price: '', old: '', stock: '10', cat: '', img: '' })}><Plus className="h-4 w-4" /> ADD NEW OFFER PRODUCT</button>
        )}
        {others.length > 0 && (
          <select className={input} value="" onChange={(e) => { const p = others.find((x) => x.id === e.target.value); if (p) void setOffer(p, true); }}>
            <option value="">+ Put an existing product in Offers…</option>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name} · {tk(Number(p.price))}</option>)}
          </select>
        )}
      </div>
      {msg && <p className="px-1 text-[12px] text-teal-300">{msg}</p>}
    </div>
  );
};

const OfferRow: React.FC<{ p: Prod; pct: number; onPrice: (p: Prod, price: string, old: string) => void; onRemove?: () => void }> = ({ p, pct, onPrice, onRemove }) => {
  const [price, setPrice] = useState(String(p.price));
  const [old, setOld] = useState(p.old_price ? String(p.old_price) : '');
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
      {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-black/30">{p.emoji}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-white">{p.name}{pct ? <span className="ml-1 rounded bg-rose-600 px-1 text-[10px]">-{pct}%</span> : null}</p>
        <div className="mt-1 flex items-center gap-1">
          <input className={input + ' h-8 px-2 py-1 text-[12px]'} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Offer price" inputMode="decimal" />
          <input className={input + ' h-8 px-2 py-1 text-[12px]'} value={old} onChange={(e) => setOld(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Old" aria-label="Old price" inputMode="decimal" />
          <button type="button" className="shrink-0 text-[11px] font-bold text-teal-300" onClick={() => onPrice(p, price, old)}>SAVE</button>
        </div>
      </div>
      {onRemove && <button type="button" className="shrink-0 text-[10.5px] font-bold text-rose-300" onClick={onRemove}>REMOVE</button>}
    </div>
  );
};

// ---------------------------------------------------------------- payments (bKash / Nagad / Rocket / bank / card)
// List of methods: COD has an ON/OFF switch; every other method opens its own page (account type,
// number, what you need, ON/OFF, SAVE). A method that is OFF never shows to customers (server checks too).
const PAY_LABEL: Record<string, string> = { cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'Bank transfer', card: 'Card (Visa · Mastercard)' };
const PAY_SUB: Record<string, string> = { cod: 'Customer pays the delivery man', bkash: 'Send Money or Payment + TrxID', nagad: 'Send Money or Payment + TrxID', rocket: 'Send Money or Payment + TrxID', bank: 'Customer sends to your bank account', card: 'SSLCommerz / aamarPay' };
const PAY_NEED: Record<string, string[]> = {
  personal: ['Your own bKash / Nagad / Rocket number (NID registered)', 'Nothing else: free to open', 'Customer uses SEND MONEY to this number', 'Daily and monthly limits are lower'],
  merchant: ['Trade licence', 'NID of the owner', 'Shop photo (signboard)', 'Bank account in the shop name', 'TIN (some companies ask)', 'Apply at the bKash / Nagad / Rocket merchant office or website', 'Customer uses PAYMENT: higher limits, the shop name shows to the customer'],
};
const payOn = (v: Record<string, string>, k: string) => {
  if (v[`off_${k}`] === '1') return false;
  if (k === 'cod') return true;
  if (k === 'bank') return Boolean(v.bank_acc_no);
  if (k === 'card') return Boolean(v.card_gateway);
  return /^01\d{9}$/.test(v[k] || '');
};
const PayLogo: React.FC<{ k: string; big?: boolean }> = ({ k, big }) => (
  <span className={`flex shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg bg-white px-1 ${big ? 'h-12 w-28' : 'h-10 w-20'}`}>
    {(k === 'card' ? ['visa', 'mastercard'] : [k]).map((id) => (
      <img key={id} src={`/brand/${id}.png`} alt={id} className="max-h-8 max-w-full object-contain" onError={(e) => { const el = e.currentTarget; el.replaceWith(Object.assign(document.createElement('b'), { textContent: PAY_LABEL[id] || id.toUpperCase(), className: 'text-[11px] text-slate-900' })); }} />
    ))}
  </span>
);
const Switch: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button type="button" aria-label={label} onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-teal-500' : 'bg-slate-600'}`}>
    <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? 'left-[23px]' : 'left-[3px]'}`} />
  </button>
);

const PaySetup: React.FC<{ value: Record<string, string>; onChange: (v: Record<string, string>) => void; storeId: string }> = ({ value, onChange, storeId }) => {
  const v = value || {};
  const [open, setOpen] = useState('');
  const [d, setD] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [sms, setSms] = useState<Array<{ id: string; method: string; trx_id: string; amount: number; order_id: string | null; received_at: string }>>([]);
  const [copied, setCopied] = useState(false);
  const base = 'https://ukgwipazzjstjkdfaozg.supabase.co/functions/v1/store-payment-sms?key=';
  useEffect(() => {
    void supabase.from('store_sms_keys').select('key').eq('store_id', storeId).maybeSingle().then(({ data }) => setLink(data ? base + (data as { key: string }).key : ''));
    void supabase.from('store_payment_sms').select('id,method,trx_id,amount,order_id,received_at').eq('store_id', storeId).order('received_at', { ascending: false }).limit(8).then(({ data }) => setSms((data as typeof sms) || []));
  }, [storeId]);
  const newLink = async () => {
    if (link && !window.confirm('Make a new link? The old link in the SMS forwarder app stops working.')) return;
    const { data, error } = await supabase.rpc('store_new_sms_key', { p_store: storeId });
    if (!error && data) setLink(base + String(data));
  };
  // save straight to the store (no need to press the big SAVE of this page)
  const write = async (nv: Record<string, string>, note: string) => {
    const { error } = await supabase.from('stores').update({ pay_numbers: nv, updated_at: new Date().toISOString() }).eq('id', storeId);
    if (error) { setMsg(error.message); return false; }
    onChange(nv); setMsg(note); return true;
  };
  const toggleCod = () => void write({ ...v, off_cod: v.off_cod === '1' ? '' : '1' }, v.off_cod === '1' ? 'Cash on Delivery is ON.' : 'Cash on Delivery is OFF.');
  const openPage = (k: string) => { setMsg(''); setOpen(k); setD({ ...v, [`off_${k}`]: v[`off_${k}`] || '', [`${k}_type`]: v[`${k}_type`] === 'merchant' ? 'merchant' : 'personal' }); };
  const setF = (k: string, x: string) => setD((o) => ({ ...o, [k]: x }));
  const savePage = async () => {
    const k = open;
    if (['bkash', 'nagad', 'rocket'].includes(k) && !/^01\d{9}$/.test(d[k] || '')) return setMsg('Write the 11-digit number.');
    if (k === 'bank' && !(d.bank_acc_no || '').trim()) return setMsg('Write the account number.');
    const keep = ['bkash', 'nagad', 'rocket'].includes(k) ? [k, `${k}_type`, `${k}_acc`, `off_${k}`] : k === 'bank' ? ['bank_name', 'bank_acc_name', 'bank_acc_no', 'bank_branch', 'bank_routing', 'off_bank'] : ['off_card', 'card_request'];
    const nv = { ...v };
    keep.forEach((x) => { nv[x] = d[x] ?? ''; });
    if (await write(nv, `${PAY_LABEL[k]} saved · ${payOn(nv, k) ? 'ON' : 'OFF'}`)) setOpen('');
  };
  const state = (k: string): [string, string] => {
    if (k === 'card' && !v.card_gateway) return [v.card_request ? 'REQUESTED' : 'SET UP', 'bg-amber-900/70 text-amber-200'];
    if (['bkash', 'nagad', 'rocket'].includes(k) && !v[k]) return ['SET UP', 'bg-amber-900/70 text-amber-200'];
    if (k === 'bank' && !v.bank_acc_no) return ['SET UP', 'bg-amber-900/70 text-amber-200'];
    if (!payOn(v, k)) return ['OFF', 'bg-slate-700 text-slate-300'];
    return [`ON${v[`${k}_type`] && ['bkash', 'nagad', 'rocket'].includes(k) ? ` · ${(v[`${k}_type`] === 'merchant' ? 'merchant' : v[`${k}_type`]).toUpperCase()}` : ''}`, 'bg-emerald-900/70 text-emerald-200'];
  };

  if (open) {
    const k = open;
    const mobile = ['bkash', 'nagad', 'rocket'].includes(k);
    const t = d[`${k}_type`] === 'merchant' ? 'merchant' : 'personal';
    const on = d[`off_${k}`] !== '1';
    const fld = (key: string, ph: string, mode?: 'tel' | 'numeric') => (
      <label className="block text-[11px] text-slate-400">{ph}
        <input className={input + ' mt-1'} value={d[key] || ''} inputMode={mode} onChange={(e) => setF(key, mode === 'tel' ? e.target.value.replace(/\D/g, '').slice(0, 11) : mode === 'numeric' ? e.target.value.replace(/[^\d-]/g, '') : e.target.value)} placeholder={mode === 'tel' ? '01XXXXXXXXX' : ''} />
      </label>
    );
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpen('')} className="text-[12px] font-bold text-teal-300">‹ ALL PAYMENTS</button>
        <div className="flex items-center gap-3 rounded-lg bg-black/30 p-3">
          <PayLogo k={k} big />
          <div className="min-w-0 flex-1"><p className="text-[14px] font-bold text-white">{PAY_LABEL[k]}</p><p className="text-[11px] text-slate-400">{on ? 'ON: shows at checkout' : 'OFF: hidden from customers'}</p></div>
          <Switch on={on} label={`${PAY_LABEL[k]} on or off`} onClick={() => setF(`off_${k}`, on ? '1' : '')} />
        </div>
        <div className="grid gap-2 md:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-2 rounded-lg bg-black/30 p-3">
            {mobile && (<>
              <p className="text-[11px] font-bold tracking-wider text-teal-300">ACCOUNT TYPE</p>
              <div className="grid grid-cols-2 gap-2">
                {([['personal', 'PERSONAL', 'Send Money · free'], ['merchant', 'MERCHANT', 'Payment · shop account']] as const).map(([id, l, sub]) => (
                  <button key={id} type="button" onClick={() => setF(`${k}_type`, id)} className={`rounded-xl border-2 p-3 text-left ${t === id ? 'border-teal-400 bg-teal-500/10 text-teal-200' : 'border-slate-600 text-slate-200'}`}>
                    <b className="block text-[13px]">{l}</b><span className="text-[10.5px] text-slate-400">{sub}</span>
                  </button>
                ))}
              </div>
              {fld(k, `${PAY_LABEL[k]} ${t} number`, 'tel')}
              {t === 'merchant' && fld(`${k}_acc`, 'Shop name on the merchant account')}
            </>)}
            {k === 'bank' && (<>
              {fld('bank_name', 'Bank name, e.g. Dutch-Bangla Bank')}
              {fld('bank_acc_name', 'Account name (as in the bank)')}
              {fld('bank_acc_no', 'Account number', 'numeric')}
              {fld('bank_branch', 'Branch')}
              {fld('bank_routing', 'Routing number', 'numeric')}
            </>)}
            {k === 'card' && (<>
              <p className="text-[11px] font-bold tracking-wider text-teal-300">CARD TYPES CUSTOMERS CAN PICK</p>
              <p className="text-[12px] text-slate-300">Visa · Mastercard (debit / credit) · American Express · DBBL Nexus · UnionPay</p>
              <p className="text-[11px] text-slate-400">{v.card_gateway ? `Connected: ${v.card_gateway}` : 'Not connected yet. Tap ASK ROSE TO CONNECT; until it is connected the Card button stays hidden.'}</p>
              {!v.card_gateway && <button type="button" className={btn + ' w-full bg-white/10'} onClick={() => setF('card_request', new Date().toISOString().slice(0, 10))}>{d.card_request ? 'REQUEST READY · PRESS SAVE' : 'ASK ROSE TO CONNECT'}</button>}
            </>)}
            <button type="button" onClick={() => void savePage()} className={btn + ' w-full'}>SAVE</button>
            {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-black/30 p-3">
              <p className="text-[11px] font-bold tracking-wider text-teal-300">{mobile ? `WHAT YOU NEED · ${t.toUpperCase()}` : k === 'bank' ? 'GOOD TO KNOW' : 'WHAT YOU NEED'}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-slate-300">
                {(mobile ? PAY_NEED[t] : k === 'bank'
                  ? ['A current (business) account in the shop name looks most trusted', 'A personal savings account also works', 'Customers see these details at checkout and write the transfer reference', 'You check your bank app and confirm the order in 01 ORDERS']
                  : ['Trade licence', 'NID of the owner', 'Bank account in the shop name', 'Your website (this store)', 'Card numbers are typed only on the gateway page, never in your store']).map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            {mobile && (
              <div className="space-y-1.5 rounded-lg border border-emerald-500/30 p-3">
                <p className="text-[10.5px] font-bold tracking-wider text-emerald-300">AUTO CHECK · ROSE confirms the order when the money SMS arrives</p>
                <p className="text-[10.5px] text-slate-300">On the phone that gets your bKash / Nagad / Rocket SMS, install "SMS to URL Forwarder" (Play Store). URL = this link, method POST, senders: bKash, NAGAD, 16216. Keep this link private. One link works for all three.</p>
                {link ? <p className="break-all text-[10px] text-slate-500">{link.slice(0, base.length + 6)}…</p> : <p className="text-[11px] text-amber-300">No link yet. Tap MAKE LINK.</p>}
                <div className="grid grid-cols-2 gap-2">
                  {link && <button type="button" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className={btn}>{copied ? 'COPIED ✓' : 'COPY LINK'}</button>}
                  <button type="button" onClick={() => void newLink()} className={btn + ' bg-white/10'}>{link ? 'NEW LINK' : 'MAKE LINK'}</button>
                </div>
                {sms.map((x) => (
                  <p key={x.id} className="text-[10.5px] text-slate-300">{new Date(x.received_at).toLocaleString('en-GB')} · {x.method} ৳{x.amount} · <span className="select-all">{x.trx_id}</span> · <b className={x.order_id ? 'text-emerald-300' : 'text-amber-300'}>{x.order_id ? 'MATCHED' : 'NO ORDER YET'}</b></p>
                ))}
                <p className="text-[10px] text-slate-500">Without the SMS forwarder: check the TrxID in your app and confirm the order by hand in 01 ORDERS.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="pt-1 text-[11px] font-bold tracking-wider text-teal-300">PAYMENTS · tap a method to set it up</p>
      <div className="divide-y divide-slate-800 rounded-lg bg-black/30 px-2">
        {['cod', 'bkash', 'nagad', 'rocket', 'bank', 'card'].map((k) => {
          if (k === 'cod') return (
            <div key={k} className="flex items-center gap-3 py-2.5">
              <PayLogo k={k} />
              <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-white">{PAY_LABEL[k]}</p><p className="text-[10.5px] text-slate-400">{PAY_SUB[k]}</p></div>
              <Switch on={v.off_cod !== '1'} label="Cash on Delivery on or off" onClick={toggleCod} />
            </div>
          );
          const [st, cls] = state(k);
          return (
            <button key={k} type="button" onClick={() => openPage(k)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <PayLogo k={k} />
              <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-white">{PAY_LABEL[k]}</p><p className="text-[10.5px] text-slate-400">{PAY_SUB[k]}</p></div>
              <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-extrabold ${cls}`}>{st}</span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] text-slate-400">A method that is OFF does not show to customers. Each method saves by itself.</p>
      {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
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
        tagline: s.tagline, logo: s.logo, logo_url: s.logo_url || '', color: s.color, accent: s.accent, banners: s.banners, trust: s.trust,
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
        <p className="text-[11px] text-slate-400">LOGO (picture) and NAME are separate. {IMG_HINT.logo}</p>
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
          <p className="flex-1 self-center text-[11px] text-slate-400">Icon shown when there is no logo. The store name is in MY DETAILS.</p>
        </div>
        {field('tagline', 'Tagline')}
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          Main colour <input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} />
          Accent <input type="color" value={s.accent} onChange={(e) => set('accent', e.target.value)} />
        </div>
      </div>
      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">BANNERS</p>
        <p className="text-[10.5px] text-slate-400">{IMG_HINT.banner}</p>
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
      <button type="button" onClick={() => void save()} className={btn + ' w-full'}>SAVE</button>
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};
