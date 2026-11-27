import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ADD ORDER (store admin › Orders): the owner or staff types an order that came by phone, Messenger or in the shop.
 * Own file, so the rest of the admin never breaks. The server (admin_add_store_order) takes the prices from the
 * products and the delivery charge from the shop's settings, exactly like website orders; the order starts as NEW.
 */
type P = { id: string; name: string; price: number; stock: number; emoji: string; images: string[]; options: string[]; options_label: string; active: boolean };
type Line = { p: P; q: number; opt: string };
type StoreLite = { id: string; delivery_inside: number; delivery_outside: number; pay_numbers?: Record<string, string> };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const cap = 'text-[11px] font-bold tracking-wider text-teal-300';
const tk = (n: number) => `${Math.round(n).toLocaleString('en-IN')} Tk`;
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${on ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-300'}`;

export const AddOrderForm: React.FC<{ store: StoreLite; onClose: () => void; onSaved: (no: number) => void }> = ({ store, onClose, onSaved }) => {
  const [prods, setProds] = useState<P[]>([]);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [where, setWhere] = useState<'inside' | 'outside' | 'pickup'>('inside');
  const [pay, setPay] = useState('cod');
  const [trx, setTrx] = useState('');
  const [paid, setPaid] = useState(false);
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void supabase.from('store_products').select('id,name,price,stock,emoji,images,options,options_label,active').eq('store_id', store.id).order('sort').then(({ data }) => setProds((data as P[]) || []));
  }, [store.id]);

  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return prods.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, prods]);

  const add = (p: P) => {
    setLines((l) => (l.some((x) => x.p.id === p.id) ? l.map((x) => (x.p.id === p.id ? { ...x, q: x.q + 1 } : x)) : [...l, { p, q: 1, opt: p.options?.[0] || '' }]));
    setQ('');
  };
  const sub = lines.reduce((a, l) => a + Number(l.p.price) * l.q, 0);
  // shown here as a guide; the server works out the exact charge (weight based) when it saves
  const del = where === 'pickup' ? 0 : where === 'outside' ? Number(store.delivery_outside || 0) : Number(store.delivery_inside || 0);
  const disc = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, sub + del - disc);

  const save = async () => {
    setMsg('');
    if (name.trim().length < 2) return setMsg('Write the customer name.');
    if (!/^01[3-9]\d{8}$/.test(phone)) return setMsg('Write a correct 11-digit phone (01XXXXXXXXX).');
    if (address.trim().length < 3) return setMsg('Write the address.');
    if (!lines.length) return setMsg('Add at least one product.');
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_add_store_order', {
      p_store: store.id, p_name: name, p_phone: phone, p_district: district, p_upazila: area, p_address: address, p_area: where,
      p_items: lines.map((l) => ({ id: l.p.id, q: l.q, opt: l.opt })), p_payment: pay, p_trx: trx, p_discount: disc, p_note: note, p_paid: paid || pay === 'shop',
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    onSaved(Number((data as { order_no?: number } | null)?.order_no || 0));
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={onClose} className="flex items-center gap-1 px-1 text-[11px] font-bold tracking-wider text-teal-400">
        <ArrowLeft className="h-3.5 w-3.5" /> ORDERS
      </button>
      <p className="px-1 text-[15px] font-extrabold text-white">ADD ORDER</p>

      <div className={box + ' space-y-2'}>
        <p className={cap}>CUSTOMER</p>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
        <input className={input} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="Phone 01XXXXXXXXX" />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" />
          <input className={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area / upazila" />
        </div>
        <textarea className={input} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address (house, road, area)" />
      </div>

      <div className={box + ' space-y-2'}>
        <p className={cap}>PRODUCTS</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className={input + ' pl-9'} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product by name…" />
        </div>
        {found.length > 0 && (
          <div className="space-y-1">
            {found.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2 text-left">
                {p.images?.[0]?.startsWith('http') ? <img src={p.images[0]} alt="" className="h-9 w-9 rounded-md object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-lg">{p.emoji || '📦'}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-white">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">{tk(p.price)} · stock {p.stock}{p.active ? '' : ' · hidden'}</span>
                </span>
                <Plus className="h-4 w-4 text-teal-300" />
              </button>
            ))}
          </div>
        )}
        {q.trim() && !found.length && <p className="text-[11.5px] text-slate-500">No product with this name.</p>}
        {lines.map((l, i) => (
          <div key={l.p.id} className="space-y-1.5 rounded-lg border border-teal-400/30 bg-teal-500/5 p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white">{l.p.name}</span>
              <button type="button" aria-label="Less" onClick={() => setLines((x) => x.map((y, j) => (j === i ? { ...y, q: Math.max(1, y.q - 1) } : y)))} className="grid h-7 w-7 place-items-center rounded-md border border-white/15 text-white"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-6 text-center text-[13px] font-bold text-white">{l.q}</span>
              <button type="button" aria-label="More" onClick={() => setLines((x) => x.map((y, j) => (j === i ? { ...y, q: y.q + 1 } : y)))} className="grid h-7 w-7 place-items-center rounded-md border border-white/15 text-white"><Plus className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Remove" onClick={() => setLines((x) => x.filter((_, j) => j !== i))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button>
            </div>
            {l.p.options?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {l.p.options.map((o) => (
                  <button key={o} type="button" onClick={() => setLines((x) => x.map((y, j) => (j === i ? { ...y, opt: o } : y)))} className={chip(l.opt === o)}>{o}</button>
                ))}
              </div>
            )}
            <p className="text-right text-[11.5px] text-slate-300">{tk(l.p.price)} × {l.q} = <b className="text-white">{tk(Number(l.p.price) * l.q)}</b></p>
          </div>
        ))}
      </div>

      <div className={box + ' space-y-2'}>
        <p className={cap}>DELIVERY · PAYMENT</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setWhere('inside')} className={chip(where === 'inside')}>Inside Dhaka {tk(store.delivery_inside || 0)}</button>
          <button type="button" onClick={() => setWhere('outside')} className={chip(where === 'outside')}>Outside Dhaka {tk(store.delivery_outside || 0)}</button>
          <button type="button" onClick={() => setWhere('pickup')} className={chip(where === 'pickup')}>Pickup from shop</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[['cod', 'COD'], ['bkash', 'bKash'], ['nagad', 'Nagad'], ['rocket', 'Rocket'], ['shop', 'Paid in shop']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPay(k)} className={chip(pay === k)}>{l}</button>
          ))}
        </div>
        {['bkash', 'nagad', 'rocket'].includes(pay) && (
          <>
            <input className={input} value={trx} onChange={(e) => setTrx(e.target.value.trim().toUpperCase())} placeholder="TrxID (optional)" />
            <label className="flex items-center gap-2 text-[12px] text-slate-200"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Money already received</label>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Discount (Tk)" />
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        </div>
        <div className="space-y-0.5 border-t border-white/10 pt-2 text-[12.5px] text-slate-300">
          <p className="flex justify-between"><span>Products</span><span>{tk(sub)}</span></p>
          <p className="flex justify-between"><span>Delivery</span><span>{tk(del)}</span></p>
          {disc > 0 && <p className="flex justify-between"><span>Discount</span><span>− {tk(disc)}</span></p>}
          <p className="flex justify-between text-[15px] font-extrabold text-white"><span>Total</span><span>{tk(total)}</span></p>
          <p className="text-[10.5px] text-slate-500">Prices and delivery are checked again when saving (extra weight is added like on the website).</p>
        </div>
      </div>

      {msg && <p className="px-1 text-[12px] text-rose-300">{msg}</p>}
      <button type="button" onClick={() => void save()} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[13px] font-bold text-white disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} SAVE ORDER
      </button>
    </div>
  );
};
