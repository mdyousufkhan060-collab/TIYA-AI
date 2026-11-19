import { MotivationPost } from '../types/tiya';

const MOTIVATION_TRIGGERS: RegExp[] = [
  /(আজকের\s*)?(মোটিভেশন|অনুপ্রেরণা|উৎসাহ).*(বলো|বলেন|শোনাও|শোনান|দাও|দিন|পড়ো|পড়ে|কী|কি|আছে)/i,
  /^(আজকের\s*)?(মোটিভেশন|অনুপ্রেরণা|motivation)(\s*(বলো|বলেন|শোনাও|শোনান|দাও|দিন))?[.?!]*$/i,
  /(ajker\s*)?motivation\s*(bolo|bolen|shonao|shonan|dao|din|sunao)/i,
  /(tell|read|give|share|say|show).*(today'?s\s*|daily\s*)?motivation/i,
  /(what\s*is|what'?s)\s*(today'?s\s*)?motivation/i,
  /motivate\s*me/i,
];

export function isMotivationRequest(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return MOTIVATION_TRIGGERS.some((re) => re.test(clean));
}

export function hasBengaliScript(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

export function getFirstLine(text: string, maxLen = 84): string {
  const firstNonEmpty =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) || '';
  if (firstNonEmpty.length <= maxLen) return firstNonEmpty;
  return `${firstNonEmpty.slice(0, maxLen).trimEnd()}…`;
}

export function formatMotivationReplyBn(
  post: Pick<MotivationPost, 'title' | 'body'> | null | undefined,
): string {
  if (!post || !post.body?.trim()) {
    return 'এখনো কোনো প্রকাশিত মোটিভেশন পাওয়া যায়নি।';
  }
  const title = (post.title || '').trim();
  const body = post.body.trim();
  if (title && title.toLowerCase() !== 'motivation') {
    return `আজকের মোটিভেশন — ${title}:\n${body}`;
  }
  return `আজকের মোটিভেশন:\n${body}`;
}
