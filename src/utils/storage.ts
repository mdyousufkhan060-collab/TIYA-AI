import {
  ChatMessage,
  DEFAULT_LIVE_MODELS,
  FEMALE_VOICES,
  TiyaSettings,
} from '../types/tiya';

const SETTINGS_STORAGE_KEY = 'tiya_settings_v1';
const CHATS_STORAGE_KEY = 'tiya_chats_v1';

export const DEFAULT_SETTINGS: TiyaSettings = {
  apiKey: '',
  connectionStatus: 'untested',
  connectionMessage: '',
  selectedLiveModel: DEFAULT_LIVE_MODELS[0].id,
  autoFallback: true,
  availableLiveModels: DEFAULT_LIVE_MODELS,
  assistantName: 'TIYA',
  yourName: '',
  personality: 'Friendly',
  language: 'Bengali',
  responseStyle: 'Normal',
  voiceName: FEMALE_VOICES[0].id,
  speechSpeed: 1.0,
  volume: 0.9,
  theme: 'dark',
  reduceMotion: false,
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

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      voiceName: validVoice,
      availableLiveModels: models,
      speechSpeed:
        typeof parsed.speechSpeed === 'number'
          ? Math.min(1.4, Math.max(0.75, parsed.speechSpeed))
          : DEFAULT_SETTINGS.speechSpeed,
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_SETTINGS.volume,
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

export function loadChats(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
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

export function saveChats(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep up to the most recent 200 messages in localStorage
    const trimmed = messages.slice(-200);
    window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearAllChatsStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHATS_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
