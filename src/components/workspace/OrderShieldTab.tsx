import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ORDER SHIELD (store admin bar): stops fake, duplicate and robot orders on the shop's website.
 * Own file, so the rest of the admin never breaks. The same screen runs in the demo admin, the shop's own admin
 * and ROSE's WEBSITE ADMIN. Every rule is checked again on the server (store-shield + place_store_order_v5),
 * so nothing here can be skipped from the browser.
 */
type Settings = Record<string, any>;
type Check = { id: string; at: string; phone: string; email: string; name: string; ip: string; device: string; country: string; total: number; payment: string; risk: number; action: string; reasons: string[]; order_no: number | null; reviewed: string };
type Block = { id: string; kind: string; value: string; reason: string; shared: boolean; added_by: string; created_at: string };
type Info = { settings: Settings; sms: { provider?: string; sender_id?: string; has_key: boolean; key_end?: string; custom_url?: string }; courier: boolean; today: Record<string, number>; boss: boolean };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-60';
const cap = 'text-[11px] font-bold tracking-wider text-teal-300';
const tk = (n: number) => `${Math.round(n).toLocaleString('en-IN')} Tk`;

const ACTION: Record<string, [string, string]> = {
  block: ['BLOCKED', 'bg-rose-600 text-white'],
  duplicate: ['DUPLICATE', 'bg-rose-600 text-white'],
  otp: ['SMS CODE SENT', 'bg-amber-500 text-black'],
  otp_ok: ['SMS VERIFIED', 'bg-emerald-600 text-white'],
  advance: ['ADVANCE ASKED', 'bg-amber-500 text-black'],
  allow: ['ALLOWED', 'bg-white/10 text-slate-200'],
};

const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void; label: string; sub?: string; off?: boolean }> = ({ on, set, label, sub, off }) => (
  <button type="button" disabled={off} onClick={() => set(!on)} className="flex w-full items-center gap-3 border-b border-white/[0.06] py-2.5 text-left disabled:opacity-60">
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-bold text-white">{label}</span>
      {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
    </span>
    <span className={`relative h-6 w-11 shrink-0 rounded-full ${on ? 'bg-teal-500' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  </button>
);

const Num: React.FC<{ label: string; value: number; set: (v: number) => void; suffix?: string; off?: boolean }> = ({ label, value, set, suffix, off }) => (
  <label className="flex items-center gap-3 border-b border-white/[0.06] py-2">
    <span className="flex-1 text-[13px] font-bold text-white">{label}</span>
    <input type="number" disabled={off} className={input + ' !w-24 text-right'} value={value} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />
    {suffix && <span className="w-10 text-[11px] text-slate-400">{suffix}</span>}
  </label>
);

export const OrderShieldTab: React.FC<{ store: { id: string; name: string } }> = ({ store }) => {
  const [info, setInfo] = useState<Info | null>(null);
  const [s, setS] = useState<Settings>({});
  const [checks, setChecks] = useState<Check[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sms, setSms] = useState({ provider: 'alpha', key: '', sender: '', url: '', test: '' });
  const [add, setAdd] = useState({ kind: 'phone', value: '', reason: '', shared: true });
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const [{ data: g, error }, { data: c }, { data: b }] = await Promise.all([
      supabase.rpc('shield_get', { p_store: store.id }),
      supabase.rpc('shield_checks', { p_store: store.id, p_all: showAll }),
      supabase.rpc('shield_blocklist', { p_store: store.id }),
    ]);
    if (error) return setMsg(error.message);
    const i = g as Info;
    setInfo(i);
    setS(i.settings || {});
    setSms((x) => ({ ...x, provider: i.sms?.provider || 'alpha', sender: i.sms?.sender_id || '', url: i.sms?.custom_url || '' }));
    setChecks(((c as Check[]) || []).filter(Boolean));
    setBlocks((b as Block[]) || []);
  }, [store.id, showAll]);
  useEffect(() => { void load(); }, [load]);

  const boss = Boolean(info?.boss);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('shield_save', { p_store: store.id, p_settings: s });
    setBusy(false);
    setMsg(error ? error.message : 'Saved. The shield works on the next order.');
    if (!error) void load();
  };
  const saveSms = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('store_sms_save', { p_store: store.id, p_provider: sms.provider, p_key: sms.key, p_sender: sms.sender, p_url: sms.url });
    setBusy(false);
    setSms((x) => ({ ...x, key: '' }));
    setMsg(error ? error.message : 'SMS account saved. Send a test SMS to check it.');
    if (!error) void load();
  };
  const testSms = async () => {
    if (!/^01[3-9]\d{8}$/.test(sms.test)) return setMsg('Write your 11-digit mobile number for the test.');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('store-shield', { body: { action: 'sms_test', store_id: store.id, to: sms.test } });
    setBusy(false);
    const r = (data || {}) as { ok?: boolean; error?: string };
    setMsg(error ? error.message : r.ok ? 'Test SMS sent. Check your phone.' : `SMS did not go: ${r.error || 'unknown'}`);
  };
  const block = async (kind: string, value: string, reason: string, shared = true) => {
    const { error } = await supabase.rpc('shield_block', { p_store: store.id, p_kind: kind, p_value: value, p_reason: reason, p_shared: shared });
    setMsg(error ? error.message : `Blocked ${kind}: ${value}`);
    if (!error) void load();
  };
  const unblock = async (id: string) => {
    const { error } = await supabase.rpc('shield_unblock', { p_store: store.id, p_id: id });
    setMsg(error ? error.message : 'Block removed.');
    if (!error) void load();
  };
  const review = async (id: string, mark: string) => {
    await supabase.rpc('shield_review', { p_store: store.id, p_id: id, p_mark: mark });
    void load();
  };

  if (!info) return <div className={box}>{msg ? <p className="text-[12px] text-rose-300">{msg}</p> : <Loader2 className="h-5 w-5 animate-spin text-teal-300" />}</div>;
  const off = !boss;

  return (
    <div className="space-y-3">
      <div className={box}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-teal-300" />
          <p className="flex-1 text-sm font-extrabold text-white">ORDER SHIELD</p>
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${s.on ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300'}`}>{s.on ? 'ON' : 'OFF'}</span>
        </div>
        <p className="mt-1 text-[11.5px] text-slate-400">Stops fake, duplicate and robot orders before they reach your order list.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['Blocked today', info.today.blocked], ['SMS code today', info.today.otp], ['Advance asked', info.today.advance], ['Orders checked', info.today.checked]].map(([l, n]) => (
            <div key={String(l)} className="rounded-lg bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] text-slate-400">{l}</p>
              <p className="text-xl font-extrabold text-white">{n}</p>
            </div>
          ))}
        </div>
        {!boss && <p className="mt-2 text-[11px] text-amber-300">Only the shop owner can change the settings. You can block numbers and mark orders.</p>}
      </div>

      {msg && <p className="px-1 text-[12px] text-teal-200">{msg}</p>}

      <div className={box}>
        <p className={cap}>PROTECTION</p>
        <Toggle off={off} on={!!s.on} set={(v) => set('on', v)} label="Order Shield" sub="Check every website order" />
        <Num off={off} label="One running order per phone / Gmail" value={s.one_per_hours ?? 24} set={(v) => set('one_per_hours', v)} suffix="hours" />
        <Num off={off} label="Most orders per device / IP in an hour" value={s.max_per_hour ?? 3} set={(v) => set('max_per_hour', v)} />
        <Toggle off={off} on={s.trap !== false} set={(v) => set('trap', v)} label="Robot trap" sub="A hidden field only robots fill" />
        <Toggle off={off} on={s.speed !== false} set={(v) => set('speed', v)} label="Too-fast form" sub="Filled in under 6 seconds = robot" />
        <Toggle off={off} on={s.network !== false} set={(v) => set('network', v)} label="ROSE network" sub="Returns and blocks from every ROSE shop (numbers stay private)" />
        <Toggle off={off} on={s.courier !== false} set={(v) => set('courier', v)} label="Courier history" sub={info.courier ? 'Steadfast keys found in DELIVERY & COURIER' : 'Add Steadfast keys in DELIVERY & COURIER to use it'} />
        <Num off={off} label="Risky below this delivery rate" value={s.courier_min ?? 60} set={(v) => set('courier_min', v)} suffix="%" />
        <Toggle off={off} on={!!s.vpn} set={(v) => set('vpn', v)} label="VPN / proxy check" sub="Hidden IP adds risk" />
        <Toggle off={off} on={s.foreign_cod !== false} set={(v) => set('foreign_cod', v)} label="Cash on delivery from abroad" sub="Order from an IP outside Bangladesh adds risk" />
        <Num off={off} label="Big cash-on-delivery order above" value={s.max_cod ?? 5000} set={(v) => set('max_cod', v)} suffix="Tk" />
        <Toggle off={off} on={s.trusted !== false} set={(v) => set('trusted', v)} label="Trusted buyers skip checks" sub="2+ delivered here and never returned" />
      </div>

      <div className={box}>
        <p className={cap}>WHAT HAPPENS TO A RISKY ORDER</p>
        <Num off={off} label="Ask SMS code / advance from risk" value={s.otp_score ?? 40} set={(v) => set('otp_score', v)} suffix="/100" />
        <Num off={off} label="Block from risk" value={s.block_score ?? 80} set={(v) => set('block_score', v)} suffix="/100" />
        <div className="flex items-center gap-2 border-b border-white/[0.06] py-2.5">
          <span className="flex-1 text-[13px] font-bold text-white">SMS code (OTP)</span>
          {(['off', 'risky', 'all'] as const).map((k) => (
            <button key={k} type="button" disabled={off} onClick={() => set('otp', k)} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${s.otp === k ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-300'}`}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>
        <Toggle off={off} on={s.advance !== false} set={(v) => set('advance', v)} label="Ask an advance when risky" sub="Cash on delivery is closed; buyer pays by bKash / Nagad" />
        <Num off={off} label="Advance amount" value={s.advance_amount ?? 150} set={(v) => set('advance_amount', v)} suffix="Tk" />
        <label className="block py-2">
          <span className="text-[12px] font-bold text-white">Message for a blocked buyer (Bangla)</span>
          <input disabled={off} className={input + ' mt-1'} value={s.block_msg_bn || ''} onChange={(e) => set('block_msg_bn', e.target.value)} />
        </label>
        <label className="block py-1">
          <span className="text-[12px] font-bold text-white">Message for a blocked buyer (English)</span>
          <input disabled={off} className={input + ' mt-1'} value={s.block_msg_en || ''} onChange={(e) => set('block_msg_en', e.target.value)} />
        </label>
        {boss && (
          <button type="button" className={btn + ' mt-2 w-full'} disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} SAVE SHIELD
          </button>
        )}
      </div>

      <div className={box}>
        <p className={cap}>YOUR SMS ACCOUNT</p>
        <p className="mt-1 text-[11.5px] text-slate-400">
          The SMS code goes from your own SMS account (your shop pays the SMS company, about 0.30–0.40 Tk per SMS). Without it, risky cash orders are asked for an advance instead.
        </p>
        <p className="mt-2 text-[12px] text-white">
          {info.sms.has_key ? `Connected: ${String(info.sms.provider).toUpperCase()} · key …${info.sms.key_end || ''}` : 'Not connected yet'}
        </p>
        {boss && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              {[['alpha', 'ALPHA SMS'], ['bulksmsbd', 'BULKSMSBD'], ['custom', 'OTHER (LINK)']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSms((x) => ({ ...x, provider: k }))} className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-bold ${sms.provider === k ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-300'}`}>
                  {l}
                </button>
              ))}
            </div>
            <input className={input} placeholder={info.sms.has_key ? 'API key (leave empty to keep the saved one)' : 'API key from your SMS company'} value={sms.key} onChange={(e) => setSms((x) => ({ ...x, key: e.target.value }))} autoComplete="off" />
            <input className={input} placeholder="Sender ID (masking name, if you have one)" value={sms.sender} onChange={(e) => setSms((x) => ({ ...x, sender: e.target.value }))} />
            {sms.provider === 'custom' && (
              <input className={input} placeholder="https://…?to={to}&msg={msg}&key={key}" value={sms.url} onChange={(e) => setSms((x) => ({ ...x, url: e.target.value }))} />
            )}
            <p className="text-[11px] text-slate-400">
              {sms.provider === 'alpha' ? 'Get the key at sms.net.bd → API.' : sms.provider === 'bulksmsbd' ? 'Get the key at bulksmsbd.net → API.' : 'Any SMS company with a link: put {to}, {msg} and {key} in it.'} The key is kept hidden; nobody can read it back.
            </p>
            <button type="button" className={btn + ' w-full'} disabled={busy} onClick={() => void saveSms()}>SAVE SMS ACCOUNT</button>
            <div className="flex gap-2">
              <input className={input} placeholder="Your mobile number" inputMode="numeric" value={sms.test} onChange={(e) => setSms((x) => ({ ...x, test: e.target.value.replace(/\D/g, '').slice(0, 11) }))} />
              <button type="button" className={btn + ' shrink-0 bg-white/10'} disabled={busy || !info.sms.has_key} onClick={() => void testSms()}>TEST SMS</button>
            </div>
          </div>
        )}
      </div>

      <div className={box}>
        <div className="flex items-center">
          <p className={cap + ' flex-1'}>RISKY & BLOCKED ORDERS</p>
          <button type="button" className="text-[11px] font-bold text-teal-300 underline" onClick={() => setShowAll((x) => !x)}>{showAll ? 'ONLY RISKY' : 'SHOW ALL'}</button>
        </div>
        {checks.length === 0 && <p className="mt-2 text-[12px] text-slate-400">Nothing risky yet.</p>}
        <div className="mt-1 divide-y divide-white/[0.06]">
          {checks.map((c) => {
            const a = ACTION[c.action] || [c.action.toUpperCase(), 'bg-white/10 text-white'];
            const tone = c.risk >= 80 ? 'bg-rose-600' : c.risk >= 40 ? 'bg-amber-500 text-black' : 'bg-emerald-600';
            return (
              <div key={c.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold text-white ${tone}`}>{c.risk}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white">{c.name || '—'} · {c.phone}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${a[1]}`}>{a[0]}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {new Date(c.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {tk(c.total)} · {c.payment.toUpperCase()}
                  {c.order_no ? ` · order #${c.order_no}` : ''}{c.country ? ` · ${c.country}` : ''}
                </p>
                {c.reasons?.length > 0 && <p className="mt-0.5 text-[11px] text-amber-200">{c.reasons.join(' · ')}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button type="button" className="rounded-md bg-rose-600/80 px-2 py-1 text-[10px] font-bold text-white" onClick={() => void block('phone', c.phone, c.reasons.join(', ') || 'fake order')}>BLOCK PHONE</button>
                  {c.device && <button type="button" className="rounded-md bg-rose-600/60 px-2 py-1 text-[10px] font-bold text-white" onClick={() => void block('device', c.device, 'fake order')}>BLOCK DEVICE</button>}
                  {c.ip && <button type="button" className="rounded-md bg-rose-600/40 px-2 py-1 text-[10px] font-bold text-white" onClick={() => void block('ip', c.ip, 'fake order', false)}>BLOCK IP</button>}
                  {c.reviewed !== 'ok' && <button type="button" className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-white" onClick={() => void review(c.id, 'ok')}>REAL BUYER</button>}
                  {c.reviewed === 'ok' && <span className="rounded-md bg-emerald-700/60 px-2 py-1 text-[10px] font-bold text-white">MARKED REAL</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={box}>
        <p className={cap}>BLOCKLIST</p>
        <div className="mt-2 flex gap-1.5">
          {['phone', 'email', 'ip', 'device'].map((k) => (
            <button key={k} type="button" onClick={() => setAdd((x) => ({ ...x, kind: k }))} className={`flex-1 rounded-lg border px-1 py-1.5 text-[10.5px] font-bold ${add.kind === k ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-300'}`}>
              {k === 'email' ? 'GMAIL' : k.toUpperCase()}
            </button>
          ))}
        </div>
        <input className={input + ' mt-2'} placeholder={add.kind === 'phone' ? '01XXXXXXXXX' : add.kind === 'email' ? 'name@gmail.com' : add.kind === 'ip' ? '103.xx.xx.xx' : 'device code from the list above'} value={add.value} onChange={(e) => setAdd((x) => ({ ...x, value: e.target.value }))} />
        <input className={input + ' mt-2'} placeholder="Reason (fake order, returned 3 times…)" value={add.reason} onChange={(e) => setAdd((x) => ({ ...x, reason: e.target.value }))} />
        <Toggle on={add.shared} set={(v) => setAdd((x) => ({ ...x, shared: v }))} label="Warn other ROSE shops" sub="They see a warning, never the number" />
        <button type="button" className={btn + ' mt-2 w-full bg-rose-600'} disabled={!add.value.trim()} onClick={() => void block(add.kind, add.value, add.reason, add.shared).then(() => setAdd((x) => ({ ...x, value: '', reason: '' })))}>
          ADD TO BLOCKLIST
        </button>
        <div className="mt-2 divide-y divide-white/[0.06]">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-2 py-2">
              <span className="w-14 shrink-0 text-[10px] font-bold text-slate-400">{b.kind === 'email' ? 'GMAIL' : b.kind.toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-white">{b.value}</span>
                <span className="block truncate text-[10.5px] text-slate-400">{b.reason || '—'}{b.shared ? ' · shared' : ''}</span>
              </span>
              {boss && (
                <button type="button" aria-label="Remove block" className="rounded-md bg-white/10 p-1.5 text-slate-200" onClick={() => void unblock(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {blocks.length === 0 && <p className="py-2 text-[12px] text-slate-400">No one is blocked.</p>}
        </div>
      </div>
    </div>
  );
};
