import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Under each Gmail in 03 USERS: which server AI this user may use with ROSE PREMIUM
 * (Gemini / Groq, the keys from 02 AI KEY & BILLING), a pause switch and REMOVE PREMIUM.
 * The server (tiya-premium) checks these switches on every reply.
 */
type P = { id: string; email?: string | null; plan?: string | null; paid_until?: string | null; ai_gemini?: boolean; ai_groq?: boolean; ai_paused?: boolean };

const Switch: React.FC<{ on: boolean; onClick: () => void; label: string; danger?: boolean }> = ({ on, onClick, label, danger }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? (danger ? 'bg-rose-500' : 'bg-teal-500') : 'bg-slate-600'}`}
  >
    <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? 'left-[23px]' : 'left-[3px]'}`} />
  </button>
);

export const UserAiAccess: React.FC<{ user: P; onUpdated: (patch: Partial<P>) => void }> = ({ user, onUpdated }) => {
  const [msg, setMsg] = useState('');
  const gem = user.ai_gemini !== false;
  const groq = user.ai_groq !== false;
  const paused = user.ai_paused === true;
  const active = !!user.paid_until && new Date(user.paid_until).getTime() > Date.now();

  const save = async (patch: Partial<P>, note: string) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return setMsg(error.message);
    onUpdated(patch);
    setMsg(note);
  };
  const remove = async () => {
    if (!window.confirm(`Remove ROSE PREMIUM from ${user.email || 'this user'}? Their days and credits go to 0 at once.`)) return;
    const { error } = await supabase.rpc('admin_remove_premium', { p_user: user.id });
    if (error) return setMsg(error.message);
    onUpdated({ plan: 'free', paid_until: null, ...({ premium_voice_left: 0, premium_text_left: 0 } as any) });
    setMsg('Premium removed. This Gmail can no longer use the server keys.');
  };

  const row = (title: string, sub: string, on: boolean, flip: () => void, danger = false) => (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{sub}</p>
      </div>
      <Switch on={on} onClick={flip} label={title} danger={danger} />
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
      <p className="text-[11px] font-bold tracking-wider text-teal-600 dark:text-teal-300">AI ACCESS · SERVER KEYS FOR THIS GMAIL</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {active ? `ROSE PREMIUM active until ${new Date(user.paid_until as string).toLocaleDateString('en-GB')}.` : 'No active ROSE PREMIUM: give days above first. Without it this Gmail cannot use the server keys.'}
      </p>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-white/[0.06]">
        {row('GEMINI (voice + chat)', 'Uses the Gemini key from 02 AI KEY & BILLING', gem, () => void save({ ai_gemini: !gem }, !gem ? 'Gemini ON for this Gmail.' : 'Gemini OFF for this Gmail.'))}
        {row('GROQ (fast chat)', 'Uses the Groq key from 02 AI KEY & BILLING', groq, () => void save({ ai_groq: !groq }, !groq ? 'Groq ON for this Gmail.' : 'Groq OFF for this Gmail.'))}
        {row('PAUSE AI', 'Stops all server AI for this Gmail now; days and credits stay', paused, () => void save({ ai_paused: !paused }, !paused ? 'Paused. This Gmail cannot use ROSE PREMIUM now.' : 'Resumed.'), true)}
      </div>
      {(active || (user.plan || '').toLowerCase() === 'premium') && (
        <button type="button" onClick={() => void remove()} className="mt-2 w-full rounded-xl border border-rose-500/40 py-2 text-[12px] font-bold text-rose-600 dark:text-rose-300">
          REMOVE PREMIUM
        </button>
      )}
      {msg && <p className="mt-2 text-[11.5px] text-teal-700 dark:text-teal-300">{msg}</p>}
    </div>
  );
};
