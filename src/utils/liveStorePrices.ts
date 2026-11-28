import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORE_PLANS, STORE_TOTALS } from './storePlans';

/**
 * Store plan prices (live from the database), with the built-in prices until they load.
 * Keys: 'starter' / 'business' / 'lifetime' (1-month or one-time price) and 'plan:months' totals, e.g. 'business:12'.
 */
export function useLiveStorePrices(): Record<string, number> {
  const [m, setM] = useState<Record<string, number>>({ starter: STORE_PLANS.starter.monthly, pro: STORE_PLANS.pro.monthly, business: STORE_PLANS.business.monthly, lifetime: 26000, ...STORE_TOTALS });
  useEffect(() => {
    void supabase.from('store_plan_prices').select('plan,monthly').then(({ data }) => {
      const rows = (data as Array<{ plan: string; monthly: number }>) || [];
      if (rows.length) setM((x) => ({ ...x, ...Object.fromEntries(rows.map((r) => [r.plan, Number(r.monthly)])) }));
    });
    void supabase.from('store_plan_totals').select('plan,months,price').then(({ data }) => {
      const rows = (data as Array<{ plan: string; months: number; price: number }>) || [];
      if (rows.length) setM((x) => ({ ...x, ...Object.fromEntries(rows.map((r) => [`${r.plan}:${r.months}`, Number(r.price)])) }));
    });
  }, []);
  return m;
}

/** Total for a plan and months: the same table the server charges from (store_plan_totals). */
export function livePrice(live: Record<string, number>, plan: string, months: number): number {
  return Number(live[`${plan}:${months}`] ?? STORE_TOTALS[`${plan}:${months}`] ?? 0);
}
