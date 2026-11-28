// ROSE PREMIUM — server-side AI for premium customers.
// Keys: first the ones the admin pasted in ROSE (Admin → 02 AI KEY & BILLING, table ai_server_keys, readable
// only by the server), then Supabase secrets GEMINI_API_KEY / GROQ_API_KEY (comma separated allowed).
// SPEED (v17-20): thinking off for voice, settings cached, user/settings fetched together, Groq Whisper STT,
// and every step logs how long it took. STT writes only the main speaker (no TV, traffic, far voices).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ttsFailed, ttsModelsFor, ttsUsable } from "./ttsGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const FEMALE = new Set(["Leda", "Kore", "Aoede", "Zephyr", "Autonoe", "Callirrhoe", "Despina", "Erinome", "Laomedeia", "Pulcherrima", "Vindemiatrix", "Sulafat", "Achernar", "Gacrux"]);
// Google closed the 2.5 text models for new keys (404). These work; tried in this order after the admin's choice.
const TEXT_FALLBACK = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];

let dbKeys: Record<string, string> = {};
let dbKeysAt = 0;
async function loadKeys(service: any) {
  if (Date.now() - dbKeysAt < 60000) return;
  const { data } = await service.from("ai_server_keys").select("kind,value");
  dbKeys = {};
  for (const r of data || []) dbKeys[r.kind] = r.value;
  dbKeysAt = Date.now();
}
let cfgCache: any = null;
let cfgAt = 0;
async function loadCfg(service: any) {
  if (cfgCache && Date.now() - cfgAt < 60000) return cfgCache;
  const { data } = await service.from("premium_settings").select("*").eq("id", 1).maybeSingle();
  cfgCache = data || {};
  cfgAt = Date.now();
  return cfgCache;
}
const keyList = (name: string) => {
  const fromAdmin = name === "GEMINI_API_KEY" ? dbKeys.gemini : name === "GROQ_API_KEY" ? dbKeys.groq : "";
  const fromEnv = (Deno.env.get(name) || "").split(/[,\s]+/).map((k) => k.trim()).filter(Boolean);
  return [...new Set([...(fromAdmin ? [fromAdmin] : []), ...fromEnv])];
};

// one request with a time limit, so a slow model never leaves ROSE waiting without an answer
async function post(url: string, headers: Record<string, string>, body: unknown, ms: number) {
  try {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
    const d = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, d };
  } catch (e) {
    return { ok: false, status: 0, d: { error: { message: (e as Error)?.name === "TimeoutError" ? "timeout" : String((e as Error)?.message || e) } } };
  }
}

// "thinking" makes a model wait before it answers; for talk it is switched off. Models accept different
// settings, so the first one a model takes is remembered (and none if it refuses them all).
const THINK_WAYS: Array<Record<string, unknown> | null> = [{ thinkingLevel: "minimal" }, { thinkingBudget: 0 }, null];
const thinkWay: Record<string, number> = {};
async function gem(model: string, key: string, body: any, ms: number) {
  const url = `${GEMINI}/models/${encodeURIComponent(model)}:generateContent`;
  const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
  let r: any = null;
  for (let i = thinkWay[model] ?? 0; i < THINK_WAYS.length; i++) {
    const tc = THINK_WAYS[i];
    const b = tc ? { ...body, generationConfig: { ...(body.generationConfig || {}), thinkingConfig: tc } } : body;
    r = await post(url, headers, b, ms);
    if (r.status === 400 && tc && /think/i.test(String(r.d?.error?.message || ""))) {
      console.log(`${model}: thinking setting ${JSON.stringify(tc)} refused`);
      continue;
    }
    if (r.ok) thinkWay[model] = i;
    return r;
  }
  return r;
}

// 3.8 TTS answers with a WAV file; the app plays raw 24 kHz PCM, so the WAV header is taken off
function wavToPcm(b64: string): string | null {
  if (!b64.startsWith("UklGR")) return null;
  try {
    const bin = atob(b64);
    for (let i = 12; i + 8 <= bin.length; ) {
      const id = bin.slice(i, i + 4);
      const size = bin.charCodeAt(i + 4) | (bin.charCodeAt(i + 5) << 8) | (bin.charCodeAt(i + 6) << 16) | (bin.charCodeAt(i + 7) << 24);
      if (id === "data") return btoa(bin.slice(i + 8, size > 0 && i + 8 + size <= bin.length ? i + 8 + size : bin.length));
      if (size <= 0) return null;
      i += 8 + size + (size & 1);
    }
  } catch {
    /* not a WAV */
  }
  return null;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function callGroq(model: string, messages: Msg[], maxTokens: number, temperature: number) {
  let last = "Groq key missing";
  for (const key of keyList("GROQ_API_KEY")) {
    const r = await post(GROQ, { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, { model, messages, max_tokens: maxTokens, temperature }, 25000);
    const text = r.d?.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (r.ok && text) return { text, model };
    last = `Groq ${r.status}: ${r.d?.error?.message || "empty"}`;
  }
  throw new Error(last);
}

async function callGemini(model: string, messages: Msg[], maxTokens: number, temperature: number, live: boolean, tools: any[] = [], fast = false): Promise<any> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let last = "Gemini key missing";
  const models = live ? TEXT_FALLBACK : [model, ...TEXT_FALLBACK];
  for (const key of keyList("GEMINI_API_KEY")) {
    for (const m of [...new Set(models)]) {
      const body = {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        ...(live ? { tools: [{ google_search: {} }] } : tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      };
      const r = fast
        ? await gem(m, key, body, 25000)
        : await post(`${GEMINI}/models/${encodeURIComponent(m)}:generateContent`, { "Content-Type": "application/json", "x-goog-api-key": key }, body, 25000);
      const cand = r.d?.candidates?.[0];
      const text = (cand?.content?.parts || []).filter((p: any) => !p?.thought).map((p: any) => p?.text || "").join("").trim();
      // phone actions come back as real tool calls (the app runs them and sends the result back)
      const calls = (cand?.content?.parts || []).filter((p: any) => p?.functionCall?.name).map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
      if (r.ok && (text || calls.length)) {
        const sources = (cand?.groundingMetadata?.groundingChunks || [])
          .map((c: any) => c?.web)
          .filter((w: any) => w?.uri)
          .slice(0, 3)
          .map((w: any) => ({ title: w.title || w.uri, uri: w.uri }));
        return { text, model: m, sources, calls };
      }
      last = `Gemini ${m} ${r.status}: ${r.d?.error?.message || "empty"}`;
      console.error(last);
      if (r.status === 400 || r.status === 401 || r.status === 403) break;
    }
  }
  // a tool the model does not accept must never stop the answer: try once more without tools
  if (tools.length && / 400:/.test(last)) return callGemini(model, messages, maxTokens, temperature, live, [], fast);
  throw new Error(last);
}

// his spoken words (16 kHz WAV) to text, in the script of his language. Only the person talking to ROSE, close to
// the phone, is written; TV, radio, traffic, music and people far away are left out.
// fast path: Groq Whisper (about half a second). Parts that are only noise (no_speech) or very unsure are dropped,
// so a TV or traffic sound does not become words. Gemini is the backup.
const WHISPER_LANG: Record<string, string> = { bengali: "bn", bangla: "bn", english: "en", hindi: "hi", urdu: "ur", arabic: "ar" };
async function whisperStt(audio: string, language: string): Promise<string | null> {
  const keys = keyList("GROQ_API_KEY");
  if (!keys.length) return null;
  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const lang = WHISPER_LANG[(language || "bengali").toLowerCase()] || "";
  for (const key of keys) {
    try {
      const fd = new FormData();
      fd.append("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
      fd.append("model", "whisper-large-v3");
      fd.append("response_format", "verbose_json");
      fd.append("temperature", "0");
      if (lang) fd.append("language", lang);
      if (lang === "bn") fd.append("prompt", "বাংলায় কথা। রোজ, ফেসবুক, কমেন্ট, রিপ্লাই, ইউটিউব।");
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(8000) });
      if (!r.ok) { console.error(`whisper ${r.status}: ${(await r.text()).slice(0, 160)}`); continue; }
      const d = await r.json();
      const segs: any[] = Array.isArray(d?.segments) ? d.segments : [];
      const kept = segs.length
        ? segs.filter((g) => Number(g?.no_speech_prob ?? 0) < 0.6 && Number(g?.avg_logprob ?? 0) > -1.2).map((g) => String(g?.text || "")).join(" ")
        : String(d?.text || "");
      return kept.replace(/\s+/g, " ").trim();
    } catch (e) {
      console.error(`whisper error ${String((e as Error)?.message || e).slice(0, 120)}`);
    }
  }
  return null;
}

async function callStt(audio: string, language: string) {
  const fast = await whisperStt(audio, language);
  if (fast !== null) return fast;
  let last = "Gemini key missing";
  for (const key of keyList("GEMINI_API_KEY")) {
    for (const m of ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"]) {
      const r = await gem(m, key, {
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "audio/wav", data: audio } },
            { text: `Transcribe only the MAIN speaker: the one person speaking clearly and close to the microphone, talking to the assistant (usually ${language || "Bengali"}). Write it in that language's own script (Bengali speech in Bengali script). IGNORE television, radio, music, videos playing, traffic, horns, vehicles, fans, and other people talking in the background or far away. If there is no clear close speech from the main speaker, output nothing. Output only the words.` },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 300 },
      }, 20000);
      const text = (r?.d?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p?.thought).map((p: any) => p?.text || "").join("").trim();
      if (r?.ok) return text;
      last = `STT ${m} ${r?.status}: ${r?.d?.error?.message || "empty"}`;
      console.error(last);
      if (r?.status === 401 || r?.status === 403) break;
    }
  }
  throw new Error(last);
}

async function callTts(model: string, text: string, voiceName: string, languageCode: string) {
  const voice = FEMALE.has(voiceName) ? voiceName : "Leda";
  let last = "Gemini key missing";
  for (const key of keyList("GEMINI_API_KEY")) {
    if (!ttsUsable(key, "*")) continue;
    // every voice model this key can use now, best first (ttsGuard.ts skips the ones out of quota)
    for (const m of await ttsModelsFor(key, model)) {
      const r = await post(`${GEMINI}/models/${encodeURIComponent(m)}:generateContent`, { "Content-Type": "application/json", "x-goog-api-key": key }, {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          temperature: 0,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            ...(languageCode ? { languageCode } : {}),
          },
        },
      }, /preview/.test(m) ? 12000 : 20000);
      const raw = r.d?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData?.data;
      const audio = raw ? wavToPcm(String(raw)) || raw : raw;
      if (r.ok && audio) return { audio, model: m, voice };
      last = `TTS ${m} ${r.status}: ${r.d?.error?.message || "no audio"}`;
      console.error(last);
      ttsFailed(key, m, r.status, String(r.d?.error?.message || ""));
      if (r.status === 401 || r.status === 403) break;
    }
  }
  throw new Error(last);
}

// streamed TTS: the first piece of sound comes before the whole sentence is ready
async function ttsStream(model: string, text: string, voiceName: string, languageCode: string, onChunk: (pcmB64: string) => void) {
  const voice = FEMALE.has(voiceName) ? voiceName : "Leda";
  for (const key of keyList("GEMINI_API_KEY")) {
    if (!ttsUsable(key, "*")) continue;
    for (const m of (await ttsModelsFor(key, model)).filter((x) => !/preview/.test(x))) {
      const r = await fetch(`${GEMINI}/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { temperature: 0, responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }, ...(languageCode ? { languageCode } : {}) } },
        }),
        signal: AbortSignal.timeout(25000),
      }).catch(() => null);
      if (!r || !r.ok || !r.body) {
        const msg = r ? await r.text().catch(() => "") : "";
        console.error(`tts stream ${m} ${r?.status}`);
        ttsFailed(key, m, r?.status || 0, msg);
        if (r?.status === 401 || r?.status === 403) break;
        continue;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let got = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5));
            for (const p of j?.candidates?.[0]?.content?.parts || []) {
              const raw = p?.inlineData?.data;
              if (raw) { onChunk(wavToPcm(String(raw)) || String(raw)); got++; }
            }
          } catch { /* partial line */ }
        }
      }
      if (got) return { model: m, voice, chunks: got };
    }
  }
  throw new Error("tts stream failed");
}

// Clear message telling the user which credits are finished and what still works.
function creditMessage(reason: string, voiceLeft: number, textLeft: number): string {
  if (reason === "no_text_credits") {
    return voiceLeft > 0
      ? `আপনার টাইপিং ক্রেডিট শেষ। এখন শুধু ভয়েসে কথা বলতে পারবেন (ভয়েস ক্রেডিট বাকি ${voiceLeft})। টাইপ করতে Settings → Premium থেকে Text Credits কিনুন।`
      : "আপনার টাইপিং আর ভয়েস দুই ক্রেডিটই শেষ। Settings → Premium থেকে নতুন প্যাকেজ কিনুন।";
  }
  if (reason === "no_voice_credits") {
    return textLeft > 0
      ? `আপনার ভয়েস ক্রেডিট শেষ। এখন শুধু টাইপ করে কথা বলতে পারবেন (টাইপিং ক্রেডিট বাকি ${textLeft})। ভয়েসের জন্য Settings → Premium থেকে Voice Credits কিনুন।`
      : "আপনার ভয়েস আর টাইপিং দুই ক্রেডিটই শেষ। Settings → Premium থেকে নতুন প্যাকেজ কিনুন।";
  }
  if (reason === "not_premium") return "আপনার ROSE Premium চালু নেই বা মেয়াদ শেষ। Settings → Premium থেকে প্যাকেজ কিনুন, অথবা Connections-এ নিজের ফ্রি API key দিন।";
  if (reason === "ai_paused") return "আপনার ROSE Premium এখন বন্ধ রাখা আছে। ROSE সাপোর্টের সাথে যোগাযোগ করুন, অথবা Connections-এ নিজের ফ্রি API key দিন।";
  if (reason === "no_profile") return "অ্যাকাউন্ট পাওয়া যায়নি।";
  if (reason === "blocked") return "আপনার অ্যাকাউন্ট বন্ধ করা আছে।";
  return "Premium বন্ধ।";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    // keys, settings, the user and the request body are fetched together, not one after another
    const [, cfg, auth, body] = await Promise.all([
      loadKeys(service).catch(() => {}),
      loadCfg(service).catch(() => ({})),
      service.auth.getUser(token),
      req.json().catch(() => ({})),
    ]);
    const u = (auth as any)?.data;
    if ((auth as any)?.error || !u?.user) return json({ ok: false, reason: "not_logged_in", message: "লগইন করা নেই।" }, 401);
    const userId = u.user.id;
    const action = String(body?.action || "chat");

    const settings = {
      text_engine: cfg?.text_engine || "groq",
      text_model: cfg?.text_model || "llama-3.3-70b-versatile",
      voice_engine: cfg?.voice_engine || "gemini",
      voice_model: cfg?.voice_model || "gemini-3.5-flash-lite",
      tts_model: cfg?.tts_model || "gemini-3.8-flash-lite-tts",
    };
    const groqModel = settings.text_model.startsWith("gemini") ? "llama-3.3-70b-versatile" : settings.text_model;

    const denied = (c: any) =>
      json(
        {
          ok: false,
          reason: c?.reason,
          message: creditMessage(String(c?.reason || ""), Number(c?.voice_left ?? 0), Number(c?.text_left ?? 0)),
          voice_left: c?.voice_left ?? null,
          text_left: c?.text_left ?? null,
        },
        402,
      );

    if (action === "status") {
      const { data: p } = await service
        .from("profiles")
        .select("plan, paid_until, premium_voice_left, premium_text_left")
        .eq("id", userId)
        .maybeSingle();
      return json({ ok: true, ...p });
    }

    if (action === "tts") {
      const text = String(body?.text || "").slice(0, 3000).trim();
      if (!text) return json({ ok: false, reason: "empty" }, 400);
      const { data: c } = await service.rpc("premium_consume", { p_user: userId, p_kind: "tts" });
      if (!c?.ok) return denied(c);
      if (c.gemini === false) return denied({ reason: "ai_paused" });
      const lang = String(body?.languageCode || (/[ঀ-৿]/.test(text) ? "bn-BD" : ""));
      const out = await callTts(settings.tts_model, text, String(body?.voiceName || "Leda"), lang);
      console.log(`tts ${Date.now() - t0}ms ${text.length} chars ${out.model}`);
      return json({ ok: true, audio: out.audio, modelUsed: out.model, voiceUsed: out.voice });
    }

    if (action === "tts_stream") {
      const text = String(body?.text || "").slice(0, 3000).trim();
      if (!text) return json({ ok: false, reason: "empty" }, 400);
      const { data: c } = await service.rpc("premium_consume", { p_user: userId, p_kind: "tts" });
      if (!c?.ok) return denied(c);
      if (c.gemini === false) return denied({ reason: "ai_paused" });
      const lang = String(body?.languageCode || (/[\u0980-\u09ff]/.test(text) ? "bn-BD" : ""));
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          let first = 0;
          try {
            await ttsStream(settings.tts_model, text, String(body?.voiceName || "Leda"), lang, (a) => {
              if (!first) first = Date.now() - t0;
              ctrl.enqueue(enc.encode(JSON.stringify({ a }) + "\n"));
            });
            ctrl.enqueue(enc.encode(JSON.stringify({ done: true }) + "\n"));
          } catch (e) {
            ctrl.enqueue(enc.encode(JSON.stringify({ error: String((e as Error)?.message || e) }) + "\n"));
          }
          console.log(`tts_stream first ${first}ms all ${Date.now() - t0}ms ${text.length} chars`);
          ctrl.close();
        },
      });
      return new Response(stream, { headers: { ...cors, "Content-Type": "application/x-ndjson" } });
    }

    // listening without the phone's speech recognizer (no start beep): no credit is used, only a premium check
    if (action === "stt") {
      const audio = String(body?.audio || "");
      if (!audio || audio.length > 4000000) return json({ ok: false, reason: "empty" }, 400);
      const { data: c } = await service.rpc("premium_consume", { p_user: userId, p_kind: "tts" });
      if (!c?.ok) return denied(c);
      if (c.gemini === false) return denied({ reason: "ai_paused" });
      // live caption while he is still talking: only the fast Whisper, never the slow backup
      if (body?.partial) {
        const t = await whisperStt(audio, String(body?.language || "Bengali")).catch(() => null);
        return json({ ok: true, text: t || "" });
      }
      const text = await callStt(audio, String(body?.language || "Bengali"));
      console.log(`stt ${Date.now() - t0}ms`);
      return json({ ok: true, text });
    }

    // chat
    const forVoice = Boolean(body?.forVoice);
    const live = Boolean(body?.live);
    const messages: Msg[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
      .slice(-20)
      .map((m: any) => ({
        role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 12000),
      }));
    if (!messages.some((m) => m.role === "user")) return json({ ok: false, reason: "empty" }, 400);

    const { data: c } = await service.rpc("premium_consume", { p_user: userId, p_kind: forVoice ? "voice" : "text" });
    if (!c?.ok) return denied(c);

    const maxTokens = Math.min(Math.max(Number(body?.maxTokens) || 1024, 64), 2048);
    const temperature = typeof body?.temperature === "number" ? body.temperature : 0.7;
    // the admin can allow Gemini, Groq or both for each Gmail
    const canGemini = c.gemini !== false;
    const canGroq = c.groq !== false;
    let engine = live ? "gemini" : forVoice ? settings.voice_engine : settings.text_engine;
    if (engine === "gemini" && !canGemini) engine = "groq";
    if (engine === "groq" && !canGroq) engine = "gemini";
    const model = forVoice ? settings.voice_model : settings.text_model;
    const geminiModel = model.startsWith("gemini") ? model : settings.voice_model;

    // only the phone-action tool is passed on (kept small)
    const tools = (Array.isArray(body?.tools) ? body.tools : []).filter((t: any) => t && typeof t.name === "string").slice(0, 4);
    let out: { text: string; model: string; sources?: any[]; calls?: any[] };
    try {
      out = engine === "groq"
        ? await callGroq(groqModel, messages, maxTokens, temperature)
        : await callGemini(geminiModel, messages, maxTokens, temperature, live, tools, forVoice);
    } catch (e) {
      const other = engine === "groq" ? "gemini" : "groq";
      if ((other === "gemini" && !canGemini) || (other === "groq" && !canGroq)) throw e;
      out = other === "groq"
        ? await callGroq(groqModel, messages, maxTokens, temperature)
        : await callGemini(settings.voice_model, messages, maxTokens, temperature, false, tools, forVoice);
    }
    console.log(`chat ${forVoice ? "voice" : "text"} ${Date.now() - t0}ms ${out.model}`);
    return json({
      ok: true,
      text: out.text,
      modelUsed: out.model,
      sources: out.sources || [],
      calls: out.calls || [],
      voice_left: c?.voice_left ?? null,
      text_left: c?.text_left ?? null,
    });
  } catch (e) {
    return json({ ok: false, reason: "server_error", message: String((e as Error)?.message || e).replace(/AIza[0-9A-Za-z\-_]+|gsk_[0-9A-Za-z]+/g, "[KEY]") }, 500);
  }
});
