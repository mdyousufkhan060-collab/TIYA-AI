/**
 * QUICK ANSWERS (own file): questions the phone itself knows exactly. ROSE answers these at once from the
 * phone's clock, never from the AI and never by opening Google (that once gave a wrong time).
 * Time, date, day of the week — in Bangla or English, the way he asked.
 */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

function partOfDay(h: number): string {
  return h >= 4 && h < 6 ? 'ভোর' : h >= 6 && h < 12 ? 'সকাল' : h >= 12 && h < 15 ? 'দুপুর' : h >= 15 && h < 18 ? 'বিকাল' : h >= 18 && h < 20 ? 'সন্ধ্যা' : 'রাত';
}

/** null = not a time / date question (or it asks about another country's time: that goes to the web answer) */
export function quickAnswer(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  // another place's time ("আমেরিকায় এখন কয়টা বাজে") is not the phone's clock
  if (/আমেরিকা|লন্ডন|দুবাই|সৌদি|ইরান|ভারত|কানাডা|জাপান|america|london|dubai|usa|uk|saudi|india|canada|japan|new york/.test(t)) return null;
  // Nov 28: his voice can come out garbled ("অখন বাজে করেটা"): any short question with বাজে + a time word counts
  const garbled = t.length < 70 && /বাজে|বাজতেছে|বাজছে|বাজতাছে/.test(t) && /(কয়|কই|ক|কো|কে|কত|করে|কয়ে)\s?টা|এখন|অখন|এহন|কত/.test(t) && !/গান|মিউজিক|music|বাজাও|বাজিয়ে/.test(t);
  const askTime = garbled || /কয়টা বাজে|কটা বাজে|কয়টা বাজতেছে|কয়টা বাজছে|কতটা বাজে|সময় কত|কত বাজে|টাইম কত|what time|time is it|current time/.test(t);
  const askDay = /আজ কী বার|আজকে কী বার|আজ কি বার|আজকে কি বার|কোন বার|what day/.test(t);
  const askDate = /কত তারিখ|তারিখ কত|আজকের তারিখ|what date|today's date|date today/.test(t);
  if (!askTime && !askDay && !askDate) return null;
  const h24 = now.getHours();
  const h12 = h24 % 12 || 12;
  const m = now.getMinutes();
  const english = /[a-z]/.test(t) && !/[ঀ-৿]/.test(t);
  if (english) {
    const parts: string[] = [];
    if (askTime) parts.push(`It's ${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'} now.`);
    if (askDay || askDate) parts.push(`Today is ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`);
    return parts.join(' ');
  }
  const parts: string[] = [];
  if (askTime) parts.push(`এখন ${partOfDay(h24)} ${bn(h12)}টা ${m ? bn(m) + ' মিনিট' : ''} বাজে।`.replace(/\s+/g, ' '));
  if (askDay || askDate) parts.push(`আজ ${BN_DAYS[now.getDay()]}, ${bn(now.getDate())} ${BN_MONTHS[now.getMonth()]} ${bn(now.getFullYear())}।`);
  return parts.join(' ');
}
