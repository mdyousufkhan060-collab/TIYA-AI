import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  ChatMessage,
  ErrorLogEntry,
  MemoryItem,
  SettingsPageId,
  TiyaSettings,
  VoiceState,
} from '../../types/tiya';
import { SettingsBar, SettingsShell, SettingsToggleBar } from './SettingsShell';

interface DeveloperToolsPageProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  errorLog: ErrorLogEntry[];
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onClearErrorLog: () => void;
  onBack: () => void;
}

export const DeveloperToolsPage: React.FC<DeveloperToolsPageProps> = ({
  settings,
  voiceState,
  errorLog,
  subpage,
  onSelectSubpage,
  onClearErrorLog,
  onBack,
}) => {
  const [diagnosing, setDiagnosing] = useState(false);
  const [problems, setProblems] = useState<string[] | null>(null);

  const runDiagnostics = async () => {
    setDiagnosing(true);
    const found: string[] = [];

    if (!settings.apiKey.trim()) {
      found.push('Missing Gemini API key in 02 CONNECTIONS.');
    } else if (settings.connectionStatus === 'error') {
      found.push(`Gemini API key error: ${settings.connectionMessage || 'Key test failed'}`);
    }

    try {
      const res = await fetch('/api/health');
      if (!res.ok) found.push(`Backend /api/health returned HTTP ${res.status}.`);
    } catch {
      found.push('Cannot reach ROSE backend server.');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      found.push('Browser MediaDevices microphone API is unavailable.');
    }

    if (errorLog.length > 0) {
      found.push(`${errorLog.length} logged error(s) recorded in ERROR LOG.`);
    }

    setProblems(found);
    setDiagnosing(false);
  };

  if (subpage === 'error_log') {
    return (
      <SettingsShell
        title="ERROR LOG"
        onBack={() => onSelectSubpage(null)}
        rightAction={
          errorLog.length > 0 ? (
            <button
              type="button"
              onClick={onClearErrorLog}
              className="px-2 text-[11px] font-semibold text-rose-500"
            >
              CLEAR
            </button>
          ) : null
        }
      >
        {errorLog.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 dark:border-white/[0.08] dark:bg-[#11151E] dark:text-slate-400">
            No errors logged.
          </div>
        ) : (
          <div className="space-y-1.5 pb-3">
            {errorLog.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/[0.08] dark:bg-[#11151E]"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold">
                  <span className="text-rose-500 uppercase">
                    {entry.source} · {entry.label}
                  </span>
                  <span className="font-mono-code text-slate-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{entry.detail}</p>
              </div>
            ))}
          </div>
        )}
      </SettingsShell>
    );
  }

  if (subpage === 'app_status') {
    const activeModel = settings.customLiveModel.trim() || settings.selectedLiveModel;
    const rows = [
      { label: 'GEMINI CONNECTION', val: settings.connectionStatus.toUpperCase() },
      { label: 'VOICE STATE', val: voiceState.toUpperCase() },
      { label: 'LIVE VOICE MODEL', val: activeModel },
      { label: 'CHAT MODEL', val: settings.chatModelOverride.trim() || 'gemini-4-hydrogen' },
      { label: 'AUTO FALLBACK', val: settings.autoFallback ? 'ON' : 'OFF' },
      { label: 'VOICE DEBUG', val: settings.micListening.voiceDebug ? 'ON' : 'OFF' },
    ];
    return (
      <SettingsShell title="APP STATUS" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-white/[0.08] dark:bg-[#11151E]"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-200">{r.label}</span>
              <span className="font-mono-code text-[10.5px] text-teal-600 dark:text-teal-400">
                {r.val}
              </span>
            </div>
          ))}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'find_problems') {
    return (
      <SettingsShell title="FIND PROBLEMS" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3">
          <button
            type="button"
            disabled={diagnosing}
            onClick={runDiagnostics}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-semibold text-white disabled:opacity-60"
          >
            {diagnosing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>SCAN FOR PROBLEMS</span>
          </button>

          {problems !== null && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]">
              {problems.length === 0 ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No problems found. Everything looks healthy.</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  {problems.map((p, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'system_info') {
    const infoRows = [
      { label: 'APP', val: 'ROSE Web' },
      { label: 'VIEWPORT', val: `${window.innerWidth}×${window.innerHeight}` },
      { label: 'ONLINE', val: navigator.onLine ? 'Yes' : 'No' },
      { label: 'STORAGE KEYS', val: String(localStorage.length) },
      { label: 'PLATFORM', val: navigator.platform || 'Browser' },
    ];
    return (
      <SettingsShell title="SYSTEM INFO" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5">
          {infoRows.map((r) => (
            <div
              key={r.label}
              className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-white/[0.08] dark:bg-[#11151E]"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-200">{r.label}</span>
              <span className="font-mono-code text-[10.5px] text-slate-500 dark:text-slate-400">
                {r.val}
              </span>
            </div>
          ))}
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="DEVELOPER TOOLS" onBack={onBack}>
      <div className="space-y-1.5">
        <SettingsBar
          badge="01"
          title="ERROR LOG"
          value={`${errorLog.length}`}
          onClick={() => onSelectSubpage('error_log')}
        />
        <SettingsBar
          badge="02"
          title="APP STATUS"
          value={settings.connectionStatus === 'ready' ? 'OK' : 'Check'}
          onClick={() => onSelectSubpage('app_status')}
        />
        <SettingsBar
          badge="03"
          title="FIND PROBLEMS"
          onClick={() => onSelectSubpage('find_problems')}
        />
        <SettingsBar
          badge="04"
          title="SYSTEM INFO"
          onClick={() => onSelectSubpage('system_info')}
        />
      </div>
    </SettingsShell>
  );
};

interface PrivacyControlsPageProps {
  settings: TiyaSettings;
  messages: ChatMessage[];
  memories: MemoryItem[];
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onClearAllChats: () => void;
  onAddMemory: (text: string) => void;
  onDeleteMemory: (id: string) => void;
  onClearMemories: () => void;
  onOpenPage: (page: SettingsPageId) => void;
  onBack: () => void;
}

export const PrivacyControlsPage: React.FC<PrivacyControlsPageProps> = ({
  settings,
  messages,
  memories,
  subpage,
  onSelectSubpage,
  onUpdateSettings,
  onClearAllChats,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
  onOpenPage,
  onBack,
}) => {
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [confirmClearChats, setConfirmClearChats] = useState(false);
  const [newMemory, setNewMemory] = useState('');

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((res) => setMicPermission(res.state))
        .catch(() => setMicPermission('unknown'));
    }
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setMicPermission('granted');
    } catch {
      setMicPermission('denied');
    }
  };

  const micLabel =
    micPermission === 'granted'
      ? 'Allowed'
      : micPermission === 'denied'
        ? 'Blocked'
        : micPermission === 'prompt'
          ? 'Ask on use'
          : 'Check';

  if (subpage === 'mic_permission') {
    return (
      <SettingsShell title="MICROPHONE PERMISSION" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">STATUS</span>
            <span className="font-mono-code text-teal-600 dark:text-teal-400">{micLabel}</span>
          </div>
          <button
            type="button"
            onClick={requestMic}
            className="h-10 w-full rounded-xl bg-teal-600 text-xs font-semibold text-white"
          >
            CHECK / REQUEST MICROPHONE
          </button>
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'chat_history') {
    return (
      <SettingsShell title="CHAT HISTORY" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {messages.length} saved chat message(s) stored locally on this phone.
          </p>
          {!confirmClearChats ? (
            <button
              type="button"
              disabled={messages.length === 0}
              onClick={() => setConfirmClearChats(true)}
              className="h-10 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-500 disabled:opacity-40"
            >
              DELETE ALL CHATS
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearAllChats();
                  setConfirmClearChats(false);
                }}
                className="h-10 rounded-xl bg-rose-600 text-xs font-semibold text-white"
              >
                CONFIRM DELETE
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearChats(false)}
                className="h-10 rounded-xl border border-slate-200 text-xs font-semibold dark:border-white/10"
              >
                CANCEL
              </button>
            </div>
          )}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'tiya_memory') {
    return (
      <SettingsShell
        title="ROSE'S MEMORY"
        onBack={() => onSelectSubpage(null)}
        rightAction={
          memories.length > 0 ? (
            <button
              type="button"
              onClick={onClearMemories}
              className="px-2 text-[11px] font-semibold text-rose-500"
            >
              CLEAR
            </button>
          ) : null
        }
      >
        <div className="space-y-3 pb-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newMemory.trim()) return;
              onAddMemory(newMemory.trim());
              setNewMemory('');
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Add memory note for ROSE..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-white/10 dark:bg-[#11151E] dark:text-white"
            />
            <button
              type="submit"
              aria-label="Add memory"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          {memories.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 dark:border-white/[0.08] dark:bg-[#11151E] dark:text-slate-400">
              No saved memories yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {memories.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/[0.08] dark:bg-[#11151E]"
                >
                  <p className="text-xs text-slate-800 dark:text-slate-200">{item.text}</p>
                  <button
                    type="button"
                    onClick={() => onDeleteMemory(item.id)}
                    aria-label="Delete memory"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'stored_info') {
    const items = [
      { k: 'Assistant Name', v: settings.assistantName || 'ROSE' },
      { k: 'Your Name', v: settings.yourName.trim() || 'Not set' },
      { k: 'Saved Messages', v: String(messages.length) },
      { k: 'Saved Memories', v: String(memories.length) },
      { k: 'Gemini Key Saved', v: settings.apiKey.trim() ? 'Yes (local)' : 'No' },
    ];
    return (
      <SettingsShell title="STORED INFO" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5">
          {items.map((it) => (
            <div
              key={it.k}
              className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-white/[0.08] dark:bg-[#11151E]"
            >
              <span className="text-slate-600 dark:text-slate-300">{it.k}</span>
              <span className="font-mono-code font-semibold text-slate-900 dark:text-white">{it.v}</span>
            </div>
          ))}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'api_key_security') {
    return (
      <SettingsShell title="API KEY SECURITY" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700 dark:border-white/[0.08] dark:bg-[#11151E] dark:text-slate-200">
          <p className="font-semibold text-teal-600 dark:text-teal-400">
            Keys stay only on this phone.
          </p>
          <p>
            Your Gemini and Groq API keys are saved strictly inside your device localStorage and never stored in remote ROSE databases.
          </p>
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'policy_terms') {
    return (
      <SettingsShell title="PRIVACY POLICY & TERMS" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700 dark:border-white/[0.08] dark:bg-[#11151E] dark:text-slate-200">
          <p>
            ROSE processes voice and text requests using your configured AI provider key. Microphone audio is streamed only while a voice session or mic test is active.
          </p>
          <p>
            Strict safety rules apply to all users, with additional teen-safe protections for accounts under 18.
          </p>
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'account_delete') {
    return (
      <SettingsShell title="ACCOUNT & DATA DELETE" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Delete local chats & memories here, or open MY ACCOUNT to permanently delete your ROSE account.
          </p>
          <button
            type="button"
            onClick={() => {
              onClearAllChats();
              onClearMemories();
            }}
            className="h-10 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-500"
          >
            CLEAR LOCAL CHATS & MEMORIES
          </button>
          <button
            type="button"
            onClick={() => onOpenPage('my_account')}
            className="h-10 w-full rounded-xl bg-teal-600 text-xs font-semibold text-white"
          >
            OPEN MY ACCOUNT
          </button>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="PRIVACY CONTROLS" onBack={onBack}>
      <div className="space-y-1.5 pb-3">
        <SettingsBar
          badge="01"
          title="MICROPHONE PERMISSION"
          value={micLabel}
          onClick={() => onSelectSubpage('mic_permission')}
        />
        <SettingsBar
          badge="02"
          title="STORED INFO"
          onClick={() => onSelectSubpage('stored_info')}
        />
        <SettingsBar
          badge="03"
          title="API KEY SECURITY"
          onClick={() => onSelectSubpage('api_key_security')}
        />
        <SettingsBar
          badge="04"
          title="PRIVACY POLICY & TERMS"
          onClick={() => onSelectSubpage('policy_terms')}
        />
        <SettingsBar
          badge="05"
          title="ACCOUNT & DATA DELETE"
          tone="danger"
          onClick={() => onSelectSubpage('account_delete')}
        />
      </div>
    </SettingsShell>
  );
};
