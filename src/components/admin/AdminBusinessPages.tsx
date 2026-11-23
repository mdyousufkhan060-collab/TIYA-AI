import React, { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronDown, Loader2, Mail, MapPin, Phone, Power, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserAvatar, UserChip, loadProfilesById, type MiniProfile } from './UserAvatar';
import { agentById } from '../../lib/agents';

/** 16 BUSINESSES: every business with full owner contact, on/off switch and quick actions. */
interface BizRow {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  owner_name: string | null;
  owner_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  emergency_phone: string | null;
  notify_email: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  website: string | null;
  facebook_page: string | null;
  created_at: string;
}

interface OwnerInfo {
  full_name?: string | null;
  avatar_url?: string | null;
  id: string;
  email: string | null;
  business_access: boolean | null;
  last_seen_at: string | null;
  paid_until: string | null;
}

const box = 'rounded-[4px] border border-white/[0.08] bg-[#11151E]';
const digits = (s: string) => s.replace(/[^\d+]/g, '');

const BizCard: React.FC<{ b: BizRow; owner?: OwnerInfo; onChanged: () => void }> = ({ b, owner, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [counts, setCounts] = useState<{ products: number; orders: number; customers: number } | null>(null);

  useEffect(() => {
    if (!open || counts) return;
    void Promise.all([
      supabase.from('business_products').select('id', { count: 'exact', head: true }).eq('business_id', b.id),
      supabase.from('business_orders').select('id', { count: 'exact', head: true }).eq('business_id', b.id),
      supabase.from('business_customers').select('id', { count: 'exact', head: true }).eq('business_id', b.id),
    ]).then(([p, o, c]) => setCounts({ products: p.count || 0, orders: o.count || 0, customers: c.count || 0 }));
  }, [open, counts, b.id]);

  const accessOn = owner?.business_access !== false;

  const toggleAccess = async () => {
    setBusy(true);
    setMsg('');
    const { error } = await supabase.from('profiles').update({ business_access: !accessOn }).eq('id', b.owner_id);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(accessOn ? 'Business features turned OFF for this owner.' : 'Business features turned ON.');
    onChanged();
  };

  const notify = async () => {
    if (!title.trim() || !body.trim()) return setMsg('Write a title and a message.');
    setBusy(true);
    const { error } = await supabase.rpc('admin_notify', { target: b.owner_id, t: title.trim(), b: body.trim() });
    setBusy(false);
    if (error) return setMsg(error.message);
    setTitle('');
    setBody('');
    setMsg('Notification sent.');
  };

  const call = b.emergency_phone || b.phone;
  const mail = b.notify_email || b.owner_email || owner?.email;

  return (
    <div className={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="relative shrink-0">
          <UserAvatar src={owner?.avatar_url} name={owner?.full_name || b.owner_name} email={owner?.email || b.owner_email} size={40} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#11151E] ${accessOn ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-white">{b.name}</span>
          <span className="block truncate text-[11px] text-slate-400">
            {b.owner_name || 'No owner name'} · {b.phone || 'no phone'}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-3.5 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {[
              ['CATEGORY', b.category],
              ['OWNER', b.owner_name],
              ['OWNER GMAIL', b.owner_email || owner?.email],
              ['REPORT EMAIL', b.notify_email],
              ['MOBILE', b.phone],
              ['WHATSAPP', b.whatsapp],
              ['EMERGENCY PHONE', b.emergency_phone],
              ['CITY', [b.city, b.postcode].filter(Boolean).join(' ')],
              ['WEBSITE', b.website],
              ['FACEBOOK', b.facebook_page],
              ['PREMIUM UNTIL', owner?.paid_until ? new Date(owner.paid_until).toLocaleDateString('en-GB') : 'FREE'],
              ['LAST SEEN', owner?.last_seen_at ? new Date(owner.last_seen_at).toLocaleString('en-GB') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[3px] bg-black/30 px-2 py-1.5">
                <p className="text-[9px] font-bold tracking-wider text-slate-500">{k}</p>
                <p className="break-words text-slate-100">{v || '—'}</p>
              </div>
            ))}
          </div>
          {b.address && (
            <p className="flex gap-2 rounded-[3px] bg-black/30 px-2 py-1.5 text-[11px] text-slate-100">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {b.address}
            </p>
          )}
          {counts && (
            <p className="text-[11px] text-slate-400">
              Products <b className="text-white">{counts.products}</b> · Orders <b className="text-white">{counts.orders}</b> · Customers{' '}
              <b className="text-white">{counts.customers}</b>
            </p>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            <a
              href={call ? `tel:${digits(call)}` : undefined}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-[4px] border text-[11px] font-bold ${call ? 'border-teal-400/60 text-teal-300' : 'pointer-events-none border-white/10 text-slate-600'}`}
            >
              <Phone className="h-3.5 w-3.5" /> CALL
            </a>
            <a
              href={mail ? `mailto:${mail}?subject=${encodeURIComponent(`ROSE: ${b.name}`)}` : undefined}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-[4px] border text-[11px] font-bold ${mail ? 'border-sky-400/60 text-sky-300' : 'pointer-events-none border-white/10 text-slate-600'}`}
            >
              <Mail className="h-3.5 w-3.5" /> EMAIL
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={toggleAccess}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-[4px] text-[11px] font-bold ${accessOn ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}
            >
              <Power className="h-3.5 w-3.5" /> {accessOn ? 'TURN OFF' : 'TURN ON'}
            </button>
          </div>

          <div className="space-y-1.5 rounded-[4px] border border-white/[0.06] p-2.5">
            <p className="text-[10px] font-bold tracking-wider text-slate-400">SEND NOTIFICATION TO OWNER</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="h-10 w-full rounded-[4px] border border-white/12 bg-[#0B0F16] px-3 text-xs text-white focus:outline-none"
            />
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message"
              className="w-full rounded-[4px] border border-white/12 bg-[#0B0F16] p-2.5 text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={notify}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[4px] bg-teal-500 text-[11px] font-bold text-black disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} SEND
            </button>
          </div>
          {msg && <p className="text-xs text-teal-300">{msg}</p>}
        </div>
      )}
    </div>
  );
};

export const AdminBusinessesPage: React.FC = () => {
  const [rows, setRows] = useState<BizRow[] | null>(null);
  const [owners, setOwners] = useState<Record<string, OwnerInfo>>({});
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: false }).limit(500);
    const list = (data as BizRow[]) || [];
    setRows(list);
    const ids = Array.from(new Set(list.map((b) => b.owner_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,email,full_name,avatar_url,business_access,last_seen_at,paid_until').in('id', ids);
      const map: Record<string, OwnerInfo> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p));
      setOwners(map);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!rows)
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );

  const term = q.trim().toLowerCase();
  const shown = rows.filter((b) =>
    !term
      ? true
      : [b.name, b.owner_name, b.owner_email, b.phone, b.city, b.category].some((v) => (v || '').toLowerCase().includes(term)),
  );
  const off = rows.filter((b) => owners[b.owner_id]?.business_access === false).length;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['BUSINESSES', rows.length],
          ['ACTIVE', rows.length - off],
          ['TURNED OFF', off],
        ].map(([k, v]) => (
          <div key={k as string} className={`${box} p-2.5`}>
            <p className="text-[9px] font-bold tracking-wider text-slate-400">{k}</p>
            <p className="font-mono text-lg font-bold text-white">{v}</p>
          </div>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, owner, phone, city"
          className="h-10 w-full rounded-[4px] border border-white/12 bg-[#0B0F16] pl-9 pr-3 text-xs text-white focus:outline-none"
        />
      </div>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-400">No businesses yet.</p>
      ) : (
        shown.map((b) => <BizCard key={b.id} b={b} owner={owners[b.owner_id]} onChanged={load} />)
      )}
    </div>
  );
};

/** 17 TEAM ACTIVITY: every ROSE team task from every user. */
export const AdminTeamActivityPage: React.FC = () => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [profs, setProfs] = useState<Map<string, MiniProfile>>(new Map());

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('agent_tasks').select('*').order('created_at', { ascending: false }).limit(150);
      const list = data || [];
      setRows(list);
      setProfs(await loadProfilesById(list.map((t: any) => t.user_id)));
    })();
  }, []);

  if (!rows)
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  if (!rows.length) return <p className="py-10 text-center text-xs text-slate-400">No team tasks yet.</p>;

  const tone: Record<string, string> = { done: 'text-emerald-300', failed: 'text-rose-300', working: 'text-amber-300', queued: 'text-slate-300' };
  return (
    <div className="space-y-1.5">
      {rows.map((t) => {
        const a = agentById(t.agent);
        return (
          <div key={t.id} className={`${box} px-3 py-2.5`} style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-extrabold tracking-wider" style={{ color: a.color }}>
                {a.name}
              </span>
              <span className={`font-bold uppercase ${tone[t.status] || ''}`}>{t.status}</span>
              <span className="ml-auto text-slate-500">{new Date(t.created_at).toLocaleString('en-GB')}</span>
            </div>
            <p className="mt-1 text-xs text-white">{t.title}</p>
            <div className="mt-1.5"><UserChip profile={profs.get(t.user_id)} fallback={t.user_id} size={26} /></div>
            {t.result && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-300">{t.result}</p>}
          </div>
        );
      })}
    </div>
  );
};
