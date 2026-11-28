import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Admin bar 25 · ADMIN SMS: ROSE admin's own SMS account, separate from every shop's SMS account.
 * Each shop sets and pays for its own SMS in its admin (ORDER SHIELD › YOUR SMS ACCOUNT); this one is only for the
 * ROSE admin. Own file, so nothing else breaks. The key is kept on the server and never shown again.
 */
const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-60';

type St = { provider: string; sender_id: string; custom_url: string; has_key: boolean; key_end: string };

export const AdminSmsPage: React.FC = () => {
  const [st, setSt] = useState<St | null>(null);
  const [f, setF] = useState({ provider: 'alpha', key: '', sender: '', url: '', test: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc('admin_sms_status');
    if (error) return setMsg(error.message);
    const s = data as St;
    setSt(s);
    setF((x) => ({ ...x, provider: s.provider || 'alpha', sender: s.sender_id || '', url: s.custom_url || '' }));
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_sms_save', { p_provider: f.provider, p_key: f.key, p_sender: f.sender, p_url: f.url });
    setBusy(false);
    setF((x) => ({ ...x, key: '' }));
    setMsg(error ? error.message : 'Saved. Send a test SMS to check it.');
    if (!error) void load();
  };
  const test = async () => {
    if (!/^01[3-9]\d{8}$/.test(f.test)) return setMsg('Write your 11-digit mobile number for the test.');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('store-shield', { body: { action: 'admin_sms_test', to: f.test } });
    setBusy(false);
    const r = (data || {}) as { ok?: boolean; error?: string };
    setMsg(error ? error.message : r.ok ? 'Test SMS sent. Check your phone.' : `SMS did not go: ${r.error || 'unknown'}`);
  };

  return (
    <div className="space-y-3">
      <div className={box}>
        <p className="text-sm font-extrabold text-white">ADMIN SMS</p>
        <p className="mt-1 text-[11.5px] text-slate-400">ROSE admin's own SMS account. Shops use their own SMS accounts in ORDER SHIELD; this one is only yours.</p>
        <p className="mt-2 text-[12px] text-white">{st ? (st.has_key ? `Connected: ${st.provider.toUpperCase()} · key …${st.key_end}` : 'Not connected yet') : <Loader2 className="h-4 w-4 animate-spin" />}</p>
      </div>
      <div className={box + ' space-y-2'}>
        <div className="flex gap-2">
          {[['alpha', 'ALPHA SMS'], ['bulksmsbd', 'BULKSMSBD'], ['custom', 'OTHER (LINK)']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF((x) => ({ ...x, provider: k }))} className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-bold ${f.provider === k ? 'border-teal-400 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-300'}`}>
              {l}
            </button>
          ))}
        </div>
        <input className={input} placeholder={st?.has_key ? 'API key (leave empty to keep the saved one)' : 'API key from your SMS company'} value={f.key} onChange={(e) => setF((x) => ({ ...x, key: e.target.value }))} autoComplete="off" />
        <input className={input} placeholder="Sender ID (masking name, if you have one)" value={f.sender} onChange={(e) => setF((x) => ({ ...x, sender: e.target.value }))} />
        {f.provider === 'custom' && <input className={input} placeholder="https://…?to={to}&msg={msg}&key={key}" value={f.url} onChange={(e) => setF((x) => ({ ...x, url: e.target.value }))} />}
        <button type="button" className={btn + ' w-full'} disabled={busy} onClick={() => void save()}>SAVE ADMIN SMS</button>
        <div className="flex gap-2">
          <input className={input} placeholder="Your mobile number" inputMode="numeric" value={f.test} onChange={(e) => setF((x) => ({ ...x, test: e.target.value.replace(/\D/g, '').slice(0, 11) }))} />
          <button type="button" className={btn + ' shrink-0 bg-white/10'} disabled={busy || !st?.has_key} onClick={() => void test()}>TEST SMS</button>
        </div>
        {msg && <p className="text-[12px] text-teal-200">{msg}</p>}
      </div>
    </div>
  );
};
