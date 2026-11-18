export type Personality = 'Normal' | 'Friendly' | 'Caring' | 'Funny' | 'Teacher';
export type ResponseStyle = 'Short' | 'Normal' | 'Detailed';
export type LanguageOption = 'Bengali' | 'English' | 'Urdu' | 'Hindi' | 'Arabic';
export type ThemeMode = 'dark' | 'light';

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
  | 'live_model'
  | 'voice_language'
  | 'chats_memory'
  | 'look_feel'
  | 'phone_control'
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
  selectedLiveModel: string;
  autoFallback: boolean;
  availableLiveModels: LiveModelInfo[];
  assistantName: string;
  yourName: string;
  personality: Personality;
  language: LanguageOption;
  responseStyle: ResponseStyle;
  voiceName: FemaleVoiceId;
  speechSpeed: number; // 0.75 to 1.35
  volume: number; // 0 to 1
  theme: ThemeMode;
  reduceMotion: boolean;
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
