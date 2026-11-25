import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Workspace > MY DOMAIN: the user's own domain (yourshop.com).
 * With a DNS key from Hostinger or Cloudflare, ROSE checks the domain, shows its DNS records
 * and connects it to the user's ROSE store by itself. Other sellers: ROSE shows the records to add by hand.
 * The key is saved on the server only and is never shown again.
 */
type Dom = { id: string; domain: string; provider: string; status: string; note: string | null; checked_at: string | null };
type Rec = { type: string; name: string; value: string };
type StoreLite = { id: string; name: string; slug: string; custom_domain: string | null };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white disabled:opacity-60';

const PROVIDERS: Array<[string, string, boolean]> = [
  ['hostinger', 'Hostinger', true],
  ['cloudflare', 'Cloudflare', true],
  ['namecheap', 'Namecheap', false],
  ['godaddy', 'GoDaddy', false],
  ['bd', 'BTCL / BD seller (.bd, .com.bd)', false],
  ['other', 'Other', false],
];
const HOW: Record<string, string[]> = {
  hostinger: ['hpanel.hostinger.com → top right profile → Account → API (or open hpanel.hostinger.com/profile/api)', 'New token → name: ROSE → longest expiry → Create', 'Copy the key and paste it below. It shows only once.'],
  cloudflare: ['dash.cloudflare.com → My Profile → API Tokens → Create Token', 'Use the template "Edit zone DNS" → Zone Resources: your domain → Continue → Create Token', 'Copy the key and paste it below.'],
};
const STATUS: Record<string, [string, string]> = {
  saved: ['SAVED', 'text-amber-300'],
  connected: ['ROSE CONNECTED', 'text-emerald-300'],
  pointed: ['CONNECTED TO STORE', 'text-emerald-300'],
  failed: ['KEY PROBLEM', 'text-rose-300'],
};

async function fnError(data: any, error: any): Promise<string> {
  if (data?.error) return String(data.error);
  if (!error) return '';
  try {
    const j = await error.context?.json?.();
    return j?.error || error.message;
  } catch {
    return error.message;
  }
}

export const DomainAccess: React.FC<{ userId: string }> = ({ userId }) => {
  const [list, setList] = useState<Dom[]>([]);
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [domain, setDomain] = useState('');
  const [provider, setProvider] = useState('hostinger');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<Record<string, Rec[]>>({});
  const [storeFor, setStoreFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      supabase.from('user_domains').select('id,domain,provider,status,note,checked_at').eq('user_id', userId).order('created_at'),
      supabase.from('stores').select('id,name,slug,custom_domain').eq('owner_id', userId),
    ]);
    setList((d.data as Dom[]) || []);
    setStores((s.data as StoreLite[]) || []);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const auto = PROVIDERS.find((p) => p[0] === provider)?.[2];
  const say = (k: string, t: string) => setMsg((m) => ({ ...m, [k]: t }));

  const check = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke('domain-access', { body: { action: 'check', domain_id: id } });
    setBusy('');
    const err = await fnError(data, error);
    if (err) say(id, err);
    else {
      if ((data as any)?.records) setRecs((r) => ({ ...r, [id]: (data as any).records }));
      say(id, (data as any)?.message || ((data as any)?.ok ? 'ROSE can reach this domain now.' : 'Not connected.'));
    }
    void load();
  };

  const add = async () => {
    if (!domain.trim()) return say('new', 'Write your domain, like yourshop.com');
    if (auto && !token.trim()) return say('new', 'Paste the DNS key from ' + (provider === 'hostinger' ? 'Hostinger' : 'Cloudflare') + '.');
    setBusy('new');
    const { data, error } = await supabase.rpc('save_user_domain', { p_domain: domain, p_provider: provider, p_token: auto ? token : '' });
    setBusy('');
    if (error) return say('new', error.message);
    setDomain('');
    setToken('');
    say('new', 'Saved.');
    await load();
    if (data) await check(String(data));
  };

  const toStore = async (d: Dom) => {
    const sid = storeFor[d.id] || stores[0]?.id;
    if (!sid) return say(d.id, 'Open a store first in MY STORE.');
    setBusy(d.id);
    const a = await supabase.functions.invoke('store-domain', { body: { store_id: sid, domain: d.domain, action: 'add' } });
    const err = await fnError(a.data, a.error);
    if (err) {
      setBusy('');
      return say(d.id, err);
    }
    const records: Rec[] = (a.data as any)?.records || [];
    if (d.status === 'connected' || d.status === 'pointed') {
      const b = await supabase.functions.invoke('domain-access', { body: { action: 'apply', domain_id: d.id, records } });
      const err2 = await fnError(b.data, b.error);
      setBusy('');
      say(d.id, err2 || (b.data as any)?.message || 'Done.');
    } else {
      setBusy('');
      setRecs((r) => ({ ...r, [d.id]: records }));
      say(d.id, 'Add the records below in your domain seller\'s DNS page. Then press CHECK in MY STORE → 06 OWN DOMAIN.');
    }
    void load();
  };

  const remove = async (d: Dom) => {
    if (!window.confirm(`Remove ${d.domain} from ROSE? ROSE forgets its key. Your domain itself stays with your seller.`)) return;
    await supabase.from('user_domains').delete().eq('id', d.id);
    void load();
  };

  return (
    <div className="space-y-2">
      <div className={box + ' space-y-1 text-[11.5px] text-slate-300'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">WHAT ROSE DOES WITH YOUR DOMAIN</p>
        <p>Give ROSE your domain's DNS key once. Then ROSE checks it, shows its records and points it to your ROSE store by herself. No DNS work for you.</p>
        <p>Works by itself with Hostinger and Cloudflare. Other sellers: ROSE shows the records and you add them by hand.</p>
        <p className="text-slate-400">The key stays on ROSE's server. Nobody sees it again, not even you. You can remove it any time.</p>
      </div>

      <div className={box + ' space-y-2'}>
        <p className="text-[11px] font-bold tracking-wider text-teal-300">ADD A DOMAIN</p>
        <input className={input} value={domain} onChange={(e) => setDomain(e.target.value.trim().toLowerCase())} placeholder="yourshop.com" autoCapitalize="off" />
        <select className={input} value={provider} onChange={(e) => setProvider(e.target.value)}>
          {PROVIDERS.map(([k, l]) => <option key={k} value={k}>Bought from: {l}</option>)}
        </select>
        {auto && (
          <>
            <div className="space-y-0.5 rounded-lg bg-black/30 p-2 text-[11px] text-slate-300">
              <p className="font-bold text-white">How to get the key</p>
              {HOW[provider].map((l, i) => <p key={i}>{i + 1}. {l}</p>)}
            </div>
            <input className={input} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the DNS key here" />
          </>
        )}
        <button type="button" disabled={busy === 'new'} onClick={() => void add()} className={btn + ' w-full'}>
          {busy === 'new' && <Loader2 className="h-4 w-4 animate-spin" />} {auto ? 'SAVE & GIVE ROSE ACCESS' : 'SAVE DOMAIN'}
        </button>
        {msg.new && <p className="text-[12px] text-teal-200">{msg.new}</p>}
      </div>

      {list.map((d) => {
        const [label, color] = STATUS[d.status] || STATUS.saved;
        const r = recs[d.id] || [];
        const pname = PROVIDERS.find((p) => p[0] === d.provider)?.[1] || d.provider;
        return (
          <div key={d.id} className={box + ' space-y-2'}>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] text-white">{d.domain}</b>
                <span className="text-[10.5px] text-slate-400">{pname}{d.checked_at ? ` · checked ${new Date(d.checked_at).toLocaleString('en-GB')}` : ''}</span>
              </span>
              <b className={`text-[10.5px] ${color}`}>{label}</b>
            </div>
            {d.note && <p className="text-[11px] text-slate-300">{d.note}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy === d.id} onClick={() => void check(d.id)} className={btn + ' bg-white/10'}>
                {busy === d.id && <Loader2 className="h-4 w-4 animate-spin" />} CHECK
              </button>
              <button type="button" disabled={busy === d.id} onClick={() => void toStore(d)} className={btn}>CONNECT TO MY STORE</button>
            </div>
            {stores.length > 1 && (
              <select className={input} value={storeFor[d.id] || stores[0].id} onChange={(e) => setStoreFor((s) => ({ ...s, [d.id]: e.target.value }))}>
                {stores.map((s) => <option key={s.id} value={s.id}>Store: {s.name}</option>)}
              </select>
            )}
            {stores.length === 0 && <p className="text-[10.5px] text-slate-400">No store yet. Open one in MY STORE, then connect this domain.</p>}
            {r.length > 0 && (
              <div className="space-y-1 rounded-lg bg-black/30 p-2">
                <p className="text-[10.5px] font-bold tracking-wider text-slate-300">DNS RECORDS</p>
                {r.slice(0, 20).map((x, i) => (
                  <div key={i} className="grid grid-cols-[52px_70px_1fr] gap-1.5 text-[11px]">
                    <b className="text-teal-300">{x.type}</b>
                    <span className="truncate text-slate-300">{x.name}</span>
                    <span className="truncate font-mono text-white">{x.value}</span>
                  </div>
                ))}
              </div>
            )}
            {msg[d.id] && <p className="text-[12px] text-teal-200">{msg[d.id]}</p>}
            <button type="button" onClick={() => void remove(d)} className="w-full text-[10.5px] font-bold text-rose-300">REMOVE FROM ROSE</button>
          </div>
        );
      })}
    </div>
  );
};
