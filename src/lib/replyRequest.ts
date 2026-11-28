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
  // a bent number word right before নম্বর/নাম্বার, by its first sound ("চান নম্বর" = 4, "পাস নাম্বার" = 5)
  const bent = s.match(new RegExp(`(\\S{1,4})\\s*${NUM_WORD}`));
  if (bent) {
    const w = bent[1];
    const byStart: [RegExp, number][] = [[/^দু|^দো/, 2], [/^তি/, 3], [/^চা/, 4], [/^পা/, 5], [/^ছ|^সাই|^সয়|^সয়|^চয়|^চয়/, 6], [/^সাত|^সাদ|^সাথ/, 7], [/^আট/, 8], [/^ন[য়ও]/, 9], [/^দশ/, 10]];
    for (const [re, n] of byStart) if (re.test(w)) return n;
  }
  // Nov 28: the number glued into নম্বর ("পাস্তম্বার" = পাঁচ নম্বর, "চান্নাম্বার" = চার নম্বর): by its first sound
  const glued = s.match(GLUED);
  if (glued) {
    const byStart: [RegExp, number][] = [[/^দু|^দো/, 2], [/^তি/, 3], [/^চা/, 4], [/^পা/, 5], [/^ছ|^সাই|^সয়|^সয়|^চয়|^চয়/, 6], [/^সাত|^সাদ|^সাথ/, 7], [/^আট/, 8], [/^দশ/, 10]];
    for (const [re, n] of byStart) if (re.test(glued[1])) return n;
  }
  return null;
}

const GLUED = /(?:^|\s)([^\sন]\S{0,4}?)(?:ম্বা?র|মবা?র|নাম্বা?র)/;

/** he said some "নম্বর" but ROSE could not hear which number → she must ask, never guess the newest video */
export function numberUnclear(t: string): boolean {
  const s = t.toLowerCase();
  // a month ("নভেম্বর", "নাউম্বর") is not a "নম্বর" (Nov 28: "১৯ নভেম্বর" made ROSE ask for a number)
  const noMonths = s.replace(/\S*(নভে|নভম|নাউম|নবেম|নোভেম|ডিসে|সেপ্টে)\S*/g, ' ');
  return postNumber(noMonths) === null && (new RegExp(NUM_WORD).test(noMonths) || /ম্বা?র|মবা?র/.test(noMonths));
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
  if (!/যাও|জাও|যা[ওয়]|ঢুকো|ধুকো|দুকো|ঢোকো|ঢুকে|ধুকে|দুকে|খোলো|খুলো|খুলে|নিয়ে যাও|চলে যাও|দেখো|go to|open/.test(s)) return null;
  if (asksCommentReplies(s)) return null;
  return postNumber(s);
}

/**
 * LOCKED (owner, Nov 28): "আমি ৩ ঘণ্টা আগে যে ভিডিও ছেড়েছি" → minutes ago (180). null = no age said.
 * Units: মিনিট, ঘণ্টা/ঘন্টা, দিন, সপ্তাহ, মাস (and English). Numbers in Bangla digits, English digits or words.
 */
const NUM_WORDS: [RegExp, number][] = [
  // Whisper often bends them: "চাদ"/"চাইর" = চার, "তিনি" = তিন, "পাচ" = পাঁচ, "দো"/"দু" = দুই
  [/আধা/, 0.5], [/এক|১/, 1], [/দুই|দু|দো|২/, 2], [/তিন|তিনি|তিনো|৩/, 3], [/চার|চাদ|চাইর|চাপ|চার্|৪/, 4], [/পাঁচ|পাচ|পাজ|পাছ|পাঁছ|৫/, 5], [/ছয়|ছয়|সাই|সয়|সয়|৬/, 6], [/সাত|৭/, 7],
  [/আট|৮/, 8], [/নয়|নয়|নাই|নই|নো|৯/, 9], [/দশ|১০/, 10], [/এগারো/, 11], [/বারো/, 12],
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
    // still nothing: a short bent word right before the unit, by its first sound (Whisper writes পাস/পাশ/পাজ for
    // পাঁচ, চাদ/চাপ for চার, তিম for তিন …)
    if (Number.isNaN(n) && words[0] && words[0].length <= 4) {
      const w = words[0];
      const byStart: [RegExp, number][] = [[/^দু|^দো/, 2], [/^তি/, 3], [/^চা/, 4], [/^পা/, 5], [/^ছ|^সাই|^সয়|^সয়|^চয়|^চয়/, 6], [/^সাত|^সাদ|^সাথ/, 7], [/^আট/, 8], [/^ন[য়ওাই]/, 9], [/^দশ/, 10]];
      for (const [re, v] of byStart) if (re.test(w)) { n = v; break; }
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
    (/হ্যাঁ|ঢুক|ঢোক|ধুক|দুক|ডুক|ওটাতেই|ওইটাতে|এটাতেই|রিপ্লাই|রিফ্লাই|দাও|করো|শুরু/.test(t) && !/^(না|নাহ|নো)(?=$|[\s,।])|নিচে|নিচের/.test(t.trim()));
}

/** right after ROSE stopped on a video: "দেখো রিপ্লাই বাকি আছে কিনা, রিপ্লাই দাও" (any reply / comment talk) = that video */
export function asksReplyHere(t: string): boolean {
  const s = t.toLowerCase();
  // "না, এখানে আর বাকি নাই" is not a reply job
  if (/বাকি নাই|বাকি নেই|আর নাই|আর নেই|শেষ হয়ে গেছে|^না[,\s]/.test(s)) return false;
  // "নিচে আরো আছে দেখো" / "আরো বাকি আছে" right after a reply job = go on with the same comments
  return REPLY.test(s) || (/কমেন্ট|কমেন|কমন|comment/.test(s) && /দেখো|চেক|check|করো|দাও|খুল/.test(s)) ||
    /আরো ?আছে|আরও ?আছে|আরোআসে|আরো আসে|বাকি আছে|বাকি রয়ে|নিচে আরো|নিচে আরও|নিচে দেখো/.test(s);
}

/** 4320 → "৩ দিন", 180 → "৩ ঘণ্টা" (how ROSE says back the age he meant) */
export function ageWords(min: number, heard = ''): string {
  const bn = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  if (min < 60) return `${bn(Math.max(1, min))} মিনিট`;
  if (min < 1440) return `${bn(Math.round(min / 60))} ঘণ্টা`;
  // Nov 28 (owner): he said "৯ দিন" and ROSE said "১ সপ্তাহ" — she says it back in HIS unit
  if (/সপ্তাহ|week/.test(heard) && min >= 10080) return `${bn(Math.round(min / 10080))} সপ্তাহ`;
  if (/মাস|month/.test(heard) && min >= 43200) return `${bn(Math.round(min / 43200))} মাস`;
  if (min < 10080 || /দিন|day/.test(heard)) return `${bn(Math.round(min / 1440))} দিন`;
  if (min < 43200) return `${bn(Math.round(min / 10080))} সপ্তাহ`;
  return `${bn(Math.round(min / 43200))} মাস`;
}

/** he named a time ("… দিন আগের ভিডিও") but ROSE could not hear the number: ask again, never guess */
export function ageWithoutNumber(t: string): boolean {
  const s = t.toLowerCase();
  return postAgeMinutes(s) === null && /(মিনিট|ঘণ্টা|ঘন্টা|দিন|সপ্তাহ|মাস|hour|day|week)\s*(আগে|আগের|আগি|আগো|ago)/.test(s) && /ভিডিও|বিডিও|ভিডিয়ো|পোস্ট|video|post|রিল/.test(s);
}

/**
 * LOCKED (owner, Nov 28): several videos in one order — "৪ নম্বর ভিডিওর রিপ্লাই শেষ করে তারপর ৫ নম্বরে যাও" →
 * [4, 5] in the order he said them. One number → [n]. None → [].
 */
export function postNumbersInOrder(t: string): number[] {
  const parts = t.split(/তারপর|তারপরে|এরপর|এরপরে|পরে|পরবর্তীতে|আবার|then|after that|,|।/);
  const out: number[] = [];
  for (const p of parts) {
    const n = postNumber(p);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Nov 28 (owner): "এটা না, নিচেরটায় যাও", "নিচের ভিডিওটা দেখো", "পরের ভিডিওতে যাও" → his next video below the one
 * ROSE is on. ROSE goes there, says its date/age and asks "এটাতে ঢুকবো?".
 */
export function asksNextDown(t: string): boolean {
  const s = t.toLowerCase();
  // Nov 28: Whisper writes it many ways ("আরনিচ জাও", "নিছে টাই জাও"): any নিচ/নিছ with a go-word = the next video,
  // unless he is talking about comments further down
  if (/নি[চছ]/.test(s) && /যাও|জাও|যান|জান|চলো|নামো|নামাও|যাইও|যা[\s।,]|জা[\s।,]|যা$|জা$/.test(s) && !/কমেন্ট|কমন|comment|আরো আছে|আরও আছে/.test(s)) return true;
  return /নি[চছ]ের ?(টা|টায়|টাতে|টি|ডায়|ভিডিও|পোস্ট|বিডিও)|নি[চছ]েরটা|নি[চছ]ে ?(যাও|জাও|যান|জান|যা|জা|নামো|নামাও|চলো)|নিচের দিকে|পরের ?(টা|টায়|ভিডিও|পোস্ট)|এর পরের|next (video|post)|below/.test(s);
}

/** his "না" to "এটাতে ঢুকবো?" (without asking for the next one) */
export function saysNo(t: string): boolean {
  return /^(না|নাহ|নো|no)(?=$|[\s,।!.])/.test(t.trim().toLowerCase());
}

/** Bangla month names as Whisper writes them (নভেম্বর often comes as নাউম্বর / নভম্বর) → month 1–12 */
const MONTHS_BN: [RegExp, number][] = [
  [/জানু|january|jan\b/, 1], [/ফেব্রু|february|feb\b/, 2], [/মার্চ|march/, 3], [/এপ্রিল|april/, 4], [/(^|\s)মে(\s|$)|\bmay\b/, 5],
  [/জুন|june/, 6], [/জুলাই|july/, 7], [/আগস্ট|অগাস্ট|august/, 8], [/সেপ্টে|september/, 9], [/অক্টো|october/, 10],
  [/নভে|নভম|নাউম|নবেম|নোভেম|november|nov\b/, 11], [/ডিসে|december|dec\b/, 12],
];
/** day words 1–31 (longest first), plus bent first sounds ("উন্নিষ্ট" = উনিশ) */
const DAY_WORDS: [RegExp, number][] = [
  [/^(ঊ|উ)নত্রিশ/, 29], [/^একত্রিশ/, 31], [/^(ত্রিশ|তিরিশ)/, 30], [/^আঠাশ/, 28], [/^সাতাশ/, 27], [/^ছাব্বিশ/, 26], [/^প[ঁ]?চিশ/, 25],
  [/^চব্বিশ/, 24], [/^তেইশ/, 23], [/^বাইশ/, 22], [/^একুশ/, 21], [/^(বিশ|কুড়ি)/, 20], [/^(ঊ|উ)ন/, 19], [/^আঠা?রো/, 18],
  [/^সতেরো/, 17], [/^ষোল/, 16], [/^পনেরো/, 15], [/^চৌদ্দ/, 14], [/^তেরো/, 13], [/^বারো/, 12], [/^এগারো/, 11], [/^দশ/, 10],
  [/^নয়|^নয়/, 9], [/^আট/, 8], [/^সাত/, 7], [/^ছয়|^ছয়/, 6], [/^পাঁচ|^পাচ/, 5], [/^চার/, 4], [/^তিন/, 3], [/^দুই/, 2], [/^এক/, 1],
];
/**
 * Nov 28 (owner): "১৯ নভেম্বর যেটা আছে ওটাতে ঢুকো", "উনিশ নভেম্বরের ভিডিও" → { day: 19, month: 11 }. null = no date.
 */
export function postDate(t: string): { day: number; month: number } | null {
  const s = t.toLowerCase().replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const words = s.split(/[\s,।!?]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const m = MONTHS_BN.find(([re]) => re.test(words[i]));
    if (!m) continue;
    const before = words[i - 1] || '';
    const after = words[i + 1] || '';
    let day = Number((before.match(/^(\d{1,2})/) || after.match(/^(\d{1,2})/) || [])[1]);
    if (!day) for (const [re, v] of DAY_WORDS) if (re.test(before)) { day = v; break; }
    if (day >= 1 && day <= 31) return { day, month: m[1] };
  }
  return null;
}

export function dateWords(d: { day: number; month: number }): string {
  const bn = (n: number) => String(n).replace(/\d/g, (x) => '০১২৩৪৫৬৭৮৯'[Number(x)]);
  const names = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  return `${bn(d.day)} ${names[d.month - 1]}`;
}
