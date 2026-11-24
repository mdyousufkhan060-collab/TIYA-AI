import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Send, Sparkles, Video } from 'lucide-react';
import { loadSettings } from '../../utils/storage';
import { getTiyaModeContext } from '../../utils/modeContext';

/**
 * SOCIAL POST: pick a video from the gallery, ROSE writes the title, caption and
 * hashtags for YouTube, Facebook, TikTok and Instagram, the user checks them, then
 * each POST button hands the video + text to that app (phone share sheet) or opens
 * its upload page (PC) with the caption already copied. Nothing is posted without
 * the user's own tap in the official app.
 */
type Platform = 'youtube' | 'facebook' | 'tiktok' | 'instagram';
type Draft = { title: string; caption: string };

const PLATFORMS: Array<{ id: Platform; label: string; url: string; hasTitle: boolean }> = [
  { id: 'youtube', label: 'YOUTUBE', url: 'https://www.youtube.com/upload', hasTitle: true },
  { id: 'facebook', label: 'FACEBOOK', url: 'https://www.facebook.com/reels/create', hasTitle: false },
  { id: 'tiktok', label: 'TIKTOK', url: 'https://www.tiktok.com/upload', hasTitle: false },
  { id: 'instagram', label: 'INSTAGRAM', url: 'https://www.instagram.com/', hasTitle: false },
];

const KEY = 'rose_social_post_v1';
const empty = (): Record<Platform, Draft> => ({
  youtube: { title: '', caption: '' },
  facebook: { title: '', caption: '' },
  tiktok: { title: '', caption: '' },
  instagram: { title: '', caption: '' },
});

function parseJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export const SocialPostPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [about, setAbout] = useState('');
  const [chosen, setChosen] = useState<Record<Platform, boolean>>({ youtube: true, facebook: true, tiktok: true, instagram: true });
  const [drafts, setDrafts] = useState<Record<Platform, Draft>>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (s?.drafts) setDrafts({ ...empty(), ...s.drafts });
      if (typeof s?.about === 'string') setAbout(s.about);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ drafts, about }));
    } catch {
      /* ignore */
    }
  }, [drafts, about]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : '');
    setDone({});
  };

  const list = PLATFORMS.filter((p) => chosen[p.id]);
  const ready = list.some((p) => drafts[p.id].caption.trim());

  const write = async () => {
    if (!about.trim()) return setMsg('Write in one line what the video is about.');
    if (!list.length) return setMsg('Choose at least one platform.');
    setBusy(true);
    setMsg('');
    try {
      const s = loadSettings();
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': s.apiKey?.trim() || '' },
        body: JSON.stringify({
          message: `Video: ${about.trim()}${file ? ` (file name: ${file.name})` : ''}\nPlatforms: ${list.map((p) => p.id).join(', ')}`,
          history: [],
          systemInstruction:
            'You are ROSE, a social media expert. For the video described, write ready-to-post text for each listed platform, in the same language as the description (Bengali if it is Bengali). ' +
            'youtube: title under 60 characters with the main keyword first, plus a description whose first 2 lines carry the keywords, then 3-5 hashtags. ' +
            'facebook: short emotional caption with a hook, 1-3 hashtags. tiktok: one hook line with keywords, 3-5 hashtags. instagram: caption with keywords, a call to action, 3-5 specific hashtags. ' +
            'Never promise views. Return ONLY JSON like {"youtube":{"title":"...","caption":"..."},"facebook":{"caption":"..."},"tiktok":{"caption":"..."},"instagram":{"caption":"..."}} with only the listed platforms. ' +
            getTiyaModeContext(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.text) throw new Error(data.detail || data.error || 'ROSE could not write now. Check CONNECTIONS.');
      const j = parseJson(String(data.text));
      if (!j) throw new Error('ROSE wrote something unexpected. Tap WRITE again.');
      setDrafts((prev) => {
        const next = { ...prev };
        for (const p of list) {
          const v = j[p.id];
          if (v) next[p.id] = { title: String(v.title || ''), caption: String(v.caption || v.description || '') };
        }
        return next;
      });
      setDone({});
      setMsg('ROSE filled everything in. Check each box once, then tap POST.');
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const textFor = (p: (typeof PLATFORMS)[number]) => {
    const d = drafts[p.id];
    return p.hasTitle && d.title.trim() ? `${d.title.trim()}\n\n${d.caption.trim()}` : d.caption.trim();
  };

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      return false;
    }
  };

  const post = async (p: (typeof PLATFORMS)[number]) => {
    const t = textFor(p);
    const copied = await copy(p.hasTitle ? drafts[p.id].caption.trim() : t);
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (file && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: drafts[p.id].title || undefined, text: t });
        setDone((d) => ({ ...d, [p.id]: true }));
        setMsg(`Choose ${p.label} in the list. The caption is copied, paste it if the app leaves it empty.`);
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    window.open(p.url, '_blank', 'noopener');
    setDone((d) => ({ ...d, [p.id]: true }));
    setMsg(
      `${p.label} upload page opened. Select your video there${copied ? ', then paste the caption (it is copied)' : ''}${p.hasTitle ? '. Copy the title from here' : ''}.`,
    );
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-teal-400/40 bg-white/[0.03] p-3 text-left"
      >
        {preview ? (
          <video src={preview} muted playsInline className="h-20 w-14 shrink-0 rounded-lg bg-black object-cover" />
        ) : (
          <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-black/40 text-teal-300">
            <Video className="h-6 w-6" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-xs font-bold text-white">{file ? 'CHANGE VIDEO' : 'PICK VIDEO FROM GALLERY'}</span>
          <span className="block truncate text-[11px] text-slate-400">{file ? file.name : 'Phone gallery or PC folder'}</span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setChosen((c) => ({ ...c, [p.id]: !c[p.id] }))}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold ${
              chosen[p.id] ? 'border-teal-400/60 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-500'
            }`}
          >
            {chosen[p.id] && <Check className="h-3.5 w-3.5" />}
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        rows={2}
        placeholder="What is the video about? (one line, Bangla or English)"
        className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-slate-500"
      />
      <button
        type="button"
        onClick={() => void write()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-bold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? 'ROSE IS WRITING…' : 'WRITE WITH ROSE'}
      </button>
      {msg && <p className="rounded-lg bg-white/[0.04] p-2 text-[11.5px] text-teal-200">{msg}</p>}

      {ready &&
        list.map((p) => (
          <div key={p.id} className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-wider text-teal-300">{p.label}</p>
              {done[p.id] && <span className="text-[10px] font-bold text-emerald-400">OPENED</span>}
            </div>
            {p.hasTitle && (
              <input
                value={drafts[p.id].title}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], title: e.target.value } }))}
                placeholder="Title"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            )}
            <textarea
              value={drafts[p.id].caption}
              onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], caption: e.target.value } }))}
              rows={4}
              placeholder={p.hasTitle ? 'Description' : 'Caption'}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => void copy(textFor(p)).then((ok) => setMsg(ok ? `${p.label} text copied.` : 'Could not copy. Select and copy by hand.'))}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 text-[11px] font-bold text-slate-200"
              >
                <Copy className="h-3.5 w-3.5" /> COPY
              </button>
              <button
                type="button"
                onClick={() => void post(p)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 text-[11px] font-bold text-white"
              >
                <Send className="h-3.5 w-3.5" /> POST
              </button>
            </div>
          </div>
        ))}
    </div>
  );
};
