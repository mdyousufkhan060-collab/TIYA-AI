import { supabase } from './supabase';
import { premiumTts } from './premium';
import { fadePcm } from './pcmFade';
import { generateContent, pickTtsModels, responseAudio } from './geminiRest';

/** 👍 / 👎 on a ROSE reply (admin sees totals in 18 REPORTS & FEEDBACK). */
export async function sendFeedback(vote: 1 | -1, replyText: string, questionText?: string) {
  const { error } = await supabase.from('message_feedback').insert({
    vote,
    reply_text: replyText.slice(0, 2000),
    question_text: (questionText || '').slice(0, 1000) || null,
  });
  return !error;
}

export async function sendReport(category: string, message: string, page?: string) {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from('user_reports').insert({
    category,
    message: message.slice(0, 4000),
    page: page || null,
    email: data.user?.email || null,
  });
  return error ? error.message : null;
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function pcmWav(b64: string, rate = 24000) {
  const bin = atob(b64);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  const pcm = fadePcm(raw, rate);
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  h.setUint32(4, 36 + pcm.length, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  h.setUint32(16, 16, true);
  h.setUint16(20, 1, true);
  h.setUint16(22, 1, true);
  h.setUint32(24, rate, true);
  h.setUint32(28, rate * 2, true);
  h.setUint16(32, 2, true);
  h.setUint16(34, 16, true);
  w(36, 'data');
  h.setUint32(40, pcm.length, true);
  return URL.createObjectURL(new Blob([h.buffer, pcm], { type: 'audio/wav' }));
}

/**
 * Read a message aloud. Uses the phone's own voice when it has one for the language
 * (free), otherwise ROSE Premium voice from the server.
 * Returns an error text, or null when it started speaking.
 */
async function playB64(b64: string, onEnd?: () => void) {
  const url = pcmWav(b64);
  const a = new Audio(url);
  currentAudio = a;
  a.onended = () => {
    URL.revokeObjectURL(url);
    currentAudio = null;
    onEnd?.();
  };
  await a.play().catch(() => onEnd?.());
}

export async function speakText(
  text: string,
  voiceName = 'Leda',
  onEnd?: () => void,
  apiKey?: string,
): Promise<string | null> {
  stopSpeaking();
  const clean = text.replace(/[*#_`>~]/g, '').replace(/\{[\s\S]*\}\s*$/, '').trim().slice(0, 2500);
  if (!clean) return 'পড়ার মতো লেখা নেই।';
  const bangla = /[ঀ-৿]/.test(clean);
  const lang = bangla ? 'bn' : 'en';
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const voices = synth?.getVoices?.() || [];
  const local = voices.find((v) => v.lang?.toLowerCase().startsWith(lang));
  if (synth && (local || !bangla)) {
    const u = new SpeechSynthesisUtterance(clean);
    if (local) u.voice = local;
    u.lang = local?.lang || (bangla ? 'bn-BD' : 'en-US');
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
    return null;
  }
  // 1) the user's own Gemini key (free tier)
  const key = (apiKey || '').trim();
  if (key) {
    try {
      for (const model of await pickTtsModels(key)) {
        try {
          const r = await generateContent(key, model, {
            contents: [{ role: 'user', parts: [{ text: clean }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Leda' } } },
            },
          });
          const audio = responseAudio(r);
          if (audio?.data) {
            await playB64(audio.data, onEnd);
            return null;
          }
        } catch {
          /* try the next model */
        }
      }
    } catch {
      /* fall through */
    }
  }
  // 2) ROSE Premium voice from the server
  const res = await premiumTts(clean, voiceName);
  if (res.ok && res.audio) {
    await playB64(res.audio, onEnd);
    return null;
  }
  onEnd?.();
  if (/api key|key not valid|invalid/i.test(res.message || '')) {
    return 'শোনানো যাচ্ছে না: ROSE সার্ভারের Google key কাজ করছে না। Admin-কে জানানো হয়েছে।';
  }
  return 'এই ডিভাইসে বাংলা কণ্ঠ নেই। Connections-এ নিজের ফ্রি key দিন অথবা ROSE Premium নিন।';
}
