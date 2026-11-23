/**
 * Mode context (Personal / Student / Business) that is added to ROSE's system prompt.
 * Kept outside the voice code: buildTiyaSystemPrompt() just reads getTiyaModeContext().
 */
import { supabase } from '../lib/supabase';

let current = '';

export function getTiyaModeContext(): string {
  return current;
}

const MODE_TEXT: Record<string, string> = {
  personal:
    'ACCOUNT MODE: PERSONAL. Act as a friendly personal assistant for daily life: planning the day, reminders and tasks, writing messages, emails, posts and captions, answering questions. Talk like a caring friend.',
  student:
    'ACCOUNT MODE: STUDENT. Act as a patient teacher. Explain step by step in simple words, show math working step by step, help with English grammar, essays, notes, routines, MCQ practice and exam preparation. Never invent facts; if unsure, say so honestly. Keep all content safe and educational.',
  business:
    "ACCOUNT MODE: BUSINESS. Act as the owner's business assistant AND as a polite customer-support agent for this business. When answering customer-style questions (price, stock, delivery, payment, return policy), use ONLY the business data below. Never promise a discount above the allowed maximum, never promise refunds, payments or cancellations on your own: say the owner will confirm. If information is missing, say you will check with the owner.",
};

function clip(s: string | null | undefined, n = 300) {
  return (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
}

/** Rebuilds the context. Call after login and after business data changes. */
export async function refreshModeContext(mode: string | null | undefined, userId?: string | null): Promise<void> {
  if (!mode || !MODE_TEXT[mode]) {
    current = '';
    return;
  }
  let text = MODE_TEXT[mode];
  if (mode === 'business' && userId) {
    try {
      const { data: b } = await supabase.from('businesses').select('*').eq('owner_id', userId).maybeSingle();
      if (b) {
        const [{ data: products }, { data: faqs }, { data: ai }] = await Promise.all([
          supabase.from('business_products').select('name,price,stock,kind,discount_allowed,description').eq('business_id', b.id).eq('is_active', true).order('name').limit(60),
          supabase.from('business_faqs').select('question,answer').eq('business_id', b.id).order('sort').limit(30),
          supabase.from('business_ai_settings').select('*').eq('business_id', b.id).maybeSingle(),
        ]);
        const lines = [
          `\nBUSINESS DATA:`,
          `Name: ${clip(b.name, 80)}${b.category ? ` (${clip(b.category, 60)})` : ''}`,
          b.description && `About: ${clip(b.description)}`,
          b.phone && `Phone: ${clip(b.phone, 40)}`,
          b.whatsapp && `WhatsApp: ${clip(b.whatsapp, 40)}`,
          b.address && `Address: ${clip(b.address, 160)}`,
          b.website && `Website: ${clip(b.website, 120)}`,
          b.delivery_info && `Delivery: ${clip(b.delivery_info)}`,
          b.payment_methods && `Payment methods: ${clip(b.payment_methods, 200)}`,
          b.return_policy && `Return/refund policy: ${clip(b.return_policy)}`,
          b.business_rules && `Rules: ${clip(b.business_rules)}`,
          b.communication_style && `Reply style with customers: ${clip(b.communication_style, 200)}`,
          ai && `Max discount allowed: ${ai.max_discount_percent ?? 0}%${ai.discount_needs_approval ? ' (any discount needs owner approval)' : ''}.`,
          ai?.restricted_topics && `Do not discuss: ${clip(ai.restricted_topics, 200)}`,
          products && products.length
            ? `Products/services:\n${products
                .map((p: any) => `- ${clip(p.name, 60)}: ${p.price} Tk${p.stock !== null && p.stock !== undefined ? `, stock ${p.stock}` : ''}${p.discount_allowed ? '' : ', no discount'}${p.description ? ` (${clip(p.description, 80)})` : ''}`)
                .join('\n')}`
            : 'No products added yet.',
          faqs && faqs.length ? `FAQ:\n${faqs.map((f: any) => `Q: ${clip(f.question, 120)} A: ${clip(f.answer, 200)}`).join('\n')}` : '',
        ].filter(Boolean);
        text += '\n' + lines.join('\n');
      } else {
        text += '\nThe owner has not set up the business profile yet. If asked, tell them to open Settings > Workspace > Business Profile.';
      }
    } catch {
      /* offline: keep base text */
    }
  }
  current = text;
}

export function clearModeContext() {
  current = '';
}
