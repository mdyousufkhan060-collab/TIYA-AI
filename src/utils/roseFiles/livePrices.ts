import { supabase } from '../../lib/supabase';

/**
 * LIVE PRICES for ROSE's files: read from the database (admin 05 PLANS & PRICES and 21 STORE PLAN PRICES),
 * so when the admin changes a price, ROSE's files say the new price by themselves. Refreshed every 10 minutes.
 */
export type PremiumRow = { name: string; price: number; months: number; text: number; voice: number };
export type LivePrices = { premium: PremiumRow[]; store: Record<string, number> };

const DEFAULTS: LivePrices = {
  premium: [
    { name: 'Basic', price: 199, months: 1, text: 1000, voice: 100 },
    { name: 'Pro', price: 499, months: 1, text: 3000, voice: 300 },
    { name: 'Premium', price: 999, months: 1, text: 8000, voice: 600 },
    { name: 'Text Pack', price: 49, months: 1, text: 500, voice: 0 },
    { name: 'Voice Pack', price: 99, months: 1, text: 0, voice: 100 },
  ],
  store: { starter: 999, pro: 1999, business: 3999, lifetime: 26000 },
};
let cache: LivePrices = DEFAULTS;
let at = 0;
let loading: Promise<void> | null = null;

export async function refreshLivePrices(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const [p, s] = await Promise.all([
        supabase.from('premium_plans').select('name,price_bdt,months,text_credits,voice_credits,is_active,sort').eq('is_active', true).order('sort'),
        supabase.from('store_plan_prices').select('plan,monthly'),
      ]);
      const prem = ((p.data as Array<Record<string, unknown>>) || []).map((r) => ({
        name: String(r.name), price: Number(r.price_bdt), months: Number(r.months) || 1, text: Number(r.text_credits) || 0, voice: Number(r.voice_credits) || 0,
      }));
      const store: Record<string, number> = { ...DEFAULTS.store };
      for (const r of (s.data as Array<{ plan: string; monthly: number }>) || []) store[r.plan] = Number(r.monthly);
      cache = { premium: prem.length ? prem : DEFAULTS.premium, store };
      at = Date.now();
    } catch {
      /* keep the last known prices */
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** The prices ROSE uses now (starts a background refresh when older than 10 minutes). */
export function livePrices(): LivePrices {
  if (Date.now() - at > 10 * 60 * 1000) void refreshLivePrices();
  return cache;
}

export const taka = (n: number) => `${Math.round(n).toLocaleString('en-IN')} Tk`;
