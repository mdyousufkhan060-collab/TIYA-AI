import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

/** Website live chat inbox: every customer conversation, ROSE's answers, and the owner's replies. */
type Msg = { id: string; visitor: string; sender: 'customer' | 'rose' | 'owner'; body: string; created_at: string };
const box = 'rounded-xl border border-white/10 bg-white/[0.03] p-3';
const ago = (t: string) => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : new Date(t).toLocaleDateString('en-GB');
};

export const RoseChatInbox: React.FC<{ storeId?: string; businessId?: string; name: string }> = ({ storeId, businessId, name }) => {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    let q = supabase.from('rose_chat').select('id,visitor,sender,body,created_at').order('created_at', { ascending: false }).limit(500);
    q = storeId ? q.eq('store_id', storeId) : q.eq('business_id', businessId || '');
    const { data, error } = await q;
    if (error) setErr(error.message);
    setMsgs(((data as Msg[]) || []).reverse());
  }, [storeId, businessId]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);
  const threads = useMemo(() => {
    const map = new Map<string, Msg[]>();
    msgs.forEach((m) => map.set(m.visitor, [...(map.get(m.visitor) || []), m]));
    return Array.from(map.entries()).map(([v, l]) => ({ v, l, last: l[l.length - 1] })).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [msgs]);
  const send = async () => {
    const t = text.trim();
    if (!t || !open) return;
    setText('');
    const row: Record<string, string> = { visitor: open, sender: 'owner', body: t.slice(0, 1000) };
    if (storeId) row.store_id = storeId; else row.business_id = businessId || '';
    const { error } = await supabase.from('rose_chat').insert(row);
    if (error) setErr(error.message);
    void load();
  };
  const th = threads.find((x) => x.v === open);
  if (th)
    return (
      <div className={box + ' space-y-2'}>
        <button type="button" onClick={() => setOpen('')} className="text-[11px] font-bold text-teal-300">‹ ALL CHATS</button>
        <p className="text-[11px] text-slate-400">Customer {th.v.slice(-6).toUpperCase()} · {th.l.length} messages</p>
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto rounded-lg bg-black/30 p-2">
          {th.l.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12.5px] ${m.sender === 'customer' ? 'bg-white/10 text-white' : m.sender === 'rose' ? 'bg-fuchsia-600/30 text-fuchsia-50' : 'bg-teal-600 text-white'}`}>
                <span className="block text-[9.5px] opacity-70">{m.sender === 'customer' ? 'Customer' : m.sender === 'rose' ? '🌹 ROSE' : name} · {ago(m.created_at)}</span>
                {m.body}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white" />
          <button type="button" onClick={() => void send()} className="rounded-lg bg-teal-600 px-3 text-[12px] font-bold text-white">SEND</button>
        </div>
        <p className="text-[10.5px] text-slate-500">The customer sees your reply in the chat box within a few seconds while it is open.</p>
      </div>
    );
  return (
    <div className={box + ' space-y-1.5'}>
      <p className="text-[11px] font-bold tracking-wider text-teal-300">CONVERSATIONS · {threads.length}</p>
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
      {threads.length === 0 && <p className="text-[12px] text-slate-400">No chats yet. Customers write from the chat button on your website.</p>}
      {threads.map((t) => (
        <button key={t.v} type="button" onClick={() => setOpen(t.v)} className="flex w-full items-center gap-2 rounded-lg bg-black/30 p-2 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600/40 text-[11px] font-bold text-white">{t.v.slice(-2).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-white">{t.last.sender === 'customer' ? '' : t.last.sender === 'rose' ? '🌹 ' : 'You: '}{t.last.body}</span>
            <span className="block text-[10.5px] text-slate-400">{t.l.length} messages · {ago(t.last.created_at)}</span>
          </span>
          {t.last.sender === 'customer' && <span className="h-2 w-2 rounded-full bg-amber-400" />}
        </button>
      ))}
    </div>
  );
};

/** Store admin: ROSE auto-answer switch + inbox. ROSE answers only for ROSE Business owners. */
export const StoreChatTab: React.FC<{ store: { id: string; name: string; chat_ai?: boolean } }> = ({ store }) => {
  const [ready, setReady] = useState<boolean | null>(null);
  const [on, setOn] = useState(store.chat_ai !== false);
  useEffect(() => {
    void supabase.rpc('store_ai_ready', { p_store: store.id }).then(({ data }) => setReady(Boolean(data)));
  }, [store.id]);
  const flip = async () => {
    const v = !on;
    setOn(v);
    await supabase.from('stores').update({ chat_ai: v }).eq('id', store.id);
  };
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-1'}>
        <div className="flex items-center gap-2">
          <span className="flex-1">
            <span className="block text-[12.5px] font-bold text-white">🌹 ROSE answers customers by herself</span>
            <span className="block text-[11px] text-slate-400">
              {ready === null ? 'Checking…' : ready ? 'In Bangla or English, from your products, prices and delivery info, day and night.' : 'Needs ROSE Business. Now customers can chat and you reply here yourself.'}
            </span>
          </span>
          {ready && (
            <button type="button" role="switch" aria-checked={on} onClick={() => void flip()} className={`relative h-7 w-12 shrink-0 ${on ? 'bg-teal-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-1 h-5 w-5 bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
            </button>
          )}
        </div>
        {ready === false && <p className="text-[10.5px] text-amber-300">Turn on ROSE Business: Settings → WORKSPACE → M MODE → BUSINESS (18+).</p>}
      </div>
      <RoseChatInbox storeId={store.id} name={store.name} />
    </div>
  );
};

/** ROSE Business: chat box for the owner's own website (any website builder). */
export const WebsiteChatWidget: React.FC<{ businessId: string; name: string }> = ({ businessId, name }) => {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const get = async (reset = false) => {
    setErr('');
    const { data, error } = await supabase.rpc('my_chat_key', { p_reset: reset });
    if (error) setErr(error.message); else setKey(String(data));
  };
  const code = key ? `<script src="https://www.myrosebd.com/widget.js" data-key="${key}" async></script>` : '';
  return (
    <div className="space-y-2">
      <div className={box + ' space-y-2'}>
        <p className="text-[12px] font-bold tracking-wider text-white">WEBSITE CHAT · ROSE</p>
        <p className="text-[11px] text-slate-400">Put ROSE on your own website (WordPress, Shopify, Wix or any site). She answers your customers in Bangla or English from your Business Profile, products and FAQ. Paste this one line before &lt;/body&gt;.</p>
        {code ? (
          <>
            <p className="break-all rounded-lg bg-black/40 p-2 font-mono text-[10.5px] text-teal-200">{code}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(code).then(() => setCopied(true)); }} className="h-9 flex-1 rounded-lg bg-teal-600 text-[11px] font-bold text-white">{copied ? 'COPIED' : 'COPY CODE'}</button>
              <button type="button" onClick={() => void get(true)} className="h-9 rounded-lg border border-rose-400/40 px-3 text-[11px] font-bold text-rose-300">NEW CODE</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => void get()} className="h-9 w-full rounded-lg border border-teal-400/40 text-[11px] font-bold text-teal-200">SHOW MY CHAT CODE</button>
        )}
        {err && <p className="text-[11px] text-rose-300">{err}</p>}
      </div>
      {key && <RoseChatInbox businessId={businessId} name={name} />}
    </div>
  );
};
