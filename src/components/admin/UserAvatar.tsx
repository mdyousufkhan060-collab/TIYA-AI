import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface MiniProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const COLORS = ['#7c3aed', '#0d9488', '#2563eb', '#db2777', '#d97706', '#059669', '#4f46e5', '#dc2626'];

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts.length > 1 ? parts[1][0] : '';
  return (a + b).toUpperCase();
}

function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Gmail / Google profile photo with initials fallback. */
export const UserAvatar: React.FC<{
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}> = ({ src, name, email, size = 36, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/10 ${className}`}
      />
    );
  }
  return (
    <span
      style={{ ...style, background: colorFor(email || name || '?') }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/10 ${className}`}
    >
      {initials(name, email)}
    </span>
  );
};

/** Avatar + name + email row used across admin lists. */
export const UserChip: React.FC<{
  profile?: Partial<MiniProfile> | null;
  fallback?: string | null;
  size?: number;
  sub?: React.ReactNode;
}> = ({ profile, fallback, size = 32, sub }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <UserAvatar src={profile?.avatar_url} name={profile?.full_name} email={profile?.email || fallback} size={size} />
    <div className="min-w-0">
      <p className="truncate text-[11.5px] font-semibold text-slate-100">
        {profile?.full_name || profile?.email || fallback || 'Unknown user'}
      </p>
      <p className="truncate text-[10.5px] text-slate-400">
        {profile?.full_name ? profile?.email || fallback : null}
        {sub ? <>{profile?.full_name ? ' · ' : ''}{sub}</> : null}
      </p>
    </div>
  </div>
);

/** Load mini profiles by user id. */
export async function loadProfilesById(ids: (string | null | undefined)[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  const map = new Map<string, MiniProfile>();
  if (!uniq.length) return map;
  const { data } = await supabase.from('profiles').select('id,email,full_name,avatar_url').in('id', uniq);
  (data || []).forEach((p: any) => map.set(p.id, p));
  return map;
}

/** Load mini profiles by email (lower-cased keys). */
export async function loadProfilesByEmail(emails: (string | null | undefined)[]) {
  const uniq = Array.from(new Set(emails.filter(Boolean).map((e) => String(e).toLowerCase())));
  const map = new Map<string, MiniProfile>();
  if (!uniq.length) return map;
  const { data } = await supabase.from('profiles').select('id,email,full_name,avatar_url').in('email', uniq);
  (data || []).forEach((p: any) => p.email && map.set(String(p.email).toLowerCase(), p));
  return map;
}
