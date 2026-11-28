/**
 * Admin › 26 AUTO-PILOT: every BUSINESS PREMIUM shop's Auto-pilot (full access for ROSE admin).
 * LOCKED (owner MD YOUSUF KHAN, Nov 28 2026). Do not change unless the owner asks.
 * OPEN = that shop's WEBSITE ADMIN exactly as the owner sees it (then AUTO-PILOT bar).
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StorePanel } from '../workspace/StorePanel';

type Row = { store_id: string; slug: string; name: string; owner_email: string; plan: string | null; ends_at: string | null; discount_on: boolean; rules: number; pending: number; today: number };
const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';

export const AdminAutoPilot: React.FC = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState('');
  const load = () => {
    void supabase.rpc('admin_autopilot_list').then(({ data, error }) => {
      if (error) setMsg(error.message);
      setRows((data as Row[]) || []);
    });
  };
  useEffect(load, []);
  const toggle = async (r: Row) => {
    const { error } = await supabase.from('store_autopilot').upsert({ store_id: r.store_id, discount_on: !r.discount_on, updated_at: new Date().toISOString() }, { onConflict: 'store_id' });
    setMsg(error ? error.message : `${r.name}: discounts ${!r.discount_on ? 'ON' : 'OFF'}`);
    load();
  };
  if (open) return <StorePanel userId="" forceStoreId={open} onExit={() => { setOpen(''); load(); }} />;
  if (!rows) return <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-teal-300" /></div>;
  const waiting = rows.reduce((a, r) => a + r.pending, 0);
  return (
    <div className="space-y-2">
      <div className={box}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">AUTO-PILOT · ALL BUSINESSES</p>
        <p className="mt-1 text-[12px] text-slate-300">{rows.length} shop{rows.length === 1 ? '' : 's'} · {waiting} discount ask{waiting === 1 ? '' : 's'} waiting. OPEN shows the shop's admin as the owner sees it; AUTO-PILOT is the bar under LIVE CHAT.</p>
      </div>
      {!rows.length && <p className={box + ' text-[12px] text-slate-400'}>No BUSINESS PREMIUM shop yet.</p>}
      {rows.map((r) => (
        <div key={r.store_id} className={box + ' space-y-1.5' + (r.pending ? ' border-amber-400/50' : '')}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-bold text-white">{r.name}</p>
            <span className="shrink-0 text-[10.5px] text-slate-400">{(r.plan || '').toUpperCase()}{r.ends_at ? ` · ${new Date(r.ends_at).toLocaleDateString('en-GB')}` : ''}</span>
          </div>
          <p className="truncate text-[11.5px] text-slate-400">{r.owner_email} · {r.slug}.myrosebd.com</p>
          <p className="text-[12px] text-slate-200">Rules {r.rules} · waiting <b className={r.pending ? 'text-amber-300' : ''}>{r.pending}</b> · asks today {r.today} · discounts {r.discount_on ? 'ON' : 'OFF'}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className="h-9 rounded-lg bg-teal-600 text-[11px] font-bold text-white" onClick={() => setOpen(r.store_id)}>OPEN</button>
            <button type="button" className="h-9 rounded-lg bg-white/10 text-[11px] font-bold text-white" onClick={() => void toggle(r)}>DISCOUNTS {r.discount_on ? 'OFF' : 'ON'}</button>
          </div>
        </div>
      ))}
      {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
    </div>
  );
};
