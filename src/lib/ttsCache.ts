import { premiumTtsStream } from './premium';

/**
 * Nov 28 (owner: "ROSE answers late"): her voice for a line is kept after the first time, and lines she will need
 * next (the "সব রিপ্লাই কমপ্লিট" line, "ঢুকে কমেন্টগুলোতে রিপ্লাই দিচ্ছি") are made ahead of time. A kept line starts
 * playing at once instead of waiting ~1.3 s for the server. Its own file; only short lines are kept (max 80).
 */
type Entry = { chunks: string[]; ready: Promise<boolean> };
const cache = new Map<string, Entry>();
const key = (text: string, voice: string) => `${voice}|${text.trim()}`;

function keep(k: string, e: Entry) {
  cache.set(k, e);
  if (cache.size > 80) cache.delete(cache.keys().next().value as string);
}

/** make the voice of a line now, so speaking it later is instant */
export function prefetchTts(text: string, voice: string): void {
  const k = key(text, voice);
  if (!text.trim() || text.length > 220 || cache.has(k)) return;
  const chunks: string[] = [];
  const ready = premiumTtsStream(text, voice, (c) => chunks.push(c))
    .then((r) => r.got > 0)
    .catch(() => false)
    .then((ok) => {
      if (!ok) cache.delete(k);
      return ok;
    });
  keep(k, { chunks, ready });
}

/** the kept voice of a line (waits for one being made), or null */
export async function cachedTts(text: string, voice: string): Promise<string[] | null> {
  const e = cache.get(key(text, voice));
  if (!e) return null;
  const ok = await e.ready;
  return ok && e.chunks.length ? e.chunks : null;
}

/** keep what was just played */
export function rememberTts(text: string, voice: string, chunks: string[]): void {
  if (!chunks.length || text.length > 220) return;
  keep(key(text, voice), { chunks: chunks.slice(), ready: Promise.resolve(true) });
}
