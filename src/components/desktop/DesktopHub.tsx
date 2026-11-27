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
  Search,
  BarChart3,
  FolderOpen,
  BookOpen,
  Workflow,
  HelpCircle,
  Wand2,
  Zap,
  Star,
  ChevronRight,
  Bot,
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
  onSearch: (q: string) => void;
  unread: number;
  onBell: () => void;
  voiceOn: boolean;
  voiceState?: string;
  onVoice: () => void;
  onMicSettings: () => void;
  email?: string | null;
  avatar?: string | null;
  onSignOut: () => void;
}> = ({ onSearch, unread, onBell, voiceOn, voiceState = 'idle', onVoice, onMicSettings, email, avatar, onSignOut }) => {
  const [camOpen, setCamOpen] = useState(false);
  const [q, setQ] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); window.removeEventListener('keydown', key); };
  }, []);
  const round = 'flex h-10 w-10 items-center justify-center rounded-full border border-sky-400/20 bg-[#0A1430] text-slate-200 hover:border-sky-300/60';
  return (
    <header className="col-start-2 col-span-2 row-start-1 flex h-14 items-center gap-3">
      <label className="flex h-11 w-full max-w-[640px] items-center gap-3 rounded-[12px] border border-sky-400/30 bg-[#0A1430]/90 px-4 shadow-[0_0_24px_-12px_#38bdf8]">
        <Search className="h-5 w-5 text-sky-300" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { onSearch(q.trim()); setQ(''); } }}
          placeholder="Search anything…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
        />
        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-slate-300 xl:flex">
          <kbd className="rounded-[6px] border border-white/20 px-1.5 py-0.5">Ctrl</kbd>+<kbd className="rounded-[6px] border border-white/20 px-1.5 py-0.5">K</kbd>
        </span>
      </label>
      <div className="ml-auto flex items-center gap-2">
        <span className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${online ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/50 bg-rose-500/10 text-rose-300'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`} /> {online ? 'Online' : 'Offline'}
        </span>
        <VoiceOrb on={voiceOn} state={voiceState} onClick={onVoice} />
        <button type="button" onClick={onMicSettings} title="Microphone" className={round}>
          {voiceOn ? <Mic className="h-4 w-4 text-fuchsia-300" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setCamOpen(true)} title="Camera" className={round}>
          {camOpen ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onBell} title="Notifications" className={`relative ${round}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>
          )}
        </button>
        <span title={email || ''} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-sky-400/40 p-[1px]">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0A1430] text-[12px] font-bold text-white">{(email || '?')[0].toUpperCase()}</span>
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

// ---------- left menu (PC, his design). The same bars as the phone open from here ----------
export type DesktopNav = 'dashboard' | 'chat' | 'tools' | 'analytics' | 'projects' | 'knowledge' | 'automation' | 'website' | 'settings' | 'subscription' | 'help' | 'admin';
export const DESKTOP_NAV_ITEMS: Array<[DesktopNav, string]> = [
  ['dashboard', 'Dashboard'], ['chat', 'Chat Assistant'], ['tools', 'AI Tools'], ['analytics', 'Analytics'], ['projects', 'Projects'],
  ['knowledge', 'Knowledge Base'], ['automation', 'Automation'], ['website', 'Website Admin'], ['settings', 'Settings'], ['subscription', 'Subscription'], ['help', 'Help & Support'], ['admin', 'Admin Panel'],
];
const NAV_ICON: Record<DesktopNav, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />, chat: <MessageCircle className="h-5 w-5" />, tools: <Bot className="h-5 w-5" />, analytics: <BarChart3 className="h-5 w-5" />,
  projects: <FolderOpen className="h-5 w-5" />, knowledge: <BookOpen className="h-5 w-5" />, automation: <Workflow className="h-5 w-5" />, website: <Store className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />, subscription: <Crown className="h-5 w-5" />, help: <HelpCircle className="h-5 w-5" />, admin: <Crown className="h-5 w-5" />,
};
export const DesktopSideNav: React.FC<{ active: DesktopNav; isAdmin: boolean; open: boolean; onToggle: () => void; onPick: (k: DesktopNav) => void; onSignOut: () => void }> = ({ active, isAdmin, open, onToggle, onPick }) => {
  const items = DESKTOP_NAV_ITEMS.filter(([k]) => k !== 'admin' || isAdmin);
  return (
    <aside className={`col-start-1 row-span-2 row-start-1 flex min-h-0 flex-col overflow-y-auto rounded-[14px] border border-sky-400/20 bg-[#060E26] ${open ? 'w-[232px] p-3' : 'w-[68px] items-center p-2'} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
      {/* ☰ · logo · name */}
      <div className={`mb-4 flex items-center gap-2 ${open ? '' : 'flex-col'}`}>
        <button type="button" aria-label="Menu" onClick={onToggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-slate-200 hover:bg-white/[0.06]">
          <Menu className="h-5 w-5" />
        </button>
        <img src="/agents/rose.png?v=3" alt="ROSE" className="h-11 w-11 shrink-0 rounded-full border-2 border-sky-400/60 object-cover shadow-[0_0_18px_-4px_#38bdf8]" />
        {open && (
          <div className="min-w-0 leading-tight">
            <p className="text-[19px] font-extrabold text-white">ROSE AI</p>
            <p className="truncate text-[11px] text-slate-300">Your Intelligent AI Agent</p>
          </div>
        )}
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(([k, label]) => (
          <button
            key={k}
            type="button"
            title={label}
            onClick={() => onPick(k)}
            className={`flex h-11 items-center gap-3 rounded-[10px] text-left text-[14px] font-semibold transition-colors ${open ? 'px-3.5' : 'w-11 justify-center'} ${
              active === k
                ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_0_22px_-6px_#38bdf8]'
                : k === 'admin' ? 'text-amber-200 hover:bg-amber-300/10' : 'text-slate-200 hover:bg-white/[0.06]'
            }`}
          >
            <span className="shrink-0">{NAV_ICON[k]}</span>
            {open && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {open && k === 'tools' && <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
        ))}
      </nav>
      {open && !isAdmin && (
        <div className="mt-auto rounded-[14px] border border-sky-400/40 bg-[#0A1640] p-4 text-center shadow-[0_0_28px_-12px_#38bdf8]">
          <Crown className="mx-auto h-7 w-7 text-amber-300" />
          <p className="mt-1 text-[16px] font-extrabold text-white">Upgrade to Pro</p>
          <p className="mt-1 text-[12px] leading-snug text-slate-300">Unlock more powerful features with ROSE AI.</p>
          <button type="button" onClick={() => onPick('subscription')} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-6 text-sm font-bold text-white">
            Go Pro <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
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

// ---------- dashboard (his design: banner · 4 numbers · analytics + quick tools · recent activity + system status · team) ----------
type QuickKey = 'chat' | 'writer' | 'product' | 'voice' | 'team';
const panel = 'rounded-[14px] border border-sky-400/20 bg-[#081233]/90';
const MultiLine: React.FC<{ labels: string[]; lines: Array<{ name: string; color: string; values: number[] }> }> = ({ labels, lines }) => {
  const W = 620, H = 210, pl = 34, pr = 12, pt = 14, pb = 26;
  const max = Math.max(1, ...lines.flatMap((l) => l.values));
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, labels.length - 1);
  const y = (v: number) => H - pb - (v / max) * (H - pt - pb);
  const step = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pl} x2={W - pr} y1={pt + f * (H - pt - pb)} y2={pt + f * (H - pt - pb)} stroke="rgba(148,197,255,0.10)" />
          <text x={pl - 6} y={pt + f * (H - pt - pb) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(max * (1 - f))}</text>
        </g>
      ))}
      {lines.map((l) => {
        const d = l.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
        return (
          <g key={l.name}>
            <path d={`${d} L${x(l.values.length - 1)},${H - pb} L${pl},${H - pb} Z`} fill={l.color} opacity="0.12" />
            <path d={d} fill="none" stroke={l.color} strokeWidth="2.5" strokeLinejoin="round" />
          </g>
        );
      })}
      {labels.map((lb, i) => (i % step === 0 || i === labels.length - 1) && (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#cbd5e1">{lb}</text>
      ))}
    </svg>
  );
};
const Ring: React.FC<{ ok: boolean | null; label: string }> = ({ ok, label }) => {
  const c = ok === null ? '#64748b' : ok ? '#34d399' : '#f87171';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(${c} ${ok ? 360 : ok === null ? 120 : 60}deg, rgba(255,255,255,0.08) 0)` }}>
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#081233] text-[11px] font-extrabold" style={{ color: c }}>{ok === null ? '…' : ok ? 'OK' : 'OFF'}</span>
      </span>
      <span className="text-[12px] text-slate-200">{label}</span>
    </div>
  );
};
export const DesktopDashboard: React.FC<{
  userId: string; isAdmin: boolean; userName?: string; chatCount?: number; hasAiKey?: boolean;
  onOpenTeam: () => void; onAction?: (k: 'product' | 'orders' | 'shop' | 'bars') => void; onQuick?: (k: QuickKey) => void;
}> = ({ userId, isAdmin, userName, chatCount = 0, hasAiKey, onOpenTeam, onAction, onQuick }) => {
  const { tiles, tasks, feed } = useDashboardData(userId, isAdmin);
  const [range, setRange] = useState<7 | 30>(30);
  const [orders, setOrders] = useState<Array<{ created_at: string; total: number }>>([]);
  const [db, setDb] = useState<boolean | null>(null);
  const [mic, setMic] = useState<boolean | null>(null);
  const [net, setNet] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    void supabase.from('agent_tasks').select('id', { head: true, count: 'exact' }).eq('user_id', userId).then(({ error }) => setDb(!error));
    void (navigator as any).permissions?.query({ name: 'microphone' }).then((p: any) => setMic(p.state !== 'denied')).catch(() => setMic(null));
    const up = () => setNet(true); const down = () => setNet(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    void (async () => {
      const [{ data: own }, { data: staff }] = await Promise.all([supabase.from('stores').select('id').eq('owner_id', userId), supabase.rpc('my_staff_stores')]);
      const ids = [...((own as Array<{ id: string }>) || []).map((x) => x.id), ...((staff as Array<{ store_id: string }>) || []).map((x) => x.store_id)];
      if (!ids.length) return;
      const since = new Date(Date.now() - 31 * 864e5).toISOString();
      const { data } = await supabase.from('store_orders').select('created_at,total').in('store_id', ids).gte('created_at', since).limit(5000);
      setOrders((data as Array<{ created_at: string; total: number }>) || []);
    })();
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [userId]);
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
  const doneAll = tasks.filter((t) => t.status === 'done').length;
  const success = tasks.length ? Math.round((doneAll / tasks.length) * 100) : 0;
  const ordersTile = tiles?.find((t) => /order/i.test(t.label) && /total/i.test(t.label))?.value ?? String(orders.length);
  const chart = useMemo(() => {
    const days = Array.from({ length: range }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (range - 1 - i)); return d; });
    const key = (d: Date | string) => new Date(d).toDateString();
    const count = (arr: Array<{ created_at: string }>) => days.map((d) => arr.filter((x) => key(x.created_at) === key(d)).length);
    return {
      labels: days.map((d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
      lines: [
        { name: 'Tasks', color: '#c084fc', values: count(tasks as unknown as Array<{ created_at: string }>) },
        { name: 'Orders', color: '#38bdf8', values: count(orders) },
      ],
    };
  }, [range, tasks, orders]);
  const stat = (label: string, value: string, icon: React.ReactNode, grad: string, line: string) => (
    <div className={`${panel} relative overflow-hidden p-4`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br ${grad} text-white shadow-lg`}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-[13px] text-slate-300">{label}</span>
          <span className="block text-[26px] font-extrabold leading-tight text-white">{value}</span>
        </span>
      </div>
      <svg viewBox="0 0 120 24" className="absolute bottom-1 right-2 h-6 w-28 opacity-80"><path d="M0 20 Q15 18 25 14 T50 15 T75 8 T100 10 T120 4" fill="none" stroke={line} strokeWidth="2" /></svg>
    </div>
  );
  const quick: Array<[QuickKey, string, React.ReactNode, string]> = [
    ['chat', 'New Chat', <Send key="c" className="h-4 w-4" />, 'from-blue-600 to-sky-500'],
    ['writer', 'Create Document', <FolderOpen key="w" className="h-4 w-4" />, 'from-violet-600 to-fuchsia-500'],
    ['product', 'Add Product', <Plus key="p" className="h-4 w-4" />, 'from-emerald-600 to-teal-500'],
    ['team', 'Team Task', <Bot key="t" className="h-4 w-4" />, 'from-orange-500 to-amber-500'],
    ['voice', 'Voice Assistant', <Mic key="v" className="h-4 w-4" />, 'from-purple-600 to-indigo-500'],
  ];
  const quickGo = (k: QuickKey) => {
    if (onQuick) return onQuick(k);
    if (k === 'product') onAction?.('product');
    else if (k === 'team') onOpenTeam();
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* banner */}
      <section className={`${panel} relative flex min-h-[190px] shrink-0 overflow-hidden`}>
        <img src="/tiya-home.jpg?v=3" alt="ROSE" className="absolute inset-y-0 left-0 h-full w-[46%] object-cover object-[center_28%]" />
        <span className="pointer-events-none absolute inset-y-0 left-[30%] w-[22%] bg-gradient-to-r from-transparent to-[#081233]" />
        <p className="absolute bottom-5 left-6 text-[26px] italic leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'cursive' }}>Smarter AI.<br />Better Tomorrow.</p>
        <div className="relative ml-auto flex w-[50%] flex-col justify-center gap-1.5 p-6">
          <p className="text-[22px] font-extrabold text-white">Hello, {(userName || 'there').toUpperCase()}! 👋</p>
          <p className="text-[15px] font-semibold text-slate-100">Welcome back to your AI Dashboard</p>
          <p className="text-[13px] text-slate-300">Let's make something amazing together.</p>
          <button type="button" onClick={() => quickGo('chat')} className="mt-3 inline-flex h-11 w-fit items-center gap-2 rounded-full border border-sky-300/60 bg-[#0A1640] px-6 text-sm font-bold text-white shadow-[0_0_24px_-6px_#38bdf8] hover:bg-sky-500/20">
            <Send className="h-4 w-4" /> Start Chat
          </button>
        </div>
      </section>

      {/* 4 numbers */}
      <div className="grid shrink-0 grid-cols-4 gap-3">
        {stat('Total Chats', String(chatCount), <MessageCircle className="h-6 w-6" />, 'from-blue-600 to-sky-400', '#38bdf8')}
        {stat('AI Tasks', String(tasks.length), <Zap className="h-6 w-6" />, 'from-violet-600 to-fuchsia-500', '#c084fc')}
        {stat('Orders', String(ordersTile), <CheckCircle2 className="h-6 w-6" />, 'from-emerald-600 to-green-400', '#34d399')}
        {stat('Success Rate', `${success}%`, <Star className="h-6 w-6" />, 'from-orange-500 to-amber-400', '#fbbf24')}
      </div>

      {/* analytics + quick tools */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-3">
        <section className={`${panel} flex min-h-[290px] flex-col p-4`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            <h3 className="text-[16px] font-bold text-white">Analytics Overview</h3>
            <select value={range} onChange={(e) => setRange(Number(e.target.value) as 7 | 30)} className="ml-auto h-9 rounded-[10px] border border-sky-400/30 bg-[#0A1430] px-3 text-sm text-white">
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div className="mt-1 flex justify-center gap-5 text-[12px] text-slate-200">
            {chart.lines.map((l) => <span key={l.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.name}</span>)}
          </div>
          <div className="mt-1 min-h-[210px] flex-1"><MultiLine labels={chart.labels} lines={chart.lines} /></div>
        </section>
        <section className={`${panel} p-4`}>
          <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-white"><Wand2 className="h-5 w-5 text-sky-400" /> Quick Tools</h3>
          <div className="space-y-2">
            {quick.map(([k, label, icon, grad]) => (
              <button key={k} type="button" onClick={() => quickGo(k)} className="flex h-11 w-full items-center gap-3 rounded-[10px] border border-sky-400/15 bg-[#0A1430] pr-3 text-left text-[14px] font-semibold text-white hover:border-sky-300/50">
                <span className={`flex h-11 w-12 shrink-0 items-center justify-center rounded-l-[10px] bg-gradient-to-br ${grad}`}>{icon}</span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* recent activity + system status */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3">
        <section className={`${panel} p-4`}>
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-400" />
            <h3 className="text-[16px] font-bold text-white">Recent Activity</h3>
            <button type="button" onClick={onOpenTeam} className="ml-auto text-[13px] font-semibold text-sky-300">View All →</button>
          </div>
          {feed.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">New work, logins and orders show here.</p>
          ) : (
            <div className="space-y-1.5">
              {feed.slice(0, 4).map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${f.state === 'failed' ? 'bg-rose-500' : f.state === 'working' ? 'bg-amber-500' : 'bg-emerald-500'} text-white`}>
                    {f.state === 'failed' ? <XCircle className="h-3.5 w-3.5" /> : f.state === 'working' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-100"><b style={{ color: f.color }}>{f.who}</b> {f.text}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{ago(f.at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className={`${panel} p-4`}>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-400" />
            <h3 className="text-[16px] font-bold text-white">System Status</h3>
            {(() => { const all = net && db !== false && hasAiKey !== false && mic !== false; return (
              <span className={`ml-2 rounded-full px-3 py-1 text-[11px] font-semibold ${all ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{all ? 'All Systems Operational' : 'Check the red ones'}</span>
            ); })()}
          </div>
          <div className="flex justify-around">
            <Ring ok={net} label="Internet" />
            <Ring ok={db} label="Database" />
            <Ring ok={hasAiKey ?? null} label="AI" />
            <Ring ok={mic} label="Microphone" />
          </div>
        </section>
      </div>

      {/* team: ROSE, MIRA, ARIN, ZAYAN, NAIRA */}
      <section className={`${panel} shrink-0 px-3 py-2.5`}>
        <div className="grid grid-cols-5 gap-2">
          {agentStats.map(({ a, total, working, pct }) => (
            <button
              key={a.id}
              type="button"
              onClick={onOpenTeam}
              className="flex items-center gap-2 rounded-[10px] border border-sky-400/15 bg-[#0A1430] px-2 py-1.5 text-left hover:border-sky-300/50"
              style={working ? { borderColor: a.color, boxShadow: `0 0 18px -8px ${a.color}` } : undefined}
            >
              <span className="relative shrink-0">
                <img src={a.photo} alt={a.name} className="h-9 w-9 rounded-full border-2 object-cover" style={{ borderColor: a.color }} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#081233] ${working ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} />
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const f = () => inputRef.current?.focus();
    window.addEventListener('rose-focus-chat', f);
    return () => window.removeEventListener('rose-focus-chat', f);
  }, []);
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
          ref={inputRef}
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
