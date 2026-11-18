import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { setCachedBirthYear } from '../../utils/authErrors';

interface AgeCheckScreenProps {
  userId: string;
  onComplete: (birthYear: number) => void;
  onSignOut: () => void;
}

export const AgeCheckScreen: React.FC<AgeCheckScreenProps> = ({
  userId,
  onComplete,
  onSignOut,
}) => {
  const currentYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState<string>('2000');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = Number(birthYear);
    if (!Number.isInteger(parsed) || parsed < 1920 || parsed > currentYear) {
      setError(`Please enter a valid year between 1920 and ${currentYear}.`);
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('set_birth_year', { y: parsed });
      if (rpcError) {
        setError(rpcError.message || 'Could not save birth year.');
        return;
      }
      setCachedBirthYear(userId, parsed);
      onComplete(parsed);
    } catch {
      setError('Network error while saving birth year.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between px-5 py-8">
      <div className="pt-6 text-center">
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F5F7]">
          Birth year
        </h1>
        <p className="mt-2 text-balance text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Asked only once so TIYA can keep conversations age-appropriate.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-[#11151E]"
      >
        <label
          htmlFor="birth-year-input"
          className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
        >
          BIRTH YEAR
        </label>

        <input
          id="birth-year-input"
          type="number"
          inputMode="numeric"
          min={1920}
          max={currentYear}
          step={1}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          className="font-mono-code mt-2 h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-xl font-semibold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
        />

        {error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-teal-500 disabled:opacity-60 active:scale-[0.98]"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>CONTINUE</span>
        </button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[44px] px-4 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};
