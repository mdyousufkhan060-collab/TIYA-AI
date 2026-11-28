/**
 * TALK STYLE (everyone): when he asks ROSE to speak a language or a Bangladeshi dialect ("নোয়াখালীর ভাষায় বলো",
 * "ইংরেজিতে বলো", "শুদ্ধ বাংলায় বলো", "মজা করে বলো"), it is saved here and ROSE keeps it in EVERY reply, voice and
 * chat, until he says otherwise. Before, a long phone job pushed his words out of the short history and she forgot.
 * LOCKED (owner, Nov 28 2026 11:05 PM). Do not change unless the owner asks.
 */
const KEY = 'rose_talk_style';
type Style = { lang: string; label: string; fun: boolean; at: number };

const DIALECTS: Array<[RegExp, string, string]> = [
  [/নোয়াখা|নোয়াখা|noakh/i, 'Noakhali dialect Bangla (নোয়াখালীর ভাষা)', 'নোয়াখালীর ভাষায়'],
  [/চাটগাঁ|চিটাগা|চট্টগ্রাম|চাটগা|chitta|chatga/i, 'Chittagonian dialect Bangla (চট্টগ্রামের ভাষা)', 'চট্টগ্রামের ভাষায়'],
  [/সিলেট|syl/i, 'Sylheti dialect Bangla (সিলেটের ভাষা)', 'সিলেটের ভাষায়'],
  [/বরিশা|barish/i, 'Barishal dialect Bangla (বরিশালের ভাষা)', 'বরিশালের ভাষায়'],
  [/ঢাকাইয়া|পুরান ঢাকা|কুট্টি|dhakaiya|kutti/i, 'Old Dhaka (Dhakaiya / Kutti) dialect Bangla (পুরান ঢাকার ভাষা)', 'পুরান ঢাকার ভাষায়'],
  [/রংপুর|rangpur/i, 'Rangpur dialect Bangla (রংপুরের ভাষা)', 'রংপুরের ভাষায়'],
  [/রাজশাহী|rajshahi/i, 'Rajshahi dialect Bangla (রাজশাহীর ভাষা)', 'রাজশাহীর ভাষায়'],
  [/খুলনা|যশোর|khulna/i, 'Khulna dialect Bangla (খুলনার ভাষা)', 'খুলনার ভাষায়'],
  [/ময়মনসিং|ময়মনসিং|mymen/i, 'Mymensingh dialect Bangla (ময়মনসিংহের ভাষা)', 'ময়মনসিংহের ভাষায়'],
  [/কুমিল্লা|comilla|cumilla/i, 'Cumilla dialect Bangla (কুমিল্লার ভাষা)', 'কুমিল্লার ভাষায়'],
  [/ইংরেজি|ইংলিশ|english/i, 'English', 'ইংরেজিতে'],
  [/হিন্দি|hindi/i, 'Hindi', 'হিন্দিতে'],
  [/উর্দু|urdu/i, 'Urdu', 'উর্দুতে'],
  [/আরবি|arabic/i, 'Arabic', 'আরবিতে'],
];

function read(): Style | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && typeof s.lang === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** Looks for "… ভাষায় / টানে বলো / কথা বলো", "শুদ্ধ বাংলায় বলো", "মজা করে বলো"; saves it and returns a short line, else null */
export function catchTalkStyle(text: string): string | null {
  const t = String(text || '').toLowerCase();
  const asks = /ভাষা|টানে|স্টাইলে|ইল্লা|ইয়া|ইয়া|তে\s*(কথা\s*)?(বলো|বল|কও|বলবে|বলবা)|speak|talk in|language/.test(t);
  if (/শুদ্ধ|স্বাভাবিক|নরমাল|normal|সাধারণ বাংলা|standard/.test(t) && /(বাংলা|ভাষা|বলো|বল)/.test(t)) {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    return 'শুদ্ধ বাংলায়';
  }
  const fun = /মজা করে|হাসির|ফানি|funny|মজার ভাষা/.test(t);
  const hit = DIALECTS.find(([re]) => re.test(t));
  if (!hit && !fun) return null;
  if (hit && !asks && !fun) return null;
  const cur = read();
  const next: Style = hit ? { lang: hit[1], label: hit[2], fun: fun || (cur?.fun ?? false), at: Date.now() } : { lang: cur?.lang || '', label: cur?.label || '', fun: true, at: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return hit ? hit[2] : 'মজা করে';
}

/** The line for the system prompt: keep his chosen language / dialect in every reply until he changes it */
export function talkStyleLine(): string {
  const s = read();
  if (!s) return '';
  return [
    s.lang ? `LANGUAGE LOCK (he asked for this, keep it): reply ONLY in ${s.lang} in every reply, voice and chat, until he clearly asks for another language or শুদ্ধ বাংলা. Do not slip back to standard Bangla on your own, even after a phone job.` : '',
    s.fun ? 'FUN STYLE (he asked): be light and funny, with playful local words and jokes that make him smile; warm, never mocking any district or its people.' : '',
  ].filter(Boolean).join('\n');
}
