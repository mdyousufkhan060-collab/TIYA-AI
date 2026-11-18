export function mapAuthErrorToBengali(rawMessage?: string): string {
  const msg = (rawMessage || '').toLowerCase();

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid password') ||
    msg.includes('wrong password')
  ) {
    return 'ইমেইল বা পাসওয়ার্ড ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }

  if (
    msg.includes('email not confirmed') ||
    msg.includes('not confirmed')
  ) {
    return 'আপনার ইমেইল এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ইনবক্স থেকে কনফার্ম করুন।';
  }

  if (
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('security purposes')
  ) {
    return 'অনেকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }

  if (
    msg.includes('user already registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  ) {
    return 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা আছে। অনুগ্রহ করে Sign In করুন।';
  }

  if (msg.includes('password') && (msg.includes('at least') || msg.includes('weak') || msg.includes('short'))) {
    return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
  }

  if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return 'সঠিক ইমেইল ঠিকানা লিখুন।';
  }

  if (msg.includes('network') || msg.includes('fetch')) {
    return 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';
  }

  return rawMessage
    ? `লগইন সমস্যা: ${rawMessage}`
    : 'লগইন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
}

export function calculateAge(
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): number | null {
  if (typeof birthYear !== 'number' || !Number.isFinite(birthYear)) {
    return null;
  }
  const age = currentYear - birthYear;
  if (age < 0 || age > 130) return null;
  return age;
}

export function isMinorAge(
  birthYear: number | null | undefined,
  currentYear: number = new Date().getFullYear(),
): boolean {
  const age = calculateAge(birthYear, currentYear);
  return age !== null && age < 18;
}

const BIRTH_YEAR_CACHE_KEY = 'tiya_birth_year_cache_v1';

export function getCachedBirthYear(userId: string): number | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(BIRTH_YEAR_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const val = map[userId];
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function setCachedBirthYear(userId: string, birthYear: number | null): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const raw = window.localStorage.getItem(BIRTH_YEAR_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (typeof birthYear === 'number' && Number.isFinite(birthYear)) {
      map[userId] = birthYear;
    } else {
      delete map[userId];
    }
    window.localStorage.setItem(BIRTH_YEAR_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export interface ReplyUsageDecision {
  allowed: boolean;
  reason?: 'blocked' | 'limit' | string;
  messageBn?: string;
}

export function parseUseReplyResult(data: unknown, error: unknown): ReplyUsageDecision {
  // Fail open if RPC errored due to network/transport issues
  if (error) {
    return { allowed: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { allowed: true };
  }

  const record = row as { allowed?: boolean; reason?: string };
  if (record.allowed === false) {
    if (record.reason === 'blocked') {
      return {
        allowed: false,
        reason: 'blocked',
        messageBn: 'আপনার অ্যাকাউন্ট বন্ধ আছে',
      };
    }
    if (record.reason === 'limit') {
      return {
        allowed: false,
        reason: 'limit',
        messageBn: 'আজকের লিমিট শেষ',
      };
    }
    return {
      allowed: false,
      reason: record.reason || 'denied',
      messageBn: 'আপনার অ্যাকাউন্টে এই মুহূর্তে উত্তর পাওয়া সম্ভব নয়।',
    };
  }

  return { allowed: true };
}

export function computePaidUntilIso(
  months: 1 | 3 | 6 | 12,
  fromDate: Date = new Date(),
): string {
  const next = new Date(fromDate.getTime());
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}
