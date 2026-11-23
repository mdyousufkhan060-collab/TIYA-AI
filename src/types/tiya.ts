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
export type LanguageOption =
  | 'Bengali'
  | 'English'
  | 'Hindi'
  | 'Urdu'
  | 'Arabic'
  | 'Nepali'
  | 'Tamil'
  | 'Malay'
  | 'Indonesian'
  | 'Turkish'
  | 'Persian'
  | 'Spanish'
  | 'French'
  | 'German'
  | 'Italian'
  | 'Portuguese'
  | 'Russian'
  | 'Chinese'
  | 'Japanese'
  | 'Korean'
  | 'Thai'
  | 'Vietnamese';

export interface LanguageInfo {
  id: LanguageOption;
  /** name written in that language */
  native: string;
  /** BCP-47 code used for the phone's own voice and speech recognition */
  code: string;
}

export const ALL_LANGUAGES: LanguageInfo[] = [
  { id: 'Bengali', native: 'বাংলা', code: 'bn-BD' },
  { id: 'English', native: 'English', code: 'en-US' },
  { id: 'Hindi', native: 'हिन्दी', code: 'hi-IN' },
  { id: 'Urdu', native: 'اردو', code: 'ur-PK' },
  { id: 'Arabic', native: 'العربية', code: 'ar-SA' },
  { id: 'Nepali', native: 'नेपाली', code: 'ne-NP' },
  { id: 'Tamil', native: 'தமிழ்', code: 'ta-IN' },
  { id: 'Malay', native: 'Bahasa Melayu', code: 'ms-MY' },
  { id: 'Indonesian', native: 'Bahasa Indonesia', code: 'id-ID' },
  { id: 'Turkish', native: 'Türkçe', code: 'tr-TR' },
  { id: 'Persian', native: 'فارسی', code: 'fa-IR' },
  { id: 'Spanish', native: 'Español', code: 'es-ES' },
  { id: 'French', native: 'Français', code: 'fr-FR' },
  { id: 'German', native: 'Deutsch', code: 'de-DE' },
  { id: 'Italian', native: 'Italiano', code: 'it-IT' },
  { id: 'Portuguese', native: 'Português', code: 'pt-BR' },
  { id: 'Russian', native: 'Русский', code: 'ru-RU' },
  { id: 'Chinese', native: '中文', code: 'zh-CN' },
  { id: 'Japanese', native: '日本語', code: 'ja-JP' },
  { id: 'Korean', native: '한국어', code: 'ko-KR' },
  { id: 'Thai', native: 'ไทย', code: 'th-TH' },
  { id: 'Vietnamese', native: 'Tiếng Việt', code: 'vi-VN' },
];

export function languageCode(lang?: string): string {
  return ALL_LANGUAGES.find((l) => l.id === lang)?.code || 'bn-BD';
}

export type BengaliDialect =
  | 'Standard'
  | 'Dhaka'
  | 'Chattogram'
  | 'Noakhali'
  | 'Sylhet'
  | 'Rajshahi'
  | 'Khulna'
  | 'Barishal'
  | 'Rangpur'
  | 'Mymensingh';

export interface BengaliDialectInfo {
  id: BengaliDialect;
  label: string;
  native: string;
  /** short guidance for the AI on how this dialect sounds */
  hint: string;
  /** a sample line used for the voice preview */
  sample: string;
}

export const BENGALI_DIALECTS: BengaliDialectInfo[] = [
  { id: 'Standard', label: 'Standard Bangla', native: 'শুদ্ধ বাংলা', hint: 'standard (shuddho/promito) Bangladeshi Bengali', sample: 'হ্যালো, আমি টিয়া। আপনার কণ্ঠ একদম ঠিক আছে।' },
  { id: 'Dhaka', label: 'Dhaka', native: 'ঢাকাইয়া', hint: 'Old Dhaka (Dhakaiya/Kutti) dialect, e.g. "কিবা আছেন?", "হাছা কইতাছি", "কইবার লাগছি"', sample: 'আমি টিয়া, আপনের কণ্ঠ এক্কেরে ঠিক আছে, বুঝছেন নি?' },
  { id: 'Chattogram', label: 'Chattogram', native: 'চাটগাঁইয়া', hint: 'Chittagonian (Chatgaiya) dialect, e.g. "কেন আছন?", "গম আছি", "ন জানি", "অনেরে"', sample: 'আঁই টিয়া, অনর গলার আবাজ এক্কেবারে গম আছে।' },
  { id: 'Noakhali', label: 'Noakhali', native: 'নোয়াখাইল্লা', hint: 'Noakhali dialect, e.g. "কিয়া করেন?", "হেতে", "আঁই", "কইচ্ছি", "বেজ্ঞুন"', sample: 'আঁই টিয়া, আন্নের গলা এক্কেরে ঠিক আছে।' },
  { id: 'Sylhet', label: 'Sylhet', native: 'সিলেটি', hint: 'Sylheti dialect, e.g. "কিতা খবর?", "বালা আছি", "কিতা কররায়?", "আফনে"', sample: 'আমি টিয়া, আফনার আওয়াজ একদম বালা আছে।' },
  { id: 'Rajshahi', label: 'Rajshahi', native: 'রাজশাহীর ভাষা', hint: 'Rajshahi (Barind) dialect, e.g. "কী করছিস গো?", "হামি", "যাছি", "খাছি"', sample: 'হামি টিয়া, তোমার গলা এক্কেবারে ঠিক আছে গো।' },
  { id: 'Khulna', label: 'Khulna', native: 'খুলনার ভাষা', hint: 'Khulna/Jessore dialect, e.g. "কী কত্তিছ?", "যাতিছি", "খাতিছি", "কতিছি"', sample: 'আমি টিয়া, তুমার গলা একদম ঠিক আছে, কতিছি।' },
  { id: 'Barishal', label: 'Barishal', native: 'বরিশাইল্লা', hint: 'Barishal dialect, e.g. "কেমন আছো গো?", "হেয়া", "মুই", "করছ্যা", "যাইবা"', sample: 'মুই টিয়া, তোমার গলা এক্কেরে ঠিক আছে।' },
  { id: 'Rangpur', label: 'Rangpur', native: 'রংপুরিয়া', hint: 'Rangpuri dialect, e.g. "কেমন আছেন বাহে?", "মুই", "কোনটে", "কাইল", "বাহে"', sample: 'মুই টিয়া বাহে, তোমার গলা একদম ঠিক আছে।' },
  { id: 'Mymensingh', label: 'Mymensingh', native: 'ময়মনসিংহের ভাষা', hint: 'Mymensingh dialect, e.g. "কিতা করুইন?", "আমরার", "যাইতাছি", "হুনছুইন?"', sample: 'আমি টিয়া, আফনের গলা এক্কেরে ঠিক আছে, হুনছুইন?' },
];

/** The assistant's name is fixed and cannot be changed by users. */
export const TIYA_FIXED_NAME = 'TIYA';
export type ThemeMode = 'dark' | 'light';
export type OrbStyle = 'Classic' | 'Pulse' | 'Wave';

export type FemaleVoiceId =
  | 'Zephyr'
  | 'Leda'
  | 'Kore'
  | 'Aoede'
  | 'Callirrhoe'
  | 'Autonoe'
  | 'Despina'
  | 'Erinome'
  | 'Laomedeia'
  | 'Achernar'
  | 'Gacrux'
  | 'Pulcherrima'
  | 'Vindemiatrix'
  | 'Sulafat';

export interface FemaleVoiceInfo {
  id: FemaleVoiceId;
  label: string;
  tone: string;
}

/** Google's female voices. Every voice can speak every language. */
export const FEMALE_VOICES: FemaleVoiceInfo[] = [
  { id: 'Zephyr', label: 'Zephyr', tone: 'Bright (Default)' },
  { id: 'Leda', label: 'Leda', tone: 'Youthful' },
  { id: 'Kore', label: 'Kore', tone: 'Firm, clear' },
  { id: 'Aoede', label: 'Aoede', tone: 'Breezy' },
  { id: 'Callirrhoe', label: 'Callirrhoe', tone: 'Easy-going' },
  { id: 'Autonoe', label: 'Autonoe', tone: 'Bright, lively' },
  { id: 'Despina', label: 'Despina', tone: 'Smooth' },
  { id: 'Erinome', label: 'Erinome', tone: 'Clear' },
  { id: 'Laomedeia', label: 'Laomedeia', tone: 'Upbeat' },
  { id: 'Achernar', label: 'Achernar', tone: 'Soft' },
  { id: 'Gacrux', label: 'Gacrux', tone: 'Mature' },
  { id: 'Pulcherrima', label: 'Pulcherrima', tone: 'Forward' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix', tone: 'Gentle' },
  { id: 'Sulafat', label: 'Sulafat', tone: 'Warm' },
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
  /** real database column (blocked is kept for older code) */
  is_blocked?: boolean | null;
  premium_voice_left?: number | null;
  premium_text_left?: number | null;
  admin_note: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  account_mode?: 'personal' | 'student' | 'business' | null;
  date_of_birth?: string | null;
  onboarding_done?: boolean | null;
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
  /** only used when language is Bengali */
  bengaliDialect: BengaliDialect;
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
