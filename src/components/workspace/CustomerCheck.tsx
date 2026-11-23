import React, { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Search, ShieldAlert, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * CUSTOMER CHECK: type a mobile number → delivery history across all ROSE businesses,
 * courier by courier (orders, delivered, returned, cancelled).
 * Good history → Cash on Delivery. Risky → ask for an advance (ready WhatsApp message).
 */
export const COURIER_BRANDS: Record<string, { name: string; color: string; text: string }> = {
  pathao: { name: 'Pathao', color: '#E21E2F', text: '#fff' },
  steadfast: { name: 'Steadfast', color: '#0FA958', text: '#fff' },
  redx: { name: 'RedX', color: '#E3262D', text: '#fff' },
  paperfly: { name: 'Paperfly', color: '#1E73BE', text: '#fff' },
  sundarban: { name: 'Sundarban', color: '#0B6E3A', text: '#fff' },
  ecourier: { name: 'eCourier', color: '#F7941D', text: '#111' },
  sa_paribahan: { name: 'SA Paribahan', color: '#1F3C88', text: '#fff' },
  own: { name: 'Own delivery', color: '#64748B', text: '#fff' },
  unknown: { name: 'No courier set', color: '#334155', text: '#fff' },
};

export const CourierBadge: React.FC<{ id: string; size?: 'sm' | 'md' }> = ({ id, size = 'md' }) => {
  const b = COURIER_BRANDS[id] || COURIER_BRANDS.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] font-extrabold tracking-wide ${size === 'sm' ? 'h-6 px-2 text-[10px]' : 'h-8 px-2.5 text-[11px]'}`}
      style={{ background: b.color, color: b.text, boxShadow: `0 4px 12px -6px ${b.color}` }}
    >
      <Truck className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> {b.name.toUpperCase()}
    </span>
  );
};

interface Hist {
  ok: boolean;
  error?: string;
  total: number;
  delivered: number;
  returned: number;
  cancelled: number;
  mine: number;
  by_courier: Array<{ courier: string; total: number; delivered: number; returned: number; cancelled: number; last: string }>;
}

export const CustomerCheck: React.FC<{ shopName?: string | null; bkash?: string | null }> = ({ shopName, bkash }) => {
  const [phone, setPhone] = useState('');
  const [advance, setAdvance] = useState('200');
  const [busy, setBusy] = useState(false);
  const [h, setH] = useState<Hist | null>(null);
  const [err, setErr] = useState('');

  const check = async () => {
    setBusy(true);
    setErr('');
    setH(null);
    const { data, error } = await supabase.rpc('customer_courier_history', { p_phone: phone });
    setBusy(false);
    if (error) return setErr(error.message);
    if (!data?.ok) return setErr(data?.error || 'Could not check.');
    setH(data as Hist);
  };

  const finished = h ? h.delivered + h.returned + h.cancelled : 0;
  const successPct = h && finished ? Math.round((h.delivered / finished) * 100) : null;
  const risky = h ? h.returned + h.cancelled >= 2 || (successPct !== null && successPct < 70) : false;
  const verdict = !h ? null : h.total === 0 ? 'new' : risky ? 'risky' : 'good';

  const waNumber = phone.replace(/\D/g, '').replace(/^0/, '880');
  const advanceMsg = `আসসালামু আলাইকুম। ${shopName || 'আমাদের শপ'}-এ অর্ডার করার জন্য ধন্যবাদ। অর্ডারটি কনফার্ম করতে ${advance} টাকা অগ্রিম পাঠাতে হবে${
    bkash ? ` (bKash: ${bkash})` : ''
  }। টাকা পাঠিয়ে লেনদেন নম্বর (TrxID) জানালেই অর্ডার কুরিয়ারে পাঠানো হবে। বাকি টাকা ডেলিভারির সময় দেবেন।`;
  const codMsg = `আসসালামু আলাইকুম। ${shopName || 'আমাদের শপ'}-এ আপনার অর্ডার কনফার্ম হয়েছে। ক্যাশ অন ডেলিভারিতে খুব শিগগিরই পৌঁছে যাবে। ধন্যবাদ!`;

  return (
    <div className="space-y-3">
      <div className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-4">
        <p className="text-[10px] font-semibold tracking-wider text-slate-400">CUSTOMER MOBILE NUMBER</p>
        <div className="mt-1.5 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void check()}
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            className="h-11 min-w-0 flex-1 rounded-[4px] border border-white/12 bg-[#0B0F16] px-3 font-mono text-sm text-white focus:border-teal-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || phone.replace(/\D/g, '').length < 10}
            onClick={check}
            className="flex h-11 items-center gap-1.5 rounded-[4px] bg-teal-500 px-4 text-xs font-bold text-black disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} CHECK
          </button>
        </div>
        <p className="mt-2 text-[10.5px] text-slate-500">
          Checks this number's orders in every ROSE business (counts only, no names). More businesses on ROSE = better history.
        </p>
      </div>

      {err && <p className="rounded-[4px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}

      {h && (
        <>
          <div
            className={`flex items-center gap-3 rounded-[4px] border p-4 ${
              verdict === 'risky' ? 'border-rose-500/50 bg-rose-500/10' : verdict === 'good' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-sky-500/40 bg-sky-500/10'
            }`}
          >
            {verdict === 'risky' ? <ShieldAlert className="h-8 w-8 text-rose-300" /> : <CheckCircle2 className="h-8 w-8 text-emerald-300" />}
            <div>
              <p className="text-sm font-extrabold text-white">
                {verdict === 'risky' ? 'RISKY · ASK FOR ADVANCE' : verdict === 'good' ? 'GOOD · CASH ON DELIVERY OK' : 'NEW CUSTOMER · NO HISTORY'}
              </p>
              <p className="text-[11.5px] text-slate-300">
                {h.total} orders · {h.delivered} delivered · {h.returned} returned · {h.cancelled} cancelled
                {successPct !== null ? ` · success ${successPct}%` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              ['ORDERS', h.total, 'text-white'],
              ['DELIVERED', h.delivered, 'text-emerald-300'],
              ['RETURNED', h.returned, 'text-rose-300'],
              ['CANCELLED', h.cancelled, 'text-amber-300'],
            ].map(([k, v, c]) => (
              <div key={k as string} className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-2.5 text-center">
                <p className="text-[9px] font-bold tracking-wider text-slate-500">{k}</p>
                <p className={`font-mono text-xl font-extrabold ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          {h.by_courier.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400">BY COURIER (LATEST FIRST)</p>
              {h.by_courier.map((c, i) => {
                const done = c.delivered + c.returned + c.cancelled;
                const pct = done ? Math.round((c.delivered / done) * 100) : 0;
                return (
                  <div key={c.courier} className="flex items-center gap-3 rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2.5">
                    <span className="w-5 text-center font-mono text-[11px] text-slate-500">{i + 1}</span>
                    <CourierBadge id={c.courier} size="sm" />
                    <span className="min-w-0 flex-1 text-[11px] text-slate-300">
                      {c.total} orders · {c.delivered} delivered · {c.returned} returned
                    </span>
                    <span className={`font-mono text-xs font-bold ${pct >= 70 ? 'text-emerald-300' : 'text-rose-300'}`}>{done ? `${pct}%` : '—'}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
            <p className="text-[10px] font-semibold tracking-wider text-slate-400">MESSAGE THE CUSTOMER</p>
            {verdict === 'risky' && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                ADVANCE (TK)
                <input
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ''))}
                  className="h-9 w-24 rounded-[4px] border border-white/12 bg-[#0B0F16] px-2 font-mono text-white focus:outline-none"
                />
              </label>
            )}
            <p className="whitespace-pre-wrap rounded-[4px] bg-black/30 p-2.5 text-[12px] leading-relaxed text-slate-200">{verdict === 'risky' ? advanceMsg : codMsg}</p>
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(verdict === 'risky' ? advanceMsg : codMsg)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[#25D366] text-xs font-extrabold text-black"
            >
              <MessageCircle className="h-4 w-4" /> SEND ON WHATSAPP
            </a>
          </div>
        </>
      )}
    </div>
  );
};
