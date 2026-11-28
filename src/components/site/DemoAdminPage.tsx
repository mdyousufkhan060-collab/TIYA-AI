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

function demoShield() {
  const settings: Record<string, any> = {
    on: true, one_per_hours: 24, max_per_hour: 3, otp: 'risky', advance: true, advance_amount: 150, otp_score: 40, block_score: 80, network: true, courier: true,
    courier_min: 60, vpn: false, foreign_cod: true, max_cod: 5000, speed: true, trap: true, trusted: true,
    block_msg_bn: 'দুঃখিত, এই অর্ডারটি নেওয়া যাচ্ছে না। দোকানে কল করুন।', block_msg_en: "Sorry, this order can't be placed. Please call the shop.",
  };
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const checks = [
    { id: 'c1', at: ago(12), phone: '01712345321', email: '', name: 'Test Asdf', ip: '103.92.84.10', device: 'd9x2k1-a7f3', country: 'BD', total: 7400, payment: 'cod', risk: 100, action: 'block', reasons: ['4 orders from this phone/device in an hour', 'name looks fake'], order_no: null, reviewed: '' },
    { id: 'c2', at: ago(45), phone: '01998765840', email: '', name: 'Rakib Hasan', ip: '37.111.200.4', device: 'd3kq81-b2c9', country: 'BD', total: 2350, payment: 'cod', risk: 61, action: 'advance', reasons: ['ROSE shops: 3 delivered, 6 returned/cancelled'], order_no: null, reviewed: '' },
    { id: 'c3', at: ago(90), phone: '01811223344', email: '', name: 'Sumaiya Akter', ip: '103.4.145.2', device: 'd71mmz-c4d1', country: 'BD', total: 1290, payment: 'cod', risk: 45, action: 'otp_ok', reasons: ['form filled too fast'], order_no: 1047, reviewed: '' },
    { id: 'c4', at: ago(160), phone: '01755501234', email: '', name: 'Jamal Uddin', ip: '45.12.1.9', device: 'd0a8f2-e9e1', country: 'US', total: 3100, payment: 'cod', risk: 75, action: 'duplicate', reasons: ['an order from this phone or Gmail is still running'], order_no: null, reviewed: '' },
  ];
  const blocks: any[] = [{ id: 'b1', kind: 'phone', value: '01700011122', reason: 'returned 4 times', shared: true, added_by: 'demo@myrosebd.com', created_at: ago(3000) }];
  return {
    shield_get: () => ({ settings, sms: { provider: 'alpha', has_key: true, key_end: 'ab12', sender_id: '' }, courier: false, today: { blocked: 7, otp: 3, advance: 2, checked: 41 }, boss: true }),
    shield_checks: (a: { p_all?: boolean }) => (a.p_all ? checks : checks.filter((c) => c.risk > 0)),
    shield_blocklist: () => blocks,
    shield_save: (a: { p_settings?: Record<string, any> }) => Object.assign(settings, a.p_settings || {}),
    shield_block: (a: Record<string, any>) => { blocks.unshift({ id: 'b' + Date.now(), kind: a.p_kind, value: a.p_value, reason: a.p_reason || '', shared: a.p_shared !== false, added_by: 'demo@myrosebd.com', created_at: new Date().toISOString() }); return { ok: true }; },
    shield_unblock: (a: { p_id?: string }) => { const i = blocks.findIndex((b) => b.id === a.p_id); if (i >= 0) blocks.splice(i, 1); return null; },
    shield_review: (a: { p_id?: string; p_mark?: string }) => { const c = checks.find((x) => x.id === a.p_id); if (c) c.reviewed = a.p_mark || ''; return null; },
    store_sms_save: null,
  };
}

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
        { stores: [store], store_categories: cats, store_customers: [], store_products: prods, store_orders: orders, site_settings: [], store_staff: [], store_reviews: [], store_coupons: [], store_expenses: [],
          // AUTO-PILOT (BUSINESS PREMIUM) sample: two rules and three discount asks
          store_autopilot: [{ id: 'ap-1', store_id: store.id, discount_on: true, wait_min: 5, email_on: true, owner_whatsapp: '' }],
          store_discount_rules: prods.slice(0, 2).map((p, i) => ({ id: `dr-${i}`, store_id: store.id, product_id: p.id, max_pct: i ? null : 5, max_tk: i ? 50 : null })),
          store_discount_requests: prods.slice(0, 3).map((p, i) => {
            const pr = Number(p.price) || 0;
            return { id: `dq-${i}`, store_id: store.id, product_id: p.id, product_name: p.name, price: pr, asked_price: Math.round(pr * (i === 2 ? 0.7 : 0.85)), limit_price: i < 2 ? pr - (i ? 50 : Math.floor(pr * 0.05)) : null, status: i === 1 ? 'approved' : 'pending', answer_price: i === 1 ? Math.round(pr * 0.85) : null, decided_via: i === 1 ? 'app' : null, emailed_at: null, created_at: new Date(Date.now() - (i + 1) * 9e5).toISOString() };
          }),
          rose_chat: [] },
        {
          is_admin: false, my_staff_stores: [], store_staff_list: [], courier_status: [], get_payment_info: { bkash: '01700000000' },
          // Ask ROSE in the demo: the design shows at once (nothing is saved)
          store_set_design: (x: { p_design?: Record<string, string> }) => x.p_design || {}, store_undo_design: {}, store_design_allowed: true,
          store_autopilot_allowed: true,
          store_answer_discount: (x: { p_id?: string; p_decision?: string }, t: Record<string, any[]>) => {
            const r = (t.store_discount_requests || []).find((y) => y.id === x.p_id);
            if (!r || r.status !== 'pending') return { ok: false, message: 'Already answered' };
            r.status = x.p_decision === 'yes' ? 'approved' : x.p_decision === 'limit' ? 'limit' : 'rejected';
            r.answer_price = x.p_decision === 'yes' ? r.asked_price : x.p_decision === 'limit' ? r.limit_price : r.price;
            r.decided_via = 'app';
            return { ok: true, status: r.status, price: r.answer_price };
          },
          // ADD ORDER in the demo: the order shows in the list (nothing is saved)
          admin_add_store_order: (x: Record<string, any>, t: Record<string, any[]>) => {
            const items = (x.p_items || []).map((it: any) => { const p = t.store_products.find((y) => y.id === it.id) || {}; return { id: it.id, name: p.name, price: Number(p.price) || 0, q: it.q, opt: it.opt, img: (p.images || [])[0] || '' }; });
            const sub = items.reduce((a: number, i: any) => a + i.price * i.q, 0);
            const del = x.p_area === 'pickup' ? 0 : x.p_area === 'outside' ? 120 : 60;
            const no = 2000 + t.store_orders.length;
            t.store_orders.unshift({ id: `ord-${no}`, store_id: 'demo-store', order_no: no, customer_name: x.p_name, phone: x.p_phone, address: x.p_address, district: x.p_district, upazila: x.p_upazila, area: x.p_area === 'outside' ? 'outside' : 'inside', items, subtotal: sub, delivery: del, total: sub + del - (Number(x.p_discount) || 0), discount: Number(x.p_discount) || 0, payment_method: x.p_payment, trx_id: x.p_trx || '', status: 'new', note: 'Added by admin', created_at: new Date().toISOString(), email: '', payment_status: x.p_paid ? 'paid' : 'none' });
            return { order_no: no };
          },
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
          // ORDER SHIELD in the demo: sample risky orders and a blocklist (nothing is saved)
          ...demoShield(),
          my_website_access: { email: 'demo@myrosebd.com', plan: 'business', ends_at: new Date(Date.now() + 365 * 864e5).toISOString(), products_limit: 1000, staff_limit: 5, stores_limit: 1 },
        },
      );
      setReady('ok');
    });
  }, [key]);
  return (
    <div className="min-h-[100dvh] bg-[#05070B]">
      <div className="fixed inset-x-0 bottom-[62px] z-[65] flex flex-wrap items-center justify-center lg:bottom-0 gap-x-3 gap-y-1 bg-yellow-400 px-3 py-1.5 text-center text-[12px] font-bold text-black">
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
