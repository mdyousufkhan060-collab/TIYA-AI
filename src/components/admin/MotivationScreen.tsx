import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MotivationPost } from '../../types/tiya';
import { getFirstLine } from '../../utils/motivation';

interface MotivationScreenProps {
  onBack: () => void;
  onBroadcastSaved?: () => void;
}

export const MotivationScreen: React.FC<MotivationScreenProps> = ({
  onBack,
  onBroadcastSaved,
}) => {
  const [posts, setPosts] = useState<MotivationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState('');
  const [formError, setFormError] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('motivations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
        return;
      }
      setPosts((data as MotivationPost[]) || []);
    } catch {
      setLoadError('Failed to load motivation posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setIsPublished(true);
  };

  const handleEdit = (post: MotivationPost) => {
    setEditingId(post.id);
    setTitle((post.title || '').trim());
    setBody(post.body);
    setIsPublished(Boolean(post.is_published));
    setFormError('');
    setFormStatus('');
    setConfirmDeleteId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanBody) {
      setFormError('Enter a motivation message.');
      setFormStatus('');
      return;
    }

    setSaving(true);
    setFormError('');
    setFormStatus('');

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('motivations')
          .update({
            title: cleanTitle,
            body: cleanBody,
            is_published: isPublished,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select()
          .single();

        if (error) {
          setFormError(error.message);
          return;
        }

        const updated = data as MotivationPost;
        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        resetForm();
        setFormStatus('Updated.');
      } else {
        const { data, error } = await supabase
          .from('motivations')
          .insert({
            title: cleanTitle,
            body: cleanBody,
            is_published: isPublished,
          })
          .select()
          .single();

        if (error) {
          setFormError(error.message);
          return;
        }

        const created = data as MotivationPost;
        setPosts((prev) => [created, ...prev]);

        let notifyWarning = '';
        if (isPublished) {
          const { error: notifyErr } = await supabase.rpc('admin_notify', {
            target: null,
            t: cleanTitle || 'Motivation',
            b: cleanBody,
          });
          if (notifyErr) {
            notifyWarning = ` Saved, but notification failed: ${notifyErr.message}`;
          } else {
            onBroadcastSaved?.();
          }
        }

        resetForm();
        if (notifyWarning) {
          setFormError(notifyWarning.trim());
        } else {
          setFormStatus(isPublished ? 'Saved & notified all users.' : 'Saved as hidden.');
        }
      }
    } catch {
      setFormError('Network error while saving post.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    try {
      const { error } = await supabase.from('motivations').delete().eq('id', postId);
      if (error) {
        setLoadError(error.message);
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (editingId === postId) {
        resetForm();
      }
      setConfirmDeleteId(null);
    } catch {
      setLoadError('Failed to delete post.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#060911] text-slate-100">
      {/* Header */}
      <header className="flex shrink-0 pt-[env(safe-area-inset-top)] [min-height:calc(3.25rem+env(safe-area-inset-top))] items-center justify-between border-b border-cyan-400/15 bg-[#090D16] px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-cyan-300 transition-colors hover:bg-cyan-400/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <h1 className="font-display text-xs font-bold tracking-[0.2em] text-white">
            MOTIVATION
          </h1>
        </div>

        <button
          type="button"
          onClick={loadPosts}
          aria-label="Refresh posts"
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="tiya-scroll flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5">
        {/* Composer Card */}
        <form
          onSubmit={handleSave}
          className="space-y-2.5 rounded-2xl border border-cyan-400/25 bg-[#0B101B] p-3.5 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.16em] text-cyan-300">
              {editingId ? 'EDIT POST' : 'NEW MOTIVATION'}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-medium text-slate-400 hover:text-white"
              >
                Cancel edit
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400">
              TITLE (OPTIONAL)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Motivation"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#070A12] px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400">
              MESSAGE
            </span>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write daily motivation message..."
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#070A12] px-3 py-2 text-xs leading-relaxed text-white placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              aria-label="PUBLISH"
              onClick={() => setIsPublished((v) => !v)}
              className="flex min-h-[38px] items-center gap-2.5 text-left"
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                  isPublished
                    ? 'border-cyan-400/60 bg-cyan-500/30'
                    : 'border-white/15 bg-white/5'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                    isPublished
                      ? 'translate-x-4 bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                      : 'translate-x-0.5 bg-slate-400'
                  }`}
                />
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-200">
                PUBLISH
              </span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex h-10 min-w-[96px] items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-4 text-xs font-bold tracking-wider text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.35)] transition-colors hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{editingId ? 'UPDATE' : 'SAVE'}</span>
            </button>
          </div>

          {formError && (
            <p className="text-[11px] font-medium text-rose-400">{formError}</p>
          )}
          {formStatus && (
            <p className="text-[11px] font-medium text-cyan-300">{formStatus}</p>
          )}
        </form>

        {/* All Posts List */}
        <section aria-label="Motivation posts" className="space-y-2 pb-4">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[10.5px] font-bold tracking-[0.16em] text-slate-400">
              ALL POSTS ({posts.length})
            </h2>
          </div>

          {loadError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
              Loading posts...
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0B101B] px-4 py-7 text-center text-xs text-slate-400">
              No motivation posts yet.
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => {
                const displayTitle = (post.title || '').trim() || 'Motivation';
                const preview = getFirstLine(post.body);
                const dateLabel = new Date(post.created_at).toLocaleDateString();
                const isConfirmingDelete = confirmDeleteId === post.id;

                return (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#0B101B] px-3.5 py-2.5 transition-colors hover:border-cyan-400/25"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xs font-semibold text-white">
                          {displayTitle}
                        </h3>
                        <p className="mt-0.5 truncate text-[11px] text-slate-300">
                          {preview}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                          <span className="font-mono-code text-slate-400">{dateLabel}</span>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span
                            className={`font-semibold tracking-wider ${
                              post.is_published ? 'text-cyan-300' : 'text-slate-500'
                            }`}
                          >
                            {post.is_published ? 'PUBLISHED' : 'HIDDEN'}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(post)}
                          aria-label={`Edit ${displayTitle}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteId(isConfirmingDelete ? null : post.id)
                          }
                          aria-label={`Delete ${displayTitle}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isConfirmingDelete && (
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                        <span className="text-[11px] text-rose-300">Delete this post?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 rounded-lg border border-white/10 px-2.5 text-[11px] font-medium text-slate-300 hover:bg-white/5"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === post.id}
                            onClick={() => handleDelete(post.id)}
                            className="flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-3 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            {deletingId === post.id && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            <span>Confirm</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
