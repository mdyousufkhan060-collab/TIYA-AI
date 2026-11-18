import React, { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { LiveModelInfo, TiyaSettings } from '../../types/tiya';
import { SettingsShell } from './SettingsShell';

interface LiveModelPageProps {
  settings: TiyaSettings;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

export const LiveModelPage: React.FC<LiveModelPageProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const fetchModels = async () => {
    const key = settings.apiKey.trim();
    if (!key) {
      setFetchError('No API key. Add your Gemini API key in Connections to fetch live models.');
      return;
    }

    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/gemini/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': key,
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        models?: LiveModelInfo[];
        label?: string;
        detail?: string;
      };
      if (res.ok && data.ok && Array.isArray(data.models) && data.models.length > 0) {
        onUpdateSettings({ availableLiveModels: data.models });
      } else {
        setFetchError(data.detail || data.label || 'Could not fetch Live models.');
      }
    } catch {
      setFetchError('Failed to reach server while fetching Live models.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (settings.apiKey.trim()) {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SettingsShell
      title="3. Live Voice Model"
      onBack={onBack}
      rightAction={
        <button
          type="button"
          onClick={fetchModels}
          disabled={loading}
          aria-label="Refresh Live voice models"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-teal-600 hover:bg-slate-100 disabled:opacity-40 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Auto Fallback Toggle */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              AUTO FALLBACK
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Automatically try the next available Live model if the selected one fails.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoFallback}
            aria-label="Toggle Auto Fallback"
            onClick={() => onUpdateSettings({ autoFallback: !settings.autoFallback })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.autoFallback
                ? 'bg-teal-600'
                : 'bg-slate-300 dark:bg-white/15'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                settings.autoFallback ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {fetchError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            {fetchError}
          </div>
        )}

        {/* Models List */}
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            AVAILABLE GEMINI LIVE MODELS
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
            {settings.availableLiveModels.map((model) => {
              const isSelected = settings.selectedLiveModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => onUpdateSettings({ selectedLiveModel: model.id })}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {model.displayName}
                    </p>
                    <p className="font-mono-code mt-0.5 truncate text-[11px] text-teal-600 dark:text-teal-400">
                      {model.id}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {model.description}
                    </p>
                  </div>

                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 dark:border-white/20'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsShell>
  );
};
