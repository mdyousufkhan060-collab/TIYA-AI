import React, { useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Check, GraduationCap, Loader2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { setCachedBirthYear } from '../../utils/authErrors';

export type AccountMode = 'personal' | 'student' | 'business';

interface OnboardingScreenProps {
  userId: string;
  /** birth year already saved earlier: skip the age step */
  knownBirthYear: number | null;
  onComplete: (mode: AccountMode, birthYear: number | null, dob: string | null) => void;
  onSignOut: () => void;
}

const MODES: Array<{
  id: AccountMode;
  title: string;
  line: string;
  points: string[];
  icon: React.ReactNode;
  color: string;
}> = [
  {
    id: 'personal',
    title: 'PERSONAL',
    line: 'Your own assistant for daily life',
    points: ['Voice & chat', 'Reminders & tasks', 'Open apps, write messages'],
    icon: <User className="h-6 w-6" />,
    color: '#2DD4BF',
  },
  {
    id: 'student',
    title: 'STUDENT',
    line: 'Study help, explained simply',
    points: ['Explain any subject', 'Notes, MCQ & routines', 'Exam preparation'],
    icon: <GraduationCap className="h-6 w-6" />,
    color: '#60A5FA',
  },
  {
    id: 'business',
    title: 'BUSINESS',
    line: 'AI assistant for your business',
    points: ['Products, orders, customers', 'Auto replies to customers', 'Sales reports'],
    icon: <Briefcase className="h-6 w-6" />,
    color: '#FBBF24',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const boxCls =
  'h-12 w-full rounded-[4px] border border-white/15 bg-[#0B0F16] px-3 text-sm font-semibold text-white focus:border-teal-400 focus:outline-none';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  userId,
  knownBirthYear,
  onComplete,
  onSignOut,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<AccountMode | null>(null);
  const [ageTab, setAgeTab] = useState<'age' | 'dob'>('age');
  const [age, setAge] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const thisYear = now.getFullYear();
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = thisYear - 5; y >= 1920; y--) out.push(y);
    return out;
  }, [thisYear]);
  const daysInMonth = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31;

  /** Works out the date of birth (yyyy-mm-dd) from whichever tab was used */
  const computeDob = (): { dob: string; birthYear: number; ageNum: number } | null => {
    if (ageTab === 'age') {
      const a = Math.floor(Number(age));
      if (!a || a < 5 || a > 105) return null;
      const by = thisYear - a;
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(Math.min(now.getDate(), 28)).padStart(2, '0');
      return { dob: `${by}-${mm}-${dd}`, birthYear: by, ageNum: a };
    }
    if (!day || !month || !year) return null;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (d > new Date(y, m, 0).getDate()) return null;
    let a = thisYear - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a -= 1;
    return { dob: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, birthYear: y, ageNum: a };
  };

  const save = async (chosen: AccountMode, dobInfo: ReturnType<typeof computeDob>) => {
    setSaving(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('set_account_mode', {
      p_mode: chosen,
      p_dob: dobInfo?.dob ?? null,
    });
    setSaving(false);
    if (rpcErr) {
      setError(rpcErr.message || 'Could not save. Try again.');
      return;
    }
    if (data && data.ok === false) {
      // Business is 18+ only: send them back to choose another mode
      if (dobInfo) setCachedBirthYear(userId, dobInfo.birthYear);
      setError(data.error || 'Could not save.');
      setMode(null);
      setStep(1);
      return;
    }
    if (dobInfo) setCachedBirthYear(userId, dobInfo.birthYear);
    onComplete(chosen, dobInfo?.birthYear ?? knownBirthYear, dobInfo?.dob ?? null);
  };

  const nextFromMode = () => {
    if (!mode) return;
    setError('');
    if (knownBirthYear !== null) {
      if (mode === 'business' && thisYear - knownBirthYear < 18) {
        setError('Business mode is only for 18+.');
        return;
      }
      void save(mode, null);
    } else {
      setStep(2);
    }
  };

  const finish = () => {
    const info = computeDob();
    if (!info) {
      setError(ageTab === 'age' ? 'Type your age (5 to 105).' : 'Select a valid day, month and year.');
      return;
    }
    if (mode === 'business' && info.ageNum < 18) {
      setError('Business mode is only for 18+. Please choose Personal or Student.');
      return;
    }
    void save(mode!, info);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#07090D] pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setError('');
            }}
            className="flex h-10 items-center gap-1 text-xs font-semibold text-teal-300"
          >
            <ArrowLeft className="h-4 w-4" /> BACK
          </button>
        ) : (
          <span className="font-display text-sm font-bold tracking-[0.2em] text-white">ROSE</span>
        )}
        <span className="text-[10px] font-semibold tracking-widest text-slate-400">
          STEP {step} / {knownBirthYear !== null ? 1 : 2}
        </span>
      </div>

      {/* Progress */}
      <div className="flex h-1 shrink-0 gap-1 px-4 pt-2">
        <div className="h-1 flex-1 bg-teal-400" />
        {knownBirthYear === null && <div className={`h-1 flex-1 ${step === 2 ? 'bg-teal-400' : 'bg-white/10'}`} />}
      </div>

      <div className="tiya-scroll flex-1 overflow-y-auto px-4 pb-6 pt-6">
        {step === 1 ? (
          <>
            <h1 className="font-display text-2xl font-bold text-white">Choose your mode</h1>
            <p className="mt-1.5 text-xs text-slate-400">How will you use ROSE? You can change it later.</p>

            <div className="mt-5 space-y-3">
              {MODES.map((m) => {
                const on = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`mode-${m.id}`}
                    onClick={() => {
                      setMode(m.id);
                      setError('');
                    }}
                    style={{ borderColor: on ? m.color : undefined, boxShadow: on ? `0 0 0 1px ${m.color}, 0 0 24px -6px ${m.color}` : undefined }}
                    className="relative flex w-full items-start gap-3 rounded-[4px] border border-white/[0.1] bg-[#0E131C] p-4 text-left transition-all active:scale-[0.99]"
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px]"
                      style={{ background: `${m.color}1F`, color: m.color }}
                    >
                      {m.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold tracking-wider text-white">{m.title}</span>
                      <span className="mt-0.5 block text-[11.5px] text-slate-300">{m.line}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {m.points.map((p) => (
                          <span key={p} className="rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">
                            {p}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border"
                      style={{ borderColor: on ? m.color : 'rgba(255,255,255,0.25)', background: on ? m.color : 'transparent' }}
                    >
                      {on && <Check className="h-3.5 w-3.5 text-black" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-white">Your age</h1>
            <p className="mt-1.5 text-xs text-slate-400">
              Asked only once so ROSE can keep conversations safe for your age.
            </p>

            {/* Tabs */}
            <div className="mt-5 grid grid-cols-2 gap-0 rounded-[4px] border border-white/[0.1] p-1">
              {(
                [
                  ['age', 'TYPE AGE'],
                  ['dob', 'DATE OF BIRTH'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAgeTab(id);
                    setError('');
                  }}
                  className={`h-10 rounded-[3px] text-[11px] font-bold tracking-wider ${
                    ageTab === id ? 'bg-teal-500 text-black' : 'text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[4px] border border-white/[0.08] bg-[#0E131C] p-4">
              {ageTab === 'age' ? (
                <>
                  <label htmlFor="ob-age" className="block text-[10.5px] font-semibold tracking-wider text-slate-400">
                    AGE (YEARS)
                  </label>
                  <input
                    id="ob-age"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={105}
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value.slice(0, 3));
                      setError('');
                    }}
                    placeholder="e.g. 25"
                    className={`${boxCls} mt-1.5 text-center text-2xl`}
                  />
                </>
              ) : (
                <div className="grid grid-cols-[1fr_1.3fr_1.4fr] gap-2">
                  <div>
                    <label className="block text-[10.5px] font-semibold tracking-wider text-slate-400">DAY</label>
                    <select value={day} onChange={(e) => setDay(e.target.value)} className={`${boxCls} mt-1.5`}>
                      <option value="">DD</option>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {String(d).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold tracking-wider text-slate-400">MONTH</label>
                    <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${boxCls} mt-1.5`}>
                      <option value="">MM</option>
                      {MONTHS.map((mn, i) => (
                        <option key={mn} value={i + 1}>
                          {mn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold tracking-wider text-slate-400">YEAR</label>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className={`${boxCls} mt-1.5`}>
                      <option value="">YYYY</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(() => {
                const info = computeDob();
                return info ? (
                  <p className="mt-3 text-center text-[11px] text-teal-300">
                    Age: <b>{info.ageNum}</b> years
                  </p>
                ) : null;
              })()}
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-[4px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}
      </div>

      {/* Bottom action */}
      <div className="shrink-0 space-y-2 border-t border-white/[0.08] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={saving || (step === 1 ? !mode : false)}
          onClick={step === 1 ? nextFromMode : finish}
          data-testid="onboarding-continue"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-teal-500 text-xs font-bold tracking-widest text-black disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {step === 1 && knownBirthYear === null ? 'CONTINUE' : 'START ROSE'}
        </button>
        <button type="button" onClick={onSignOut} className="h-9 w-full text-[11px] font-medium text-slate-500">
          Sign out
        </button>
      </div>
    </div>
  );
};
