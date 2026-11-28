/**
 * LIVE VOICE CAPTIONS (own file, so the rest of the voice never breaks):
 * - his words appear in the chat while he is still talking (a live bubble, replaced by the real message at the end);
 * - ROSE's reply types itself in the chat in step with her voice, instead of showing all at once.
 * A tiny store: the voice hook writes, the chat screen reads with useVoiceCaptions().
 */
import { useEffect, useState } from 'react';

type Typing = { text: string; startAt: number; totalMs: number; done: boolean; madeAt: number };
type State = { userLive: string; typing: Typing | null };

let state: State = { userLive: '', typing: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const voiceCaptions = {
  setUserLive(text: string) {
    state = { ...state, userLive: text };
    emit();
  },
  clearUserLive() {
    if (!state.userLive) return;
    state = { ...state, userLive: '' };
    emit();
  },
  /** ROSE's reply is in the chat but her voice has not started: show nothing of it yet */
  waitTyping(text: string) {
    state = { ...state, typing: { text, startAt: 0, totalMs: 0, done: false, madeAt: Date.now() } };
    emit();
  },
  /** her voice started now; totalMs = how long the whole reply will take to say (can grow while it streams) */
  startTyping(text: string, totalMs: number) {
    const t = state.typing && state.typing.text === text && state.typing.startAt ? state.typing : null;
    state = { ...state, typing: { text, startAt: t?.startAt || Date.now(), totalMs, done: false, madeAt: t?.madeAt || Date.now() } };
    emit();
  },
  setTotal(totalMs: number) {
    if (!state.typing) return;
    state = { ...state, typing: { ...state.typing, totalMs } };
  },
  /** show the whole reply (voice ended, stopped or failed) */
  finishTyping() {
    if (!state.typing) return;
    state = { ...state, typing: { ...state.typing, done: true } };
    emit();
  },
  get: () => state,
};

/** How much of a reply to show now (the whole text when it is not the one ROSE is speaking) */
export function typedPart(text: string, s: State): string {
  const t = s.typing;
  if (!t || t.text.trim() !== text.trim() || t.done) return text;
  // her voice never started (no sound on this phone): after 10 s the reply shows whole anyway
  if (!t.startAt) return Date.now() - t.madeAt > 10000 ? text : '';
  const total = Math.max(t.totalMs, text.length * 55);
  const f = Math.min(1, (Date.now() - t.startAt) / total);
  // whole words only, so it reads like typing, not broken letters
  const cut = Math.round(text.length * f);
  const sp = text.indexOf(' ', cut);
  return f >= 1 ? text : text.slice(0, sp === -1 ? text.length : sp);
}

export function useVoiceCaptions(): State {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    subs.add(f);
    // while ROSE is typing, redraw a few times a second
    const iv = window.setInterval(() => {
      const t = state.typing;
      if (t && !t.done) f();
    }, 120);
    return () => {
      subs.delete(f);
      window.clearInterval(iv);
    };
  }, []);
  return state;
}
