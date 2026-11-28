// LOCKED (owner, Nov 28): the voice must not die after a few replies.
// Google's free keys allow only ~100 voice requests a day per model; when that runs out (429 "per day") the old code
// asked the same model again on every reply, waited, and ROSE spoke nothing. This file remembers which key+model is
// out of quota (until Google's daily reset, 07:00-08:00 UTC) or broken (bad key), finds every voice (TTS) model the
// key can use, and gives the list in the best order, skipping the ones that cannot answer now.

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const PREFER = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.5-flash-tts", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];

const blockedUntil = new Map<string, number>();
const modelsOf = new Map<string, { at: number; list: string[] }>();

const tag = (key: string) => key.slice(-6);

function nextReset(): number {
  const d = new Date();
  const r = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 5);
  return r > Date.now() ? r : r + 86400000;
}

/** remember a failure: daily quota → until reset, per-minute → 65 s, bad key → 1 hour, slow → 3 min */
export function ttsFailed(key: string, model: string, status: number, message: string) {
  const now = Date.now();
  if (status === 401 || status === 403) blockedUntil.set(tag(key) + "|*", now + 3600000);
  else if (status === 429) blockedUntil.set(tag(key) + "|" + model, /per.?day|daily|PerDay/i.test(message) ? nextReset() : now + 65000);
  else if (status === 404) blockedUntil.set(tag(key) + "|" + model, now + 6 * 3600000);
  else if (status === 0) blockedUntil.set(tag(key) + "|" + model, now + 180000);
}

export function ttsUsable(key: string, model: string): boolean {
  const now = Date.now();
  const k = blockedUntil.get(tag(key) + "|*") || 0;
  const m = blockedUntil.get(tag(key) + "|" + model) || 0;
  return k < now && m < now;
}

/** every TTS model this key may use, best first, the ones out of quota left out */
export async function ttsModelsFor(key: string, adminChoice?: string): Promise<string[]> {
  let c = modelsOf.get(tag(key));
  if (!c || Date.now() - c.at > 6 * 3600000) {
    let found: string[] = [];
    try {
      const r = await fetch(`${GEMINI}/models?pageSize=300`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(6000) });
      const d = await r.json().catch(() => null);
      found = (d?.models || [])
        .filter((m: any) => /tts/i.test(String(m?.name)) && (m?.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => String(m.name).replace(/^models\//, ""));
    } catch { /* keep the known list */ }
    c = { at: Date.now(), list: found };
    modelsOf.set(tag(key), c);
  }
  const all = [...new Set([...(adminChoice ? [adminChoice] : []), ...PREFER.filter((m) => !c!.list.length || c!.list.includes(m)), ...c.list])];
  // the slow preview models go last
  const ordered = [...all.filter((m) => !/preview/.test(m)), ...all.filter((m) => /preview/.test(m))];
  return ordered.filter((m) => ttsUsable(key, m));
}
