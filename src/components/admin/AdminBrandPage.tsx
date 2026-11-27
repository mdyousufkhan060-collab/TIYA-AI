import React, { useState } from 'react';
import { Copy, Globe, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { ROSE_CONTACT as C, bdIntl } from '../../utils/roseContact';
import { supabase } from '../../lib/supabase';

/** Top card of the admin panel: ROSE photo + myrosebd.com. Tap opens the contact page. */
export const AdminBrandCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    data-testid="admin-brand-card"
    className="mb-3 flex min-h-[84px] w-full items-center gap-3 border-2 border-teal-400/60 bg-gradient-to-r from-teal-500/20 via-sky-500/10 to-fuchsia-500/15 px-3 py-3 text-left shadow-[0_0_24px_rgba(45,212,191,0.15)]"
  >
    <img src="/team/devs-square.jpg" alt="ROSE developers" className="h-14 w-14 shrink-0 rounded-full border-2 border-teal-400 object-cover object-top" />
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-bold tracking-[0.18em] text-teal-300">ADMIN · ROSE</span>
      <span className="block text-[20px] font-extrabold tracking-wide text-white">MYROSEBD.COM</span>
      <span className="block truncate text-[11.5px] text-slate-300">{C.admin} · {C.phones.join(' · ')}</span>
    </span>
    <span className="shrink-0 border border-teal-400/60 px-2 py-1 text-[10px] font-bold tracking-wider text-teal-200">OPEN ›</span>
  </button>
);

const Row: React.FC<{ icon: React.ReactNode; label: string; value: string; href?: string; extra?: React.ReactNode }> = ({ icon, label, value, href, extra }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-teal-500/15 text-teal-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-bold tracking-wider text-slate-400">{label}</span>
        {href ? <a href={href} className="block truncate text-[14px] font-semibold text-white">{value}</a> : <span className="block truncate text-[14px] font-semibold text-white">{value}</span>}
      </span>
      {extra}
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        className="flex h-9 min-w-[44px] items-center justify-center bg-white/10 px-2 text-[10px] font-bold text-white"
      >
        {copied ? 'OK' : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

/** myrosebd.com page: admin details and the numbers/emails people use to contact ROSE. */
export const AdminBrandPage: React.FC = () => (
  <div className="space-y-2">
    {/* the developers' banner (full picture, nothing cut), then the site link */}
    <div className="overflow-hidden border border-teal-500/30">
      <img src="/team/banner.jpg" alt="ROSE web developers" className="block h-auto w-full" />
      <a href={C.url} target="_blank" rel="noreferrer" className="block py-2 text-center text-[13px] text-teal-300 underline">{C.site}</a>
    </div>
    <p className="px-1 pt-1 text-[11px] font-bold tracking-wider text-slate-400">ADMIN</p>
    <Row icon={<span className="text-sm font-bold">MY</span>} label="NAME" value={C.admin} extra={<span className="text-[10px] text-slate-400">{C.role}</span>} />
    <p className="px-1 pt-1 text-[11px] font-bold tracking-wider text-slate-400">CONTACT NUMBERS</p>
    {C.phones.map((p, i) => (
      <Row
        key={p}
        icon={<Phone className="h-4 w-4" />}
        label={`PHONE ${i + 1}`}
        value={p}
        href={`tel:${p}`}
        extra={<a href={`https://wa.me/${bdIntl(p)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center bg-emerald-600 text-white"><MessageCircle className="h-4 w-4" /></a>}
      />
    ))}
    <p className="px-1 pt-1 text-[11px] font-bold tracking-wider text-slate-400">EMAIL</p>
    {C.emails.map((e) => <Row key={e} icon={<Mail className="h-4 w-4" />} label={e.endsWith('gmail.com') ? 'GMAIL' : 'ROSE MAIL'} value={e} href={`mailto:${e}`} />)}
    <p className="px-1 pt-1 text-[11px] font-bold tracking-wider text-slate-400">WEBSITE & ADDRESS</p>
    <Row icon={<Globe className="h-4 w-4" />} label="WEBSITE" value={C.site} href={C.url} />
    <Row icon={<MapPin className="h-4 w-4" />} label="ADDRESS" value={C.address} />
    <p className="px-1 pt-2 text-[11px] text-slate-400">Call or WhatsApp for help with ROSE, your store, plans or payments.</p>
  </div>
);

/** 22 SITE SWITCHES: the admin turns ROSE branding on stores on or off. */
const SWITCHES: Array<[string, string, string]> = [
  ['store_footer_made_with_rose', 'MADE WITH ROSE IN STORE FOOTER', 'Master switch for ALL stores. To hide it for one store only, open 21 WEBSITE ACCESS and use the switch under that store.'],
  ['store_admin_rose_card', 'ROSE SUPPORT CARD IN STORE ADMIN', 'Big ROSE card at the top of every store owner’s admin, with your numbers and WhatsApp.'],
  ['app_rose_card', 'ROSE SUPPORT CARD IN THE APP', 'ROSE card at the top of Settings for every Personal, Student and Business user.'],
];
const LINKS: Array<[string, string, string]> = [
  ['apk_url', 'ANDROID APK LINK', 'https://www.myrosebd.com/rose.apk'],
  ['play_url', 'GOOGLE PLAY LINK (when live)', 'https://play.google.com/store/apps/details?id=...'],
  ['windows_url', 'MICROSOFT STORE LINK (when live)', 'https://apps.microsoft.com/...'],
];
export const AdminSiteSwitchesPage: React.FC = () => {
  const [vals, setVals] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  React.useEffect(() => {
    void supabase.from('site_settings').select('key, value').then(({ data }) => {
      const v: Record<string, boolean> = {};
      ((data as Array<{ key: string; value: unknown }>) || []).forEach((r) => { v[r.key] = r.value !== false; });
      setVals(v);
    });
  }, []);
  const [links, setLinks] = useState<Record<string, string>>({});
  React.useEffect(() => {
    void supabase.from('site_settings').select('key, value').in('key', LINKS.map((l) => l[0])).then(({ data }) => {
      const v: Record<string, string> = {};
      ((data as Array<{ key: string; value: unknown }>) || []).forEach((r) => { if (typeof r.value === 'string') v[r.key] = r.value; });
      setLinks(v);
    });
  }, []);
  const saveLink = async (k: string) => {
    const v = links[k] || '';
    if (v && !/^https:\/\/\S+$/.test(v)) return setMsg('Link must start with https://');
    const { error } = v
      ? await supabase.from('site_settings').upsert({ key: k, value: v, updated_at: new Date().toISOString() })
      : await supabase.from('site_settings').delete().eq('key', k);
    setMsg(error ? error.message : v ? 'Link saved. The website shows it now.' : 'Link removed.');
  };
  const flip = async (k: string) => {
    const next = !(vals[k] !== false);
    setVals((v) => ({ ...v, [k]: next }));
    const { error } = await supabase.from('site_settings').upsert({ key: k, value: next, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : next ? 'Turned ON for all stores.' : 'Turned OFF for all stores.');
  };
  return (
    <div className="space-y-2">
      {SWITCHES.map(([k, t, d]) => {
        const on = vals[k] !== false;
        return (
          <div key={k} className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold tracking-wide text-white">{t}</span>
              <span className="block text-[11px] text-slate-400">{d}</span>
            </span>
            <button type="button" role="switch" aria-checked={on} onClick={() => void flip(k)} className={`relative h-7 w-12 shrink-0 ${on ? 'bg-teal-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-1 h-5 w-5 bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        );
      })}
      <p className="px-1 pt-2 text-[11px] font-bold tracking-wider text-slate-400">DOWNLOAD LINKS ON THE WEBSITE</p>
      {LINKS.map(([k, t, ph]) => (
        <div key={k} className="space-y-1 border border-white/10 bg-white/[0.03] p-3">
          <span className="block text-[12px] font-bold text-white">{t}</span>
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] text-white" value={links[k] || ''} placeholder={ph} onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value.trim() }))} />
            <button type="button" onClick={() => void saveLink(k)} className="bg-teal-600 px-3 text-[11px] font-bold text-white">SAVE</button>
          </div>
        </div>
      ))}
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};

/** ROSE SUPPORT card for users (Settings top) and store owners (store admin top). */
export const RoseSupportCard: React.FC<{ onOpen: () => void; open?: boolean }> = ({ onOpen, open }) => (
  <button type="button" onClick={onOpen} data-testid="rose-support-card" className="flex min-h-[72px] w-full items-center gap-3 border border-teal-400/50 bg-gradient-to-r from-teal-500/15 to-fuchsia-500/10 p-3 text-left">
    <img src="/team/devs-square.jpg" alt="ROSE developers" className="h-12 w-12 shrink-0 rounded-full border-2 border-teal-400 object-cover object-top" />
    <span className="min-w-0 flex-1">
      <span className="block text-[10.5px] font-bold tracking-[0.16em] text-teal-300">ROSE SUPPORT</span>
      <span className="block text-[16px] font-extrabold text-white">MYROSEBD.COM</span>
      <span className="block text-[11px] text-slate-300">Help · call or WhatsApp ROSE · plans</span>
    </span>
    <span className="text-[10px] font-bold text-teal-200">{open ? 'CLOSE ×' : 'OPEN ›'}</span>
  </button>
);
