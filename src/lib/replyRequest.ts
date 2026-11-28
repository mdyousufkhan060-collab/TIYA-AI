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
