import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ROSE'S LIVE FILES (own file): the two files that update by themselves every 6 hours
 * (WORLD NEWS for everyone, AI TOOLS for the admin). Shows when each was updated and can refresh now.
 */
type Row = { topic: string; content: string; updated_at: string };
const NAMES: Record<string, string> = { world_news: 'WORLD NEWS', ai_tools: 'AI TOOLS' };

export const AdminLiveFiles: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState('');
  const [msg, setMsg] = useState('');
  const load = async () => {
    const { data } = await supabase.from('rose_knowledge').select('topic,content,updated_at').order('topic');
    setRows((data as Row[]) || []);
  };
  useEffect(() => {
    void load();
  }, []);
  const refresh = async (topic: string) => {
    setBusy(topic);
    setMsg('');
    const { data, error } = await supabase.functions.invoke('rose-knowledge', { body: { topic, force: true } });
    setBusy('');
    const r = (data as { result?: Record<string, string>; error?: string } | null) || {};
    setMsg(error ? error.message : r.error || r.result?.[topic] || '');
    void load();
  };
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/[0.08] dark:bg-[#11151E]">
      <p className="text-[11px] font-bold tracking-wider text-teal-600 dark:text-teal-300">ROSE LIVE FILES · UPDATE EVERY 6 HOURS</p>
      {rows.map((r) => {
        const fresh = r.content && new Date(r.updated_at).getFullYear() > 2000;
        return (
          <div key={r.topic} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(open === r.topic ? '' : r.topic)} className="min-w-0 flex-1 text-left">
                <span className="block text-[12.5px] font-bold text-slate-900 dark:text-white">{NAMES[r.topic] || r.topic}</span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">{fresh ? `Updated ${new Date(r.updated_at).toLocaleString('en-GB')}` : 'Not updated yet'}</span>
              </button>
              <button type="button" onClick={() => void refresh(r.topic)} disabled={Boolean(busy)} className="flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-2.5 text-[11px] font-bold text-white disabled:opacity-60">
                {busy === r.topic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} NOW
              </button>
            </div>
            {open === r.topic && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{r.content || '—'}</pre>}
          </div>
        );
      })}
      {msg && <p className="text-[11px] text-teal-700 dark:text-teal-200">{msg}</p>}
      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">ROSE tells world news to everyone who asks, and the AI tools summary only to you. They use the Gemini key above.</p>
    </div>
  );
};
