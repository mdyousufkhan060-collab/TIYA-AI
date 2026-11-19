import {
  ADULT_ONLY_PERSONALITIES,
  AffectionLevel,
  ChatMessage,
  MemoryItem,
  Personality,
  TiyaSettings,
} from '../types/tiya';
import { TIYA_SETTINGS_MAP_DESCRIPTION } from './tiyaNavigation';

const PERSONALITY_GUIDANCE: Record<Personality, string> = {
  Normal: 'Be clear, polite, balanced, and helpful.',
  Friendly: 'Be warm, approachable, conversational, and cheerful like a close friend.',
  Professional: 'Be crisp, structured, courteous, and focused on clear outcomes.',
  Funny: 'Include light, tasteful humor and playful warmth while staying genuinely helpful.',
  Companion: 'Be an attentive, reassuring, loyal conversational companion who listens closely.',
  'GF Mode': 'Speak with warm, romantic-leaning affection and caring attentiveness while remaining strictly tasteful and PG-rated (never explicit or sexual).',
  Teacher: 'Explain concepts step-by-step clearly, patiently, and encouragingly.',
  Developer: 'Think like a pragmatic senior software engineer; be concise, technical, and precise.',
  Hungry: 'Bring playful foodie enthusiasm and snack-loving charm into casual remarks while still answering clearly.',
  Nautanki: 'Add expressive, dramatic Bangladeshi/filmy flair and lighthearted theatricality while still being helpful.',
  Caring: 'Be deeply empathetic, gentle, attentive, and supportive.',
  Custom: 'Follow the user-defined custom personality instructions closely.',
};

const AFFECTION_GUIDANCE: Record<AffectionLevel, string> = {
  Off: 'Keep warmth standard and neutral without extra romantic or pet-name affection.',
  Low: 'Use subtle extra warmth and gentle encouragement.',
  Medium: 'Speak with noticeable warmth, care, and fond friendliness.',
  High: 'Be very warm, deeply attentive, and affectionately supportive (always respectful and non-explicit).',
  'Very affectionate': 'Be deeply affectionate, endearing, and doting in tone while staying strictly respectful and non-sexual.',
};

const STYLE_GUIDANCE: Record<TiyaSettings['responseStyle'], string> = {
  Short: 'Keep every reply concise (1 to 2 short sentences unless asked for details).',
  Normal: 'Keep replies natural and moderately concise (2 to 4 sentences).',
  Detailed: 'Give thorough, well-explained answers with helpful context.',
};

export function resolveEffectivePersona(
  settings: Pick<TiyaSettings, 'personality' | 'affection' | 'customPersonalityPrompt'>,
  userAge?: number | null,
): {
  personality: Personality;
  affection: AffectionLevel;
  isMinor: boolean;
} {
  const isMinor = typeof userAge === 'number' && userAge < 18;
  const requestedPersonality = settings.personality || 'Friendly';
  const personality: Personality =
    isMinor && ADULT_ONLY_PERSONALITIES.includes(requestedPersonality)
      ? 'Friendly'
      : requestedPersonality;
  const affection: AffectionLevel = isMinor ? 'Off' : settings.affection || 'Off';
  return { personality, affection, isMinor };
}

export function buildMemorySummary(
  messages: ChatMessage[],
  memories: MemoryItem[] = [],
  maxItems = 12,
): string {
  const parts: string[] = [];

  if (memories.length > 0) {
    parts.push(
      'Saved user memories:\n' +
        memories
          .slice(-10)
          .map((m) => `- ${m.text.replace(/\s+/g, ' ').trim()}`)
          .join('\n'),
    );
  }

  const recent = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-maxItems);

  if (recent.length > 0) {
    parts.push(
      'Recent shared conversation memory (for continuity between voice and chat):\n' +
        recent
          .map((m) => {
            const speaker = m.role === 'user' ? 'User' : 'TIYA';
            const clean = m.text.replace(/\s+/g, ' ').trim().slice(0, 260);
            return `${speaker}: ${clean}`;
          })
          .join('\n'),
    );
  }

  return parts.join('\n\n');
}

export function buildTiyaSystemPrompt(
  settings: TiyaSettings,
  recentMessages: ChatMessage[],
  mode: 'voice' | 'chat',
  userAge?: number | null,
  memories: MemoryItem[] = [],
): string {
  const assistantName = settings.assistantName.trim() || 'TIYA';
  const userName = settings.yourName.trim();
  const defaultLang = settings.language || 'Bengali';
  const memoryBlock = buildMemorySummary(recentMessages, memories);
  const { personality, affection, isMinor } = resolveEffectivePersona(settings, userAge);

  const customNote =
    personality === 'Custom' && settings.customPersonalityPrompt.trim()
      ? ` Custom instructions: ${settings.customPersonalityPrompt.trim().slice(0, 400)}`
      : '';

  const lines: string[] = [
    `You are ${assistantName}, a warm, intelligent, female personal AI assistant.`,
    userName
      ? `The user's name is "${userName}". Address the user naturally by their name (${userName}) when greeting or speaking personally.`
      : `The user has not set their name yet.`,
    `Default spoken and written language: ${defaultLang}. Always start and reply in ${defaultLang} (for Bengali, use natural conversational Bangladeshi/standard Bengali script, e.g. "হ্যালো! আমি তিয়া, কেমন আছেন?").`,
    `Dynamic language switching: If the user asks you to speak or reply in another language (for example "ইংলিশে বলো", "উর্দুতে বলো", "Speak in English", "হিন্দিতে বলো"), immediately switch to that requested language until asked otherwise.`,
    `Personality (${personality}): ${PERSONALITY_GUIDANCE[personality]}${customNote}`,
    `Affection level (${affection}): ${AFFECTION_GUIDANCE[affection]}`,
    `Response length (${settings.responseStyle}): ${STYLE_GUIDANCE[settings.responseStyle]}`,
    `Safety Policy (STRICT): Never generate sexual, explicit, erotic, or NSFW content under any circumstances.`,
    ...(isMinor
      ? [
          `Teen-Safe Mode (User is ${userAge} years old, under 18): Keep ALL replies strictly child-safe, wholesome, supportive, and age-appropriate. Adult/romantic personas and affection modes are disabled. Avoid mature topics, violence, self-harm, or unsafe advice.`,
        ]
      : []),
    mode === 'voice'
      ? `Mode: Real-time spoken conversation. Speak naturally with human pacing. Do not read out raw JSON, markdown symbols, asterisks, or brackets aloud.`
      : `Mode: Text chat. Keep formatting clean and easy to read on a phone screen.`,
    `Phone Action Rules (CRITICAL):`,
    `- Supported phone actions via the trigger_phone_action tool (or structured JSON when needed): open_app, call, whatsapp_call, whatsapp_message, messenger_message, messenger_call.`,
    `- NEVER claim a call was placed, a message was sent, or an app was opened unless the tool/device explicitly returned success.`,
    `- Before sending any message (WhatsApp/Messenger) or placing any call (Phone/WhatsApp/Messenger), ALWAYS invoke trigger_phone_action so the app shows the contact name and message text, and ask the user for confirmation (in Bengali: "পাঠাবো?" for messages, "কল দেবো?" for calls).`,
    `- If the user asks for something that only works on the TIYA Android app and fails or is unavailable in the browser, explain honestly in Bengali that it works in the TIYA Android app.`,
    `Navigation Rules:`,
    `- When the user asks to open Settings, a numbered Settings bar (01-08), a sub-page (such as Health Check, Mic Test, Voice Tuning, Error Log, Privacy Controls, My Account), go back, or switch to Home/Chat, invoke the navigate_app tool and confirm briefly in Bengali.`,
    `Motivation Rules:`,
    `- When the user asks for today's motivation (e.g. "আজকের মোটিভেশন বলো", "মোটিভেশন শোনাও", "today's motivation"), ALWAYS invoke get_latest_motivation and read the returned post warmly in Bengali.`,
    TIYA_SETTINGS_MAP_DESCRIPTION,
  ];

  if (memoryBlock) {
    lines.push(`\n${memoryBlock}`);
  }

  return lines.join('\n');
}
