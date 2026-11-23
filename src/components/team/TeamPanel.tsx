import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2, Mail, Send, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AGENTS, AgentId, AgentTask, agentById, runAgentTask } from '../../lib/agents';

/**
 * PC only (wide screens): live ROSE team board shown beside the phone-sized app.
 * Business users and the admin. Each agent card shows what it is doing now; the feed shows results.
 */
interface TeamPanelProps {
  userId: string;
  ownerEmail?: string | null;
  /** fill the parent (PC Team tab) instead of the side-panel size */
  full?: boolean;
}

const statusIcon = (s: AgentTask['status']) =>
  s === 'done' ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  ) : s === 'failed' ? (
    <XCircle className="h-3.5 w-3.5 text-rose-400" />
  ) : s === 'working' ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
  ) : (
    <CircleDashed className="h-3.5 w-3.5 text-slate-400" />
  );

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB');
};

export const TeamPanel: React.FC<TeamPanelProps> = ({ userId, ownerEmail, full = false }) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [agent, setAgent] = useState<AgentId>('arin');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgentId | 'all'>('all');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);
    setTasks((data as AgentTask[]) || []);
  }, [userId]);

  useEffect(() => {
    void load();
    // live updates (tasks given from chat or another device appear at once)
    const ch = supabase
      .channel(`agent_tasks_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    const t = window.setInterval(load, 30000);
    return () => {
      window.clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [load, userId]);

  const give = async () => {
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    setText('');
    await runAgentTask(userId, agent, v, 'panel');
    setBusy(false);
    void load();
  };

  const nowDoing = useMemo(() => {
    const m: Record<string, AgentTask | undefined> = {};
    for (const a of AGENTS) m[a.id] = tasks.find((t) => t.agent === a.id);
    return m;
  }, [tasks]);

  const stats = useMemo(
    () => ({
      today: tasks.filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString()).length,
      working: tasks.filter((t) => t.status === 'working' || t.status === 'queued').length,
      done: tasks.filter((t) => t.status === 'done').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    }),
    [tasks],
  );

  const feed = tasks.filter((t) => filter === 'all' || t.agent === filter);

  return (
    <aside className={`${full ? 'flex h-full w-full' : 'hidden h-[min(calc(100dvh-24px),900px)] w-full max-w-[760px] lg:flex'} flex-col overflow-hidden rounded-[10px] border border-white/[0.1] bg-[#07090D] text-white shadow-2xl`}>
      {/* header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <h2 className="text-sm font-extrabold tracking-[0.25em]">ROSE TEAM · LIVE</h2>
        </div>
        <div className="flex gap-4 text-[10.5px] font-semibold tracking-wider text-slate-400">
          <span>TODAY <b className="text-white">{stats.today}</b></span>
          <span>WORKING <b className="text-amber-300">{stats.working}</b></span>
          <span>DONE <b className="text-emerald-300">{stats.done}</b></span>
          <span>FAILED <b className="text-rose-300">{stats.failed}</b></span>
        </div>
      </div>

      {/* agent cards */}
      <div className="grid shrink-0 grid-cols-5 gap-2 border-b border-white/[0.06] p-4">
        {AGENTS.map((a) => {
          const cur = nowDoing[a.id];
          const working = cur && (cur.status === 'working' || cur.status === 'queued');
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setFilter(filter === a.id ? 'all' : a.id);
                if (a.id !== 'rose') setAgent(a.id);
              }}
              className={`rounded-[4px] border p-2.5 text-left transition-colors ${filter === a.id ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}
              style={{ borderColor: filter === a.id ? a.color : 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-sm font-extrabold text-black"
                  style={{ background: a.color, boxShadow: working ? `0 0 18px ${a.color}` : undefined }}
                >
                  {a.name[0]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07090D] ${working ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-extrabold tracking-wider">{a.name}</span>
                  <span className="block truncate text-[9.5px] text-slate-400">{a.role}</span>
                </span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[28px] text-[10px] leading-snug text-slate-300">
                {working ? `Working: ${cur!.title}` : cur ? `Last: ${cur.title}` : 'Free · waiting for a task'}
              </p>
            </button>
          );
        })}
      </div>

      {/* give task */}
      <div className="shrink-0 border-b border-white/[0.06] p-4">
        <div className="flex gap-2">
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value as AgentId)}
            className="h-11 rounded-[4px] border border-white/12 bg-[#0B0F16] px-2 text-xs font-bold text-white focus:outline-none"
          >
            {AGENTS.filter((a) => a.id !== 'rose').map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void give()}
            placeholder={`Give ${agentById(agent).name} a task… e.g. summarise today's orders`}
            className="h-11 min-w-0 flex-1 rounded-[4px] border border-white/12 bg-[#0B0F16] px-3 text-xs text-white placeholder:text-slate-500 focus:border-pink-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={give}
            className="flex h-11 items-center gap-1.5 rounded-[4px] bg-[#FF4D8D] px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ASSIGN
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Tip: in chat, write "আরিনকে বলো আজকের অর্ডারের হিসাব দিতে". Reports go to {ownerEmail || 'your Gmail'} when email is connected.
        </p>
      </div>

      {/* live feed */}
      <div className="tiya-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        <div className="flex items-center justify-between pb-1">
          <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400">ACTIVITY {filter !== 'all' ? `· ${agentById(filter).name}` : ''}</p>
          {filter !== 'all' && (
            <button type="button" onClick={() => setFilter('all')} className="text-[10px] font-bold text-pink-300">
              SHOW ALL
            </button>
          )}
        </div>
        {feed.length === 0 ? (
          <p className="py-16 text-center text-xs text-slate-500">No tasks yet. Assign the first task above.</p>
        ) : (
          feed.map((t) => {
            const a = agentById(t.agent);
            const isOpen = open === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpen(isOpen ? null : t.id)}
                className="block w-full rounded-[4px] border border-white/[0.08] bg-white/[0.02] p-3 text-left hover:border-white/20"
                style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}
              >
                <div className="flex items-center gap-2">
                  {statusIcon(t.status)}
                  <span className="text-[10px] font-extrabold tracking-wider" style={{ color: a.color }}>
                    {a.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-100">{t.title}</span>
                  {t.email_status === 'sent' && <Mail className="h-3.5 w-3.5 text-emerald-300" />}
                  <span className="shrink-0 text-[10px] text-slate-500">{ago(t.updated_at)}</span>
                </div>
                {t.result && (
                  <p className={`mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed ${t.status === 'failed' ? 'text-rose-300' : 'text-slate-300'} ${isOpen ? '' : 'line-clamp-2'}`}>
                    {t.result}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
