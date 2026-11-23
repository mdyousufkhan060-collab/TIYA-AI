import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, Mail, RefreshCw, Send, ShieldCheck, Timer } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export type ForgotStep = 'email' | 'otp' | 'newpass';

export const PW_RESET_FLAG = 'rose_pw_reset';
const PW_RESET_EVENT = 'rose-pw-reset';

export function setPwResetFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(PW_RESET_FLAG, '1');
    else sessionStorage.removeItem(PW_RESET_FLAG);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PW_RESET_EVENT));
}

export function readPwResetFlag(): boolean {
  try {
    return sessionStorage.getItem(PW_RESET_FLAG) === '1';
  } catch {
    return false;
  }
}

/** App uses this to keep the "set new password" screen open after the OTP signs the user in. */
export function usePwResetFlag(): boolean {
  const [on, setOn] = useState(readPwResetFlag);
  useEffect(() => {
    const f = () => setOn(readPwResetFlag());
    window.addEventListener(PW_RESET_EVENT, f);
    return () => window.removeEventListener(PW_RESET_EVENT, f);
  }, []);
  return on;
}

const field =
  'rose-auth-field flex h-11 w-full items-center gap-3 rounded-[10px] border border-white/15 bg-[#050B16]/80 px-3.5 text-sm text-white transition-colors focus-within:border-cyan-400/70 focus-within:shadow-[0_0_14px_rgba(34,211,238,0.25)] lg:h-12';
const inputBase =
  'h-full min-w-0 flex-1 bg-transparent text-[13px] tracking-wide text-white placeholder:text-slate-400 focus:outline-none';
const mainBtn =
  'flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-500 text-[13px] font-bold tracking-wide text-[#04121F] shadow-[0_0_22px_rgba(34,211,238,0.45)] transition-transform active:scale-[0.98] disabled:opacity-60 lg:h-12';

const HEAD: Record<ForgotStep, { script1: string; script2: string; note: string }> = {
  email: { script1: 'Forgot', script2: 'Password?', note: "Don't worry! We'll help you get back in." },
  otp: { script1: 'Check Your', script2: 'Email!', note: "We've sent a 6-digit code to your email address." },
  newpass: { script1: 'Set New', script2: 'Password!', note: 'Your account is secure. Now set a new password.' },
};

function bnError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('rate') || m.includes('seconds')) return 'একটু অপেক্ষা করে আবার চেষ্টা করুন।';
  if (m.includes('expired') || m.includes('invalid') || m.includes('token')) return 'কোডটা ভুল বা মেয়াদ শেষ। নতুন কোড পাঠান।';
  if (m.includes('same') || m.includes('different')) return 'নতুন পাসওয়ার্ড আগেরটা থেকে আলাদা হতে হবে।';
  if (m.includes('weak') || m.includes('at least')) return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।';
  return msg;
}

export const ForgotPasswordFlow: React.FC<{
  initialStep?: ForgotStep;
  initialEmail?: string;
  onBack: () => void;
}> = ({ initialStep = 'email', initialEmail = '', onBack }) => {
  const [step, setStep] = useState<ForgotStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    timer.current = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [wait]);

  const sendCode = async () => {
    setErr('');
    setInfo('');
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('সঠিক ইমেইল লিখুন।');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: `${window.location.origin}/app` });
    setBusy(false);
    if (error) return setErr(bnError(error.message));
    setEmail(em);
    setStep('otp');
    setWait(60);
    setInfo('কোড পাঠানো হয়েছে। ইমেইল (Spam ফোল্ডারও) দেখুন।');
  };

  const verify = async () => {
    setErr('');
    setInfo('');
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setErr('ইমেইলে পাওয়া ৬ সংখ্যার কোড লিখুন।');
    setBusy(true);
    // keep this screen open after the code signs the user in
    setPwResetFlag(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    setBusy(false);
    if (error) {
      setPwResetFlag(false);
      return setErr(bnError(error.message));
    }
    setStep('newpass');
  };

  const savePw = async () => {
    setErr('');
    if (pw.length < 6) return setErr('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।');
    if (pw !== pw2) return setErr('দুইটা পাসওয়ার্ড মিলছে না।');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(bnError(error.message));
    setInfo('পাসওয়ার্ড বদলানো হয়েছে। ROSE খুলছে...');
    window.setTimeout(() => setPwResetFlag(false), 900);
  };

  const backToSignIn = async () => {
    if (step === 'newpass') {
      setPwResetFlag(false);
      await supabase.auth.signOut();
    }
    onBack();
  };

  const head = HEAD[step];

  const card = (
    <div className="rose-auth relative w-full rounded-[22px] border border-cyan-400/60 bg-[#06101D]/90 px-4 pb-4 pt-8 shadow-[0_0_28px_rgba(34,211,238,0.35),inset_0_0_24px_rgba(34,211,238,0.06)] backdrop-blur-xl sm:px-8 lg:px-10 lg:pb-9 lg:pt-10">
      <span className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-cyan-400 bg-[#06101D] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6)]">
        <Lock className="h-6 w-6" />
      </span>

      {step === 'email' && (
        <>
          <h1 className="text-center text-xl font-bold text-white lg:text-2xl">
            Reset Your <span className="text-cyan-300">Password</span>
          </h1>
          <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[12px] text-slate-300 lg:text-[13px]">
            Enter your email address and we'll send you a 6-digit code.
          </p>
          <div className="mt-5 space-y-3">
            <label className={field}>
              <Mail className="h-5 w-5 shrink-0 text-slate-300" />
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void sendCode()}
                placeholder="Enter your email address"
                className={inputBase}
              />
            </label>
            <button type="button" disabled={busy} onClick={() => void sendCode()} className={mainBtn}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Reset Code
            </button>
          </div>
        </>
      )}

      {step === 'otp' && (
        <>
          <h1 className="text-center text-xl font-bold text-white lg:text-2xl">
            Enter <span className="text-cyan-300">OTP</span>
          </h1>
          <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[12px] text-slate-300 lg:text-[13px]">
            Please enter the 6-digit code sent to <b className="text-white">{email}</b>
          </p>
          <div className="mt-5 space-y-3">
            <label className={field}>
              <ShieldCheck className="h-5 w-5 shrink-0 text-slate-300" />
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && void verify()}
                placeholder="123 456"
                className={`${inputBase} font-mono text-base tracking-[0.35em]`}
              />
            </label>
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-slate-300">
              <Timer className="h-4 w-4" />
              {wait > 0 ? (
                <span>
                  Resend code in <b className="text-cyan-300">00:{String(wait).padStart(2, '0')}</b>
                </span>
              ) : (
                <button type="button" disabled={busy} onClick={() => void sendCode()} className="font-semibold text-cyan-300">
                  Resend code
                </button>
              )}
            </div>
            <button type="button" disabled={busy} onClick={() => void verify()} className={mainBtn}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verify OTP
            </button>
          </div>
        </>
      )}

      {step === 'newpass' && (
        <>
          <h1 className="text-center text-xl font-bold text-white lg:text-2xl">
            New <span className="text-cyan-300">Password</span>
          </h1>
          <p className="mx-auto mt-1.5 max-w-[340px] text-center text-[12px] text-slate-300 lg:text-[13px]">
            Enter your new password and confirm it.
          </p>
          <div className="mt-5 space-y-3">
            {(
              [
                ['New Password', pw, setPw, show1, setShow1, 'new-password'],
                ['Confirm Password', pw2, setPw2, show2, setShow2, 'new-password'],
              ] as Array<[string, string, (v: string) => void, boolean, (f: (v: boolean) => boolean) => void, string]>
            ).map(([ph, val, set, show, setShow, ac]) => (
              <label key={ph} className={field}>
                <Lock className="h-5 w-5 shrink-0 text-slate-300" />
                <input
                  type={show ? 'text' : 'password'}
                  value={val}
                  autoComplete={ac}
                  onChange={(e) => set(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void savePw()}
                  placeholder={ph}
                  className={inputBase}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="flex h-9 w-9 items-center justify-center text-slate-300 hover:text-white"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </label>
            ))}
            <button type="button" disabled={busy} onClick={() => void savePw()} className={mainBtn}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Change Password
            </button>
          </div>
        </>
      )}

      {err && (
        <p role="alert" className="mt-3 rounded-[8px] border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-300">
          {err}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 rounded-[8px] border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11.5px] text-cyan-200">
          {info}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <button
        type="button"
        onClick={() => (step === 'otp' ? setStep('email') : void backToSignIn())}
        className="mx-auto mt-3 flex items-center gap-2 text-[13px] font-semibold text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" /> {step === 'otp' ? 'Back to Forgot Password' : 'Back to Sign In'}
      </button>
    </div>
  );

  const script = (cls: string) => (
    <div className={cls}>
      <p className="font-[cursive] text-3xl font-bold italic leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] lg:text-5xl">
        {head.script1}
      </p>
      <p className="font-[cursive] text-3xl font-bold italic leading-tight text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] lg:text-5xl">
        {head.script2}
      </p>
      <span className="mt-1 block h-[2px] w-24 bg-gradient-to-r from-cyan-300 to-transparent lg:w-40" />
      <p className="mt-2 max-w-[150px] text-[11.5px] leading-snug text-slate-100 drop-shadow lg:max-w-[230px] lg:text-sm">{head.note}</p>
    </div>
  );

  const footer = (
    <div className="mt-5 flex items-center justify-center gap-3 text-cyan-300/80">
      <span className="h-px w-16 bg-cyan-400/30" />
      <span className="text-center">
        <span className="block text-sm font-bold tracking-[0.3em]">ROSE</span>
        <span className="block text-[9.5px] tracking-[0.35em] text-slate-400">YOUR VOICE ASSISTANT</span>
      </span>
      <span className="h-px w-16 bg-cyan-400/30" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden overscroll-none bg-[#030814] text-white lg:overflow-y-auto">
      {/* PC: picture left, card right */}
      <div className="hidden min-h-full lg:grid lg:grid-cols-2">
        <div className="relative min-h-screen overflow-hidden">
          <img src="/tiya-home.jpg?v=3" alt="ROSE" className="absolute inset-0 h-full w-full object-cover object-[center_32%]" />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#030814]" />
        </div>
        <div className="relative flex min-h-screen flex-col items-center justify-center px-10 py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.10),transparent_65%)]" />
          {script('relative mb-12 self-start pl-6')}
          <div className="relative w-full max-w-[520px]">
            {card}
            {footer}
          </div>
        </div>
      </div>

      {/* Mobile: picture on top, card below */}
      <div className="relative flex h-[100dvh] flex-col overflow-hidden lg:hidden">
        <div className="absolute inset-x-0 top-0 h-[62%] overflow-hidden">
          <img src="/auth/login-mobile.jpg?v=4" alt="ROSE" className="h-full w-full origin-[82%_72%] scale-[1.22] object-cover object-[center_18%]" />
          <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-transparent via-[#030814]/70 to-[#030814]" />
        </div>
        {script('absolute right-3 top-[10%] z-10 text-right [&>span]:ml-auto [&>p:last-child]:ml-auto')}
        <div className="relative mx-auto mt-auto w-full max-w-[460px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-8">
          {card}
          <div className="[@media(max-height:720px)]:hidden">{footer}</div>
        </div>
      </div>
    </div>
  );
};
