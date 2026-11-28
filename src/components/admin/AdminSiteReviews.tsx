import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Star, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * 24 SITE REVIEWS (ROSE admin only, own file): reviews people wrote on myrosebd.com.
 * WAITING ones show on the website only after APPROVE. The admin can reply, hide again or delete.
 */
type Review = { id: string; name: string; photo: string | null; stars: number; body: string; approved: boolean; reply: string | null; created_at: string };

export const AdminSiteReviews: React.FC = () => {
  const [list, setList] = useState<Review[]>([]);
  const [tab, setTab] = useState<'waiting' | 'live'>('waiting');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('site_reviews').select('*').order('created_at', { ascending: false });
    const rows = (data as Review[]) || [];
    setList(rows);
    setReplies(Object.fromEntries(rows.map((r) => [r.id, r.reply || ''])));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const upd = async (id: string, v: Partial<Review>) => {
    setBusy(id);
    await supabase.from('site_reviews').update(v).eq('id', id);
    setBusy('');
    void load();
  };
  const del = async (r: Review) => {
    if (!window.confirm(`Delete the review from ${r.name}? This cannot be undone.`)) return;
    setBusy(r.id);
    await supabase.from('site_reviews').delete().eq('id', r.id);
    setBusy('');
    void load();
  };
  const show = list.filter((r) => (tab === 'live' ? r.approved : !r.approved));
  const waiting = list.filter((r) => !r.approved).length;
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/[0.08] bg-[#11151E] p-3">
        <p className="text-[12.5px] font-bold text-white">Reviews about ROSE on myrosebd.com</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          People who use ROSE write a review (stars and a few words) at the bottom of the myrosebd.com home page. A new review comes here as WAITING and shows on the website only after you tap APPROVE. You can reply, hide it again or delete it. Shop product reviews are not here; they are in each shop's admin › REVIEWS.
        </p>
        <a href="https://www.myrosebd.com/#reviews" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11.5px] font-bold text-teal-300 underline">See the reviews part of the website</a>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {(['waiting', 'live'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`h-10 rounded-lg border text-[11px] font-bold ${tab === t ? 'border-teal-400/60 bg-teal-500/15 text-teal-200' : 'border-white/10 text-slate-400'}`}>
            {t === 'waiting' ? `WAITING (${waiting})` : `ON WEBSITE (${list.length - waiting})`}
          </button>
        ))}
      </div>
      {!show.length && <p className="p-4 text-center text-[12px] text-slate-500">{tab === 'waiting' ? 'No new reviews.' : 'No reviews on the website yet.'}</p>}
      {show.map((r) => (
        <div key={r.id} className="space-y-2 rounded-xl border border-white/[0.08] bg-[#11151E] p-3">
          <div className="flex items-center gap-2">
            {r.photo ? <img src={r.photo} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[12px] font-bold text-white">{r.name.charAt(0)}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold text-white">{r.name}</p>
              <p className="flex items-center gap-1 text-[10.5px] text-slate-400">
                {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3 w-3 ${i <= r.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />)}
                <span className="ml-1">{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
              </p>
            </div>
            {busy === r.id && <Loader2 className="h-4 w-4 animate-spin text-teal-300" />}
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-200">{r.body}</p>
          <textarea value={replies[r.id] || ''} onChange={(e) => setReplies((x) => ({ ...x, [r.id]: e.target.value }))} rows={2} placeholder="Reply from ROSE (optional, shows under the review)" className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-[12.5px] text-white" />
          <div className="grid grid-cols-3 gap-1.5">
            {r.approved ? (
              <button type="button" onClick={() => void upd(r.id, { approved: false })} className="h-9 rounded-lg border border-white/15 text-[11px] font-bold text-slate-200">HIDE</button>
            ) : (
              <button type="button" onClick={() => void upd(r.id, { approved: true, reply: (replies[r.id] || '').trim() || null })} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-teal-600 text-[11px] font-bold text-white">
                <Check className="h-3.5 w-3.5" /> APPROVE
              </button>
            )}
            <button type="button" onClick={() => void upd(r.id, { reply: (replies[r.id] || '').trim() || null })} className="h-9 rounded-lg border border-teal-400/40 text-[11px] font-bold text-teal-200">SAVE REPLY</button>
            <button type="button" onClick={() => void del(r)} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-rose-400/40 text-[11px] font-bold text-rose-300">
              <Trash2 className="h-3.5 w-3.5" /> DELETE
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
