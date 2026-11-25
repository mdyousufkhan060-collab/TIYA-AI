import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SettingsBar } from '../settings/SettingsShell';
import { STORE_DURATIONS, STORE_PLANS, storePrice, tk, type StorePlanId } from '../../utils/storePlans';

/**
 * Workspace > MY STORE: the ROSE Store Builder for the store owner.
 * Pick a demo design, then manage Products, Categories, Orders and Homepage.
 * Access comes from Admin > 23 WEBSITE ACCESS (or the 5-day free trial).
 */
type Access = { plan: StorePlanId; ends_at: string; stores_limit: number; products_limit: number } | null;
type Store = {
  id: string; slug: string; name: string; tagline: string; logo: string; logo_url: string; color: string; accent: string; template: string;
  city: string; phone: string; email: string; address: string; licence: string; note: string;
  delivery_inside: number; delivery_outside: number; banners: Banner[]; trust: string[];
  pay_numbers: Record<string, string>; published: boolean; suspended: boolean;
};
type Banner = { title: string; badge: string; icon: string; bg?: string };
type Cat = { id: string; name: string; icon: string; sort: number };
type Prod = {
  id: string; name: string; category_id: string | null; price: number; old_price: number | null; stock: number; emoji: string;
  description: string; images: string[]; options_label: string; options: string[]; rx: boolean; active: boolean;
};
type Order = {
  id: string; order_no: number; customer_name: string; phone: string; address: string; area: string;
  items: Array<{ name: string; q: number; price: number; opt?: string }>; total: number; payment_method: string; trx_id: string; status: string; created_at: string;
};
type Demo = {
  name: string; tagline: string; logo: string; type: string; color: string; accent: string; banners: Banner[]; trust: string[];
  categories: [string, string][]; products: Array<[string, string, string, number, number, string?, string?]>;
  options?: { label: string; values: string[] }; note: string; pharmacy?: boolean;
};

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-60';
const STATUSES = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

function loadDemos(): Promise<Record<string, Demo>> {
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
async function uploadImage(storeId: string, file: File, max = 1200): Promise<string> {
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

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export const StorePanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<Access>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [tab, setTab] = useState<'home' | 'orders' | 'products' | 'categories' | 'design' | 'create'>('home');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: adm }, { data: acc }, { data: st }, d] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('my_website_access'),
      supabase.from('stores').select('*').eq('owner_id', userId).order('created_at'),
      loadDemos(),
    ]);
    setIsAdmin(Boolean(adm));
    setAccess(acc && (acc as any).email ? (acc as Access) : null);
    const list = (st as Store[]) || [];
    setStores(list);
    setStore((cur) => (cur ? list.find((x) => x.id === cur.id) || list[0] || null : list[0] || null));
    setDemos(d);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  const active = isAdmin || (access && new Date(access.ends_at) > new Date());

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
        <PlanTable />
        <p className="px-1 text-[11.5px] text-slate-400">To buy: pay with bKash / Nagad / Rocket in PREMIUM and send your Gmail. Admin turns your store on.</p>
      </div>
    );
  }

  // ---------- create a store ----------
  const limit = isAdmin ? 99 : access?.stores_limit || 1;
  if (!stores.length || tab === 'create') {
    return <CreateStore demos={demos} canCreate={stores.length < limit} onBack={stores.length ? () => setTab('home') : undefined} onDone={() => { setTab('home'); void load(); }} />;
  }
  if (!store) return null;

  const url = `${window.location.origin}/shop/${store.slug}`;
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
            await supabase.from('stores').update({ published: !store.published, updated_at: new Date().toISOString() }).eq('id', store.id);
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
      <div className="space-y-1.5">
        <SettingsBar badge="01" title="ORDERS" onClick={() => setTab('orders')} testId="store-orders" />
        <SettingsBar badge="02" title="PRODUCTS" onClick={() => setTab('products')} testId="store-products" />
        <SettingsBar badge="03" title="CATEGORIES" onClick={() => setTab('categories')} testId="store-categories" />
        <SettingsBar badge="04" title="HOMEPAGE & DESIGN" value="BANNERS · COLOURS" onClick={() => setTab('design')} testId="store-design" />
        {stores.length < limit && <SettingsBar badge="+" title="NEW STORE" onClick={() => setTab('create')} testId="store-new" />}
      </div>
      <p className="px-1 text-[11px] text-slate-400">Coming next: Payments, Delivery, Pixels & Analytics, Live chat, Staff, Own domain.</p>
    </div>
  );
};

// ---------------------------------------------------------------- plans
const PlanTable: React.FC = () => (
  <div className={box + ' space-y-2'}>
    <p className="text-[11px] font-bold tracking-wider text-teal-300">PLANS</p>
    {(['starter', 'pro', 'business'] as StorePlanId[]).map((k) => {
      const p = STORE_PLANS[k];
      return (
        <div key={k} className="rounded-lg bg-black/30 p-2">
          <p className="text-[12px] font-bold text-white">{p.label} · {tk(p.monthly)} / month</p>
          <p className="text-[11px] text-slate-300">
            {p.stores} store · {p.products > 10000 ? 'unlimited' : p.products} products · {p.storageGb} GB · {p.staff} staff · {p.ownDomain ? 'own domain' : 'myrosebd.com link'}
          </p>
          <p className="text-[10.5px] text-slate-400">
            {STORE_DURATIONS.map((d) => `${d.months}m ${tk(storePrice(k, d.months))}`).join(' · ')}
          </p>
        </div>
      );
    })}
  </div>
);

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
          <span>myrosebd.com/shop/</span>
          <input className={input} value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="rahim-fashion" />
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
  const load = useCallback(async () => {
    const { data } = await supabase.from('store_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(100);
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
  if (loading) return <p className="text-xs text-slate-400">Loading…</p>;
  if (!orders.length) return <div className={box}><p className="text-[12px] text-slate-300">No orders yet. Share your store link to get orders.</p></div>;
  const today = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString());
  return (
    <div className="space-y-2">
      <div className={box + ' grid grid-cols-2 gap-2 text-center'}>
        <div><p className="text-lg font-bold text-white">{today.length}</p><p className="text-[10.5px] text-slate-400">ORDERS TODAY</p></div>
        <div><p className="text-lg font-bold text-white">{tk(today.reduce((a, o) => a + Number(o.total), 0))}</p><p className="text-[10.5px] text-slate-400">SALES TODAY</p></div>
      </div>
      {orders.map((o) => (
        <div key={o.id} className={box + ' space-y-1'}>
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-bold text-white">#{o.order_no} · {tk(Number(o.total))}</p>
            <select className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white" value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
          <p className="text-[11.5px] text-slate-300">{o.customer_name} · <a className="text-teal-300" href={`tel:${o.phone}`}>{o.phone}</a></p>
          <p className="text-[11px] text-slate-400">{o.address} ({o.area})</p>
          <p className="text-[11px] text-slate-300">{o.items.map((i) => `${i.name}${i.opt ? ` (${i.opt})` : ''} ×${i.q}`).join(', ')}</p>
          <p className="text-[10.5px] text-slate-500">{o.payment_method.toUpperCase()}{o.trx_id ? ` · TrxID ${o.trx_id}` : ''} · {new Date(o.created_at).toLocaleString('en-GB')}</p>
        </div>
      ))}
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
const emptyProd = (): Partial<Prod> => ({ name: '', price: 0, old_price: null, stock: 10, emoji: '📦', description: '', images: [], options_label: '', options: [], rx: false, active: true, category_id: null });

const ProductsTab: React.FC<{ store: Store; limit: number }> = ({ store, limit }) => {
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [edit, setEdit] = useState<Partial<Prod> | null>(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
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
      options_label: edit.options_label || '', options: (edit.options || []).filter(Boolean), rx: Boolean(edit.rx), active: edit.active !== false,
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
        <textarea className={input} rows={3} value={edit.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Description (helps Google)" />
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {(edit.images || []).filter(Boolean).map((u, i) => (
              <div key={u + i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => set('images', (edit.images || []).filter((x) => x !== u))} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] text-white">✕</button>
              </div>
            ))}
          </div>
          <label className={btn + ' w-full cursor-pointer bg-white/10'}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ADD PHOTOS (GALLERY / CAMERA)
            <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
              const files = Array.from(e.target.files || []).slice(0, 6);
              e.target.value = '';
              if (!files.length) return;
              setUploading(true);
              setMsg('');
              try {
                const urls: string[] = [];
                for (const f of files) urls.push(await uploadImage(store.id, f));
                setEdit((x) => ({ ...(x || {}), images: [...((x?.images || []).filter(Boolean)), ...urls] }));
              } catch (err: any) {
                setMsg(String(err?.message || err));
              } finally {
                setUploading(false);
              }
            }} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className={input} value={edit.options_label || ''} onChange={(e) => set('options_label', e.target.value)} placeholder="Size / Colour" />
          <input className={input + ' col-span-2'} value={(edit.options || []).join(', ')} onChange={(e) => set('options', e.target.value.split(',').map((x) => x.trim()))} placeholder="S, M, L, XL" />
        </div>
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
