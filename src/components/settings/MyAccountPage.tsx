import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { KeyRound, Loader2, LogOut, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types/tiya';
import { setCachedBirthYear } from '../../utils/authErrors';
import { SettingsShell } from './SettingsShell';

interface MyAccountPageProps {
  user: User;
  profile: UserProfile | null;
  onBack: () => void;
  onSignedOut: () => void;
}

export const MyAccountPage: React.FC<MyAccountPageProps> = ({
  user,
  profile,
  onBack,
  onSignedOut,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const displayName =
    profile?.full_name ||
    (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ||
    (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '') ||
    user.email?.split('@')[0] ||
    'TIYA User';

  const avatarUrl =
    profile?.avatar_url ||
    (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '') ||
    (typeof user.user_metadata?.picture === 'string' ? user.user_metadata.picture : '');

  const initial = displayName.trim().charAt(0).toUpperCase() || 'T';

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const isEmailUser =
    user.app_metadata?.provider === 'email' ||
    Boolean(user.identities?.some((id) => id.provider === 'email'));

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    if (newPassword.length < 6) {
      setPwStatus({ ok: false, text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ ok: false, text: 'Passwords do not match.' });
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPwStatus({ ok: false, text: error.message });
      } else {
        setNewPassword('');
        setConfirmPassword('');
        setPwStatus({ ok: true, text: 'Password updated successfully.' });
      }
    } catch {
      setPwStatus({ ok: false, text: 'Network error while updating password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) {
        setDeleteError(error.message || 'Could not delete account.');
        setDeleting(false);
        return;
      }
      setCachedBirthYear(user.id, null);
      await supabase.auth.signOut();
      onSignedOut();
    } catch {
      setDeleteError('Network error while deleting account.');
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignedOut();
  };

  return (
    <SettingsShell title="My Account" onBack={onBack}>
      <div className="space-y-4 pb-6">
        {/* Profile Header Card */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          {avatarUrl && !imgFailed ? (
            <img
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-14 w-14 shrink-0 rounded-full object-cover border border-slate-200 dark:border-white/10"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {user.email || 'No email'}
            </p>
          </div>
        </div>

        {/* Account Details (Read-only) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Member since</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{memberSince}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Birth year</span>
            <span className="font-mono-code font-medium text-slate-900 dark:text-slate-100">
              {profile?.birth_year ?? 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Plan</span>
            <span className="font-medium capitalize text-teal-600 dark:text-teal-400">
              {profile?.plan || 'Free'}
            </span>
          </div>
        </div>

        {/* CHANGE PASSWORD (only for email users) */}
        {isEmailUser && (
          <form
            onSubmit={handleChangePassword}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                CHANGE PASSWORD
              </p>
            </div>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />

            {pwStatus && (
              <p
                className={`text-xs ${
                  pwStatus.ok
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {pwStatus.text}
              </p>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10"
            >
              {pwLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </form>
        )}

        {/* DELETE ACCOUNT (confirm twice) */}
        <div className="rounded-2xl border border-rose-500/25 bg-white p-4 dark:bg-[#11151E]">
          <p className="text-xs font-semibold tracking-wide text-rose-600 dark:text-rose-400">
            DELETE ACCOUNT
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Permanently removes your TIYA account and profile data.
          </p>

          {deleteError && (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{deleteError}</p>
          )}

          {deleteStep === 0 && (
            <button
              type="button"
              onClick={() => setDeleteStep(1)}
              className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-600 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>DELETE ACCOUNT</span>
            </button>
          )}

          {deleteStep === 1 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-rose-600 dark:text-rose-300">
                Step 1 of 2: Are you sure you want to delete your account?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteStep(2)}
                  className="min-h-[42px] rounded-xl bg-rose-600 text-xs font-semibold text-white"
                >
                  Yes, Continue
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteStep(0)}
                  className="min-h-[42px] rounded-xl border border-slate-200 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                Final Confirmation: This cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-rose-700 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirm Delete</span>
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteStep(0)}
                  className="min-h-[42px] rounded-xl border border-slate-200 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIGN OUT at the bottom */}
        <button
          type="button"
          onClick={handleSignOut}
          data-testid="sign-out-button"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-semibold tracking-wide text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-[#11151E] dark:text-slate-100 dark:hover:bg-white/[0.06]"
        >
          <LogOut className="h-4 w-4" />
          <span>SIGN OUT</span>
        </button>
      </div>
    </SettingsShell>
  );
};
