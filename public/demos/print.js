/* ROSE Store Builder printing (built from src/utils/storePrint.ts). Do not edit by hand. */
var ROSE_PRINT = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/utils/storePrint.ts
  var storePrint_exports = {};
  __export(storePrint_exports, {
    INVOICE_SIZES: () => INVOICE_SIZES,
    PRINT_CSS: () => PRINT_CSS,
    STICKER_SIZES: () => STICKER_SIZES,
    barcodeSVG: () => barcodeSVG,
    invoiceDims: () => invoiceDims,
    invoiceHTML: () => invoiceHTML,
    invoicePreviewHTML: () => invoicePreviewHTML,
    printOrders: () => printOrders,
    printPage: () => printPage,
    stickerHTML: () => stickerHTML,
    stickerSize: () => stickerSize
  });
  var STICKER_SIZES = [
    ["100x70", "100 \xD7 70 mm (recommended)", 100, 70],
    ["4x6", "100 \xD7 150 mm (4 \xD7 6 in \xB7 Steadfast, Pathao, RedX)", 100, 150],
    ["4x4", "100 \xD7 100 mm (4 \xD7 4 in)", 100, 100],
    ["3x4", "75 \xD7 100 mm (3 \xD7 4 in)", 75, 100],
    ["3x2", "75 \xD7 50 mm (small)", 75, 50],
    ["a6", "A6 \xB7 105 \xD7 148 mm", 105, 148],
    ["custom", "Custom size", 0, 0]
  ];
  var INVOICE_SIZES = [["a4", "A4 \xB7 210 \xD7 297 mm"], ["a5", "A5 \xB7 148 \xD7 210 mm"], ["a6", "A6 \xB7 105 \xD7 148 mm"], ["pos80", "POS roll 80 mm"], ["pos58", "POS roll 58 mm"]];
  var esc = (t) => String(t != null ? t : "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var tk = (n) => "\u09F3" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  var isCod = (o) => /cod/i.test(o.payment_method || "");
  var STATUS = { new: "Pending", confirmed: "Confirmed", packed: "Ready to ship", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned" };
  var PAY = { cod: "Cash on Delivery", bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", card: "Card", bank: "Bank" };
  function stickerSize(s) {
    const f = STICKER_SIZES.find((x) => x[0] === (s.stk || "100x70")) || STICKER_SIZES[0];
    return f[0] === "custom" ? [Number(s.cw) || 100, Number(s.ch) || 70] : [f[2], f[3]];
  }
  var C128 = [
    "212222",
    "222122",
    "222221",
    "121223",
    "121322",
    "131222",
    "122213",
    "122312",
    "132212",
    "221213",
    "221312",
    "231212",
    "112232",
    "122132",
    "122231",
    "113222",
    "123122",
    "123221",
    "223211",
    "221132",
    "221231",
    "213212",
    "223112",
    "312131",
    "311222",
    "321122",
    "321221",
    "312212",
    "322112",
    "322211",
    "212123",
    "212321",
    "232121",
    "111323",
    "131123",
    "131321",
    "112313",
    "132113",
    "132311",
    "211313",
    "231113",
    "231311",
    "112133",
    "112331",
    "132131",
    "113123",
    "113321",
    "133121",
    "313121",
    "211331",
    "231131",
    "213113",
    "213311",
    "213131",
    "311123",
    "311321",
    "331121",
    "312113",
    "312311",
    "332111",
    "314111",
    "221411",
    "431111",
    "111224",
    "111422",
    "121124",
    "121421",
    "141122",
    "141221",
    "112214",
    "112412",
    "122114",
    "122411",
    "142112",
    "142211",
    "241211",
    "221114",
    "413111",
    "241112",
    "134111",
    "111242",
    "121142",
    "121241",
    "114212",
    "124112",
    "124211",
    "411212",
    "421112",
    "421211",
    "212141",
    "214121",
    "412121",
    "111143",
    "111341",
    "131141",
    "114113",
    "114311",
    "411113",
    "411311",
    "113141",
    "114131",
    "311141",
    "411131",
    "211412",
    "211214",
    "211232",
    "2331112"
  ];
  function barcodeSVG(text, heightMm = 9) {
    const s = String(text).replace(/[^\x20-\x7e]/g, "").slice(0, 40) || "0";
    const codes = [104];
    for (const ch of s) codes.push(ch.charCodeAt(0) - 32);
    let sum = 104;
    for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
    codes.push(sum % 103, 106);
    let x = 0;
    let rects = "";
    for (const c of codes) {
      const p = C128[c];
      for (let i = 0; i < p.length; i++) {
        const w = Number(p[i]);
        if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
        x += w;
      }
    }
    return `<svg class="bc" viewBox="-6 0 ${x + 12} 40" preserveAspectRatio="none" style="width:100%;height:${heightMm}mm;display:block" fill="#000">${rects}</svg>`;
  }
  var logoBox = (st, size) => st.logo_url ? `<img src="${esc(st.logo_url)}" alt="" style="height:${size};max-width:${size === "14mm" ? "30mm" : "22mm"};object-fit:contain">` : `<span style="font-size:${size === "14mm" ? "10mm" : "6mm"};line-height:1">${esc(st.logo || "\u{1F6CD}\uFE0F")}</span>`;
  var orderCode = (st, o) => (st.slug || st.name || "ROSE").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() + String(o.order_no);
  var place = (o) => [o.address, o.upazila, o.district].filter((x) => x && x !== "\u2014").join(", ");
  function stickerHTML(o, s, st) {
    const [w, h] = stickerSize(s);
    const tall = h >= 100;
    const tiny = h < 60;
    const fs = tiny ? 6.6 : w >= 100 && h >= 140 ? 10.5 : 8.4;
    const cod = isCod(o);
    const code = orderCode(st, o);
    const qty = o.items.reduce((a, i) => a + (Number(i.q) || 1), 0);
    return `<div class="stk" style="width:${w}mm;height:${h}mm;font-size:${fs}pt">
    <div class="s1">
      <div class="sbrand">${s.logo !== false ? logoBox(st, tall ? "12mm" : "8mm") : ""}<div><b>${esc(s.sender || st.name)}</b><small>${esc(s.phone || st.whatsapp || st.phone || "")}</small></div></div>
      ${s.bar !== false ? `<div class="sbar">${barcodeSVG(code, tall ? 10 : 7)}<small>${esc(code)}</small></div>` : `<b class="sno">#${esc(o.order_no)}</b>`}
    </div>
    <div class="s2">
      <div class="sto"><small>CONSIGNEE</small><b class="nm">${esc(o.customer_name)}</b><div>\u{1F4DE} <b>${esc(o.phone)}</b></div><div class="ad">${esc(place(o))}</div></div>
      ${s.cod !== false ? `<div class="scod"><small>${cod ? "COD" : "PAID"}</small><b>${tk(cod ? o.total : 0)}</b></div>` : ""}
    </div>
    ${s.items !== false && !tiny ? `<div class="sit">${o.items.map((i) => `${esc(i.name)}${i.opt ? ` (${esc(i.opt)})` : ""} \xD7${i.q}`).join(" \xB7 ")}</div>` : ""}
    <div class="s3"><div><small>COURIER PARTNER</small><b>${esc(o.courier ? o.courier.replace(/^\w/, (c) => c.toUpperCase()) : "\u2014")}</b></div><div><small>TRACKING NO</small><b>${esc(o.tracking || "\u2014")}</b></div></div>
    ${tall && o.tracking && s.bar !== false ? `<div class="sbar2">${barcodeSVG(o.tracking, 12)}<b>${esc(o.tracking)}</b></div>` : ""}
    <div class="s4"><div><small>WEIGHT</small><b>____ kg</b></div><div><small>PACKAGE</small><b>1/1 \xB7 ${qty} pcs</b></div><div><small>ORDER TYPE</small><b>${cod ? "COD" : "PREPAID"}</b></div></div>
    ${s.note && !tiny ? `<div class="snote">${esc(s.note)}</div>` : ""}
  </div>`;
  }
  function invoiceHTML(o, s, st) {
    var _a, _b;
    const size = s.inv || "a4";
    const pos = /pos/.test(size);
    const w = size === "pos58" ? 58 : size === "pos80" ? 80 : size === "a6" ? 105 : size === "a5" ? 148 : 210;
    const fs = pos ? 7.5 : size === "a6" ? 6.8 : size === "a5" ? 8.2 : 9.6;
    const pad = pos ? "3mm" : size === "a6" ? "5mm" : size === "a5" ? "8mm" : "11mm";
    const sub = (_a = o.subtotal) != null ? _a : o.items.reduce((a, i) => a + i.price * i.q, 0);
    const del = (_b = o.delivery) != null ? _b : o.total - sub;
    const pn = st.pay_numbers || {};
    const contacts = [
      ["\u{1F4AC}", "WHATSAPP", st.whatsapp || st.phone || s.phone || ""],
      ["\u{1F4F1}", pn.bkash ? "BKASH" : pn.nagad ? "NAGAD" : "PHONE", pn.bkash || pn.nagad || st.phone2 || ""],
      ["\u2709\uFE0F", "EMAIL", st.email || ""],
      ["\u2709\uFE0F", "EMAIL 2", st.email2 || ""]
    ].filter((c) => c[2]);
    const dt = new Date(o.created_at || Date.now());
    const site = st.custom_domain || (st.slug ? `${st.slug}.myrosebd.com` : "");
    const photos = s.photos !== false && !pos;
    const cell = (ic, k, v, span = 1) => `<div class="ci" style="grid-column:span ${span}"><span>${ic}</span><b>${k}:</b> ${esc(v || "\u2014")}</div>`;
    return `<div class="ivc${pos ? " pos" : ""}" style="width:${w}mm;font-size:${fs}pt;padding:${pad}">
    <div class="ih">
      <div class="ilogo">${logoBox(st, pos ? "8mm" : "14mm")}<div><b class="inm">${esc(s.sender || st.name)}</b>${st.name_bn ? `<div class="ibn">${esc(st.name_bn)}</div>` : ""}${site ? `<small>${esc(site)}</small>` : ""}</div></div>
      ${pos ? "" : `<div class="icards">${contacts.map((c) => `<div><span>${c[0]}</span><small>${c[1]}</small><b>${esc(c[2])}</b></div>`).join("")}</div>`}
    </div>
    ${pos ? `<div style="text-align:center">${contacts.map((c) => esc(c[2])).join(" \xB7 ")}</div>` : ""}
    ${st.address ? `<div class="iaddr">\u{1F4CD} ${esc(st.address)}</div>` : ""}
    <div class="ititle"><b>INVOICE</b><span>#${esc(o.order_no)} \xB7 ${dt.toLocaleDateString("en-GB")}</span></div>
    <div class="isec">\u{1F464} CUSTOMER INFORMATION</div>
    <div class="igrid">
      ${cell("\u{1F464}", "Name", o.customer_name, 2)}${cell("\u{1F4DE}", "Phone", o.phone, pos ? 2 : 1)}
      ${cell("\u{1F4CD}", "Address", o.address, pos ? 2 : 3)}
      ${cell("\u{1F9ED}", "Division", o.division || "")}${cell("\u{1F5FA}\uFE0F", "District", o.district || "")}${cell("\u{1F3D8}\uFE0F", "Upazila", o.upazila || "", pos ? 2 : 1)}
      ${cell("\u2709\uFE0F", "Email", o.email || "", pos ? 2 : 1)}${cell("#", "Order ID", String(o.order_no))}${cell("\u{1F4C5}", "Date", dt.toLocaleDateString("en-GB"), pos ? 2 : 1)}
      ${cell("\u{1F4B3}", "Payment", (PAY[(o.payment_method || "").toLowerCase()] || o.payment_method || "").toUpperCase() + (o.trx_id ? " \xB7 " + o.trx_id : ""), pos ? 2 : 1)}${cell("\u23F1\uFE0F", "Status", STATUS[o.status || "new"] || o.status || "Pending", 2)}
    </div>
    <table class="itbl"><thead><tr><th style="text-align:left">PRODUCT</th>${pos ? "" : "<th>VARIANT / SIZE</th>"}<th>QTY</th>${pos ? "" : "<th>UNIT PRICE</th>"}<th style="text-align:right">TOTAL</th></tr></thead><tbody>
      ${o.items.map((i) => `<tr><td><div class="ip">${photos && i.img ? `<img src="${esc(i.img)}" alt="">` : ""}<b>${esc(i.name)}</b>${pos && i.opt ? ` (${esc(i.opt)})` : ""}</div></td>${pos ? "" : `<td align="center">${esc(i.opt || "\u2014")}</td>`}<td align="center">${i.q}</td>${pos ? "" : `<td align="center">${tk(i.price)}</td>`}<td align="right">${tk(i.price * i.q)}</td></tr>`).join("")}
    </tbody></table>
    <div class="ibot">
      ${pos ? "" : `<div class="ibox"><div class="ibh">\u{1F69A} COURIER INFORMATION</div><p><span>Courier:</span><b>${esc(o.courier ? o.courier.replace(/^\w/, (c) => c.toUpperCase()) : "\u2014")}</b></p><p><span>Status:</span><b>${esc(STATUS[o.status || "new"] || "Pending")}</b></p><p><span>Tracking ID:</span><b>${esc(o.tracking || "\u2014")}</b></p><p><span>Delivery area:</span><b>${o.area === "outside" ? "Outside Dhaka" : o.area === "inside" ? "Inside Dhaka" : esc(o.district || "\u2014")}</b></p></div>`}
      <div class="ibox"><div class="ibh">\u{1F9FE} BILLING SUMMARY</div><p><span>Subtotal:</span><b>${tk(sub)}</b></p><p><span>Delivery:</span><b>${tk(del)}</b></p><p class="gt"><span>GRAND TOTAL:</span><b>${tk(o.total)}</b></p>${isCod(o) ? `<p><span>Collect (COD):</span><b>${tk(o.total)}</b></p>` : ""}</div>
    </div>
    ${pos ? "" : `<div class="ibot"><div class="ibox"><div class="ibh">\u{1F4DD} NOTES</div><div class="small">${esc(o.note || "\u09AA\u09A3\u09CD\u09AF \u09AC\u09C1\u099D\u09C7 \u09A8\u09BF\u09AF\u09BC\u09C7 \u099A\u09C7\u0995 \u0995\u09B0\u09C7 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u0995\u09B0\u09AC\u09C7\u09A8\u0964")}</div></div><div class="ibox"><div class="ibh">\u{1F4C4} TERMS & CONDITIONS</div><div class="small">${esc(s.terms || "This is a computer generated invoice. No physical signature required.")}</div></div></div>`}
    ${barcodeSVG(orderCode(st, o), pos ? 7 : 8)}
    <div class="ithanks">THANK YOU FOR YOUR ORDER!</div>
  </div>`;
  }
  var PRINT_CSS = `
.stk,.ivc{box-sizing:border-box;background:#fff;color:#111;font-family:system-ui,'Noto Sans Bengali',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stk{border:1px solid #111;padding:2.2mm;display:flex;flex-direction:column;justify-content:space-between;gap:1.2mm;overflow:hidden;line-height:1.2}
.stk small{display:block;font-size:.68em;letter-spacing:.06em;color:#444;font-weight:600}
.s1{display:flex;gap:2mm;align-items:center;border-bottom:1.4px solid #111;padding-bottom:1.2mm}
.sbrand{display:flex;gap:1.5mm;align-items:center;flex:1;min-width:0}.sbrand b{font-size:1.25em;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbar{width:44%;text-align:center}.sbar small,.sbar2 b{text-align:center;font-size:.75em;letter-spacing:.08em;color:#111}.sno{font-size:1.2em}
.s2{display:flex;gap:2mm;min-height:0}.sto{flex:1;min-width:0}.sto .nm{font-size:1.3em;display:block}.sto .ad{font-size:.95em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.scod{border:1.6px solid #111;border-radius:1.5mm;padding:1mm 2mm;text-align:center;align-self:center;min-width:22mm}.scod small{font-size:.9em;color:#111}.scod b{font-size:1.55em;display:block}
.sit{font-size:.8em;border-top:1px dashed #888;padding-top:.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s3,.s4{display:grid;grid-template-columns:1fr 1fr;border-top:1.2px solid #111}.s4{grid-template-columns:1fr 1fr 1fr}
.s3>div,.s4>div{padding:.8mm 1mm}.s3>div+div,.s4>div+div{border-left:1px solid #111}.s3 b,.s4 b{font-size:.98em}
.sbar2{border-top:1px solid #111;padding-top:1mm;text-align:center}
.snote{text-align:center;font-size:.8em;font-weight:700;background:#111;color:#fff;border-radius:1mm;padding:.6mm}
.ivc{line-height:1.4;border:1px solid #e5e7eb}.ivc .small{font-size:.9em;color:#444}
.ih{display:flex;gap:4mm;align-items:center;justify-content:space-between}.ilogo{display:flex;gap:2.5mm;align-items:center;min-width:0}.inm{font-size:1.9em;letter-spacing:.02em;display:block;line-height:1.1}.ibn{font-weight:600;color:#334155}.ilogo small{color:#64748b}
.icards{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm;flex:1;max-width:62%}.icards>div{border:1px solid #e5e7eb;border-radius:1.5mm;padding:1.2mm 2mm;display:grid;grid-template-columns:auto 1fr;column-gap:1.5mm}.icards span{grid-row:span 2;align-self:center}.icards small{font-size:.72em;color:#64748b;font-weight:700}.icards b{font-size:.92em;overflow-wrap:anywhere}
.iaddr{margin-top:2.5mm;border:1px solid #e5e7eb;background:#f8fafc;border-radius:1.5mm;padding:1.2mm 2mm;text-align:center;font-size:.9em}
.ititle{display:flex;justify-content:space-between;align-items:baseline;margin-top:2.5mm}.ititle b{font-size:1.5em;letter-spacing:.15em}
.isec{font-weight:800;letter-spacing:.06em;border-bottom:2px solid #111;padding:1mm 0;margin-top:2mm}
.igrid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e5e7eb;border-top:0}.ci{padding:1.2mm 2mm;border-top:1px solid #e5e7eb;border-right:1px solid #e5e7eb;font-size:.92em;overflow:hidden}.ci span{margin-right:1mm}
.itbl{width:100%;border-collapse:collapse;margin-top:3mm}.itbl th{background:#111;color:#fff;font-size:.8em;letter-spacing:.05em;padding:1.6mm 1.5mm}.itbl td{border-bottom:1px solid #e5e7eb;padding:1.4mm 1.5mm}
.ip{display:flex;align-items:center;gap:2mm}.ip img{width:10mm;height:10mm;object-fit:cover;border-radius:1mm;border:1px solid #e5e7eb}
.ibot{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-top:3mm}.ibox{border:1px solid #e5e7eb;border-radius:2mm;padding:2mm 2.5mm}.ibh{font-weight:800;font-size:.85em;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;padding-bottom:1mm;margin-bottom:1mm}
.ibox p{display:flex;justify-content:space-between;margin:.6mm 0}.ibox p span{color:#475569}.ibox .gt{border-top:1px solid #111;padding-top:1mm;font-size:1.15em}
.ivc .bc{margin:3mm auto 0;height:8mm;width:55%!important}.ithanks{margin-top:2mm;background:#111;color:#fff;text-align:center;font-weight:800;letter-spacing:.12em;padding:2mm;border-radius:1.5mm}
.ivc.pos{border:0}.ivc.pos .ih{flex-direction:column;text-align:center}.ivc.pos .igrid{grid-template-columns:1fr 1fr}.ivc.pos .ibot{grid-template-columns:1fr}
@media screen and (max-width:640px){.ivc.fluid:not(.pos) .ih{flex-direction:column;align-items:stretch}.ivc.fluid:not(.pos) .icards{max-width:none}.ivc.fluid:not(.pos) .igrid{grid-template-columns:1fr 1fr}.ivc.fluid:not(.pos) .ci{grid-column:span 1!important}.ivc.fluid:not(.pos) .ibot{grid-template-columns:1fr}}
.ivpv{background:#cbd5e1;border-radius:10px;padding:10px;overflow:hidden}.ivpg{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25);margin:0 auto;overflow:hidden}.ivpg .ivc{border:0}
`;
  function invoiceDims(inv) {
    const k = inv || "a4";
    if (k === "pos58") return [58, 0, "POS roll 58 mm wide \xB7 length grows with the items"];
    if (k === "pos80") return [80, 0, "POS roll 80 mm wide \xB7 length grows with the items"];
    if (k === "a6") return [105, 148, "A6 \xB7 105 \xD7 148 mm"];
    if (k === "a5") return [148, 210, "A5 \xB7 148 \xD7 210 mm"];
    return [210, 297, "A4 \xB7 210 \xD7 297 mm"];
  }
  function invoicePreviewHTML(o, s, st, boxPx = 300) {
    const [w, h] = invoiceDims(s.inv);
    const z = Math.min(1, boxPx / (w * 3.78));
    return `<div class="ivpv"><div style="zoom:${z.toFixed(3)}"><div class="ivpg" style="width:${w}mm;${h ? `height:${h}mm` : ""}">${invoiceHTML(o, s, st)}</div></div></div>`;
  }
  function printPage(kind, orders, s, store) {
    const [w, h] = stickerSize(s);
    const inv = s.inv || "a4";
    const [iw, ih] = invoiceDims(inv);
    const roll = kind === "invoice" && !ih;
    const page = kind === "sticker" ? `${w}mm ${h}mm` : roll ? `${iw}mm 297mm` : `${iw}mm ${ih}mm`;
    const fit = roll ? `var m=0;[].forEach.call(document.querySelectorAll('.pg'),function(e){m=Math.max(m,e.scrollHeight)});var st=document.createElement('style');st.textContent='@page{size:${iw}mm '+Math.ceil(m/3.78+2)+'mm;margin:0}';document.head.appendChild(st);` : "";
    const body = orders.map((o) => `<div class="pg">${kind === "sticker" ? stickerHTML(o, s, store) : invoiceHTML(o, s, store)}</div>`).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${kind === "sticker" ? "Stickers" : "Invoices"} \xB7 ${esc(store.name)}</title><style>@page{size:${page};margin:0}body{margin:0}.pg{page-break-after:always;break-after:page;overflow:hidden}.pg:last-child{page-break-after:auto;break-after:auto}.ivc{border:0}${PRINT_CSS}</style></head><body>${body}<script>window.onload=function(){${fit}setTimeout(function(){print()},400)}<\/script></body></html>`;
  }
  function printOrders(kind, orders, s, store) {
    if (!orders.length) return "No orders to print";
    const win = window.open("", "_blank");
    if (!win) return "Allow pop-ups to print";
    win.document.write(printPage(kind, orders, s, store));
    win.document.close();
    return null;
  }
  return __toCommonJS(storePrint_exports);
})();
