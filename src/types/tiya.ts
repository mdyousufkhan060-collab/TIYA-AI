export type Personality =
  | 'Normal'
  | 'Friendly'
  | 'Professional'
  | 'Funny'
  | 'Companion'
  | 'GF Mode'
  | 'Teacher'
  | 'Developer'
  | 'Hungry'
  | 'Nautanki'
  | 'Caring'
  | 'Custom';

export type AffectionLevel = 'Off' | 'Low' | 'Medium' | 'High' | 'Very affectionate';

export type ResponseStyle = 'Short' | 'Normal' | 'Detailed';
export type LanguageOption = 'Bengali' | 'English' | 'Urdu' | 'Hindi' | 'Arabic';
export type ThemeMode = 'dark' | 'light';
export type OrbStyle = 'Classic' | 'Pulse' | 'Wave';

export type FemaleVoiceId = 'Zephyr' | 'Kore' | 'Aoede' | 'Leda';

export interface FemaleVoiceInfo {
  id: FemaleVoiceId;
  label: string;
  tone: string;
}

export const FEMALE_VOICES: FemaleVoiceInfo[] = [
  { id: 'Zephyr', label: 'Zephyr', tone: 'Youthful, bright female (Default)' },
  { id: 'Leda', label: 'Leda', tone: 'Youthful, warm & friendly female' },
  { id: 'Kore', label: 'Kore', tone: 'Calm, gentle female' },
  { id: 'Aoede', label: 'Aoede', tone: 'Melodic, expressive female' },
];

export const ALL_PERSONALITIES: Personality[] = [
  'Normal',
  'Friendly',
  'Professional',
  'Funny',
  'Companion',
  'GF Mode',
  'Teacher',
  'Developer',
  'Hungry',
  'Nautanki',
  'Caring',
  'Custom',
];

export const AFFECTION_LEVELS: AffectionLevel[] = [
  'Off',
  'Low',
  'Medium',
  'High',
  'Very affectionate',
];

export const ADULT_ONLY_PERSONALITIES: Personality[] = ['GF Mode', 'Companion'];

export const TTS_MODELS: Array<{ id: string; label: string }> = [
  { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite TTS' },
  { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS' },
  { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS' },
];

export interface LiveModelInfo {
  id: string;
  displayName: string;
  description: string;
  isDefault?: boolean;
}

export const DEFAULT_LIVE_MODELS: LiveModelInfo[] = [
  {
    id: 'gemini-3.8-live',
    displayName: 'Gemini 3.8 Live',
    description: 'Fast real-time native audio conversation model',
    isDefault: true,
  },
  {
    id: 'gemini-3.8-live-extended-thinking',
    displayName: 'Gemini 3.8 Live Extended Thinking',
    description: 'Real-time voice with deeper reasoning and async tool calls',
  },
];

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'github' | 'openai';

export interface ProviderConnection {
  apiKey: string;
  status: ConnectionStatus;
  message: string;
}

export interface MicListeningSettings {
  sensitivity: number; // 0.25 to 2.0
  backgroundCall: boolean;
  floatingCall: boolean;
  listenOnOpen: boolean;
  alwaysListening: boolean;
  smartListening: boolean;
  nativeMic: boolean;
  voiceDebug: boolean;
}

export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  source: 'voice' | 'chat' | 'connections' | 'system';
  label: string;
  detail: string;
}

export type PhoneAction =
  | { action: 'open_app'; app: string }
  | { action: 'call'; contact: string }
  | { action: 'whatsapp_call'; contact: string }
  | { action: 'whatsapp_message'; contact: string; text: string }
  | { action: 'messenger_message'; contact: string; text: string }
  | { action: 'messenger_call'; contact: string };

export type ActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'failed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  source: 'voice' | 'chat';
  pendingAction?: PhoneAction;
  actionStatus?: ActionStatus;
  actionNote?: string;
}

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type ConnectionStatus = 'untested' | 'testing' | 'ready' | 'error';

export type MainTab = 'home' | 'chat' | 'settings';

export type SettingsPageId =
  | 'hub'
  | 'about'
  | 'connections'
  | 'voice_language'
  | 'phone_control'
  | 'chats_memory'
  | 'premium'
  | 'privacy_controls'
  | 'my_account';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  plan: string | null;
  paid_until: string | null;
  daily_limit: number | null;
  used_today: number | null;
  blocked: boolean | null;
  admin_note: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
}

export interface NotificationItem {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface MotivationPost {
  id: string;
  title: string | null;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total: number;
  premium: number;
  blocked: number;
  new_today: number;
  active_today: number;
  adults: number;
  teens: number;
  age_unknown: number;
}

export interface TiyaSettings {
  apiKey: string;
  connectionStatus: ConnectionStatus;
  connectionMessage: string;
  providerConnections: Record<Exclude<ProviderId, 'gemini'>, ProviderConnection>;
  selectedLiveModel: string;
  customLiveModel: string;
  autoFallback: boolean;
  availableLiveModels: LiveModelInfo[];
  chatModelOverride: string;
  availableChatModels: LiveModelInfo[];
  ttsModel: string;
  voiceModel: string;
  assistantName: string;
  yourName: string;
  personality: Personality;
  customPersonalityPrompt: string;
  affection: AffectionLevel;
  language: LanguageOption;
  responseStyle: ResponseStyle;
  voiceName: FemaleVoiceId;
  speechSpeed: number; // 0.75 to 1.35
  volume: number; // 0 to 1
  pitch: number; // 0.75 to 1.25
  micListening: MicListeningSettings;
  theme: ThemeMode;
  orbStyle: OrbStyle;
  reduceMotion: boolean;
  tiyaAlive: boolean;
  approximateLocation: boolean;
}

export interface TiyaNativeResult {
  success: boolean;
  message?: string;
}

export interface TiyaNativeBridge {
  run: (actionJson: string) => Promise<string | TiyaNativeResult> | string | TiyaNativeResult;
}

declare global {
  interface Window {
    TiyaNative?: TiyaNativeBridge;
  }
}
