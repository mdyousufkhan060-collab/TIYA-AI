import React, { useState } from 'react';
import { ClipboardPaste, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { TiyaSettings } from '../../types/tiya';
import { SettingsShell } from './SettingsShell';

interface ConnectionsPageProps {
  settings: TiyaSettings;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [draftKey, setDraftKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pasteNotice, setPasteNotice] = useState('');

  const handlePaste = async () => {
    setPasteNotice('');
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraftKey(text.trim());
      } else {
        setPasteNotice('Clipboard is empty.');
      }
    } catch {
      setPasteNotice('Paste directly into the field if clipboard access is blocked.');
    }
  };

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftKey.trim();

    if (!cleaned) {
      onUpdateSettings({
        apiKey: '',
        connectionStatus: 'error',
        connectionMessage: 'No API key entered.',
      });
      return;
    }

    setTesting(true);
    onUpdateSettings({
      apiKey: cleaned,
      connectionStatus: 'testing',
      connectionMessage: 'Testing Gemini API key...',
    });

    try {
      const res = await fetch('/api/gemini/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': cleaned,
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        label?: string;
        detail?: string;
      };

      if (res.ok && data.ok) {
        onUpdateSettings({
          apiKey: cleaned,
          connectionStatus: 'ready',
          connectionMessage: data.detail || 'API key verified and ready.',
        });
      } else {
        onUpdateSettings({
          apiKey: cleaned,
          connectionStatus: 'error',
          connectionMessage: data.label ? `${data.label}: ${data.detail || ''}` : 'ERROR: Key check failed.',
        });
      }
    } catch {
      onUpdateSettings({
        apiKey: cleaned,
        connectionStatus: 'error',
        connectionMessage: 'ERROR: Network error while testing key.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingsShell title="2. Connections" onBack={onBack}>
      <form onSubmit={handleSaveAndTest} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <label
            htmlFor="gemini-api-key-input"
            className="block text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100"
          >
            GEMINI API KEY
          </label>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Stored only on this phone in localStorage. Auto-tested on save.
          </p>

          <div className="mt-3 flex items-center gap-1.5">
            <input
              id="gemini-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              className="font-mono-code h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />

            <button
              type="button"
              onClick={handlePaste}
              aria-label="Paste API key from clipboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10"
            >
              <ClipboardPaste className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {pasteNotice && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">{pasteNotice}</p>
          )}

          {/* GET KEY and SAVE side by side */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10"
            >
              <span>GET KEY</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="submit"
              disabled={testing}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-60 active:scale-[0.98]"
            >
              {testing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>TESTING</span>
                </>
              ) : (
                <span>SAVE</span>
              )}
            </button>
          </div>
        </div>

        {/* Connection Status Display */}
        <div
          data-testid="connection-status-box"
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
              STATUS
            </span>

            {settings.connectionStatus === 'ready' ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>READY</span>
              </span>
            ) : settings.connectionStatus === 'error' ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
                <span>ERROR</span>
              </span>
            ) : settings.connectionStatus === 'testing' ? (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                TESTING
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                NOT TESTED
              </span>
            )}
          </div>

          {settings.connectionMessage && (
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {settings.connectionMessage}
            </p>
          )}
        </div>
      </form>
    </SettingsShell>
  );
};
