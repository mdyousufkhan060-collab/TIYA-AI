import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageOption, VoiceState } from '../types/tiya';
import { premiumChat, premiumStt, premiumTts, type PremiumChatMessage } from '../lib/premium';
import { openQuietMic, type QuietMic } from '../lib/quietMic';
import { isVoiceMuted } from '../lib/voiceMute';
import { fadePcm } from '../lib/pcmFade';
import { phoneActionToolDeclaration } from '../lib/clientApi';
import { extractActionFromText, validatePhoneAction } from '../utils/phoneActions';
import type { PhoneAction } from '../types/tiya';

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
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  const pcm = fadePcm(raw, sampleRate);
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
  onAppend: (role: 'user' | 'assistant', text: string, action?: PhoneAction) => void;
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

  const micRef = useRef<QuietMic | null>(null);
  const stop = useCallback(() => {
    activeRef.current = false;
    micRef.current?.close();
    micRef.current = null;
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

  // quiet mic open: just start waiting for his words (no phone beep); otherwise the speech recognizer
  const listen = useCallback(() => {
    if (!activeRef.current) return;
    if (micRef.current) {
      micRef.current.setListening(true);
      setState('listening');
      return;
    }
    listenSR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listenSR = useCallback(() => {
    if (!activeRef.current) return;
    // muted: do not start the recognizer, look again shortly
    if (isVoiceMuted()) {
      setState('listening');
      window.setTimeout(listenSR, 800);
      return;
    }
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
      // stopped on purpose (an action result is coming): do not restart here
      if (!activeRef.current || recRef.current !== rec) return;
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

  // one turn: ask the server (with the phone-action tool), show the words, run the action, speak, listen again.
  // "note" turns carry an app result (e.g. the list of buttons on the screen) so ROSE can take the next step.
  const stepsRef = useRef(0);
  const fakeRef = useRef(0);
  const runTurn = useCallback(
    async (input: string, note: boolean) => {
      const o = optsRef.current;
      setState('thinking');
      const history: PremiumChatMessage[] = o
        .getHistory()
        .slice(-12)
        .map((h) => ({ role: h.role, content: h.text }));
      const res = await premiumChat(
        [
          {
            role: 'system',
            content:
              o.buildSystemPrompt() +
              '\n\nVOICE MODE: reply in 1-3 short spoken sentences, no lists, no markdown, never write tool names or JSON in the words.' +
              '\nPHONE ACTIONS: use the trigger_phone_action tool for every phone task (open an app, screen items, tap item <n>, scroll, type, ' +
              'read screen, comments, calls, messages). After a tool, the app sends the result as "[App result]"; read it and call the next ' +
              'step yourself until the task is done, one step at a time. Never say a step is done before its result says so.' +
              '\nORDER: first OPEN the app (open_app with app "Facebook", "YouTube"...; for his Facebook comments use app "open latest post comments"), ' +
              'then use "screen items" / "tap item <n>" inside it. Never use "read screen" or "screen items" while ROSE itself (com.myrosebd.rose) is on the screen.',
          },
          ...history,
          { role: 'user', content: note ? `[App result, not his words] ${input}` : input },
        ],
        { forVoice: true, maxTokens: 300, tools: [phoneActionToolDeclaration()] },
      );
      if (!activeRef.current) return;
      if (typeof res.voiceLeft === 'number' || typeof res.textLeft === 'number') {
        o.onCredits?.(res.voiceLeft ?? null, res.textLeft ?? null);
      }
      if (!res.ok) {
        fail(res.message || 'উত্তর পাওয়া যায়নি।');
        return;
      }
      // the action: a real tool call first, else a JSON written in the words
      let action: PhoneAction | null = null;
      for (const c of res.calls || []) {
        if (c.name === 'trigger_phone_action' && !action) action = validatePhoneAction(c.args);
      }
      const parsed = extractActionFromText(res.text || '');
      if (!action) action = parsed.action;
      const reply = (parsed.cleanText || '').replace(/`[^`]*`/g, '').replace(/\{[\s\S]*\}\s*$/, '').trim();
      // the model wrote the phone steps as words ("facebook খোলা হচ্ছে… screen items…") instead of calling the tool:
      // ask once more, telling it to really call the tool
      if (!action && fakeRef.current < 1 && /খোলা হচ্ছে|screen items|tap item|scroll (down|up)|open latest post comments|reply all comments/i.test(res.text || '')) {
        fakeRef.current += 1;
        await runTurn('You wrote the phone steps as words, so nothing happened on the phone. Call the trigger_phone_action tool now for the first step only.', true);
        return;
      }
      fakeRef.current = 0;
      if (reply || action) o.onAppend('assistant', reply, action || undefined);
      if (action) stepsRef.current += 1;
      if (!reply || action) {
        // a phone step is running: no voice for the in-between lines (much faster); the words stay in the
        // chat, and ROSE speaks once the job is done. Without an action: listen again.
        if (!action && activeRef.current) listen();
        return;
      }
      setState('speaking');
      const tts = await premiumTts(reply, o.voiceName);
      if (!activeRef.current) return;
      const next = () => {
        audioRef.current = null;
        // an action is running: its result restarts the talk; otherwise listen for him
        if (activeRef.current && !pendingRef.current) listen();
      };
      if (tts.ok && tts.audio) {
        const url = pcmToWavUrl(tts.audio);
        const a = new Audio(url);
        audioRef.current = a;
        a.volume = Math.max(0, Math.min(1, o.volume ?? 1));
        a.playbackRate = Math.max(0.75, Math.min(1.35, o.speechSpeed || 1));
        a.onended = () => {
          URL.revokeObjectURL(url);
          next();
        };
        a.onerror = () => {
          URL.revokeObjectURL(url);
          next();
        };
        try {
          await a.play();
        } catch {
          next();
        }
      } else {
        next();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fail],
  );

  /** A short line said aloud while a phone job runs (it does not start listening afterwards) */
  const speakLine = useCallback(async (line: string) => {
    const o = optsRef.current;
    o.onAppend('assistant', line);
    try {
      const tts = await premiumTts(line, o.voiceName);
      if (!activeRef.current || !tts.ok || !tts.audio) return;
      const url = pcmToWavUrl(tts.audio);
      const a = new Audio(url);
      a.volume = Math.max(0, Math.min(1, o.volume ?? 1));
      a.playbackRate = Math.max(0.75, Math.min(1.35, o.speechSpeed || 1));
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } catch {
      /* the job goes on without the voice */
    }
  }, []);

  const pendingRef = useRef(false);
  // FIXED RECIPES: jobs that always go the same way run step by step inside the phone, without asking the AI
  // what to tap (fast and the same for every user). Facebook comment replies: open the newest post's comments,
  // then the phone answers every comment without his reply, live, one by one.
  const recipeRef = useRef<{ steps: string[]; at: number } | null>(null);
  const lastRecipeAt = useRef(0);
  const runRecipeStep = useCallback(() => {
    const r = recipeRef.current;
    if (!r || r.at >= r.steps.length) return false;
    const app = r.steps[r.at];
    r.at += 1;
    stepsRef.current += 1;
    setState('thinking');
    optsRef.current.onAppend('assistant', '', { action: 'open_app', app } as PhoneAction);
    return true;
  }, []);

  const answer = useCallback(
    async (heard: string) => {
      micRef.current?.setListening(false);
      optsRef.current.onAppend('user', heard);
      stepsRef.current = 0;
      const t = heard.toLowerCase();
      // comment replies: any "reply to the comments" request (Facebook is the default, no need to say it), and a
      // correction right after one ("that's someone else's video", "wrong place", "my post") starts it again
      // from his own profile
      const otherApp = /ইউটিউব|youtube|ইনস্টা|instagram|টিকটক|tiktok|হোয়াটসঅ্যাপ|whatsapp|মেসেঞ্জার|messenger/.test(t);
      const asksReplies =
        /কমেন্ট|comment|মন্তব্য/.test(t) && /রিপ্লাই|reply|উত্তর|জবাব|দাও|দেও|করো|কর\b/.test(t);
      const corrects =
        Date.now() - lastRecipeAt.current < 5 * 60 * 1000 &&
        /আরেকজন|অন্যের|অন্য কার|ভুল|আমার (পোস্ট|ভিডিও|প্রোফাইল)|এটা না|ওটা না|wrong|someone else/.test(t);
      if (!otherApp && (asksReplies || corrects)) {
        lastRecipeAt.current = Date.now();
        recipeRef.current = { steps: ['open latest post comments', 'reply all comments'], at: 0 };
        void speakLine('ঠিক আছে, আপনার শেষ পোস্টের কমেন্টে রিপ্লাই দিচ্ছি।');
        runRecipeStep();
        return;
      }
      recipeRef.current = null;
      await runTurn(heard, false);
    },
    [runTurn, runRecipeStep, speakLine],
  );

  /** The app ran a phone action: give ROSE the result so she can say it or take the next step (max 12 steps). */
  const feedback = useCallback(
    (text: string) => {
      if (!activeRef.current) return;
      if (stepsRef.current >= 12) {
        pendingRef.current = false;
        return;
      }
      // a fixed recipe is running: a good result goes straight to the next step; at the end (or if a step
      // fails) ROSE reads the result and tells him in her own words
      const rc = recipeRef.current;
      if (rc) {
        const ok = /SUCCESS/.test(text) && !/খুঁজে পাইনি|পারিনি|could not/i.test(text);
        if (ok && rc.at < rc.steps.length) {
          window.setTimeout(() => {
            if (activeRef.current) runRecipeStep();
          }, 400);
          return;
        }
        recipeRef.current = null;
      }
      pendingRef.current = true;
      micRef.current?.setListening(false);
      try {
        recRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      // let the screen settle a moment after the step, then continue
      const go = () => {
        if (!activeRef.current) return;
        // wait until ROSE finished speaking the last line
        if (audioRef.current && !audioRef.current.ended && !audioRef.current.paused) {
          window.setTimeout(go, 300);
          return;
        }
        pendingRef.current = false;
        void runTurn(text, true);
      };
      window.setTimeout(go, 350);
    },
    [runTurn, runRecipeStep],
  );

  const start = useCallback(() => {
    if (activeRef.current) return;
    setErrorText('');
    activeRef.current = true;
    setState('connecting');
    // open the mic once for the whole talk; if the phone does not allow it, use the speech recognizer
    void openQuietMic(async (wav) => {
      if (!activeRef.current) return;
      micRef.current?.setListening(false);
      setState('thinking');
      const r = await premiumStt(wav, optsRef.current.language);
      if (!activeRef.current) return;
      if (r.ok && r.text) void answer(r.text);
      else listen();
    }, undefined, true)
      .then((mic) => {
        if (!activeRef.current) {
          mic.close();
          return;
        }
        micRef.current = mic;
        listen();
      })
      .catch(() => listen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { state, errorText, toggle, stop, start, feedback };
}
