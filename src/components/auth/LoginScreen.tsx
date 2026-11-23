import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mapAuthErrorToBengali } from '../../utils/authErrors';

type AuthTab = 'signin' | 'signup';

export const LoginScreen: React.FC = () => {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          redirectTo: `${window.location.origin}/app`,
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

  const handleForgot = async () => {
    setErrorBn('');
    setInfoBn('');
    const em = email.trim();
    if (!em.includes('@')) {
      setErrorBn('আগে উপরে আপনার ইমেইল লিখুন, তারপর Forgot password চাপুন।');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/app` },
    });
    setLoading(false);
    if (error) setErrorBn(mapAuthErrorToBengali(error.message));
    else setInfoBn('Sign-in link sent. Check your email.');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBn('');
    setInfoBn('');

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (tab === 'signup') {
      if (!trimmedName) {
        setErrorBn('অনুগ্রহ করে আপনার নাম লিখুন।');
        return;
      }
      if (!trimmedEmail || !password || !confirmPassword) {
        setErrorBn('অনুগ্রহ করে সবগুলো ঘর পূরণ করুন।');
        return;
      }
      if (password !== confirmPassword) {
        setErrorBn('Passwords do not match (দুটো পাসওয়ার্ড মিলছে না)');
        return;
      }
      if (password.length < 6) {
        setErrorBn('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে। (Minimum 6 characters)');
        return;
      }
    } else if (!trimmedEmail || !password) {
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
            data: { full_name: trimmedName },
          },
        });
        if (error) {
          setErrorBn(mapAuthErrorToBengali(error.message));
        } else if (!data.session) {
          setInfoBn('Check your email to confirm your account');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBn(mapAuthErrorToBengali(msg));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: AuthTab) => {
    setTab(t);
    setErrorBn('');
    setInfoBn('');
  };

  const field =
    'flex h-12 w-full items-center gap-3 rounded-[10px] border border-white/15 bg-[#050B16]/80 px-3.5 text-sm text-white transition-colors focus-within:border-cyan-400/70 focus-within:shadow-[0_0_14px_rgba(34,211,238,0.25)]';
  const inputBase = 'h-full min-w-0 flex-1 bg-transparent text-[13px] tracking-wide text-white placeholder:uppercase placeholder:tracking-wider placeholder:text-slate-400 focus:outline-none';

  const googleIcon = (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
    </svg>
  );

  const submitBtn = (
    <button
      type="submit"
      disabled={loading || googleLoading}
      data-testid="auth-submit-button"
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-500 text-[13px] font-bold tracking-wider text-[#04121F] shadow-[0_0_22px_rgba(34,211,238,0.45)] transition-transform active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      <span>{tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
    </button>
  );

  const googleBtn = (label: string) => (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={googleLoading || loading}
      data-testid="google-signin-button"
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[10px] border border-white/20 bg-[#050B16]/80 text-[13px] font-semibold text-white transition-colors hover:border-cyan-400/60 hover:bg-white/[0.04] active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
    >
      {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : googleIcon}
      <span>{label}</span>
    </button>
  );

  const card = (
    <div className="relative w-full rounded-[22px] border border-cyan-400/60 bg-[#06101D]/90 px-5 pb-6 pt-7 shadow-[0_0_28px_rgba(34,211,238,0.35),inset_0_0_24px_rgba(34,211,238,0.06)] backdrop-blur-xl sm:px-8 lg:px-10 lg:pb-9 lg:pt-10">
      {/* Logo */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_18px_rgba(34,211,238,0.5)] lg:h-20 lg:w-20">
          <span className="flex items-center gap-[3px]" aria-hidden="true">
            {[8, 16, 24, 16, 8].map((h, i) => (
              <span key={i} className="w-[4px] rounded-full bg-cyan-300 lg:w-[5px]" style={{ height: h }} />
            ))}
          </span>
        </div>
        <h1 className="mt-3 pl-[0.6em] font-display text-3xl font-medium tracking-[0.6em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)] lg:text-5xl">
          ROSE
        </h1>
        <p className="mt-2 text-[12.5px] text-slate-300 lg:text-sm">Sign in to continue to your voice assistant</p>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Authentication mode" className="mt-5 grid grid-cols-2 border-b border-white/10">
        {(['signin', 'signup'] as AuthTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`relative h-11 text-[13px] font-bold tracking-wider transition-colors ${
              tab === t ? 'text-cyan-300' : 'text-slate-300 hover:text-white'
            }`}
          >
            {t === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />}
          </button>
        ))}
      </div>

      <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3" noValidate>
        {tab === 'signup' && (
          <label className={field}>
            <User className="h-5 w-5 shrink-0 text-slate-300" />
            <input
              id="login-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              className={inputBase}
            />
          </label>
        )}

        <label className={field}>
          <Mail className="h-5 w-5 shrink-0 text-slate-300" />
          <input
            id="login-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            className={inputBase}
          />
        </label>

        <label className={field}>
          <Lock className="h-5 w-5 shrink-0 text-slate-300" />
          <input
            id="login-password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            className={inputBase}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>

        {tab === 'signup' && (
          <label className={field}>
            <Lock className="h-5 w-5 shrink-0 text-slate-300" />
            <input
              id="login-confirm-password-input"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white"
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </label>
        )}

        {tab === 'signin' && (
          <div className="flex justify-end">
            <button type="button" onClick={handleForgot} className="text-[13px] font-medium text-cyan-300 hover:text-cyan-200">
              Forgot password?
            </button>
          </div>
        )}

        {errorBn && (
          <p role="alert" data-testid="auth-error-message" className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] leading-snug text-rose-300">
            {errorBn}
          </p>
        )}
        {infoBn && (
          <p role="status" data-testid="auth-info-message" className="rounded-[8px] border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11.5px] leading-snug text-cyan-200">
            {infoBn}
          </p>
        )}

        {/* Mobile: SIGN IN and Google side by side so nothing falls off the screen */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 lg:hidden">
          {submitBtn}
          {googleBtn('Google')}
        </div>

        {/* PC: stacked with "or", same as the design */}
        <div className="hidden space-y-3 pt-1 lg:block">
          {submitBtn}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
          {googleBtn('Continue with Google')}
        </div>
      </form>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#030814] text-white">
      {/* ---------- PC: picture left, card right ---------- */}
      <div className="hidden min-h-full lg:grid lg:grid-cols-2">
        <div className="relative min-h-screen overflow-hidden">
          <img src="/auth/login-pc.jpg" alt="ROSE" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#030814]" />
        </div>
        <div className="relative flex min-h-screen items-center justify-center px-10 py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.10),transparent_65%)]" />
          <div className="relative w-full max-w-[560px]">{card}</div>
        </div>
      </div>

      {/* ---------- Mobile / tablet: picture on top, card overlapping below ---------- */}
      <div className="relative min-h-full lg:hidden">
        <div className="absolute inset-x-0 top-0 h-[62vh] max-h-[640px] overflow-hidden">
          <img src="/auth/login-mobile.jpg" alt="ROSE" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent via-[#030814]/70 to-[#030814]" />
        </div>
        <div className="relative mx-auto w-full max-w-[460px] px-4 pb-6 pt-[36vh]">{card}</div>
      </div>
    </div>
  );
};
