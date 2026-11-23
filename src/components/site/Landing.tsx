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

export const Landing: React.FC = () => {
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [installEvt, setInstallEvt] = useState<any>(null);

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

  const nav = [
    ['Features', '#features'],
    ['Modes', '#modes'],
    ['Pricing', '#pricing'],
    ['Download', '#download'],
    ['FAQ', '#faq'],
  ];

  const btnMain =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[4px] bg-[#FF4D8D] px-6 text-sm font-bold tracking-wide text-white shadow-[0_0_30px_-6px_#FF4D8D] active:scale-[0.98]';
  const btnGhost =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[4px] border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/5';

  return (
    <div className="h-[100dvh] overflow-y-auto bg-black text-white [scroll-behavior:smooth]" style={{ fontFamily: "'DM Sans', 'Noto Sans Bengali', sans-serif" }}>
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[6px]" />
            <span className="text-lg font-extrabold tracking-[0.25em]">ROSE</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            {nav.map(([l, h]) => (
              <a key={l} href={h} className="hover:text-white">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href={APP_URL} className="hidden h-10 items-center rounded-[4px] bg-white px-4 text-xs font-bold text-black md:inline-flex">
              GET STARTED
            </a>
            <button type="button" aria-label="Menu" onClick={() => setMenu((m) => !m)} className="flex h-10 w-10 items-center justify-center md:hidden">
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-white/10 bg-black px-5 py-3 md:hidden">
            {nav.map(([l, h]) => (
              <a key={l} href={h} onClick={() => setMenu(false)} className="block py-2.5 text-sm text-slate-200">
                {l}
              </a>
            ))}
            <a href={APP_URL} className="mt-2 flex h-11 items-center justify-center rounded-[4px] bg-white text-xs font-bold text-black">
              GET STARTED
            </a>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,77,141,0.25),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(45,212,191,0.15),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-2 md:pt-20">
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
                Start free <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#pricing" className={btnGhost}>
                See plans
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">Sign in with Google · No credit card · Works on any phone</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-full bg-pink-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[6px] border border-white/10 shadow-2xl">
              <img src="/tiya-home.jpg" alt="ROSE app home screen" className="aspect-[9/16] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <p className="text-xs font-bold tracking-[0.3em] text-pink-200">ROSE</p>
                <p className="mt-1 text-sm text-slate-100">"আসসালামু আলাইকুম! আমি রোজ, আজ কীভাবে সাহায্য করতে পারি?"</p>
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

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 pb-16">
        <p className="text-xs font-bold tracking-[0.3em] text-pink-300">PRICING</p>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Start free. Go Premium anytime.</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <div className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-sm font-extrabold tracking-[0.2em]">FREE</h3>
            <p className="mt-3 text-3xl font-extrabold">৳0</p>
            <p className="mt-1 text-xs text-slate-400">Daily free replies</p>
            <a href={APP_URL} className="mt-5 flex h-11 items-center justify-center rounded-[4px] border border-white/20 text-xs font-bold">
              START FREE
            </a>
          </div>
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={`rounded-[4px] border p-5 ${i === 1 ? 'border-pink-400 bg-pink-500/[0.07] shadow-[0_0_40px_-12px_#FF4D8D]' : 'border-white/[0.08] bg-white/[0.03]'}`}
            >
              <h3 className="text-sm font-extrabold uppercase tracking-[0.2em]">{p.name}</h3>
              <p className="mt-3 text-3xl font-extrabold">৳{Number(p.price_bdt)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {p.months} month{p.months > 1 ? 's' : ''} · {p.voice_credits} voice · {p.text_credits} text
              </p>
              <a href={APP_URL} className={`mt-5 flex h-11 items-center justify-center rounded-[4px] text-xs font-bold ${i === 1 ? 'bg-[#FF4D8D] text-white' : 'border border-white/20'}`}>
                GET {String(p.name).toUpperCase()}
              </a>
            </div>
          ))}
        </div>
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
            <div className="flex items-center gap-4 rounded-[4px] border border-white/[0.08] p-5 opacity-80">
              <Download className="h-8 w-8 text-slate-300" />
              <span>
                <span className="block text-sm font-bold">Android · Google Play</span>
                <span className="block text-xs text-slate-400">Coming soon</span>
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-[4px] border border-white/[0.08] p-5 opacity-80">
              <Download className="h-8 w-8 text-slate-300" />
              <span>
                <span className="block text-sm font-bold">Windows · Microsoft Store</span>
                <span className="block text-xs text-slate-400">Coming soon</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-6 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-6 md:grid-cols-[auto_1fr]">
          <img src="/tiya-avatar.png" alt="" className="h-20 w-20 rounded-[6px] object-cover" />
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-pink-300">THE MAKER</p>
            <h3 className="mt-1 text-xl font-extrabold">MD Yousuf Khan</h3>
            <p className="mt-1 text-sm text-slate-400">Built in Bangladesh, for Bangla speakers — so everyone can use AI in their own language.</p>
          </div>
        </div>
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

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] px-5 py-10 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-[4px]" />
            <span className="font-bold tracking-[0.25em] text-slate-300">ROSE</span>
            <span>© {new Date().getFullYear()} MD Yousuf Khan</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="/privacy.html" className="flex items-center gap-1 hover:text-white">
              <Lock className="h-3 w-3" /> Privacy
            </a>
            <a href="/delete-account.html" className="hover:text-white">
              Delete account
            </a>
            <a href="mailto:md.yousuf.khan060@gmail.com" className="hover:text-white">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
