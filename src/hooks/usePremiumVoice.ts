import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageOption, VoiceState } from '../types/tiya';
import { premiumChat, premiumTts, type PremiumChatMessage } from '../lib/premium';

/**
 * ROSE PREMIUM voice (no API key on the phone).
 * Listen with the browser's speech recognition -> reply from the ROSE server
 * (uses VOICE credits) -> speak with server TTS. Separate from the Live voice
 * hook, which is untouched and still used when the user has their own key.
 */

const LANG_CODE: Partial<Record<LanguageOption, string>> = {
  Bengali: 'bn-BD',
  English: 'en-US',
  Hindi: 'hi-IN',
  Urdu: 'ur-PK',
  Arabic: 'ar-SA',
  Nepali: 'ne-NP',
};

function pcmToWavUrl(b64: string, sampleRate = 24000): string {
  const bin = atob(b64);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length, true);
  return URL.createObjectURL(new Blob([header, pcm], { type: 'audio/wav' }));
}

export function premiumVoiceSupported(): boolean {
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

interface Options {
  language: LanguageOption;
  voiceName: string;
  volume: number;
  speechSpeed: number;
  buildSystemPrompt: () => string;
  getHistory: () => Array<{ role: 'user' | 'assistant'; text: string }>;
  onAppend: (role: 'user' | 'assistant', text: string) => void;
  onCredits?: (voiceLeft: number | null, textLeft: number | null) => void;
}

export function usePremiumVoice(opts: Options) {
  const [state, setState] = useState<VoiceState>('idle');
  const [errorText, setErrorText] = useState('');
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const activeRef = useRef(false);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState('idle');
  }, []);

  const fail = useCallback((msg: string, speakToChat = true) => {
    activeRef.current = false;
    setErrorText(msg);
    setState('error');
    if (speakToChat) optsRef.current.onAppend('assistant', msg);
  }, []);

  const listen = useCallback(() => {
    if (!activeRef.current) return;
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      fail('এই ব্রাউজারে ভয়েস শোনা যাচ্ছে না। Chrome বা Edge ব্যবহার করুন, অথবা টাইপ করে লিখুন।');
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = LANG_CODE[optsRef.current.language] || 'bn-BD';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e: any) => {
      heard = Array.from(e.results as ArrayLike<any>)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ')
        .trim();
    };
    rec.onerror = (e: any) => {
      if (!activeRef.current) return;
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        fail('মাইক্রোফোনের অনুমতি দেওয়া নেই। ব্রাউজারে মাইক চালু করে আবার চেষ্টা করুন।');
      }
    };
    rec.onend = () => {
      if (!activeRef.current) return;
      if (!heard) {
        // nothing said: keep listening
        window.setTimeout(listen, 250);
        return;
      }
      void answer(heard);
    };
    setState('listening');
    try {
      rec.start();
    } catch {
      window.setTimeout(listen, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail]);

  const answer = useCallback(
    async (heard: string) => {
      const o = optsRef.current;
      o.onAppend('user', heard);
      setState('thinking');
      const history: PremiumChatMessage[] = o
        .getHistory()
        .slice(-12)
        .map((h) => ({ role: h.role, content: h.text }));
      const res = await premiumChat(
        [
          { role: 'system', content: o.buildSystemPrompt() + '\n\nVOICE MODE: reply in 1-3 short spoken sentences, no lists, no markdown, no JSON.' },
          ...history,
          { role: 'user', content: heard },
        ],
        { forVoice: true, maxTokens: 400 },
      );
      if (!activeRef.current) return;
      if (typeof res.voiceLeft === 'number' || typeof res.textLeft === 'number') {
        o.onCredits?.(res.voiceLeft ?? null, res.textLeft ?? null);
      }
      if (!res.ok || !res.text) {
        fail(res.message || 'উত্তর পাওয়া যায়নি।');
        return;
      }
      const reply = res.text.replace(/\{[\s\S]*\}\s*$/, '').trim() || res.text;
      o.onAppend('assistant', reply);
      setState('speaking');
      const tts = await premiumTts(reply, o.voiceName);
      if (!activeRef.current) return;
      if (tts.ok && tts.audio) {
        const url = pcmToWavUrl(tts.audio);
        const a = new Audio(url);
        audioRef.current = a;
        a.volume = Math.max(0, Math.min(1, o.volume ?? 1));
        a.playbackRate = Math.max(0.75, Math.min(1.35, o.speechSpeed || 1));
        a.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (activeRef.current) listen();
        };
        a.onerror = () => {
          URL.revokeObjectURL(url);
          if (activeRef.current) listen();
        };
        try {
          await a.play();
        } catch {
          if (activeRef.current) listen();
        }
      } else {
        if (activeRef.current) listen();
      }
    },
    [fail, listen],
  );

  const start = useCallback(() => {
    if (activeRef.current) return;
    setErrorText('');
    activeRef.current = true;
    setState('connecting');
    listen();
  }, [listen]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { state, errorText, toggle, stop, start };
}
