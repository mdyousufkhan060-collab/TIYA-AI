import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Package, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Business keys (couriers, WhatsApp, Messenger).
 * Keys are written through save_business_secret and never read back:
 * the app only shows whether each key is saved (last 4 characters).
 */

type Field = { key: string; label: string; secret?: boolean; placeholder?: string };
type Kind = { kind: string; title: string; fields: Field[]; where: string; test?: () => Promise<any> };

type Status = Record<string, { fields: Record<string, string>; verified_at: string | null; note: string | null }>;

const call = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('rose-business', { body: payload });
  if (error) return { ok: false, error: error.message };
  return data || { ok: false, error: 'No answer.' };
};

const useSecretStatus = () => {
  const [status, setStatus] = useState<Status>({});
  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('business_secret_status');
    setStatus((data || {}) as Status);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { status, reload };
};

const inputCls =
  'h-10 w-full rounded-[4px] border border-white/[0.1] bg-[#0B0F16] px-3 text-[12.5px] text-white placeholder:text-slate-500 focus:border-teal-400/60 focus:outline-none';

const KeyCard: React.FC<{ k: Kind; st?: Status[string]; onChanged: () => void }> = ({ k, st, onChanged }) => {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const saved = st?.fields || {};
  const hasAny = Object.keys(saved).length > 0;

  const save = async () => {
    setBusy('save');
    setMsg(null);
    const { data, error } = await supabase.rpc('save_business_secret', { p_kind: k.kind, p_data: vals });
    setBusy('');
    if (error || data?.ok === false) return setMsg({ ok: false, text: error?.message || data?.error || 'Could not save.' });
    setVals({});
    setMsg({ ok: true, text: 'Saved. Now press TEST.' });
    onChanged();
  };
  const test = async () => {
    if (!k.test) return;
    setBusy('test');
    setMsg(null);
    const r = await k.test();
    setBusy('');
    setMsg({ ok: Boolean(r?.ok), text: r?.note || r?.error || (r?.ok ? 'Connected.' : 'Failed.') });
    onChanged();
  };
  const remove = async () => {
    await supabase.rpc('delete_business_secret', { p_kind: k.kind });
    setMsg(null);
    onChanged();
  };

  const chip = st?.verified_at
    ? { t: 'CONNECTED', c: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300' }
    : hasAny
      ? { t: 'NOT TESTED', c: 'border-amber-400/50 bg-amber-500/10 text-amber-300' }
      : { t: 'NOT SET', c: 'border-white/15 bg-white/5 text-slate-400' };

  return (
    <div className="space-y-2 rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold tracking-wider text-white">{k.title}</p>
        <span className={`rounded-[3px] border px-2 py-0.5 text-[9.5px] font-bold tracking-wider ${chip.c}`}>{chip.t}</span>
      </div>
      {k.fields.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="text-[9.5px] font-semibold tracking-wider text-slate-400">
            {f.label}
            {saved[f.key] ? <span className="ml-2 text-emerald-300">SAVED {saved[f.key]}</span> : null}
          </span>
          <input
            type={f.secret ? 'password' : 'text'}
            autoComplete="off"
            value={vals[f.key] || ''}
            placeholder={saved[f.key] ? 'Leave empty to keep the saved value' : f.placeholder || ''}
            onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
            className={inputCls}
          />
        </label>
      ))}
      <p className="text-[10.5px] leading-snug text-slate-500">{k.where}</p>
      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          disabled={busy !== '' || Object.values(vals).every((v) => !String(v).trim())}
          onClick={() => void save()}
          className="flex h-9 flex-1 items-center justify-center rounded-[4px] bg-teal-600 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SAVE'}
        </button>
        {k.test && (
          <button
            type="button"
            disabled={busy !== '' || !hasAny}
            onClick={() => void test()}
            className="flex h-9 flex-1 items-center justify-center rounded-[4px] border border-white/15 text-[11px] font-bold text-white disabled:opacity-40"
          >
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'TEST'}
          </button>
        )}
        {hasAny && (
          <button type="button" onClick={() => void remove()} className="h-9 rounded-[4px] border border-rose-400/30 px-3 text-[11px] font-bold text-rose-300">
            REMOVE
          </button>
        )}
      </div>
      {(msg || st?.note) && (
        <p className={`text-[11px] ${(msg ? msg.ok : Boolean(st?.verified_at)) ? 'text-emerald-300' : 'text-rose-300'}`}>{msg?.text || st?.note}</p>
      )}
    </div>
  );
};

const COURIER_KEYS: Kind[] = [
  {
    kind: 'courier:steadfast',
    title: 'STEADFAST',
    fields: [
      { key: 'api_key', label: 'API KEY', secret: true },
      { key: 'secret_key', label: 'SECRET KEY', secret: true },
    ],
    where: 'Steadfast merchant panel → API. If you do not see it, ask Steadfast support for API keys. Works fully: book + track.',
    test: () => call({ action: 'courier_test', courier: 'steadfast' }),
  },
  {
    kind: 'courier:pathao',
    title: 'PATHAO',
    fields: [
      { key: 'client_id', label: 'CLIENT ID' },
      { key: 'client_secret', label: 'CLIENT SECRET', secret: true },
      { key: 'username', label: 'MERCHANT LOGIN EMAIL' },
      { key: 'password', label: 'MERCHANT PASSWORD', secret: true },
      { key: 'store_id', label: 'STORE ID' },
    ],
    where: 'Pathao merchant panel → Developers API → Merchant API Credentials. Connection test works now; booking is coming next.',
    test: () => call({ action: 'courier_test', courier: 'pathao' }),
  },
  {
    kind: 'courier:redx',
    title: 'REDX',
    fields: [{ key: 'api_token', label: 'API ACCESS TOKEN', secret: true }],
    where: 'RedX merchant panel → Developer API (or ask RedX support). Connection test works now; booking is coming next.',
    test: () => call({ action: 'courier_test', courier: 'redx' }),
  },
];

/** Couriers page: keys on top, then orders ready to send. */
export const CourierConnect: React.FC<{ businessId: string }> = ({ businessId }) => {
  const { status, reload } = useSecretStatus();
  const [orders, setOrders] = useState<any[]>([]);
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('business_orders')
      .select('id,order_no,note,total,courier,courier_status,courier_ref,courier_note,tracking_code,status,created_at,customer_id')
      .eq('business_id', businessId)
      .neq('status', 'cancelled')
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(30);
    const rows = data || [];
    const ids = Array.from(new Set(rows.map((r: any) => r.customer_id).filter(Boolean)));
    let names: Record<string, any> = {};
    if (ids.length) {
      const { data: cs } = await supabase.from('business_customers').select('id,name,phone').in('id', ids);
      names = Object.fromEntries((cs || []).map((c: any) => [c.id, c]));
    }
    setOrders(rows.map((r: any) => ({ ...r, cust: names[r.customer_id] || null })));
  }, [businessId]);
  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const run = async (id: string, action: 'courier_book' | 'courier_track') => {
    setBusyId(id);
    const r = await call({ action, order_id: id, courier: 'steadfast' });
    setBusyId('');
    setMsg((m) => ({
      ...m,
      [id]: {
        ok: Boolean(r?.ok),
        text: r?.ok
          ? action === 'courier_book'
            ? `Booked. Tracking: ${r.tracking_code || '-'} · COD ${r.cod ?? 0} Tk`
            : `Status: ${r.delivery_status}`
          : r?.error || 'Failed.',
      },
    }));
    void loadOrders();
  };

  const steadfastReady = Boolean(status['courier:steadfast']?.verified_at);
  const [bulk, setBulk] = useState<{ busy: string; text: string; ok: boolean } | null>(null);
  const openCount = orders.filter((o) => !o.courier_ref && ['pending', 'processing'].includes(o.status)).length;
  const sendAll = async () => {
    setBulk({ busy: 'all', text: '', ok: true });
    const r = await call({ action: 'dispatch', plan: [{ courier: 'steadfast', rest: true }] });
    setBulk({
      busy: '',
      ok: Boolean(r?.ok),
      text: r?.ok ? `${r.booked} booked${r.marked ? `, ${r.marked} need attention` : ''}${r.emailed ? ' · list e-mailed' : ''}` : r?.error || 'Failed.',
    });
    void loadOrders();
  };
  const emailList = async () => {
    setBulk({ busy: 'mail', text: '', ok: true });
    const r = await call({ action: 'parcels_email' });
    setBulk({ busy: '', ok: Boolean(r?.ok), text: r?.ok ? `E-mailed to ${r.to}` : r?.error || 'Failed.' });
  };

  return (
    <div className="space-y-3">
      <p className="px-1 pt-1 text-[10px] font-bold tracking-wider text-slate-400">COURIER API KEYS</p>
      {COURIER_KEYS.map((k) => (
        <KeyCard key={k.kind} k={k} st={status[k.kind]} onChanged={() => void reload()} />
      ))}
      <p className="px-1 text-[10.5px] leading-snug text-slate-500">
        Paperfly, eCourier, Sundarban, SA Paribahan and own delivery: add them below and book in their own panel; ROSE keeps the order and tracking code.
      </p>

      <p className="px-1 pt-2 text-[10px] font-bold tracking-wider text-slate-400">SEND ORDERS WITH STEADFAST</p>
      {!steadfastReady && <p className="px-1 text-[11px] text-amber-300">Save and TEST your Steadfast keys first.</p>}
      <p className="px-1 text-[10.5px] leading-snug text-slate-500">
        Or just tell ROSE: "সব পার্সেল Steadfast-এ দাও", "৩টা Steadfast-এ, বাকি Pathao-তে", "#1023 আর #1025 RedX-এ".
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!steadfastReady || openCount === 0 || Boolean(bulk?.busy)}
          onClick={() => void sendAll()}
          className="flex h-9 flex-1 items-center justify-center rounded-[4px] bg-teal-600 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {bulk?.busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : `SEND ALL (${openCount})`}
        </button>
        <button
          type="button"
          disabled={Boolean(bulk?.busy)}
          onClick={() => void emailList()}
          className="flex h-9 flex-1 items-center justify-center rounded-[4px] border border-white/15 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {bulk?.busy === 'mail' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'E-MAIL LIST'}
        </button>
      </div>
      {bulk?.text && <p className={`px-1 text-[11px] ${bulk.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{bulk.text}</p>}
      {orders.length === 0 && <p className="px-1 text-[11px] text-slate-500">No open orders.</p>}
      {orders.map((o) => {
        const c = o.cust;
        const booked = Boolean(o.courier_ref);
        return (
          <div key={o.id} className="space-y-1.5 rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12px] font-semibold text-white">
                <Package className="mr-1 inline h-3.5 w-3.5 text-teal-300" />
                #{o.order_no} · {c?.name || 'No customer'} · {o.total} Tk
              </p>
              <span className="shrink-0 text-[9.5px] font-bold tracking-wider text-slate-400">{String(o.courier_status || 'not_sent').replace('_', ' ').toUpperCase()}</span>
            </div>
            <p className="truncate text-[11px] text-slate-400">{o.note}</p>
            {o.tracking_code && <p className="text-[11px] text-emerald-300">TRACKING: {o.tracking_code}</p>}
            {!o.tracking_code && o.courier_note && <p className="text-[11px] text-amber-300">{o.courier_note}</p>}
            <button
              type="button"
              disabled={busyId !== '' || (!booked && !steadfastReady)}
              onClick={() => void run(o.id, booked ? 'courier_track' : 'courier_book')}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[4px] border border-teal-400/40 text-[11px] font-bold text-teal-200 disabled:opacity-40"
            >
              {busyId === o.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : booked ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> CHECK STATUS
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> BOOK WITH STEADFAST
                </>
              )}
            </button>
            {msg[o.id] && <p className={`text-[11px] ${msg[o.id].ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg[o.id].text}</p>}
          </div>
        );
      })}
      <WebsiteOrders />
      <p className="px-1 pt-2 text-[10px] font-bold tracking-wider text-slate-400">YOUR COURIER ACCOUNTS</p>
    </div>
  );
};

const META_KEYS: Kind[] = [
  {
    kind: 'whatsapp',
    title: 'WHATSAPP BUSINESS (CLOUD API)',
    fields: [
      { key: 'phone_number_id', label: 'PHONE NUMBER ID' },
      { key: 'waba_id', label: 'WHATSAPP BUSINESS ACCOUNT ID' },
      { key: 'access_token', label: 'PERMANENT ACCESS TOKEN', secret: true },
    ],
    where: 'Meta for Developers → your app → WhatsApp → API Setup. Use a permanent System User token from Business Settings.',
    test: () => call({ action: 'meta_test', channel: 'whatsapp' }),
  },
  {
    kind: 'messenger',
    title: 'FACEBOOK PAGE MESSENGER',
    fields: [
      { key: 'page_id', label: 'PAGE ID' },
      { key: 'page_token', label: 'PAGE ACCESS TOKEN', secret: true },
    ],
    where: 'Meta for Developers → your app → Messenger → Settings → generate a Page Access Token for your page.',
    test: () => call({ action: 'meta_test', channel: 'messenger' }),
  },
];

/** WhatsApp Business + Page Messenger keys. */
export const ChannelConnect: React.FC = () => {
  const { status, reload } = useSecretStatus();
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-[4px] border border-sky-400/30 bg-sky-500/10 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        <p className="text-[11px] leading-snug text-sky-100">
          Save your keys and press TEST to check them. AI auto reply to customers turns on in the next update, after ROSE gets Meta approval.
        </p>
      </div>
      {META_KEYS.map((k) => (
        <KeyCard key={k.kind} k={k} st={status[k.kind]} onChanged={() => void reload()} />
      ))}
    </div>
  );
};


/** Link a shop's website to ROSE: new website orders land in ORDERS by themselves. */
const WebsiteOrders: React.FC = () => {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = async (reset = false) => {
    setBusy(true);
    const r = await call({ action: 'order_key', reset });
    setBusy(false);
    if (r?.ok) setLink(r.url);
  };
  return (
    <div className="space-y-2 rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
      <p className="text-[12px] font-bold tracking-wider text-white">WEBSITE ORDERS</p>
      <p className="text-[10.5px] leading-snug text-slate-500">
        Put this link in your website (WooCommerce: Settings → Advanced → Webhooks → Order created → Delivery URL). New orders come into ORDERS with name, phone and address. Keep the link private.
      </p>
      {link ? (
        <>
          <p className="break-all rounded-[4px] bg-[#0B0F16] p-2 font-mono text-[10.5px] text-teal-200">{link}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined);
              }}
              className="h-9 flex-1 rounded-[4px] bg-teal-600 text-[11px] font-bold text-white"
            >
              {copied ? 'COPIED' : 'COPY LINK'}
            </button>
            <button type="button" disabled={busy} onClick={() => void load(true)} className="h-9 rounded-[4px] border border-rose-400/30 px-3 text-[11px] font-bold text-rose-300">
              NEW LINK
            </button>
          </div>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void load()} className="flex h-9 w-full items-center justify-center rounded-[4px] border border-teal-400/40 text-[11px] font-bold text-teal-200">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SHOW MY ORDER LINK'}
        </button>
      )}
    </div>
  );
};
