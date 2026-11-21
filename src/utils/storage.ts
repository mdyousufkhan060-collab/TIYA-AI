import {
  AFFECTION_LEVELS,
  ALL_PERSONALITIES,
  ALL_LANGUAGES,
  BENGALI_DIALECTS,
  TIYA_FIXED_NAME,
  ChatMessage,
  DEFAULT_LIVE_MODELS,
  ErrorLogEntry,
  FEMALE_VOICES,
  MemoryItem,
  MicListeningSettings,
  TiyaSettings,
} from '../types/tiya';
import {
  DEFAULT_PUBLIC_CHARACTER_ID,
  sanitizePublicCharacterId,
} from './characters';

const SETTINGS_STORAGE_KEY = 'tiya_settings_v1';
const CHATS_STORAGE_KEY = 'tiya_chats_v1';
const ADMIN_CHATS_STORAGE_PREFIX = 'tiya_admin_chats_v1';
const MEMORIES_STORAGE_KEY = 'tiya_memories_v1';
const ADMIN_MEMORIES_STORAGE_PREFIX = 'tiya_admin_memories_v1';
const ERROR_LOG_STORAGE_KEY = 'tiya_error_log_v1';

export interface StorageAccountScope {
  userId?: string | null;
  isVerifiedAdmin?: boolean;
}

function resolveChatsStorageKey(scope?: StorageAccountScope): string {
  const uid = String(scope?.userId || '').trim();
  if (!uid) return CHATS_STORAGE_KEY;
  return scope?.isVerifiedAdmin
    ? `${ADMIN_CHATS_STORAGE_PREFIX}:${uid}`
    : `${CHATS_STORAGE_KEY}:${uid}`;
}

function resolveMemoriesStorageKey(scope?: StorageAccountScope): string {
  const uid = String(scope?.userId || '').trim();
  if (!uid) return MEMORIES_STORAGE_KEY;
  return scope?.isVerifiedAdmin
    ? `${ADMIN_MEMORIES_STORAGE_PREFIX}:${uid}`
    : `${MEMORIES_STORAGE_KEY}:${uid}`;
}

export const DEFAULT_MIC_LISTENING: MicListeningSettings = {
  sensitivity: 1.0,
  backgroundCall: false,
  floatingCall: false,
  listenOnOpen: false,
  alwaysListening: false,
  smartListening: true,
  nativeMic: false,
  voiceDebug: false,
};

export const DEFAULT_SETTINGS: TiyaSettings = {
  apiKey: '',
  connectionStatus: 'untested',
  connectionMessage: '',
  providerConnections: {
    groq: { apiKey: '', status: 'untested', message: '' },
    openrouter: { apiKey: '', status: 'untested', message: '' },
    github: { apiKey: '', status: 'untested', message: '' },
    openai: { apiKey: '', status: 'untested', message: '' },
  },
  selectedLiveModel: DEFAULT_LIVE_MODELS[0].id,
  customLiveModel: '',
  autoFallback: true,
  availableLiveModels: DEFAULT_LIVE_MODELS,
  chatModelOverride: '',
  availableChatModels: [],
  ttsModel: 'gemini-3.8-flash-lite-tts',
  voiceModel: 'gemini-live-native',
  assistantName: 'TIYA',
  yourName: '',
  selectedCharacterId: DEFAULT_PUBLIC_CHARACTER_ID,
  personality: 'Friendly',
  customPersonalityPrompt: '',
  affection: 'Off',
  language: 'Bengali',
  bengaliDialect: 'Standard',
  responseStyle: 'Normal',
  voiceName: FEMALE_VOICES[0].id,
  speechSpeed: 1.0,
  volume: 0.9,
  pitch: 1.0,
  micListening: DEFAULT_MIC_LISTENING,
  theme: 'dark',
  orbStyle: 'Classic',
  reduceMotion: false,
  tiyaAlive: true,
  approximateLocation: false,
};

export function loadSettings(): TiyaSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TiyaSettings>;
    const validVoice = FEMALE_VOICES.some((v) => v.id === parsed.voiceName)
      ? parsed.voiceName!
      : DEFAULT_SETTINGS.voiceName;
    const models =
      Array.isArray(parsed.availableLiveModels) && parsed.availableLiveModels.length > 0
        ? parsed.availableLiveModels
        : DEFAULT_LIVE_MODELS;
    const validPersonality = ALL_PERSONALITIES.includes(parsed.personality as TiyaSettings['personality'])
      ? parsed.personality!
      : DEFAULT_SETTINGS.personality;
    const validAffection = AFFECTION_LEVELS.includes(parsed.affection as TiyaSettings['affection'])
      ? parsed.affection!
      : DEFAULT_SETTINGS.affection;
    const validOrbStyle =
      parsed.orbStyle === 'Classic' || parsed.orbStyle === 'Pulse' || parsed.orbStyle === 'Wave'
        ? parsed.orbStyle
        : DEFAULT_SETTINGS.orbStyle;

    const validLanguage = ALL_LANGUAGES.some((l) => l.id === parsed.language)
      ? parsed.language!
      : DEFAULT_SETTINGS.language;
    const validStyle =
      parsed.responseStyle === 'Short' || parsed.responseStyle === 'Normal' || parsed.responseStyle === 'Detailed'
        ? parsed.responseStyle
        : DEFAULT_SETTINGS.responseStyle;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      assistantName: TIYA_FIXED_NAME,
      language: validLanguage,
      bengaliDialect: BENGALI_DIALECTS.some((d) => d.id === parsed.bengaliDialect)
        ? parsed.bengaliDialect!
        : 'Standard',
      responseStyle: validStyle,
      voiceName: validVoice,
      selectedCharacterId: sanitizePublicCharacterId(parsed.selectedCharacterId),
      personality: validPersonality,
      affection: validAffection,
      orbStyle: validOrbStyle,
      availableLiveModels: models,
      availableChatModels: Array.isArray(parsed.availableChatModels)
        ? parsed.availableChatModels
        : DEFAULT_SETTINGS.availableChatModels,
      providerConnections: {
        groq: { ...DEFAULT_SETTINGS.providerConnections.groq, ...parsed.providerConnections?.groq },
        openrouter: {
          ...DEFAULT_SETTINGS.providerConnections.openrouter,
          ...parsed.providerConnections?.openrouter,
        },
        github: {
          ...DEFAULT_SETTINGS.providerConnections.github,
          ...parsed.providerConnections?.github,
        },
        openai: {
          ...DEFAULT_SETTINGS.providerConnections.openai,
          ...parsed.providerConnections?.openai,
        },
      },
      micListening: {
        ...DEFAULT_MIC_LISTENING,
        ...parsed.micListening,
        sensitivity:
          typeof parsed.micListening?.sensitivity === 'number'
            ? Math.min(2.0, Math.max(0.25, parsed.micListening.sensitivity))
            : DEFAULT_MIC_LISTENING.sensitivity,
      },
      speechSpeed:
        typeof parsed.speechSpeed === 'number'
          ? Math.min(1.4, Math.max(0.75, parsed.speechSpeed))
          : DEFAULT_SETTINGS.speechSpeed,
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_SETTINGS.volume,
      pitch:
        typeof parsed.pitch === 'number'
          ? Math.min(1.25, Math.max(0.75, parsed.pitch))
          : DEFAULT_SETTINGS.pitch,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: TiyaSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadChats(scope?: StorageAccountScope): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = resolveChatsStorageKey(scope);
    let raw = window.localStorage.getItem(key);
    // One-time read fallback from legacy un-scoped storage for existing accounts
    // (only when scoped key is empty and caller is the verified Admin or un-scoped)
    if (!raw && scope?.userId && !scope.isVerifiedAdmin) {
      raw = null;
    } else if (!raw && scope?.isVerifiedAdmin) {
      raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatMessage =>
        Boolean(item) && typeof item.id === 'string' && typeof item.text === 'string',
    );
  } catch {
    return [];
  }
}

export function saveChats(messages: ChatMessage[], scope?: StorageAccountScope): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep up to the most recent 200 messages in localStorage
    const trimmed = messages.slice(-200);
    window.localStorage.setItem(resolveChatsStorageKey(scope), JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearAllChatsStorage(scope?: StorageAccountScope): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(resolveChatsStorageKey(scope));
    if (!scope?.userId) {
      window.localStorage.removeItem(CHATS_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  dateLabel: string;
  timestamp: number;
  messageCount: number;
  messageIds: string[];
}

export function groupMessagesIntoChatSessions(
  messages: ChatMessage[],
  gapMs = 2 * 60 * 60 * 1000,
): ChatSessionSummary[] {
  if (messages.length === 0) return [];
  const sessions: ChatMessage[][] = [];
  let current: ChatMessage[] = [];

  for (const msg of messages) {
    if (current.length === 0) {
      current.push(msg);
      continue;
    }
    const prev = current[current.length - 1];
    const prevDay = new Date(prev.timestamp).toDateString();
    const curDay = new Date(msg.timestamp).toDateString();
    if (prevDay !== curDay || msg.timestamp - prev.timestamp > gapMs) {
      sessions.push(current);
      current = [msg];
    } else {
      current.push(msg);
    }
  }
  if (current.length > 0) sessions.push(current);

  return sessions
    .map((group) => {
      const firstUser = group.find((m) => m.role === 'user');
      const firstMsg = group[0];
      const rawTitle = (firstUser?.text || firstMsg.text || 'Conversation').replace(/\s+/g, ' ').trim();
      const title = rawTitle.length > 42 ? `${rawTitle.slice(0, 42)}…` : rawTitle;
      const ts = group[group.length - 1].timestamp;
      return {
        id: firstMsg.id,
        title: title || 'Conversation',
        dateLabel: new Date(ts).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        timestamp: ts,
        messageCount: group.length,
        messageIds: group.map((m) => m.id),
      };
    })
    .reverse();
}

export function loadMemories(scope?: StorageAccountScope): MemoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = resolveMemoriesStorageKey(scope);
    let raw = window.localStorage.getItem(key);
    // Preserve legacy saved memories for verified Admin while strictly isolating ordinary users
    if (!raw && scope?.isVerifiedAdmin) {
      raw = window.localStorage.getItem(MEMORIES_STORAGE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const expectedScope = scope?.isVerifiedAdmin ? 'admin' : scope?.userId ? 'user' : null;
    return parsed
      .filter(
        (m): m is MemoryItem =>
          Boolean(m) && typeof m.id === 'string' && typeof m.text === 'string',
      )
      .filter((m) => {
        if (expectedScope === 'user' && m.scope === 'admin') return false;
        if (expectedScope === 'admin' && m.scope === 'user') return false;
        return true;
      });
  } catch {
    return [];
  }
}

export function saveMemories(memories: MemoryItem[], scope?: StorageAccountScope): void {
  if (typeof window === 'undefined') return;
  try {
    const expectedScope = scope?.isVerifiedAdmin ? 'admin' : scope?.userId ? 'user' : undefined;
    const normalized = memories.slice(-100).map((m) =>
      expectedScope ? { ...m, scope: expectedScope as MemoryItem['scope'] } : m,
    );
    window.localStorage.setItem(resolveMemoriesStorageKey(scope), JSON.stringify(normalized));
  } catch {
    // Ignore
  }
}

export function loadErrorLog(): ErrorLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ERROR_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ErrorLogEntry =>
        Boolean(e) && typeof e.id === 'string' && typeof e.label === 'string',
    );
  } catch {
    return [];
  }
}

export function appendErrorLog(
  source: ErrorLogEntry['source'],
  label: string,
  detail: string,
): ErrorLogEntry[] {
  const existing = loadErrorLog();
  const nextEntry: ErrorLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    source,
    label,
    detail,
  };
  const next = [nextEntry, ...existing].slice(0, 60);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ERROR_LOG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  }
  return next;
}

export function clearErrorLog(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ERROR_LOG_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
