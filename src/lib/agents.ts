/**
 * ROSE team: ROSE + 4 helpers. Tasks are saved in Supabase (agent_tasks) and done by AI
 * using the business data. The live Team panel shows them; results also appear in chat.
 */
import { supabase } from './supabase';
import { loadSettings } from '../utils/storage';
import { getTiyaModeContext } from '../utils/modeContext';

export type AgentId = 'rose' | 'mira' | 'arin' | 'zayan' | 'naira';

export interface AgentInfo {
  id: AgentId;
  name: string;
  nameBn: string;
  role: string;
  color: string;
  skills: string;
}

export const AGENTS: AgentInfo[] = [
  { id: 'rose', name: 'ROSE', nameBn: 'রোজ', role: 'Chief Manager', color: '#FF4D8D', skills: 'Plans the work, gives tasks to the team and reports to the owner.' },
  { id: 'mira', name: 'MIRA', nameBn: 'মিরা', role: 'Customer Communication', color: '#2DD4BF', skills: 'Writes replies to customers, follow-up messages, offers and FAQ answers.' },
  { id: 'arin', name: 'ARIN', nameBn: 'আরিন', role: 'Sales & Orders', color: '#60A5FA', skills: 'Checks orders, prices, stock and sales; prepares order summaries.' },
  { id: 'zayan', name: 'ZAYAN', nameBn: 'জায়ান', role: 'Parcel & Delivery', color: '#FBBF24', skills: 'Plans deliveries, writes delivery notes and tracking updates.' },
  { id: 'naira', name: 'NAIRA', nameBn: 'নাইরা', role: 'Audit & Analytics', color: '#A78BFA', skills: 'Checks accounts, expenses and profit, finds problems, writes reports.' },
];

export const agentById = (id: string) => AGENTS.find((a) => a.id === id) || AGENTS[0];

export interface AgentTask {
  id: string;
  user_id: string;
  agent: AgentId;
  title: string;
  status: 'queued' | 'working' | 'done' | 'failed';
  result: string | null;
  source: string | null;
  email_status: string | null;
  created_at: string;
  updated_at: string;
}

const NAME_RE: Array<[AgentId, RegExp]> = [
  ['mira', /(mira|মিরা|মীরা)/i],
  ['arin', /(arin|আরিন|আরিফ?ন)/i],
  ['zayan', /(zayan|জায়ান|জায়ান|জায়েন|যায়ান)/i],
  ['naira', /(naira|নাইরা|নায়রা|নায়রা)/i],
];

/**
 * "আরিনকে বলো আজকের অর্ডারের হিসাব করতে" / "Ask Arin to check today's orders"
 * Returns the agent and the task text, or null.
 */
export function parseAgentCommand(text: string): { agent: AgentId; task: string } | null {
  const t = text.trim();
  const verb = /(কে|কেও|ke)\s*(বলো|বল|দাও|দিয়ে দাও|দিয়ে দাও|কাজ দাও|জানাও|bolo|dao)|\b(ask|tell|assign)\b/i;
  if (!verb.test(t)) return null;
  for (const [id, re] of NAME_RE) {
    if (re.test(t)) {
      const task = t
        .replace(re, '')
        .replace(/^(রোজ|rose)[,\s]*/i, '')
        .replace(/(কে|কেও|ke)\s*(বলো|বল|দাও|দিয়ে দাও|দিয়ে দাও|কাজ দাও|জানাও|bolo|dao)/i, '')
        .replace(/\b(ask|tell|assign)\b\s*(to)?/i, '')
        .replace(/^\s*(to|যে|যেন)\s+/i, '')
        .trim();
      return { agent: id, task: task || t };
    }
  }
  return null;
}

async function aiReply(agent: AgentInfo, task: string): Promise<string> {
  const settings = loadSettings();
  const key = settings.apiKey?.trim() || '';
  const system = [
    `You are ${agent.name} (${agent.nameBn}), the ${agent.role} on ROSE's business team. ${agent.skills}`,
    'Do the task now and write the finished result, not a plan. Reply in Bengali unless the task is in English.',
    'Use ONLY the business data below for prices, stock, policies; never invent numbers. If data is missing, say exactly what is missing.',
    'Start with a one-line summary, then the details as short points. Keep it under 180 words.',
    getTiyaModeContext(),
  ].join('\n');
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': key },
    body: JSON.stringify({ message: `TASK: ${task}`, history: [], systemInstruction: system }),
  });
  const data = (await res.json()) as { ok?: boolean; text?: string; error?: string; detail?: string };
  if (!res.ok || !data.ok || !data.text?.trim()) {
    throw new Error(data.detail || data.error || 'AI did not answer. Check CONNECTIONS.');
  }
  return data.text.trim();
}

/** Creates the task, lets the agent do it, saves the result. Returns the finished row. */
export async function runAgentTask(userId: string, agentId: AgentId, title: string, source = 'panel'): Promise<AgentTask | null> {
  const agent = agentById(agentId);
  const { data: row, error } = await supabase
    .from('agent_tasks')
    .insert({ user_id: userId, agent: agentId, title: title.slice(0, 500), status: 'working', source })
    .select()
    .single();
  if (error || !row) return null;
  try {
    const result = await aiReply(agent, title);
    const { data: done } = await supabase
      .from('agent_tasks')
      .update({ status: 'done', result, email_status: 'pending' })
      .eq('id', row.id)
      .select()
      .single();
    return (done as AgentTask) || null;
  } catch (e: any) {
    const { data: failed } = await supabase
      .from('agent_tasks')
      .update({ status: 'failed', result: String(e?.message || e).slice(0, 400) })
      .eq('id', row.id)
      .select()
      .single();
    return (failed as AgentTask) || null;
  }
}
