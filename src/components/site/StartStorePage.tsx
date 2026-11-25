import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RESERVED_SLUGS, loadDemos, slugify, uploadImage, type Demo } from '../workspace/StorePanel';

/**
 * myrosebd.com/start?d=foodbazaar — take a demo store as your own:
 * Google sign-in with the company Gmail → company details → 5-day free trial starts → the store is live.
 */
const KEY = 'rose_start_store';
const input = 'w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-[14px] text-white placeholder:text-slate-500';
const lbl = 'block text-[12px] font-bold text-slate-200';
const bn = 'ml-1 font-normal text-slate-400';
const phoneOk = (p: string) => /^01[3-9]\d{8}$/.test(p);

export default function StartStorePage() {
  const qs = new URLSearchParams(window.location.search);
  const [key, setKey] = useState(qs.get('d') || localStorage.getItem(KEY) || '');
  const [demos, setDemos] = useState<Record<string, Demo>>({});
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [existing, setExisting] = useState<{ slug: string; name: string } | null>(null);
  const [f, setF] = useState({ name: '', nameBn: '', slug: '', email: '', email2: '', whatsapp: '', phone2: '', address: '', city: 'Dhaka', sample: true });
  const [logo, setLogo] = useState<File | null>(null);
  const [banners, setBanners] = useState<File[]>([]);
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
        if (st && st[0]) setExisting(st[0] as { slug: string; name: string });
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
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email)) return setMsg('Write a correct company Gmail.');
    if (f.email2 && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email2)) return setMsg('The second email is not correct.');
    if (!phoneOk(f.whatsapp)) return setMsg('WhatsApp number must be 11 digits (01XXXXXXXXX).');
    if (f.phone2 && !phoneOk(f.phone2)) return setMsg('The second phone must be 11 digits.');
    if (f.address.trim().length < 10) return setMsg('Write the full address where customers can find you.');
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
          city: f.city.trim(), phone: f.whatsapp, whatsapp: f.whatsapp, phone2: f.phone2, email: f.email.trim(), email2: f.email2.trim(),
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
      setDone({ url, ends: (acc2 as { ends_at?: string } | null)?.ends_at || '' });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shell = (body: React.ReactNode) => (
    <div className="min-h-[100dvh] bg-[#07090D] px-4 py-6 text-white">
      <div className="mx-auto max-w-xl space-y-4">
        <a href="/demos" className="text-[12px] font-bold text-teal-300">‹ All designs</a>
        <h1 className="text-2xl font-extrabold">Get your own store <span className="block text-base font-semibold text-slate-400">নিজের অনলাইন দোকান খুলুন · ৫ দিন ফ্রি</span></h1>
        {body}
        <p className="pt-4 text-center text-[11px] text-slate-500">ROSE · myrosebd.com · Help: WhatsApp 01719188777 · <a className="underline" href="/policies.html">Policies</a></p>
      </div>
    </div>
  );

  if (!ready) return shell(<Loader2 className="h-6 w-6 animate-spin text-teal-300" />);

  const designs = (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(demos).map(([k, x]) => (
        <button key={k} type="button" onClick={() => { setKey(k); localStorage.setItem(KEY, k); }} className={`rounded-xl border p-2 text-left ${key === k ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
          <span className="text-2xl">{x.logo}</span>
          <span className="block truncate text-[12px] font-bold">{x.name}</span>
          <span className="block truncate text-[10.5px] text-slate-400">{x.type}</span>
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
        <p className="text-[12px] text-slate-300">To manage later: myrosebd.com/app → sign in with this Gmail → Settings → 07 WORKSPACE → STORE · WEBSITE.</p>
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
        <a href={`/shop/${existing.slug}`} className="flex h-11 items-center justify-center rounded-xl bg-white text-[13px] font-bold text-black">OPEN MY STORE</a>
        <a href="/app" className="flex h-11 items-center justify-center rounded-xl bg-teal-600 text-[13px] font-bold">MANAGE MY STORE</a>
        <p className="text-[12px] text-slate-400">Signed in as {email}. More stores need the BUSINESS plan.</p>
      </div>,
    );

  return shell(
    <div className="space-y-4">
      <p className="text-[13px] text-slate-300">Design <span className={bn}>ডিজাইন</span></p>
      {designs}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[12px] text-slate-400">Signed in as <b className="text-white">{email}</b></p>
        <label className={lbl}>Company name (English) *<span className={bn}>কোম্পানির নাম</span>
          <input className={input + ' mt-1'} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahim Fashion" /></label>
        <label className={lbl}>Company name (Bangla)<span className={bn}>বাংলায় নাম</span>
          <input className={input + ' mt-1'} value={f.nameBn} onChange={(e) => set('nameBn', e.target.value)} placeholder="রহিম ফ্যাশন" /></label>
        <label className={lbl}>Web address *<span className={bn}>ওয়েবসাইটের ঠিকানা</span>
          <span className="mt-1 flex items-center gap-1"><input className={input} value={f.slug || slugify(f.name)} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="rahim-fashion" /><span className="shrink-0 text-[12px] text-slate-400">.myrosebd.com</span></span></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Company Gmail *<span className={bn}>জিমেইল ১</span>
            <input className={input + ' mt-1'} value={f.email} onChange={(e) => set('email', e.target.value.trim())} inputMode="email" /></label>
          <label className={lbl}>Second email<span className={bn}>জিমেইল ২</span>
            <input className={input + ' mt-1'} value={f.email2} onChange={(e) => set('email2', e.target.value.trim())} inputMode="email" placeholder="optional" /></label>
          <label className={lbl}>WhatsApp number *<span className={bn}>হোয়াটসঅ্যাপ</span>
            <input className={input + ' mt-1'} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="01XXXXXXXXX" /></label>
          <label className={lbl}>Other phone<span className={bn}>অন্য ফোন</span>
            <input className={input + ' mt-1'} value={f.phone2} onChange={(e) => set('phone2', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="optional" /></label>
        </div>
        <label className={lbl}>Full address *<span className={bn}>পুরো ঠিকানা (কাস্টমার যেখানে আপনাকে পাবে)</span>
          <textarea className={input + ' mt-1'} rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="House, road, area, thana, district" /></label>
        <label className={lbl}>City / District<span className={bn}>শহর / জেলা</span>
          <input className={input + ' mt-1'} value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
        <label className={lbl}>Logo<span className={bn}>লোগো (ঐচ্ছিক)</span>
          <input className="mt-1 block w-full text-[12px] text-slate-300" type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></label>
        <label className={lbl}>Banner photos (up to 4)<span className={bn}>ব্যানারের ছবি</span>
          <input className="mt-1 block w-full text-[12px] text-slate-300" type="file" accept="image/*" multiple onChange={(e) => setBanners(Array.from(e.target.files || []).slice(0, 4))} /></label>
        <label className="flex items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={f.sample} onChange={(e) => set('sample', e.target.checked)} /> Start with the demo products (change later) <span className={bn}>ডেমো প্রোডাক্ট দিয়ে শুরু</span>
        </label>
        <button type="button" disabled={busy || !d} onClick={() => void create()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-[14px] font-extrabold text-black disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} START 5-DAY FREE STORE
        </button>
        {msg && <p className="text-[13px] text-rose-300">{msg}</p>}
        <p className="text-[11.5px] text-slate-400">You can change everything later in STORE · WEBSITE → 09 COMPANY INFO. By starting you agree to the <a className="underline" href="/terms.html">Terms</a>.</p>
      </div>
    </div>,
  );
}
