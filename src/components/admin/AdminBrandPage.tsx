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
    <img src={C.photo} alt="ROSE" className="h-14 w-14 shrink-0 rounded-full border-2 border-teal-400 object-cover object-[center_30%]" />
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
    <div className="flex flex-col items-center gap-2 border border-teal-500/30 bg-gradient-to-b from-teal-500/15 to-transparent p-4 text-center">
      <img src={C.photo} alt="ROSE" className="h-20 w-20 rounded-full border-2 border-teal-400 object-cover object-[center_30%]" />
      <p className="text-lg font-bold tracking-wide text-white">{C.brand}</p>
      <a href={C.url} target="_blank" rel="noreferrer" className="text-[13px] text-teal-300 underline">{C.site}</a>
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
    <p className="px-1 pt-2 text-[11px] text-slate-400">These numbers and emails also show on the website, so store owners and customers can contact ROSE.</p>
  </div>
);

/** 24 SITE SWITCHES: the admin turns ROSE branding on stores on or off. */
const SWITCHES: Array<[string, string, string]> = [
  ['store_footer_made_with_rose', 'MADE WITH ROSE IN STORE FOOTER', 'Small ROSE photo + "Made with ROSE · myrosebd.com" at the bottom of every store. Tap opens ROSE contact.'],
  ['store_admin_rose_card', 'ROSE SUPPORT CARD IN STORE ADMIN', 'Big ROSE card at the top of every store owner’s admin, with your numbers and WhatsApp.'],
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
      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};
