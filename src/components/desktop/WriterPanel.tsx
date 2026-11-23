import React, { useEffect, useState } from 'react';
import { Copy, Download, FileText, Loader2, Mail, MessageCircle, Printer, Sparkles, Trash2 } from 'lucide-react';
import { loadSettings } from '../../utils/storage';
import { getTiyaModeContext } from '../../utils/modeContext';

/**
 * WRITER: ROSE writes (letters, applications, CVs, reports, captions…) into an editor.
 * The user edits, then downloads (Word / text / PDF), emails or sends it on WhatsApp.
 * Draft is kept on this device.
 */
const KEY = 'rose_writer_draft_v1';

const btn =
  'flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-white/12 px-3 text-[11px] font-bold tracking-wide text-slate-100 hover:border-white/35 disabled:opacity-40';

function download(name: string, data: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const WriterPanel: React.FC<{ initialText?: string | null; onUsed?: () => void }> = ({ initialText, onUsed }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    try {
      const d = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      setTitle(d.title || '');
      setBody(d.body || '');
    } catch {
      /* ignore */
    }
  }, []);

  // text sent from the chat ("Open in Writer")
  useEffect(() => {
    if (initialText) {
      setBody((b) => (b.trim() ? `${b}\n\n${initialText}` : initialText));
      onUsed?.();
    }
  }, [initialText, onUsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ title, body }));
    } catch {
      /* ignore */
    }
  }, [title, body]);

  const write = async () => {
    const q = ask.trim();
    if (!q) return;
    setBusy(true);
    setMsg('');
    try {
      const s = loadSettings();
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': s.apiKey?.trim() || '' },
        body: JSON.stringify({
          message: body.trim() ? `Current document:\n${body}\n\nInstruction: ${q}\nReturn the full updated document only.` : q,
          history: [],
          systemInstruction: `You are ROSE, a professional writer. Write the requested document completely and ready to use (letter, application, CV, report, email, post, caption, script). Use the language of the request. Output only the document text, no explanations. ${getTiyaModeContext()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.text) throw new Error(data.detail || data.error || 'ROSE could not write now. Check CONNECTIONS.');
      setBody(String(data.text).trim());
      if (!title.trim()) setTitle(q.slice(0, 60));
      setAsk('');
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const fileBase = (title.trim() || 'ROSE document').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60);
  const full = `${title.trim() ? `${title.trim()}\n\n` : ''}${body}`;
  const empty = !body.trim();

  const word = () => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(
      fileBase,
    )}</title></head><body style="font-family:Calibri,'Noto Sans Bengali',sans-serif;font-size:12pt">${
      title.trim() ? `<h2>${esc(title.trim())}</h2>` : ''
    }${body
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('')}</body></html>`;
    download(`${fileBase}.doc`, html, 'application/msword');
  };

  const pdf = () => {
    const w = window.open('', '_blank');
    if (!w) return setMsg('Allow pop-ups to save as PDF.');
    w.document.write(
      `<html><head><meta charset="utf-8"><title>${esc(fileBase)}</title></head><body style="font-family:'Noto Sans Bengali',Arial,sans-serif;max-width:720px;margin:40px auto;line-height:1.6">${
        title.trim() ? `<h2>${esc(title.trim())}</h2>` : ''
      }<div style="white-space:pre-wrap">${esc(body)}</div></body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-[10px] border border-white/[0.08] bg-[#120F22] p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-fuchsia-300" />
        <h2 className="text-sm font-extrabold tracking-[0.2em] text-white">WRITER</h2>
        <span className="text-[11px] text-slate-400">ROSE writes · you edit · download, email or WhatsApp</span>
      </div>

      <div className="flex gap-2">
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void write()}
          placeholder={empty ? 'Ask ROSE: e.g. ছুটির জন্য অফিসে একটা দরখাস্ত লেখো' : 'Ask ROSE to change it: e.g. make it shorter / translate to English'}
          className="h-11 min-w-0 flex-1 rounded-[6px] border border-white/12 bg-black/30 px-3 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={write}
          disabled={busy || !ask.trim()}
          className="flex h-11 items-center gap-1.5 rounded-[6px] bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 text-xs font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {empty ? 'WRITE' : 'UPDATE'}
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="h-10 rounded-[6px] border border-white/10 bg-black/20 px-3 text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Your document appears here. You can also type or paste."
        className="tiya-scroll min-h-0 flex-1 resize-none rounded-[6px] border border-white/10 bg-black/20 p-4 text-[14px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-white/25 focus:outline-none"
      />
      {msg && <p className="text-xs text-rose-300">{msg}</p>}

      <div className="grid grid-cols-4 gap-2 xl:grid-cols-7">
        <button type="button" className={btn} disabled={empty} onClick={() => void navigator.clipboard?.writeText(full).then(() => setMsg('Copied.'))}>
          <Copy className="h-3.5 w-3.5" /> COPY
        </button>
        <button type="button" className={btn} disabled={empty} onClick={word}>
          <Download className="h-3.5 w-3.5" /> WORD
        </button>
        <button type="button" className={btn} disabled={empty} onClick={() => download(`${fileBase}.txt`, full, 'text/plain;charset=utf-8')}>
          <Download className="h-3.5 w-3.5" /> TEXT
        </button>
        <button type="button" className={btn} disabled={empty} onClick={pdf}>
          <Printer className="h-3.5 w-3.5" /> PDF
        </button>
        <a
          className={`${btn} ${empty ? 'pointer-events-none opacity-40' : ''}`}
          href={`mailto:?subject=${encodeURIComponent(title.trim() || 'Document')}&body=${encodeURIComponent(body.slice(0, 1800))}`}
        >
          <Mail className="h-3.5 w-3.5" /> EMAIL
        </a>
        <a
          className={`${btn} ${empty ? 'pointer-events-none opacity-40' : ''}`}
          href={`https://wa.me/?text=${encodeURIComponent(full.slice(0, 3000))}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WHATSAPP
        </a>
        <button
          type="button"
          className={`${btn} text-rose-300`}
          disabled={empty}
          onClick={() => {
            setBody('');
            setTitle('');
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> CLEAR
        </button>
      </div>
    </div>
  );
};
