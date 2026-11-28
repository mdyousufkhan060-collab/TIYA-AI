/**
 * Does he want ROSE to reply to the comments of his post, and which post?
 * Its own file (owner's rule: every fix in its own file). Nov 28: "দুনামবার ভিডিওয়াতে রিপ্লাই করে আসো" did not
 * start the reply job (no word "কমেন্ট", and Whisper wrote "দুনামবার"), so ROSE wandered on Facebook and went silent.
 */

const BN = '০১২৩৪৫৬৭৮৯';
const NUM_WORD = '(?:নম্বর|নাম্বার|নামবার|নাম্বর|নম্বার|নমবর|নং|no\\.?|number)';

/** "দুই নম্বর ভিডিও", "দুনামবার", "২য় পোস্ট", "দ্বিতীয়", "second video", "post 3" → 2, 2, 2, 2, 2, 3 (null = not said) */
export function postNumber(t: string): number | null {
  const s = t.toLowerCase().replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
  const d = s.match(new RegExp(`(\\d{1,2})\\s*(?:${NUM_WORD}|য়|তম|th|nd|rd|st)?\\s*(?:পোস্ট|ভিডিও|post|video)|(?:পোস্ট|ভিডিও|post|video)\\s*${NUM_WORD}?\\s*(\\d{1,2})|(\\d{1,2})\\s*${NUM_WORD}`));
  if (d) {
    const n = Number(d[1] || d[2] || d[3]);
    if (n >= 1 && n <= 30) return n;
  }
  const words: [RegExp, number][] = [
    [new RegExp(`দ্বিতীয়|second|2nd|দু(?:ই|টা|ইটা)?\\s*${NUM_WORD}`), 2],
    [new RegExp(`তৃতীয়|third|3rd|তিন\\s*${NUM_WORD}`), 3],
    [new RegExp(`চতুর্থ|fourth|4th|চার\\s*${NUM_WORD}`), 4],
    [new RegExp(`পঞ্চম|fifth|5th|পাঁচ\\s*${NUM_WORD}`), 5],
    [new RegExp(`ষষ্ঠ|sixth|6th|ছয়\\s*${NUM_WORD}`), 6],
  ];
  for (const [re, n] of words) if (re.test(s)) return n;
  return null;
}

const REPLY = /রিপ্লাই|রিফ্লাই|রিপলাই|রিপ্লে|রিপ্লায়|reply/;

/** a reply-the-comments job: "কমেন্টে রিপ্লাই দাও", or "রিপ্লাই" about his post / video / Facebook */
export function asksCommentReplies(t: string): boolean {
  const s = t.toLowerCase();
  const comment = /কমেন্ট|কমেন|comment|মন্তব্য/.test(s);
  const post = /পোস্ট|ভিডিও|post|video|ফেসবুক|facebook|প্রোফাইল/.test(s);
  if (comment && REPLY.test(s)) return true;
  if (comment && /উত্তর|জবাব|দাও|দেও|দিয়া|দিয়ে|করো|করে দ/.test(s) && !/পড়ে শোনাও|পড়ো|শোনাও|দেখাও|কয়টা|কতগুলো|read|show/.test(s)) return true;
  // "দুই নম্বর ভিডিওতে রিপ্লাই করে আসো" (no word "comment")
  return post && REPLY.test(s) && !/মেসেজ|message|ইনবক্স|inbox|হোয়াটসঅ্যাপ|whatsapp|মেসেঞ্জার|messenger/.test(s);
}

/**
 * LOCKED (owner, Nov 28): "আমার ফেসবুকে ৫ নম্বর ভিডিওতে যাও" (only go there, no reply asked) → the post number;
 * ROSE walks to that post, stops, and asks him what to do. null = not this request.
 */
export function goToPostNumber(t: string): number | null {
  const s = t.toLowerCase();
  if (!/ভিডিও|পোস্ট|video|post/.test(s)) return null;
  if (!/যাও|জাও|যা[ওয়]|ঢুকো|ধুকো|দুকো|ঢোকো|খোলো|খুলো|খুলে|নিয়ে যাও|চলে যাও|go to|open/.test(s)) return null;
  if (asksCommentReplies(s)) return null;
  return postNumber(s);
}

/**
 * LOCKED (owner, Nov 28): "আমি ৩ ঘণ্টা আগে যে ভিডিও ছেড়েছি" → minutes ago (180). null = no age said.
 * Units: মিনিট, ঘণ্টা/ঘন্টা, দিন, সপ্তাহ, মাস (and English). Numbers in Bangla digits, English digits or words.
 */
const NUM_WORDS: [RegExp, number][] = [
  [/আধা/, 0.5], [/এক|১/, 1], [/দুই|দু|২/, 2], [/তিন|৩/, 3], [/চার|৪/, 4], [/পাঁচ|৫/, 5], [/ছয়|৬/, 6], [/সাত|৭/, 7],
  [/আট|৮/, 8], [/নয়|৯/, 9], [/দশ|১০/, 10], [/এগারো/, 11], [/বারো/, 12],
];
export function postAgeMinutes(t: string): number | null {
  const s = t.toLowerCase().replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  if (!/আগে|ago|আগের/.test(s)) return null;
  const unit = s.match(/(মিনিট|minute|min\b|ঘণ্টা|ঘন্টা|ঘন্টে|hour|hr\b|দিন|day|সপ্তাহ|week|মাস|month)/);
  if (!unit) return null;
  const mult = /মিনিট|minute|min/.test(unit[1]) ? 1 : /ঘণ্টা|ঘন্টা|ঘন্টে|hour|hr/.test(unit[1]) ? 60 : /দিন|day/.test(unit[1]) ? 1440 : /সপ্তাহ|week/.test(unit[1]) ? 10080 : 43200;
  const before = s.slice(0, unit.index);
  const d = before.match(/(\d{1,3})\s*$/) || before.match(/(\d{1,3})\D{0,6}$/);
  let n = d ? Number(d[1]) : NaN;
  if (Number.isNaN(n)) {
    const tail = before.slice(-14);
    for (const [re, v] of NUM_WORDS) if (re.test(tail)) { n = v; break; }
  }
  if (Number.isNaN(n)) n = 1; // "ঘণ্টাখানেক আগে"
  return Math.round(n * mult);
}

/** his yes to "এটাতে ঢুকবো?" */
export function saysYes(t: string): boolean {
  return /^(হ্যাঁ|হা|হুম|হ্যা|জি|জ্বি|ঠিক আছে|ok|okay|yes|ঢুকো|ঢোকো|ধুকো|দুকো|করো|দাও|চলো)/.test(t.trim().toLowerCase()) ||
    /হ্যাঁ|ঢুকো|ঢোকো|ধুকো|ওটাতেই|ওইটাতে|এটাতেই/.test(t);
}
