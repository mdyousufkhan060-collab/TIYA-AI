import React from 'react';
import { ChevronLeft } from 'lucide-react';

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
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 px-2 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Settings"
          className="flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-sm font-medium text-teal-600 transition-colors hover:bg-slate-100 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display truncate px-2 text-sm font-semibold text-slate-900 dark:text-[#F4F5F7]">
          {title}
        </h1>

        <div className="flex min-w-[64px] justify-end pr-2">{rightAction}</div>
      </header>

      <div className="tiya-scroll flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
};
