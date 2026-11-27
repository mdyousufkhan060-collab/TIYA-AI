import React, { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * REVIEWS on myrosebd.com (own file, so nothing else breaks).
 * Anyone signed in with Google can leave ONE review (stars + a few words). It shows on the website only after
 * the ROSE admin approves it in 24 SITE REVIEWS. The writer sees their own review as "waiting" until then.
 */
type Review = { id: string; user_id: string; name: string; photo: string | null; stars: number; body: string; approved: boolean; reply: string | null; created_at: string };

const Stars: React.FC<{ n: number; size?: string; onPick?: (n: number) => void }> = ({ n, size = 'h-4 w-4', onPick }) => (
  <span className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <button key={i} type="button" disabled={!onPick} onClick={() => onPick?.(i)} aria-label={`${i} star`} className={onPick ? 'cursor-pointer' : 'cursor-default'}>
        <Star className={`${size} ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
      </button>
    ))}
  </span>
);

export const SiteReviews: React.FC = () => {
  const [list, setList] = useState<Review[]>([]);
  const [me, setMe] = useState<{ id: string; name: string; photo: string } | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data } = await supabase.from('site_reviews').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(60);
    setList((data as Review[]) || []);
    const { data: s } = await supabase.auth.getSession();
    const u = s.session?.user;
    if (u) {
      const m = (u.user_metadata || {}) as Record<string, string>;
      setMe({ id: u.id, name: m.full_name || m.name || (u.email || '').split('@')[0], photo: m.avatar_url || m.picture || '' });
      const { data: own } = await supabase.from('site_reviews').select('*').eq('user_id', u.id).maybeSingle();
      setMine((own as Review) || null);
      if (own) {
        setStars((own as Review).stars);
        setBody((own as Review).body);
        setName((own as Review).name);
      } else setName(m.full_name || m.name || '');
    }
  };
  useEffect(() => {
    void load();
    // came back from Google sign-in to write a review
    if (window.location.hash.includes('reviews') || window.sessionStorage.getItem('rose_review_open') === '1') {
      window.sessionStorage.removeItem('rose_review_open');
      setOpen(true);
      window.setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }), 900);
    }
  }, []);

  const signIn = async () => {
    window.sessionStorage.setItem('rose_review_open', '1');
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  };

  const save = async () => {
    if (!me) return void signIn();
    if (name.trim().length < 2) return setMsg('Write your name.');
    if (body.trim().length < 5) return setMsg('Write a few words about ROSE.');
    setBusy(true);
    setMsg('');
    const row = { user_id: me.id, name: name.trim().slice(0, 60), photo: me.photo || null, stars, body: body.trim().slice(0, 600) };
    const { error } = mine ? await supabase.from('site_reviews').update(row).eq('id', mine.id) : await supabase.from('site_reviews').insert(row);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg('ধন্যবাদ! আপনার রিভিউ ROSE টিম দেখে নেওয়ার পর ওয়েবসাইটে দেখাবে।');
    setOpen(false);
    void load();
  };

  const avg = list.length ? list.reduce((a, r) => a + r.stars, 0) / list.length : 0;

  return (
    <section id="reviews" className="mx-auto max-w-[1760px] px-5 py-16 lg:px-10">
      <p className="text-xs font-bold tracking-[0.3em] text-pink-300">REVIEWS</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold md:text-4xl">What people say about ROSE</h2>
          <p className="mt-2 text-sm text-slate-300">ROSE ভালো লাগলে আপনার মতামত দিন। আপনার কথা অন্যদের সাহায্য করবে।</p>
        </div>
        {list.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-3xl font-extrabold">{avg.toFixed(1)}</span>
            <span>
              <Stars n={Math.round(avg)} />
              <span className="block text-[11px] text-slate-400">{list.length} review{list.length > 1 ? 's' : ''}</span>
            </span>
          </div>
        )}
      </div>

      {list.length > 0 ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                {r.photo ? (
                  <img src={r.photo} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-pink-500/20 font-bold text-pink-200">{r.name.charAt(0).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <Stars n={r.stars} size="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">{r.body}</p>
              {r.reply && <p className="mt-3 rounded-xl bg-teal-500/10 p-3 text-[12.5px] text-teal-100"><b className="text-teal-300">ROSE:</b> {r.reply}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">এখনো কোনো রিভিউ নেই। প্রথম রিভিউটা আপনিই দিন!</div>
      )}

      {mine && !mine.approved && !open && (
        <p className="mt-4 text-center text-[12.5px] text-amber-300">আপনার রিভিউ ROSE টিমের অনুমতির অপেক্ষায় আছে।</p>
      )}
      {msg && !open && <p className="mt-3 text-center text-[12.5px] text-teal-300">{msg}</p>}

      <div className="mt-6 flex justify-center">
        {!open && (
          <button type="button" onClick={() => (me ? setOpen(true) : void signIn())} className="inline-flex h-12 items-center gap-2 rounded-full bg-pink-500 px-7 text-sm font-bold text-white hover:bg-pink-400">
            <Star className="h-4 w-4 fill-white" /> {mine ? 'Edit my review' : 'Write a review'}
          </button>
        )}
      </div>

      {open && (
        <div className="mx-auto mt-6 max-w-xl space-y-3 rounded-2xl border border-pink-400/30 bg-white/[0.04] p-5">
          {!me ? (
            <button type="button" onClick={() => void signIn()} className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black">Continue with Google to write a review</button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Your rating</p>
                <Stars n={stars} size="h-7 w-7" onPick={setStars} />
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white placeholder:text-slate-500" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={600} placeholder="ROSE নিয়ে আপনার অভিজ্ঞতা লিখুন…" className="w-full rounded-xl border border-white/15 bg-black/40 p-4 text-sm text-white placeholder:text-slate-500" />
              {msg && <p className="text-[12.5px] text-amber-300">{msg}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-full border border-white/20 text-sm font-bold text-slate-200">Cancel</button>
                <button type="button" onClick={() => void save()} disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-pink-500 text-sm font-bold text-white disabled:opacity-60">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send review
                </button>
              </div>
              <p className="text-center text-[11px] text-slate-500">Your review shows after the ROSE team checks it. One review per Google account.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
};
