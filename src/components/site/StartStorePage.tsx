import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RESERVED_SLUGS, loadDemos, slugify, uploadImage, type Demo } from '../workspace/StorePanel';

/**
 * myrosebd.com/start?d=foodbazaar — take a demo store as your own:
 * Google sign-in with the company Gmail → company details → 5-day free trial starts → the store is live.
 */
const KEY = 'rose_start_store';
const input = 'w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-[13.5px] text-white placeholder:text-slate-500';
const lbl = 'block text-[12px] font-bold text-slate-200';
const bn = 'ml-1 font-normal text-slate-400';
const DISTRICTS = ['Dhaka', 'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapainawabganj', 'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon'];
const phoneOk = (p: string) => /^01[3-9]\d{8}$/.test(p);

export default function StartStorePage() {
  const qs = new URLSearchParams(window.location.search);
  const [key, setKey] = useState(qs.get('d') || localStorage.getItem(KEY) || '');
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [existing, setExisting] = useState<{ slug: string; name: string } | null>(null);
  const pre = (k: string) => (qs.get(k) || '').slice(0, 200);
  const [f, setF] = useState(() => {
    let saved: Record<string, string> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY + '_form') || '{}'); } catch { /* ignore */ }
    const v = (k: string, q: string, d = '') => pre(q) || saved[k] || d;
    return {
      name: v('name', 'name'), nameBn: v('nameBn', 'bn'), slug: v('slug', 'slug'), email: '', email2: v('email2', 'e2'),
      whatsapp: v('whatsapp', 'wa').replace(/\D/g, '').slice(0, 11), phone2: v('phone2', 'ph2').replace(/\D/g, '').slice(0, 11),
      address: v('address', 'addr'), city: v('city', 'city', 'Dhaka'), sample: true,
    };
  });
  useEffect(() => {
    try { localStorage.setItem(KEY + '_form', JSON.stringify(f)); } catch { /* ignore */ }
  }, [f]);
  const [logo] = useState<File | null>(null);
  const [banners] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<{ url: string; ends: string } | null>(null);

  useEffect(() => {
    document.title = 'Get your store · ROSE';
    if (qs.get('d')) localStorage.setItem(KEY, qs.get('d')!);
    void loadDemos().then(setDemos);
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const em = data.session?.user?.email || null;
      setEmail(em);
      if (em) {
        setF((x) => ({ ...x, email: x.email || em }));
        const { data: st } = await supabase.from('stores').select('slug,name').eq('owner_id', data.session!.user.id).limit(1);
        if (st && st[0]) {
          setExisting(st[0] as { slug: string; name: string });
          // sign-up is over: a later Google login must open the app, not this page
          localStorage.removeItem(KEY);
          localStorage.removeItem(KEY + '_form');
        }
      }
      setReady(true);
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = demos[key];
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const google = async () => {
    if (key) localStorage.setItem(KEY, key);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/start?d=${encodeURIComponent(key)}` } });
  };

  const create = async () => {
    setMsg('');
    const slug = slugify(f.slug || f.name);
    if (!d) return setMsg('Choose a design first.');
    if (f.name.trim().length < 3) return setMsg('Write the company name (3+ letters).');
    if (slug.length < 3 || RESERVED_SLUGS.includes(slug)) return setMsg('This web address is not allowed. Choose another.');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email || email || '')) return setMsg('Sign in with your Gmail first.');
    if (!phoneOk(f.whatsapp)) return setMsg('Phone / WhatsApp number must be 11 digits (01XXXXXXXXX).');
    setBusy(true);
    try {
      const { data: acc } = await supabase.rpc('my_website_access');
      const a = acc as { email?: string; ends_at?: string } | null;
      if (!a || !a.email) {
        const { error } = await supabase.rpc('start_website_trial');
        if (error) throw new Error(error.message);
      } else if (a.ends_at && new Date(a.ends_at) < new Date()) {
        throw new Error('Your free trial or plan has ended. Buy a plan in the app: myrosebd.com/app → Settings → 07 WORKSPACE → STORE · WEBSITE.');
      }
      const { data: st, error } = await supabase
        .from('stores')
        .insert({
          slug, template: key, name: f.name.trim(), name_bn: f.nameBn.trim(), tagline: d.tagline, logo: d.logo, color: d.color, accent: d.accent,
          city: f.city.trim(), phone: f.whatsapp, whatsapp: f.whatsapp, phone2: '', email: (f.email || email || '').trim(), email2: '',
          address: f.address.trim(), banners: d.banners, trust: d.trust, note: d.note, published: true,
        })
        .select('id, slug')
        .single();
      if (error || !st) throw new Error(error?.message.includes('duplicate') ? 'This web address is taken. Try another.' : error?.message || 'Could not create the store.');
      const id = (st as { id: string }).id;
      if (f.sample) {
        const cats = d.categories.map((c, i) => ({ store_id: id, name: c[0], icon: c[1], sort: i }));
        const { data: made } = await supabase.from('store_categories').insert(cats).select('id,name');
        const byName = new Map(((made as Array<{ id: string; name: string }>) || []).map((c) => [c.name, c.id]));
        await supabase.from('store_products').insert(
          d.products.map((p, i) => ({
            store_id: id, name: p[0], category_id: byName.get(p[1]) || null, emoji: p[2], price: p[3], old_price: p[4], stock: 50,
            rx: p[5] === 'rx', options_label: d.options?.label || '', options: d.options?.values || [], sort: i, images: p[6] ? [String(p[6])] : [],
          })),
        );
      }
      const patch: Record<string, unknown> = {};
      if (logo) patch.logo_url = await uploadImage(id, logo, 400).catch(() => '');
      if (banners.length) {
        const urls = await Promise.all(banners.slice(0, 4).map((b) => uploadImage(id, b, 1400).catch(() => '')));
        patch.banners = urls.filter(Boolean).map((u, i) => ({ ...(d.banners[i] || d.banners[0]), title: i ? (d.banners[i] || d.banners[0]).title : f.name.trim(), img: u }));
      }
      if (Object.keys(patch).length) await supabase.from('stores').update(patch).eq('id', id);
      let url = `${window.location.origin}/shop/${slug}`;
      const { data: sd } = await supabase.functions.invoke('store-subdomain', { body: { store_id: id } }).catch(() => ({ data: null }));
      if ((sd as { ok?: boolean } | null)?.ok) url = `https://${slug}.myrosebd.com`;
      const { data: acc2 } = await supabase.rpc('my_website_access');
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY + '_form');
      setDone({ url, ends: (acc2 as { ends_at?: string } | null)?.ends_at || '' });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shell = (body: React.ReactNode, sub = true) => (
    <div className="min-h-[100dvh] bg-[#07090D] px-4 py-3 text-white md:px-8 md:py-3">
      <div className="mx-auto max-w-5xl space-y-2.5 md:space-y-3">
        <a href="/demos" className="text-[12px] font-bold text-teal-300">‹ All designs</a>
        <h1 className="text-xl font-extrabold md:flex md:items-baseline md:gap-3 md:text-2xl">Get your own store {sub && <span className="block text-[13px] font-semibold text-slate-400 md:text-[15px]">নিজের অনলাইন দোকান খুলুন · ৫ দিন ফ্রি</span>}</h1>
        {body}
        <p className="pt-2 text-center text-[11px] text-slate-500">ROSE · myrosebd.com · Help: WhatsApp 01719188777 · <a className="underline" href="/policies.html">Policies</a></p>
      </div>
    </div>
  );

  if (!ready) return shell(<Loader2 className="h-6 w-6 animate-spin text-teal-300" />);

  const designs = (
    <div className="grid grid-cols-3 gap-1.5 md:grid-cols-2">
      {Object.entries(demos).map(([k, x]) => (
        <button key={k} type="button" onClick={() => { setKey(k); localStorage.setItem(KEY, k); }} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${key === k ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
          <span className="text-xl">{x.logo}</span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-bold">{x.name}</span>
            <span className="block truncate text-[10px] text-slate-400">{x.type}</span>
          </span>
        </button>
      ))}
    </div>
  );

  if (done)
    return shell(
      <div className="space-y-3 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4">
        <p className="text-lg font-extrabold text-emerald-300">Your store is live! 🎉</p>
        <a href={done.url} target="_blank" rel="noreferrer" className="block break-all text-[15px] font-bold text-white underline">{done.url.replace(/^https?:\/\//, '')}</a>
        {done.ends && <p className="text-[13px] text-slate-200">Free until {new Date(done.ends).toLocaleDateString('en-GB')}. After that choose 3, 6, 9, 12 or 24 months to keep it open.</p>}
        <a href={done.url} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-black">OPEN MY STORE</a>
        <a href="/app" className="flex h-11 items-center justify-center rounded-xl bg-teal-600 text-[13px] font-bold">MANAGE: PRODUCTS · ORDERS · PLAN</a>
        <p className="text-[12px] text-slate-300">To change the name, phone, address, logo or banners later: myrosebd.com/app → sign in with this Gmail → Settings → 07 WORKSPACE → MY DETAILS (name, phone, address) and WEBSITE ADMIN → HOMEPAGE & DESIGN (logo, banners). Or on your shop: Account → Store admin.</p>
      </div>,
    );

  if (!email)
    return shell(
      <div className="space-y-4">
        <p className="text-[13px] text-slate-300">1 · Choose a design <span className={bn}>ডিজাইন বাছুন</span></p>
        {designs}
        {d && <a href={`/demos/store.html?s=${key}`} target="_blank" rel="noreferrer" className="text-[12px] text-teal-300 underline">See the {d.name} demo first</a>}
        <p className="text-[13px] text-slate-300">2 · Sign in with your company Gmail <span className={bn}>কোম্পানির জিমেইল দিয়ে লগইন</span></p>
        <button type="button" disabled={!d} onClick={() => void google()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-bold text-black disabled:opacity-50">
          <img src="/brand/google.svg" alt="" className="h-5 w-5" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> Continue with Google
        </button>
        <p className="text-[12px] text-slate-400">5-day free trial, once per Gmail. No payment now.</p>
      </div>,
    );

  if (existing)
    return shell(
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[14px]">You already have a store: <b>{existing.name}</b></p>
        <a href={`/shop/${existing.slug}`} className="flex h-11 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-black">OPEN MY SHOP</a>
        <a href="/app?open=store" className="flex h-11 items-center justify-center rounded-xl bg-teal-600 text-[13px] font-bold">STORE ADMIN</a>
        <p className="text-[12px] text-slate-400">Signed in as {email}. More stores need the BUSINESS plan.</p>
      </div>,
    );

  return shell(
    <div className="grid gap-3 md:grid-cols-[280px_1fr] md:items-start md:gap-4">
      <div className="space-y-2 md:sticky md:top-4 md:mt-12">
        {designs}
        {d && (
          <a href={`/demos/store.html?s=${key}`} target="_blank" rel="noreferrer" className="block text-center text-[12px] text-teal-300 underline">
            See {d.name} demo ↗
          </a>
        )}
      </div>
      <div className="space-y-2">
      <p className="text-center text-[17px] font-extrabold text-teal-300 md:text-[22px]">নিজের অনলাইন দোকান খুলুন <span className="text-amber-300">· ৫ দিন ফ্রি</span></p>
      <div
        className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4"
        onFocusCapture={(e) => {
          const t = e.target as HTMLElement;
          if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || (t as HTMLInputElement).type === 'file') return;
          window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className={lbl}>Company name (English) *
            <input className={input + ' mt-1'} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahim Fashion" /></label>
          <label className={lbl}>Company name (Bangla)
            <input className={input + ' mt-1'} value={f.nameBn} onChange={(e) => set('nameBn', e.target.value)} placeholder="রহিম ফ্যাশন" /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={lbl}>Phone / WhatsApp *
            <input className={input + ' mt-1'} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="01XXXXXXXXX" /></label>
          <label className={lbl}>District *
            <select className={input + ' mt-1'} value={DISTRICTS.includes(f.city) ? f.city : 'Dhaka'} onChange={(e) => set('city', e.target.value)}>
              {DISTRICTS.map((x) => <option key={x} value={x} className="bg-[#0d1016]">{x}</option>)}
            </select></label>
        </div>
        <label className={lbl}>Address <span className="font-normal text-slate-500">(optional)</span>
          <input className={input + ' mt-1'} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="House, road, area" /></label>
        <label className={lbl}>Web address *
          <span className="mt-1 flex items-center gap-1"><input className={input} value={f.slug || slugify(f.name)} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="rahim-fashion" /><span className="shrink-0 text-[12px] text-slate-400">.myrosebd.com</span></span></label>
        <div className="space-y-1 pt-1 md:sticky md:bottom-0 md:-mx-4 md:bg-[#0d1016]/95 md:px-4 md:py-2 md:backdrop-blur">
          {msg && <p className="text-[13px] text-rose-300">{msg}</p>}
          <button type="button" disabled={busy || !d} onClick={() => void create()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-[14px] font-extrabold text-black disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} START 5-DAY FREE STORE
          </button>
          <p className="text-center text-[11px] text-slate-500">Logo, banners, more phones and emails: add later in Settings · <a className="underline" href="/terms.html">Terms</a></p>
        </div>
      </div>
      </div>
    </div>,
    false,
  );
}
