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
] as const;

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
      return `${action.app} অ্যাপটি খুলবো?`;
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
