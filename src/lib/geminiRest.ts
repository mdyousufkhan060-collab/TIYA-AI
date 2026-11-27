/**
 * Plain REST calls to Google Gemini and Groq — the same way ROSE talks to Google,
 * which works on phones. (The @google/genai SDK in the browser sent request fields
 * Google rejected: "Unknown name speechConfig", "Model not available".)
 */
import { loadSettings } from '../utils/storage';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description: string;
  methods: string[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readError(r: Response): Promise<ApiError> {
  let msg = `HTTP ${r.status}`;
  try {
    const j = await r.json();
    msg = j?.error?.message || j?.error?.status || msg;
  } catch {
    // ignore
  }
  return new ApiError(r.status, `${r.status} ${msg}`);
}

const modelCache = new Map<string, { at: number; models: GeminiModelInfo[] }>();

/** All models this key can use (cached 10 minutes). Throws on a bad key. */
export async function listGeminiModels(key: string, force = false): Promise<GeminiModelInfo[]> {
  const hit = modelCache.get(key);
  if (!force && hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.models;
  const out: GeminiModelInfo[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = `${BASE}/models?pageSize=200&key=${encodeURIComponent(key)}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw await readError(r);
    const j = await r.json();
    for (const m of j?.models || []) {
      out.push({
        id: String(m.name || '').replace(/^models\//, ''),
        displayName: m.displayName || '',
        description: m.description || '',
        methods: Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [],
      });
    }
    pageToken = j?.nextPageToken || '';
    if (!pageToken) break;
  }
  modelCache.set(key, { at: Date.now(), models: out });
  return out;
}

const has = (m: GeminiModelInfo, method: string) => m.methods.some((x) => x.toLowerCase() === method.toLowerCase());

/** Text models in a good order (fast flash models first). */
export async function pickChatModels(key: string, preferred?: string): Promise<string[]> {
  let models: GeminiModelInfo[] = [];
  try {
    models = await listGeminiModels(key);
  } catch {
    models = [];
  }
  const text = models
    .filter((m) => has(m, 'generateContent') && !/tts|live|native-audio|image|embedding|aqa|veo|imagen|robotics|computer-use/i.test(m.id))
    .map((m) => m.id);
  const known = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const score = (id: string) => {
    let s = 0;
    if (/flash/.test(id)) s += 10;
    if (/lite/.test(id)) s -= 2;
    if (/latest/.test(id)) s += 3;
    if (/preview|exp/.test(id)) s -= 4;
    return s;
  };
  const sorted = [...text].sort((a, b) => score(b) - score(a));
  const pref = String(preferred || '').trim();
  // only trust a chosen model if it is a normal Gemini flash/pro model (odd experimental ones hang)
  const prefOk = pref && /^gemini-[\d.]+-(flash|pro)|^gemini-(flash|pro)/.test(pref) && (text.length === 0 || text.includes(pref));
  const list = [
    ...(prefOk ? [pref] : []),
    ...known.filter((k) => text.length === 0 || text.includes(k)),
    ...sorted,
  ];
  return Array.from(new Set(list)).slice(0, 5);
}

export async function pickTtsModels(key: string, preferred?: string): Promise<string[]> {
  let models: GeminiModelInfo[] = [];
  try {
    models = await listGeminiModels(key);
  } catch {
    models = [];
  }
  const tts = models.filter((m) => /tts/i.test(m.id)).map((m) => m.id);
  tts.sort((a, b) => (/flash/.test(b) ? 1 : 0) - (/flash/.test(a) ? 1 : 0));
  const pref = String(preferred || '').trim();
  const known = ['gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts'];
  // fast, stable TTS first (3.8 Flash-Lite), then the rest
  const fast = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'].filter((m) => tts.includes(m));
  return Array.from(new Set([...(pref && tts.includes(pref) ? [pref] : []), ...fast, ...tts, ...(tts.length ? [] : known)])).slice(0, 3);
}

export async function pickLiveModels(key: string, preferred: string[]): Promise<string[]> {
  let models: GeminiModelInfo[] = [];
  try {
    models = await listGeminiModels(key);
  } catch {
    models = [];
  }
  const live = models.filter((m) => has(m, 'bidiGenerateContent')).map((m) => m.id);
  live.sort((a, b) => (/native-audio/.test(b) ? 1 : 0) - (/native-audio/.test(a) ? 1 : 0));
  const known = ['gemini-2.5-flash-native-audio-preview-12-2025', 'gemini-live-2.5-flash-preview', 'gemini-2.0-flash-live-001'];
  const list = live.length
    ? [...preferred.filter((p) => live.includes(p)), ...live]
    : [...preferred, ...known];
  return Array.from(new Set(list.filter(Boolean))).slice(0, 4);
}

/** POST models/{model}:generateContent — body uses Google's REST field names. */
export async function generateContent(
  key: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs = 25000,
): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw await readError(r);
    return await r.json();
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw new ApiError(504, `504 ${model} took too long`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function responseText(res: any): string {
  const parts = res?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('')
    .trim();
}

export function responseCalls(res: any): Array<{ name: string; args: any }> {
  const parts = res?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p: any) => p.functionCall).map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
}

export function responseAudio(res: any): { data: string; mimeType: string } | null {
  const parts = res?.candidates?.[0]?.content?.parts || [];
  const p = parts.find((x: any) => x.inlineData?.data);
  if (!p) return null;
  const pcm = wavToPcm(String(p.inlineData.data));
  return pcm ? { data: pcm, mimeType: 'audio/pcm;rate=24000' } : { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'audio/pcm;rate=24000' };
}

/** Newer TTS models (3.8) answer with a WAV file; ROSE plays raw 24 kHz PCM, so the WAV header is taken off. */
export function wavToPcm(b64: string): string | null {
  if (!b64.startsWith('UklGR')) return null; // "RIFF"
  try {
    const bin = atob(b64);
    for (let i = 12; i + 8 <= bin.length; ) {
      const id = bin.slice(i, i + 4);
      const size = bin.charCodeAt(i + 4) | (bin.charCodeAt(i + 5) << 8) | (bin.charCodeAt(i + 6) << 16) | (bin.charCodeAt(i + 7) << 24);
      if (id === 'data') return btoa(bin.slice(i + 8, size > 0 && i + 8 + size <= bin.length ? i + 8 + size : bin.length));
      if (size <= 0) return null;
      i += 8 + size + (size & 1);
    }
  } catch {
    /* not a WAV */
  }
  return null;
}

/** Retryable = try the next model (wrong/retired model, overload, quota). Bad key = stop. */
export function isBadKey(err: unknown): boolean {
  const m = String((err as any)?.message || err).toLowerCase();
  return /api key not valid|api_key_invalid|invalid api key|permission_denied/.test(m) && !/model/.test(m);
}

// ------------------------------- Groq -------------------------------
export function getGroqKey(): string {
  try {
    const s = loadSettings();
    const raw = (s.providerConnections?.groq?.apiKey || '').trim();
    return raw.split(',')[0].trim();
  } catch {
    return '';
  }
}

export async function groqChat(
  groqKey: string,
  system: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  message: string,
): Promise<string> {
  const models = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          max_tokens: 700,
          messages: [
            { role: 'system', content: system },
            ...history.slice(-12).map((h) => ({ role: h.role, content: h.text })),
            { role: 'user', content: message },
          ],
        }),
      });
      if (!r.ok) throw await readError(r);
      const j = await r.json();
      const t = String(j?.choices?.[0]?.message?.content || '').trim();
      if (t) return t;
    } catch (err) {
      lastErr = err;
      if ((err as ApiError)?.status === 401) break;
    }
  }
  throw lastErr || new Error('Groq reply failed');
}

/** Speech to text with Groq Whisper (very good at Bangla). */
export async function groqTranscribe(groqKey: string, wav: Blob, languageCode?: string): Promise<string> {
  const form = new FormData();
  form.append('file', wav, 'speech.wav');
  form.append('model', 'whisper-large-v3-turbo');
  if (languageCode) form.append('language', languageCode.slice(0, 2));
  form.append('response_format', 'json');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!r.ok) throw await readError(r);
  const j = await r.json();
  return String(j?.text || '').trim();
}
