import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { TiyaSettings, VoiceState } from '../../types/tiya';
import { SUPPORTED_PHONE_ACTIONS_META } from '../../utils/phoneActions';
import { SettingsBar, SettingsShell } from './SettingsShell';

interface AboutPageProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  hasSession: boolean;
  isAdmin?: boolean;
  canUseWithoutKey?: boolean;
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onOpenConnections?: () => void;
  onBack: () => void;
}

type CheckState = 'idle' | 'checking' | 'ok' | 'error' | 'none';

async function testGeminiKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch('/api/gemini/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': key },
      body: '{}',
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; label?: string; detail?: string };
    if (res.ok && data.ok) return { ok: true, detail: 'Key works.' };
    return { ok: false, detail: data.detail || data.label || `HTTP ${res.status}` };
  } catch {
    return { ok: false, detail: 'Network error.' };
  }
}

async function testGroqKey(key: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch('/api/providers/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'groq', apiKey: key }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; label?: string; detail?: string };
    if (res.ok && data.ok) return { ok: true, detail: 'Key works.' };
    return { ok: false, detail: data.detail || data.label || `HTTP ${res.status}` };
  } catch {
    return { ok: false, detail: 'Network error.' };
  }
}

export const AboutGuidePage: React.FC<AboutPageProps> = ({
  settings,
  voiceState,
  hasSession,
  isAdmin = false,
  canUseWithoutKey = false,
  subpage,
  onSelectSubpage,
  onOpenConnections,
  onBack,
}) => {
  const [micState, setMicState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [gemini, setGemini] = useState<{ state: CheckState; detail: string }>({ state: 'idle', detail: '' });
  const [groq, setGroq] = useState<{ state: CheckState; detail: string }>({ state: 'idle', detail: '' });
  const [running, setRunning] = useState(false);

  const geminiKey = (settings.apiKey || '').trim();
  const groqKey = (settings.providerConnections?.groq?.apiKey || '').trim();

  const readMic = async () => {
    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicState(perm.state);
        return;
      }
    } catch {
      /* ignore */
    }
    setMicState('unknown');
  };

  const askMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicState('granted');
    } catch {
      setMicState('denied');
    }
  };

  const runHealthCheck = async () => {
    setRunning(true);
    setGemini({ state: geminiKey ? 'checking' : 'none', detail: '' });
    setGroq({ state: groqKey ? 'checking' : 'none', detail: '' });
    await readMic();
    const [g, q] = await Promise.all([
      geminiKey ? testGeminiKey(geminiKey) : Promise.resolve(null),
      groqKey ? testGroqKey(groqKey) : Promise.resolve(null),
    ]);
    if (g) setGemini({ state: g.ok ? 'ok' : 'error', detail: g.ok ? '' : g.detail });
    if (q) setGroq({ state: q.ok ? 'ok' : 'error', detail: q.ok ? '' : q.detail });
    setRunning(false);
  };

  useEffect(() => {
    if (subpage === 'health_check') {
      runHealthCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subpage]);

  const bars = [
    {
      num: '01',
      id: 'health_check',
      title: 'HEALTH CHECK',
      value: canUseWithoutKey || settings.connectionStatus === 'ready' ? 'READY' : 'CHECK',
    },
    { num: '02', id: 'how_to_use', title: 'HOW TO USE' },
    { num: '03', id: 'app_info', title: 'ABOUT ROSE', value: 'v1.0' },
  ];

  // Old bar ids (developer, help_contact, about_tiya, contact_help) now live inside ABOUT ROSE
  const resolvedSubpage =
    subpage === 'about_tiya' || subpage === 'developer' || subpage === 'help_contact' || subpage === 'contact_help'
      ? 'app_info'
      : subpage;

  const activeBar = bars.find((b) => b.id === resolvedSubpage);

  if (resolvedSubpage === 'health_check') {
    const keyRow = (state: CheckState, hasKey: boolean) => {
      if (state === 'checking') return { value: 'CHECKING...', ok: true };
      if (state === 'ok') return { value: 'READY', ok: true };
      if (state === 'error') return { value: 'ERROR', ok: false };
      if (!hasKey && canUseWithoutKey) return { value: isAdmin ? 'ADMIN · SERVER' : 'PREMIUM · SERVER', ok: true };
      return { value: 'NO KEY', ok: false };
    };
    const g = keyRow(gemini.state, Boolean(geminiKey));
    const q = keyRow(groq.state, Boolean(groqKey));

    const voiceReady = gemini.state === 'ok' || (!geminiKey && canUseWithoutKey);
    const voiceRow = running
      ? { value: 'CHECKING...', ok: true }
      : voiceReady
        ? { value: voiceState === 'idle' ? 'READY' : voiceState.toUpperCase(), ok: true }
        : { value: 'NEEDS GEMINI KEY', ok: false };

    const micRow =
      micState === 'granted'
        ? { value: 'ALLOWED', ok: true }
        : micState === 'denied'
          ? { value: 'BLOCKED', ok: false }
          : { value: 'TAP TO ALLOW', ok: false };

    const rows: Array<{ label: string; value: string; ok: boolean; detail?: string; onClick?: () => void }> = [
      { label: 'GEMINI KEY', ...g, detail: gemini.detail, onClick: g.ok ? undefined : onOpenConnections },
      { label: 'GROQ KEY', ...q, detail: groq.detail, onClick: q.ok ? undefined : onOpenConnections },
      { label: 'VOICE', ...voiceRow, onClick: voiceRow.ok ? undefined : onOpenConnections },
      { label: 'MICROPHONE', ...micRow, onClick: micRow.ok ? undefined : askMic },
      { label: 'ACCOUNT', value: hasSession ? (isAdmin ? 'ADMIN' : 'SIGNED IN') : 'SIGNED OUT', ok: hasSession },
    ];

    const hint =
      micState === 'denied'
        ? 'Microphone is blocked. Open browser site settings for tiya-ai.vercel.app and allow Microphone.'
        : rows.some((r) => !r.ok && r.label !== 'MICROPHONE')
          ? 'Tap a yellow row to fix it.'
          : '';

    return (
      <SettingsShell
        title="HEALTH CHECK"
        onBack={() => onSelectSubpage(null)}
        rightAction={
          <button
            type="button"
            onClick={runHealthCheck}
            aria-label="Re-run health check"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-teal-400 hover:bg-white/[0.06]"
          >
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <div className="space-y-1.5">
          {rows.map((row) => (
            <button
              type="button"
              key={row.label}
              onClick={row.onClick}
              disabled={!row.onClick}
              className="block w-full rounded-xl border border-white/[0.08] bg-[#11151E] px-3.5 py-3 text-left text-xs disabled:cursor-default"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{row.label}</span>
                <span
                  className={`font-mono-code text-[11px] font-semibold ${
                    row.ok ? 'text-teal-400' : 'text-amber-400'
                  }`}
                >
                  {row.value}
                </span>
              </div>
              {row.detail ? (
                <p className="mt-1 text-[10px] leading-snug text-slate-400">{row.detail}</p>
              ) : null}
            </button>
          ))}
          {hint ? <p className="px-1 pt-1 text-[11px] text-slate-400">{hint}</p> : null}
        </div>
      </SettingsShell>
    );
  }

  if (activeBar) {
    const contentMap: Record<string, string[]> = {
      how_to_use: [
        '1. Talk: tap the round button at the bottom of Home and speak. Tap STOP to end.',
        '2. Chat: open CHAT and type, or tap the mic to speak your message.',
        '3. Open settings by voice: "ভয়েস সেটিং খোলো", "কানেকশন খোলো".',
        '4. Phone actions: "মাকে কল দাও", "হোয়াটসঅ্যাপে রাকিবকে মেসেজ দাও". ROSE always asks before it acts.',
        '5. Not working? Run HEALTH CHECK and fix the yellow rows.',
      ],
      app_info: [
        'ROSE is a mobile-only Bengali voice and chat assistant.',
        'Live voice, text chat, memory, and phone actions that always ask before acting.',
        'Help: if voice or chat stops, run HEALTH CHECK first.',
      ],
    };

    const lines = contentMap[activeBar.id] || [];

    return (
      <SettingsShell title={activeBar.title} onBack={() => onSelectSubpage(null)}>
        <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          {lines.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed text-slate-200">
              {line}
            </p>
          ))}
        </div>
        {activeBar.id === 'app_info' && (
          <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#11151E] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-400">DEVELOPER</p>
              <p className="font-display text-sm font-bold text-white">MD YOUSUF KHAN</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              <span>Locked</span>
            </span>
          </div>
        )}
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="01 ABOUT & GUIDE" onBack={onBack}>
      <div className="space-y-1.5 pb-3">
        {bars.map((bar) => (
          <SettingsBar
            key={bar.id}
            badge={bar.num}
            title={bar.title}
            value={bar.value}
            onClick={() => onSelectSubpage(bar.id)}
            testId={`about-bar-${bar.id}`}
          />
        ))}
      </div>
    </SettingsShell>
  );
};

interface PhoneControlPageProps {
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onBack: () => void;
}

type PermissionItemId =
  | 'microphone'
  | 'contacts'
  | 'phone_calls'
  | 'sms'
  | 'notification_access'
  | 'tiya_accessibility'
  | 'display_over_apps'
  | 'battery_unrestricted';

const PHONE_PERMISSIONS: Array<{ id: PermissionItemId; label: string }> = [
  { id: 'microphone', label: 'Microphone' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'phone_calls', label: 'Phone calls' },
  { id: 'sms', label: 'SMS' },
  { id: 'notification_access', label: 'Notification access' },
  { id: 'tiya_accessibility', label: 'ROSE Access (Accessibility)' },
  { id: 'display_over_apps', label: 'Display over other apps' },
  { id: 'battery_unrestricted', label: 'Battery (no restriction)' },
];

export const PhoneControlPage: React.FC<PhoneControlPageProps> = ({
  subpage,
  onSelectSubpage,
  onBack,
}) => {
  const hasNativeBridge =
    typeof window !== 'undefined' && typeof window.TiyaNative?.run === 'function';

  const [micPerm, setMicPerm] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [nativeStatuses, setNativeStatuses] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((res) => setMicPerm(res.state))
        .catch(() => setMicPerm('unknown'));
    }
  }, []);

  const handleAllowPermission = async (id: PermissionItemId, label: string) => {
    setNotice('');

    if (id === 'microphone') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) track.stop();
        setMicPerm('granted');
        setNotice('Microphone permission allowed.');
      } catch {
        setMicPerm('denied');
        setNotice('Microphone permission was denied.');
      }
      return;
    }

    if (hasNativeBridge && window.TiyaNative) {
      try {
        const raw = await window.TiyaNative.run(
          JSON.stringify({ action: 'request_permission', permission: id }),
        );
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const ok = Boolean(parsed?.success);
        setNativeStatuses((prev) => ({
          ...prev,
          [id]: ok ? 'Allowed' : 'Pending',
        }));
        setNotice(parsed?.message || (ok ? `${label} allowed.` : `Open Android settings to allow ${label}.`));
      } catch {
        setNotice(`Could not request ${label} on Android.`);
      }
      return;
    }

    setNotice('Phone control works in the ROSE Android app.');
  };

  const getPermissionStatus = (id: PermissionItemId): { text: string; allowed: boolean } => {
    if (id === 'microphone') {
      if (micPerm === 'granted') return { text: 'Allowed', allowed: true };
      if (micPerm === 'denied') return { text: 'Blocked', allowed: false };
      return { text: 'Not set', allowed: false };
    }
    if (hasNativeBridge) {
      const st = nativeStatuses[id];
      if (st === 'Allowed') return { text: 'Allowed', allowed: true };
      return { text: st || 'Not set', allowed: false };
    }
    return { text: 'App only', allowed: false };
  };

  if (subpage === 'quick_actions') {
    const actionsList = [
      ...SUPPORTED_PHONE_ACTIONS_META.map((a) => ({
        label: a.label,
        status: hasNativeBridge ? 'Android' : 'App only',
      })),
      {
        label: 'Camera',
        status: hasNativeBridge ? 'Android' : 'App only',
      },
      {
        label: 'Flashlight',
        status: hasNativeBridge ? 'Android' : 'App only',
      },
    ];

    return (
      <SettingsShell title="QUICK ACTIONS" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5 pb-3">
          {!hasNativeBridge && (
            <p className="px-1 pb-1 text-[11px] text-slate-400">
              Phone control works in the ROSE Android app.
            </p>
          )}
          {actionsList.map((item) => (
            <div
              key={item.label}
              className="flex h-11 items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#11151E] px-3"
            >
              <span className="text-[11px] font-semibold text-slate-100">
                {item.label}
              </span>
              <span className="truncate text-[10px] text-slate-400">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="04 PHONE CONTROL" onBack={onBack}>
      <div className="space-y-3 pb-3">
        {!hasNativeBridge && (
          <p
            data-testid="phone-control-browser-note"
            className="px-1 text-[11.5px] font-medium text-teal-400"
          >
            Phone control works in the ROSE Android app.
          </p>
        )}

        {/* Single permissions list with status + ALLOW button */}
        <div className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            PERMISSIONS
          </p>

          <div className="space-y-1.5">
            {PHONE_PERMISSIONS.map((perm) => {
              const status = getPermissionStatus(perm.id);
              return (
                <div
                  key={perm.id}
                  data-testid={`permission-row-${perm.id}`}
                  className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#11151E] px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-100">
                      {perm.label}
                    </p>
                    <p
                      className={`text-[10px] ${
                        status.allowed ? 'text-teal-400' : 'text-slate-400'
                      }`}
                    >
                      {status.text}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAllowPermission(perm.id, perm.label)}
                    disabled={status.allowed}
                    className={`h-7 shrink-0 rounded-lg px-2.5 text-[10px] font-semibold tracking-wide transition-colors ${
                      status.allowed
                        ? 'border border-teal-500/30 bg-teal-500/10 text-teal-400'
                        : 'bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.98]'
                    }`}
                  >
                    {status.allowed ? 'ALLOWED' : 'ALLOW'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {notice && (
          <p className="rounded-xl border border-teal-500/25 bg-teal-500/10 px-3 py-2 text-[11px] text-teal-300">
            {notice}
          </p>
        )}

        {/* QUICK ACTIONS section */}
        <div className="space-y-1.5 pt-1">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            ACTIONS
          </p>
          <SettingsBar
            badge="01"
            title="QUICK ACTIONS"
            value="8 actions"
            onClick={() => onSelectSubpage('quick_actions')}
            testId="phone-bar-quick_actions"
          />
        </div>
      </div>
    </SettingsShell>
  );
};
