/**
 * ROSE Brain (client side): long-term memory and Smart Recall on the server (rose-brain function).
 * Each user only reaches their own memories; the user's own Gemini key, when set, is sent only to
 * build the search index for that one request and is never saved on the server.
 */
import { supabase } from './supabase';
import { loadSettings } from '../utils/storage';

const ownKey = () => {
  try {
    return (loadSettings().apiKey || '').split(',')[0].trim();
  } catch {
    return '';
  }
};

async function call(body: Record<string, unknown>): Promise<any> {
  const { data: s } = await supabase.auth.getSession();
  if (!s?.session) return { ok: false, error: 'Not signed in' };
  const { data, error } = await supabase.functions.invoke('rose-brain', { body: { ...body, gkey: ownKey() } });
  if (error) return { ok: false, error: error.message };
  return data || { ok: false };
}

export const brainRecall = (query: string, fromDaysAgo?: number, toDaysAgo?: number) =>
  call({ action: 'recall', query, from_days_ago: fromDaysAgo, to_days_ago: toDaysAgo });

export const brainRemember = (content: string, category = 'fact', importance = 3) =>
  call({ action: 'remember', content, category, importance, source: 'talk' });

let ctxCache = { at: 0, text: '' };
/** Saved long-term notes for the prompt (cached for 2 minutes). */
export async function brainContext(force = false): Promise<string> {
  if (!force && Date.now() - ctxCache.at < 120000) return ctxCache.text;
  const r = await call({ action: 'context' }).catch(() => null);
  ctxCache = { at: Date.now(), text: r?.ok ? String(r.text || '') : ctxCache.text };
  return ctxCache.text;
}
export const brainContextNow = () => ctxCache.text;
export const brainList = () => call({ action: 'list' });
export const brainForget = (id: string) => call({ action: 'forget', id });

// Gemini tool declarations (voice + chat)
export function buildBrainTools(): Record<string, unknown>[] {
  return [
    {
      name: 'brain_recall',
      description:
        'Search this user\'s past conversations and saved notes (days, weeks or months ago). Use it whenever the user asks what they said, asked, planned or decided before, what you advised before, or refers to something from an earlier talk ("আগে কী বলেছিলাম", "গত সপ্তাহে", "৪ দিন আগে", "মনে আছে?"). Never guess past facts without it.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'What to look for, in the user\'s words (e.g. "নতুন পোশাকের ব্যবসা")' },
          from_days_ago: { type: 'NUMBER', description: 'Optional: the oldest day to search, in days ago (e.g. 7 for last week)' },
          to_days_ago: { type: 'NUMBER', description: 'Optional: the newest day to search, in days ago (e.g. 3)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'brain_remember',
      description:
        'Save one important long-term fact about this user so you remember it in future talks: their plans, goals, projects, decisions, preferences, business or study facts, or anything they ask you to remember ("মনে রেখো"). One short clear sentence in Bangla. Do not save small talk, moods of the moment, passwords, card or bank numbers, or health details unless they ask.',
      parameters: {
        type: 'OBJECT',
        properties: {
          content: { type: 'STRING', description: 'The fact, one short sentence' },
          category: { type: 'STRING', description: 'profile, preference, goal, plan, project, business, study, decision, followup or fact' },
          importance: { type: 'NUMBER', description: '1 (small) to 5 (very important)' },
        },
        required: ['content'],
      },
    },
  ];
}

/** Run a brain tool call and give back what the model should see. */
export async function runBrainTool(name: string, args: any): Promise<Record<string, unknown>> {
  try {
    if (name === 'brain_recall') {
      const r = await brainRecall(String(args?.query || ''), args?.from_days_ago, args?.to_days_ago);
      if (!r?.ok) return { found: false, error: r?.error || 'Recall failed', instruction: 'Tell the user in one line that you could not search old talks right now.' };
      return { found: r.found, results: r.results, instruction: r.instruction };
    }
    if (name === 'brain_remember') {
      const r = await brainRemember(String(args?.content || ''), String(args?.category || 'fact'), Number(args?.importance) || 3);
      if (r?.ok) void brainContext(true);
      return r?.ok ? { saved: true, instruction: 'Saved. Do not announce it unless the user asked you to remember.' } : { saved: false, error: r?.error || 'not saved' };
    }
  } catch (e) {
    return { error: String((e as Error)?.message || e) };
  }
  return { error: 'unknown tool' };
}

/** Words that mean "something from an earlier talk" (for the text chat, which looks it up before answering). */
export const RECALL_HINT = /(আগে|গত (সপ্তাহ|মাস|কাল)|গতকাল|দিন আগে|সপ্তাহ আগে|মাস আগে|বলেছিলাম|বলেছিলে|জিজ্ঞেস করেছিলাম|মনে আছে|মনে পড়ে|পরামর্শ দিয়েছিলে|আগের (প্ল্যান|পরিকল্পনা|কথা)|last (week|time)|remember when|did i (say|tell))/i;
