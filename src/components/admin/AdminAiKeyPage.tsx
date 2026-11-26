import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * 02 AI KEY & BILLING (admin only): the server keys every ROSE PREMIUM customer uses.
 * Paste the Gemini and Groq keys here like in 02 CONNECTIONS. They are saved on the server where no
 * app user can read them (not even this page: it only shows the last 4 letters), and only Gmails that
 * have ROSE PREMIUM with that AI switched ON (03 USERS) can use them.
 * The admin's own key in Settings → 02 CONNECTIONS is separate and stays on his phone.
 */
type Kind = 'gemini' | 'groq';
const META: Record<Kind, { title: string; sub: string; getUrl: string; billUrl: string; billLabel: string; ph: string }> = {
  gemini: {
    title: 'GEMINI API KEY',
    sub: 'Voice + chat for Premium customers, and ROSE Brain search',
    getUrl: 'https://aistudio.google.com/apikey',
    billUrl: 'https://aistudio.google.com/apikey',
    billLabel: 'BUY PAID PLAN',
    ph: 'AIza…',
  },
  groq: {
    title: 'GROQ API KEY',
    sub: 'Fast chat replies for Premium customers',
    getUrl: 'https://console.groq.com/keys',
    billUrl: 'https://console.groq.com/settings/billing',
    billLabel: 'BUY PAID PLAN',
    ph: 'gsk_…',
  },
};

const KeyCard: React.FC<{ kind: Kind; status?: { last4: string; updated_at: string } }> = ({ kind, status }) => {
  const m = META[kind];
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(status);
  useEffect(() => setSaved(status), [status]);

  const test = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('rose-brain', { body: { action: 'ping', kind } });
    setBusy(false);
    if (error || !data) return setMsg({ ok: false, text: error?.message || 'No answer from the server' });
    setMsg(data.ok ? { ok: true, text: 'WORKING' } : { ok: false, text: String(data.error || 'Not working').replace(/^Embedding failed:\s*/, '') });
  };
  const save = async () => {
    const v = val.trim();
    if (!v) return setMsg({ ok: false, text: 'Paste the key first' });
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_set_ai_key', { p_kind: kind, p_key: v });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setVal('');
    setSaved({ last4: String((data as any)?.last4 || v.slice(-4)), updated_at: new Date().toISOString() });
    setMsg({ ok: true, text: 'SAVED · testing…' });
    setTimeout(() => void test(), 1500);
  };
  const remove = async () => {
    if (!window.confirm(`Remove the ${kind === 'gemini' ? 'Gemini' : 'Groq'} key saved here? (A key in Supabase Secrets still works.)`)) return;
    const { error } = await supabase.rpc('admin_set_ai_key', { p_kind: kind, p_key: '' });
    if (error) return setMsg({ ok: false, text: error.message });
    setSaved(undefined);
    setMsg({ ok: true, text: 'Removed' });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold tracking-wide text-slate-900 dark:text-white">{m.title}</p>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{m.sub}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${saved ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'}`}>
          {saved ? `READY · ••••${saved.last4}` : 'NOT SET HERE'}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={saved ? 'Paste a new key to change it' : m.ph}
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 font-mono text-[12px] text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white"
          />
          <button type="button" onClick={() => setShow((x) => !x)} className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400" aria-label="Show or hide the key">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <a href={m.getUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 shrink-0 items-center rounded-xl border border-teal-500/50 px-3 text-[11px] font-bold text-teal-600 dark:text-teal-300">
          GET KEY
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="h-9 rounded-xl bg-teal-500 text-[11.5px] font-extrabold text-slate-950 disabled:opacity-60">
          SAVE
        </button>
        <button type="button" disabled={busy} onClick={() => void test()} className="h-9 rounded-xl bg-slate-100 text-[11.5px] font-bold text-slate-800 disabled:opacity-60 dark:bg-white/10 dark:text-white">
          {busy ? '…' : 'TEST'}
        </button>
        <a href={m.billUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-center rounded-xl bg-amber-400/15 text-[11px] font-bold text-amber-700 dark:text-amber-300">
          {m.billLabel}
        </a>
      </div>
      {msg && <p className={`text-[11.5px] font-bold ${msg.ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{msg.ok ? '✓ ' : '✗ '}{msg.text}</p>}
      {saved && (
        <button type="button" onClick={() => void remove()} className="text-[10.5px] text-slate-400 underline">
          Remove the key saved here
        </button>
      )}
    </div>
  );
};

export const AdminAiKeyPage: React.FC = () => {
  const [status, setStatus] = useState<Record<string, { last4: string; updated_at: string }>>({});
  useEffect(() => {
    void supabase.rpc('admin_ai_key_status').then(({ data }) => setStatus((data as any) || {}));
  }, []);
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
        Paste your paid keys here. Only Gmails you give <b>ROSE PREMIUM</b> in <b>03 USERS</b> (with Gemini / Groq switched ON under their Gmail) can use them.
        Nobody can see these keys, not even on this page. Your own key in Settings → 02 CONNECTIONS is separate and stays on your phone.
      </p>
      <KeyCard kind="gemini" status={status.gemini} />
      <KeyCard kind="groq" status={status.groq} />
      <p className="px-1 text-[10.5px] text-slate-500">
        Buying a paid plan: open BUY PAID PLAN, add your card (Gemini: "Set up billing" next to the key; Groq: Billing). The same key becomes paid, so you do not need to change it here.
        A key saved in Supabase Secrets still works as a backup.
      </p>
    </div>
  );
};
