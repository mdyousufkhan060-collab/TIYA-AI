import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, Copy, Image as ImageIcon, Loader2, Pencil, Send, Sparkles, Trash2, Video } from 'lucide-react';
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

type Kind = 'video' | 'photo' | 'poster';
type Sched = {
  id: string;
  at: number;
  kind: Kind | 'text';
  uri?: string;
  mime?: string;
  platforms: Platform[];
  texts: Record<string, { title: string; caption: string }>;
  about?: string;
  status?: string;
  result?: string;
};

/** 4 ready poster designs, drawn at 1080x1080 */
const POSTERS: Array<{ name: string; bg: [string, string]; ink: string; accent: string; frame?: boolean; band?: string }> = [
  { name: 'SUNSET', bg: ['#ff7a18', '#d9206f'], ink: '#ffffff', accent: '#ffe3c2' },
  { name: 'OCEAN', bg: ['#0b2a6f', '#0fb5a6'], ink: '#ffffff', accent: '#bff7ef' },
  { name: 'CLASSIC', bg: ['#0b1020', '#1b2340'], ink: '#f5d27a', accent: '#f5d27a', frame: true },
  { name: 'FRESH', bg: ['#fff8e8', '#fff1cf'], ink: '#123524', accent: '#1f8a4c', band: '#1f8a4c' },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > max && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

function drawPoster(c: HTMLCanvasElement, t: number, head: string, sub: string) {
  const P = POSTERS[t];
  const S = 1080;
  c.width = S;
  c.height = S;
  const x = c.getContext('2d');
  if (!x) return;
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, P.bg[0]);
  g.addColorStop(1, P.bg[1]);
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  if (P.frame) {
    x.strokeStyle = P.accent;
    x.lineWidth = 10;
    x.strokeRect(50, 50, S - 100, S - 100);
    x.lineWidth = 3;
    x.strokeRect(75, 75, S - 150, S - 150);
  }
  if (P.band) {
    x.fillStyle = P.band;
    x.fillRect(0, S - 170, S, 170);
  } else {
    x.globalAlpha = 0.12;
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.arc(S - 120, 140, 260, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.arc(90, S - 60, 220, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 1;
  }
  const font = '"Noto Sans Bengali","Hind Siliguri",system-ui,sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let size = 96;
  let lines: string[] = [];
  do {
    x.font = `800 ${size}px ${font}`;
    lines = wrap(x, head.trim() || ' ', S - 200);
    if (lines.length * size * 1.25 < 560) break;
    size -= 6;
  } while (size > 40);
  const top = (P.band ? S - 170 : S) / 2 - ((lines.length - 1) * size * 1.25) / 2 - (sub.trim() ? 40 : 0);
  x.fillStyle = P.ink;
  lines.forEach((l, i) => x.fillText(l, S / 2, top + i * size * 1.25));
  if (sub.trim()) {
    x.font = `600 44px ${font}`;
    const sl = wrap(x, sub.trim(), S - 220).slice(0, 2);
    x.fillStyle = P.band ? '#ffffff' : P.accent;
    const y0 = P.band ? S - 85 - ((sl.length - 1) * 27) : top + lines.length * size * 1.25 + 30;
    sl.forEach((l, i) => x.fillText(l, S / 2, y0 + i * 54));
  }
}

const nat = (): any => (typeof window !== 'undefined' ? (window as any).TiyaNative : undefined);

/** Runs an Android action; long ones answer later with a 'rose-native-result' event */
function native(obj: Record<string, unknown>, ms = 15000): Promise<any> {
  const n = nat();
  if (!n?.run) return Promise.resolve({ success: false, message: 'Only in the ROSE Android app.' });
  const rid = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    let raw: string;
    try {
      raw = String(n.run(JSON.stringify({ ...obj, async: true, rid })));
    } catch {
      return resolve({ success: false, message: 'ফোন কাজটা নিতে পারেনি।' });
    }
    let first: any = null;
    try {
      first = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (!first?.pending) return resolve(first || { success: false });
    const done = (v: any) => {
      window.clearTimeout(t);
      window.removeEventListener('rose-native-result', on as EventListener);
      resolve(v);
    };
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ rid?: string; result?: string }>).detail;
      if (d?.rid !== rid) return;
      try {
        done(JSON.parse(String(d.result || '{}')));
      } catch {
        done({ success: false });
      }
    };
    const t = window.setTimeout(() => done({ success: false, message: 'ফোন থেকে উত্তর আসতে দেরি হচ্ছে।' }), ms);
    window.addEventListener('rose-native-result', on as EventListener);
  });
}

function toB64(buf: ArrayBuffer): string {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Hands the media to the phone in pieces; the phone keeps it in Pictures/ROSE or Movies/ROSE */
async function sendMedia(blob: Blob, name: string, onPct?: (p: number) => void): Promise<string> {
  const b = await native({ action: 'media_begin', name });
  if (!b?.id) throw new Error('The phone could not take the file.');
  const CH = 384 * 1024;
  for (let o = 0; o < blob.size; o += CH) {
    const r = await native({ action: 'media_chunk', id: b.id, b64: toB64(await blob.slice(o, o + CH).arrayBuffer()) });
    if (!r?.success) throw new Error('The file stopped half way. Try again.');
    onPct?.(Math.round(((o + CH) / blob.size) * 100));
  }
  const e = await native({ action: 'media_end', id: b.id, mime: blob.type || 'image/png' });
  if (!e?.uri) throw new Error(e?.message || 'The phone could not keep the file.');
  return String(e.uri);
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const when = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

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
  const [kind, setKind] = useState<Kind>('video');
  const [tpl, setTpl] = useState(-1);
  const [head, setHead] = useState('');
  const [sub, setSub] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [at, setAt] = useState('');
  const [sched, setSched] = useState<Sched[]>([]);
  const [editId, setEditId] = useState('');
  const [editUri, setEditUri] = useState('');
  const [working, setWorking] = useState('');
  const isPhone = Boolean(nat());

  const loadSched = async () => {
    if (!nat()) return;
    const r = await native({ action: 'list_posts' });
    if (Array.isArray(r?.posts)) setSched((r.posts as Sched[]).sort((a, b) => a.at - b.at));
  };
  useEffect(() => {
    void loadSched();
    const t = window.setInterval(() => void loadSched(), 60000);
    return () => window.clearInterval(t);
  }, []);

  // poster preview
  useEffect(() => {
    if (kind !== 'poster' || tpl < 0) return setPosterUrl('');
    const c = canvasRef.current || document.createElement('canvas');
    canvasRef.current = c;
    drawPoster(c, tpl, head, sub);
    setPosterUrl(c.toDataURL('image/png'));
  }, [kind, tpl, head, sub]);

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

  const videoOnly = kind !== 'video';
  const list = PLATFORMS.filter((p) => chosen[p.id] && !(videoOnly && p.id === 'youtube'));
  const skippedYt = videoOnly && chosen.youtube;
  const ready = list.some((p) => drafts[p.id].caption.trim());

  const write = async () => {
    if (!about.trim()) return setMsg(`Write in one line what the ${kind === 'video' ? 'video' : 'post'} is about.`);
    if (!list.length) return setMsg('Choose at least one platform.');
    setBusy(true);
    setMsg('');
    try {
      const s = loadSettings();
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': s.apiKey?.trim() || '' },
        body: JSON.stringify({
          message: `${kind === 'video' ? 'Video' : kind === 'photo' ? 'Photo post' : tpl >= 0 ? `Poster post (poster text: ${head})` : 'Text post'}: ${about.trim()}${file ? ` (file name: ${file.name})` : ''}\nPlatforms: ${list.map((p) => p.id).join(', ')}`,
          history: [],
          systemInstruction:
            'You are ROSE, a social media expert. For the video or post described, write ready-to-post text for each listed platform, in the same language as the description (Bengali if it is Bengali). ' +
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

  /** the photo, poster or video to post (null = text only) */
  const media = async (): Promise<{ blob: Blob; name: string } | null> => {
    if (kind === 'poster') {
      if (tpl < 0) return null;
      const c = canvasRef.current;
      if (!c) return null;
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      return blob ? { blob, name: `rose-poster-${Date.now()}.png` } : null;
    }
    return file ? { blob: file, name: file.name } : null;
  };

  const check = () => {
    if (!list.length) return 'Choose at least one platform.' + (skippedYt ? ' YouTube takes only videos.' : '');
    if (kind === 'video' && !file) return 'Pick the video first.';
    if (kind === 'photo' && !file) return 'Pick the photo first.';
    if (kind === 'poster' && tpl >= 0 && !head.trim()) return 'Write the poster text first.';
    if (!list.some((p) => drafts[p.id].caption.trim()) && !(kind === 'poster' && tpl >= 0)) return 'Write the caption (or tap WRITE WITH ROSE) first.';
    return '';
  };

  const pack = (uri: string, m: { blob: Blob } | null, ms: number, id?: string): Sched => ({
    id: id || `p${Date.now()}`,
    at: ms,
    kind: m || uri ? kind : 'text',
    uri: uri || undefined,
    mime: m ? m.blob.type || (kind === 'video' ? 'video/mp4' : 'image/png') : kind === 'video' ? 'video/mp4' : 'image/png',
    platforms: list.map((p) => p.id),
    texts: Object.fromEntries(list.map((p) => [p.id, { title: p.hasTitle ? drafts[p.id].title.trim() : '', caption: drafts[p.id].caption.trim() }])),
    about: about.trim(),
  });

  const upload = async () => {
    const m = await media();
    if (!m) return { uri: editUri, m: null as null | { blob: Blob } };
    setWorking('Sending the file to the phone… 0%');
    const uri = await sendMedia(m.blob, m.name, (p) => setWorking(`Sending the file to the phone… ${Math.min(p, 100)}%`));
    return { uri, m };
  };

  const postNow = async () => {
    const bad = check();
    if (bad) return setMsg(bad);
    if (!isPhone) return setMsg('POST NOW works in the ROSE Android app. Here use the POST button under each platform.');
    try {
      const { uri, m } = await upload();
      setWorking(`ROSE is posting on ${list.map((p) => p.label).join(', ')}…`);
      const it = pack(uri, m, Date.now());
      const r = await native({ action: 'post_media', uri: it.uri || '', mime: it.mime, platforms: it.platforms, texts: it.texts }, 8 * 60000);
      setMsg(String(r?.message || 'Done.'));
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setWorking('');
    }
  };

  const schedule = async () => {
    const bad = check();
    if (bad) return setMsg(bad);
    if (!isPhone) return setMsg('SCHEDULE works in the ROSE Android app, because the phone does the posting.');
    const ms = at ? new Date(at).getTime() : NaN;
    if (!ms || ms < Date.now() + 60000) return setMsg('Choose a date and time in the future.');
    try {
      const { uri, m } = await upload();
      setWorking('Saving the schedule…');
      const r = await native({ action: 'schedule_post', post: pack(uri, m, ms, editId || undefined) });
      setMsg(String(r?.message || (r?.success ? 'Scheduled.' : 'Could not schedule.')));
      if (r?.success) {
        setEditId('');
        setEditUri('');
        setAt('');
      }
      await loadSched();
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setWorking('');
    }
  };

  const edit = (x: Sched) => {
    setEditId(x.id);
    setEditUri(x.uri || '');
    setKind(x.kind === 'video' ? 'video' : x.kind === 'photo' ? 'photo' : 'poster');
    if (x.kind === 'text') setTpl(-1);
    setChosen({ youtube: x.platforms.includes('youtube'), facebook: x.platforms.includes('facebook'), tiktok: x.platforms.includes('tiktok'), instagram: x.platforms.includes('instagram') });
    setDrafts((d) => {
      const n = { ...d };
      for (const k of Object.keys(x.texts || {})) n[k as Platform] = { title: x.texts[k].title || '', caption: x.texts[k].caption || '' };
      return n;
    });
    if (x.about) setAbout(x.about);
    setAt(toLocalInput(x.at));
    setMsg('Change what you need, then tap SAVE SCHEDULE. If you do not pick a new file, the same one is used.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeItem = async (x: Sched) => {
    await native({ action: 'remove_post', id: x.id });
    if (editId === x.id) {
      setEditId('');
      setEditUri('');
    }
    await loadSched();
  };

  const postItemNow = async (x: Sched) => {
    setWorking(`ROSE is posting the ${when(x.at)} post…`);
    const r = await native({ action: 'post_now', id: x.id }, 8 * 60000);
    setWorking('');
    setMsg(String(r?.message || 'Done.'));
    await loadSched();
  };

  // voice: "কাল সকাল ১০টায় এটা শিডিউল দাও" → the page's current post
  useEffect(() => {
    (window as any).__roseScheduleCurrent = async (iso: string) => {
      const ms = new Date(iso).getTime();
      if (!ms) return 'সময়টা বুঝিনি।';
      setAt(toLocalInput(ms));
      const bad = check();
      if (bad) return bad;
      try {
        const { uri, m } = await upload();
        const r = await native({ action: 'schedule_post', post: pack(uri, m, ms, editId || undefined) });
        await loadSched();
        return String(r?.message || 'শিডিউল হয়েছে।');
      } catch (e: any) {
        return String(e?.message || e);
      } finally {
        setWorking('');
      }
    };
    return () => {
      delete (window as any).__roseScheduleCurrent;
    };
  });

  const post = async (p: (typeof PLATFORMS)[number]) => {
    const t = textFor(p);
    if (kind === 'poster' && tpl >= 0) {
      const m = await media();
      if (m) {
        const f = new File([m.blob], m.name, { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
        if (nav.canShare?.({ files: [f] })) {
          try {
            await copy(t);
            await nav.share({ files: [f], text: t });
            setDone((d) => ({ ...d, [p.id]: true }));
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') return;
          }
        }
        const a = document.createElement('a');
        a.href = posterUrl;
        a.download = m.name;
        a.click();
      }
    }
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
      `${p.label} upload page opened. Select your ${kind === 'video' ? 'video' : kind === 'poster' && tpl >= 0 ? 'poster (saved in Downloads)' : 'photo'} there${copied ? ', then paste the caption (it is copied)' : ''}${p.hasTitle ? '. Copy the title from here' : ''}.`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {(['video', 'photo', 'poster'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (k !== kind) pick(null);
              setKind(k);
            }}
            className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold ${
              kind === k ? 'border-teal-400/60 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-400'
            }`}
          >
            {k === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={kind === 'video' ? 'video/*' : 'image/*'}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] || null)}
      />
      {kind === 'poster' ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-bold tracking-wider text-teal-300">CHOOSE A POSTER (or none for a text post)</p>
          <div className="grid grid-cols-4 gap-1.5">
            {POSTERS.map((P, i) => (
              <button
                key={P.name}
                type="button"
                onClick={() => setTpl(tpl === i ? -1 : i)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[9px] font-extrabold ${tpl === i ? 'ring-2 ring-teal-300' : ''}`}
                style={{ background: `linear-gradient(135deg, ${P.bg[0]}, ${P.bg[1]})`, color: P.ink, border: P.frame ? `2px solid ${P.accent}` : undefined }}
              >
                Aa
                <span className="mt-0.5">{P.name}</span>
              </button>
            ))}
          </div>
          {tpl >= 0 && (
            <>
              <textarea
                value={head}
                onChange={(e) => setHead(e.target.value)}
                rows={2}
                placeholder="Poster text (big words)"
                className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 text-sm text-white placeholder:text-slate-500"
              />
              <input
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                placeholder="Small line (phone, page name, offer…) optional"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              {posterUrl && <img src={posterUrl} alt="Poster preview" className="mx-auto w-full max-w-[260px] rounded-lg" />}
            </>
          )}
        </div>
      ) : (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-teal-400/40 bg-white/[0.03] p-3 text-left"
      >
        {preview ? (
          kind === 'video' ? (
            <video src={preview} muted playsInline className="h-20 w-14 shrink-0 rounded-lg bg-black object-cover" />
          ) : (
            <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-black object-cover" />
          )
        ) : (
          <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-black/40 text-teal-300">
            {kind === 'video' ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-xs font-bold text-white">
            {file ? `CHANGE ${kind.toUpperCase()}` : `PICK ${kind.toUpperCase()} FROM GALLERY`}
          </span>
          <span className="block truncate text-[11px] text-slate-400">
            {file ? file.name : editId && editUri ? 'Same file as the scheduled post' : 'Phone gallery or PC folder'}
          </span>
        </span>
      </button>
      )}

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

      {skippedYt && (
        <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-200">YouTube takes only videos, so it is skipped for this post.</p>
      )}

      <textarea
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        rows={2}
        placeholder={`What is the ${kind === "video" ? "video" : "post"} about? (one line, Bangla or English)`}
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

      <div className="space-y-2 rounded-xl border border-teal-400/25 bg-teal-500/[0.05] p-3">
        <button
          type="button"
          onClick={() => void postNow()}
          disabled={Boolean(working)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-bold text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> POST NOW
        </button>
        <div className="flex gap-1.5">
          <input
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-2 text-sm text-white [color-scheme:dark]"
          />
          <button
            type="button"
            onClick={() => void schedule()}
            disabled={Boolean(working)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-teal-400/50 px-3 text-[11px] font-bold text-teal-200 disabled:opacity-60"
          >
            <CalendarClock className="h-4 w-4" /> {editId ? 'SAVE SCHEDULE' : 'SCHEDULE'}
          </button>
        </div>
        {editId && (
          <button type="button" onClick={() => { setEditId(''); setEditUri(''); setAt(''); }} className="text-[11px] text-slate-400 underline">
            Cancel edit
          </button>
        )}
        {working && (
          <p className="flex items-center gap-2 text-[11.5px] text-teal-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {working}
          </p>
        )}
        <p className="text-[10.5px] leading-snug text-slate-400">
          {isPhone
            ? 'At the time, ROSE posts by herself. Keep the phone on, online, ROSE Access on and no screen lock (PIN/pattern), or the post waits and ROSE tells you which one failed.'
            : 'POST NOW and SCHEDULE work in the ROSE Android app. On PC use the POST button under each platform.'}
        </p>
      </div>

      {isPhone && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold tracking-wider text-teal-300">SCHEDULED POSTS</p>
          {!sched.length && <p className="text-[11.5px] text-slate-500">No scheduled posts yet.</p>}
          {sched.map((x) => {
            const waiting = (x.status || 'waiting') === 'waiting';
            return (
              <div key={x.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold text-white">{when(x.at)}</p>
                  <span
                    className={`text-[10px] font-bold ${
                      waiting ? 'text-sky-300' : x.status === 'done' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {waiting ? 'WAITING' : x.status === 'done' ? 'POSTED' : x.status === 'partly' ? 'PARTLY' : 'FAILED'}
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  {x.kind.toUpperCase()} · {x.platforms.map((p) => p.toUpperCase()).join(', ')}
                  {x.about ? ` · ${x.about}` : ''}
                </p>
                {x.result && !waiting && <p className="text-[11px] text-slate-300">{x.result}</p>}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {waiting && (
                    <button type="button" onClick={() => void postItemNow(x)} disabled={Boolean(working)} className="flex h-8 items-center justify-center gap-1 rounded-lg bg-teal-600 text-[10.5px] font-bold text-white disabled:opacity-60">
                      <Send className="h-3 w-3" /> POST NOW
                    </button>
                  )}
                  <button type="button" onClick={() => edit(x)} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-white/15 text-[10.5px] font-bold text-slate-200">
                    <Pencil className="h-3 w-3" /> {waiting ? 'EDIT' : 'POST AGAIN'}
                  </button>
                  <button type="button" onClick={() => void removeItem(x)} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-400/30 text-[10.5px] font-bold text-rose-300">
                    <Trash2 className="h-3 w-3" /> REMOVE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
