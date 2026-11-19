/**
 * TIYA client-side "server".
 *
 * TIYA used to send every AI request through server.ts (Express + WebSocket). That
 * server only runs inside the AI Studio preview, NOT on Vercel or inside the Android
 * app — so on tiya-ai.vercel.app key tests, chat, mic and live voice all failed.
 *
 * This file does the same work directly from the phone/browser (like ROSE):
 *  - installClientApi(): answers the old "/api/..." fetch calls locally
 *  - LocalLiveSocket: drop-in replacement for the "/ws/live" WebSocket
 * The API keys never leave the device except to Google / Groq themselves.
 */
import {
  Behavior,
  FunctionDeclaration,
  FunctionResponseScheduling,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { classifyGeminiError } from '../utils/errorClassifier';
import { getConfirmationPromptText, validatePhoneAction } from '../utils/phoneActions';
import { validateNavigateToolArgs } from '../utils/tiyaNavigation';
import { DEFAULT_LIVE_MODELS, LiveModelInfo } from '../types/tiya';

const createAiClient = (apiKey: string) => new GoogleGenAI({ apiKey });

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

function buildPhoneActionTool(nonBlocking: boolean): FunctionDeclaration {
  return {
    name: 'trigger_phone_action',
    description:
      'Requests a structured phone action (open_app, call, whatsapp_call, whatsapp_message, messenger_message, messenger_call). Always call this when the user wants to open an app, call someone, or send a WhatsApp/Messenger message.',
    ...(nonBlocking ? { behavior: Behavior.NON_BLOCKING } : {}),
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'One of: open_app, call, whatsapp_call, whatsapp_message, messenger_message, messenger_call',
        },
        app: { type: Type.STRING, description: 'App name when action is open_app (e.g. YouTube)' },
        contact: { type: Type.STRING, description: 'Contact name or phone number for call/message actions' },
        text: { type: Type.STRING, description: 'Message text for whatsapp_message or messenger_message' },
      },
      required: ['action'],
    },
  };
}

function buildNavigateAppTool(nonBlocking: boolean): FunctionDeclaration {
  return {
    name: 'navigate_app',
    description:
      'Opens a TIYA screen or settings page/subpage, or navigates back. Use whenever the user asks to open Settings, a numbered Settings bar, Home, Chat, Mic Test, Privacy Controls, etc.',
    ...(nonBlocking ? { behavior: Behavior.NON_BLOCKING } : {}),
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'open or back' },
        tab: { type: Type.STRING, description: 'home, chat, or settings' },
        page: {
          type: Type.STRING,
          description:
            'Settings page ID: hub, about, connections, live_model, voice_language, chats_memory, look_feel, phone_control, developer_tools, privacy_controls, my_account, premium',
        },
        subpage: { type: Type.STRING, description: 'Optional subpage ID inside a Settings page (e.g. mic_test, health_check)' },
      },
      required: ['action'],
    },
  };
}

function buildGetLatestMotivationTool(nonBlocking: boolean): FunctionDeclaration {
  return {
    name: 'get_latest_motivation',
    description:
      'Fetches the latest published motivation post so TIYA can read it to the user in Bengali. Call this whenever the user asks for daily or today’s motivation.',
    ...(nonBlocking ? { behavior: Behavior.NON_BLOCKING } : {}),
    parameters: { type: Type.OBJECT, properties: {} },
  };
}

type ApiResult = { status: number; json: Record<string, unknown> };
const ok = (json: Record<string, unknown>): ApiResult => ({ status: 200, json });
const fail = (status: number, label: string, detail: string): ApiResult => ({
  status,
  json: { ok: false, label, detail },
});
const failFromError = (err: unknown): ApiResult => {
  const c = classifyGeminiError(errMsg(err));
  return fail(400, c.label, c.detail);
};

// Chat models tried in order when the chosen one is not available on this key
const CHAT_MODEL_FALLBACKS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];

async function handle(path: string, key: string, body: any): Promise<ApiResult> {
  switch (path) {
    case '/api/health':
      return ok({ ok: true });

    case '/api/gemini/test-key': {
      if (!key) return fail(401, 'No API key', 'Enter your Gemini API key first.');
      try {
        const pager = await createAiClient(key).models.list({ config: { pageSize: 10 } });
        let n = 0;
        for await (const _m of pager) {
          if (++n >= 3) break;
        }
        return ok({ ok: true, label: 'READY', detail: 'API key verified and ready.' });
      } catch (err) {
        return failFromError(err);
      }
    }

    case '/api/gemini/models': {
      if (!key) return fail(401, 'No API key', 'Add your Gemini API key in Connections.');
      try {
        const pager = await createAiClient(key).models.list({ config: { pageSize: 100 } });
        const discovered: LiveModelInfo[] = [];
        const seen = new Set<string>();
        for await (const m of pager) {
          const rawName = (m.name || '').replace(/^models\//, '');
          const methods = Array.isArray(m.supportedActions) ? m.supportedActions : [];
          const bidi =
            methods.some((a) => a.toLowerCase().includes('bidigeneratecontent')) ||
            rawName.toLowerCase().includes('live') ||
            rawName.toLowerCase().includes('native-audio');
          if (rawName && bidi && !seen.has(rawName)) {
            seen.add(rawName);
            discovered.push({
              id: rawName,
              displayName: m.displayName || rawName,
              description: m.description || 'Gemini Live real-time audio model',
            });
          }
        }
        const merged: LiveModelInfo[] = [];
        const ids = new Set<string>();
        for (const d of DEFAULT_LIVE_MODELS) {
          merged.push(d);
          ids.add(d.id);
        }
        for (const d of discovered) if (!ids.has(d.id)) merged.push(d);
        return ok({ ok: true, models: merged });
      } catch (err) {
        return failFromError(err);
      }
    }

    case '/api/providers/test-key': {
      const provider = String(body?.provider || '');
      const cleanKey = String(body?.apiKey || '').trim();
      if (!cleanKey) return fail(401, 'ERROR', 'No API key entered.');
      const endpoints: Record<string, { url: string; headers: Record<string, string> }> = {
        groq: { url: 'https://api.groq.com/openai/v1/models', headers: { Authorization: `Bearer ${cleanKey}` } },
        openrouter: { url: 'https://openrouter.ai/api/v1/models', headers: { Authorization: `Bearer ${cleanKey}` } },
        github: {
          url: 'https://api.github.com/user',
          headers: { Authorization: `Bearer ${cleanKey}`, Accept: 'application/vnd.github+json' },
        },
        openai: { url: 'https://api.openai.com/v1/models', headers: { Authorization: `Bearer ${cleanKey}` } },
      };
      const target = endpoints[provider];
      if (!target) return fail(400, 'ERROR', 'Unsupported provider.');
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const r = await nativeFetch(target.url, { method: 'GET', headers: target.headers, signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) return ok({ ok: true, label: 'READY', detail: `${provider.toUpperCase()} key verified and ready.` });
        if (r.status === 401 || r.status === 403) return fail(400, 'ERROR', 'Invalid key — please copy it again.');
        return fail(400, 'ERROR', `Key check failed (HTTP ${r.status}).`);
      } catch {
        return fail(400, 'ERROR', 'Network error while testing key.');
      }
    }

    case '/api/gemini/chat-models': {
      if (!key) return fail(401, 'No API key', 'Add your Gemini API key first.');
      try {
        const pager = await createAiClient(key).models.list({ config: { pageSize: 100 } });
        const models: LiveModelInfo[] = [];
        const seen = new Set<string>();
        for await (const m of pager) {
          const rawName = (m.name || '').replace(/^models\//, '');
          const methods = Array.isArray(m.supportedActions) ? m.supportedActions : [];
          const text =
            methods.some((a) => a.toLowerCase().includes('generatecontent')) || rawName.includes('gemini');
          const skip = /embedding|tts|live|native-audio|image/i.test(rawName);
          if (rawName && text && !skip && !seen.has(rawName)) {
            seen.add(rawName);
            models.push({ id: rawName, displayName: m.displayName || rawName, description: m.description || 'Gemini text model' });
          }
        }
        return ok({ ok: true, models: models.slice(0, 30) });
      } catch (err) {
        return failFromError(err);
      }
    }

    case '/api/gemini/chat': {
      if (!key) return fail(401, 'No API key', 'Add your Gemini API key in Settings > Connections.');
      const message = String(body?.message || '');
      if (!message.trim()) return fail(400, 'Invalid request', 'Message cannot be empty.');
      const history = Array.isArray(body?.history) ? body.history : [];
      const contents = [
        ...history.slice(-16).map((h: any) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(h.text || '') }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];
      const chosen = String(body?.model || '').trim();
      const models = Array.from(new Set([chosen, ...CHAT_MODEL_FALLBACKS].filter(Boolean)));
      const ai = createAiClient(key);
      let lastErr: unknown = null;
      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: body?.systemInstruction || 'You are TIYA, a helpful Bengali-default AI assistant.',
              tools: [
                {
                  functionDeclarations: [
                    buildPhoneActionTool(false),
                    buildNavigateAppTool(false),
                    buildGetLatestMotivationTool(false),
                  ],
                },
              ],
            },
          });
          let action = null;
          let navigate = null;
          let needsMotivation = false;
          for (const call of response.functionCalls || []) {
            if (call.name === 'trigger_phone_action' && call.args && !action) {
              action = validatePhoneAction(call.args);
            } else if (call.name === 'navigate_app' && call.args && !navigate) {
              navigate = validateNavigateToolArgs(call.args);
            } else if (call.name === 'get_latest_motivation') {
              needsMotivation = true;
            }
          }
          let text = (response.text || '').trim();
          if (action && !text) text = getConfirmationPromptText(action);
          else if (navigate && !text) text = (navigate as any).confirmBn || '';
          return ok({ ok: true, text: text || 'বলুন, কীভাবে সাহায্য করতে পারি?', action, navigate, needsMotivation, model });
        } catch (err) {
          lastErr = err;
          const c = classifyGeminiError(errMsg(err));
          // wrong / retired model or overload → try the next model; bad key → stop
          if (!c.shouldFallback && !/not found|no longer|404|unavailable|overload|503/i.test(errMsg(err))) break;
        }
      }
      return failFromError(lastErr);
    }

    case '/api/gemini/transcribe': {
      if (!key) return fail(401, 'No API key', 'Add your Gemini API key in Settings > Connections.');
      if (!body?.audioBase64) return fail(400, 'Invalid audio', 'No audio data received.');
      const ai = createAiClient(key);
      let lastErr: unknown = null;
      for (const model of ['gemini-3.5-transcribe', ...CHAT_MODEL_FALLBACKS]) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                { inlineData: { mimeType: body.mimeType || 'audio/webm', data: body.audioBase64 } },
                {
                  text: `Transcribe the spoken audio accurately in its original language (expected primary language: ${
                    body.language || 'Bengali'
                  }). Output only the transcribed text with no commentary.`,
                },
              ],
            },
          });
          return ok({ ok: true, text: (response.text || '').trim() });
        } catch (err) {
          lastErr = err;
        }
      }
      return failFromError(lastErr);
    }

    case '/api/gemini/voice-check': {
      if (!key) return fail(401, 'No API key', 'Add your Gemini API key in Settings > Connections.');
      const name = String(body?.assistantName || '').trim() || 'তিয়া';
      const userPart = String(body?.yourName || '').trim() ? ` ${String(body.yourName).trim()},` : '';
      const samples: Record<string, string> = {
        Bengali: `হ্যালো${userPart} আমি ${name}। আপনার ভয়েস সেটআপ একদম ঠিক আছে!`,
        English: `Hello${userPart} I am ${name}. Your voice check is working clearly.`,
        Urdu: `السلام علیکم${userPart} میں ${name} ہوں۔ آپ کی آواز بالکل ٹھیک کام کر رہی ہے۔`,
        Hindi: `नमस्ते${userPart} मैं ${name} हूँ। आपकी आवाज़ बिल्कुल सही काम कर रही है।`,
        Arabic: `مرحباً${userPart} أنا ${name}. تم ضبط الصوت بنجاح.`,
      };
      const text = samples[body?.language || 'Bengali'] || samples.Bengali;
      const ai = createAiClient(key);
      const ttsModels = Array.from(
        new Set([String(body?.ttsModel || '').trim(), 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts'].filter(Boolean)),
      );
      let lastErr: unknown = null;
      for (const model of ttsModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: text,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: body?.voiceName || 'Zephyr' } } },
            },
          });
          const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
          if (part?.inlineData?.data) {
            return ok({
              ok: true,
              audioBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
              text,
            });
          }
        } catch (err) {
          lastErr = err;
        }
      }
      return lastErr ? failFromError(lastErr) : fail(500, 'Connection failed', 'No audio returned from TTS.');
    }

    default:
      return fail(404, 'Not found', `Unknown endpoint ${path}`);
  }
}

// ---------------------------------------------------------------------------
// fetch interceptor for "/api/..." calls
// ---------------------------------------------------------------------------
let nativeFetch: typeof fetch = (...args) => fetch(...args);

export function installClientApi(): void {
  if (typeof window === 'undefined' || (window as any).__tiyaClientApi) return;
  (window as any).__tiyaClientApi = true;
  const original = window.fetch.bind(window);
  nativeFetch = original;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    } catch {
      url = '';
    }
    let path = '';
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin && u.pathname.startsWith('/api/')) path = u.pathname;
    } catch {
      path = '';
    }
    if (!path) return original(input as any, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    let body: any = {};
    try {
      body = init?.body ? JSON.parse(String(init.body)) : {};
    } catch {
      body = {};
    }
    const key = (headers.get('x-gemini-api-key') || body?.apiKey || '').trim();
    let result: ApiResult;
    try {
      result = await handle(path, path === '/api/providers/test-key' ? '' : key, body);
    } catch (err) {
      result = failFromError(err);
    }
    return new Response(JSON.stringify(result.json), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// ---------------------------------------------------------------------------
// LocalLiveSocket — same messages as the old /ws/live server, but runs on the device
// ---------------------------------------------------------------------------
type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

export class LocalLiveSocket {
  readyState = 0; // CONNECTING
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;

  private session: LiveSession | null = null;
  private closedByClient = false;
  private extended = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMotivation = new Map<string, { callId?: string; name: string; timer: ReturnType<typeof setTimeout> }>();

  constructor() {
    setTimeout(() => {
      if (this.closedByClient) return;
      this.readyState = 1; // OPEN
      this.onopen?.(new Event('open'));
    }, 0);
  }

  private emit(payload: Record<string, unknown>) {
    if (this.readyState !== 1) return;
    try {
      this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
    } catch {
      // ignore listener errors
    }
  }

  private closeSession() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    for (const p of this.pendingMotivation.values()) clearTimeout(p.timer);
    this.pendingMotivation.clear();
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // ignore
      }
      this.session = null;
    }
  }

  private sendTool(id: string | undefined, name: string, response: Record<string, unknown>) {
    this.session?.sendToolResponse({
      functionResponses: [
        {
          id,
          name,
          response,
          ...(this.extended ? { scheduling: FunctionResponseScheduling.WHEN_IDLE } : {}),
        },
      ],
    });
  }

  private async connect(apiKey: string, models: string[], voiceName: string, systemInstruction: string) {
    if (!apiKey) {
      this.emit({ type: 'error', label: 'No API key', detail: 'Add your Gemini API key in Settings > Connections.' });
      return;
    }
    const ai = createAiClient(apiKey);
    let lastError = { label: 'Model not available', detail: 'No Live voice model available.' };

    for (const modelId of models) {
      if (this.closedByClient) return;
      let connected = false;
      let failedBeforeOpen = false;
      try {
        const ext = modelId.includes('extended-thinking');
        this.extended = ext;
        const sessionPromise = ai.live.connect({
          model: modelId,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
            ...(ext ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            tools: [
              {
                functionDeclarations: [
                  buildPhoneActionTool(ext),
                  buildNavigateAppTool(ext),
                  buildGetLatestMotivationTool(ext),
                ],
              },
            ],
          },
          callbacks: {
            onopen: () => {
              connected = true;
              if (this.connectTimer) {
                clearTimeout(this.connectTimer);
                this.connectTimer = null;
              }
              this.emit({ type: 'ready', model: modelId });
            },
            onmessage: (message: LiveServerMessage) => this.onLiveMessage(message),
            onerror: (e: ErrorEvent) => {
              failedBeforeOpen = !connected;
              const c = classifyGeminiError(e?.message || 'Gemini Live connection error');
              lastError = { label: c.label, detail: c.detail };
              if (connected) this.emit({ type: 'error', label: c.label, detail: c.detail });
            },
            onclose: (e: CloseEvent) => {
              if (!connected) {
                failedBeforeOpen = true;
                const c = classifyGeminiError(e?.reason || 'Live session closed unexpectedly');
                lastError = { label: c.label, detail: c.detail };
              } else if (!this.closedByClient) {
                if (e?.reason) {
                  const c = classifyGeminiError(e.reason);
                  this.emit({ type: 'error', label: c.label, detail: c.detail });
                } else {
                  this.emit({ type: 'closed' });
                }
              }
            },
          },
        });
        const timeout = new Promise<never>((_r, reject) => {
          this.connectTimer = setTimeout(() => reject(new Error('Connection timeout — Model not available')), 10000);
        });
        this.session = await Promise.race([sessionPromise, timeout]);
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        if (this.closedByClient) {
          this.closeSession();
          return;
        }
        // give the socket a moment: an instant close means this model is not usable
        await new Promise((r) => setTimeout(r, 400));
        if (!failedBeforeOpen) return;
        this.closeSession();
      } catch (err) {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        const c = classifyGeminiError(errMsg(err));
        lastError = { label: c.label, detail: c.detail };
        this.closeSession();
        if (!c.shouldFallback) {
          this.emit({ type: 'error', label: c.label, detail: c.detail });
          return;
        }
      }
    }
    if (!this.closedByClient) this.emit({ type: 'error', label: lastError.label, detail: lastError.detail });
  }

  private onLiveMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    if (content?.inputTranscription?.text) this.emit({ type: 'input_transcript', text: content.inputTranscription.text });
    if (content?.outputTranscription?.text) this.emit({ type: 'output_transcript', text: content.outputTranscription.text });
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) this.emit({ type: 'audio', data: part.inlineData.data });
    }
    if (content?.interrupted) this.emit({ type: 'interrupted' });
    if (content?.turnComplete) this.emit({ type: 'turn_complete' });

    for (const call of message.toolCall?.functionCalls ?? []) {
      if (call.name === 'trigger_phone_action' && call.args) {
        const valid = validatePhoneAction(call.args);
        if (valid) {
          this.emit({ type: 'phone_action', action: valid });
          this.sendTool(call.id, call.name, { status: 'awaiting_user_confirmation', prompt: getConfirmationPromptText(valid) });
        } else {
          this.sendTool(call.id, call.name, { status: 'invalid_action' });
        }
      } else if (call.name === 'navigate_app' && call.args) {
        const nav = validateNavigateToolArgs(call.args);
        if (nav) {
          this.emit({ type: 'navigate', command: nav });
          this.sendTool(call.id, call.name, { status: 'navigated', message: (nav as any).confirmBn });
        }
      } else if (call.name === 'get_latest_motivation') {
        const token = call.id || `mot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const timer = setTimeout(() => {
          const entry = this.pendingMotivation.get(token);
          if (!entry) return;
          this.pendingMotivation.delete(token);
          this.sendTool(entry.callId, entry.name, { found: false, message: 'এখনো কোনো প্রকাশিত মোটিভেশন পাওয়া যায়নি।' });
        }, 3500);
        this.pendingMotivation.set(token, { callId: call.id, name: call.name || 'get_latest_motivation', timer });
        this.emit({ type: 'request_latest_motivation', callId: token, name: call.name });
      }
    }
  }

  send(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === 'start') {
      const primary = msg.model || DEFAULT_LIVE_MODELS[0].id;
      const candidates =
        msg.autoFallback && Array.isArray(msg.fallbackModels)
          ? [primary, ...msg.fallbackModels.filter((m: string) => m !== primary)]
          : [primary];
      void this.connect(String(msg.apiKey || '').trim(), candidates, msg.voiceName || 'Zephyr', msg.systemInstruction || 'You are TIYA.');
    } else if (msg.type === 'motivation_response' && msg.callId && this.session) {
      const pending = this.pendingMotivation.get(msg.callId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingMotivation.delete(msg.callId);
        const post = msg.post;
        this.sendTool(
          pending.callId,
          pending.name,
          post && String(post.body || '').trim()
            ? {
                found: true,
                title: String(post.title || '').trim() || 'Motivation',
                body: String(post.body).trim(),
                instruction: 'Read this published motivation post warmly to the user in Bengali.',
              }
            : { found: false, message: 'এখনো কোনো প্রকাশিত মোটিভেশন পাওয়া যায়নি।' },
        );
      }
    } else if (msg.type === 'audio' && msg.data && this.session) {
      this.session.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
    } else if (msg.type === 'text' && msg.text && this.session) {
      this.session.sendRealtimeInput({ text: msg.text });
    } else if (msg.type === 'stop') {
      this.closedByClient = true;
      this.closeSession();
    }
  }

  close() {
    if (this.readyState === 3) return;
    this.closedByClient = true;
    this.closeSession();
    this.readyState = 3; // CLOSED
    try {
      this.onclose?.(new CloseEvent('close'));
    } catch {
      // ignore
    }
  }
}

/** Live voice connection that works everywhere (Vercel, Android app, PC). */
export function createLiveSocket(): WebSocket {
  return new LocalLiveSocket() as unknown as WebSocket;
}
