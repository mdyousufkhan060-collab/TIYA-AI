import React, { useCallback, useEffect, useState } from 'react';
import { CheckSquare, ChevronDown, ExternalLink, Loader2, Plus, Square, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Item {
  id: string;
  list_name: string;
  assignee_emails: string[];
  section: string;
  title: string;
  details: string | null;
  link: string | null;
  done: boolean;
  done_at: string | null;
  sort: number;
}

/**
 * Work checklist (e.g. "IMTIAZ LIST"): what to install on the PC and what to do.
 * Admin can add / edit / delete. The assigned person ticks items done.
 */
export const TeamChecklist: React.FC<{ canEdit?: boolean }> = ({ canEdit = false }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ section: '1 · INSTALL ON THE PC', title: '', details: '', link: '', emails: 'mdimtiazkhan.official@gmail.com, mdimtiazkhan560@gmail.com' });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('team_checklist').select('*').order('sort').order('created_at');
    setItems((data as Item[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (it: Item) => {
    setItems((list) => list.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
    await supabase.from('team_checklist').update({ done: !it.done }).eq('id', it.id);
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`Delete "${it.title}"?`)) return;
    await supabase.from('team_checklist').delete().eq('id', it.id);
    void load();
  };

  const add = async () => {
    if (!form.title.trim()) return setMsg('Write a title.');
    const emails = form.emails.split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
    const { error } = await supabase.from('team_checklist').insert({
      section: form.section.trim() || 'GENERAL',
      title: form.title.trim(),
      details: form.details.trim() || null,
      link: form.link.trim() || null,
      assignee_emails: emails,
      sort: (items[items.length - 1]?.sort || 0) + 1,
    });
    if (error) return setMsg(error.message);
    setForm({ ...form, title: '', details: '', link: '' });
    setAdding(false);
    setMsg('Added.');
    void load();
  };

  if (loading)
    return (
      <div className="flex justify-center py-10 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const sections = Array.from(new Set(items.map((i) => i.section)));
  const input = 'mt-1 w-full rounded-[4px] border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="rounded-[4px] border border-teal-500/40 bg-teal-500/[0.07] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold tracking-wider text-teal-200">
            DONE {done}/{items.length}
          </p>
          <p className="font-mono text-sm font-bold text-teal-300">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 w-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[10.5px] text-slate-300">Tap a task to see the details. Tick the box when it is done.</p>
      </div>

      {items.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No tasks yet.</p>}

      {sections.map((sec) => (
        <div key={sec} className="space-y-1.5">
          <p className="px-1 pt-1 text-[10px] font-bold tracking-wider text-slate-400">{sec}</p>
          {items
            .filter((i) => i.section === sec)
            .map((it) => {
              const isOpen = open === it.id;
              return (
                <div key={it.id} className={`rounded-[4px] border bg-[#11151E] ${it.done ? 'border-emerald-500/30' : 'border-white/[0.08]'}`}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => void toggle(it)} aria-label={it.done ? 'Mark not done' : 'Mark done'} className="shrink-0">
                      {it.done ? <CheckSquare className="h-5 w-5 text-emerald-400" /> : <Square className="h-5 w-5 text-slate-500" />}
                    </button>
                    <button type="button" onClick={() => setOpen(isOpen ? null : it.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={`min-w-0 flex-1 truncate text-[12px] font-bold ${it.done ? 'text-slate-400 line-through' : 'text-white'}`}>{it.title}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5">
                      {it.details && <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-200">{it.details}</p>}
                      {it.link && (
                        <a href={it.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-[11.5px] font-semibold text-cyan-300">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {it.link}
                        </a>
                      )}
                      {it.done && it.done_at && <p className="text-[10.5px] text-emerald-300">Done: {new Date(it.done_at).toLocaleString('en-GB')}</p>}
                      {canEdit && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="truncate text-[10px] text-slate-500">{it.assignee_emails.join(', ')}</span>
                          <button type="button" onClick={() => void remove(it)} className="flex items-center gap-1 text-[10.5px] font-bold text-rose-300">
                            <Trash2 className="h-3.5 w-3.5" /> DELETE
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ))}

      {canEdit &&
        (adding ? (
          <div className="space-y-2 rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
            <label className="block text-[10px] font-bold tracking-wider text-slate-400">
              SECTION
              <input className={input} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400">
              TASK
              <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400">
              DETAILS
              <textarea rows={3} className={input} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400">
              LINK
              <input className={input} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </label>
            <label className="block text-[10px] font-bold tracking-wider text-slate-400">
              FOR (GMAIL)
              <input className={input} value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} />
            </label>
            {msg && <p className="text-[11px] text-amber-300">{msg}</p>}
            <div className="flex gap-1.5">
              <button type="button" onClick={() => void add()} className="h-10 flex-1 rounded-[4px] bg-teal-600 text-xs font-bold text-white">
                SAVE TASK
              </button>
              <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-[4px] border border-white/10 px-4 text-xs text-slate-300">
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setMsg('');
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-teal-500/50 text-xs font-bold text-teal-300"
          >
            <Plus className="h-4 w-4" /> ADD TASK
          </button>
        ))}
    </div>
  );
};
