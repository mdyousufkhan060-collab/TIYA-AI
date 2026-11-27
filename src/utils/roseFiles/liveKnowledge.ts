import { supabase } from '../../lib/supabase';

/**
 * ROSE's two self-updating files (written every 6 hours on the server by the rose-knowledge function):
 *   world_news : today's international news (every ROSE user)
 *   ai_tools   : new AI tools, free / paid, useful for ROSE or not (ROSE admin only; the server hides it from others)
 * ROSE reads them here; they are refreshed in the app every 30 minutes.
 */
type Topic = 'world_news' | 'ai_tools';
const cache: Record<Topic, { text: string; at: string }> = { world_news: { text: '', at: '' }, ai_tools: { text: '', at: '' } };
let loadedAt = 0;
let loading: Promise<void> | null = null;

export function refreshKnowledge(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase.from('rose_knowledge').select('topic,content,updated_at');
      for (const r of (data as Array<{ topic: Topic; content: string; updated_at: string }>) || []) {
        if (r.topic in cache) cache[r.topic] = { text: r.content || '', at: r.updated_at };
      }
      loadedAt = Date.now();
    } catch {
      /* keep what we have */
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function get(t: Topic): { text: string; at: string } {
  if (Date.now() - loadedAt > 30 * 60 * 1000) void refreshKnowledge();
  return cache[t];
}

const NEWS = /news|খবর|সংবাদ|world|বিশ্ব|international|আন্তর্জাতিক|দেশে|বিদেশ|war|যুদ্ধ|election|নির্বাচন|আজকের|today|headline|শিরোনাম|কী হচ্ছে|কি হচ্ছে|what.?s happening/i;
const AI = /ai tool|এআই টুল|এআই|\bai\b|new tool|নতুন টুল|model|মডেল|chatgpt|gemini|claude|openai|google ai|midjourney|elevenlabs|runway|suno|ফ্রি টুল|paid tool/i;

/** The live files ROSE needs for this talk (empty when the talk is about something else). */
export function knowledgeFor(recentText: string, isAdmin: boolean): string {
  const t = recentText || '';
  const parts: string[] = [];
  if (NEWS.test(t)) {
    const n = get('world_news');
    parts.push(
      n.text
        ? `WORLD NEWS FILE (updated ${n.at ? new Date(n.at).toUTCString() : 'recently'}; tell it in simple Bengali, short, neutral, say how fresh it is; for anything newer or not here, say you do not have it yet):\n${n.text}`
        : 'WORLD NEWS FILE: not loaded yet. Say the news is being updated and to ask again in a few minutes.',
    );
  }
  if (isAdmin && AI.test(t)) {
    const a = get('ai_tools');
    parts.push(
      a.text
        ? `AI TOOLS FILE (only for the admin; updated ${a.at ? new Date(a.at).toUTCString() : 'recently'}; give him a clear Bengali summary: what is new, free or paid, and which ones help ROSE / myrosebd.com):\n${a.text}`
        : 'AI TOOLS FILE: not loaded yet. Say it updates every 6 hours and to ask again soon.',
    );
  }
  return parts.length ? `\n\n${parts.join('\n\n')}` : '';
}
