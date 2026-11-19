import React, { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { LiveModelInfo, TiyaSettings } from '../../types/tiya';
import { SettingsBar, SettingsShell, SettingsToggleBar } from './SettingsShell';

interface LiveModelPageProps {
  settings: TiyaSettings;
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

export const LiveModelPage: React.FC<LiveModelPageProps> = ({
  settings,
  subpage,
  onSelectSubpage,
  onUpdateSettings,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [customDraft, setCustomDraft] = useState(settings.customLiveModel);

  const [chatModelDraft, setChatModelDraft] = useState(settings.chatModelOverride);
  const [loadingChatModels, setLoadingChatModels] = useState(false);
  const [chatModelsError, setChatModelsError] = useState('');

  const fetchModels = async () => {
    const key = settings.apiKey.trim();
    if (!key) {
      setFetchError('No API key. Add your Gemini API key in Connections to fetch models.');
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

  const fetchChatModels = async () => {
    const key = settings.apiKey.trim();
    if (!key) {
      setChatModelsError('No API key. Add your Gemini API key in Connections.');
      return;
    }
    setLoadingChatModels(true);
    setChatModelsError('');
    try {
      const res = await fetch('/api/gemini/chat-models', {
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
      if (res.ok && data.ok && Array.isArray(data.models)) {
        onUpdateSettings({ availableChatModels: data.models });
      } else {
        setChatModelsError(data.detail || data.label || 'Could not load chat models.');
      }
    } catch {
      setChatModelsError('Network error while loading chat models.');
    } finally {
      setLoadingChatModels(false);
    }
  };

  useEffect(() => {
    if (settings.apiKey.trim()) {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentChatModel = settings.chatModelOverride.trim() || 'gemini-4-hydrogen';

  if (subpage === 'custom_model') {
    return (
      <SettingsShell title="CUSTOM MODEL" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]">
          <label
            htmlFor="custom-live-model-input"
            className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
          >
            CUSTOM LIVE MODEL ID
          </label>
          <input
            id="custom-live-model-input"
            type="text"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder="e.g. gemini-3.8-live (leave blank for list)"
            className="font-mono-code h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomDraft('');
                onUpdateSettings({ customLiveModel: '' });
              }}
              className="h-9 rounded-xl border border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateSettings({ customLiveModel: customDraft.trim() });
                onSelectSubpage(null);
              }}
              className="h-9 rounded-xl bg-teal-600 text-[11px] font-semibold text-white"
            >
              SAVE
            </button>
          </div>
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'chat_model_override') {
    return (
      <SettingsShell title="CHAT MODEL OVERRIDE" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3">
          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500 dark:text-slate-400">CURRENT CHAT MODEL</span>
              <span className="font-mono-code font-semibold text-teal-600 dark:text-teal-400">
                {currentChatModel}
              </span>
            </div>

            <input
              type="text"
              aria-label="Chat model override"
              value={chatModelDraft}
              onChange={(e) => setChatModelDraft(e.target.value)}
              placeholder="gemini-4-hydrogen (auto)"
              className="font-mono-code h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setChatModelDraft('');
                  onUpdateSettings({ chatModelOverride: '' });
                }}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
              >
                AUTO DETECT
              </button>
              <button
                type="button"
                disabled={loadingChatModels}
                onClick={fetchChatModels}
                className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-700 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
              >
                {loadingChatModels && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>SHOW MODELS</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ chatModelOverride: chatModelDraft.trim() })}
                className="h-9 rounded-lg bg-teal-600 px-2 text-[10px] font-semibold text-white"
              >
                SAVE
              </button>
            </div>
          </div>

          {chatModelsError && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              {chatModelsError}
            </p>
          )}

          {settings.availableChatModels.length > 0 && (
            <div className="space-y-1">
              {settings.availableChatModels.map((m) => {
                const selected = currentChatModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setChatModelDraft(m.id);
                      onUpdateSettings({ chatModelOverride: m.id });
                    }}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left dark:border-white/[0.08] dark:bg-[#11151E]"
                  >
                    <span className="font-mono-code truncate text-[11px] text-slate-800 dark:text-slate-200">
                      {m.id}
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 dark:border-white/25'
                      }`}
                    >
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="VOICE MODEL"
      onBack={onBack}
      rightAction={
        <button
          type="button"
          onClick={fetchModels}
          disabled={loading}
          aria-label="Refresh Live voice models"
          className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-teal-600 hover:bg-slate-100 disabled:opacity-40 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="space-y-3 pb-3">
        <div className="space-y-1.5">
          <SettingsToggleBar
            badge="01"
            title="AUTO FALLBACK"
            checked={settings.autoFallback}
            onToggle={() => onUpdateSettings({ autoFallback: !settings.autoFallback })}
          />

          <SettingsBar
            badge="02"
            title="CUSTOM MODEL"
            value={settings.customLiveModel.trim() || 'None'}
            onClick={() => {
              setCustomDraft(settings.customLiveModel);
              onSelectSubpage('custom_model');
            }}
          />

          <SettingsBar
            badge="03"
            title="CHAT MODEL OVERRIDE"
            value={currentChatModel}
            onClick={() => {
              setChatModelDraft(settings.chatModelOverride);
              onSelectSubpage('chat_model_override');
            }}
          />
        </div>

        {fetchError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            {fetchError}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            LIVE MODELS
          </p>

          <div className="space-y-1.5">
            {settings.availableLiveModels.map((model) => {
              const isSelected =
                !settings.customLiveModel.trim() && settings.selectedLiveModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() =>
                    onUpdateSettings({
                      selectedLiveModel: model.id,
                      customLiveModel: '',
                    })
                  }
                  className="flex h-11 w-full items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#11151E] dark:hover:bg-white/[0.05]"
                >
                  <span className="font-mono-code min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                    {model.id}
                  </span>

                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 dark:border-white/25'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
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
