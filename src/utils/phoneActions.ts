import { PhoneAction, TiyaNativeResult } from '../types/tiya';

export const SUPPORTED_PHONE_ACTIONS_META = [
  {
    action: 'open_app',
    label: 'Open App',
    example: '{"action":"open_app","app":"YouTube"}',
    description: 'Launches an installed app on Android (e.g. YouTube, Camera, Settings).',
  },
  {
    action: 'call',
    label: 'Phone Call',
    example: '{"action":"call","contact":"..."}',
    description: 'Places a cellular call. Uses tel: link fallback in browser for phone numbers.',
  },
  {
    action: 'whatsapp_call',
    label: 'WhatsApp Call',
    example: '{"action":"whatsapp_call","contact":"..."}',
    description: 'Starts a WhatsApp voice/video call in the ROSE Android app.',
  },
  {
    action: 'whatsapp_message',
    label: 'WhatsApp Message',
    example: '{"action":"whatsapp_message","contact":"...","text":"..."}',
    description: 'Sends a WhatsApp message. Uses wa.me web link fallback in browser.',
  },
  {
    action: 'messenger_message',
    label: 'Messenger Message',
    example: '{"action":"messenger_message","contact":"...","text":"..."}',
    description: 'Sends a Facebook Messenger message in the ROSE Android app.',
  },
  {
    action: 'messenger_call',
    label: 'Messenger Call',
    example: '{"action":"messenger_call","contact":"..."}',
    description: 'Places a Facebook Messenger call in the ROSE Android app.',
  },
  {
    action: 'web_search',
    label: 'Search / Play',
    example: '{"action":"web_search","site":"youtube","query":"..."}',
    description: 'Searches or plays on Google, YouTube, YouTube Music, Facebook videos, Google Maps, directions, flights, hotels or Wikipedia.',
  },
  {
    action: 'close_opened',
    label: 'Close & Come Back',
    example: '{"action":"close_opened"}',
    description: 'Closes the tabs ROSE opened (YouTube, Maps...) and comes back to ROSE.',
  },
] as const;

const SEARCH_SITES: Record<string, { label: string; url: (q: string) => string }> = {
  google: { label: 'Google', url: (q) => `https://www.google.com/search?q=${q}` },
  youtube: { label: 'YouTube', url: (q) => `https://www.youtube.com/results?search_query=${q}` },
  music: { label: 'YouTube Music', url: (q) => `https://music.youtube.com/search?q=${q}` },
  facebook: { label: 'Facebook', url: (q) => `https://www.facebook.com/search/videos/?q=${q}` },
  maps: { label: 'Google Maps', url: (q) => `https://www.google.com/maps/search/${q}` },
  wikipedia: { label: 'Wikipedia', url: (q) => `https://bn.wikipedia.org/w/index.php?search=${q}` },
  images: { label: 'Google Images', url: (q) => `https://www.google.com/search?tbm=isch&q=${q}` },
  news: { label: 'Google News', url: (q) => `https://news.google.com/search?q=${q}` },
  directions: { label: 'Google Maps directions', url: (q) => `https://www.google.com/maps/dir/?api=1&destination=${q}` },
  flights: { label: 'Google Flights', url: (q) => `https://www.google.com/travel/flights?q=${q}` },
  hotels: { label: 'Google Hotels', url: (q) => `https://www.google.com/travel/hotels?q=${q}` },
};

/* Tabs / windows ROSE opened, so "বন্ধ করো" can close them again. */
const openedWindows: Window[] = [];

export function openTracked(url: string): boolean {
  try {
    const w = window.open(url, '_blank');
    if (w) {
      openedWindows.push(w);
      return true;
    }
  } catch {
    /* blocked */
  }
  return false;
}

export function closeOpenedWindows(): number {
  let n = 0;
  while (openedWindows.length) {
    const w = openedWindows.pop();
    try {
      if (w && !w.closed) {
        w.close();
        n++;
      }
    } catch {
      /* ignore */
    }
  }
  try {
    window.focus();
  } catch {
    /* ignore */
  }
  return n;
}

export function normalizeSearchSite(site: unknown): string {
  const s = String(site || '').toLowerCase();
  if (/direction|route|navigat|যাব|যাওয়া|দিকনির্দেশ|রাস্তা দেখাও/.test(s)) return 'directions';
  if (/flight|plane|air|টিকেট|টিকিট|বিমান|ফ্লাইট/.test(s)) return 'flights';
  if (/hotel|হোটেল|resort/.test(s)) return 'hotels';
  if (/music|gaan|গান|song|spotify/.test(s)) return 'music';
  if (/you ?tube|ইউটিউব|ytb|yt/.test(s)) return 'youtube';
  if (/face ?book|ফেসবুক|fb/.test(s)) return 'facebook';
  if (/map|ম্যাপ|location|রাস্তা/.test(s)) return 'maps';
  if (/wiki/.test(s)) return 'wikipedia';
  if (/image|photo|ছবি/.test(s)) return 'images';
  if (/news|খবর/.test(s)) return 'news';
  return 'google';
}

const APP_WEB_URLS: Array<[RegExp, string]> = [
  [/you ?tube|ইউটিউব/i, 'https://www.youtube.com/'],
  [/music|গান/i, 'https://music.youtube.com/'],
  [/face ?book|ফেসবুক/i, 'https://www.facebook.com/'],
  [/messenger|মেসেঞ্জার/i, 'https://www.messenger.com/'],
  [/whats ?app|হোয়াটস/i, 'https://web.whatsapp.com/'],
  [/gmail|জিমেইল|mail/i, 'https://mail.google.com/'],
  [/map|ম্যাপ/i, 'https://www.google.com/maps'],
  [/chrome|google|গুগল|browser|ব্রাউজার/i, 'https://www.google.com/'],
  [/insta/i, 'https://www.instagram.com/'],
  [/tik ?tok|টিকটক/i, 'https://www.tiktok.com/'],
];

export function requiresConfirmation(action: PhoneAction): boolean {
  return (
    action.action === 'call' ||
    action.action === 'whatsapp_call' ||
    action.action === 'whatsapp_message' ||
    action.action === 'messenger_message' ||
    action.action === 'messenger_call'
  );
}

export function getConfirmationPromptText(action: PhoneAction): string {
  switch (action.action) {
    case 'call':
      return `${action.contact}-কে সাধারণ কল দেবো?`;
    case 'whatsapp_call':
      return `${action.contact}-কে হোয়াটসঅ্যাপে কল দেবো?`;
    case 'messenger_call':
      return `${action.contact}-কে মেসেঞ্জারে কল দেবো?`;
    case 'whatsapp_message':
      return `${action.contact}-কে হোয়াটসঅ্যাপে "${action.text}" পাঠাবো?`;
    case 'messenger_message':
      return `${action.contact}-কে মেসেঞ্জারে "${action.text}" পাঠাবো?`;
    case 'open_app':
      return `${action.app} খোলা হচ্ছে…`;
    case 'close_opened':
      return 'ROSE যেসব ট্যাব খুলেছিল সেগুলো বন্ধ করে ROSE-এ ফিরবো?';
    case 'web_search': {
      const site = SEARCH_SITES[normalizeSearchSite(action.site)];
      return `${site.label}-এ "${action.query}" খোলা হচ্ছে…`;
    }
  }
}

export function validatePhoneAction(raw: unknown): PhoneAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const actionType = obj.action;
  if (typeof actionType !== 'string') return null;

  switch (actionType) {
    case 'open_app':
      if (typeof obj.app === 'string' && obj.app.trim()) {
        return { action: 'open_app', app: obj.app.trim() };
      }
      return null;
    case 'call':
      if (typeof obj.contact === 'string' && obj.contact.trim()) {
        return { action: 'call', contact: obj.contact.trim() };
      }
      return null;
    case 'whatsapp_call':
      if (typeof obj.contact === 'string' && obj.contact.trim()) {
        return { action: 'whatsapp_call', contact: obj.contact.trim() };
      }
      return null;
    case 'whatsapp_message':
      if (
        typeof obj.contact === 'string' &&
        obj.contact.trim() &&
        typeof obj.text === 'string'
      ) {
        return {
          action: 'whatsapp_message',
          contact: obj.contact.trim(),
          text: obj.text.trim(),
        };
      }
      return null;
    case 'messenger_message':
      if (
        typeof obj.contact === 'string' &&
        obj.contact.trim() &&
        typeof obj.text === 'string'
      ) {
        return {
          action: 'messenger_message',
          contact: obj.contact.trim(),
          text: obj.text.trim(),
        };
      }
      return null;
    case 'messenger_call':
      if (typeof obj.contact === 'string' && obj.contact.trim()) {
        return { action: 'messenger_call', contact: obj.contact.trim() };
      }
      return null;
    case 'close_opened':
    case 'close_app':
    case 'go_home':
      return { action: 'close_opened' };
    case 'web_search': {
      const query = typeof obj.query === 'string' ? obj.query.trim() : typeof obj.text === 'string' ? obj.text.trim() : '';
      if (!query) return null;
      return { action: 'web_search', site: normalizeSearchSite(obj.site ?? obj.app), query };
    }
    default:
      return null;
  }
}

export function extractActionFromText(text: string): {
  cleanText: string;
  action: PhoneAction | null;
} {
  // Detect JSON action blocks in text such as ```json {"action":"call",...} ``` or inline {"action":...}
  const fencedRegex = /```(?:json)?\s*(\{[\s\S]*?"action"\s*:[\s\S]*?\})\s*```/i;
  const fencedMatch = text.match(fencedRegex);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1]);
      const valid = validatePhoneAction(parsed);
      if (valid) {
        return {
          cleanText: text.replace(fencedRegex, '').trim(),
          action: valid,
        };
      }
    } catch {
      // ignore invalid json
    }
  }

  const inlineRegex = /(\{"action"\s*:\s*"[a-z_]+"[^}]*\})/i;
  const inlineMatch = text.match(inlineRegex);
  if (inlineMatch) {
    try {
      const parsed = JSON.parse(inlineMatch[1]);
      const valid = validatePhoneAction(parsed);
      if (valid) {
        return {
          cleanText: text.replace(inlineRegex, '').trim(),
          action: valid,
        };
      }
    } catch {
      // ignore invalid json
    }
  }

  return { cleanText: text, action: null };
}

export function normalizePhoneDigits(contact: string): string | null {
  const stripped = contact.replace(/[\s\-().]/g, '');
  if (/^\+?\d{6,15}$/.test(stripped)) {
    return stripped;
  }
  return null;
}

export interface ActionExecutionResult {
  success: boolean;
  via: 'android_native' | 'web_fallback' | 'unsupported';
  messageBn: string;
  fallbackUrl?: string;
}

export function buildWebFallback(action: PhoneAction): ActionExecutionResult {
  if (action.action === 'call') {
    const digits = normalizePhoneDigits(action.contact);
    if (digits) {
      return {
        success: true,
        via: 'web_fallback',
        fallbackUrl: `tel:${digits}`,
        messageBn: `${action.contact} নম্বরে কল করার জন্য ডায়ালার খোলা হচ্ছে।`,
      };
    }
    return {
      success: false,
      via: 'unsupported',
      messageBn:
        'ব্রাউজার থেকে নাম দিয়ে সরাসরি কল দেওয়া যায় না—এটি ROSE Android অ্যাপে কাজ করে। নম্বর বললে কল লিংক খুলতে পারি।',
    };
  }

  if (action.action === 'whatsapp_message') {
    const digits = normalizePhoneDigits(action.contact);
    const encodedText = encodeURIComponent(action.text);
    const waUrl = digits
      ? `https://wa.me/${digits.replace(/^\+/, '')}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    return {
      success: true,
      via: 'web_fallback',
      fallbackUrl: waUrl,
      messageBn: digits
        ? `${action.contact}-এর জন্য হোয়াটসঅ্যাপ চ্যাট লিংক তৈরি করা হয়েছে। পাঠাতে লিংকটি ওপেন করুন।`
        : `ব্রাউজারে সরাসরি কনট্যাক্ট খুঁজে পাঠানো যায় না—এটি ROSE Android অ্যাপে কাজ করে। তবে মেসেজসহ WhatsApp লিংক নিচে দেওয়া হলো।`,
    };
  }

  if (action.action === 'close_opened') {
    const n = closeOpenedWindows();
    return {
      success: true,
      via: 'web_fallback',
      messageBn: n > 0 ? `${n}টা ট্যাব বন্ধ করে ROSE-এ ফিরে এসেছি।` : 'ROSE-এ ফিরে এসেছি। অন্য অ্যাপ নিজে বন্ধ করতে হলে ROSE Android অ্যাপ লাগবে।',
    };
  }

  if (action.action === 'web_search') {
    const site = SEARCH_SITES[normalizeSearchSite(action.site)];
    return {
      success: true,
      via: 'web_fallback',
      fallbackUrl: site.url(encodeURIComponent(action.query)),
      messageBn: `${site.label}-এ "${action.query}" খোলা হচ্ছে।`,
    };
  }

  if (action.action === 'open_app') {
    const hit = APP_WEB_URLS.find(([re]) => re.test(action.app));
    if (hit) {
      return { success: true, via: 'web_fallback', fallbackUrl: hit[1], messageBn: `${action.app} খোলা হচ্ছে।` };
    }
  }

  if (action.action === 'messenger_message') {
    try {
      void navigator.clipboard?.writeText(action.text);
    } catch {
      /* ignore */
    }
    return {
      success: true,
      via: 'web_fallback',
      fallbackUrl: 'https://www.messenger.com/',
      messageBn: `Messenger খোলা হচ্ছে। মেসেজটা কপি করা আছে, ${action.contact}-এর চ্যাটে গিয়ে Paste করে পাঠান।`,
    };
  }

  return {
    success: false,
    via: 'unsupported',
    messageBn: 'এই কাজটি কেবল ROSE Android অ্যাপে কাজ করে। ব্রাউজার থেকে এটি সরাসরি চালানো সম্ভব নয়।',
  };
}

export async function executePhoneAction(
  action: PhoneAction,
  nativeBridge?: { run: (json: string) => Promise<string | TiyaNativeResult> | string | TiyaNativeResult },
  onOpenFallbackUrl?: (url: string) => void,
): Promise<ActionExecutionResult> {
  const actionJson = JSON.stringify(action);

  if (nativeBridge && typeof nativeBridge.run === 'function') {
    try {
      const rawRes = await nativeBridge.run(actionJson);
      let parsed: TiyaNativeResult;
      if (typeof rawRes === 'string') {
        try {
          parsed = JSON.parse(rawRes) as TiyaNativeResult;
        } catch {
          parsed = { success: rawRes.toLowerCase() === 'ok' || rawRes.toLowerCase() === 'true', message: rawRes };
        }
      } else {
        parsed = rawRes;
      }

      if (parsed && parsed.success) {
        return {
          success: true,
          via: 'android_native',
          messageBn: parsed.message || 'কাজটি সফলভাবে সম্পন্ন হয়েছে।',
        };
      }
      if (action.action === 'web_search') {
        const fb = buildWebFallback(action);
        if (fb.fallbackUrl && onOpenFallbackUrl) onOpenFallbackUrl(fb.fallbackUrl);
        return fb;
      }
      return {
        success: false,
        via: 'android_native',
        messageBn: parsed?.message || 'অ্যান্ড্রয়েড অ্যাপ থেকে কাজটি সম্পন্ন করা যায়নি।',
      };
    } catch {
      return {
        success: false,
        via: 'android_native',
        messageBn: 'অ্যান্ড্রয়েড অ্যাপের সাথে সংযোগে সমস্যা হয়েছে, তাই কাজটি সম্পন্ন হয়নি।',
      };
    }
  }

  const fallback = buildWebFallback(action);
  if (fallback.fallbackUrl && onOpenFallbackUrl) {
    onOpenFallbackUrl(fallback.fallbackUrl);
  }
  return fallback;
}
