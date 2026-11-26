/**
 * Mode context (Personal / Student / Business) that is added to ROSE's system prompt.
 * Kept outside the voice code: buildTiyaSystemPrompt() just reads getTiyaModeContext().
 */
import { supabase } from '../lib/supabase';

let current = '';
let currentMode = '';
let parcelsCtx = '';

/** Open parcels + couriers for a business owner (also the admin when his mode is Business). */
export function getTiyaParcelsContext(): string {
  return parcelsCtx;
}

export async function refreshParcelsContext(enabled = true): Promise<number> {
  if (!enabled) {
    parcelsCtx = '';
    return 0;
  }
  try {
    const { data: pc } = await supabase.functions.invoke('rose-business', { body: { action: 'parcels' } });
    if (!pc?.ok) {
      parcelsCtx = '';
      return 0;
    }
    const couriers = (pc.couriers || []) as Array<{ id: string; name: string; auto: boolean; is_default: boolean }>;
    parcelsCtx = [
      `PARCELS (owner only, never tell customers): ${pc.count} open parcel(s) not sent to a courier yet.`,
      ...((pc.parcels || []) as any[])
        .slice(0, 40)
        .map((p) => `#${p.order_no} ${clip(p.name, 40) || 'no name'}, ${clip(p.address, 50) || 'no address'}, COD ${p.cod} Tk${p.ready ? '' : ' (info missing)'}`),
      couriers.length
        ? `Shop couriers: ${couriers.map((c) => `${c.name}${c.auto ? ' (books automatically)' : ' (marked only, owner books in its panel)'}${c.is_default ? ' [default]' : ''}`).join(', ')}.`
        : 'No couriers added yet (Workspace > 04 COURIERS).',
      'PARCEL RULES: When the owner wants to send parcels: if more than one courier exists and he did not name one, first ask which courier (say their names) or whether to split. He may split by IDs ("#1023, #1025 RedX-এ"), by count ("৩টা Steadfast-এ, বাকি Pathao-তে") or send all. Then call trigger_phone_action with action courier_dispatch and text like "redx: #1023,#1025; steadfast: rest" (IDs with #, counts as plain numbers, rest for the remaining). The app shows the plan and books after he says yes; report only the real result it returns. When he asks to e-mail the parcel list, call trigger_phone_action with action parcels_email.',
    ].join('\n');
    return Number(pc.count) || 0;
  } catch {
    return 0;
  }
}

export function getTiyaMode(): string {
  return currentMode;
}

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
  const isAdminAll = mode === 'admin';
  if (isAdminAll) mode = 'business';
  currentMode = isAdminAll ? 'admin' : mode || '';
  if (!mode || !MODE_TEXT[mode]) {
    current = '';
    return;
  }
  let text = isAdminAll
    ? [
        'ACCOUNT MODE: ADMIN (FULL ACCESS). The admin has every mode at once; switch role by what he asks, never say a feature belongs to another mode.',
        MODE_TEXT.personal,
        MODE_TEXT.student,
        MODE_TEXT.business.replace("Act as the owner's business assistant AND as a polite customer-support agent", "For his business, act as his business assistant (and as customer support when he asks you to reply to customers)"),
      ].join('\n')
    : MODE_TEXT[mode];
  if (mode === 'business' && userId) {
    try {
      const { data: b } = await supabase.from('businesses').select('*').eq('owner_id', userId).maybeSingle();
      // website owners: ROSE reads products, prices and stock straight from their myrosebd.com website
      let siteProducts = '';
      try {
        const { data: st } = await supabase.from('stores').select('id').eq('owner_id', userId).limit(1).maybeSingle();
        if (st?.id) {
          const { data: sp } = await supabase.from('store_products').select('name,price,stock').eq('store_id', st.id).eq('active', true).order('sort').limit(60);
          if (sp && sp.length)
            siteProducts = `Website products (from the owner's myrosebd.com website):\n${sp
              .map((p: any) => `- ${clip(p.name, 60)}: ${p.price} Tk${p.stock !== null && p.stock !== undefined ? `, stock ${p.stock}` : ''}`)
              .join('\n')}`;
        }
      } catch {
        siteProducts = '';
      }
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
            : siteProducts
              ? ''
              : 'No products added yet.',
          siteProducts,
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
  currentMode = '';
  parcelsCtx = '';
}

/** Always-on skills for every user (and the admin): live search + social media growth know-how. */
export const ROSE_SKILLS_BLOCK = [
  'SKILLS YOU HAVE:',
  '- Live web search: the app searches Google for news, prices, results, weather, AI tool launches and study facts. Never say you cannot browse; if a search answer is not given to you, say you will check and ask the user to ask again with words like "সার্চ করে বলো".',
  '- Writer: you can write letters, applications, CVs, reports, posts, scripts and emails; the user can open them in the WRITER panel to download, email or send to WhatsApp.',
  '- Social media growth (give concrete, current advice; never promise guaranteed views):',
  '  YouTube: hook in the first 3 seconds; title under 60 characters with the main keyword first; bright thumbnail with a face and 3-4 big words; first 2 lines of the description carry the keywords; chapters; 3-5 hashtags; Shorts vertical 9:16 under 60s; steady upload schedule; end screens; watch time and click-through rate matter most.',
  '  Facebook: native vertical Reels 9:16, original content (no re-uploads), strong first 3 seconds, Bangla captions on screen, reply to comments in the first hour, 1-3 hashtags, no engagement bait, post at the audience peak time.',
  '  Instagram: Reels with a hook and trending audio, keywords in the caption and profile (Instagram search works like SEO), 3-5 specific hashtags, shares and saves count more than likes, collab posts, alt text.',
  '  TikTok: hook in 1-2 seconds, say and write the keyword (on-screen text + caption = TikTok SEO), trending sounds, short videos people watch to the end, 3-5 hashtags, post often, reply to comments with videos.',
  '- Students: explain step by step, show sources for facts, never give wrong exam info; for current syllabus, results or admission dates use search.',
  '- Business: market prices, competitor ideas, ad copy, product descriptions, customer replies.',
  '- SOCIAL POST (everyone): when the user wants to upload or post a video to YouTube, Facebook, TikTok or Instagram, call navigate_app with page "workspace" and subpage "social", and tell them warmly: pick the video from the gallery, write one line about it, tap WRITE WITH ROSE, and you fill in the title, caption and hashtags for each app. Then ask them to check each box once ("একবার দেখে নাও সব ঠিক আছে কিনা") and tap POST for each app; the official app opens with the video and the caption copied, and they press Publish there. If they ask what you wrote, read the title and caption for each app. Never claim a video was published: the user publishes it in the official app.',
].join('\n');
