import React, { useEffect, useState } from 'react';
import { AtSign, Camera, Globe, Link2, Mail, MapPin, MessageCircle, Phone, Send, Video, Wallet, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/** Public developer / admin details (table developer_profile, edited from Admin → 15 DEVELOPER PROFILE). */
export interface DevProfile {
  full_name?: string | null;
  title?: string | null;
  about?: string | null;
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
}

export function useDeveloperProfile(): DevProfile | null {
  const [p, setP] = useState<DevProfile | null>(null);
  useEffect(() => {
    void supabase
      .from('developer_profile')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setP((data as DevProfile) || { full_name: 'MD YOUSUF KHAN' }));
  }, []);
  return p;
}

const digits = (s: string) => s.replace(/[^\d+]/g, '');
const link = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

/** Full details list; used on the website (modal) and inside the app (About ROSE). */
export const DeveloperDetails: React.FC<{ p: DevProfile; dark?: boolean }> = ({ p }) => {
  const rows: Array<{ icon: React.ReactNode; label: string; value?: string | null; href?: string }> = [
    { icon: <Mail className="h-4 w-4" />, label: 'EMAIL', value: p.email, href: p.email ? `mailto:${p.email}` : undefined },
    { icon: <Phone className="h-4 w-4" />, label: 'PHONE', value: p.phone, href: p.phone ? `tel:${digits(p.phone)}` : undefined },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      label: 'WHATSAPP',
      value: p.whatsapp,
      href: p.whatsapp ? `https://wa.me/${digits(p.whatsapp).replace('+', '')}` : undefined,
    },
    { icon: <Wallet className="h-4 w-4" />, label: 'BKASH', value: p.bkash },
    { icon: <Wallet className="h-4 w-4" />, label: 'NAGAD', value: p.nagad },
    { icon: <MapPin className="h-4 w-4" />, label: 'ADDRESS', value: p.address },
    { icon: <Globe className="h-4 w-4" />, label: 'WEBSITE', value: p.website, href: p.website ? link(p.website) : undefined },
    { icon: <Link2 className="h-4 w-4" />, label: 'FACEBOOK', value: p.facebook, href: p.facebook ? link(p.facebook) : undefined },
    { icon: <Video className="h-4 w-4" />, label: 'YOUTUBE', value: p.youtube, href: p.youtube ? link(p.youtube) : undefined },
    { icon: <Globe className="h-4 w-4" />, label: 'TIKTOK', value: p.tiktok, href: p.tiktok ? link(p.tiktok) : undefined },
    { icon: <Camera className="h-4 w-4" />, label: 'INSTAGRAM', value: p.instagram, href: p.instagram ? link(p.instagram) : undefined },
    { icon: <Send className="h-4 w-4" />, label: 'TELEGRAM', value: p.telegram, href: p.telegram ? link(p.telegram) : undefined },
    { icon: <Link2 className="h-4 w-4" />, label: 'LINKEDIN', value: p.linkedin, href: p.linkedin ? link(p.linkedin) : undefined },
    { icon: <AtSign className="h-4 w-4" />, label: 'X (TWITTER)', value: p.x_twitter, href: p.x_twitter ? link(p.x_twitter) : undefined },
  ].filter((r) => r.value && String(r.value).trim());

  return (
    <div>
      <div className="flex items-center gap-4">
        <img
          src={p.photo_url || '/tiya-avatar.png?v=3'}
          alt={p.full_name || 'Developer'}
          className="h-20 w-20 shrink-0 rounded-[6px] border border-white/10 object-cover"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.3em] text-pink-300">DEVELOPER</p>
          <p className="truncate text-xl font-extrabold text-white">{(p.full_name || 'MD YOUSUF KHAN').toUpperCase()}</p>
          {p.title && <p className="text-xs text-slate-400">{p.title}</p>}
        </div>
      </div>
      {p.about && <p className="mt-4 text-sm leading-relaxed text-slate-300">{p.about}</p>}
      <div className="mt-4 space-y-1.5">
        {rows.map((r) => {
          const inner = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.06] text-pink-300">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-bold tracking-wider text-slate-500">{r.label}</span>
                <span className="block break-words text-[13px] text-slate-100">{r.value}</span>
              </span>
            </>
          );
          return r.href ? (
            <a
              key={r.label}
              href={r.href}
              target={r.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 hover:border-pink-400/50"
            >
              {inner}
            </a>
          ) : (
            <div key={r.label} className="flex items-center gap-3 rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Popup used on the website */
export const DeveloperModal: React.FC<{ p: DevProfile; onClose: () => void }> = ({ p, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
    <div
      className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[8px] border border-white/10 bg-[#0A0C12] p-5 sm:rounded-[6px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex justify-end">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-white/10 text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <DeveloperDetails p={p} />
    </div>
  </div>
);
