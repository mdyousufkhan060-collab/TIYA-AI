/**
 * Nov 28 (owner): his Facebook profile and the Pages under it. Its own file.
 *  - "আমার আইডির আন্ডারে কটা পেজ আছে?" → ROSE reads them from Facebook (phone step 'list my profiles') and says them
 *  - "ইসলাম বলছে-তে ঢুকো" → the spoken name is matched to the real page name ("ISLAM BOLCHE") by its sounds
 */

/** he asks which/how many Pages are under his account */
export function asksListPages(t: string): boolean {
  const s = t.toLowerCase();
  // owner (Nov 28 5:33 PM): "পেজের ভিতরে … ভিডিও … কমেন্ট" is a job on the Page he is in now, not the Pages list.
  // Only "আইডির আন্ডারে / কয়টা পেজ" without a video/comment job is the list.
  if (/ভিডিও|বিডিও|ভিডু|পোস্ট|কমেন্ট|কমেন|কমন|রিপ্লাই|রিফ্লাই|comment|reply|video/.test(s)) return false;
  // Nov 28: "কয়টা পেজ আছে" came as "কোড়া পেজ আসে" / "কোডে পেজ আসে" (and ROSE opened Quora): any "পেজ … আছে/আসে"
  // about his ID is this question
  if (/পেজ|পেইজ|page/.test(s) && /আছে|আসে|আছ|আচে/.test(s) && /আইডি|আইডিতে|id|আমার|আন্ডার/.test(s) && !/ঢুক|ধুক|দুক|ডুক|ঢোক|যাও|জাও|সুইচ|লগইন/.test(s)) return true;
  return (/পেজ|পেইজ|পেজে|page/.test(s) && /কটা|কোড়া|কোরা|কোডে|কোটা|কতটা|কয়টা|কয়টা|কতগুলো|কত গুলো|কি কি|কী কী|কোন কোন|লিস্ট|list|আন্ডারে|আন্ডার|নিচে কি|দেখাও|বলো/.test(s)) ||
    /আইডির (আন্ডারে|নিচে|ভিতরে) (কি|কী|কয়|কত)/.test(s);
}

/** he wants to go into a page / profile */
export function asksEnterPage(t: string): boolean {
  return /ঢুক|ধুক|দুক|ডুক|ঢোক|যাও|জাও|সুইচ|switch|লগইন|login|লগ ইন|খোলো|ওপেন|open/.test(t.toLowerCase());
}

const BN: Record<string, string> = {
  'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'n', 'চ': 'c', 'ছ': 'c', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n', 'ট': 't', 'ঠ': 't', 'ড': 'd', 'ঢ': 'd', 'ণ': 'n',
  'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n', 'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'b', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's',
  'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'r', 'ৎ': 't', 'ং': 'n',
};

/** a name's consonant sounds: "ISLAM BOLCHE" and "ইসলাম বলছে" both → "slmblc" */
export function soundOf(text: string): string {
  // page names can come in bold letters (𝐈𝐒𝐋𝐀𝐌 𝐁𝐎𝐋𝐂𝐇𝐄): NFKC makes them plain
  let s = text.normalize('NFKC').toLowerCase().normalize('NFC');
  s = s.replace(/্য/g, ''); // য-ফলা
  s = s.replace(/\u09A1\u09BC|\u09DC|\u09A2\u09BC|\u09DD/g, 'র').replace(/\u09AF\u09BC|\u09DF/g, ''); // ড় ঢ় → র, য় → (a vowel sound)
  let out = '';
  for (const ch of s) {
    if (BN[ch]) out += BN[ch];
    else if (/[a-z]/.test(ch)) out += ch;
  }
  out = out.replace(/ch/g, 'c').replace(/sh/g, 's').replace(/th/g, 't').replace(/ph/g, 'f').replace(/kh/g, 'k').replace(/gh/g, 'g')
    .replace(/bh/g, 'b').replace(/dh/g, 'd').replace(/v/g, 'b').replace(/z/g, 'j').replace(/q/g, 'k').replace(/x/g, 'ks');
  out = out.replace(/[aeiouyw]/g, '').replace(/h/g, '');
  return out.replace(/(.)\1+/g, '$1');
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** the page/profile he named in this sentence, or null */
export function matchProfile(t: string, names: string[]): string | null {
  const said = soundOf(t);
  let best: { name: string; score: number } | null = null;
  // his own (main) profile by words
  if (names.length && /মেইন|main|পার্সোনাল|personal|নিজের আইডি|আমার আইডিতে|আমার প্রোফাইল/.test(t.toLowerCase())) return names[0];
  const variants: [string, string][] = [];
  for (const name of names) {
    variants.push([name, name]);
    const short = name.replace(/^(md\.?|mohammad|mohammed|muhammad|mr\.?)\s+/i, '');
    if (short !== name) variants.push([name, short]);
  }
  for (const [name, form] of variants) {
    const k = soundOf(form);
    if (k.length < 3) continue;
    let min = Infinity;
    for (let i = 0; i + k.length <= said.length + 1; i++) min = Math.min(min, lev(said.slice(i, i + k.length), k));
    const allow = Math.floor(k.length / 5);
    if (min <= allow && (!best || min < best.score)) best = { name, score: min };
  }
  return best?.name ?? null;
}

/** how a page name is said and shown: plain letters (𝐈𝐒𝐋𝐀𝐌 → ISLAM) */
export function plainName(n: string): string {
  return n.normalize('NFKC').trim();
}

/** "এখান থেকে বেরিয়ে হোমে আসো" */
export function asksFacebookHome(t: string): boolean {
  // Nov 28: Whisper writes হোমপেজ as "হুম্পে", "হুম পেজ", "হোম পেজ"
  return /বের হ|বেরিয়ে|বেড়িয়ে|বাইর|হোমে|হো?ু?ম[্ ]?পে|home/.test(t.toLowerCase()) && !/ভিডিও|পোস্ট|কমেন্ট|রিপ্লাই/.test(t);
}

/** "ফেসবুকে ঢুকো" — only open Facebook (no video, comment, page or post job in the sentence) */
export function asksOpenFacebookOnly(t: string): boolean {
  const s = t.toLowerCase();
  return /ফেসবুক|ফেইসবুক|facebook/.test(s) && /ঢুক|ধুক|দুক|ডুক|ঢোক|যাও|জাও|খোলো|খুলো|ওপেন|open|চলো/.test(s) &&
    !/ভিডিও|বিডিও|পোস্ট|কমেন্ট|কমেন|রিপ্লাই|পেজ|পেইজ|আইডির আন্ডারে|মেসেজ|নোটিফিকেশন|স্ক্রল|নিচে/.test(s);
}

/** "নিচে স্ক্রল করো", "ভিডিওগুলো স্ক্রল করো", "পরেরটা দেখাও" while just browsing Facebook */
export function asksFeedScroll(t: string): boolean {
  const s = t.toLowerCase();
  return /স্ক্রল|স্ক্রোল|স্কল|scroll|নি[চছ]ে|পরের|next/.test(s) && !/কমেন্ট|রিপ্লাই|নম্বর|দিন আগে|দিন আগের/.test(s);
}
