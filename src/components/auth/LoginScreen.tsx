import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mapAuthErrorToBengali } from '../../utils/authErrors';

type AuthTab = 'signin' | 'signup';

export const LoginScreen: React.FC = () => {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorBn, setErrorBn] = useState('');
  const [infoBn, setInfoBn] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorBn('');
    setInfoBn('');
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setErrorBn(mapAuthErrorToBengali(error.message));
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBn(mapAuthErrorToBengali(msg));
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBn('');
    setInfoBn('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorBn('অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorBn(mapAuthErrorToBengali(error.message));
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          setErrorBn(mapAuthErrorToBengali(error.message));
        } else if (!data.session) {
          setInfoBn(
            'অ্যাকাউন্ট তৈরি হয়েছে! আপনার ইমেইলে পাঠানো কনফার্মেশন লিংকে ক্লিক করে Sign In করুন।',
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBn(mapAuthErrorToBengali(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-4">
      <div className="mx-auto w-full space-y-4">
        {/* Compact Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 via-cyan-500 to-slate-800 shadow-md shadow-teal-500/20">
            <span className="flex items-center gap-0.5" aria-hidden="true">
              <span className="h-2 w-0.5 rounded-full bg-white/90" />
              <span className="h-3.5 w-0.5 rounded-full bg-white/95" />
              <span className="h-2 w-0.5 rounded-full bg-white/90" />
            </span>
          </div>
          <h1 className="font-display text-lg font-bold tracking-[0.2em] text-slate-900 dark:text-[#F4F5F7]">
            TIYA
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            Sign in to continue to your voice assistant
          </p>
        </div>

        {/* Compact Settings-style Auth Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]">
          {/* SIGN IN / CREATE ACCOUNT Tabs */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#090B10]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signin'}
              onClick={() => {
                setTab('signin');
                setErrorBn('');
                setInfoBn('');
              }}
              className={`min-h-[36px] rounded-lg text-[11px] font-semibold tracking-wide transition-colors ${
                tab === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1A202E] dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              SIGN IN
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              onClick={() => {
                setTab('signup');
                setErrorBn('');
                setInfoBn('');
              }}
              className={`min-h-[36px] rounded-lg text-[11px] font-semibold tracking-wide transition-colors ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1A202E] dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              CREATE ACCOUNT
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="mt-3 space-y-2.5">
            <div>
              <label
                htmlFor="login-email-input"
                className="block text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
              >
                EMAIL
              </label>
              <input
                id="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="login-password-input"
                className="block text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
              >
                PASSWORD
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorBn && (
              <p
                role="alert"
                data-testid="auth-error-message"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-rose-600 dark:text-rose-300"
              >
                {errorBn}
              </p>
            )}

            {infoBn && (
              <p
                role="status"
                className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-teal-700 dark:text-teal-300"
              >
                {infoBn}
              </p>
            )}

            {/* One row: [SIGN IN / CREATE ACCOUNT] on left, [G Google] on right */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || googleLoading}
                data-testid="auth-submit-button"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-teal-500 disabled:opacity-60 active:scale-[0.98] whitespace-nowrap"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                data-testid="google-signin-button"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:opacity-60 active:scale-[0.98] dark:border-white/10 dark:bg-[#1A202E] dark:text-white dark:hover:bg-white/[0.1] whitespace-nowrap"
              >
                {googleLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>Google</span>
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          Your session stays active until you sign out.
        </p>
      </div>
    </div>
  );
};
