import React, { useState } from 'react';
import { Flag, Loader2, X } from 'lucide-react';
import { sendReport } from '../lib/feedback';

const CATEGORIES: Array<[string, string]> = [
  ['bug', 'APP PROBLEM'],
  ['wrong_answer', 'WRONG ANSWER'],
  ['voice', 'VOICE / MIC'],
  ['payment', 'PAYMENT / PREMIUM'],
  ['idea', 'IDEA'],
  ['other', 'OTHER'],
];

/** "Report a problem" sheet. Goes to Admin > 18 REPORTS & FEEDBACK. */
export const ReportSheet: React.FC<{ open: boolean; onClose: () => void; page?: string }> = ({ open, onClose, page }) => {
  const [cat, setCat] = useState('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (!open) return null;

  const send = async () => {
    if (text.trim().length < 3) return setMsg({ ok: false, t: 'সমস্যাটা একটু লিখুন।' });
    setBusy(true);
    const err = await sendReport(cat, text.trim(), page);
    setBusy(false);
    if (err) return setMsg({ ok: false, t: 'পাঠানো যায়নি, একটু পরে চেষ্টা করুন।' });
    setText('');
    setMsg({ ok: true, t: 'রিপোর্ট পাঠানো হয়েছে। উত্তর এলে নোটিফিকেশনে জানাবো।' });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-[10px] border border-cyan-400/40 bg-[#06101D] p-4 text-white shadow-[0_0_30px_rgba(34,211,238,0.25)]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-extrabold tracking-wider">
            <Flag className="h-4 w-4 text-rose-300" /> REPORT A PROBLEM
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {CATEGORIES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCat(id)}
              className={`h-9 rounded-[4px] border text-[10px] font-bold tracking-wide ${cat === id ? 'border-cyan-300 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="কী সমস্যা হচ্ছে লিখুন... (Write what went wrong)"
          className="mt-3 w-full resize-none rounded-[6px] border border-white/15 bg-[#050B16] p-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none"
        />
        {msg && <p className={`mt-2 text-[11.5px] ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.t}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-gradient-to-r from-cyan-300 to-sky-500 text-xs font-extrabold tracking-wider text-[#04121F] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} SEND REPORT
        </button>
      </div>
    </div>
  );
};
