import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BuyPlan, lifetimeTerms, RESERVED_SLUGS, loadDemos, slugify, uploadImage, type Demo } from '../workspace/StorePanel';
import { BUSINESS_EXTRA, SELL_PLANS, STORE_DURATIONS, STORE_PLANS, tk, type StorePlanId } from '../../utils/storePlans';
import { livePrice, useLiveStorePrices } from '../../utils/liveStorePrices';

/**
 * myrosebd.com/start?d=foodbazaar — take a demo store as your own:
 * Google sign-in with the company Gmail → company details → 10-day free trial starts → the store is live.
 */
const KEY = 'rose_start_store';
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
  // plan chosen here: 10-day free trial, PERSONAL · STUDENT or BUSINESS PREMIUM (1-12 months) or the one-time LIFETIME website
  const [choice, setChoice] = useState<'trial' | 'monthly' | 'lifetime'>(qs.get('plan') === 'lifetime' ? 'lifetime' : 'trial');
  const [tier, setTier] = useState<StorePlanId>('starter');
  const [months, setMonths] = useState(12);
  const live = useLiveStorePrices();
  const lifePrice = live.lifetime;
  const [needPay, setNeedPay] = useState(false);

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
        if (choice !== 'trial') { setNeedPay(true); throw new Error('Your free trial was used before. Pay for the plan below first, then tap START again.'); }
        throw new Error('Your free trial or plan has ended. Buy a plan in the app: myrosebd.com/app → Settings → WORKSPACE → STORE · WEBSITE.');
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

  // LOCKED (owner, Nov 28 2026 8:14 PM): pink, square-corner /start design approved from the review file
  // (public/demos/start-preview.html). Full width on every screen, no dark side edges. Do not change unless the owner asks.
  const shell = (body: React.ReactNode) => (
    <div className="flex h-[100dvh] w-full flex-col overflow-y-auto overscroll-y-contain bg-[#fde8f0] text-[#3b0a24] [&_*]:rounded-none" style={{ fontFamily: 'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif' }}>
      <div className="w-full flex-1 bg-[linear-gradient(180deg,#fbd3e3_0,#fde8f0_260px)] px-[clamp(14px,3vw,48px)] pt-[18px]">
        <a href="/demos" className="text-[13px] font-bold text-[#e5337f]">‹ All designs</a>
        <h1 className="mb-0.5 mt-2 text-[clamp(24px,3vw,38px)] font-extrabold tracking-tight text-[#6d0f3f]">Get your own store</h1>
        <p className="mb-4 text-[clamp(14px,1.4vw,17px)] font-semibold text-[#e5337f]">নিজের অনলাইন দোকান খুলুন · ১০ দিন ফ্রি</p>
        {body}
        <p className="mt-7 pb-3.5 text-center text-[12.5px] text-[#6b5160]">ROSE · myrosebd.com · Help: WhatsApp 01719188777 · <a className="underline" href="/policies.html">Policies</a></p>
      </div>
      <div className="h-16 w-full shrink-0 bg-[linear-gradient(90deg,#6d0f3f,#b0205f_60%,#6d0f3f)] [clip-path:polygon(0_55%,18%_30%,40%_50%,62%_20%,82%_45%,100%_25%,100%_100%,0_100%)]" />
    </div>
  );
  const step = (n: number, t: string, b: string) => (
    <p className="mb-3 mt-1 flex items-center gap-2.5 text-[15px] font-semibold">
      <b className="grid h-7 w-7 shrink-0 place-items-center bg-[#6d0f3f] text-[14px] text-white">{n}</b>
      <span>{t} <span className="font-medium text-[#6b5160]">{b}</span></span>
    </p>
  );
  const panel = 'border-[1.5px] border-[#f3b8cf] bg-[#fff6f9] p-[18px] shadow-[0_10px_28px_rgba(109,15,63,0.08)] lg:p-[26px]';

  if (!ready) return shell(<Loader2 className="h-6 w-6 animate-spin text-[#e5337f]" />);

  const photo = (x: Demo) => {
    const p = (x.products || []).find((q) => q[6]);
    const u = p ? String(p[6]) : '';
    return !u ? '' : /^https?:/.test(u) ? u : `https://images.unsplash.com/${u}?w=600&q=65&auto=format&fit=crop`;
  };
  const SV = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const icon = (k: string) => {
    const c = 'h-[26px] w-[26px] shrink-0 text-[#e5337f]';
    if (k === 'fashionhub') return <svg viewBox="0 0 24 24" className={c} {...SV}><path d="M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3v1L2.5 16.5c-.7.6-.3 1.5.6 1.5h17.8c.9 0 1.3-.9.6-1.5L12 9" /></svg>;
    if (k === 'sotadari') return <svg viewBox="0 0 24 24" className={c} {...SV}><path d="M2 3h3l2.6 12h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></svg>;
    if (k === 'shopshotoi') return <svg viewBox="0 0 24 24" className={c} {...SV}><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" /><path d="M3 7l9 5 9-5M12 12v10" /></svg>;
    if (k === 'homenest') return <svg viewBox="0 0 24 24" className={c} {...SV}><path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" /><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2v-5ZM5 18v2M19 18v2" /></svg>;
    if (k === 'medicare') return <svg viewBox="0 0 24 24" className={c} {...SV}><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="M8.5 8.5l7 7" /></svg>;
    if (k === 'printpack') return <svg viewBox="0 0 24 24" className={c} {...SV}><path d="M3 12V3h9l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>;
    return <svg viewBox="0 0 24 24" className={c} fill="currentColor"><path d="M8 7V6a4 4 0 0 1 8 0v1h3l1 15H4L5 7h3Zm2 0h4V6a2 2 0 0 0-4 0v1Z" /></svg>;
  };
  // design cards: 2 a row on phones, 3 on tablets, as many as fit on computers (fills the screen)
  const designs = (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] lg:gap-3.5 min-[1800px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {Object.entries(demos).map(([k, x]) => (
        <button key={k} type="button" onClick={() => { setKey(k); localStorage.setItem(KEY, k); }} className={`relative flex flex-col bg-[#fff6f9] text-left transition ${key === k ? 'border-[3px] border-[#e5337f] shadow-[0_8px_22px_rgba(229,51,127,0.25)]' : 'border-[1.5px] border-[#f3b8cf] hover:border-[#f472a8]'}`}>
          {photo(x) ? <img src={photo(x)} alt={x.name} loading="lazy" className="aspect-[16/10] w-full bg-[#f9d5e3] object-cover" /> : <span className="grid aspect-[16/10] w-full place-items-center bg-[#f9d5e3] text-4xl">{x.logo}</span>}
          {key === k && <span className="absolute right-2 top-2 bg-[#e5337f] px-2 py-1 text-[11px] font-extrabold tracking-wider text-white">CHOSEN</span>}
          <span className="flex items-center gap-2.5 border-t-[1.5px] border-[#f3b8cf] px-3 py-2.5">
            {icon(k)}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold leading-tight">{x.name}</span>
              <span className="block truncate text-[12.5px] text-[#6b5160]">{x.type}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
  const twoCol = (left: React.ReactNode, right: React.ReactNode) => (
    <div className="grid gap-[22px] lg:grid-cols-[minmax(0,1fr)_clamp(360px,32vw,560px)] lg:items-start lg:gap-[clamp(20px,2.5vw,44px)]">
      <section>{left}</section>
      <aside className={`${panel} lg:sticky lg:top-[18px]`}>{right}</aside>
    </div>
  );

  const planPrice = choice === 'lifetime' ? lifePrice : choice === 'monthly' ? livePrice(live, tier, months) : 0;
  const on = 'border-[3px] border-[#e5337f] bg-[#fde3ed]';
  const off = 'border-[1.5px] border-[#f3b8cf] bg-white';
  const plans = (
    <div className="space-y-2">
      {step(3, 'Choose a plan', 'প্ল্যান বাছুন')}
      <div className="grid gap-2 sm:grid-cols-3">
        {([
          ['trial', '10-day free trial', '0 Tk · pay later'],
          ['monthly', 'Monthly plan', `from ${tk(livePrice(live, 'starter', 1))} / month`],
          ['lifetime', 'Lifetime website', `${tk(lifePrice)} once`],
        ] as Array<['trial' | 'monthly' | 'lifetime', string, string]>).map(([k, t, sub]) => (
          <button key={k} type="button" onClick={() => setChoice(k)} className={`p-[11px] text-left ${choice === k ? on : off}`}>
            <span className="block text-[14px] font-bold">{t}</span>
            <span className="block text-[12px] font-semibold text-[#e5337f]">{sub}</span>
          </button>
        ))}
      </div>
      {choice === 'monthly' && (
        <div className="space-y-2 border-[1.5px] border-[#f3b8cf] bg-white p-3">
          <div className="grid grid-cols-2 gap-1.5">
            {SELL_PLANS.map((p) => (
              <button key={p} type="button" onClick={() => setTier(p)} className={`px-2 py-2 text-center ${tier === p ? on : off}`}>
                <span className="block text-[12.5px] font-bold">{STORE_PLANS[p].label}</span>
                <span className="block text-[11px] text-[#6b5160]">{p === 'business' ? `+${tk(BUSINESS_EXTRA)} · design changes` : `from ${tk(livePrice(live, p, 1))}`}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {STORE_DURATIONS.map((x) => (
              <button key={x.months} type="button" onClick={() => setMonths(x.months)} className={`py-1.5 text-center ${months === x.months ? on : off}`}>
                <span className="block text-[12.5px] font-bold">{x.months} mo</span>
                <span className="block text-[10.5px]">{tk(livePrice(live, tier, x.months))}</span>
                <span className="block text-[10px] font-semibold text-[#e5337f]">{x.off ? `-${x.off}%` : ' '}</span>
              </button>
            ))}
          </div>
          <p className="text-right text-[14px] font-extrabold text-[#6d0f3f]">{STORE_PLANS[tier].label} · {months} months = {tk(planPrice)}</p>
        </div>
      )}
      {choice === 'lifetime' && (
        <div className="border-[1.5px] border-[#e5337f] bg-[#fde3ed] p-3">
          <p className="text-[13.5px] font-extrabold text-[#6d0f3f]">Lifetime website · {tk(lifePrice)} one-time</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#3b0a24]"><b>Terms:</b> {lifetimeTerms(lifePrice)}</p>
        </div>
      )}
      <p className="border-l-4 border-[#e5337f] bg-[#fde3ed] px-3 py-2 text-[12px] leading-relaxed text-[#3b0a24]"><b className="text-[#6d0f3f]">Lifetime free service:</b> no more charges unless you ask for a big change. Only the yearly hosting and domain fee is paid each year. BUSINESS PREMIUM can change the website's colours and layout; PERSONAL · STUDENT websites keep the chosen design.</p>
      {needPay && choice !== 'trial' && <BuyPlan startPlan={choice === 'lifetime' ? 'lifetime' : tier} startMonths={months} />}
    </div>
  );
  const btnMain = 'flex h-[52px] w-full items-center justify-center gap-2 bg-[#6d0f3f] text-[15px] font-extrabold tracking-wide text-white hover:bg-[#8a1450] disabled:opacity-60';
  const btnLine = 'flex h-[52px] w-full items-center justify-center gap-2 border-2 border-[#6d0f3f] bg-white text-[15px] font-extrabold text-[#6d0f3f] hover:bg-[#6d0f3f] hover:text-white';

  if (done)
    return shell(
      <div className={`${panel} mx-auto max-w-[760px] space-y-3`}>
        <p className="text-xl font-extrabold text-[#6d0f3f]">Your store is live! 🎉</p>
        <a href={done.url} target="_blank" rel="noreferrer" className="block break-all text-[16px] font-bold text-[#e5337f] underline">{done.url.replace(/^https?:\/\//, '')}</a>
        {done.ends && <p className="text-[13.5px] text-[#3b0a24]">Free until {new Date(done.ends).toLocaleDateString('en-GB')}. After that choose 3, 6, 9, 12 or 24 months to keep it open.</p>}
        {choice !== 'trial' && (
          <div className="space-y-2 border-[1.5px] border-[#e5337f] bg-[#fde3ed] p-3">
            <p className="text-[14px] font-extrabold text-[#6d0f3f]">Now pay for your {choice === 'lifetime' ? 'LIFETIME website' : `${STORE_PLANS[tier].label} plan (${months} months)`}: {tk(planPrice)}</p>
            <p className="text-[12.5px] text-[#3b0a24]">Your store is already open with the 10-day trial. When the payment is checked, your plan starts by itself.</p>
            <BuyPlan startPlan={choice === 'lifetime' ? 'lifetime' : tier} startMonths={months} />
          </div>
        )}
        <a href={done.url} target="_blank" rel="noreferrer" className={btnLine}>OPEN MY STORE</a>
        <a href="/app" className={btnMain}>MANAGE: PRODUCTS · ORDERS · PLAN</a>
        <p className="text-[12.5px] text-[#6b5160]">To change the name, phone, address, logo or banners later: myrosebd.com/app → sign in with this Gmail → Settings → WORKSPACE → MY DETAILS (name, phone, address) and WEBSITE ADMIN → HOMEPAGE & DESIGN (logo, banners). Or on your shop: Account → Store admin.</p>
      </div>,
    );

  const chosenLine = d && (
    <>
      <p className="mb-3.5 border-l-4 border-[#e5337f] bg-[#fde3ed] px-3 py-2.5 text-[14px]">Chosen design: <b className="text-[#6d0f3f]">{d.name}</b> · {d.type}</p>
      <a href={`/demos/store.html?s=${key}`} target="_blank" rel="noreferrer" className="mb-4 inline-block text-[14px] font-semibold text-[#e5337f] underline">See the {d.name} demo first</a>
    </>
  );

  if (!email)
    return shell(
      twoCol(
        <>
          {step(1, 'Choose a design', 'ডিজাইন বাছুন')}
          {designs}
        </>,
        <>
          {chosenLine}
          {step(2, 'Sign in with your company Gmail', 'কোম্পানির জিমেইল দিয়ে লগইন')}
          <button type="button" disabled={!d} onClick={() => void google()} className={`${btnLine} disabled:opacity-50`}>
            <img src="/brand/google.svg" alt="" className="h-5 w-5" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> Continue with Google
          </button>
          <p className="mt-2.5 text-[13px] text-[#6b5160]">10-day free trial, once per Gmail. No payment now.</p>
        </>,
      ),
    );

  if (existing)
    return shell(
      <div className={`${panel} mx-auto max-w-[760px] space-y-3`}>
        <p className="text-[15px]">You already have a store: <b className="text-[#6d0f3f]">{existing.name}</b></p>
        <a href={`/shop/${existing.slug}`} className={btnLine}>OPEN MY SHOP</a>
        <a href="/app?open=store" className={btnMain}>STORE ADMIN</a>
        <p className="text-[12.5px] text-[#6b5160]">Signed in as {email}. More stores need the BUSINESS plan.</p>
      </div>,
    );

  const inp = 'mt-1.5 block w-full border-[1.5px] border-[#f3b8cf] bg-white px-3 py-2.5 text-[14.5px] text-[#3b0a24] placeholder:text-[#b08a9c] focus:border-[#e5337f] focus:outline-none';
  const lab = 'block text-[13px] font-bold text-[#6d0f3f]';
  return shell(
    twoCol(
      <>
        {step(1, 'Choose a design', 'ডিজাইন বাছুন')}
        {designs}
        {d && <a href={`/demos/store.html?s=${key}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[14px] font-semibold text-[#e5337f] underline">See the {d.name} demo first ↗</a>}
      </>,
      <div
        className="space-y-2.5"
        onFocusCapture={(e) => {
          const t = e.target as HTMLElement;
          if (!/^(INPUT|TEXTAREA)$/.test(t.tagName) || (t as HTMLInputElement).type === 'file') return;
          window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
        }}
      >
        {step(2, 'Your company details', 'কোম্পানির তথ্য')}
        <div className="grid grid-cols-2 gap-2.5">
          <label className={lab}>Company name (English) *
            <input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahim Fashion" /></label>
          <label className={lab}>Company name (Bangla)
            <input className={inp} value={f.nameBn} onChange={(e) => set('nameBn', e.target.value)} placeholder="রহিম ফ্যাশন" /></label>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className={lab}>Phone / WhatsApp *
            <input className={inp} value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="01XXXXXXXXX" /></label>
          <label className={lab}>District *
            <select className={inp} value={DISTRICTS.includes(f.city) ? f.city : 'Dhaka'} onChange={(e) => set('city', e.target.value)}>
              {DISTRICTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select></label>
        </div>
        <label className={lab}>Address <span className="font-normal text-[#6b5160]">(optional)</span>
          <input className={inp} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="House, road, area" /></label>
        <label className={lab}>Web address *
          <span className="flex items-center gap-1.5"><input className={inp} value={f.slug || slugify(f.name)} onChange={(e) => set('slug', slugify(e.target.value))} placeholder="rahim-fashion" /><span className="mt-1.5 shrink-0 text-[13px] font-normal text-[#6b5160]">.myrosebd.com</span></span></label>
        {plans}
        <div className="space-y-1.5 pt-1">
          {msg && <p className="border-l-4 border-[#e5337f] bg-[#fde3ed] px-3 py-2 text-[13px] font-semibold text-[#b0205f]">{msg}</p>}
          <button type="button" disabled={busy || !d} onClick={() => void create()} className={btnMain}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {choice === 'trial' ? 'START 10-DAY FREE STORE' : `START STORE · THEN PAY ${tk(planPrice)}`}
          </button>
          <p className="text-center text-[12px] text-[#6b5160]">Logo, banners, more phones and emails: add later in Settings · <a className="underline" href="/terms.html">Terms</a></p>
        </div>
      </div>,
    ),
  );
}
