import React, { useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ADD / EDIT CUSTOMER (store admin › Customers). Own file so the rest of the admin never breaks.
 * Details are saved straight to store_customers; a shop login is made by the store-customer-login function,
 * which never touches an email that already has an account and keeps a new login locked until the
 * customer confirms the email once. Passwords are never stored here.
 */
export type CustRow = { id: string; store_id: string; name: string; phone: string; email: string; district: string; upazila: string; address: string; note: string; user_id: string | null; login_made: boolean; created_at: string };

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const cap = 'mb-1.5 text-[11px] font-bold tracking-wider text-teal-300';

const makePw = () => {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = new Uint32Array(10);
  crypto.getRandomValues(r);
  return Array.from(r, (x) => a[x % a.length]).join('');
};

export const AddCustomerForm: React.FC<{ store: { id: string; name: string; slug: string; custom_domain?: string | null; domain_ready?: boolean }; edit: CustRow | null; onClose: (saved: boolean) => void }> = ({ store, edit, onClose }) => {
  const [name, setName] = useState(edit?.name || '');
  const [phone, setPhone] = useState(edit?.phone || '');
  const [district, setDistrict] = useState(edit?.district || '');
  const [area, setArea] = useState(edit?.upazila || '');
  const [address, setAddress] = useState(edit?.address || '');
  const [note, setNote] = useState(edit?.note || '');
  const [login, setLogin] = useState(!edit);
  const [email, setEmail] = useState(edit?.email || '');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<{ text: string; email: string; pw: string; phone: string } | null>(null);
  const shopUrl = store.custom_domain && store.domain_ready ? `https://${store.custom_domain}` : `https://${store.slug}.myrosebd.com`;

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('store-customer-login', { body: { ...body, redirect: shopUrl + '/' } });
    if (error) return { ok: false, message: error.message } as { ok: boolean; message: string; existing?: boolean; sent?: boolean };
    return data as { ok: boolean; message: string; existing?: boolean; sent?: boolean };
  };

  const save = async () => {
    setMsg('');
    if (name.trim().length < 2) return setMsg('Write the customer name.');
    if (phone && !/^01[3-9]\d{8}$/.test(phone)) return setMsg('Write a correct 11-digit phone (01XXXXXXXXX).');
    const wantLogin = login && !edit?.user_id;
    if (wantLogin) {
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setMsg('Write a correct email for the login.');
      if (pw.length < 8) return setMsg('Password must be at least 8 characters.');
    }
    setBusy('save');
    const row = { name: name.trim(), phone, district: district.trim(), upazila: area.trim(), address: address.trim(), note: note.trim(), email: email.trim().toLowerCase() };
    let id = edit?.id || '';
    if (edit) {
      const { error } = await supabase.from('store_customers').update(row).eq('id', edit.id);
      if (error) { setBusy(''); return setMsg(error.message); }
    } else {
      const { data, error } = await supabase.from('store_customers').insert({ ...row, store_id: store.id }).select('id').single();
      if (error || !data) { setBusy(''); return setMsg(error?.message || 'Could not save.'); }
      id = (data as { id: string }).id;
    }
    if (!wantLogin) { setBusy(''); return onClose(true); }
    const r = await call({ action: 'create', customer_id: id, email: row.email, password: pw });
    setBusy('');
    if (!r.ok) return setMsg(`Customer saved, but the login was not made: ${r.message}`);
    setDone({ text: r.message, email: row.email, pw: r.existing ? '' : pw, phone });
  };

  const reset = async () => {
    if (!edit) return;
    setMsg('');
    setBusy('reset');
    const r = await call({ action: 'reset', customer_id: edit.id, password: pw });
    setBusy('');
    if (!r.ok) return setMsg(r.message);
    if (r.sent) return setMsg(r.message);
    setDone({ text: r.message, email: edit.email, pw, phone: edit.phone });
  };

  if (done) {
    const wa = `Assalamu alaikum ${name.trim()},\nYour login for ${store.name} is ready.\nShop: ${shopUrl}\nEmail: ${done.email}${done.pw ? `\nPassword: ${done.pw}` : ''}\nFirst open the confirm email we sent you once, then tap Log in on the shop. You can change the password any time with Forgot password.`;
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-teal-400/40 bg-teal-500/10 p-3">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-teal-200"><Check className="h-4 w-4" /> Customer saved</p>
          <p className="mt-1 text-[12px] text-slate-200">{done.text}</p>
          {done.pw && <p className="mt-2 text-[11px] text-amber-200">The password is shown only now. Send it to the customer, it is not kept anywhere.</p>}
        </div>
        {done.phone && (
          <a href={`https://wa.me/88${done.phone}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" className="flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-[13px] font-bold text-white">
            Send login details on WhatsApp
          </a>
        )}
        <button type="button" onClick={() => onClose(true)} className="flex h-10 w-full items-center justify-center rounded-xl border border-white/15 text-[12.5px] font-bold text-white">DONE</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onClose(false)} className="flex items-center gap-1 px-1 text-[11px] font-bold tracking-wider text-teal-400">
        <ArrowLeft className="h-3.5 w-3.5" /> CUSTOMERS
      </button>
      <p className="px-1 text-[15px] font-extrabold text-white">{edit ? 'EDIT CUSTOMER' : 'ADD CUSTOMER'}</p>

      <div className={box + ' space-y-2'}>
        <p className={cap}>CUSTOMER</p>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        <input className={input} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" placeholder="Phone 01XXXXXXXXX" />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" />
          <input className={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area / upazila" />
        </div>
        <textarea className={input} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      </div>

      <div className={box + ' space-y-2'}>
        {edit?.user_id ? (
          <>
            <p className={cap}>SHOP LOGIN</p>
            <p className="text-[12px] text-slate-300">Login email: <b className="text-white">{edit.email}</b></p>
            {edit.login_made ? (
              <>
                <p className="text-[11px] text-slate-400">Set a new password (works only until the customer confirms the email; after that a reset email goes to them).</p>
                <div className="flex gap-2">
                  <input className={input} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 8)" autoComplete="new-password" />
                  <button type="button" aria-label="Show" onClick={() => setShow((v) => !v)} className="px-1 text-slate-300">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button type="button" onClick={() => { setPw(makePw()); setShow(true); }} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 text-[11px] font-bold text-white"><RefreshCw className="h-3.5 w-3.5" /> MAKE ONE</button>
                </div>
                <button type="button" onClick={() => void reset()} disabled={!!busy} className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-teal-400/50 text-[11.5px] font-bold text-teal-200">
                  {busy === 'reset' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} SET NEW PASSWORD / SEND RESET EMAIL
                </button>
              </>
            ) : (
              <p className="text-[11px] text-slate-400">This customer had their own account, so only they can change its password (Forgot password on the shop).</p>
            )}
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-white">
              <input type="checkbox" checked={login} onChange={(e) => setLogin(e.target.checked)} /> Create a login for this customer
            </label>
            {login ? (
              <>
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="Email (Gmail)" autoComplete="off" />
                <div className="flex gap-2">
                  <input className={input} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Shop password (min 8)" autoComplete="new-password" />
                  <button type="button" aria-label="Show" onClick={() => setShow((v) => !v)} className="px-1 text-slate-300">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button type="button" onClick={() => { setPw(makePw()); setShow(true); }} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 text-[11px] font-bold text-white"><RefreshCw className="h-3.5 w-3.5" /> MAKE ONE</button>
                </div>
                <p className="text-[10.5px] text-slate-400">This is a password for your shop only, never the customer's Gmail password. The customer confirms the email once, then logs in with it.</p>
              </>
            ) : (
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="Email (optional)" />
            )}
          </>
        )}
      </div>

      {msg && <p className="px-1 text-[12px] text-rose-300">{msg}</p>}
      <button type="button" onClick={() => void save()} disabled={!!busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[13px] font-bold text-white disabled:opacity-60">
        {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} SAVE CUSTOMER
      </button>
    </div>
  );
};
