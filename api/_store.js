// Shared helpers for the shop pages Google reads (no secrets: only the public key, and RLS shows only open shops)
export const SB_URL = 'https://ukgwipazzjstjkdfaozg.supabase.co';
export const SB_KEY = 'sb_publishable_CRMgURG899vqIqUIsADWgw_p90ZliES';
export const DEMOS = ['foodbazaar', 'fashionhub', 'sotadari', 'shopshotoi', 'homenest', 'medicare'];
const NOT_SHOPS = ['www', 'app', 'api', 'admin', 'mail', 'webmail'];

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) return [];
  return r.json();
}

/** Which shop is this request for? Returns { demo } for the 6 demo designs, { slug } or { domain } for real shops. */
export function whichShop(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0];
  const q = new URL(req.url, 'https://x').searchParams;
  const raw = q.get('slug') || (req.query && req.query.slug) || (String(req.headers['x-forwarded-uri'] || '').match(/\/shop\/([a-z0-9-]+)/) || [])[1] || '';
  const qs = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (qs) return { slug: qs, host };
  const m = host.match(/^([a-z0-9-]+)\.myrosebd\.com$/);
  if (m) {
    if (NOT_SHOPS.includes(m[1])) return { none: true, host };
    if (DEMOS.includes(m[1])) return { demo: m[1], host };
    return { slug: m[1], host };
  }
  if (host && !/myrosebd\.com$|vercel\.app$|^localhost$/.test(host)) return { domain: host.replace(/^www\./, ''), host };
  return { none: true, host };
}

export async function loadShop(w) {
  const cols = 'id,slug,name,name_bn,tagline,logo_url,banners,seo,city,phone,whatsapp,address,custom_domain,domain_ready,subdomain_ready,updated_at';
  let rows = [];
  if (w.slug) rows = await sb(`stores?select=${cols}&slug=eq.${encodeURIComponent(w.slug)}`);
  else if (w.domain) rows = await sb(`stores?select=${cols}&custom_domain=eq.${encodeURIComponent(w.domain)}`);
  const s = rows[0];
  if (!s) return null;
  const prods = await sb(`store_products?select=name,price,old_price,images,description,stock,updated_at&store_id=eq.${s.id}&active=eq.true&order=sort&limit=60`);
  return { s, prods: Array.isArray(prods) ? prods : [] };
}

/** The one address Google should keep for this shop. */
export function shopUrl(s) {
  if (s.custom_domain && s.domain_ready) return `https://${s.custom_domain}/`;
  if (s.subdomain_ready) return `https://${s.slug}.myrosebd.com/`;
  return `https://www.myrosebd.com/shop/${s.slug}`;
}
