import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * 23 AI KEY & BILLING (admin only): the server Gemini key that every ROSE PREMIUM customer uses.
 * The key itself lives only in Supabase Secrets (GEMINI_API_KEY); this page never shows or stores it.
 * The admin's own key in Settings → 02 CONNECTIONS is separate and stays on his phone.
 */
const LINKS: Array<[string, string, string]> = [
  ['BUY GEMINI PAID PLAN', 'https://aistudio.google.com/apikey', 'Google AI Studio → your key → "Set up billing" (card). Paid keys get much higher limits.'],
  ['GOOGLE BILLING & SPENDING', 'https://console.cloud.google.com/billing', 'See the bill, add a card, set a monthly budget alert.'],
  ['PUT THE KEY IN SUPABASE', 'https://supabase.com/dashboard/project/ukgwipazzjstjkdfaozg/functions/secrets', 'GEMINI_API_KEY → Edit → paste the key → Save. Never paste it in a chat.'],
];

export const AdminAiKeyPage: React.FC = () => {
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; text?: string }>({ busy: false });
  const test = async () => {
    setState({ busy: true });
    const { data, error } = await supabase.functions.invoke('rose-brain', { body: { action: 'ping' } });
    if (error || !data) return setState({ busy: false, ok: false, text: error?.message || 'No answer from the server' });
    setState(
      data.ok
        ? { busy: false, ok: true, text: `WORKING · ${data.model}` }
        : { busy: false, ok: false, text: String(data.error || 'Not working').replace(/^Embedding failed:\s*/, '') },
    );
  };
  return (
    <div className="space-y-2">
      <div className="border border-white/10 bg-white/[0.03] p-3">
        <p className="text-[11px] font-bold tracking-wider text-teal-300">SERVER KEY · ROSE PREMIUM CUSTOMERS USE THIS</p>
        <p className="mt-1 text-[11.5px] text-slate-300">
          Premium customers talk to ROSE without their own key; ROSE uses the server key and takes their credits. Your own key in Settings → 02 CONNECTIONS is
          separate, stays on your phone and is never given to customers.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => void test()} disabled={state.busy} className="rounded-lg bg-teal-500 px-3 py-2 text-[12px] font-extrabold text-slate-950 disabled:opacity-60">
            {state.busy ? 'TESTING…' : 'TEST NOW'}
          </button>
          {state.text && (
            <span className={`text-[12px] font-bold ${state.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
              {state.ok ? '✓ ' : '✗ '}
              {state.text}
            </span>
          )}
        </div>
      </div>
      {LINKS.map(([t, url, d], i) => (
        <a key={t} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-teal-300">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold tracking-wide text-white">{t}</span>
            <span className="block text-[11px] text-slate-400">{d}</span>
          </span>
          <span className="text-[12px] font-bold text-teal-300">OPEN ›</span>
        </a>
      ))}
      <p className="px-1 text-[11px] text-slate-500">After you change the key in Supabase, come back and press TEST NOW. Customers' Premium and ROSE Brain search start working at once.</p>
    </div>
  );
};
