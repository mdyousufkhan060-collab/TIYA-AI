import React, { useEffect, useState } from 'react';
import {
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

const ACCENTS = ['#FFC93C', '#2DD4BF', '#60A5FA', '#FF4D8D'];

/** One developer in the list: small header (photo left, name right), then all details below. */
const DevSection: React.FC<{ d: Developer; accent: string }> = ({ d, accent }) => {
  const rows = contactRows(d);
  const socials = socialLinks(d);
  return (
    <section id={d.slug || d.id} className="scroll-mt-24 overflow-hidden rounded-[6px] border border-white/10 bg-[#0A0C12]">
      {/* small banner */}
      <div className="relative flex items-center gap-4 border-b border-white/[0.08] p-4 sm:gap-5 sm:p-5" style={{ background: `linear-gradient(90deg, ${accent}22, transparent 70%)` }}>
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
        <img
          src={d.photo_url || '/tiya-avatar.png?v=3'}
          alt={d.full_name}
          className="h-20 w-20 shrink-0 rounded-[6px] border-2 object-cover object-top sm:h-24 sm:w-24"
          style={{ borderColor: accent }}
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.3em]" style={{ color: accent }}>
            {(d.title || 'Web Developer').toUpperCase()}
          </p>
          <h2 className="mt-1 truncate text-2xl font-extrabold text-white sm:text-3xl">{(d.full_name || '').toUpperCase()}</h2>
          {d.skills && <p className="mt-1 text-xs text-slate-400">{d.skills}</p>}
        </div>
      </div>
      {/* details */}
      <div className="p-4 sm:p-5">
        {d.about && <p className="text-sm leading-relaxed text-slate-300">{d.about}</p>}
        {rows.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
        ) : (
          <p className="mt-4 text-sm text-slate-500">Contact details coming soon.</p>
        )}
        {socials.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {socials.map((x) => (
              <a
                key={x.label}
                href={link(String(x.url))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/12 px-3 text-xs font-semibold text-slate-200 hover:border-white/40"
              >
                {x.icon} {x.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export const DevelopersPage: React.FC = () => {
  const list = useDevelopers();
  useEffect(() => {
    document.title = 'Developers – ROSE';
  }, []);

  // /developers#imtiaz jumps to that person once the list is loaded
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (list && id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [list]);

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

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-5">
        {/* big banner */}
        <div className="-mx-4 -mt-6 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[6px] sm:border sm:border-white/10 sm:shadow-[0_30px_80px_-30px_#1d4ed8]">
          <img src="/team/banner.jpg" alt="ROSE Web Developers" className="block w-full" />
        </div>

        <p className="mt-10 text-xs font-bold tracking-[0.3em] text-amber-300">THE TEAM BEHIND ROSE</p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Developers</h1>

        <div className="mt-6 space-y-5">
          {!list ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            list.map((d, i) => <DevSection key={d.id} d={d} accent={ACCENTS[i % ACCENTS.length]} />)
          )}
        </div>
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
