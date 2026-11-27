import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Brain,
  ChevronDown,
  Download,
  GraduationCap,
  Languages,
  Lock,
  Menu,
  MessageCircle,
  Mic,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDevelopers } from './DevelopersPage';
import { YouTubeCard, useTutorialVideos } from '../TutorialVideos';

/** Public website for ROSE (myrosebd.com). The app itself lives at /app. */

const APP_URL = '/app';

const FEATURES = [
  { icon: <Mic className="h-5 w-5" />, title: 'Live voice', text: 'Talk naturally. ROSE listens, understands Bangla & English mixed, and answers in a real voice.' },
  { icon: <Languages className="h-5 w-5" />, title: '22 languages + Bangla dialects', text: 'Standard Bangla, Dhaka, Chattogram, Sylhet, Noakhali, Barishal and more.' },
  { icon: <Brain className="h-5 w-5" />, title: 'Memory', text: 'Remembers your name, preferences and past talks, only with your permission.' },
  { icon: <Sparkles className="h-5 w-5" />, title: '12 personalities', text: 'Friendly, Teacher, Professional, Funny, Caring, Developer and your own custom style.' },
  { icon: <Smartphone className="h-5 w-5" />, title: 'Phone actions', text: 'Call, WhatsApp, Messenger, open apps by voice (Android app).' },
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Safe by age', text: 'Age-aware replies. Under 18 gets a safe, educational ROSE.' },
];

const MODES = [
  {
    icon: <User className="h-6 w-6" />,
    color: '#2DD4BF',
    title: 'PERSONAL',
    bn: 'আপনার ব্যক্তিগত সহকারী',
    points: ['Daily plans, tasks & reminders', 'Write messages, emails, posts', 'Captions, titles & hashtags for videos'],
  },
  {
    icon: <GraduationCap className="h-6 w-6" />,
    color: '#60A5FA',
    title: 'STUDENT',
    bn: 'পড়াশোনার সঙ্গী',
    points: ['Any subject in simple words', 'Math step by step', 'Notes, routines & MCQ practice'],
  },
  {
    icon: <Briefcase className="h-6 w-6" />,
    color: '#FBBF24',
    title: 'BUSINESS',
    bn: 'ব্যবসার AI সহকারী',
    points: ['Products, orders, customers', 'Answers customers from your price list', 'Sales, expenses & profit dashboard'],
  },
];

const FAQ = [
  ['Is ROSE free?', 'Yes. You can start free. Premium gives more voice and text replies; pay with bKash, Nagad or Rocket, or redeem a gift code.'],
  ['Does it understand Bangla?', 'Yes. Bangla is the default, with regional dialects. You can also switch to English or 20 other languages by just asking.'],
  ['Which devices?', 'Any phone or computer browser today. Android and Windows apps are coming to Play Store and Microsoft Store.'],
  ['Is my data safe?', 'Your account uses Google sign-in; we never see your Gmail password. You can delete your account and all data any time from Settings.'],
  ['Can my shop use it?', 'Yes. Choose Business mode, add your products and prices, and ROSE answers customer questions and tracks orders.'],
];

interface Plan {
  id: string;
  name: string;
  price_bdt: number;
  months: number;
  voice_credits: number;
  text_credits: number;
}

const LandingVideos: React.FC = () => {
  const list = useTutorialVideos(null);
  if (!list.length) return null;
  return (
    <section id="videos" className="mx-auto max-w-6xl px-5 pb-16">
      <p className="text-xs font-bold tracking-[0.3em] text-red-300">WATCH</p>
      <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">See ROSE in action.</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, 6).map((v) => (
          <YouTubeCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
};

export const Landing: React.FC = () => {
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [links, setLinks] = useState<{ apk?: string; windows?: string; play?: string }>({});
  const devs = useDevelopers();
  const [pick, setPick] = useState<string | null>(null);
  const signedIn = (() => {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i) || '';
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  })();

  useEffect(() => {
    document.title = 'ROSE – Bangla Voice AI Assistant';
    void supabase
      .from('premium_plans')
      .select('id,name,price_bdt,months,voice_credits,text_credits')
      .eq('is_active', true)
      .order('sort')
      .then(({ data }) => setPlans((data as Plan[]) || []));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    void supabase.from('site_settings').select('key, value').in('key', ['apk_url', 'windows_url', 'play_url']).then(({ data }) => {
      const m: Record<string, string> = {};
      ((data as Array<{ key: string; value: unknown }>) || []).forEach((r) => { if (typeof r.value === 'string' && /^https:\/\//.test(r.value)) m[r.key] = r.value; });
      setLinks({ apk: m.play_url || m.apk_url, windows: m.windows_url, play: m.play_url });
    });
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!installEvt) {
      window.location.href = APP_URL;
      return;
    }
    installEvt.prompt();
    setInstallEvt(null);
  };

  // one long page: every button jumps to its part, and plain scrolling shows everything in this order
  const nav: Array<[string, string]> = [
    ['Home', 'top'],
    ['ROSE AI', 'features'],
    ['Modes', 'modes'],
    ['Website Builder', 'store'],
    ['Videos', 'videos'],
    ['Pricing', 'pricing'],
    ['Download', 'download'],
    ['FAQ', 'faq'],
    ['Contact', 'contact'],
  ];
  const [active, setActive] = useState('top');
  const [contactOpen, setContactOpen] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const chipsRef = React.useRef<HTMLDivElement>(null);
  const go = (id: string) => {
    const box = scrollRef.current;
    const el = document.getElementById(id);
    if (!box || !el) return;
    box.scrollTo({ top: id === 'top' ? 0 : el.offsetTop - 104, behavior: 'smooth' });
  };
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const on = () => {
      let cur = 'top';
      for (const [, id] of nav) {
        const el = document.getElementById(id);
        if (el && el.offsetTop - 120 <= box.scrollTop) cur = id;
      }
      setActive((a) => (a === cur ? a : cur));
    };
    box.addEventListener('scroll', on, { passive: true });
    return () => box.removeEventListener('scroll', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const chip = chipsRef.current?.querySelector(`[data-id="${active}"]`) as HTMLElement | null;
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);


  const btnMain =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[4px] bg-[#FF4D8D] px-6 text-sm font-bold tracking-wide text-white shadow-[0_0_30px_-6px_#FF4D8D] active:scale-[0.98]';
  const btnGhost =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[4px] border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/5';

  return (
    <div ref={scrollRef} className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-black text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ fontFamily: "'DM Sans', 'Noto Sans Bengali', sans-serif", WebkitOverflowScrolling: 'touch' }}>
      {/* NAV: logo row + the section buttons (they stay on top while scrolling) */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <button type="button" onClick={() => go('top')} className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[6px]" />
            <span className="text-lg font-extrabold tracking-[0.25em]">ROSE</span>
            <span className="hidden text-[11px] text-slate-500 sm:inline">myrosebd.com</span>
          </button>
          <a href={APP_URL} className="inline-flex h-9 items-center rounded-[4px] bg-white px-4 text-xs font-bold text-black">
            {signedIn ? 'OPEN ROSE' : 'GET STARTED'}
          </a>
        </div>
        <div ref={chipsRef} className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center">
          {nav.map(([l, id]) => (
            <button
              key={id}
              type="button"
              data-id={id}
              onClick={() => go(id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${active === id ? 'border-pink-400 bg-pink-500/15 text-pink-200' : 'border-white/15 text-slate-300 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        {/* BANNER: the whole picture on every screen (nothing is cut), a smaller file for phones */}
        <div className="relative mx-auto max-w-[1600px] overflow-hidden">
          <picture>
            <source media="(max-width: 700px)" srcSet="/banner-m.jpg" />
            <img src="/banner.jpg" alt="ROSE · your AI assistant, always here for you" width={1672} height={941} fetchPriority="high" className="block h-auto w-full" />
          </picture>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent md:h-16" />
        </div>
        <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,77,141,0.25),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(45,212,191,0.15),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-16 pt-6 md:grid-cols-2 md:gap-10 md:pt-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-[3px] border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-widest text-pink-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" /> MADE IN BANGLADESH
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] md:text-6xl">
              Your Bangla voice AI
              <span className="block bg-gradient-to-r from-pink-400 via-rose-300 to-teal-300 bg-clip-text text-transparent">that talks like a friend.</span>
            </h1>
            <p className="mt-4 text-base text-slate-300">আপনার বাংলা AI সহকারী — কথা বলুন, লিখুন, কাজ করান। পড়াশোনা থেকে ব্যবসা, সব এক জায়গায়।</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={APP_URL} className={btnMain}>
                {signedIn ? 'Open ROSE' : 'Start free'} <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#pricing" className={btnGhost}>
                See plans
              </a>
              <a href="/demos" className={btnGhost}>
                Online store demos
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">Sign in with Google · No credit card · Works on any phone</p>
          </div>
          <div className="relative hidden md:mx-auto md:block md:w-full md:max-w-sm">
            <div className="absolute -inset-6 hidden rounded-full bg-pink-500/20 blur-3xl md:block" />
            <div className="relative overflow-hidden md:rounded-[6px] md:border md:border-white/10 md:shadow-2xl">
              <img src="/tiya-home.jpg?v=3" alt="ROSE app home screen" className="block aspect-[9/16] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent md:hidden" />
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-bold tracking-[0.3em] text-pink-300">MEET ROSE</p>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">More than a chatbot.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-pink-500/15 text-pink-300">{f.icon}</span>
              <h3 className="mt-4 text-base font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MODES */}
      <section id="modes" className="border-y border-white/[0.06] bg-[#06070B]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-bold tracking-[0.3em] text-teal-300">THREE MODES</p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">One ROSE, made for you.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.title} className="rounded-[4px] border border-white/[0.08] bg-black p-5" style={{ boxShadow: `inset 0 2px 0 ${m.color}` }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-[4px]" style={{ background: `${m.color}22`, color: m.color }}>
                  {m.icon}
                </span>
                <h3 className="mt-4 text-sm font-extrabold tracking-[0.2em]">{m.title}</h3>
                <p className="mt-1 text-sm text-slate-300">{m.bn}</p>
                <ul className="mt-4 space-y-2">
                  {m.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-slate-400">
                      <span className="mt-2 h-1 w-3 shrink-0" style={{ background: m.color }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TAGLINE */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <p className="text-2xl font-extrabold leading-snug md:text-4xl">
          "It isn't a feature list.
          <span className="block text-pink-300">It's someone who listens."</span>
        </p>
      </section>

      {/* WEBSITE BUILDER */}
      <section id="store" className="border-y border-white/[0.06] bg-[#06070B]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-bold tracking-[0.3em] text-teal-300">WEBSITE BUILDER</p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Your online store, ready in minutes.</h2>
          <p className="mt-2 text-sm text-slate-300">Cash on delivery, bKash, Nagad and courier booking. আপনার নিজের অনলাইন দোকান, কয়েক মিনিটে।</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {['Pick a design you like', 'Start the 5-day free trial', 'Add your logo and products', 'Go live on yourshop.myrosebd.com or your own domain'].map((t, i) => (
              <div key={t} className="rounded-[4px] border border-white/[0.08] bg-black p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400 text-sm font-extrabold text-black">{i + 1}</span>
                <p className="mt-3 text-sm font-semibold">{t}</p>
              </div>
            ))}
          </div>
          <div className="-mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([['foodbazaar', '🍔', 'Food', 'photo-1568901346375-23c9450c58cd'], ['fashionhub', '👕', 'Fashion', 'photo-1521572163474-6864f9cf17ab'], ['sotadari', '🛒', 'Grocery', 'photo-1488459716781-31db52582fe9'], ['shopshotoi', '🛍️', 'Market', 'photo-1788458131906-d0878ba5fa4d'], ['homenest', '🛋️', 'Furniture', 'photo-1583847268964-b28dc8f51f92'], ['medicare', '💊', 'Pharmacy', 'photo-1607874963930-2edecc67a25a'], ['printpack', '📦', 'Packaging', 'photo-1621252756235-7f37e5e5125e']] as Array<[string, string, string, string]>).map(([k, ic, l, ph]) => (
              <div key={k} className="w-48 shrink-0 overflow-hidden rounded-[6px] border border-white/[0.1] bg-[#0d1117]">
                {/* a product photo of that demo shop, so each card shows what the website sells */}
                <a href={`/demos/store.html?s=${k}`} className="relative block h-28 bg-white/5">
                  <img src={`https://images.unsplash.com/${ph}?auto=format&fit=crop&q=70&w=400`} alt={`${l} demo website`} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-1.5 pt-6 text-[14px] font-bold text-white">{ic} {l}</span>
                </a>
                {/* OPEN on the left, ADMIN on the right, with space between */}
                <div className="grid grid-cols-2 gap-2 p-2.5 text-[11px] font-bold">
                  <a href={`/demos/store.html?s=${k}`} className="flex h-9 items-center justify-center rounded-[4px] border border-teal-400/60 bg-teal-500/10 text-teal-300">OPEN</a>
                  <a href={`/demo-admin?s=${k}`} className="flex h-9 items-center justify-center rounded-[4px] border border-pink-400/60 bg-pink-500/10 text-pink-300">ADMIN</a>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/start" className={btnMain}>Start 5-day free trial <ArrowRight className="h-4 w-4" /></a>
            <a href="/demos" className={btnGhost}>See all demos</a>
          </div>
        </div>
      </section>

      {/* VIDEOS */}
      <LandingVideos />

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 pb-16">
        <p className="text-xs font-bold tracking-[0.3em] text-pink-300">PRICING</p>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Start free. Go Premium anytime.</h2>
        {(() => {
          const isPack = (p: Plan) => Number(p.text_credits) === 0 || Number(p.voice_credits) === 0;
          const main = plans.filter((p) => !isPack(p));
          const packs = plans.filter(isPack);
          const selected = pick ?? (main[1]?.id || main[0]?.id || 'free');
          const n = (x: number) => Number(x || 0).toLocaleString('en-IN');
          const cards = [
            {
              id: 'free',
              name: 'FREE',
              price: 0,
              per: '',
              lines: ['Daily free replies', 'Text + voice with your own free key', 'Personal, Student, Business modes'],
              href: APP_URL,
            },
            ...main.map((p) => ({
              id: p.id,
              name: String(p.name).toUpperCase(),
              price: Number(p.price_bdt),
              per: p.months > 1 ? `/ ${p.months} months` : '/ month',
              lines: [`${n(p.text_credits)} text replies`, `${n(p.voice_credits)} voice replies`, 'No API key needed'],
              href: `${APP_URL}?buy=${p.id}`,
            })),
          ];
          return (
            <>
              <div className={`mt-8 grid gap-3 sm:grid-cols-2 ${cards.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                {cards.map((c) => {
                  const on = selected === c.id;
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setPick(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setPick(c.id)}
                      className={`flex cursor-pointer flex-col rounded-[4px] border p-5 transition-all ${
                        on ? 'border-pink-400 bg-pink-500/[0.07] shadow-[0_0_40px_-12px_#FF4D8D]' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold tracking-[0.2em]">{c.name}</h3>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-[3px] border ${on ? 'border-pink-400 bg-pink-400' : 'border-white/25'}`}>
                          {on && <span className="h-2 w-2 bg-black" />}
                        </span>
                      </div>
                      <p className="mt-3 text-3xl font-extrabold">
                        ৳{n(c.price)} <span className="text-xs font-semibold text-slate-400">{c.per}</span>
                      </p>
                      <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-300">
                        {c.lines.map((l) => (
                          <li key={l} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-pink-400" />
                            {l}
                          </li>
                        ))}
                      </ul>
                      <a
                        href={c.href}
                        onClick={(e) => e.stopPropagation()}
                        className={`mt-5 flex h-11 items-center justify-center rounded-[4px] text-xs font-bold ${on ? 'bg-[#FF4D8D] text-white' : 'border border-white/20'}`}
                      >
                        {c.id === 'free' ? 'START FREE' : `GET ${c.name}`}
                      </a>
                    </div>
                  );
                })}
              </div>
              {packs.length > 0 && (
                <>
                  <p className="mt-6 text-xs font-bold tracking-[0.25em] text-teal-300">NEED MORE? TOP-UP PACKS</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {packs.map((p) => (
                      <a
                        key={p.id}
                        href={`${APP_URL}?buy=${p.id}`}
                        className="flex items-center justify-between gap-3 rounded-[4px] border border-teal-400/30 bg-teal-500/[0.05] px-4 py-3 hover:border-teal-300/60"
                      >
                        <span>
                          <span className="block text-sm font-extrabold tracking-wider">{String(p.name).toUpperCase()}</span>
                          <span className="block text-xs text-slate-400">
                            {Number(p.text_credits) > 0 ? `${n(p.text_credits)} text replies` : `${n(p.voice_credits)} voice replies`}
                          </span>
                        </span>
                        <span className="text-xl font-extrabold">৳{n(Number(p.price_bdt))}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}
        <p className="mt-3 text-xs text-slate-500">Pay with bKash · Nagad · Rocket · Gift code</p>
      </section>

      {/* DOWNLOAD */}
      <section id="download" className="border-y border-white/[0.06] bg-[#06070B]">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-bold tracking-[0.3em] text-teal-300">DOWNLOAD</p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Use ROSE everywhere.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <button type="button" onClick={install} className="flex items-center gap-4 rounded-[4px] border border-teal-400/50 bg-teal-500/[0.06] p-5 text-left">
              <MonitorSmartphone className="h-8 w-8 text-teal-300" />
              <span>
                <span className="block text-sm font-bold">Web app · Install now</span>
                <span className="block text-xs text-slate-400">Any phone or computer browser</span>
              </span>
            </button>
            <a href={links.apk || undefined} className={`flex items-center gap-4 rounded-[4px] border p-5 ${links.apk ? 'border-emerald-400/50 bg-emerald-500/[0.06]' : 'border-white/[0.08] opacity-80'}`}>
              <Download className="h-8 w-8 text-slate-300" />
              <span>
                <span className="block text-sm font-bold">Android · APK{links.play ? ' / Google Play' : ''}</span>
                <span className="block text-xs text-slate-400">{links.apk ? 'Tap to download, then open the file and tap Install' : 'Coming soon · use the web app now'}</span>
              </span>
            </a>
            <a href={links.windows || undefined} className={`flex items-center gap-4 rounded-[4px] border p-5 ${links.windows ? 'border-sky-400/50 bg-sky-500/[0.06]' : 'border-white/[0.08] opacity-80'}`}>
              <Download className="h-8 w-8 text-slate-300" />
              <span>
                <span className="block text-sm font-bold">Windows · PC</span>
                <span className="block text-xs text-slate-400">{links.windows ? 'Microsoft Store' : 'Now: open in Chrome or Edge, tap Install in the address bar'}</span>
              </span>
            </a>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
            <p><b className="text-slate-200">Phone (Android):</b> open myrosebd.com/app in Chrome → ⋮ → Add to Home screen / Install app.</p>
            <p><b className="text-slate-200">iPhone:</b> open in Safari → Share → Add to Home Screen.</p>
            <p><b className="text-slate-200">PC:</b> Chrome or Edge → the install icon at the right of the address bar → Install.</p>
          </div>
        </div>
      </section>

      {/* DEVELOPERS */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <a
          href="/developers"
          className="group grid items-center gap-6 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6 hover:border-pink-400/50 md:grid-cols-[auto_1fr_auto]"
        >
          <img src="/team/devs-round.jpg" alt="ROSE developers" className="h-20 w-20 rounded-full border-2 border-pink-400/60 object-cover shadow-[0_0_30px_-8px_#FF4D8D]" />
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-pink-300">THE DEVELOPERS</p>
            <h3 className="mt-1 text-xl font-extrabold">{(devs || []).map((d) => (d.full_name || '').toUpperCase()).join(' · ') || 'MD YOUSUF KHAN'}</h3>
            <p className="mt-1 text-sm text-slate-400">Web Developers · Made in Bangladesh</p>
          </div>
          <span className="inline-flex h-11 items-center justify-center rounded-[4px] border border-pink-400/60 px-5 text-xs font-bold tracking-widest text-pink-200 group-hover:bg-pink-500/10">
            MEET THE DEVELOPERS →
          </span>
        </a>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-16">
        <p className="text-xs font-bold tracking-[0.3em] text-pink-300">FAQ</p>
        <h2 className="mt-2 text-3xl font-extrabold">Questions</h2>
        <div className="mt-6 space-y-2">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="rounded-[4px] border border-white/[0.08]">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold">
                {q}
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <p className="px-4 pb-4 text-sm leading-relaxed text-slate-400">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,77,141,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-extrabold md:text-5xl">ROSE is waiting for you.</h2>
          <p className="mt-3 text-slate-300">রোজ আপনার অপেক্ষায় আছে।</p>
          <a href={APP_URL} className={`${btnMain} mt-7`}>
            <MessageCircle className="h-4 w-4" /> Talk to ROSE
          </a>
        </div>
      </section>

      {/* CONTACT + POLICIES */}
      <footer id="contact" className="border-t border-white/[0.06] bg-[#06070B] px-5 py-12 text-sm text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[6px]" />
              <span className="text-lg font-extrabold tracking-[0.25em] text-white">ROSE</span>
            </div>
            <p className="mt-3 leading-relaxed">ROSE · {(devs?.[0]?.full_name || 'MD YOUSUF KHAN').toUpperCase()}<br />373/2 Modhubag, Moghbazar, Dhaka, Bangladesh</p>
            <p className="mt-2">md.yousuf.khan060@gmail.com · info@myrosebd.com</p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-pink-300">CONTACT US</p>
            <button type="button" onClick={() => setContactOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between rounded-[4px] border border-white/15 px-4 py-3 text-left font-semibold text-white">
              🎧 WhatsApp help <ChevronDown className={`h-4 w-4 transition-transform ${contactOpen ? 'rotate-180' : ''}`} />
            </button>
            {contactOpen && (
              <div className="mt-2 space-y-2">
                {['8801719188777', '8801777885978'].map((n, i) => (
                  <a key={n} href={`https://wa.me/${n}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[4px] border border-white/10 bg-black px-4 py-2.5 text-white">
                    <span>Help line {i + 1}</span><span className="text-emerald-300">Chat →</span>
                  </a>
                ))}
              </div>
            )}
            <a href="/developers" className="mt-3 inline-block text-slate-300 underline">Meet the developers</a>
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-pink-300">POLICIES</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([['Terms', '/terms.html'], ['Privacy', '/privacy.html'], ['Refund', '/refund.html'], ['Acceptable use', '/acceptable-use.html'], ['Delete account', '/delete-account.html'], ['All policies', '/policies.html']] as Array<[string, string]>).map(([l, h]) => (
                <a key={l} href={h} className="flex items-center gap-1.5 rounded-[4px] border border-white/10 px-3 py-2 text-slate-200 hover:border-pink-400/50">
                  <Lock className="h-3 w-3" /> {l}
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-slate-600">© {new Date().getFullYear()} ROSE · myrosebd.com · Made in Bangladesh</p>
      </footer>
    </div>
  );
};

export default Landing;
