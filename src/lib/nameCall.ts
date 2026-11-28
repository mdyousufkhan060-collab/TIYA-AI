/**
 * How ROSE calls the person by name, and her answer when he only calls her ("রোজ", "Rose", "রোজ শুনছো?").
 * Its own file. Nov 28: he wants "ঠিক আছে ইউসুফ…" when she takes a job, and a warm answer when he calls her.
 */
export function callNameOf(full: string | undefined | null): string {
  const s = String(full || '').trim();
  if (!s) return '';
  if (/yousuf|yusuf|ইউসুফ/i.test(s)) return 'ইউসুফ';
  const parts = s.split(/\s+/).filter((p) => !/^(md\.?|mohammad|mohammed|muhammad|মো\.?|মোঃ|মোহাম্মদ)$/i.test(p));
  const w = parts[0] || '';
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
}

/** "ঠিক আছে ইউসুফ, " (or "ঠিক আছে, " with no name) */
export function okWithName(name: string): string {
  return name ? `ঠিক আছে ${name}, ` : 'ঠিক আছে, ';
}

/** he only called her by name: answer at once, warmly, and listen */
export function nameCallAnswer(heard: string, name: string): string | null {
  const s = heard.toLowerCase().replace(/[.,!?।\s]+/g, ' ').trim();
  if (!/^(এই |হ্যালো |hello |hey |ও )?(রোজ|রোস|rose|roz)( শুনছো| শুনছ| আছো| আছ| কোথায়| are you there)?$/.test(s)) return null;
  return name ? `জি ${name}, আমি আছি। বলো, আমি তোমার কথা শুনছি।` : 'জি, আমি আছি। বলো, শুনছি।';
}

/** he asked "কেমন আছো?" together with a job: ROSE answers that first, then says what she will do */
export function greetFirst(heard: string): string {
  return /কেমন ?আছ|কেমনাছ|কেমন আসো|how are you/i.test(heard) ? 'আলহামদুলিল্লাহ ভালো আছি। ' : '';
}
