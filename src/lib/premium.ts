import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase';

export type PremiumChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface PremiumChatResult {
  ok: boolean;
  text?: string;
  reason?: string;
  message?: string;
  voiceLeft?: number | null;
  textLeft?: number | null;
  calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

/**
 * ROSE PREMIUM: replies come from the admin's keys on the server
 * (Supabase Edge Function "tiya-premium"). Customers never see the keys.
 */
export async function premiumChat(
  messages: PremiumChatMessage[],
  opts: { forVoice?: boolean; maxTokens?: number; tools?: Array<Record<string, unknown>> } = {},
): Promise<PremiumChatResult> {
  try {
    const { data, error } = await supabase.functions.invoke('tiya-premium', {
      body: {
        action: 'chat',
        messages,
        forVoice: Boolean(opts.forVoice),
        maxTokens: opts.maxTokens || 1024,
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
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
    const calls = Array.isArray(data?.calls) ? (data.calls as PremiumChatResult['calls']) : [];
    if (data?.ok && !String(data?.text || '').trim() && calls?.length) {
      return { ok: true, text: '', calls, voiceLeft: data.voice_left ?? null, textLeft: data.text_left ?? null };
    }
    if (!data?.ok || !String(data?.text || '').trim()) {
      return { ok: false, reason: data?.reason || 'empty', message: data?.message || 'উত্তর পাওয়া যায়নি।' };
    }
    return {
      ok: true,
      text: String(data.text).trim(),
      calls,
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

/**
 * ROSE PREMIUM voice, streamed: each piece of sound (24 kHz PCM, base64) is handed to onChunk as soon as it arrives.
 * ok=false with got=0 means nothing came; the caller then uses premiumTts.
 */
export async function premiumTtsStream(text: string, voiceName: string, onChunk: (pcmB64: string) => void): Promise<{ ok: boolean; got: number }> {
  let got = 0;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { ok: false, got };
    const r = await fetch(`${SUPABASE_URL}/functions/v1/tiya-premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: 'tts_stream', text: text.slice(0, 3000), voiceName }),
    });
    if (!r.ok || !r.body) return { ok: false, got };
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          if (j.a) {
            got++;
            onChunk(String(j.a));
          }
          if (j.error) return { ok: got > 0, got };
        } catch {
          /* half a line */
        }
      }
    }
    return { ok: got > 0, got };
  } catch {
    return { ok: got > 0, got };
  }
}

/** ROSE PREMIUM listening: his words (16 kHz WAV, base64) to text on the server. No credit is used for this. */
export async function premiumStt(wavB64: string, language: string): Promise<{ ok: boolean; text?: string; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('tiya-premium', { body: { action: 'stt', audio: wavB64, language } });
    if (error) return { ok: false, message: 'শুনতে সমস্যা হলো।' };
    return { ok: Boolean(data?.ok), text: String(data?.text || '').trim(), message: data?.message };
  } catch {
    return { ok: false, message: 'নেট সংযোগে সমস্যা।' };
  }
}
