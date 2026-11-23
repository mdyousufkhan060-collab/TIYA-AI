import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  Camera,
  Code2,
  Globe,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Video,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * /developers — the full "Team behind ROSE" page (separate interface).
 * Data: table developers (Admin → 15 DEVELOPERS). English only.
 */
export interface Developer {
  id: string;
  slug: string | null;
  sort: number;
  full_name: string;
  title?: string | null;
  about?: string | null;
  skills?: string | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  bkash?: string | null;
  nagad?: string | null;
  address?: string | null;
  website?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  instagram?: string | null;
  telegram?: string | null;
  linkedin?: string | null;
  x_twitter?: string | null;
  github?: string | null;
}

export function useDevelopers(): Developer[] | null {
  const [list, setList] = useState<Developer[] | null>(null);
  useEffect(() => {
    void supabase
      .from('developers')
      .select('*')
      .eq('is_active', true)
      .order('sort')
      .then(({ data }) => setList((data as Developer[]) || []));
  }, []);
  return list;
}

const digits = (s: string) => s.replace(/[^\d+]/g, '');
const link = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

function contactRows(d: Developer) {
  return [
    { icon: <Mail className="h-4 w-4" />, label: 'Email', value: d.email, href: d.email ? `mailto:${d.email}` : undefined },
    { icon: <Phone className="h-4 w-4" />, label: 'Phone', value: d.phone, href: d.phone ? `tel:${digits(d.phone)}` : undefined },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      label: 'WhatsApp',
      value: d.whatsapp,
      href: d.whatsapp ? `https://wa.me/${digits(d.whatsapp).replace('+', '')}` : undefined,
    },
    { icon: <Wallet className="h-4 w-4" />, label: 'bKash', value: d.bkash },
    { icon: <Wallet className="h-4 w-4" />, label: 'Nagad', value: d.nagad },
    { icon: <MapPin className="h-4 w-4" />, label: 'Address', value: d.address },
    { icon: <Globe className="h-4 w-4" />, label: 'Website', value: d.website, href: d.website ? link(d.website) : undefined },
  ].filter((r) => r.value && String(r.value).trim());
}

function socialLinks(d: Developer) {
  return [
    { icon: <Link2 className="h-4 w-4" />, label: 'Facebook', url: d.facebook },
    { icon: <Video className="h-4 w-4" />, label: 'YouTube', url: d.youtube },
    { icon: <Video className="h-4 w-4" />, label: 'TikTok', url: d.tiktok },
    { icon: <Camera className="h-4 w-4" />, label: 'Instagram', url: d.instagram },
    { icon: <Send className="h-4 w-4" />, label: 'Telegram', url: d.telegram },
    { icon: <Link2 className="h-4 w-4" />, label: 'LinkedIn', url: d.linkedin },
    { icon: <AtSign className="h-4 w-4" />, label: 'X', url: d.x_twitter },
    { icon: <Code2 className="h-4 w-4" />, label: 'GitHub', url: d.github },
  ].filter((s) => s.url && String(s.url).trim());
}

const DevCard: React.FC<{ d: Developer; accent: string; onOpen: () => void }> = ({ d, accent, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="group relative block w-full overflow-hidden rounded-[6px] border border-white/10 bg-[#0A0C12] text-left transition-transform hover:-translate-y-1"
    style={{ boxShadow: `0 30px 60px -30px ${accent}` }}
  >
    <div className="relative aspect-[4/5] overflow-hidden">
      <img src={d.photo_url || '/tiya-avatar.png'} alt={d.full_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C12] via-[#0A0C12]/10 to-transparent" />
      <span className="absolute left-4 top-4 rounded-[3px] px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-black" style={{ background: accent }}>
        {(d.title || 'Developer').toUpperCase()}
      </span>
    </div>
    <div className="relative -mt-16 p-5">
      <h3 className="text-2xl font-extrabold text-white">{d.full_name}</h3>
      {d.skills && <p className="mt-1 text-xs text-slate-400">{d.skills}</p>}
      <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold tracking-widest" style={{ color: accent }}>
        VIEW PROFILE →
      </p>
    </div>
  </button>
);

const DevDetail: React.FC<{ d: Developer; accent: string; onBack: () => void }> = ({ d, accent, onBack }) => {
  const rows = contactRows(d);
  const socials = socialLinks(d);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-6">
      <button type="button" onClick={onBack} className="mb-6 inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-xs font-bold text-slate-200">
        <ArrowLeft className="h-4 w-4" /> ALL DEVELOPERS
      </button>
      <div className="grid gap-8 md:grid-cols-[340px_1fr]">
        <div>
          <div className="overflow-hidden rounded-[6px] border border-white/10" style={{ boxShadow: `0 30px 70px -30px ${accent}` }}>
            <img src={d.photo_url || '/tiya-avatar.png'} alt={d.full_name} className="aspect-[4/5] w-full object-cover" />
          </div>
          {socials.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={link(String(s.url))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/12 px-3 text-xs font-semibold text-slate-200 hover:border-white/40"
                >
                  {s.icon} {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[0.3em]" style={{ color: accent }}>
            {(d.title || 'Developer').toUpperCase()}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold text-white md:text-5xl">{d.full_name}</h1>
          {d.about && <p className="mt-4 text-base leading-relaxed text-slate-300">{d.about}</p>}
          {d.skills && (
            <div className="mt-5 flex flex-wrap gap-2">
              {d.skills.split(',').map((s) => (
                <span key={s} className="rounded-[3px] bg-white/[0.06] px-2.5 py-1 text-xs text-slate-200">
                  {s.trim()}
                </span>
              ))}
            </div>
          )}
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {rows.map((r) => {
              const inner = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.06]" style={{ color: accent }}>
                    {r.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{r.label}</span>
                    <span className="block break-words text-sm text-slate-100">{r.value}</span>
                  </span>
                </>
              );
              const cls = `flex items-center gap-3 rounded-[4px] border border-white/[0.08] bg-white/[0.03] p-3 ${r.label === 'Address' ? 'sm:col-span-2' : ''}`;
              return r.href ? (
                <a key={r.label} href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`${cls} hover:border-white/30`}>
                  {inner}
                </a>
              ) : (
                <div key={r.label} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
          {rows.length === 0 && <p className="mt-8 text-sm text-slate-500">Contact details coming soon.</p>}
        </div>
      </div>
    </div>
  );
};

const ACCENTS = ['#FF4D8D', '#2DD4BF', '#60A5FA', '#FBBF24'];

export const DevelopersPage: React.FC = () => {
  const list = useDevelopers();
  const [slug, setSlug] = useState<string | null>(() => window.location.hash.replace('#', '') || null);

  useEffect(() => {
    document.title = 'Developers – ROSE';
    const onHash = () => setSlug(window.location.hash.replace('#', '') || null);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (s: string | null) => {
    window.location.hash = s || '';
    setSlug(s);
    document.getElementById('dev-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const idx = list ? list.findIndex((d) => (d.slug || d.id) === slug) : -1;
  const current = idx >= 0 && list ? list[idx] : null;

  return (
    <div id="dev-scroll" className="h-[100dvh] overflow-y-auto bg-black text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="/" className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[6px]" />
            <span className="text-lg font-extrabold tracking-[0.25em]">ROSE</span>
          </a>
          <a href="/app" className="inline-flex h-10 items-center rounded-[4px] bg-white px-4 text-xs font-bold text-black">
            OPEN ROSE
          </a>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,77,141,0.18),transparent_50%),radial-gradient(ellipse_at_80%_90%,rgba(45,212,191,0.12),transparent_50%)]" />

      <div className="relative">
        {!list ? (
          <p className="py-32 text-center text-sm text-slate-500">Loading…</p>
        ) : current ? (
          <DevDetail d={current} accent={ACCENTS[idx % ACCENTS.length]} onBack={() => go(null)} />
        ) : (
          <div className="mx-auto max-w-6xl px-5 pb-20 pt-14">
            <p className="text-xs font-bold tracking-[0.3em] text-pink-300">THE TEAM BEHIND ROSE</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-6xl">
              Developers
              <span className="block bg-gradient-to-r from-pink-400 to-teal-300 bg-clip-text text-transparent">building Bangla AI.</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-400">ROSE is designed, built and looked after in Bangladesh. Tap a developer to see the full profile and contact details.</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:max-w-4xl">
              {list.map((d, i) => (
                <DevCard key={d.id} d={d} accent={ACCENTS[i % ACCENTS.length]} onOpen={() => go(d.slug || d.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="relative border-t border-white/[0.06] px-5 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} ROSE · Made in Bangladesh ·{' '}
        <a href="/privacy.html" className="hover:text-white">
          Privacy
        </a>
      </footer>
    </div>
  );
};

export default DevelopersPage;
