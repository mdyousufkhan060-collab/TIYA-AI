import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Camera,
  CameraOff,
  CreditCard,
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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AGENTS, AgentTask, agentById } from '../../lib/agents';
import { ChatMessage, VoiceState } from '../../types/tiya';
import { TeamPanel } from '../team/TeamPanel';

/**
 * PC layout (wide screens). One top bar (no duplicate buttons), the centre shows
 * DASHBOARD / TEAM / APP, the right side shows ROSE with the chat box.
 * Small windows and phones keep the normal mobile app.
 */
export type DesktopTab = 'dashboard' | 'team' | 'app';

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
  tab: DesktopTab;
  onTab: (t: DesktopTab) => void;
  isAdmin: boolean;
  onAdmin: () => void;
  unread: number;
  onBell: () => void;
  voiceOn: boolean;
  voiceState?: string;
  onVoice: () => void;
  onMicSettings: () => void;
  email?: string | null;
  avatar?: string | null;
  onSignOut: () => void;
}> = ({ tab, onTab, isAdmin, onAdmin, unread, onBell, voiceOn, voiceState = 'idle', onVoice, onMicSettings, email, avatar, onSignOut }) => {
  const [camOpen, setCamOpen] = useState(false);
  const tabs: Array<[DesktopTab, string, React.ReactNode]> = [
    ['dashboard', 'Dashboard', <LayoutDashboard key="d" className="h-4 w-4" />],
    ['team', 'Team & Tasks', <ListChecks key="t" className="h-4 w-4" />],
    ['app', 'Settings', <Settings key="a" className="h-4 w-4" />],
  ];
  const round = 'flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-slate-200 hover:border-white/35';
  return (
    <header className="col-span-2 flex h-14 items-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#0D0B1A]/90 px-3">
      <div className="flex items-center gap-2 pr-1">
        <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-[8px]" />
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-[0.25em] text-white">ROSE</p>
          <p className="text-[9.5px] text-slate-400">Live Operations Hub</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onAdmin}
            className="ml-1 flex h-6 items-center gap-1 rounded-[5px] border border-amber-300/50 px-2 text-[10px] font-bold tracking-wider text-amber-200 hover:bg-amber-300/10"
          >
            <Crown className="h-3 w-3" /> ADMIN
          </button>
        )}
      </div>
      <nav className="flex items-center gap-1">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_20px_-6px_#a855f7]' : 'text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => setCamOpen(true)} title="Camera" className={round}>
          {camOpen ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onMicSettings} title="Microphone settings" className={round}>
          {voiceOn ? <Mic className="h-4 w-4 text-fuchsia-300" /> : <MicOff className="h-4 w-4" />}
        </button>
        <VoiceOrb on={voiceOn} state={voiceState} onClick={onVoice} />
        <button type="button" onClick={onBell} className={`relative ${round}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 rounded-[6px] border border-white/10 px-2 py-1">
          {avatar ? <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-violet-600" />}
          <span className="max-w-[150px] truncate text-[11px] text-slate-300">{email}</span>
        </div>
        <button type="button" onClick={onSignOut} title="Sign out" className={`${round} hover:text-rose-300`}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      {camOpen && <CameraModal onClose={() => setCamOpen(false)} />}
    </header>
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
          supabase.from('payment_requests').select('id,plan_name,amount_bdt,method,status,created_at').order('created_at', { ascending: false }).limit(10),
          supabase.from('profiles').select('id,email,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        ]);
        if (!alive) return;
        (logins || []).slice(0, 25).forEach((l: any) =>
          items.push({
            id: `l_${l.id}`,
            at: l.created_at,
            who: l.event === 'login' ? 'LOGIN' : l.event === 'signup' ? 'SIGN UP' : String(l.event).toUpperCase().replace('_', ' '),
            color: l.event === 'forced_logout' ? '#FB7185' : '#34D399',
            icon: <LogIn className="h-4 w-4" />,
            text: `${l.email || 'user'}${l.platform ? ` · ${l.platform}` : ''}`,
            state: 'info',
          }),
        );
        (newUsers || []).forEach((u: any) =>
          items.push({ id: `u_${u.id}`, at: u.created_at, who: 'NEW USER', color: '#A78BFA', icon: <UserPlus className="h-4 w-4" />, text: u.email || 'new account', state: 'info' }),
        );
        (pays || []).forEach((p: any) =>
          items.push({
            id: `p_${p.id}`,
            at: p.created_at,
            who: 'PAYMENT',
            color: '#FBBF24',
            icon: <CreditCard className="h-4 w-4" />,
            text: `${p.plan_name} · ${tk(p.amount_bdt)} · ${p.method} · ${String(p.status).toUpperCase()}`,
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
export const DesktopDashboard: React.FC<{ userId: string; isAdmin: boolean; onOpenTeam: () => void }> = ({ userId, isAdmin, onOpenTeam }) => {
  const { tiles, series, seriesName, tasks, feed } = useDashboardData(userId, isAdmin);

  const agentStats = useMemo(
    () =>
      AGENTS.map((a) => {
        const mine = tasks.filter((t) => t.agent === a.id);
        const done = mine.filter((t) => t.status === 'done').length;
        const working = mine.filter((t) => t.status === 'working' || t.status === 'queued').length;
        return { a, total: mine.length, done, working, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
      }),
    [tasks],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* stat tiles */}
      {tiles === null ? (
        <div className="flex h-24 items-center justify-center text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tiles.length === 0 ? (
        <div className="rounded-[10px] border border-white/[0.08] bg-[#120F22] p-4 text-sm text-slate-300">
          Set up your Business Profile (Settings → 07 WORKSPACE) to see sales, orders and customers here.
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="flex items-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#120F22] p-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br ${t.grad} text-white`}>{t.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] text-slate-400">{t.label}</span>
                <span className="block truncate text-xl font-extrabold text-white">{t.value}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* feed + chart */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.25fr] gap-3">
        <section className="tiya-scroll min-h-0 overflow-y-auto rounded-[10px] border border-white/[0.08] bg-[#120F22] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Activity className="h-4 w-4 text-fuchsia-400" /> Live Activity
              <span className="relative ml-1 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            </h3>
            <button type="button" onClick={onOpenTeam} className="text-[11px] font-bold text-fuchsia-300">
              View all →
            </button>
          </div>
          {feed.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">Nothing yet. New logins, orders, payments and team work appear here live.</p>
          ) : (
            <div className="space-y-1">
              {feed.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 rounded-[6px] px-1.5 py-2 hover:bg-white/[0.03]">
                  {f.photo ? (
                    <img src={f.photo} alt={f.who} className="h-8 w-8 shrink-0 rounded-full border-2 object-cover" style={{ borderColor: f.color }} />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${f.color}26`, color: f.color }}>
                      {f.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-200">
                    <b style={{ color: f.color }}>{f.who}</b> {f.text}
                  </span>
                  {f.state === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : f.state === 'failed' ? (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  ) : f.state === 'working' ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-300" />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.color }} />
                  )}
                  <span className="w-14 shrink-0 text-right text-[10px] text-slate-500">{ago(f.at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="flex flex-col rounded-[10px] border border-white/[0.08] bg-[#120F22] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <LayoutDashboard className="h-4 w-4 text-violet-400" /> Overview
            <span className="ml-auto text-[10.5px] font-normal text-slate-400">{seriesName}</span>
          </h3>
          <div className="mt-2 min-h-[190px] flex-1">{series.length > 0 && <AreaChart data={series} />}</div>
        </section>
      </div>

      {/* team status (compact) */}
      <section className="shrink-0 rounded-[10px] border border-white/[0.08] bg-[#120F22] px-3 py-2.5">
        <div className="grid grid-cols-5 gap-2">
          {agentStats.map(({ a, total, working, pct }) => (
            <button
              key={a.id}
              type="button"
              onClick={onOpenTeam}
              className="flex items-center gap-2 rounded-[8px] border border-white/[0.08] bg-black/20 px-2 py-1.5 text-left hover:border-white/25"
              style={working ? { borderColor: a.color, boxShadow: `0 0 18px -8px ${a.color}` } : undefined}
            >
              <span className="relative shrink-0">
                <img src={a.photo} alt={a.name} className="h-9 w-9 rounded-full border-2 object-cover" style={{ borderColor: a.color }} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#120F22] ${working ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] font-extrabold tracking-wider text-white">{a.name}</span>
                  <span className="text-[9.5px] text-slate-400">{total}</span>
                </span>
                <span className="block truncate text-[9.5px] text-slate-400">{working ? 'Working…' : a.role}</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: a.color }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

// ---------- team tab ----------
export const DesktopTeam: React.FC<{ userId: string; email?: string | null }> = ({ userId, email }) => (
  <div className="flex h-full">
    <TeamPanel userId={userId} ownerEmail={email} full />
  </div>
);

// ---------- right side: ROSE + chat ----------
export const DesktopRosePanel: React.FC<{
  messages: ChatMessage[];
  isSending: boolean;
  voiceState: VoiceState;
  onSend: (t: string) => void;
  onVoice: () => void;
}> = ({ messages, isSending, voiceState, onSend, onVoice }) => {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const recent = messages.slice(-40);
  const voiceOn = ['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [recent.length]);

  const send = () => {
    const v = text.trim();
    if (!v || isSending) return;
    setText('');
    onSend(v);
  };

  return (
    <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#120F22]">
      <div className="relative h-[42%] min-h-[220px] shrink-0 overflow-hidden">
        <img src="/tiya-home.jpg" alt="ROSE" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120F22] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold tracking-[0.25em] text-white">ROSE</p>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {voiceOn ? voiceState.toUpperCase() : 'ONLINE'}
            </p>
          </div>
          <button
            type="button"
            onClick={onVoice}
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              voiceOn ? 'bg-fuchsia-600 text-white shadow-[0_0_22px_#c026d3]' : 'bg-white/15 text-white backdrop-blur'
            }`}
            title={voiceOn ? 'Stop voice' : 'Talk to ROSE'}
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={listRef} className="tiya-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">Say hello to ROSE.</p>
        ) : (
          recent.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3 py-2 text-[12.5px] leading-relaxed ${
                  m.role === 'user' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white' : 'bg-white/[0.06] text-slate-100'
                }`}
              >
                {m.text}
              </p>
            </div>
          ))
        )}
        {isSending && <p className="text-[11px] text-slate-500">ROSE is typing…</p>}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-white/[0.06] p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="h-11 min-w-0 flex-1 rounded-full border border-white/12 bg-black/30 px-4 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
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
