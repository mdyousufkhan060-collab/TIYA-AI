import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserAvatar, loadProfilesByEmail, type MiniProfile } from './UserAvatar';
import { UserProfile } from '../../types/tiya';
import { PremiumGrantCard } from './PremiumGrantCard';

const card = 'space-y-3 rounded-2xl border border-white/[0.08] bg-[#11151E] p-4';
const inputCls =
  'h-11 w-full rounded-xl border border-white/10 bg-[#090B10] px-3 text-xs text-white focus:border-teal-500 focus:outline-none';

/** Kills every session of a user. Their app signs out within ~1 minute. */
export const ForceLogoutButton: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setBusy(true);
    setMsg('');
    const { data, error } = await supabase.rpc('admin_force_logout', { p_user: user.id });
    setBusy(false);
    setSure(false);
    if (error) setMsg(error.message);
    else if (data && data.ok === false) setMsg(data.error || 'Failed');
    else setMsg('Logged out from all devices.');
  };

  return (
    <div className={card}>
      <p className="text-xs font-semibold tracking-wide text-slate-100">FORCE LOGOUT</p>
      <p className="text-[11px] text-slate-400">Signs this user out of ROSE on every phone. They can log in again.</p>
      {msg && <p className="text-xs text-teal-400">{msg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60 ${
          sure ? 'bg-rose-600' : 'bg-rose-600/80'
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        <span>{sure ? 'TAP AGAIN TO CONFIRM' : 'LOG OUT THIS USER'}</span>
      </button>
    </div>
  );
};

/** 03 GIVE PREMIUM: type a Gmail, find the account, grant Premium or log them out. */
export const AdminGivePremiumPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);

  const find = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = email.trim().toLowerCase();
    if (!q.includes('@')) {
      setErr('Type the full Gmail, e.g. name@gmail.com');
      return;
    }
    setBusy(true);
    setErr('');
    setUser(null);
    const { data, error } = await supabase.rpc('admin_find_user', { p_email: q });
    setBusy(false);
    if (error) return setErr(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return setErr('No account with this Gmail. Ask them to sign in to ROSE once first.');
    let avatar = row.avatar_url || null;
    if (!avatar) avatar = (await loadProfilesByEmail([row.email])).get(String(row.email || '').toLowerCase())?.avatar_url || null;
    setUser({ ...row, avatar_url: avatar, blocked: row.is_blocked });
  };

  const isPrem = user?.paid_until && new Date(user.paid_until) > new Date();

  return (
    <div className="space-y-3">
      <form onSubmit={find} className={card}>
        <p className="text-xs font-semibold tracking-wide text-slate-100">CUSTOMER GMAIL</p>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@gmail.com"
          className={inputCls}
        />
        {err && <p className="text-xs text-rose-400">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span>FIND ACCOUNT</span>
        </button>
      </form>

      {user && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <UserAvatar src={(user as any).avatar_url} name={user.full_name} email={user.email} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.full_name || 'No name'}</p>
                <p className="truncate text-[11px] text-slate-400">{user.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  isPrem ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slate-300'
                }`}
              >
                {isPrem ? 'PREMIUM' : 'FREE'}
              </span>
            </div>
          </div>
          <PremiumGrantCard user={user} onUpdated={(p) => setUser((u) => (u ? { ...u, ...p } : u))} />
          <ForceLogoutButton user={user} />
        </>
      )}
    </div>
  );
};

interface LoginRow {
  id: number;
  email: string | null;
  event: string;
  platform: string | null;
  created_at: string;
}

/** 08 LOGIN ACTIVITY: who logged in, signed up or was logged out. */
export const AdminLoginActivityPage: React.FC = () => {
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [profs, setProfs] = useState<Map<string, MiniProfile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from('login_events')
      .select('id,email,event,platform,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(async ({ data }) => {
        const list = (data as LoginRow[]) || [];
        setRows(list);
        setProfs(await loadProfilesByEmail(list.map((r) => r.email)));
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-12 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  if (!rows.length) return <p className="py-10 text-center text-xs text-slate-400">No login activity yet.</p>;

  const tone: Record<string, string> = {
    login: 'text-teal-400',
    signup: 'text-amber-300',
    logout: 'text-slate-400',
    forced_logout: 'text-rose-400',
    failed_login: 'text-rose-400',
  };

  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.08] bg-[#11151E] px-3 py-2.5">
          <UserAvatar src={profs.get((r.email || '').toLowerCase())?.avatar_url} name={profs.get((r.email || '').toLowerCase())?.full_name} email={r.email} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{profs.get((r.email || '').toLowerCase())?.full_name || r.email || 'unknown'}</p>
            {profs.get((r.email || '').toLowerCase())?.full_name && <p className="truncate text-[10.5px] text-slate-400">{r.email}</p>}
            <p className="text-[10px] text-slate-500">
              {new Date(r.created_at).toLocaleString('en-GB')} {r.platform ? `· ${r.platform}` : ''}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold uppercase ${tone[r.event] || 'text-slate-300'}`}>
            {r.event.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  );
};
