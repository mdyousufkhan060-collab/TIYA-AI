// /shops-sitemap.xml: every open shop, written fresh each time Google reads it.
// Submit it once in Search Console; new shops join by themselves, paused or closed shops drop out.
import { DEMOS, SB_KEY, SB_URL, esc, shopUrl } from './_store.js';

export default async function handler(req, res) {
  let rows = [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/stores?select=slug,custom_domain,domain_ready,subdomain_ready,updated_at&order=updated_at.desc&limit=5000`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (r.ok) rows = await r.json();
  } catch {
    rows = [];
  }
  const urls = (Array.isArray(rows) ? rows : [])
    .filter((s) => s && s.slug && !DEMOS.includes(s.slug))
    .map((s) => `  <url><loc>${esc(shopUrl(s))}</loc>${s.updated_at ? `<lastmod>${new Date(s.updated_at).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>daily</changefreq></url>`)
    .join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
}
