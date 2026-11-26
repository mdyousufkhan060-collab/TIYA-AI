// Vercel routing middleware: the home page "/" of a shop address (shop.myrosebd.com or the shop's own domain)
// must open the shop, not the ROSE app. "/" is a real file (index.html), so vercel.json rewrites never reach it;
// this runs first. Other paths are handled by vercel.json.
export const config = { matcher: '/' };

const ROSE_HOSTS = ['www.myrosebd.com', 'myrosebd.com', 'localhost'];
const NOT_SHOPS = ['www', 'app', 'api', 'admin', 'mail', 'webmail'];

export default function middleware(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (ROSE_HOSTS.includes(host) || host.endsWith('.vercel.app')) return undefined;
  const sub = (host.match(/^([a-z0-9-]+)\.myrosebd\.com$/) || [])[1];
  if (sub && NOT_SHOPS.includes(sub)) return undefined;
  return new Response(null, { headers: { 'x-middleware-rewrite': new URL('/api/shop' + url.search, request.url).toString() } });
}
