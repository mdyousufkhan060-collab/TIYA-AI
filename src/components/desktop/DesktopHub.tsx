import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Camera,
  CameraOff,
  CreditCard,
  FileText,
  LogIn,
  Package,
  UserPlus,
  X,
  CheckCircle2,
  Crown,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Send,
  Settings,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  XCircle,
  Flag,
  Trash2,
  Menu,
  Store,
  Plus,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { loadProfilesByEmail, loadProfilesById } from '../admin/UserAvatar';
import { AGENTS, AgentTask, agentById } from '../../lib/agents';
import { ChatMessage, VoiceState } from '../../types/tiya';
import { TeamPanel } from '../team/TeamPanel';
import { MessageActions } from '../MessageActions';
import { ReportSheet } from '../ReportSheet';
import { MiniFace } from '../MiniFace';

/**
 * PC layout (wide screens). One top bar (no duplicate buttons), the centre shows
 * DASHBOARD / TEAM / APP, the right side shows ROSE with the chat box.
 * Small windows and phones keep the normal mobile app.
 */
export type DesktopTab = 'dashboard' | 'team' | 'writer' | 'app' | 'admin';

// ---------- camera preview (real camera, nothing is recorded or uploaded) ----------
const CameraModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setErr('Camera blocked. Allow camera access in the browser (lock icon next to the address).'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[560px] overflow-hidden rounded-[12px] border border-white/10 bg-[#120F22]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <Camera className="h-4 w-4 text-fuchsia-300" /> Camera
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="h-8 rounded-[6px] border border-white/15 px-3 text-[11px] text-slate-200">
              SWITCH
            </button>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/15 text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {err ? (
          <p className="px-4 pb-6 text-sm text-rose-300">{err}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full bg-black object-cover" />
        )}
      </div>
    </div>
  );
};

/** Round voice orb: tap to talk; dots bounce while ROSE listens or speaks */
const VoiceOrb: React.FC<{ on: boolean; state: string; onClick: () => void }> = ({ on, state, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={on ? 'Stop voice' : 'Talk to ROSE'}
    className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all ${
      on
        ? 'bg-gradient-to-br from-fuchsia-500 to-violet-700 shadow-[0_0_26px_#c026d3]'
        : 'bg-gradient-to-br from-violet-600/70 to-fuchsia-700/70 shadow-[0_0_14px_-4px_#a855f7] hover:shadow-[0_0_20px_#a855f7]'
    }`}
  >
    {on && <span className="absolute inset-0 animate-ping rounded-full bg-fuchsia-500/30" />}
    <span className="relative flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-white ${on ? 'animate-bounce' : ''}`}
          style={{ height: on ? `${[10, 16, 12, 8][i]}px` : '5px', animationDelay: `${i * 0.12}s`, animationDuration: state === 'speaking' ? '0.6s' : '0.9s' }}
        />
      ))}
    </span>
  </button>
);

// ---------- top bar ----------
export const DesktopTopBar: React.FC<{
  onMenu: () => void;
  unread: number;
  onBell: () => void;
  voiceOn: boolean;
  voiceState?: string;
  onVoice: () => void;
  onMicSettings: () => void;
  email?: string | null;
  avatar?: string | null;
  onSignOut: () => void;
}> = ({ onMenu, unread, onBell, voiceOn, voiceState = 'idle', onVoice, onMicSettings, email, avatar, onSignOut }) => {
  const [camOpen, setCamOpen] = useState(false);
  const round = 'flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-slate-200 hover:border-white/35';
  return (
    // order everywhere: ☰ · logo · name · then the extra buttons on the right
    <header className="col-span-3 flex h-14 items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#0D0B1A]/90 px-2">
      <button type="button" aria-label="Menu" onClick={onMenu} className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white hover:bg-white/[0.06]">
        <Menu className="h-5 w-5" />
      </button>
      <img src="/agents/rose.png?v=3" alt="ROSE" className="h-9 w-9 rounded-full border-2 border-fuchsia-400/70 object-cover" />
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-[0.25em] text-white">ROSE</p>
        <p className="text-[10px] text-slate-400">myrosebd.com</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/25 py-1 pl-1 pr-1">
        <VoiceOrb on={voiceOn} state={voiceState} onClick={onVoice} />
        <button type="button" onClick={onMicSettings} title="Microphone" className={round}>
          {voiceOn ? <Mic className="h-4 w-4 text-fuchsia-300" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setCamOpen(true)} title="Camera" className={round}>
          {camOpen ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onBell} title="Notifications" className={`relative ${round}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        <span className="mx-0.5 h-6 w-px bg-white/10" />
        <span title={email || ''} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 p-[2px]">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0D0B1A] text-[11px] font-bold text-white">
              {(email || '?')[0].toUpperCase()}
            </span>
          )}
        </span>
        <button type="button" onClick={onSignOut} title="Sign out" className={`${round} hover:border-rose-400/60 hover:text-rose-300`}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      {camOpen && <CameraModal onClose={() => setCamOpen(false)} />}
    </header>
  );
};

// ---------- left menu (PC). The same bars as the phone open from here ----------
export type DesktopNav = 'dashboard' | 'bars' | 'website' | 'writer' | 'admin';
export const DesktopSideNav: React.FC<{ active: DesktopNav; isAdmin: boolean; onPick: (k: DesktopNav) => void; onSignOut: () => void }> = ({ active, isAdmin, onPick, onSignOut }) => {
  const items: Array<[DesktopNav, string, React.ReactNode]> = [
    ['dashboard', 'Dashboard', <LayoutDashboard key="d" className="h-4 w-4" />],
    ['bars', 'ROSE bars', <Settings key="b" className="h-4 w-4" />],
    ['website', 'Website admin', <Store key="w" className="h-4 w-4" />],
    ['writer', 'Writer', <FileText key="r" className="h-4 w-4" />],
  ];
  if (isAdmin) items.push(['admin', 'Admin panel', <Crown key="a" className="h-4 w-4" />]);
  return (
    <aside className="col-start-1 row-start-2 flex min-h-0 w-[210px] flex-col gap-1 overflow-y-auto rounded-[10px] border border-white/[0.08] bg-[#0D0B1A] p-2.5">
      <p className="px-2 pb-1 pt-1 text-[10px] font-bold tracking-[0.2em] text-slate-500">MENU</p>
      {items.map(([k, label, icon]) => (
        <button
          key={k}
          type="button"
          onClick={() => onPick(k)}
          className={`flex h-10 items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] font-semibold ${
            active === k ? (k === 'admin' ? 'bg-amber-300/15 text-amber-200' : 'bg-violet-600/20 text-white') : 'text-slate-300 hover:bg-white/[0.05]'
          }`}
        >
          {icon} {label}
        </button>
      ))}
      <button type="button" onClick={onSignOut} className="mt-auto flex h-10 items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-rose-300">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </aside>
  );
};

// ---------- data for the dashboard ----------
interface Tile {
  label: string;
  value: string;
  icon: React.ReactNode;
  grad: string;
}

export interface FeedItem {
  id: string;
  at: string;
  text: string;
  who: string;
  color: string;
  photo?: string;
  icon?: React.ReactNode;
  state?: 'done' | 'failed' | 'working' | 'info';
}

function useDashboardData(userId: string, isAdmin: boolean) {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [series, setSeries] = useState<{ label: string; value: number }[]>([]);
  const [seriesName, setSeriesName] = useState('');
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data: biz }, { data: t }] = await Promise.all([
        supabase.rpc('business_dashboard'),
        supabase.from('agent_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
      ]);
      if (!alive) return;
      const taskList = (t as AgentTask[]) || [];
      setTasks(taskList);
      const items: FeedItem[] = taskList.slice(0, 30).map((x) => {
        const a = agentById(x.agent);
        return {
          id: `t_${x.id}`,
          at: x.updated_at,
          who: a.name,
          color: a.color,
          photo: a.photo,
          text: x.title,
          state: x.status === 'done' ? 'done' : x.status === 'failed' ? 'failed' : 'working',
        };
      });
      const pending = taskList.filter((x) => x.status === 'working' || x.status === 'queued').length;
      const tk = (n: number) => `৳${Number(n || 0).toLocaleString('en-IN')}`;
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' });

      if (biz && (biz as any).ok) {
        const b = biz as any;
        setTiles([
          { label: 'Total Orders', value: String(b.orders_total), icon: <ShoppingCart className="h-5 w-5" />, grad: 'from-violet-600 to-fuchsia-600' },
          { label: 'Revenue (30 days)', value: tk(b.sales_month), icon: <Wallet className="h-5 w-5" />, grad: 'from-emerald-500 to-green-600' },
          { label: 'Customers', value: String(b.customers), icon: <Users className="h-5 w-5" />, grad: 'from-blue-500 to-indigo-600' },
          { label: 'Pending Orders', value: String(b.orders_pending), icon: <Activity className="h-5 w-5" />, grad: 'from-amber-500 to-orange-500' },
          { label: 'Team Tasks Running', value: String(pending), icon: <ListChecks className="h-5 w-5" />, grad: 'from-cyan-500 to-sky-600' },
        ]);
        const since = dayKey(days[0]);
        const { data: orders } = await supabase
          .from('business_orders')
          .select('total,created_at,status')
          .gte('created_at', since)
          .neq('status', 'cancelled')
          .limit(2000);
        if (!alive) return;
        const [{ data: recentOrders }, { data: appr }] = await Promise.all([
          supabase.from('business_orders').select('id,total,status,note,created_at,updated_at').order('updated_at', { ascending: false }).limit(15),
          supabase.from('business_approvals').select('id,kind,message,status,created_at').order('created_at', { ascending: false }).limit(10),
        ]);
        if (!alive) return;
        (recentOrders || []).forEach((o: any) =>
          items.push({
            id: `o_${o.id}`,
            at: o.updated_at || o.created_at,
            who: 'ORDER',
            color: '#60A5FA',
            icon: <Package className="h-4 w-4" />,
            text: `${tk(o.total)} · ${String(o.status).toUpperCase()}${o.note ? ` · ${String(o.note).slice(0, 40)}` : ''}`,
            state: o.status === 'cancelled' ? 'failed' : o.status === 'delivered' ? 'done' : 'info',
          }),
        );
        (appr || []).forEach((a: any) =>
          items.push({
            id: `a_${a.id}`,
            at: a.created_at,
            who: 'APPROVAL',
            color: '#FBBF24',
            icon: <CheckCircle2 className="h-4 w-4" />,
            text: `${String(a.kind).toUpperCase()} · ${String(a.message || '').slice(0, 50)} · ${String(a.status).toUpperCase()}`,
            state: a.status === 'approved' ? 'done' : a.status === 'rejected' ? 'failed' : 'working',
          }),
        );
        setSeriesName('Sales, last 7 days (৳)');
        setSeries(
          days.map((d) => ({
            label: dayLabel(d),
            value: (orders || []).filter((o: any) => o.created_at.slice(0, 10) === dayKey(d)).reduce((s: number, o: any) => s + Number(o.total || 0), 0),
          })),
        );
      } else if (isAdmin) {
        const { data: ov } = await supabase.rpc('admin_overview');
        if (!alive) return;
        const o = (ov as any) || {};
        setTiles([
          { label: 'Total Users', value: String(o.users ?? 0), icon: <Users className="h-5 w-5" />, grad: 'from-violet-600 to-fuchsia-600' },
          { label: 'Premium Users', value: String(o.premium ?? 0), icon: <Crown className="h-5 w-5" />, grad: 'from-emerald-500 to-green-600' },
          { label: 'Business Users', value: String(o.business ?? 0), icon: <ShoppingCart className="h-5 w-5" />, grad: 'from-blue-500 to-indigo-600' },
          { label: 'Active (24h)', value: String(o.active_24h ?? 0), icon: <Activity className="h-5 w-5" />, grad: 'from-amber-500 to-orange-500' },
          { label: 'Team Tasks Running', value: String(pending), icon: <ListChecks className="h-5 w-5" />, grad: 'from-cyan-500 to-sky-600' },
        ]);
        const since = dayKey(days[0]);
        const [{ data: logins }, { data: pays }, { data: newUsers }] = await Promise.all([
          supabase.from('login_events').select('id,email,event,platform,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
          supabase.from('payment_requests').select('id,user_id,plan_name,amount_bdt,method,status,created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('profiles').select('id,email,full_name,avatar_url,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        ]);
        if (!alive) return;
        const byMail = await loadProfilesByEmail((logins || []).slice(0, 25).map((l: any) => l.email));
        const byId = await loadProfilesById((pays || []).map((p: any) => p.user_id));
        if (!alive) return;
        (logins || []).slice(0, 25).forEach((l: any) =>
          items.push({
            id: `l_${l.id}`,
            at: l.created_at,
            who: l.event === 'login' ? 'LOGIN' : l.event === 'signup' ? 'SIGN UP' : String(l.event).toUpperCase().replace('_', ' '),
            color: l.event === 'forced_logout' ? '#FB7185' : '#34D399',
            icon: <LogIn className="h-4 w-4" />,
            photo: byMail.get(String(l.email || '').toLowerCase())?.avatar_url || undefined,
            text: `${byMail.get(String(l.email || '').toLowerCase())?.full_name || l.email || 'user'}${l.platform ? ` · ${l.platform}` : ''}`,
            state: 'info',
          }),
        );
        (newUsers || []).forEach((u: any) =>
          items.push({ id: `u_${u.id}`, at: u.created_at, who: 'NEW USER', color: '#A78BFA', icon: <UserPlus className="h-4 w-4" />, photo: u.avatar_url || undefined, text: u.full_name ? `${u.full_name} · ${u.email}` : u.email || 'new account', state: 'info' }),
        );
        (pays || []).forEach((p: any) =>
          items.push({
            id: `p_${p.id}`,
            at: p.created_at,
            who: 'PAYMENT',
            color: '#FBBF24',
            icon: <CreditCard className="h-4 w-4" />,
            photo: byId.get(p.user_id)?.avatar_url || undefined,
            text: `${byId.get(p.user_id)?.full_name || byId.get(p.user_id)?.email || ''} · ${p.plan_name} · ${tk(p.amount_bdt)} · ${p.method} · ${String(p.status).toUpperCase()}`,
            state: p.status === 'approved' ? 'done' : p.status === 'rejected' ? 'failed' : 'working',
          }),
        );
        setSeriesName('Logins, last 7 days');
        setSeries(
          days.map((d) => ({
            label: dayLabel(d),
            value: (logins || []).filter((l: any) => l.event === 'login' && l.created_at.slice(0, 10) === dayKey(d)).length,
          })),
        );
      } else {
        setTiles([]);
      }
      items.sort((a, b) => (a.at < b.at ? 1 : -1));
      if (alive) setFeed(items.slice(0, 40));
    };
    void load();
    const ch = supabase
      .channel(`dash_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_approvals' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_events' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => void load())
      .subscribe();
    const timer = window.setInterval(load, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      void supabase.removeChannel(ch);
    };
  }, [userId, isAdmin]);

  return { tiles, series, seriesName, tasks, feed };
}

// ---------- small SVG area chart ----------
const AreaChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const W = 560;
  const H = 190;
  const pad = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1), H - pad - (d.value / max) * (H - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const area = `${line} L${pts[pts.length - 1]?.[0] ?? pad},${H - pad} L${pad},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      <defs>
        <linearGradient id="roseArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2)} y2={pad + f * (H - pad * 2)} stroke="rgba(255,255,255,0.06)" />
      ))}
      {data.length > 1 && <path d={area} fill="url(#roseArea)" />}
      {data.length > 1 && <path d={line} fill="none" stroke="#c084fc" strokeWidth="2.5" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4" fill="#0D0B1A" stroke="#e9d5ff" strokeWidth="2" />
          <text x={p[0]} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
            {data[i].label}
          </text>
        </g>
      ))}
      <text x={pad} y={14} fontSize="10" fill="#64748b">
        max {max.toLocaleString('en-IN')}
      </text>
    </svg>
  );
};

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB');
};

// ---------- dashboard ----------
type RecentOrder = { id: string; order_no: number | string; customer_name: string; total: number; status: string; created_at: string };
const STATUS_TONE: Record<string, string> = { new: 'text-sky-300', confirmed: 'text-violet-300', shipped: 'text-amber-300', delivered: 'text-emerald-300', cancelled: 'text-rose-300', returned: 'text-rose-300' };
export const DesktopDashboard: React.FC<{ userId: string; isAdmin: boolean; onOpenTeam: () => void; onAction?: (k: 'product' | 'orders' | 'shop' | 'bars') => void }> = ({ userId, isAdmin, onAction }) => {
  const { tiles, series, seriesName } = useDashboardData(userId, isAdmin);
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  useEffect(() => {
    let gone = false;
    void (async () => {
      const [{ data: own }, { data: staff }] = await Promise.all([
        supabase.from('stores').select('id').eq('owner_id', userId),
        supabase.rpc('my_staff_stores'),
      ]);
      const ids = [...((own as Array<{ id: string }>) || []).map((x) => x.id), ...((staff as Array<{ store_id: string }>) || []).map((x) => x.store_id)];
      if (!ids.length) { if (!gone) setOrders([]); return; }
      const { data } = await supabase.from('store_orders').select('id,order_no,customer_name,total,status,created_at').in('store_id', ids).order('created_at', { ascending: false }).limit(6);
      if (!gone) setOrders((data as RecentOrder[]) || []);
    })();
    return () => { gone = true; };
  }, [userId]);
  const card = 'rounded-[10px] border border-white/[0.08] bg-[#120F22]';
  const quick: Array<['product' | 'orders' | 'shop' | 'bars', string, React.ReactNode]> = [
    ['product', 'Add product', <Plus key="p" className="h-4 w-4" />],
    ['orders', 'See orders', <ShoppingCart key="o" className="h-4 w-4" />],
    ['shop', 'Open my shop', <ExternalLink key="s" className="h-4 w-4" />],
    ['bars', 'ROSE bars', <Settings key="b" className="h-4 w-4" />],
  ];
  return (
    <div className="tiya-scroll flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      {/* numbers */}
      {tiles === null ? (
        <div className="flex h-20 items-center justify-center text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tiles.length === 0 ? (
        <div className={`${card} p-4 text-sm text-slate-300`}>Set up your shop or Business Profile (ROSE bars → WORKSPACE) to see sales, orders and customers here.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {tiles.map((t) => (
            <div key={t.label} className={`${card} flex items-center gap-3 p-3.5`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br ${t.grad} text-white`}>{t.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] text-slate-400">{t.label}</span>
                <span className="block truncate text-xl font-extrabold text-white">{t.value}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* the one big chart */}
      <section className={`${card} flex min-h-[260px] flex-col p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <LayoutDashboard className="h-4 w-4 text-violet-400" /> Sales overview
          <span className="ml-auto text-[10.5px] font-normal text-slate-400">{seriesName}</span>
        </h3>
        <div className="mt-2 min-h-[200px] flex-1">{series.length > 0 && <AreaChart data={series} />}</div>
      </section>

      {/* recent orders + quick actions */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <section className={`${card} p-4`}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
            <Package className="h-4 w-4 text-sky-400" /> Recent orders
            <button type="button" onClick={() => onAction?.('orders')} className="ml-auto text-[11px] font-bold text-violet-300">View all →</button>
          </h3>
          {orders === null ? (
            <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No orders yet. New website orders show here.</p>
          ) : (
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] tracking-wider text-slate-500">
                  <th className="py-1.5 font-semibold">ORDER</th><th className="font-semibold">CUSTOMER</th><th className="font-semibold">TOTAL</th><th className="font-semibold">STATUS</th><th className="text-right font-semibold">WHEN</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-white/[0.06] text-slate-200">
                    <td className="py-2 font-mono text-[11.5px]">#{o.order_no}</td>
                    <td className="max-w-[160px] truncate">{o.customer_name || '—'}</td>
                    <td>{Math.round(Number(o.total) || 0).toLocaleString('en-US')} Tk</td>
                    <td className={`text-[11px] font-bold uppercase ${STATUS_TONE[o.status] || 'text-slate-300'}`}>{o.status}</td>
                    <td className="text-right text-[11px] text-slate-500">{ago(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className={`${card} p-4`}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
            <MessageCircle className="h-4 w-4 text-fuchsia-400" /> Quick actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {quick.map(([k, label, icon]) => (
              <button key={k} type="button" onClick={() => onAction?.(k)} className="flex h-16 flex-col items-center justify-center gap-1 rounded-[8px] border border-white/[0.08] bg-black/20 text-[12px] font-semibold text-slate-200 hover:border-violet-400/50">
                {icon} {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Or just tell ROSE on the right, by voice or typing.</p>
        </section>
      </div>
    </div>
  );
};

// ---------- team tab ----------
export const DesktopTeam: React.FC<{ userId: string; email?: string | null }> = ({ userId, email }) => (
  <div className="flex h-full">
    <TeamPanel userId={userId} ownerEmail={email} full />
  </div>
);

// ---------- right side: full chat, ROSE picture as a soft background ----------
export const DesktopRosePanel: React.FC<{
  messages: ChatMessage[];
  isSending: boolean;
  voiceState: VoiceState;
  onSend: (t: string) => void;
  onVoice: () => void;
  /** send a ROSE reply into the WRITER */
  onToWriter?: (text: string) => void;
  onClear?: () => void;
  userAvatar?: string | null;
  userName?: string;
  apiKey?: string;
  voiceName?: string;
}> = ({ messages, isSending, voiceState, onSend, onVoice, onToWriter, onClear, userAvatar, userName, apiKey, voiceName }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const recent = messages.slice(-60);
  const voiceOn = ['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [recent.length, isSending]);

  const send = () => {
    const v = text.trim();
    if (!v || isSending) return;
    setText('');
    onSend(v);
  };

  return (
    <aside className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#120F22]">
      {/* ROSE as a soft watermark behind the whole chat */}
      <img src="/tiya-home.jpg?v=3" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-[center_38%] opacity-35 blur-[3px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120F22]/70 via-[#120F22]/55 to-[#120F22]/90" />

      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-3 py-2.5 backdrop-blur-sm">
        <img src="/agents/rose.png?v=3" alt="ROSE" className="h-10 w-10 rounded-full border-2 border-fuchsia-400 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-[0.25em] text-white">ROSE</p>
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${voiceOn ? 'animate-pulse' : ''}`} />
            {voiceOn ? voiceState.toUpperCase() : 'ONLINE'}
          </p>
        </div>
        {onClear && recent.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Delete all chat messages?')) onClear();
            }}
            title="Delete chat"
            aria-label="Delete chat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-slate-300 hover:border-rose-400/60 hover:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={listRef} className="tiya-scroll relative min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Say hello to ROSE.</p>
        ) : (
          recent.map((m) => (
            <div key={m.id} className={`group flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'user' ? (
                <MiniFace src={userAvatar} name={userName} />
              ) : (
                <MiniFace src="/agents/rose.png?v=3" name="ROSE" rose />
              )}
              <div className="max-w-[82%]">
                <p
                  className={`whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[13px] leading-relaxed shadow-lg ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                      : 'border border-white/10 bg-[#1A1530]/85 text-slate-100 backdrop-blur-sm'
                  }`}
                >
                  {m.text}
                </p>
                {m.role !== 'user' && m.text.trim() && (() => {
                  const i = recent.findIndex((x) => x.id === m.id);
                  const prevUser = [...recent.slice(0, i)].reverse().find((x) => x.role === 'user');
                  return (
                    <MessageActions
                      compact
                      apiKey={apiKey}
                      voiceName={voiceName}
                      text={m.text}
                      question={prevUser?.text}
                      onRegenerate={prevUser && !isSending ? () => onSend(prevUser.text) : undefined}
                    />
                  );
                })()}
                {m.role !== 'user' && onToWriter && m.text.length > 40 && (
                  <button
                    type="button"
                    onClick={() => onToWriter(m.text)}
                    className="mt-0.5 hidden text-[10px] font-bold text-fuchsia-300 group-hover:inline"
                  >
                    OPEN IN WRITER →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {isSending && (
          <p className="flex items-center gap-1 text-[11px] text-slate-300">
            ROSE is typing
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </p>
        )}
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} page="pc-chat" />
      <div className="relative flex shrink-0 gap-2 border-t border-white/[0.08] p-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          title="Report a problem"
          aria-label="Report a problem"
          className="flex h-11 w-8 shrink-0 items-center justify-center text-slate-400 hover:text-rose-300"
        >
          <Flag className="h-4 w-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm text-white placeholder:text-slate-400 focus:border-fuchsia-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || isSending}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
