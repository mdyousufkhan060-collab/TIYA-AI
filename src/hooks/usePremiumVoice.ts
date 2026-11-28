import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageOption, VoiceState } from '../types/tiya';
import { premiumTtsStream, premiumChat, premiumStt, premiumTts, type PremiumChatMessage } from '../lib/premium';
import { openQuietMic, type QuietMic } from '../lib/quietMic';
import { isVoiceMuted } from '../lib/voiceMute';
import { fadePcm } from '../lib/pcmFade';
import { pcmStreamPlayer } from '../lib/pcmStream';
import { voiceCaptions } from '../lib/voiceCaptions';
import { quickAnswer } from '../lib/quickAnswers';
import { localTimeLine } from '../utils/prompts';
import { phoneSpeak, stopPhoneSpeak } from '../lib/phoneVoice';
import { ageWithoutNumber, ageWords, asksCommentReplies, asksReplyHere, goToPostNumber, postAgeMinutes, postNumber, asksNextDown, dateWords, numberUnclear, postDate, postNumbersInOrder, saysNo, saysYes } from '../lib/replyRequest';
import { callNameOf, greetFirst, nameCallAnswer, okWithName } from '../lib/nameCall';
import { cachedTts, prefetchTts, rememberTts } from '../lib/ttsCache';
import { asksEnterPage, asksFacebookHome, asksListPages, matchProfile, plainName } from '../lib/pageRequest';
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
  /** his name as he set it (Settings → Your name): ROSE calls him by it */
  yourName?: string;
  getHistory: () => Array<{ role: 'user' | 'assistant'; text: string }>;
  onAppend: (role: 'user' | 'assistant', text: string, action?: PhoneAction) => void;
  onCredits?: (voiceLeft: number | null, textLeft: number | null) => void;
}

/** A question about the world right now (news, prices, weather, scores), not a phone job */
export function wantsWebAnswer(t: string): boolean {
  const s = t.toLowerCase();
  const info = /খবর|সংবাদ|নিউজ|news|হেডলাইন|headline|আপডেট|update|সর্বশেষ|latest|আজকে কী হয়েছে|কী ঘটেছে|আবহাওয়া|weather|তাপমাত্রা|বৃষ্টি হবে|স্কোর|score|কে জিতেছে|ম্যাচ|দাম কত|এখনকার দাম|রেট কত|ডলারের দাম|সোনার দাম|শেয়ার বাজার|stock price|exchange rate|নির্বাচন|election|যুদ্ধ/.test(s);
  // "open YouTube news", "play the news video" stay phone jobs
  const phone = /খোলো|খুলো|ওপেন|open|চালাও|প্লে|play|ভিডিও|video|ইউটিউবে|ফেসবুকে|কল দাও|মেসেজ/.test(s);
  return info && !phone;
}

/** Splits a reply into its first sentence and the rest (the first one is spoken while the rest is still being made) */
function splitFirst(text: string): string[] {
  const m = text.match(/^([\s\S]{12,160}?[।!?.](?:\s|$))([\s\S]{8,})$/);
  return m ? [m[1].trim(), m[2].trim()] : [text];
}


/** the end line of a reply job on a known video (LOCKED wording, owner Nov 28) */
function endLineFor(label: string, nm: string | null | undefined): string {
  const lbl = label.replace(/ আগে$/, ' আগের').replace(/(নভেম্বর|ডিসেম্বর|অক্টোবর|সেপ্টেম্বর|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট)$/, '$1ের');
  return `${nm ? nm + ', ' : ''}${lbl} ভিডিওর সবগুলো কমেন্টের রিপ্লাই কমপ্লিট হয়েছে। এখন আমি কী করবো? তোমার আর কোনো কাজ আছে?`;
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
    stopPhoneSpeak();
    micRef.current?.close();
    micRef.current = null;
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    voiceCaptions.clearUserLive();
    voiceCaptions.finishTyping();
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
  /** a phone step whose result never comes back must not leave ROSE silent and deaf: after 30 s she says so and listens */
  const watchRef = useRef<number | null>(null);
  const speakRef = useRef<((line: string) => Promise<void>) | null>(null);
  const clearWatch = () => {
    if (watchRef.current) window.clearTimeout(watchRef.current);
    watchRef.current = null;
  };
  const runTurn = useCallback(
    async (input: string, note: boolean, forceWeb = false): Promise<void> => {
      const o = optsRef.current;
      setState('thinking');
      const history: PremiumChatMessage[] = o
        .getHistory()
        .slice(-12)
        .map((h) => ({ role: h.role, content: h.text }));
      // news, prices, weather, scores… are answered by the server's Google search and SAID by ROSE here;
      // the phone never opens Google or Chrome for them (that left her scrolling pages and saying nothing)
      const web = forceWeb || (!note && wantsWebAnswer(input));
      const res = await premiumChat(
        [
          {
            role: 'system',
            content:
              o.buildSystemPrompt() +
              '\n\nVOICE MODE: reply in 1-3 short spoken sentences, no lists, no markdown, never write tool names or JSON in the words.' +
              '\nQUESTIONS ARE NOT PHONE TASKS: for news, facts, prices, weather or anything to look up, never open Google, Chrome or a browser on the phone and never scroll pages; answer him yourself in words.' +
              '\nPHONE ACTIONS: use the trigger_phone_action tool for every phone task (open an app, screen items, tap item <n>, scroll, type, ' +
              'read screen, comments, calls, messages). After a tool, the app sends the result as "[App result]"; read it and call the next ' +
              'step yourself until the task is done, one step at a time. Never say a step is done before its result says so.' +
              '\nORDER: first OPEN the app (open_app with app "Facebook", "YouTube"...; for his Facebook comments use app "open latest post comments"), ' +
              'then use "screen items" / "tap item <n>" inside it. Never use "read screen" or "screen items" while ROSE itself (com.myrosebd.rose) is on the screen.',
          },
          ...history,
          ...(web
            ? [{ role: 'system' as const, content: 'LIVE ANSWER: Google search results are available to you now. Answer his question yourself from them, in his language, in 3-5 short spoken sentences (for news: the 3-4 most important items, with the day; numbers spoken naturally). Do not open any app or website, do not tell him to check Google. If the search has nothing clear, say that briefly.' }]
            : []),
          // the real clock right next to his words, so the model never makes up a time (Nov 28: said "রাত ১টা" at 11 AM)
          { role: 'system', content: localTimeLine() },
          { role: 'user', content: note ? `[App result, not his words] ${input}` : input },
        ],
        web ? { forVoice: true, maxTokens: 500, live: true } : { forVoice: true, maxTokens: 300, tools: [phoneActionToolDeclaration()] },
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
      // a question must never become "open Google": answer it from the server's web search and say it instead
      if (!note && !web && action && (action.action === 'web_search' || (action.action === 'open_app' && /google|chrome|browser|ব্রাউজার|গুগল/i.test(String((action as { app?: string }).app || ''))))) {
        await runTurn(input, false, true);
        return;
      }
      const reply = (parsed.cleanText || '').replace(/`[^`]*`/g, '').replace(/\{[\s\S]*\}\s*$/, '').trim();
      // the model wrote the phone steps as words ("facebook খোলা হচ্ছে… screen items…") instead of calling the tool:
      // ask once more, telling it to really call the tool
      if (!action && fakeRef.current < 1 && /খোলা হচ্ছে|screen items|tap item|scroll (down|up)|open latest post comments|reply all comments/i.test(res.text || '')) {
        fakeRef.current += 1;
        await runTurn('You wrote the phone steps as words, so nothing happened on the phone. Call the trigger_phone_action tool now for the first step only.', true);
        return;
      }
      fakeRef.current = 0;
      // set the typing before the reply enters the chat, so it never flashes there whole first
      if (reply && !action) voiceCaptions.waitTyping(reply);
      if (reply || action) o.onAppend('assistant', reply, action || undefined);
      if (action) {
        stepsRef.current += 1;
        clearWatch();
        watchRef.current = window.setTimeout(() => {
          watchRef.current = null;
          if (!activeRef.current) return;
          recipeRef.current = null;
          pendingRef.current = false;
          stepsRef.current = 0;
          const say = speakRef.current;
          if (say) void say('ফোনের কাজটা আটকে গেছে, আর এগোতে পারিনি। আবার বলুন, আমি শুনছি।').then(() => { if (activeRef.current) listen(); });
          else listen();
        }, /reply all/i.test(JSON.stringify(action)) ? 930000 : /comments|go to post|post age|post date|post down|profiles|switch profile|facebook home/i.test(JSON.stringify(action)) ? 100000 : 35000);
      }
      if (!reply || action) {
        // a phone step is running: no voice for the in-between lines (much faster); the words stay in the
        // chat, and ROSE speaks once the job is done. Without an action: listen again.
        if (!action && activeRef.current) listen();
        return;
      }
      setState('speaking');
      // fastest: the voice is streamed and starts playing with its first piece (about 0.7 s after the server starts)
      const player = pcmStreamPlayer(o.volume ?? 1, o.speechSpeed || 1);
      audioRef.current = player as unknown as HTMLAudioElement;
      // the reply types itself in the chat in step with her voice (voiceCaptions)
      voiceCaptions.waitTyping(reply);
      let typingOn = false;
      const streamed = (await player.canPlay())
        ? await premiumTtsStream(reply, o.voiceName, (c) => {
            player.push(c);
            if (!typingOn) {
              typingOn = true;
              voiceCaptions.startTyping(reply, player.totalMs());
            } else voiceCaptions.setTotal(player.totalMs());
          })
        : { ok: false, got: 0 };
      if (!activeRef.current) {
        player.pause();
        return;
      }
      if (streamed.got > 0) {
        voiceCaptions.setTotal(player.totalMs());
        await player.end();
        voiceCaptions.finishTyping();
        audioRef.current = null;
        if (activeRef.current && !pendingRef.current) listen();
        return;
      }
      player.pause();
      audioRef.current = null;
      // stream did not work: the first sentence is made into voice on its own (short = quick) while the rest is
      // made at the same time, then they play one after the other
      const parts = splitFirst(reply);
      const jobs = parts.map((p) => premiumTts(p, o.voiceName));
      const next = () => {
        audioRef.current = null;
        // an action is running: its result restarts the talk; otherwise listen for him
        if (activeRef.current && !pendingRef.current) listen();
      };
      let played = false;
      const play = async (i: number): Promise<void> => {
        if (!activeRef.current) return;
        if (i >= jobs.length) {
          // LOCKED: no server sound at all → the phone's own voice says it (phoneVoice.ts); she is never silent
          if (!played) {
            voiceCaptions.startTyping(reply, Math.round((reply.length * 75) / Math.max(0.75, o.speechSpeed || 1)));
            await phoneSpeak(reply, LANG_CODE[o.language] || 'bn-BD', o.speechSpeed || 1, o.volume ?? 1);
          }
          voiceCaptions.finishTyping();
          next();
          return;
        }
        const tts = await jobs[i];
        if (!activeRef.current) return;
        if (!tts.ok || !tts.audio) {
          await play(i + 1);
          return;
        }
        const url = pcmToWavUrl(tts.audio);
        const a = new Audio(url);
        audioRef.current = a;
        a.volume = Math.max(0, Math.min(1, o.volume ?? 1));
        a.playbackRate = Math.max(0.75, Math.min(1.35, o.speechSpeed || 1));
        if (i === 0) voiceCaptions.startTyping(reply, Math.round((reply.length * 70) / Math.max(0.75, o.speechSpeed || 1)));
        await new Promise<void>((done) => {
          a.onended = () => done();
          a.onerror = () => done();
          a.play().then(() => { played = true; }).catch(() => done());
        });
        URL.revokeObjectURL(url);
        await play(i + 1);
      };
      await play(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fail],
  );

  /** A short line said aloud while a phone job runs (it does not start listening afterwards) */
  const speakLine = useCallback(async (line: string) => {
    const o = optsRef.current;
    // LOCKED (owner, Nov 28): her words type themselves in the chat together with her voice, never all at once first
    voiceCaptions.waitTyping(line);
    o.onAppend('assistant', line);
    const rate = Math.max(0.75, Math.min(1.35, o.speechSpeed || 1));
    // fastest first (Nov 28: these lines came late): the streamed voice starts with its first piece, and the words
    // type along from that moment; the whole-file voice below is only the backup
    try {
      const player = pcmStreamPlayer(o.volume ?? 1, o.speechSpeed || 1);
      if (await player.canPlay()) {
        audioRef.current = player as unknown as HTMLAudioElement;
        // Nov 28: a line she said before (or made ahead) plays at once
        const kept = await cachedTts(line, o.voiceName);
        if (kept) {
          for (const c of kept) player.push(c);
          voiceCaptions.startTyping(line, player.totalMs());
          await player.end();
          audioRef.current = null;
          voiceCaptions.finishTyping();
          return;
        }
        let typingOn = false;
        const got: string[] = [];
        const st = await premiumTtsStream(line, o.voiceName, (c) => {
          got.push(c);
          player.push(c);
          if (!typingOn) {
            typingOn = true;
            voiceCaptions.startTyping(line, player.totalMs());
          } else voiceCaptions.setTotal(player.totalMs());
        });
        if (st.got > 0) {
          if (st.ok) rememberTts(line, o.voiceName, got);
          voiceCaptions.setTotal(player.totalMs());
          await player.end();
          audioRef.current = null;
          voiceCaptions.finishTyping();
          return;
        }
        player.pause();
        audioRef.current = null;
      }
    } catch {
      /* the backup below */
    }
    if (!activeRef.current) {
      voiceCaptions.finishTyping();
      return;
    }
    try {
      const tts = await premiumTts(line, o.voiceName);
      if (!activeRef.current) {
        voiceCaptions.finishTyping();
        return;
      }
      // LOCKED: no server sound → the phone's own voice (phoneVoice.ts)
      if (!tts.ok || !tts.audio) {
        voiceCaptions.startTyping(line, Math.round((line.length * 75) / rate));
        await phoneSpeak(line, LANG_CODE[o.language] || 'bn-BD', o.speechSpeed || 1, o.volume ?? 1);
        voiceCaptions.finishTyping();
        return;
      }
      const url = pcmToWavUrl(tts.audio);
      const a = new Audio(url);
      a.volume = Math.max(0, Math.min(1, o.volume ?? 1));
      a.playbackRate = rate;
      audioRef.current = a;
      await new Promise<void>((done) => {
        a.onplaying = () => {
          const ms = Number.isFinite(a.duration) && a.duration > 0 ? (a.duration * 1000) / rate : (line.length * 70) / rate;
          voiceCaptions.startTyping(line, Math.round(ms));
        };
        a.onended = () => done();
        a.onerror = () => done();
        a.play().catch(() => done());
      });
      URL.revokeObjectURL(url);
    } catch {
      /* the job goes on without the voice */
    }
    voiceCaptions.finishTyping();
  }, []);

  const pendingRef = useRef(false);
  // FIXED RECIPES: jobs that always go the same way run step by step inside the phone, without asking the AI
  // what to tap (fast and the same for every user). Facebook comment replies: open the newest post's comments,
  // then the phone answers every comment without his reply, live, one by one.
  const lastGoAt = useRef(0);
  const recipeRef = useRef<{ steps: string[]; at: number; doneLine?: string; age?: { min: number; reply: boolean; said: string }; next?: { reply: boolean }; label?: string; page?: { want: string } } | null>(null);
  /** ROSE asked "এটাতে ঢুকবো?" about the closest video: his yes opens it (reply = he asked for replies) */
  const pendingEnterRef = useRef<{ reply: boolean; at: number; label?: string } | null>(null);
  const pendingNumRef = useRef<{ reply: boolean; at: number } | null>(null);
  const pendingAgeRef = useRef<{ reply: boolean; at: number } | null>(null);
  /** when he last asked for replies on a video found by age/date: a later "ওটাতে ঢুকো" keeps that wish */
  const lastAgeReplyAt = useRef(0);
  /** his profile + Pages, as Facebook showed them (PageSwitch.kt) */
  /** the Page ROSE is in now (null = his own profile); ROSE then says 'পেজের', not 'প্রোফাইলের' */
  const activePageRef = useRef<string | null>(null);
  /** ROSE just read the Pages and asked 'কোনটাতে ঢুকবো?' */
  const pageAskAt = useRef(0);
  const profilesRef = useRef<{ names: string[]; at: number }>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem('rose_fb_profiles') || '') || { names: [], at: 0 };
      } catch {
        return { names: [], at: 0 };
      }
    })(),
  );
  const lastRecipeAt = useRef(0);
  const lastPostNo = useRef(1);
  const runRecipeStep = useCallback(() => {
    const r = recipeRef.current;
    if (!r || r.at >= r.steps.length) return false;
    const app = r.steps[r.at];
    // Nov 28 (timing): the line she will say at the end is made now, so it plays the moment the job ends
    if (app === 'reply all comments' && r.label) prefetchTts(endLineFor(r.label, callNameOf(optsRef.current.yourName)), optsRef.current.voiceName);
    r.at += 1;
    stepsRef.current += 1;
    setState('thinking');
    optsRef.current.onAppend('assistant', '', { action: 'open_app', app } as PhoneAction);
    // a fixed job's step gets the same never-stuck watch as any phone step, with enough time for it
    clearWatch();
    watchRef.current = window.setTimeout(() => {
      watchRef.current = null;
      if (!activeRef.current) return;
      recipeRef.current = null;
      pendingRef.current = false;
      void speakRef.current?.('ফোনের কাজটা আটকে গেছে, আর এগোতে পারিনি। আবার বলুন, আমি শুনছি।');
    }, /reply all/.test(app) ? 930000 : /switch profile|facebook home|list my profiles/.test(app) ? 40000 : /comments|go to post|post age|post date|post down/.test(app) ? 100000 : 35000);
    return true;
  }, []);

  const answer = useCallback(
    async (heard: string) => {
      micRef.current?.setListening(false);
      optsRef.current.onAppend('user', heard);
      stepsRef.current = 0;
      // time / date / day: the phone's own clock answers at once (quickAnswers.ts), never Google or the AI
      const qa = quickAnswer(heard) || nameCallAnswer(heard, callNameOf(optsRef.current.yourName));
      if (qa) {
        recipeRef.current = null;
        await speakLine(qa);
        if (activeRef.current) listen();
        return;
      }
      let t = heard.toLowerCase();
      // Nov 28: ROSE asked "কত নম্বর ভিডিও?" → his answer ("৫ নম্বর", "পাঁচ") finishes the first order
      const pn = pendingNumRef.current;
      pendingNumRef.current = null;
      if (pn && Date.now() - pn.at < 5 * 60 * 1000) {
        const k = postNumber(t) ?? postNumber(t + ' নম্বর');
        if (k) t = `${k} নম্বর ভিডিও ` + (pn.reply ? 'কমেন্টে রিপ্লাই দাও' : 'তে যাও');
      }
      // Nov 28 (owner): Pages under his account — list them, or go into one he names
      {
        const nm = callNameOf(optsRef.current.yourName);
        const known = Date.now() - profilesRef.current.at < 30 * 24 * 3600 * 1000 ? profilesRef.current.names : [];
        const wantPage = asksEnterPage(t) && /পেজ|পেইজ|page|আইডি|id|প্রোফাইল|profile|লগইন|login|সুইচ|switch/.test(t) && !/ভিডিও|বিডিও|পোস্ট|কমেন্ট|রিপ্লাই/.test(t);
        const named = known.length ? matchProfile(t, known) : null;
        const justAsked = Date.now() - pageAskAt.current < 5 * 60 * 1000;
        // "বেরিয়ে হোমে আসো" while the Pages list is open
        if (justAsked && asksFacebookHome(t)) {
          pageAskAt.current = 0;
          recipeRef.current = { steps: ['facebook home'], at: 0, doneLine: `${nm ? nm + ', ' : ''}Facebook-এর হোমে চলে এসেছি। এখন কী করবো বলো?` };
          await speakLine(`${okWithName(nm)}বের হয়ে হোমে যাচ্ছি।`);
          if (!activeRef.current) return;
          runRecipeStep();
          return;
        }
        // right after "কোনটাতে ঢুকবো?" just the name is enough ("ইস্লম বোলছে")
        if (named && (asksEnterPage(t) || justAsked) && !/ভিডিও|বিডিও|পোস্ট|কমেন্ট|রিপ্লাই/.test(t)) {
          pageAskAt.current = 0;
          recipeRef.current = { steps: [`switch profile ${plainName(named)}`], at: 0, page: { want: named } };
          await speakLine(`${okWithName(nm)}${plainName(named)}-এ ঢুকছি। লগইন হতে একটু সময় লাগবে।`);
          if (!activeRef.current) return;
          runRecipeStep();
          return;
        }
        if (asksListPages(t) || (wantPage && !known.length)) {
          // he named a page before ROSE knew the list: read the list first, then go in
          recipeRef.current = { steps: ['list my profiles'], at: 0, page: { want: asksListPages(t) ? '' : t } };
          await speakLine(`${okWithName(nm)}${asksListPages(t) ? 'তোমার আইডির আন্ডারের পেজগুলো দেখছি।' : 'পেজটা খুঁজে ঢুকছি।'}`);
          if (!activeRef.current) return;
          runRecipeStep();
          return;
        }
      }
      // Nov 28 (owner): a video by its DATE ("১৯ নভেম্বর যেটা আছে ওটাতে ঢুকো") → find that date on his profile; he
      // named it himself, so on that date ROSE goes in (replies if he asked for replies now or before)
      const dt = /ইউটিউব|youtube|টিকটক|tiktok/.test(t) ? null : postDate(t);
      if (dt && (/ভিডিও|বিডিও|পোস্ট|video|post|ঢুক|ধুক|দুক|ডুক|ঢোক|যাও|জাও|খোলো|দেখো/.test(t) || pendingEnterRef.current)) {
        const peD = pendingEnterRef.current;
        pendingEnterRef.current = null;
        const reply = true; // owner: a video he names to enter = go in and finish its replies
        const said = dateWords(dt);
        lastRecipeAt.current = Date.now();
        recipeRef.current = { steps: [`find post date ${dt.day} ${dt.month}`], at: 0, age: { min: 0, reply, said: said + ' তারিখের' } };
        await speakLine(`${okWithName(callNameOf(optsRef.current.yourName))}${said} তারিখের ভিডিওতে যাচ্ছি।`);
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      // he said a number but it came through broken: ask, never go to a guessed (or the newest) video
      if (numberUnclear(t) && /ভিডিও|বিডিও|ভিডিয়ো|পোস্ট|পোষ্ট|video|post|ম্বা?র/.test(t)) {
        pendingNumRef.current = { reply: asksCommentReplies(t) || /রিপ্লাই|রিফ্লাই|reply|উত্তর/.test(t), at: Date.now() };
        await speakLine(`${callNameOf(optsRef.current.yourName) || ''}, কত নম্বর ভিডিও বললে, ঠিক বুঝিনি। নম্বরটা আরেকবার বলবে?`.replace(/^, /, ''));
        if (activeRef.current) listen();
        return;
      }
      // Nov 28 (owner): "না, নিচেরটায় যাও" after "এটাতে ঢুকবো?", or "নিচের ভিডিওতে যাও" while ROSE is on a video →
      // his next video below; ROSE says its date and asks again
      const peN = pendingEnterRef.current;
      const nearVideo = Date.now() - lastGoAt.current < 15 * 60 * 1000;
      if ((asksNextDown(t) || (!!peN && /নি[চছ]|পরের|next|below/.test(t))) && (peN || nearVideo) && postNumber(t) === null && postAgeMinutes(t) === null) {
        pendingEnterRef.current = null;
        const reply = asksCommentReplies(t) || /রিপ্লাই|রিফ্লাই|reply|উত্তর/.test(t);
        lastRecipeAt.current = Date.now();
        lastGoAt.current = Date.now();
        recipeRef.current = { steps: ['next post down'], at: 0, next: { reply } };
        await speakLine(okWithName(callNameOf(optsRef.current.yourName)) + (reply ? 'নিচের ভিডিওতে গিয়ে রিপ্লাই দিচ্ছি।' : 'নিচের ভিডিওতে যাচ্ছি।'));
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      if (peN && saysNo(t)) {
        // keep the question open: "নিচেরটায় যাও" right after still works
        pendingEnterRef.current = { ...peN, at: Date.now() };
        await speakLine(`ঠিক আছে${callNameOf(optsRef.current.yourName) ? ' ' + callNameOf(optsRef.current.yourName) : ''}, ঢুকছি না। নিচের ভিডিও দেখতে চাইলে বলো "নিচেরটায় যাও", নইলে বলো কী করবো।`);
        if (activeRef.current) listen();
        return;
      }
      // LOCKED (owner, Nov 28): his yes to "এটাতে ঢুকবো?" opens that video's comments (and replies if he asked)
      const pe = pendingEnterRef.current;
      pendingEnterRef.current = null;
      if (pe && Date.now() - pe.at < 5 * 60 * 1000 && saysYes(t)) {
        lastRecipeAt.current = Date.now();
        lastGoAt.current = Date.now();
        // owner (Nov 28 4:07 PM): "ঢুকো" = go in and finish all its replies, then tell him
        recipeRef.current = { steps: ['open comments here', 'reply all comments'], at: 0, label: pe.label };
        await speakLine(okWithName(callNameOf(optsRef.current.yourName)) + 'ঢুকে কমেন্টগুলোতে রিপ্লাই দিচ্ছি।');
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      // a time without a number he could be heard saying ("… দিন আগের ভিডিও"): ask, never send ROSE to a guessed video
      if (ageWithoutNumber(t)) {
        pendingAgeRef.current = { reply: asksCommentReplies(t) || /রিপ্লাই|রিফ্লাই|reply|উত্তর/.test(t), at: Date.now() };
        await speakLine(`${callNameOf(optsRef.current.yourName) || ''}, কত দিন বা কত ঘণ্টা আগের ভিডিও, সংখ্যাটা আরেকবার বলবে?`.replace(/^, /, ''));
        if (activeRef.current) listen();
        return;
      }
      // LOCKED (owner, Nov 28): ROSE stopped on a video (by number or by age) a little while ago and he now talks about
      // replies/comments without naming another video → that same video: its comments, then reply all
      if (Date.now() - lastGoAt.current < 15 * 60 * 1000 && postNumber(t) === null && postAgeMinutes(t) === null && asksReplyHere(t)) {
        lastRecipeAt.current = Date.now();
        lastGoAt.current = Date.now();
        recipeRef.current = { steps: ['open comments here', 'reply all comments'], at: 0 };
        await speakLine(okWithName(callNameOf(optsRef.current.yourName)) + 'এই ভিডিওর বাকি কমেন্টগুলো দেখে রিপ্লাই দিচ্ছি।');
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      // LOCKED (owner, Nov 28): "আমি ৩ ঘণ্টা আগে যে ভিডিও ছেড়েছি…" → the video of that age
      // Nov 28: ROSE asked "কত দিন আগের?" → his answer ("নয় দিন আগে") needs no word "ভিডিও"
      const pa = pendingAgeRef.current;
      pendingAgeRef.current = null;
      const askedAge = !!pa && Date.now() - pa.at < 5 * 60 * 1000;
      const ageMin = (askedAge || /ভিডিও|বিডিও|ভিডিয়ো|ভিডু|পোস্ট|পোষ্ট|video|post|রিল|reel/.test(t)) && !/ইউটিউব|youtube|টিকটক|tiktok|ইনস্টা|instagram/.test(t) ? postAgeMinutes(t) : null;
      if (ageMin !== null) {
        const nm = callNameOf(optsRef.current.yourName);
        const wantsReply = (askedAge && pa!.reply) || asksCommentReplies(t) || /রিপ্লাই|রিফ্লাই|reply|উত্তর/.test(t);
        // he hears back exactly the age ROSE understood ("হ্যাঁ, ৪ দিন আগের ভিডিওতে যাচ্ছি"), so a wrong hearing shows at once
        const said = ageWords(ageMin, t);
        lastRecipeAt.current = Date.now();
        recipeRef.current = { steps: [`find post age ${ageMin}`], at: 0, age: { min: ageMin, reply: wantsReply, said } };
        if (wantsReply) lastAgeReplyAt.current = Date.now();
        await speakLine(`হ্যাঁ ${nm || ''}, ${said} আগের ভিডিওতে যাচ্ছি।`.replace(' ,', ','));
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      // comment replies: any "reply to the comments" request (Facebook is the default, no need to say it), and a
      // correction right after one ("that's someone else's video", "wrong place", "my post") starts it again
      // from his own profile
      const otherApp = /ইউটিউব|youtube|ইনস্টা|instagram|টিকটক|tiktok|হোয়াটসঅ্যাপ|whatsapp|মেসেঞ্জার|messenger/.test(t);
      const asksReplies = asksCommentReplies(t);
      const corrects =
        Date.now() - lastRecipeAt.current < 5 * 60 * 1000 &&
        /আরেকজন|অন্যের|অন্য কার|ভুল|আমার (পোস্ট|ভিডিও|প্রোফাইল)|এটা না|ওটা না|wrong|someone else/.test(t);
      if (!otherApp && (asksReplies || corrects)) {
        lastRecipeAt.current = Date.now();
        // which post: "দুই নম্বর", "২য়", "দ্বিতীয়", "second", "post 2"… (newest when he names none)
        const nth = postNumber(t);
        if (nth) lastPostNo.current = nth;
        // right after "go to video N", "reply here" means that same video
        const afterGo = Date.now() - lastGoAt.current < 15 * 60 * 1000;
        const no = (corrects || afterGo) && !nth ? lastPostNo.current : nth || 1;
        if (!corrects || nth) lastPostNo.current = no;
        // after this job, "নিচে আরো আছে দেখো" means these same comments
        lastGoAt.current = Date.now();
        // several videos in one order ("৪ নম্বর … তারপর ৫ নম্বর"): one after the other, each fully done
        const many = postNumbersInOrder(t);
        recipeRef.current = {
          // right after he was taken to a video: the comments of THAT video on the screen, no walking back to the top
          steps: many.length > 1
            ? many.flatMap((k) => [`open post ${k} comments`, 'reply all comments'])
            : [afterGo && !nth ? 'open comments here' : no === 1 ? 'open latest post comments' : `open post ${no} comments`, 'reply all comments'],
          at: 0,
        };
        // LOCKED (owner, Nov 28): she says it FIRST, then the phone starts (not Facebook first, words later)
        await speakLine(
          greetFirst(t) + okWithName(callNameOf(optsRef.current.yourName)) +
            (many.length > 1
              ? `আগে ${many[0]} নম্বর ভিডিওর রিপ্লাই শেষ করবো, তারপর ${many.slice(1).join(', ')} নম্বর। সব শেষ হলে তোমাকে জানাবো।`
              : `${activePageRef.current ? `তোমার ${activePageRef.current} পেজের` : 'তোমার প্রোফাইলের'} ${no === 1 ? 'সবচেয়ে নতুন (১ নম্বর) ভিডিওর' : `${no} নম্বর পোস্টের`} কমেন্টে রিপ্লাই দিচ্ছি।`),
        );
        runRecipeStep();
        return;
      }
      // "go to video N" only: walk there and stop, then ask him what to do (LOCKED)
      const goNo = !otherApp ? goToPostNumber(t) : null;
      if (goNo) {
        lastRecipeAt.current = Date.now();
        lastPostNo.current = goNo;
        lastGoAt.current = Date.now();
        const nm = callNameOf(optsRef.current.yourName);
        recipeRef.current = {
          steps: [`go to post ${goNo}`],
          at: 0,
          doneLine: `${nm ? nm + ', ' : ''}আমি তোমার ${goNo} নম্বর ভিডিওর কাছে আছি। এখন কী করবো বলো?`,
        };
        await speakLine(greetFirst(t) + okWithName(nm) + `তোমার ${goNo} নম্বর ভিডিওতে যাচ্ছি।`);
        if (!activeRef.current) return;
        runRecipeStep();
        return;
      }
      recipeRef.current = null;
      await runTurn(heard, false);
    },
    [runTurn, runRecipeStep, speakLine, listen],
  );
  speakRef.current = speakLine;

  /** The app ran a phone action: give ROSE the result so she can say it or take the next step (max 12 steps). */
  const feedback = useCallback(
    (text: string) => {
      clearWatch();
      if (!activeRef.current) return;
      if (stepsRef.current >= 12) {
        // too many steps: stop the job, tell him, and listen again (before, ROSE went silent here)
        pendingRef.current = false;
        recipeRef.current = null;
        stepsRef.current = 0;
        void speakLine('অনেকগুলো ধাপ হয়ে গেছে, কাজটা শেষ করতে পারিনি। কী করবো আবার বলুন।').then(() => {
          if (activeRef.current) listen();
        });
        return;
      }
      // a fixed recipe is running: a good result goes straight to the next step; at the end (or if a step
      // fails) ROSE reads the result and tells him in her own words
      const rc = recipeRef.current;
      if (rc) {
        const ok = /SUCCESS/.test(text) && !/খুঁজে পাইনি|পারিনি|could not/i.test(text);
        // Nov 28 (owner): the video has no comments → stop, say it, wait ("নিচের ভিডিওতে যাও" works next)
        if (/NO_COMMENTS/.test(text)) {
          recipeRef.current = null;
          lastGoAt.current = Date.now();
          const nm = callNameOf(optsRef.current.yourName);
          void speakLine(`${nm ? nm + ', ' : ''}এই ভিডিওতে কোনো কমেন্ট নেই, তাই কিছু লিখিনি। এখন কী করবো? চাইলে নিচের ভিডিওতে যেতে পারি।`).then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
        if (ok && rc.at < rc.steps.length) {
          window.setTimeout(() => {
            if (activeRef.current) runRecipeStep();
          }, 400);
          return;
        }
        // Nov 28 (owner): his profile + Pages were read, or ROSE went into one
        if (rc.page) {
          const nm = callNameOf(optsRef.current.yourName);
          const list = (text.match(/PROFILES:\s*([^"\n]+)/) || [])[1];
          if (ok && list) {
            const raw = list.split('|').map((x) => x.trim()).filter((x) => x && !/^(P:)?(dismiss|close|back)$/i.test(x));
            const names = raw.map((x) => x.replace(/^P:/, ''));
            // his own ID = the one he had when ROSE first read the list (kept), else the first row that is not a Page;
            // the first row is where he is NOW (Facebook puts the ✓ one on top)
            let mainName = '';
            try {
              mainName = localStorage.getItem('rose_fb_main') || '';
            } catch {
              /* none kept */
            }
            const before = profilesRef.current.names[0];
            if (!mainName || !names.includes(mainName)) mainName = before && names.includes(before) ? before : raw.find((x) => !x.startsWith('P:')) || names[0];
            if (!/^p:/i.test(raw[names.indexOf(mainName)] || '')) {
              try {
                localStorage.setItem('rose_fb_main', mainName);
              } catch {
                /* only for now */
              }
            }
            const nowIn = names[0];
            activePageRef.current = nowIn && nowIn !== mainName ? plainName(nowIn) : null;
            names.sort((a, b) => (a === mainName ? -1 : b === mainName ? 1 : 0));
            profilesRef.current = { names, at: Date.now() };
            try {
              localStorage.setItem('rose_fb_profiles', JSON.stringify(profilesRef.current));
            } catch {
              /* only kept for this visit */
            }
            const wanted = rc.page.want ? matchProfile(rc.page.want, names) : null;
            if (wanted) {
              recipeRef.current = { steps: [`switch profile ${plainName(wanted)}`], at: 0, page: { want: wanted } };
              window.setTimeout(() => {
                if (activeRef.current) runRecipeStep();
              }, 400);
              return;
            }
            recipeRef.current = null;
            const pages = names.slice(1).map(plainName);
            pageAskAt.current = Date.now();
            const where = activePageRef.current ? `তুমি এখন ${activePageRef.current} পেজে আছো। ` : '';
            const line = pages.length
              ? `${nm ? nm + ', ' : ''}${where}তোমার ${plainName(names[0])} আইডির আন্ডারে ${String(pages.length).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])}টা পেজ আছে: ${pages.join(', ')}। কোনটাতে ঢুকবো?`
              : `${nm ? nm + ', ' : ''}তোমার ${plainName(names[0])} আইডির আন্ডারে কোনো পেজ দেখছি না।`;
            void speakLine(line).then(() => {
              if (activeRef.current) window.setTimeout(() => listen(), 300);
            });
            return;
          }
          const sw = (text.match(/SWITCHED:\s*([^"\n]+)/) || [])[1];
          if (ok && sw) {
            recipeRef.current = null;
            const main = profilesRef.current.names[0];
            activePageRef.current = main && plainName(sw) === plainName(main) ? null : plainName(sw);
            // Facebook needs a few seconds to open that page: wait without touching anything, then say it
            window.setTimeout(() => {
              if (!activeRef.current) return;
              void speakLine(`${nm ? nm + ', ' : ''}${plainName(sw)} ${activePageRef.current ? 'পেজে' : 'আইডিতে'} লগইন হয়েছে। এখন কী করবো বলো?`).then(() => {
                if (activeRef.current) window.setTimeout(() => listen(), 300);
              });
            }, 7000);
            return;
          }
        }
        // Nov 28 (owner): ROSE went to the next video below → say its date (or age) and ask "এটাতে ঢুকবো?"
        if (ok && rc.next) {
          const nm = callNameOf(optsRef.current.yourName);
          const m = (text.match(/AGE_NEXT:\s*([^"\n]*)/) || [])[1] || '';
          const [agePart, datePart] = m.split('|').map((x) => (x || '').trim());
          lastGoAt.current = Date.now();
          // he already said "ওটাতে রিপ্লাই করো" with "নিচেরটায় যাও": go straight in and finish its replies
          if (rc.next.reply) {
            recipeRef.current = { steps: ['open comments here', 'reply all comments'], at: 0, label: datePart || agePart };
            window.setTimeout(() => {
              if (activeRef.current) runRecipeStep();
            }, 400);
            return;
          }
          pendingEnterRef.current = { reply: true, at: Date.now(), label: datePart || agePart };
          recipeRef.current = null;
          const line = datePart
            ? `${nm ? nm + ', ' : ''}নিচের ভিডিওতে এসেছি। এখানে দিন বা সপ্তাহ লেখা নেই, তারিখ লেখা আছে ${datePart}। এটাতে ঢুকবো?`
            : `${nm ? nm + ', ' : ''}নিচের ভিডিওতে এসেছি, এটা ${agePart || 'এর পরের'} পোস্ট করা। এটাতে ঢুকবো?`;
          void speakLine(line).then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
        // the video found by its age: exact → go on (or ask what to do); closest → ask "এটাতে ঢুকবো?"
        if (ok && rc.age) {
          const nm = callNameOf(optsRef.current.yourName);
          const found = (text.match(/AGE_(EXACT|CLOSEST):\s*([^"\n]+?)(["\n]|$)/) || []) as string[];
          const exact = found[1] === 'EXACT';
          const [agePart, datePart] = (found[2] || '').split('|').map((x) => (x || '').trim());
          // Facebook wrote a date there (no days or weeks): say the date ("১৯ নভেম্বর") as he sees it
          const ageText = datePart ? `${datePart} তারিখে` : agePart;
          lastGoAt.current = Date.now();
          if (exact && rc.age.reply) {
            recipeRef.current = { steps: ['open comments here', 'reply all comments'], at: 0, label: datePart || agePart };
            window.setTimeout(() => {
              if (activeRef.current) runRecipeStep();
            }, 400);
            return;
          }
          recipeRef.current = null;
          let line: string;
          if (exact) {
            // his "ঢুকো" / "হ্যাঁ" next = go in and reply (never to the AI)
            pendingEnterRef.current = { reply: true, at: Date.now(), label: datePart || agePart };
            line = `${nm ? nm + ', ' : ''}তোমার ${ageText} পোস্ট করা ভিডিওর কাছে আছি। এখন কী করবো বলো?`;
          }
          else {
            pendingEnterRef.current = { reply: true, at: Date.now(), label: datePart || agePart };
            line = datePart
              ? `${nm ? nm + ', ' : ''}ঠিক ${rc.age.said.endsWith('তারিখের') ? rc.age.said : rc.age.said + ' আগের'} লেখা কোনো ভিডিও নেই। এখানে দিন বা সপ্তাহ লেখা নেই, তারিখ লেখা আছে ${datePart}। এটাতে ঢুকবো?`
              : `${nm ? nm + ', ' : ''}ঠিক ${rc.age.said.endsWith('তারিখের') ? rc.age.said : rc.age.said + ' আগের'} কোনো ভিডিও পাইনি। সবচেয়ে কাছের ভিডিওটা ${ageText} পোস্ট করা। এটাতে ঢুকবো?`;
          }
          void speakLine(line).then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
        // a job with its own fixed last line ("go to video N"): say exactly that and listen
        if (ok && rc.doneLine) {
          recipeRef.current = null;
          void speakLine(rc.doneLine).then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
        // Nov 28: the reply job ended ("সব রিপ্লাই কমপ্লিট … Say to him by name: …"): ROSE says that line herself at
        // once. Before, it went through the AI first and he waited a long time after Facebook closed.
        if (ok && /সব রিপ্লাই কমপ্লিট/.test(text) && rc.at >= rc.steps.length) {
          recipeRef.current = null;
          const nm = callNameOf(optsRef.current.yourName);
          const n = (text.match(/([০-৯\d]+)টা কমেন্টে রিপ্লাই দিয়েছি/) || [])[1];
          const sayIt = (text.match(/Say to him by name:\s*([^"\n]+)/) || [])[1];
          if (rc.label) {
            void speakLine(endLineFor(rc.label, nm)).then(() => {
              if (activeRef.current) window.setTimeout(() => listen(), 300);
            });
            return;
          }
          const line =
            `${nm ? nm + ', ' : ''}সব রিপ্লাই কমপ্লিট। ` +
            (n ? `${n}টা কমেন্টে রিপ্লাই দিয়েছি। ` : /বাকি ছিল না/.test(text) ? 'নতুন কোনো কমেন্ট বাকি ছিল না। ' : '') +
            (sayIt ? sayIt.trim() : 'এখন আর কী করবো বলো?');
          void speakLine(line).then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
        recipeRef.current = null;
        // a step of the fixed job failed: say what happened and stop — no guessing taps on other people's posts
        if (!ok) {
          const why = text.replace(/^.*?(FAILED|ERROR)[:\s-]*/i, '').split('\n')[0].slice(0, 160).trim();
          void speakLine(why || 'কাজটা শেষ করতে পারিনি।').then(() => {
            if (activeRef.current) window.setTimeout(() => listen(), 300);
          });
          return;
        }
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
    [runTurn, runRecipeStep, speakLine, listen],
  );

  /**
   * LOCKED (owner, Nov 28): if he starts talking while ROSE is speaking, she stops at once and listens to him.
   * The phone's echo cancelling keeps her own voice low in the mic; only a clearly louder voice for ~0.4 s counts.
   */
  const bargeRef = useRef(0);
  const echoRef = useRef({ since: 0, avg: 0 });
  const bargeIn = (lv: number) => {
    const a = audioRef.current as unknown as { paused?: boolean; ended?: boolean; pause?: () => void; dispatchEvent?: (e: Event) => boolean } | null;
    const playing = Boolean(a && !a.paused && !a.ended);
    if (!playing || !activeRef.current) {
      bargeRef.current = 0;
      echoRef.current = { since: 0, avg: 0 };
      return;
    }
    // Nov 28: her own voice coming back into the mic stopped her after a few words. Now ROSE learns how loud her own
    // voice sounds in the mic while she talks, ignores the first 0.8 s, and only a voice clearly louder than her own
    // (2.5×, and loud) for about half a second counts as him cutting in.
    const now = Date.now();
    if (!echoRef.current.since) echoRef.current = { since: now, avg: lv };
    echoRef.current.avg = echoRef.current.avg * 0.9 + lv * 0.1;
    if (now - echoRef.current.since < 800) return;
    if (lv > 0.6 && lv > echoRef.current.avg * 2.5) bargeRef.current += 1;
    else bargeRef.current = Math.max(0, bargeRef.current - 1);
    if (bargeRef.current < 6) return;
    bargeRef.current = 0;
    try {
      a?.pause?.();
      a?.dispatchEvent?.(new Event('ended'));
    } catch {
      /* ignore */
    }
    stopPhoneSpeak();
    voiceCaptions.finishTyping();
    audioRef.current = null;
    micRef.current?.setListening(true);
    setState('listening');
  };

  const start = useCallback(() => {
    if (activeRef.current) return;
    setErrorText('');
    activeRef.current = true;
    setState('connecting');
    // open the mic once for the whole talk; if the phone does not allow it, use the speech recognizer
    // his words show live while he talks; ROSE waits 1.2 s of quiet so she never cuts him off mid-sentence
    let finalAt = 0;
    void openQuietMic(async (wav) => {
      if (!activeRef.current) return;
      finalAt = Date.now();
      micRef.current?.setListening(false);
      setState('thinking');
      const r = await premiumStt(wav, optsRef.current.language);
      voiceCaptions.clearUserLive();
      if (!activeRef.current) return;
      if (r.ok && r.text) void answer(r.text);
      else listen();
    }, (lv) => bargeIn(lv), true, {
      endMs: 1000,
      onPartial: (wav) => {
        const asked = Date.now();
        void premiumStt(wav, optsRef.current.language, true).then((r) => {
          // a late partial must not come back after the final words
          if (activeRef.current && r.ok && r.text && asked > finalAt) voiceCaptions.setUserLive(r.text);
        });
      },
    })
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
