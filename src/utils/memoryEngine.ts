import { ChatMessage, MemoryCategory, MemoryItem, MemoryScope } from '../types/tiya';

const MAX_MEMORY_TEXT_LEN = 180;

interface ExtractionRule {
  category: MemoryCategory;
  pattern: RegExp;
}

/**
 * Extracts ONLY explicitly stated, high-signal facts/preferences/projects from
 * the user's own message. Never invents or infers unstated details.
 */
const EXPLICIT_EXTRACTION_RULES: ExtractionRule[] = [
  {
    category: 'addressing',
    pattern:
      /(?:আমাকে\s+.{2,50}?\s*(?:বলবে|বলবেন|ডাকবে|ডাকবেন)|call me\s+.{2,40}|address me as\s+.{2,40})/i,
  },
  {
    category: 'preference',
    pattern:
      /(?:আমি\s+.{2,70}?\s*(?:পছন্দ করি|ভালোবাসি|খুব ভালো লাগে|পছন্দ করি না|ভালো লাগে না)|আমার প্রিয়\s+.{2,60}|i (?:really )?(?:like|love|prefer|enjoy|dislike|hate)\s+.{2,70}|my favorite\s+.{2,60})/i,
  },
  {
    category: 'project',
    pattern:
      /(?:আমার প্রজেক্ট|প্রজেক্টটা|আমি\s+.{2,70}?\s*(?:বানাচ্ছি|কাজ করছি|তৈরি করছি|শিখছি)|i(?:'m| am) (?:working on|building|developing|learning)\s+.{2,80}|my project\s+.{2,80})/i,
  },
  {
    category: 'context',
    pattern:
      /(?:মনে রেখো|মনে রাখবে|মনে রাখবেন|ভুলে যেও না|remember (?:that )?.{4,120}|don't forget (?:that )?.{4,120})/i,
  },
];

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Scans a user's own text/voice utterance for explicitly stated memorable facts
 * (preferences, addressing cues, projects, explicit "remember this" notes) and
 * returns deduplicated additions for the specified memory scope.
 */
export function extractExplicitMemories(
  userText: string,
  existingMemories: MemoryItem[],
  scope: MemoryScope,
  now = Date.now(),
): MemoryItem[] {
  const cleaned = (userText || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 6 || cleaned.length > 500) return [];

  // Skip pure questions so we never mistake a question for a fact
  if (/^[?？]+$/.test(cleaned) || (cleaned.endsWith('?') && !/মনে রেখো|মনে রাখ|remember/i.test(cleaned))) {
    return [];
  }

  let matchedCategory: MemoryCategory | null = null;
  for (const rule of EXPLICIT_EXTRACTION_RULES) {
    if (rule.pattern.test(cleaned)) {
      matchedCategory = rule.category;
      break;
    }
  }
  if (!matchedCategory) return [];

  const snippet = cleaned.slice(0, MAX_MEMORY_TEXT_LEN).trim();
  const normCandidate = normalizeForDedup(snippet);
  if (normCandidate.length < 5) return [];

  const alreadyStored = existingMemories.some((m) => {
    const normExisting = normalizeForDedup(m.text);
    return (
      normExisting === normCandidate ||
      (normExisting.length >= 16 && normCandidate.includes(normExisting)) ||
      (normCandidate.length >= 16 && normExisting.includes(normCandidate))
    );
  });

  if (alreadyStored) return [];

  return [
    {
      id: makeMemoryId(),
      text: snippet,
      createdAt: now,
      updatedAt: now,
      category: matchedCategory,
      scope,
    },
  ];
}

export function mergeMemories(
  existing: MemoryItem[],
  additions: MemoryItem[],
  maxItems = 100,
): MemoryItem[] {
  if (additions.length === 0) return existing;
  const next = [...existing];
  for (const item of additions) {
    const norm = normalizeForDedup(item.text);
    if (!norm) continue;
    const dupIdx = next.findIndex((m) => normalizeForDedup(m.text) === norm);
    if (dupIdx >= 0) {
      next[dupIdx] = { ...next[dupIdx], updatedAt: item.updatedAt || Date.now() };
    } else {
      next.push(item);
    }
  }
  return next.slice(-maxItems);
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  addressing: 'Addressing',
  preference: 'Preference',
  project: 'Project',
  conversation: 'Past Conversation',
  context: 'Context',
  general: 'Note',
};

/**
 * Formats isolated saved memories and recent chat/voice history for prompt context.
 */
export function buildContextualMemorySummary(
  messages: ChatMessage[],
  memories: MemoryItem[] = [],
  options?: {
    maxRecentMessages?: number;
    maxSavedMemories?: number;
    isAdminScope?: boolean;
  },
): string {
  const maxRecent = options?.maxRecentMessages ?? 16;
  const maxSaved = options?.maxSavedMemories ?? 15;
  const isAdminScope = Boolean(options?.isAdminScope);
  const parts: string[] = [];

  // Filter strictly by scope to prevent cross-scope leakage even if arrays are mixed
  const scopedMemories = memories.filter((m) =>
    isAdminScope ? m.scope !== 'user' : m.scope !== 'admin',
  );

  if (scopedMemories.length > 0) {
    const header = isAdminScope
      ? 'Private Admin memories (isolated to verified Admin; use subtly for natural continuity without repeating verbatim or fabricating details):'
      : 'Saved user memories (use naturally for continuity without fabricating details):';
    parts.push(
      header +
        '\n' +
        scopedMemories
          .slice(-maxSaved)
          .map((m) => {
            const tag = m.category ? `[${CATEGORY_LABELS[m.category] || 'Note'}] ` : '';
            return `- ${tag}${m.text.replace(/\s+/g, ' ').trim()}`;
          })
          .join('\n'),
    );
  }

  const recent = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-maxRecent);

  if (recent.length > 0) {
    parts.push(
      'Recent shared conversation memory (for continuity between voice and chat):\n' +
        recent
          .map((m) => {
            const speaker = m.role === 'user' ? (isAdminScope ? 'স্যার' : 'User') : 'TIYA';
            const clean = m.text.replace(/\s+/g, ' ').trim().slice(0, 260);
            return `${speaker}: ${clean}`;
          })
          .join('\n'),
    );
  }

  return parts.join('\n\n');
}
