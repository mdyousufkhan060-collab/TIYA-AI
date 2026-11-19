import React from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

interface SettingsShellProps {
  title: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export const SettingsShell: React.FC<SettingsShellProps> = ({
  title,
  onBack,
  rightAction,
  children,
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 pt-[env(safe-area-inset-top)] [min-height:calc(3rem+env(safe-area-inset-top))] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          data-testid="settings-back-button"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl px-2 text-teal-600 transition-colors hover:bg-slate-100 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h1 className="font-display truncate px-2 text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-[#F4F5F7]">
          {title}
        </h1>

        <div className="flex min-w-[40px] justify-end pr-1">{rightAction}</div>
      </header>

      <div className="tiya-scroll flex-1 overflow-y-auto px-3.5 py-3">{children}</div>
    </div>
  );
};

interface SettingsBarProps {
  badge?: string | React.ReactNode;
  title: string;
  value?: string;
  locked?: boolean;
  onClick: () => void;
  testId?: string;
  hideChevron?: boolean;
  tone?: 'default' | 'danger' | 'accent';
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  badge,
  title,
  value,
  locked = false,
  onClick,
  testId,
  hideChevron = false,
  tone = 'default',
}) => {
  const titleColor =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'accent'
        ? 'text-teal-700 dark:text-teal-300'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]"
    >
      {badge !== undefined && (
        <span className="font-mono-code flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
          {badge}
        </span>
      )}

      <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide uppercase ${titleColor}`}>
        {title}
      </span>

      {value && (
        <span className="max-w-[115px] shrink-0 truncate text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
          {value}
        </span>
      )}

      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-label="Locked" />
      ) : (
        !hideChevron && (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        )
      )}
    </button>
  );
};

interface SettingsToggleBarProps {
  badge?: string | React.ReactNode;
  title: string;
  value?: string;
  checked: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  testId?: string;
}

export const SettingsToggleBar: React.FC<SettingsToggleBarProps> = ({
  badge,
  title,
  value,
  checked,
  onToggle,
  ariaLabel,
  testId,
}) => {
  return (
    <div className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/[0.08] dark:bg-[#11151E]">
      {badge !== undefined && (
        <span className="font-mono-code flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[10px] font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
          {badge}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
        {title}
      </span>

      {value && (
        <span className="max-w-[90px] shrink-0 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {value}
        </span>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || `Toggle ${title}`}
        data-testid={testId}
        onClick={onToggle}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-teal-600' : 'bg-slate-300 dark:bg-white/15'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
