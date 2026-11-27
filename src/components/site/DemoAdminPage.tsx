import React, { useEffect, useState } from 'react';
import { loadDemos, StorePanel } from '../workspace/StorePanel';
import { makeDemoDb } from '../../lib/demoDb';

/**
 * myrosebd.com/demo-admin?s=fashionhub — the demo shop's admin.
 * It is the very same WEBSITE ADMIN that real shops and ROSE use (same code), running on sample data,
 * so the demo always looks and works exactly like the real thing. Nothing is saved.
 */
const NAMES = ['Rahim Uddin', 'Nusrat Jahan', 'Karim Ahmed', 'Sadia Islam', 'Tanvir Hasan', 'Mim Akter', 'Arif Hossain', 'Ruma Begum', 'Shakil Khan', 'Farzana Yasmin'];
const PLACES = [['Dhaka', 'Mirpur'], ['Dhaka', 'Uttara'], ['Chattogram', 'Panchlaish'], ['Gazipur', 'Tongi'], ['Sylhet', 'Zindabazar'], ['Khulna', 'Sonadanga']];
const STATUS = ['delivered', 'delivered', 'delivered', 'shipped', 'confirmed', 'new', 'packed', 'cancelled'];

export default function DemoAdminPage() {
  const key = (new URLSearchParams(window.location.search).get('s') || 'fashionhub').replace(/[^a-z0-9-]/gi, '');
  const [ready, setReady] = useState<'' | 'ok' | 'missing'>('');
  useEffect(() => {
    const out = () => { window.location.href = '/demos'; };
    window.addEventListener('rose-admin-exit', out);
    return () => window.removeEventListener('rose-admin-exit', out);
  }, []);
  useEffect(() => {
    void loadDemos().then((all) => {
      const d = all[key];
      if (!d) return setReady('missing');
      const store = {
        id: 'demo-store', owner_id: 'demo-owner', slug: key, name: d.name, tagline: d.tagline, logo: d.logo, logo_url: '', color: d.color, accent: d.accent, template: key,
        city: 'Dhaka', phone: '01700000000', email: 'demo@myrosebd.com', address: 'Dhaka, Bangladesh', licence: '', note: d.note, whatsapp: '01700000000',
        delivery_inside: 60, delivery_outside: 120, delivery_kg_inside: 15, delivery_kg_outside: 20, banners: d.banners, trust: d.trust, offer_banners: [],
        pay_numbers: { bkash: '01700000000', nagad: '01700000000' }, published: true, suspended: false, print_settings: {}, subdomain_ready: true, custom_domain: null, domain_ready: false, seo: {},
        created_at: new Date(Date.now() - 90 * 864e5).toISOString(),
      };
      const cats = d.categories.map((c, i) => ({ id: `cat-${i}`, store_id: store.id, name: c[0], icon: c[1], sort: i }));
      const prods = d.products.map((p, i) => ({
        id: `prod-${i}`, store_id: store.id, name: p[0], category_id: cats.find((c) => c.name === p[1])?.id || null, emoji: p[2], price: p[3], old_price: p[4] > p[3] ? p[4] : null,
        stock: [40, 25, 4, 0, 60, 12, 3, 30][i % 8], rx: p[5] === 'rx', options_label: d.options?.label || '', options: d.options?.values || [], sort: i,
        images: p[6] ? [String(p[6])] : [], description: '', short_description: '', specs: {}, active: true, sku: '', seo: {}, weight_kg: 0.5,
        created_at: new Date(Date.now() - (90 - i) * 864e5).toISOString(),
      }));
      // sample orders over the last 60 days, so the dashboard and reports have something to show
      const orders = Array.from({ length: 48 }, (_, i) => {
        const p1 = prods[(i * 7) % prods.length];
        const p2 = i % 3 === 0 ? prods[(i * 11 + 3) % prods.length] : null;
        const items = [{ name: p1.name, q: 1 + (i % 2), price: p1.price }, ...(p2 ? [{ name: p2.name, q: 1, price: p2.price }] : [])];
        const subtotal = items.reduce((a, x) => a + x.q * x.price, 0);
        const [district, upazila] = PLACES[i % PLACES.length];
        const delivery = district === 'Dhaka' ? 60 : 120;
        return {
          id: `ord-${i}`, store_id: store.id, order_no: 1048 - i, customer_name: NAMES[i % NAMES.length], phone: `0171${String(1000000 + i * 7919).slice(-7)}`,
          email: '', address: `House ${10 + i}, Road ${1 + (i % 9)}`, area: upazila, division: district, district, upazila, items, subtotal, delivery, total: subtotal + delivery,
          payment_method: i % 4 === 0 ? 'bkash' : 'cod', trx_id: '', status: i < 3 ? 'new' : STATUS[i % STATUS.length], courier: '', tracking: '', note: '',
          created_at: new Date(Date.now() - (i * 1.25 + 0.1) * 864e5).toISOString(),
        };
      });
      (window as any).__roseDemoDb = makeDemoDb(
        { stores: [store], store_categories: cats, store_products: prods, store_orders: orders, site_settings: [], store_staff: [], store_reviews: [], store_coupons: [], store_expenses: [] },
        {
          is_admin: false, my_staff_stores: [], store_staff_list: [], courier_status: [], get_payment_info: { bkash: '01700000000' },
          // REPORTS: worked out from the sample orders the same way the server does it
          store_report: (a: { p_from?: string; p_to?: string }, t: Record<string, any[]>) => {
            const from = a.p_from || '0000', to = a.p_to || '9999';
            const os = (t.store_orders || []).filter((o) => o.created_at >= from && o.created_at <= to + 'T23:59:59');
            const ok = os.filter((o) => o.status !== 'cancelled' && o.status !== 'returned');
            const by: Record<string, number> = {};
            os.forEach((o) => { by[o.status] = (by[o.status] || 0) + 1; });
            const sales = ok.reduce((x, o) => x + o.subtotal, 0);
            const ps = t.store_products || [];
            const months: Record<string, { mon: string; orders: number; sales: number; gross: number }> = {};
            ok.forEach((o) => { const m = o.created_at.slice(0, 7); months[m] = months[m] || { mon: m, orders: 0, sales: 0, gross: 0 }; months[m].orders++; months[m].sales += o.subtotal; months[m].gross += Math.round(o.subtotal * 0.3); });
            return {
              orders: os.length, by_status: by, sales, delivery_collected: ok.reduce((x, o) => x + o.delivery, 0),
              cod_collected: ok.filter((o) => o.status === 'delivered').reduce((x, o) => x + o.total, 0), cod_waiting: ok.filter((o) => o.status !== 'delivered').reduce((x, o) => x + o.total, 0),
              pipeline: ok.filter((o) => o.status !== 'delivered').length, cogs: Math.round(sales * 0.7), courier_cost: ok.length * 55, return_loss: 0, expenses: {}, expenses_total: 0,
              products: ps.length, stock: ps.reduce((x, p) => x + Number(p.stock || 0), 0), stock_value: ps.reduce((x, p) => x + Number(p.stock || 0) * Number(p.price || 0), 0), missing_cost: ps.length,
              months: Object.values(months).sort((x, y) => (x.mon < y.mon ? -1 : 1)),
            };
          },
          my_website_access: { email: 'demo@myrosebd.com', plan: 'business', ends_at: new Date(Date.now() + 365 * 864e5).toISOString(), products_limit: 1000, staff_limit: 5, stores_limit: 1 },
        },
      );
      setReady('ok');
    });
  }, [key]);
  return (
    <div className="min-h-[100dvh] bg-[#05070B]">
      <div className="fixed inset-x-0 bottom-[62px] z-[65] mx-auto flex max-w-[760px] flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-yellow-400 px-3 py-1.5 text-center text-[12px] font-bold text-black">
        <span>DEMO ADMIN · sample data · changes are not saved</span>
        <a href={`/demos/store.html?s=${key}`} className="underline">Open demo store</a>
        <a href={`/start?d=${key}`} className="rounded bg-black px-2 py-0.5 text-white">Start 5-day free trial</a>
      </div>
      <div className="mx-auto max-w-[760px] px-1 pt-2">
        {ready === 'ok' && <StorePanel userId="demo-owner" forceStoreId="demo-store" />}
        {ready === '' && <p className="p-4 text-sm text-slate-400">Loading…</p>}
        {ready === 'missing' && <p className="p-4 text-sm text-slate-300">This demo was not found. <a className="underline" href="/demos">See all demos</a></p>}
      </div>
    </div>
  );
}
