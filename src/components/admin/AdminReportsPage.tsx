import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserChip, loadProfilesById, type MiniProfile } from './UserAvatar';

interface Report {
  id: string;
  user_id: string;
  email: string | null;
  category: string;
  message: string;
  page: string | null;
  status: 'open' | 'seen' | 'fixed' | 'closed';
  admin_reply: string | null;
  created_at: string;
}

interface Vote {
  id: string;
  user_id: string;
  vote: number;
  reply_text: string | null;
  question_text: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-rose-500/20 text-rose-300',
  seen: 'bg-amber-500/20 text-amber-300',
  fixed: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-white/10 text-slate-300',
};

const when = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

/** Admin > 18 REPORTS & FEEDBACK: problems users sent, and 👍 / 👎 on ROSE replies. */
export const AdminReportsPage: React.FC = () => {
  const [tab, setTab] = useState<'reports' | 'feedback'>('reports');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [totals, setTotals] = useState({ up: 0, down: 0 });
  const [profs, setProfs] = useState<Map<string, MiniProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('user_reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter === 'open') q = q.in('status', ['open', 'seen']);
    const [{ data: r }, { data: v }, up, down] = await Promise.all([
      q,
      supabase.from('message_feedback').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('message_feedback').select('id', { count: 'exact', head: true }).eq('vote', 1),
      supabase.from('message_feedback').select('id', { count: 'exact', head: true }).eq('vote', -1),
    ]);
    const rl = (r as Report[]) || [];
    const vl = (v as Vote[]) || [];
    setReports(rl);
    setVotes(vl);
    setTotals({ up: up.count || 0, down: down.count || 0 });
    setProfs(await loadProfilesById([...rl.map((x) => x.user_id), ...vl.map((x) => x.user_id)]));
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: Report['status'], admin_reply?: string) => {
    const patch: Partial<Report> = { status };
    if (admin_reply !== undefined) patch.admin_reply = admin_reply;
    await supabase.from('user_reports').update(patch).eq('id', id);
    setReplyFor(null);
    setReply('');
    void load();
  };

  const card = 'rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3';
  const chip = (on: boolean) =>
    `h-9 flex-1 rounded-[4px] text-[11px] font-bold tracking-wider ${on ? 'bg-teal-600 text-white' : 'border border-white/10 text-slate-300'}`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button type="button" className={chip(tab === 'reports')} onClick={() => setTab('reports')}>
          REPORTS
        </button>
        <button type="button" className={chip(tab === 'feedback')} onClick={() => setTab('feedback')}>
          👍 {totals.up} · 👎 {totals.down}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tab === 'reports' ? (
        <>
          <div className="flex gap-1.5">
            <button type="button" className={chip(filter === 'open')} onClick={() => setFilter('open')}>
              NEW & SEEN
            </button>
            <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>
              ALL
            </button>
          </div>
          {reports.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No reports.</p>}
          {reports.map((r) => (
            <div key={r.id} className={`${card} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <UserChip profile={profs.get(r.user_id)} fallback={r.email || r.user_id} size={30} sub={when(r.created_at)} />
                <span className={`shrink-0 rounded-[3px] px-2 py-0.5 text-[9.5px] font-bold uppercase ${STATUS_TONE[r.status]}`}>{r.status}</span>
              </div>
              <p className="text-[10px] font-bold tracking-wider text-cyan-300">
                {r.category.replace('_', ' ').toUpperCase()}
                {r.page ? ` · ${r.page.toUpperCase()}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-100">{r.message}</p>
              {r.admin_reply && <p className="rounded-[4px] bg-teal-500/10 px-2.5 py-1.5 text-[11.5px] text-teal-200">Reply: {r.admin_reply}</p>}
              {replyFor === r.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Reply (the user gets it as a notification)"
                    className="w-full resize-none rounded-[4px] border border-white/15 bg-black/30 p-2 text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => void setStatus(r.id, 'fixed', reply.trim())} disabled={!reply.trim()} className="h-9 flex-1 rounded-[4px] bg-teal-600 text-[11px] font-bold text-white disabled:opacity-40">
                      SEND & MARK FIXED
                    </button>
                    <button type="button" onClick={() => setReplyFor(null)} className="h-9 rounded-[4px] border border-white/10 px-3 text-[11px] text-slate-300">
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  <button type="button" onClick={() => { setReplyFor(r.id); setReply(r.admin_reply || ''); }} className="h-8 rounded-[4px] bg-teal-600 text-[10px] font-bold text-white">
                    REPLY
                  </button>
                  <button type="button" onClick={() => void setStatus(r.id, 'seen')} className="h-8 rounded-[4px] border border-amber-400/30 text-[10px] font-bold text-amber-300">
                    SEEN
                  </button>
                  <button type="button" onClick={() => void setStatus(r.id, 'fixed')} className="h-8 rounded-[4px] border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                    FIXED
                  </button>
                  <button type="button" onClick={() => void setStatus(r.id, 'closed')} className="h-8 rounded-[4px] border border-white/10 text-[10px] font-bold text-slate-300">
                    CLOSE
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      ) : (
        <>
          {votes.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No feedback yet.</p>}
          {votes.map((v) => (
            <div key={v.id} className={`${card} space-y-1.5`}>
              <div className="flex items-center justify-between gap-2">
                <UserChip profile={profs.get(v.user_id)} fallback={v.user_id} size={26} sub={when(v.created_at)} />
                {v.vote > 0 ? <ThumbsUp className="h-4 w-4 text-emerald-300" /> : <ThumbsDown className="h-4 w-4 text-rose-300" />}
              </div>
              {v.question_text && <p className="text-[11px] text-slate-400">Q: {v.question_text.slice(0, 200)}</p>}
              <p className="text-[11.5px] text-slate-200">{(v.reply_text || '').slice(0, 300)}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
