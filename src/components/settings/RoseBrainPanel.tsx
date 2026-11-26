import React, { useEffect, useMemo, useState } from 'react';
import { Brain, ChevronDown, Pencil, Pin, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { brainContext } from '../../lib/brain';

/**
 * ROSE BRAIN (Settings → 05 CHATS & MEMORY): what ROSE remembers about THIS user, and the switches.
 * Every user sees and controls only their own memory (the server rules check it).
 */
type Mem = { id: string; category: string; content: string; importance: number; pinned: boolean; updated_at: string };
type Sw = { long_term: boolean; auto_memory: boolean; smart_recall: boolean; history: boolean };
const SWITCHES: Array<[keyof Sw, string, string]> = [
  ['long_term', 'LONG-TERM MEMORY', 'ROSE uses your saved notes in every talk'],
  ['auto_memory', 'AUTO MEMORY', 'ROSE saves important things you say (plans, projects, decisions)'],
  ['smart_recall', 'SMART RECALL', 'Ask "৪ দিন আগে কী বলেছিলাম?" and ROSE finds it'],
  ['history', 'KEEP ALL TALKS', 'Keep every message on the server for Smart Recall'],
];
const CAT_LABEL: Record<string, string> = {
  profile: 'Profile', preference: 'Likes', goal: 'Goals', plan: 'Plans', project: 'Projects', business: 'Business',
  study: 'Study', decision: 'Decisions', followup: 'Follow-up', fact: 'Facts',
};

export const RoseBrainPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mems, setMems] = useState<Mem[]>([]);
  const [sw, setSw] = useState<Sw>({ long_term: true, auto_memory: true, smart_recall: true, history: true });
  const [uid, setUid] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return setMsg('Sign in to use ROSE Brain.');
    setUid(u.user.id);
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from('rose_memories').select('id,category,content,importance,pinned,updated_at').order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(300),
      supabase.from('rose_brain_settings').select('*').maybeSingle(),
    ]);
    setMems((m as Mem[]) || []);
    if (s) setSw({ long_term: s.long_term, auto_memory: s.auto_memory, smart_recall: s.smart_recall, history: s.history });
  };
  useEffect(() => {
    void load();
  }, []);

  const flip = async (k: keyof Sw) => {
    const next = { ...sw, [k]: !sw[k] };
    setSw(next);
    const { error } = await supabase.from('rose_brain_settings').upsert({ user_id: uid, ...next, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : `${SWITCHES.find((x) => x[0] === k)?.[1]} ${next[k] ? 'ON' : 'OFF'}`);
    void brainContext(true);
  };
  const pin = async (m: Mem) => {
    await supabase.from('rose_memories').update({ pinned: !m.pinned }).eq('id', m.id);
    setMems((xs) => xs.map((x) => (x.id === m.id ? { ...x, pinned: !m.pinned } : x)));
    void brainContext(true);
  };
  const del = async (m: Mem) => {
    if (!window.confirm('Delete this memory? ROSE will forget it.')) return;
    await supabase.from('rose_memories').delete().eq('id', m.id);
    setMems((xs) => xs.filter((x) => x.id !== m.id));
    void brainContext(true);
  };
  const saveEdit = async () => {
    if (!edit) return;
    const text = edit.text.replace(/\s+/g, ' ').trim();
    if (text.length < 3) return;
    // the search index is rebuilt for this note the next time it is needed
    const { error } = await supabase.from('rose_memories').update({ content: text, embedding: null, updated_at: new Date().toISOString() }).eq('id', edit.id);
    if (error) return setMsg(error.message);
    setMems((xs) => xs.map((x) => (x.id === edit.id ? { ...x, content: text } : x)));
    setEdit(null);
    void brainContext(true);
  };
  const clearAll = async (withTalks: boolean) => {
    const ok = window.confirm(withTalks ? 'Delete ALL memories AND all saved talks on the server? This cannot be undone.' : 'Delete ALL memories? This cannot be undone.');
    if (!ok) return;
    const { error } = await supabase.functions.invoke('rose-brain', { body: { action: 'forget', all: true, history: withTalks } });
    setMsg(error ? error.message : withTalks ? 'ROSE Brain is empty now (memories and talks).' : 'All memories deleted.');
    if (!error) setMems([]);
    void brainContext(true);
  };

  const cats = useMemo(() => Array.from(new Set(mems.map((m) => m.category))), [mems]);
  const shown = mems.filter((m) => (!cat || m.category === cat) && (!q.trim() || m.content.toLowerCase().includes(q.trim().toLowerCase())));
  const card = 'rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#11151E]';

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${card} flex w-full items-center gap-2.5 px-3 py-2.5 text-left`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white" style={{ background: 'linear-gradient(135deg,#a78bfa,#6d28d9)' }}>
          <Brain className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold tracking-wide text-slate-900 dark:text-white">ROSE BRAIN</span>
          <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">{mems.length} memories · what ROSE remembers about you</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2">
          <div className={`${card} divide-y divide-slate-100 px-3 dark:divide-white/[0.06]`}>
            {SWITCHES.map(([k, t, d]) => (
              <div key={k} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white">{t}</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{d}</p>
                </div>
                <button type="button" aria-label={t} onClick={() => void flip(k)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${sw[k] ? 'bg-teal-500' : 'bg-slate-500'}`}>
                  <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${sw[k] ? 'left-[23px]' : 'left-[3px]'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories…" className={`${card} h-10 w-full pr-3 pl-9 text-xs text-slate-900 focus:outline-none dark:text-white`} />
          </div>
          {cats.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {['', ...cats].map((c) => (
                <button key={c || 'all'} type="button" onClick={() => setCat(c)} className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${cat === c ? 'bg-teal-500 text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {c ? CAT_LABEL[c] || c : 'All'}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <p className={`${card} px-3 py-6 text-center text-[11.5px] text-slate-500`}>
              {mems.length ? 'Nothing matches.' : 'No memories yet. Talk with ROSE, or say "মনে রেখো …".'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {shown.map((m) => (
                <div key={m.id} className={`${card} px-3 py-2`}>
                  {edit?.id === m.id ? (
                    <div className="space-y-1.5">
                      <textarea value={edit.text} onChange={(e) => setEdit({ id: m.id, text: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => void saveEdit()} className="h-8 rounded-lg bg-teal-500 text-[11px] font-bold text-slate-950">SAVE</button>
                        <button type="button" onClick={() => setEdit(null)} className="h-8 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-white">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-slate-900 dark:text-slate-100">{m.content}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {CAT_LABEL[m.category] || m.category} · {new Date(m.updated_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <button type="button" aria-label="Pin" onClick={() => void pin(m)} className={`p-1.5 ${m.pinned ? 'text-amber-400' : 'text-slate-400'}`}><Pin className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Edit" onClick={() => setEdit({ id: m.id, text: m.content })} className="p-1.5 text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Delete" onClick={() => void del(m)} className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void clearAll(false)} className="h-9 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-300">CLEAR MEMORIES</button>
            <button type="button" onClick={() => void clearAll(true)} className="h-9 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-300">CLEAR BRAIN + TALKS</button>
          </div>
          {msg && <p className="px-1 text-[11px] text-teal-700 dark:text-teal-300">{msg}</p>}
        </div>
      )}
    </div>
  );
};
