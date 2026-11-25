/** ROSE Store Builder plans (separate from ROSE text / voice credits). */
export type StorePlanId = 'trial' | 'starter' | 'pro' | 'business';

export const STORE_PLANS: Record<
  StorePlanId,
  { label: string; monthly: number; stores: number; products: number; storageGb: number; staff: number; aiChats: number; ownDomain: boolean }
> = {
  trial: { label: '5-DAY FREE TRIAL', monthly: 0, stores: 1, products: 50, storageGb: 1, staff: 0, aiChats: 100, ownDomain: false },
  starter: { label: 'STARTER', monthly: 999, stores: 1, products: 300, storageGb: 5, staff: 1, aiChats: 500, ownDomain: false },
  pro: { label: 'PRO', monthly: 1999, stores: 1, products: 100000, storageGb: 10, staff: 3, aiChats: 3000, ownDomain: true },
  business: { label: 'BUSINESS', monthly: 3999, stores: 3, products: 100000, storageGb: 25, staff: 10, aiChats: 10000, ownDomain: true },
};

/** Months you can buy and the discount for each. */
export const STORE_DURATIONS: Array<{ months: number; off: number }> = [
  { months: 3, off: 0 },
  { months: 6, off: 5 },
  { months: 9, off: 10 },
  { months: 12, off: 15 },
  { months: 24, off: 25 },
];

export function storePrice(plan: StorePlanId, months: number): number {
  const p = STORE_PLANS[plan];
  const d = STORE_DURATIONS.find((x) => x.months === months)?.off ?? 0;
  return Math.round((p.monthly * months * (100 - d)) / 100);
}

export const DOMAIN_PRICES = [
  { tld: '.com', sell: 1800, note: 'Our cost about 1,250-1,750 Tk / year' },
  { tld: '.com.bd', sell: 1500, note: 'BTCL: 700 Tk new, 1,020 Tk renewal' },
  { tld: '.bd', sell: 2200, note: 'BTCL: 1,280 Tk new, 1,600 Tk renewal' },
];

export const tk = (n: number) => `${Math.round(n).toLocaleString('en-IN')} Tk`;
