import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
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
  const maxBirthYear = currentYear - 5;
  const minBirthYear = 1920;

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = maxBirthYear; y >= minBirthYear; y--) {
      years.push(y);
    }
    return years;
  }, [maxBirthYear]);

  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'center' });
    }
  }, [dropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      birthYear === null ||
      !Number.isInteger(birthYear) ||
      birthYear < minBirthYear ||
      birthYear > maxBirthYear
    ) {
      setError('Please select your birth year.');
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('set_birth_year', { y: birthYear });
      if (rpcError) {
        setError(rpcError.message || 'Could not save birth year.');
        return;
      }
      setCachedBirthYear(userId, birthYear);
      onComplete(birthYear);
    } catch {
      setError('Network error while saving birth year.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between px-5 py-6">
      <div className="pt-4">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-[#F4F5F7]">
            Birth year
          </h1>
          <p className="mt-2 text-balance text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Asked only once so ROSE can keep conversations age-appropriate.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
        >
          <label
            id="birth-year-label"
            htmlFor="birth-year-trigger"
            className="block text-[10.5px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
          >
            BIRTH YEAR
          </label>

          <div ref={dropdownRef} className="relative mt-1.5">
            <button
              id="birth-year-trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-labelledby="birth-year-label birth-year-trigger"
              data-testid="birth-year-trigger"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10]"
            >
              <span
                className={
                  birthYear !== null
                    ? 'font-mono-code font-semibold text-slate-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500'
                }
              >
                {birthYear !== null ? String(birthYear) : 'Select year'}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  dropdownOpen ? 'rotate-180 text-teal-400' : ''
                }`}
              />
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Birth year"
                data-testid="birth-year-listbox"
                className="tiya-scroll absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[min(45dvh,360px)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-white/15 dark:bg-[#0C1018]"
              >
                {yearOptions.map((year) => {
                  const isSelected = birthYear === year;
                  return (
                    <button
                      key={year}
                      ref={isSelected ? selectedItemRef : null}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setBirthYear(year);
                        setDropdownOpen(false);
                        setError('');
                      }}
                      className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-xs transition-colors ${
                        isSelected
                          ? 'bg-teal-500/15 font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
                          : 'font-mono-code text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className="font-mono-code">{year}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-teal-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-2.5 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || birthYear === null}
            data-testid="birth-year-continue"
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>CONTINUE</span>
          </button>
        </form>
      </div>

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
