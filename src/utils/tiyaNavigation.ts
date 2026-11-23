import { MainTab, SettingsPageId } from '../types/tiya';

export type NavigationCommand =
  | { type: 'back'; confirmBn: string }
  | {
      type: 'open';
      tab: MainTab;
      page?: SettingsPageId;
      subpage?: string | null;
      confirmBn: string;
    };

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d] || d);
}

const NUMBERED_PAGES: Record<number, { page: SettingsPageId; title: string }> = {
  1: { page: 'about', title: '01 ABOUT & GUIDE' },
  2: { page: 'connections', title: '02 CONNECTIONS' },
  3: { page: 'voice_language', title: '03 VOICE & LANGUAGE' },
  4: { page: 'phone_control', title: '04 PHONE CONTROL' },
  5: { page: 'chats_memory', title: '05 CHATS & MEMORY' },
  6: { page: 'premium', title: '06 PREMIUM' },
};

const HAS_ACTION_HINT =
  /(খোলো|খুলো|খোল|যাও|দাও|দেখাও|চলো|অন করো|open|go to|show|navigate|kholo|jao|dekhao|cholo)/i;

const KEYWORD_ROUTES: Array<{
  patterns: RegExp[];
  requireActionHint?: boolean;
  command: NavigationCommand;
}> = [
  // Back / Home / Chat
  {
    patterns: [/(পিছনে যাও|পিছনে|ব্যাক করো|ব্যাক যাও|আগের পেজে|go back|back page)/i],
    command: { type: 'back', confirmBn: 'আগের পেজে ফিরে এসেছি।' },
  },
  {
    patterns: [/(হোমে যাও|হোম খোলো|হোম স্ক্রিন|go home|open home)/i, /^(হোম|home)$/i],
    command: { type: 'open', tab: 'home', confirmBn: 'হোম স্ক্রিন খোলা হয়েছে।' },
  },
  {
    patterns: [/(চ্যাটে যাও|চ্যাট খোলো|চ্যাট স্ক্রিন|open chat|go to chat)/i],
    command: { type: 'open', tab: 'chat', confirmBn: 'চ্যাট স্ক্রিন খোলা হয়েছে।' },
  },

  // 01 ABOUT & GUIDE rows
  {
    patterns: [/(হেলথ চেক|health check)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: 'health_check',
      confirmBn: 'Health Check খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(অ্যাপ ইনফো|অ্যাবাউট তিয়া|অ্যাবাউট তিয়া|app info|about tiya)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: 'app_info',
      confirmBn: 'About TIYA খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ডেভেলপার ইনফো|ডেভেলপার|developer info|developer)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: 'app_info',
      confirmBn: 'About TIYA খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(হাউ টু ইউজ|কিভাবে ব্যবহার|how to use)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: 'how_to_use',
      confirmBn: 'How to Use খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(হেল্প অ্যান্ড কন্টাক্ট|হেল্প ও কন্টাক্ট|কন্টাক্ট অ্যান্ড হেল্প|help & contact|help and contact|contact & help)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: 'app_info',
      confirmBn: 'About TIYA খোলা হয়েছে।',
    },
  },

  // 02 CONNECTIONS rows
  {
    patterns: [/(জেমিনি কি|জেমিনি কানেকশন|জেমিনি এপিআই|gemini key|gemini connection)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'connections',
      subpage: 'gemini',
      confirmBn: 'Gemini Key পেজ খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(গ্রোক কি|গ্রোক কানেকশন|গ্রোক এপিআই|groq key|groq connection|groq)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'connections',
      subpage: 'groq',
      confirmBn: 'Groq Key পেজ খোলা হয়েছে।',
    },
  },

  // 03 VOICE & LANGUAGE rows (specific subpages before parent)
  {
    patterns: [/(মাইক টেস্ট|mic test)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'mic_test',
      confirmBn: 'Mic Test খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(মাইক সেন্সিটিভিটি|সেন্সিটিভিটি|mic sensitivity|sensitivity)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'mic_sensitivity',
      confirmBn: 'Mic Sensitivity খোলা হয়েছে।',
    },
  },
  {
    patterns: [
      /(মাইক অ্যান্ড লিসেনিং|মাইক লিসেনিং|মাইক সেটিং|ব্যাকগ্রাউন্ড কল|mic and listening|mic & listening|listening settings|background call)/i,
    ],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'mic_listening',
      confirmBn: 'Mic & Listening খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(চ্যাট মডেল ওভাররাইড|চ্যাট মডেল|chat model override|chat model)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'chat_model_override',
      confirmBn: 'Chat Model Override খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(কাস্টম মডেল|custom model)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'custom_model',
      confirmBn: 'Custom Model খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(লাইভ ভয়েস মডেল|লাইভ ভয়েস মডেল|ভয়েস মডেল|ভয়েস মডেল|লাইভ মডেল|live voice model|voice model|live model)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'voice_model',
      confirmBn: 'Voice Model খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(অ্যাসিস্ট্যান্ট নেম|অ্যাসিস্ট্যান্ট নাম|assistant name)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'assistant_name',
      confirmBn: 'Assistant Name খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ইয়োর নেম|ইওর নেম|আমার নাম সেটিং|your name)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'your_name',
      confirmBn: 'Your Name খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(পার্সোনালিটি|পারসোনালিটি|ক্যারেক্টার|personality|character)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'personality',
      confirmBn: 'Personality খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(রেসপন্স স্টাইল|উত্তরের ধরন|response style)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'response_style',
      confirmBn: 'Response Style খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(স্পিচ স্পিড|ভয়েস স্পিড|ভয়েস স্পিড|স্পিড সেটিং|speech speed|voice speed)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'speech_speed',
      confirmBn: 'Speech Speed খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ভলিউম|volume)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'volume',
      confirmBn: 'Volume খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ল্যাঙ্গুয়েজ সেটিং|ল্যাঙ্গুয়েজ সেটিং|ভাষা সেটিং|ল্যাঙ্গুয়েজ|ল্যাঙ্গুয়েজ|language setting|language)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'language',
      confirmBn: 'Language খোলা হয়েছে।',
    },
  },

  // 03 VOICE & LANGUAGE parent (match "ভয়েস সেটিং খোলো" before generic "ভয়েস খোলো")
  {
    patterns: [
      /(ভয়েস সেটিং|ভয়েস সেটিং|ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ|ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ|ভয়েস ও ভাষা|ভয়েস এবং ল্যাঙ্গুয়েজ|voice setting|voice and language|voice & language)/i,
    ],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: null,
      confirmBn: '03 Voice & Language খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ভয়েস প্রিভিউ|ভয়েস প্রিভিউ|ভয়েস অপশন|ভয়েস লিস্ট|ভয়েস|ভয়েস|voice preview|voice list|voice)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'voice',
      confirmBn: 'Voice অপশন খোলা হয়েছে।',
    },
  },

  // 04 PHONE CONTROL & Quick Actions
  {
    patterns: [/(কুইক অ্যাকশন|quick actions|quick action)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'phone_control',
      subpage: 'quick_actions',
      confirmBn: 'Quick Actions খোলা হয়েছে।',
    },
  },
  {
    patterns: [
      /(ফোন কন্ট্রোল|ফোন পারমিশন|অ্যাপ পারমিশন|পারমিশন|phone control|app permissions|permissions)/i,
    ],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'phone_control',
      subpage: null,
      confirmBn: '04 Phone Control খোলা হয়েছে।',
    },
  },

  // PRIVACY CONTROLS rows
  {
    patterns: [/(মাইক্রোফোন পারমিশন|microphone permission)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'mic_permission',
      confirmBn: 'Microphone Permission খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(তিয়ার মেমোরি|তিয়ার মেমোরি|tiya's memory|tiya memory)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'tiya_memory',
      confirmBn: "TIYA's Memory খোলা হয়েছে।",
    },
  },
  {
    patterns: [/(স্টোরড ইনফো|stored info)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'stored_info',
      confirmBn: 'Stored Info খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(এপিআই কি সিকিউরিটি|api key security)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'api_key_security',
      confirmBn: 'API Key Security খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(প্রাইভেসি পলিসি|privacy policy|policy & terms)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'policy_terms',
      confirmBn: 'Privacy Policy & Terms খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(অ্যাকাউন্ট ডিলিট|ডাটা ডিলিট|account & data delete|delete account)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: 'account_delete',
      confirmBn: 'Account & Data Delete খোলা হয়েছে।',
    },
  },

  // Main Settings Pages
  {
    patterns: [/(কানেকশন|connections|api key settings|এপিআই কি)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'connections',
      subpage: null,
      confirmBn: '02 Connections খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(চ্যাটস অ্যান্ড মেমোরি|চ্যাট অ্যান্ড মেমোরি|চ্যাট ও মেমোরি|chats & memory|chats and memory|সেভড চ্যাট|চ্যাট হিস্ট্রি|chat history)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'chats_memory',
      subpage: null,
      confirmBn: '05 Chats & Memory খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(প্রিমিয়াম|প্রিমিয়াম|প্ল্যান স্ট্যাটাস|premium|my plan)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'premium',
      subpage: null,
      confirmBn: '06 Premium খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(প্রাইভেসি কন্ট্রোল|privacy controls|প্রাইভেসি সেটিং)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'privacy_controls',
      subpage: null,
      confirmBn: 'Privacy Controls খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(ওয়ার্কস্পেস|workspace|বিজনেস প্রোফাইল|business profile|আমার নোট|study notes|টাস্ক লিস্ট|অর্ডার লিস্ট)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'workspace',
      subpage: null,
      confirmBn: '07 Workspace খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(মাই অ্যাকাউন্ট|my account|অ্যাকাউন্ট পেজ|অ্যাকাউন্ট)/i],
    requireActionHint: true,
    command: {
      type: 'open',
      tab: 'settings',
      page: 'my_account',
      subpage: null,
      confirmBn: 'My Account খোলা হয়েছে।',
    },
  },
  {
    patterns: [/(অ্যাবাউট অ্যান্ড গাইড|about & guide|about and guide|গাইড খোলো)/i],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'about',
      subpage: null,
      confirmBn: '01 About & Guide খোলা হয়েছে।',
    },
  },
  {
    patterns: [
      /(সেটিংস খোলো|সেটিং খোলো|সেটিংস এ যাও|সেটিংসে যাও|সেটিং এ যাও|সেটিংসে নিয়ে যাও|open settings|go to settings|settings kholo)/i,
    ],
    command: {
      type: 'open',
      tab: 'settings',
      page: 'hub',
      subpage: null,
      confirmBn: 'সেটিংস খোলা হয়েছে।',
    },
  },
];

export function parseNavigationCommand(rawText: string): NavigationCommand | null {
  const normalized = normalizeDigits(rawText).trim();
  if (!normalized || normalized.length > 90) return null;

  // Match explicit numbered settings bars (01 to 06): "3 নম্বর খোলো", "open number 4", "06 kholo"
  const numMatch =
    normalized.match(/(?:^|\s)(?:0?([1-6]))\s*(?:নম্বর|নাম্বার|number|no\.?)(?:\s|$)/i) ||
    normalized.match(/(?:open|খোলো|খুলো|খোল|যাও|show)\s*(?:number|নম্বর|নাম্বার)?\s*0?([1-6])(?:\s|$)/i);

  if (numMatch && numMatch[1]) {
    const num = Number(numMatch[1]);
    const target = NUMBERED_PAGES[num];
    if (target) {
      return {
        type: 'open',
        tab: 'settings',
        page: target.page,
        subpage: null,
        confirmBn: `${num} নম্বর (${target.title}) খোলা হয়েছে।`,
      };
    }
  }

  for (const route of KEYWORD_ROUTES) {
    const matched = route.patterns.some((re) => re.test(normalized));
    if (!matched) continue;
    if (route.requireActionHint && !HAS_ACTION_HINT.test(normalized)) {
      continue;
    }
    return route.command;
  }

  return null;
}

export function validateNavigateToolArgs(args: unknown): NavigationCommand | null {
  if (!args || typeof args !== 'object') return null;
  const obj = args as Record<string, unknown>;
  const action = typeof obj.action === 'string' ? obj.action.toLowerCase() : 'open';

  if (action === 'back') {
    return { type: 'back', confirmBn: 'আগের পেজে ফিরে এসেছি।' };
  }

  const tab = obj.tab;
  if (tab === 'home') {
    return { type: 'open', tab: 'home', confirmBn: 'হোম স্ক্রিন খোলা হয়েছে।' };
  }
  if (tab === 'chat') {
    return { type: 'open', tab: 'chat', confirmBn: 'চ্যাট স্ক্রিন খোলা হয়েছে।' };
  }

  const subpageRaw =
    typeof obj.subpage === 'string' && obj.subpage.trim() ? obj.subpage.trim() : null;

  // Redirect legacy live_model tool calls into 03 VOICE & LANGUAGE > VOICE MODEL
  if (obj.page === 'live_model') {
    return {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: subpageRaw || 'voice_model',
      confirmBn: 'Voice Model খোলা হয়েছে।',
    };
  }

  const validPages: SettingsPageId[] = [
    'hub',
    'about',
    'connections',
    'voice_language',
    'phone_control',
    'chats_memory',
    'premium',
    'privacy_controls',
    'my_account',
    'workspace',
  ];

  const page = validPages.includes(obj.page as SettingsPageId)
    ? (obj.page as SettingsPageId)
    : 'hub';

  return {
    type: 'open',
    tab: 'settings',
    page,
    subpage: subpageRaw,
    confirmBn: 'নির্ধারিত পেজ খোলা হয়েছে।',
  };
}

export const TIYA_SETTINGS_MAP_DESCRIPTION = [
  'TIYA App & Settings Map (you can open any screen/subpage using navigate_app):',
  '- Tabs: home, chat, settings',
  '- Settings Hub (page="hub"):',
  '  01 ABOUT & GUIDE (page="about", subpages: health_check, how_to_use, app_info = ABOUT TIYA with developer & help)',
  '  02 CONNECTIONS (page="connections", subpages: gemini, groq)',
  '  03 VOICE & LANGUAGE (page="voice_language", subpages: assistant_name (locked), your_name, personality, response_style, language, voice, voice_model, custom_model, chat_model_override, speech_speed, volume, mic_listening, mic_test, mic_sensitivity)',
  '  04 PHONE CONTROL (page="phone_control", subpages: quick_actions)',
  '  05 CHATS & MEMORY (page="chats_memory")',
  '  06 PREMIUM (page="premium")',
  '  ABOUT > PRIVACY CONTROLS (page="privacy_controls", subpages: mic_permission, chat_history, tiya_memory, stored_info, api_key_security, policy_terms, account_delete)',
  '  SESSION > MY ACCOUNT (page="my_account")',
].join('\n');
