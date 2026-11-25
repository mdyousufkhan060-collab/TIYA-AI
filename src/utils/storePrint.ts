/**
 * Store Builder printing: courier stickers (labels) and invoices in the size the owner picks.
 * Opens a print window with @page set to that size, so label printers print 1:1.
 */
export type PrintSettings = {
  stk?: string; cw?: number; ch?: number; inv?: string;
  sender?: string; phone?: string; note?: string;
  logo?: boolean; cod?: boolean; items?: boolean; bar?: boolean;
};
export type PrintOrder = {
  order_no: number; customer_name: string; phone: string; address: string; upazila?: string; district?: string; division?: string;
  items: Array<{ name: string; q: number; price: number; opt?: string }>; subtotal?: number; delivery?: number; total: number;
  payment_method: string; trx_id?: string; tracking?: string; created_at?: string;
};

export const STICKER_SIZES: Array<[string, string, number, number]> = [
  ['4x6', '4 × 6 in · 100 × 150 mm (Steadfast, Pathao, RedX)', 100, 150],
  ['4x4', '4 × 4 in · 100 × 100 mm', 100, 100],
  ['3x4', '3 × 4 in · 75 × 100 mm', 75, 100],
  ['3x2', '3 × 2 in · 75 × 50 mm (small)', 75, 50],
  ['a6', 'A6 · 105 × 148 mm', 105, 148],
  ['custom', 'Custom size', 0, 0],
];
export const INVOICE_SIZES: Array<[string, string]> = [['a4', 'A4'], ['a5', 'A5'], ['pos80', 'POS roll 80 mm'], ['pos58', 'POS roll 58 mm']];

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const tk = (n: number) => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export function stickerSize(s: PrintSettings): [number, number] {
  const f = STICKER_SIZES.find((x) => x[0] === (s.stk || '4x6')) || STICKER_SIZES[0];
  return f[0] === 'custom' ? [Number(s.cw) || 100, Number(s.ch) || 150] : [f[2], f[3]];
}

function barcode(no: number) {
  const s = String(no) + '7';
  let x = 0;
  let out = '';
  for (let i = 0; i < 46; i++) {
    const w = 1 + ((s.charCodeAt(i % s.length) + i * 7) % 3);
    if (i % 2 === 0) out += `<rect x="${x}" y="0" width="${w}" height="30"/>`;
    x += w;
  }
  return `<svg viewBox="0 0 ${x} 30" preserveAspectRatio="none" style="width:100%;height:9mm">${out}</svg>`;
}

const isCod = (o: PrintOrder) => /cod/i.test(o.payment_method || '');

export function stickerHTML(o: PrintOrder, s: PrintSettings, store: { name: string; logo: string }) {
  const [w, h] = stickerSize(s);
  const small = h < 80;
  const fs = small ? 7.5 : w >= 100 && h >= 140 ? 12.5 : 10;
  const place = [o.address, small ? '' : o.upazila, small ? '' : o.district].filter(Boolean).join(', ');
  return `<div class="stk" style="width:${w}mm;height:${h}mm;font-size:${fs}pt">
    <div class="sh">${s.logo !== false ? `<span class="lg">${esc(store.logo)}</span>` : ''}<div><b>${esc(s.sender || store.name)}</b><div>${esc(s.phone || '')}</div></div><b class="sno">#${o.order_no}</b></div>
    <div class="sto"><small>TO</small><b style="font-size:1.25em">${esc(o.customer_name)}</b><div>📞 ${esc(o.phone)}</div><div>${esc(place)}</div></div>
    ${s.items !== false && !small ? `<div class="sit">${o.items.map((i) => `${esc(i.name)}${i.opt ? ` (${esc(i.opt)})` : ''} × ${i.q}`).join(', ')}</div>` : ''}
    <div class="sf">${s.cod !== false ? `<div class="cod"><small>${isCod(o) ? 'COD · COLLECT' : 'PAID · COLLECT'}</small><b>${tk(isCod(o) ? o.total : 0)}</b></div>` : ''}${s.bar !== false ? `<div style="flex:1;text-align:center">${barcode(o.order_no)}<small>${esc(o.tracking || 'ORDER ' + o.order_no)}</small></div>` : ''}</div>
    ${s.note && !small ? `<div class="snote">${esc(s.note)}</div>` : ''}
  </div>`;
}

export function invoiceHTML(o: PrintOrder, s: PrintSettings, store: { name: string; logo: string; slug: string }) {
  const size = s.inv || 'a4';
  const pos = /pos/.test(size);
  const w = size === 'pos58' ? 58 : size === 'pos80' ? 80 : size === 'a5' ? 148 : 210;
  const rows = o.items.map((i) => `<tr><td>${esc(i.name)}${i.opt ? ` (${esc(i.opt)})` : ''}</td><td align="center">${i.q}</td><td align="right">${tk(i.price * i.q)}</td></tr>`).join('');
  const del = o.delivery ?? o.total - o.items.reduce((a, i) => a + i.price * i.q, 0);
  return `<div class="ivc" style="width:${w}mm;font-size:${pos ? 8 : size === 'a5' ? 9 : 10.5}pt;padding:${pos ? '3mm' : '12mm'}">
    <div style="display:flex;justify-content:space-between;${pos ? 'flex-direction:column;text-align:center;' : ''}border-bottom:2px solid #111;padding-bottom:3mm">
      <div><b style="font-size:1.6em">${esc(store.logo)} ${esc(s.sender || store.name)}</b><div>${esc(s.phone || '')} · myrosebd.com/shop/${esc(store.slug)}</div></div>
      <div style="${pos ? '' : 'text-align:right'}"><b style="font-size:1.4em">INVOICE</b><div>#${o.order_no} · ${new Date(o.created_at || Date.now()).toLocaleDateString('en-GB')}</div></div>
    </div>
    <div style="margin:3mm 0"><b>Bill to:</b> ${esc(o.customer_name)} · ${esc(o.phone)}<br>${esc([o.address, o.upazila, o.district, o.division].filter(Boolean).join(', '))}</div>
    <table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #999"><th align="left">Item</th><th>Qty</th><th align="right">Amount</th></tr>${rows}
      <tr><td colspan="2" align="right">Delivery</td><td align="right">${tk(del)}</td></tr>
      <tr style="border-top:1px solid #111;font-weight:800"><td colspan="2" align="right">Total</td><td align="right">${tk(o.total)}</td></tr></table>
    <p>Payment: <b>${esc((o.payment_method || '').toUpperCase())}${o.trx_id ? ' · ' + esc(o.trx_id) : ''}</b>${isCod(o) ? ' · collect ' + tk(o.total) : ''}</p>
    <p style="text-align:center;color:#555">Thank you for shopping with ${esc(s.sender || store.name)}!</p>
  </div>`;
}

export const PRINT_CSS =
  '.stk{box-sizing:border-box;border:1px dashed #999;padding:3mm;display:flex;flex-direction:column;gap:1.5mm;overflow:hidden;background:#fff;color:#111;font-family:system-ui,Arial,sans-serif}.sh{display:flex;align-items:center;gap:2mm;border-bottom:1.5px solid #111;padding-bottom:1.5mm}.sh>div{flex:1;line-height:1.2}.lg{font-size:1.8em}.sno{font-size:1.15em}.sto{line-height:1.35;flex:1}.sto small,.cod small{display:block;font-size:.75em;letter-spacing:.1em;color:#555}.sit{border-top:1px dashed #999;padding-top:1mm;font-size:.9em}.sf{display:flex;gap:2mm;align-items:center;border-top:1.5px solid #111;padding-top:1.5mm}.cod{border:2px solid #111;border-radius:2mm;padding:1mm 2mm;text-align:center}.cod b{font-size:1.3em}.sf small{font-size:.7em}.snote{text-align:center;font-size:.8em;font-weight:700;background:#111;color:#fff;border-radius:1mm;padding:.8mm}.ivc{box-sizing:border-box;background:#fff;color:#111;line-height:1.45;font-family:system-ui,Arial,sans-serif}.ivc td,.ivc th{padding:1.2mm 0}';

export function printOrders(kind: 'sticker' | 'invoice', orders: PrintOrder[], s: PrintSettings, store: { name: string; logo: string; slug: string }): string | null {
  if (!orders.length) return 'No orders to print';
  const [w, h] = stickerSize(s);
  const inv = s.inv || 'a4';
  const page = kind === 'sticker' ? `${w}mm ${h}mm` : inv === 'a4' ? 'A4' : inv === 'a5' ? 'A5' : `${inv === 'pos58' ? '58mm' : '80mm'} auto`;
  const body = orders.map((o) => `<div class="pg">${kind === 'sticker' ? stickerHTML(o, s, store) : invoiceHTML(o, s, store)}</div>`).join('');
  const win = window.open('', '_blank');
  if (!win) return 'Allow pop-ups to print';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${kind === 'sticker' ? 'Stickers' : 'Invoices'}</title><style>@page{size:${page};margin:0}body{margin:0}.pg{page-break-after:always}${PRINT_CSS}</style></head><body>${body}<script>setTimeout(function(){print()},300)<\/script></body></html>`);
  win.document.close();
  return null;
}
