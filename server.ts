import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
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
import { classifyGeminiError } from './src/utils/errorClassifier';
import {
  getConfirmationPromptText,
  validatePhoneAction,
} from './src/utils/phoneActions';
import { DEFAULT_LIVE_MODELS, LiveModelInfo } from './src/types/tiya';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createAiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractApiKey(req: Request): string {
  const headerKey = req.header('x-gemini-api-key') || '';
  const bodyKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
  return (headerKey || bodyKey).trim();
}

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
          description:
            'One of: open_app, call, whatsapp_call, whatsapp_message, messenger_message, messenger_call',
        },
        app: {
          type: Type.STRING,
          description: 'App name when action is open_app (e.g. YouTube)',
        },
        contact: {
          type: Type.STRING,
          description: 'Contact name or phone number for call/message actions',
        },
        text: {
          type: Type.STRING,
          description: 'Message text for whatsapp_message or messenger_message',
        },
      },
      required: ['action'],
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Test user's Gemini API key
  app.post('/api/gemini/test-key', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ ok: false, label: 'No API key', detail: 'Enter your Gemini API key first.' });
      return;
    }

    try {
      const ai = createAiClient(apiKey);
      const pager = await ai.models.list({ config: { pageSize: 10 } });
      let count = 0;
      for await (const _model of pager) {
        count++;
        if (count >= 5) break;
      }
      res.json({ ok: true, label: 'READY', detail: 'API key verified and ready.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(message);
      res.status(400).json({ ok: false, label: classified.label, detail: classified.detail });
    }
  });

  // Fetch available Gemini Live models with the user's key
  app.post('/api/gemini/models', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ ok: false, label: 'No API key', detail: 'Add your Gemini API key in Connections.' });
      return;
    }

    try {
      const ai = createAiClient(apiKey);
      const pager = await ai.models.list({ config: { pageSize: 100 } });
      const discovered: LiveModelInfo[] = [];
      const seen = new Set<string>();

      for await (const m of pager) {
        const rawName = (m.name || '').replace(/^models\//, '');
        const methods = Array.isArray(m.supportedActions) ? m.supportedActions : [];
        const supportsBidi =
          methods.some((a) => a.toLowerCase().includes('bidigeneratecontent')) ||
          rawName.toLowerCase().includes('live') ||
          rawName.toLowerCase().includes('native-audio');

        if (rawName && supportsBidi && !seen.has(rawName)) {
          seen.add(rawName);
          discovered.push({
            id: rawName,
            displayName: m.displayName || rawName,
            description: m.description || 'Gemini Live real-time audio model',
          });
        }
      }

      // Ensure recommended Gemini 3.8 Live models remain available at top if not duplicated
      const merged: LiveModelInfo[] = [];
      const mergedIds = new Set<string>();
      for (const def of DEFAULT_LIVE_MODELS) {
        merged.push(def);
        mergedIds.add(def.id);
      }
      for (const item of discovered) {
        if (!mergedIds.has(item.id)) {
          merged.push(item);
          mergedIds.add(item.id);
        }
      }

      res.json({ ok: true, models: merged });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(message);
      res.status(400).json({ ok: false, label: classified.label, detail: classified.detail });
    }
  });

  // Text Chat endpoint using gemini-4-hydrogen
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ ok: false, label: 'No API key', detail: 'Add your Gemini API key in Settings > Connections.' });
      return;
    }

    const { message, history, systemInstruction } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      systemInstruction?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ ok: false, label: 'Invalid request', detail: 'Message cannot be empty.' });
      return;
    }

    try {
      const ai = createAiClient(apiKey);
      const formattedHistory = Array.isArray(history)
        ? history.slice(-16).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text }],
          }))
        : [];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...formattedHistory,
          { role: 'user', parts: [{ text: message }] },
        ],
        config: {
          systemInstruction: systemInstruction || 'You are TIYA, a helpful Bengali-default AI assistant.',
          tools: [{ functionDeclarations: [buildPhoneActionTool(false)] }],
        },
      });

      const functionCalls = response.functionCalls || [];
      let detectedAction = null;
      for (const call of functionCalls) {
        if (call.name === 'trigger_phone_action' && call.args) {
          const valid = validatePhoneAction(call.args);
          if (valid) {
            detectedAction = valid;
            break;
          }
        }
      }

      let replyText = (response.text || '').trim();
      if (detectedAction && !replyText) {
        replyText = getConfirmationPromptText(detectedAction);
      }

      res.json({
        ok: true,
        text: replyText || 'বলুন, কীভাবে সাহায্য করতে পারি?',
        action: detectedAction,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(msg);
      res.status(400).json({ ok: false, label: classified.label, detail: classified.detail });
    }
  });

  // Mic transcription endpoint for CHAT screen
  app.post('/api/gemini/transcribe', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ ok: false, label: 'No API key', detail: 'Add your Gemini API key in Settings > Connections.' });
      return;
    }

    const { audioBase64, mimeType, language } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      language?: string;
    };

    if (!audioBase64) {
      res.status(400).json({ ok: false, label: 'Invalid audio', detail: 'No audio data received.' });
      return;
    }

    try {
      const ai = createAiClient(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: `Transcribe the spoken audio accurately in its original language (expected primary language: ${language || 'Bengali'}). Output only the transcribed text with no commentary.`,
            },
          ],
        },
      });

      res.json({ ok: true, text: (response.text || '').trim() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(msg);
      res.status(400).json({ ok: false, label: classified.label, detail: classified.detail });
    }
  });

  // Voice check endpoint using Gemini TTS
  app.post('/api/gemini/voice-check', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ ok: false, label: 'No API key', detail: 'Add your Gemini API key in Settings > Connections.' });
      return;
    }

    const { voiceName, assistantName, yourName, language } = req.body as {
      voiceName?: string;
      assistantName?: string;
      yourName?: string;
      language?: string;
    };

    const name = assistantName?.trim() || 'তিয়া';
    const userPart = yourName?.trim() ? ` ${yourName.trim()},` : '';
    const sampleByLang: Record<string, string> = {
      Bengali: `হ্যালো${userPart} আমি ${name}। আপনার ভয়েস সেটআপ একদম ঠিক আছে!`,
      English: `Hello${userPart} I am ${name}. Your voice check is working clearly.`,
      Urdu: `السلام علیکم${userPart} میں ${name} ہوں۔ آپ کی آواز بالکل ٹھیک کام کر رہی ہے۔`,
      Hindi: `नमस्ते${userPart} मैं ${name} हूँ। आपकी आवाज़ बिल्कुल सही काम कर रही है।`,
      Arabic: `مرحباً${userPart} أنا ${name}. تم ضبط الصوت بنجاح.`,
    };

    const text = sampleByLang[language || 'Bengali'] || sampleByLang.Bengali;

    try {
      const ai = createAiClient(apiKey);
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: text,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || 'Zephyr',
              },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data,
      );
      if (!audioPart?.inlineData?.data) {
        res.status(500).json({ ok: false, label: 'Connection failed', detail: 'No audio returned from TTS.' });
        return;
      }

      res.json({
        ok: true,
        audioBase64: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/pcm;rate=24000',
        text,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyGeminiError(msg);
      res.status(400).json({ ok: false, label: classified.label, detail: classified.detail });
    }
  });

  const server = http.createServer(app);

  // WebSocket server for Gemini Live API native audio
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    let activeSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosedByClient = false;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const closeSession = () => {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      if (activeSession) {
        try {
          activeSession.close();
        } catch {
          // ignore
        }
        activeSession = null;
      }
    };

    const connectWithFallback = async (params: {
      apiKey: string;
      modelsToTry: string[];
      voiceName: string;
      systemInstruction: string;
    }) => {
      const { apiKey, modelsToTry, voiceName, systemInstruction } = params;
      if (!apiKey) {
        safeSend({
          type: 'error',
          label: 'No API key',
          detail: 'Add your Gemini API key in Settings > Connections.',
        });
        return;
      }

      const ai = createAiClient(apiKey);
      let lastError = { label: 'Model not available', detail: 'No Live voice model available.' };

      for (const modelId of modelsToTry) {
        if (isClosedByClient) return;

        let connected = false;
        let receivedErrorBeforeOpen = false;

        try {
          const isExtendedThinking = modelId.includes('extended-thinking');
          const toolDecl = buildPhoneActionTool(isExtendedThinking);

          const sessionPromise = ai.live.connect({
            model: modelId,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction,
              ...(isExtendedThinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              tools: [{ functionDeclarations: [toolDecl] }],
            },
            callbacks: {
              onopen: () => {
                connected = true;
                if (connectTimeout) {
                  clearTimeout(connectTimeout);
                  connectTimeout = null;
                }
                safeSend({ type: 'ready', model: modelId });
              },
              onmessage: (message: LiveServerMessage) => {
                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  safeSend({
                    type: 'input_transcript',
                    text: content.inputTranscription.text,
                  });
                }
                if (content?.outputTranscription?.text) {
                  safeSend({
                    type: 'output_transcript',
                    text: content.outputTranscription.text,
                  });
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    safeSend({ type: 'audio', data: part.inlineData.data });
                  }
                }
                if (content?.interrupted) {
                  safeSend({ type: 'interrupted' });
                }
                if (content?.turnComplete) {
                  safeSend({ type: 'turn_complete' });
                }
                if (message.toolCall?.functionCalls?.length) {
                  for (const call of message.toolCall.functionCalls) {
                    if (call.name === 'trigger_phone_action' && call.args) {
                      const valid = validatePhoneAction(call.args);
                      if (valid) {
                        safeSend({ type: 'phone_action', action: valid });
                        activeSession?.sendToolResponse({
                          functionResponses: [
                            {
                              id: call.id,
                              name: call.name,
                              response: {
                                status: 'awaiting_user_confirmation',
                                prompt: getConfirmationPromptText(valid),
                              },
                              ...(isExtendedThinking
                                ? { scheduling: FunctionResponseScheduling.WHEN_IDLE }
                                : {}),
                            },
                          ],
                        });
                      } else {
                        activeSession?.sendToolResponse({
                          functionResponses: [
                            {
                              id: call.id,
                              name: call.name,
                              response: { status: 'invalid_action' },
                            },
                          ],
                        });
                      }
                    }
                  }
                }
              },
              onerror: (errEvent: ErrorEvent) => {
                receivedErrorBeforeOpen = !connected;
                const msg = errEvent?.message || 'Gemini Live connection error';
                const classified = classifyGeminiError(msg);
                lastError = { label: classified.label, detail: classified.detail };
                if (connected) {
                  safeSend({
                    type: 'error',
                    label: classified.label,
                    detail: classified.detail,
                  });
                }
              },
              onclose: (closeEvent: CloseEvent) => {
                if (!connected) {
                  receivedErrorBeforeOpen = true;
                  const reason = closeEvent?.reason || 'Live session closed unexpectedly';
                  const classified = classifyGeminiError(reason);
                  lastError = { label: classified.label, detail: classified.detail };
                } else if (!isClosedByClient) {
                  const reason = closeEvent?.reason || '';
                  if (reason) {
                    const classified = classifyGeminiError(reason);
                    safeSend({
                      type: 'error',
                      label: classified.label,
                      detail: classified.detail,
                    });
                  } else {
                    safeSend({ type: 'closed' });
                  }
                }
              },
            },
          });

          // Prevent hanging indefinitely in CONNECTING state (10s max per model attempt)
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            connectTimeout = setTimeout(() => {
              reject(new Error('Connection timeout — Model not available'));
            }, 10000);
          });

          activeSession = await Promise.race([sessionPromise, timeoutPromise]);
          if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
          }

          if (!receivedErrorBeforeOpen) {
            return;
          }
        } catch (err: unknown) {
          if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
          }
          const msg = err instanceof Error ? err.message : String(err);
          const classified = classifyGeminiError(msg);
          lastError = { label: classified.label, detail: classified.detail };
          closeSession();
          if (!classified.shouldFallback) {
            safeSend({
              type: 'error',
              label: classified.label,
              detail: classified.detail,
            });
            return;
          }
        }
      }

      if (!isClosedByClient) {
        safeSend({
          type: 'error',
          label: lastError.label,
          detail: lastError.detail,
        });
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type: string;
          apiKey?: string;
          model?: string;
          fallbackModels?: string[];
          autoFallback?: boolean;
          voiceName?: string;
          systemInstruction?: string;
          data?: string;
          text?: string;
        };

        if (msg.type === 'start') {
          const primaryModel = msg.model || DEFAULT_LIVE_MODELS[0].id;
          const candidates =
            msg.autoFallback && Array.isArray(msg.fallbackModels)
              ? [primaryModel, ...msg.fallbackModels.filter((m) => m !== primaryModel)]
              : [primaryModel];

          await connectWithFallback({
            apiKey: (msg.apiKey || '').trim(),
            modelsToTry: candidates,
            voiceName: msg.voiceName || 'Zephyr',
            systemInstruction: msg.systemInstruction || 'You are TIYA.',
          });
        } else if (msg.type === 'audio' && msg.data && activeSession) {
          activeSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'text' && msg.text && activeSession) {
          activeSession.sendRealtimeInput({
            text: msg.text,
          });
        } else if (msg.type === 'stop') {
          isClosedByClient = true;
          closeSession();
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    clientWs.on('close', () => {
      isClosedByClient = true;
      closeSession();
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TIYA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
