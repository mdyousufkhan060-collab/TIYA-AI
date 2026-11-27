import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORE_DURATIONS, STORE_PLANS } from './storePlans';

/** Store plan prices from admin 21 STORE PLAN PRICES (live), with the built-in prices until they load. */
export function useLiveStorePrices(): Record<string, number> {
  const [m, setM] = useState<Record<string, number>>({ starter: STORE_PLANS.starter.monthly, pro: STORE_PLANS.pro.monthly, business: STORE_PLANS.business.monthly, lifetime: 26000 });
  useEffect(() => {
    void supabase.from('store_plan_prices').select('plan,monthly').then(({ data }) => {
      const rows = (data as Array<{ plan: string; monthly: number }>) || [];
      if (rows.length) setM((x) => ({ ...x, ...Object.fromEntries(rows.map((r) => [r.plan, Number(r.monthly)])) }));
    });
  }, []);
  return m;
}

/** Total for a plan and months with the same discounts as the server (3m 0%, 6m 5%, 9m 10%, 12m 15%, 24m 25%). */
export function livePrice(monthly: number, months: number): number {
  const off = STORE_DURATIONS.find((x) => x.months === months)?.off ?? 0;
  return Math.round((monthly * months * (100 - off)) / 100);
}
