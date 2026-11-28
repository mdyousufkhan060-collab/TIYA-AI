/** ROSE Store Builder plans (separate from ROSE text / voice credits). */
export type StorePlanId = 'trial' | 'starter' | 'pro' | 'business';

// LOCKED (owner, Nov 28 2026 8:36 PM): website plans with ROSE. Do not change unless the owner asks.
//   PERSONAL · STUDENT ('starter'): 1m 1,500 · 3m 4,000 · 6m 5,500 · 9m 8,000 · 12m 10,500 Tk.
//   BUSINESS PREMIUM ('business'): the same + 1,500 Tk once per plan; only Business can change the website design.
//   Free trial: 10 days. A bought plan starts on the day it is bought (unused trial days are not added).
//   'pro' stays only for older accounts and the LIFETIME website; it is not sold any more.
export const STORE_PLANS: Record<
  StorePlanId,
  { label: string; monthly: number; stores: number; products: number; storageGb: number; staff: number; aiChats: number; ownDomain: boolean }
> = {
  trial: { label: '10-DAY FREE TRIAL', monthly: 0, stores: 1, products: 50, storageGb: 1, staff: 0, aiChats: 100, ownDomain: false },
  starter: { label: 'PERSONAL · STUDENT', monthly: 1500, stores: 1, products: 100000, storageGb: 10, staff: 3, aiChats: 3000, ownDomain: true },
  pro: { label: 'PRO', monthly: 1999, stores: 1, products: 100000, storageGb: 10, staff: 3, aiChats: 3000, ownDomain: true },
  business: { label: 'BUSINESS PREMIUM', monthly: 3000, stores: 3, products: 100000, storageGb: 25, staff: 10, aiChats: 10000, ownDomain: true },
};

/** Plans that can be bought now (in this order). */
export const SELL_PLANS: StorePlanId[] = ['starter', 'business'];
export const TRIAL_DAYS = 10;
export const BUSINESS_EXTRA = 1500;

/** Months you can buy and the discount for each (worked out against 1,500 Tk a month). */
export const STORE_DURATIONS: Array<{ months: number; off: number }> = [
  { months: 1, off: 0 },
  { months: 3, off: 11 },
  { months: 6, off: 39 },
  { months: 9, off: 41 },
  { months: 12, off: 42 },
];

/** Built-in totals (the live ones come from the database table store_plan_totals). */
export const STORE_TOTALS: Record<string, number> = {
  'starter:1': 1500, 'starter:3': 4000, 'starter:6': 5500, 'starter:9': 8000, 'starter:12': 10500,
  'business:1': 3000, 'business:3': 5500, 'business:6': 7000, 'business:9': 9500, 'business:12': 12000,
};

export function storePrice(plan: StorePlanId, months: number): number {
  return STORE_TOTALS[`${plan}:${months}`] ?? 0;
}

export const DOMAIN_PRICES = [
  { tld: '.com', sell: 1800, note: 'Our cost about 1,250-1,750 Tk / year' },
  { tld: '.com.bd', sell: 1500, note: 'BTCL: 700 Tk new, 1,020 Tk renewal' },
  { tld: '.bd', sell: 2200, note: 'BTCL: 1,280 Tk new, 1,600 Tk renewal' },
];

export const tk = (n: number) => `${Math.round(n).toLocaleString('en-IN')} Tk`;
