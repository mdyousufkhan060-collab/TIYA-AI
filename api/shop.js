// Every shop page: the same store.html, with the shop's own name, description, photo and products written in
// before the browser runs anything, so Google (and Facebook / WhatsApp previews) read the real shop.
import { esc, loadShop, shopUrl, whichShop } from './_store.js';

let TPL = null;
let TPL_AT = 0;
async function template() {
  if (TPL && Date.now() - TPL_AT < 5 * 60 * 1000) return TPL;
  const r = await fetch('https://www.myrosebd.com/demos/store.html', { headers: { 'x-rose-ssr': '1' } });
  TPL = await r.text();
  TPL_AT = Date.now();
  return TPL;
}

const tk = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`;
const img = (u) => (u && /^https?:\/\//.test(u) ? u : '');

export default async function handler(req, res) {
  let html = '';
  try {
    html = await template();
    const w = whichShop(req);
    const data = w.slug || w.domain ? await loadShop(w) : null;
    if (data) {
      const { s, prods } = data;
      const url = shopUrl(s);
      const seo = s.seo || {};
      const name = s.name || s.slug;
      const title = (seo.title || `${name}${s.name_bn ? ' · ' + s.name_bn : ''}${s.tagline ? ' · ' + s.tagline : ''}`).slice(0, 70);
      const desc = (seo.description || `${name}${s.name_bn ? ' (' + s.name_bn + ')' : ''}: ${s.tagline || 'online shop'}. Home delivery all over Bangladesh${s.city ? ', from ' + s.city : ''}. Cash on delivery.`).slice(0, 180);
      const pic = img(s.logo_url) || img((s.banners || []).find((b) => b && b.img)?.img) || img(prods.find((p) => (p.images || [])[0])?.images[0]);
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name,
        alternateName: s.name_bn || undefined,
        description: desc,
        url,
        image: pic || undefined,
        telephone: s.whatsapp || s.phone || undefined,
        address: s.address ? { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: s.city || undefined, addressCountry: 'BD' } : undefined,
        makesOffer: prods.slice(0, 30).map((p) => ({
          '@type': 'Offer',
          price: Number(p.price || 0),
          priceCurrency: 'BDT',
          availability: Number(p.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemOffered: { '@type': 'Product', name: p.name, image: img((p.images || [])[0]) || undefined, description: (p.description || '').slice(0, 300) || undefined },
        })),
      };
      const head = [
        `<title>${esc(title)}</title>`,
        '<meta name="robots" content="index, follow" />',
        `<meta name="description" content="${esc(desc)}" />`,
        `<link rel="canonical" href="${esc(url)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${esc(name)}" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:description" content="${esc(desc)}" />`,
        `<meta property="og:url" content="${esc(url)}" />`,
        pic ? `<meta property="og:image" content="${esc(pic)}" />` : '',
        `<meta name="twitter:card" content="${pic ? 'summary_large_image' : 'summary'}" />`,
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
      ].join('\n');
      html = html
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<meta name="robots"[^>]*>/, '')
        .replace(/<meta name="description"[^>]*>/, '')
        .replace('</head>', `${head}\n</head>`);
      // what Google reads first; the shop app replaces it as soon as it opens
      const list = prods
        .slice(0, 40)
        .map((p) => `<li><b>${esc(p.name)}</b> · ${tk(p.price)}${Number(p.old_price) > Number(p.price) ? ` <s>${tk(p.old_price)}</s>` : ''}</li>`)
        .join('');
      const first = `<section class="panel" style="padding:18px"><h1 style="margin:0 0 6px">${esc(name)}${s.name_bn ? ` <small style="font-weight:600;color:#64748b">${esc(s.name_bn)}</small>` : ''}</h1><p style="margin:0 0 10px;color:#475569">${esc(desc)}</p>${list ? `<ul style="margin:0;padding-left:18px;line-height:1.7">${list}</ul>` : ''}</section>`;
      html = html.replace('<div class="wrap" id="view"></div>', `<div class="wrap" id="view">${first}</div>`);
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
    }
  } catch (e) {
    if (!html) {
      res.statusCode = 302;
      res.setHeader('Location', '/demos/store.html');
      return res.end();
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  res.end(html);
}
