/**
 * LOCKED (owner, Nov 28): ROSE never goes silent. When the server voice gives no sound (Google's daily limit,
 * a bad key, a slow model), the words are said by the phone's own voice (Android app: TiyaNative.speak, see
 * RoseSpeak.kt), or by the browser's voice on a computer. Resolves when she has finished (false = no voice at all).
 */
type Native = { speak?: (t: string, l: string, r: number, v: number) => boolean; speaking?: () => boolean; stopSpeaking?: () => void };

export async function phoneSpeak(text: string, lang = 'bn-BD', rate = 1, volume = 1): Promise<boolean> {
  const words = text.trim();
  if (!words) return false;
  const n = (window as unknown as { TiyaNative?: Native }).TiyaNative;
  if (n && typeof n.speak === 'function') {
    let ok = false;
    try {
      ok = Boolean(n.speak(words, lang, rate, volume));
    } catch {
      ok = false;
    }
    if (ok) {
      const limit = Date.now() + Math.min(60000, 4000 + words.length * 120);
      await new Promise((r) => setTimeout(r, 400));
      while (Date.now() < limit) {
        let on = false;
        try {
          on = Boolean(n.speaking?.());
        } catch {
          on = false;
        }
        if (!on) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      return true;
    }
  }
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const voices = synth.getVoices();
  if (!voices.length) return false;
  return new Promise<boolean>((resolve) => {
    const u = new SpeechSynthesisUtterance(words);
    u.lang = lang;
    u.rate = rate;
    u.volume = volume;
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    const t = setTimeout(() => resolve(true), Math.min(60000, 4000 + words.length * 120));
    u.onend = () => {
      clearTimeout(t);
      resolve(true);
    };
    u.onerror = () => {
      clearTimeout(t);
      resolve(false);
    };
    synth.speak(u);
  });
}

export function stopPhoneSpeak(): void {
  try {
    (window as unknown as { TiyaNative?: Native }).TiyaNative?.stopSpeaking?.();
  } catch {
    /* ignore */
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
