import { supabase } from './supabase';

export type PremiumChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface PremiumChatResult {
  ok: boolean;
  text?: string;
  reason?: string;
  message?: string;
  voiceLeft?: number | null;
  textLeft?: number | null;
}

/**
 * ROSE PREMIUM: replies come from the admin's keys on the server
 * (Supabase Edge Function "tiya-premium"). Customers never see the keys.
 */
export async function premiumChat(
  messages: PremiumChatMessage[],
  opts: { forVoice?: boolean; maxTokens?: number } = {},
): Promise<PremiumChatResult> {
  try {
    const { data, error } = await supabase.functions.invoke('tiya-premium', {
      body: {
        action: 'chat',
        messages,
        forVoice: Boolean(opts.forVoice),
        maxTokens: opts.maxTokens || 1024,
      },
    });
    if (error) {
      // 402 = no credits / not premium — body carries a Bengali message
      let body: any = null;
      try {
        body = await (error as any)?.context?.json?.();
      } catch {
        body = null;
      }
      return {
        ok: false,
        reason: body?.reason || 'server_error',
        message: body?.message || 'Premium সার্ভারে সমস্যা হয়েছে, একটু পরে চেষ্টা করুন।',
        voiceLeft: body?.voice_left ?? null,
        textLeft: body?.text_left ?? null,
      };
    }
    if (!data?.ok || !String(data?.text || '').trim()) {
      return { ok: false, reason: data?.reason || 'empty', message: data?.message || 'উত্তর পাওয়া যায়নি।' };
    }
    return {
      ok: true,
      text: String(data.text).trim(),
      voiceLeft: data.voice_left ?? null,
      textLeft: data.text_left ?? null,
    };
  } catch {
    return { ok: false, reason: 'network', message: 'নেট সংযোগে সমস্যা, আবার চেষ্টা করুন।' };
  }
}

export interface PremiumPayment {
  id: string;
  months: number;
  voice_credits: number;
  text_credits: number;
  amount_bdt: number;
  method: string | null;
  trx_id: string | null;
  note: string | null;
  created_at: string;
}

export async function adminGrantPremium(args: {
  userId: string;
  months: number;
  voice: number;
  text: number;
  amount: number;
  method: string | null;
  trx: string | null;
  note: string | null;
}): Promise<{ ok: boolean; error?: string; paidUntil?: string | null; voiceLeft?: number; textLeft?: number }> {
  const { data, error } = await supabase.rpc('admin_grant_premium', {
    p_user: args.userId,
    p_months: args.months,
    p_voice: args.voice,
    p_text: args.text,
    p_amount: args.amount,
    p_method: args.method,
    p_trx: args.trx,
    p_note: args.note,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data || {}) as any;
  return { ok: true, paidUntil: row.paid_until ?? null, voiceLeft: row.voice_left, textLeft: row.text_left };
}

export async function loadPremiumPayments(userId: string): Promise<PremiumPayment[]> {
  const { data, error } = await supabase
    .from('premium_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data)) return [];
  return data as PremiumPayment[];
}

/** ROSE PREMIUM voice: Gemini TTS on the server. Returns base64 16-bit PCM (24 kHz mono). */
export async function premiumTts(
  text: string,
  voiceName: string,
): Promise<{ ok: boolean; audio?: string; message?: string; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('tiya-premium', {
      body: { action: 'tts', text: text.slice(0, 3000), voiceName },
    });
    if (error) {
      let body: any = null;
      try {
        body = await (error as any)?.context?.json?.();
      } catch {
        body = null;
      }
      return { ok: false, reason: body?.reason, message: body?.message || 'ভয়েস তৈরি করা যায়নি।' };
    }
    if (!data?.ok || !data?.audio) return { ok: false, message: data?.message || 'ভয়েস তৈরি করা যায়নি।' };
    return { ok: true, audio: String(data.audio) };
  } catch {
    return { ok: false, message: 'নেট সংযোগে সমস্যা।' };
  }
}
