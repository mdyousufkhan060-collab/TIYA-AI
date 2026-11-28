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

const REPLY = /রিপ্লাই|রিফ্লাই|রিপলাই|রিপ্লে|রিপ্লায়|রিপ্লাইয়|reply/;

/** a reply-the-comments job: "কমেন্টে রিপ্লাই দাও", or "রিপ্লাই" about his post / video / Facebook */
export function asksCommentReplies(t: string): boolean {
  const s = t.toLowerCase();
  const comment = /কমেন্ট|কমেন|কমন|কোমেন্ট|কমেন্ড|comment|মন্তব্য/.test(s);
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
  // Whisper often bends them: "চাদ"/"চাইর" = চার, "তিনি" = তিন, "পাচ" = পাঁচ, "দো"/"দু" = দুই
  [/আধা/, 0.5], [/এক|১/, 1], [/দুই|দু|দো|২/, 2], [/তিন|তিনি|তিনো|৩/, 3], [/চার|চাদ|চাইর|চাপ|চার্|৪/, 4], [/পাঁচ|পাচ|৫/, 5], [/ছয়|ছয়|৬/, 6], [/সাত|৭/, 7],
  [/আট|৮/, 8], [/নয়|৯/, 9], [/দশ|১০/, 10], [/এগারো/, 11], [/বারো/, 12],
];
export function postAgeMinutes(t: string): number | null {
  const s = t.toLowerCase().replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  if (!/আগে|আগের|আগি|আগো|আগা|ago/.test(s)) return null;
  const unit = s.match(/(মিনিট|minute|min\b|ঘণ্টা|ঘন্টা|ঘন্টে|hour|hr\b|দিন|day|সপ্তাহ|week|মাস|month)/);
  if (!unit) return null;
  const mult = /মিনিট|minute|min/.test(unit[1]) ? 1 : /ঘণ্টা|ঘন্টা|ঘন্টে|hour|hr/.test(unit[1]) ? 60 : /দিন|day/.test(unit[1]) ? 1440 : /সপ্তাহ|week/.test(unit[1]) ? 10080 : 43200;
  const before = s.slice(0, unit.index);
  const d = before.match(/(\d{1,3})\s*$/) || before.match(/(\d{1,3})\D{0,6}$/);
  let n = d ? Number(d[1]) : NaN;
  if (Number.isNaN(n)) {
    // the number word right before the unit, as a whole word ("তিন দিন"), never a piece of another word
    // (Nov 28: "একটু … তিন দিন" was read as 1 day because "এক" was found first)
    const words = before.trim().split(/[\s,।]+/).slice(-3).reverse();
    outer: for (const w of words) {
      for (const [re, v] of NUM_WORDS) {
        if (new RegExp(`^(${re.source})(টা|টি|খানা)?$`).test(w)) { n = v; break outer; }
      }
    }
  }
  if (Number.isNaN(n)) {
    if (/খানেক/.test(s)) n = 1; // "ঘণ্টাখানেক আগে"
    else return null; // no number heard: not guessed (Nov 28: a guess sent ROSE to the wrong video)
  }
  return Math.round(n * mult);
}

/** his yes to "এটাতে ঢুকবো?" */
export function saysYes(t: string): boolean {
  return /^(হ্যাঁ|হা|হুম|হ্যা|জি|জ্বি|ঠিক আছে|ok|okay|yes|ঢুকো|ঢোকো|ধুকো|দুকো|করো|দাও|চলো)/.test(t.trim().toLowerCase()) ||
    /হ্যাঁ|ঢুকো|ঢোকো|ধুকো|ওটাতেই|ওইটাতে|এটাতেই/.test(t);
}

/** right after ROSE stopped on a video: "দেখো রিপ্লাই বাকি আছে কিনা, রিপ্লাই দাও" (any reply / comment talk) = that video */
export function asksReplyHere(t: string): boolean {
  const s = t.toLowerCase();
  // "নিচে আরো আছে দেখো" / "আরো বাকি আছে" right after a reply job = go on with the same comments
  return REPLY.test(s) || (/কমেন্ট|কমেন|কমন|comment/.test(s) && /দেখো|চেক|check|করো|দাও|খুল/.test(s)) ||
    /আরো ?আছে|আরও ?আছে|আরোআসে|আরো আসে|বাকি আছে|বাকি রয়ে|নিচে আরো|নিচে আরও|নিচে দেখো/.test(s);
}

/** 4320 → "৩ দিন", 180 → "৩ ঘণ্টা" (how ROSE says back the age he meant) */
export function ageWords(min: number): string {
  const bn = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  if (min < 60) return `${bn(Math.max(1, min))} মিনিট`;
  if (min < 1440) return `${bn(Math.round(min / 60))} ঘণ্টা`;
  if (min < 10080) return `${bn(Math.round(min / 1440))} দিন`;
  if (min < 43200) return `${bn(Math.round(min / 10080))} সপ্তাহ`;
  return `${bn(Math.round(min / 43200))} মাস`;
}

/** he named a time ("… দিন আগের ভিডিও") but ROSE could not hear the number: ask again, never guess */
export function ageWithoutNumber(t: string): boolean {
  const s = t.toLowerCase();
  return postAgeMinutes(s) === null && /(মিনিট|ঘণ্টা|ঘন্টা|দিন|সপ্তাহ|মাস|hour|day|week)\s*(আগে|আগের|আগি|আগো|ago)/.test(s) && /ভিডিও|পোস্ট|video|post|রিল/.test(s);
}
