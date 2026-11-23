import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Crown,
  KeyRound,
  Mic,
  Type,
} from 'lucide-react';
import { ConnectionStatus, TiyaSettings, UserProfile } from '../../types/tiya';
import { isProfilePremium } from './PremiumPage';
import { appendErrorLog } from '../../utils/storage';
import { SettingsBar, SettingsShell } from './SettingsShell';

interface ConnectionsPageProps {
  settings: TiyaSettings;
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
  profile?: UserProfile | null;
  isAdmin?: boolean;
  onOpenPremium?: () => void;
}

type ConnectionKeyId = 'gemini' | 'groq';

interface ProviderMeta {
  id: ConnectionKeyId;
  num: string;
  title: string;
  getKeyUrl: string;
  placeholder: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    num: '01',
    title: 'GEMINI KEY',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
  },
  {
    id: 'groq',
    num: '02',
    title: 'GROQ KEY',
    getKeyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
  },
];

export const ConnectionsPage: React.FC<ConnectionsPageProps> = ({
  settings,
  subpage,
  onSelectSubpage,
  onUpdateSettings,
  onBack,
  profile = null,
  isAdmin = false,
  onOpenPremium,
}) => {
  const activeProvider = PROVIDERS.find((p) => p.id === subpage) || null;

  const getProviderState = (id: ConnectionKeyId) => {
    if (id === 'gemini') {
      return {
        apiKey: settings.apiKey,
        status: settings.connectionStatus,
        message: settings.connectionMessage,
      };
    }
    return settings.providerConnections.groq;
  };

  const formatStatusBadge = (status: ConnectionStatus, key: string) => {
    if (status === 'ready') return 'READY';
    if (status === 'error') return 'ERROR';
    if (status === 'testing') return 'TESTING';
    return key.trim() ? 'SAVED' : 'NO KEY';
  };

  if (activeProvider) {
    return (
      <ProviderKeyView
        provider={activeProvider}
        initialState={getProviderState(activeProvider.id)}
        onSave={(nextKey, nextStatus, nextMessage) => {
          if (activeProvider.id === 'gemini') {
            onUpdateSettings({
              apiKey: nextKey,
              connectionStatus: nextStatus,
              connectionMessage: nextMessage,
            });
          } else {
            onUpdateSettings({
              providerConnections: {
                ...settings.providerConnections,
                groq: {
                  apiKey: nextKey,
                  status: nextStatus,
                  message: nextMessage,
                },
              },
            });
          }
        }}
        onBack={() => onSelectSubpage(null)}
      />
    );
  }

  return (
    <SettingsShell title="02 CONNECTIONS" onBack={onBack}>
      <div className="space-y-3">
        {(() => {
          const ownKey = Boolean(settings.apiKey.trim() || (settings.providerConnections?.groq?.apiKey || '').trim());
          const prem = isProfilePremium(profile);
          const textLeft = Math.max(0, profile?.premium_text_left ?? 0);
          const voiceLeft = Math.max(0, profile?.premium_voice_left ?? 0);
          const using = isAdmin ? 'ADMIN · UNLIMITED' : ownKey ? 'FREE · YOUR OWN KEY' : prem ? 'ROSE PREMIUM' : 'NOTHING YET';
          return (
            <>
              <div className="flex items-center justify-between rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2">
                <span className="text-[10px] font-bold tracking-wider text-slate-400">NOW USING</span>
                <span className={`text-[11px] font-extrabold tracking-wider ${using === 'NOTHING YET' ? 'text-rose-300' : 'text-teal-300'}`}>{using}</span>
              </div>

              {/* 1. ROSE PREMIUM: no key needed */}
              <div className="rounded-[4px] border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-transparent p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                    <Crown className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold tracking-wider text-amber-200">1 · ROSE PREMIUM</p>
                    <p className="text-[10.5px] text-slate-400">No API key needed. Uses ROSE credits.</p>
                  </div>
                  <span className={`rounded-[3px] px-2 py-0.5 text-[9.5px] font-bold ${prem || isAdmin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>
                    {isAdmin ? 'ADMIN' : prem ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <div className="rounded-[3px] bg-black/30 px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[9.5px] font-bold tracking-wider text-slate-400"><Type className="h-3 w-3" /> TEXT CREDITS</p>
                    <p className={`font-mono text-lg font-bold ${textLeft > 0 || isAdmin ? 'text-white' : 'text-rose-300'}`}>{isAdmin ? '∞' : textLeft}</p>
                  </div>
                  <div className="rounded-[3px] bg-black/30 px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[9.5px] font-bold tracking-wider text-slate-400"><Mic className="h-3 w-3" /> VOICE CREDITS</p>
                    <p className={`font-mono text-lg font-bold ${voiceLeft > 0 || isAdmin ? 'text-white' : 'text-rose-300'}`}>{isAdmin ? '∞' : voiceLeft}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-slate-400">
                  1 typed reply = 1 text credit. 1 voice reply = 1 voice credit. If one runs out, the other still works.
                </p>
                {!isAdmin && onOpenPremium && (
                  <button
                    type="button"
                    onClick={onOpenPremium}
                    className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-extrabold tracking-wider text-black"
                  >
                    <Crown className="h-4 w-4" /> {prem ? 'BUY MORE CREDITS' : 'GET PREMIUM'}
                  </button>
                )}
              </div>

              {/* 2. FREE: own key */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <KeyRound className="h-3.5 w-3.5 text-teal-300" />
                <p className="text-[11px] font-extrabold tracking-wider text-teal-200">2 · FREE · YOUR OWN KEY</p>
              </div>
              <p className="-mt-1 px-1 text-[10.5px] text-slate-400">
                Free keys from Google and Groq. With a key ROSE uses your key and no credits are spent (daily free limit applies).
              </p>
            </>
          );
        })()}
        <div className="space-y-1.5">
          {PROVIDERS.map((provider) => {
            const state = getProviderState(provider.id);
            return (
              <SettingsBar
                key={provider.id}
                badge={provider.num}
                title={provider.title}
                value={formatStatusBadge(state.status, state.apiKey)}
                onClick={() => onSelectSubpage(provider.id)}
                testId={`connection-provider-${provider.id}`}
              />
            );
          })}
        </div>

        <p className="px-1 text-[10.5px] text-slate-400">
          Keys stay only on this phone and are tested automatically on save.
        </p>
      </div>
    </SettingsShell>
  );
};

interface ProviderKeyViewProps {
  provider: ProviderMeta;
  initialState: { apiKey: string; status: ConnectionStatus; message: string };
  onSave: (apiKey: string, status: ConnectionStatus, message: string) => void;
  onBack: () => void;
}

const ProviderKeyView: React.FC<ProviderKeyViewProps> = ({
  provider,
  initialState,
  onSave,
  onBack,
}) => {
  const [draftKey, setDraftKey] = useState(initialState.apiKey);
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
      setPasteNotice('Paste directly inside the field if clipboard access is blocked.');
    }
  };

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftKey.trim();

    if (!cleaned) {
      onSave('', 'untested', 'No API key entered.');
      return;
    }

    setTesting(true);
    onSave(cleaned, 'testing', `Testing ${provider.title}...`);

    try {
      const isGemini = provider.id === 'gemini';
      const res = await fetch(
        isGemini ? '/api/gemini/test-key' : '/api/providers/test-key',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(isGemini ? { 'x-gemini-api-key': cleaned } : {}),
          },
          body: JSON.stringify(
            isGemini ? {} : { provider: provider.id, apiKey: cleaned },
          ),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        label?: string;
        detail?: string;
      };

      if (res.ok && data.ok) {
        onSave(cleaned, 'ready', data.detail || `${provider.title} verified and ready.`);
      } else {
        const msg = data.label ? `${data.label}: ${data.detail || ''}` : 'ERROR: Key check failed.';
        appendErrorLog('connections', `${provider.title} ERROR`, msg);
        onSave(cleaned, 'error', msg);
      }
    } catch {
      appendErrorLog('connections', `${provider.title} ERROR`, 'Network error while testing key.');
      onSave(cleaned, 'error', 'ERROR: Network error while testing key.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingsShell title={provider.title} onBack={onBack}>
      <form onSubmit={handleSaveAndTest} className="space-y-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-3.5">
          <label
            htmlFor="provider-api-key-input"
            className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase"
          >
            {provider.title}
          </label>

          {/* Paste + Eye icons INSIDE the key field on the right */}
          <div className="relative mt-2">
            <input
              id="provider-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={provider.placeholder}
              autoComplete="off"
              spellCheck={false}
              className="font-mono-code h-10 w-full rounded-xl border border-white/10 bg-[#090B10] pl-3 pr-20 text-xs text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />

            <div className="absolute inset-y-0 right-0 flex items-center pr-1">
              <button
                type="button"
                onClick={handlePaste}
                aria-label="Paste API key"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {pasteNotice && (
            <p className="mt-1.5 text-[10.5px] text-amber-400">{pasteNotice}</p>
          )}

          {/* GET KEY and SAVE side by side */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={provider.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-[11px] font-semibold text-slate-100 hover:bg-white/10"
            >
              <span>GET KEY</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="submit"
              disabled={testing}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-60 active:scale-[0.98]"
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

        {/* Status Box */}
        <div
          data-testid="connection-status-box"
          className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-3.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300">
              STATUS
            </span>

            {initialState.status === 'ready' ? (
              <span className="flex items-center gap-1 text-xs font-bold text-teal-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>READY</span>
              </span>
            ) : initialState.status === 'error' ? (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-400">
                <AlertCircle className="h-4 w-4" />
                <span>ERROR</span>
              </span>
            ) : initialState.status === 'testing' ? (
              <span className="text-xs font-semibold text-amber-400">TESTING</span>
            ) : (
              <span className="text-xs font-medium text-slate-500">NO KEY</span>
            )}
          </div>

          {initialState.message && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
              {initialState.message}
            </p>
          )}
        </div>
      </form>
    </SettingsShell>
  );
};
