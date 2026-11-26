// /store-sitemap.xml on a shop's address: the list Google reads for that shop
import { esc, loadShop, shopUrl, whichShop } from './_store.js';

export default async function handler(req, res) {
  const w = whichShop(req);
  const data = w.slug || w.domain ? await loadShop(w).catch(() => null) : null;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  if (!data) {
    res.statusCode = 404;
    return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
  const { s, prods } = data;
  const last = [s.updated_at, ...prods.map((p) => p.updated_at)].filter(Boolean).sort().pop();
  const pics = prods.flatMap((p) => (p.images || []).slice(0, 1)).filter((u) => /^https?:\/\//.test(u)).slice(0, 100);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>${esc(shopUrl(s))}</loc>${last ? `<lastmod>${new Date(last).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>1.0</priority>${pics.map((u) => `<image:image><image:loc>${esc(u)}</image:loc></image:image>`).join('')}</url>
</urlset>`;
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(xml);
}
