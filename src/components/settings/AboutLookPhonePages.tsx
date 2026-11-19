import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { TiyaSettings, VoiceState } from '../../types/tiya';
import { SUPPORTED_PHONE_ACTIONS_META } from '../../utils/phoneActions';
import { SettingsBar, SettingsShell } from './SettingsShell';

interface AboutPageProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  hasSession: boolean;
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onBack: () => void;
}

export const AboutGuidePage: React.FC<AboutPageProps> = ({
  settings,
  voiceState,
  hasSession,
  subpage,
  onSelectSubpage,
  onBack,
}) => {
  const [micState, setMicState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [serverOk, setServerOk] = useState<'checking' | 'ok' | 'down'>('checking');

  const runHealthCheck = async () => {
    setServerOk('checking');
    try {
      const res = await fetch('/api/health');
      setServerOk(res.ok ? 'ok' : 'down');
    } catch {
      setServerOk('down');
    }

    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicState(perm.state);
      }
    } catch {
      setMicState('unknown');
    }
  };

  useEffect(() => {
    if (subpage === 'health_check') {
      runHealthCheck();
    }
  }, [subpage]);

  const bars = [
    {
      num: '01',
      id: 'health_check',
      title: 'HEALTH CHECK',
      value: settings.connectionStatus === 'ready' ? 'READY' : 'CHECK',
    },
    { num: '02', id: 'app_info', title: 'APP INFO', value: 'TIYA Mobile' },
    { num: '03', id: 'developer', title: 'DEVELOPER', value: 'MD YOUSUF KHAN', locked: true },
    { num: '04', id: 'how_to_use', title: 'HOW TO USE' },
    { num: '05', id: 'help_contact', title: 'HELP & CONTACT' },
  ];

  // Support legacy/alias subpage names seamlessly
  const resolvedSubpage =
    subpage === 'about_tiya'
      ? 'app_info'
      : subpage === 'contact_help'
        ? 'help_contact'
        : subpage;

  const activeBar = bars.find((b) => b.id === resolvedSubpage);

  if (resolvedSubpage === 'health_check') {
    const keyText =
      settings.connectionStatus === 'ready'
        ? 'READY'
        : settings.connectionStatus === 'error'
          ? 'ERROR'
          : settings.apiKey.trim()
            ? 'SAVED'
            : 'NO KEY';
    const voiceText =
      serverOk === 'checking'
        ? 'CHECKING...'
        : serverOk === 'ok'
          ? `ONLINE (${voiceState.toUpperCase()})`
          : 'UNREACHABLE';
    const micText =
      micState === 'granted'
        ? 'ALLOWED'
        : micState === 'denied'
          ? 'BLOCKED'
          : micState === 'prompt'
            ? 'ASK ON USE'
            : 'UNKNOWN';

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
            <RefreshCw className={`h-4 w-4 ${serverOk === 'checking' ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <div className="space-y-1.5">
          {[
            { label: 'GEMINI API KEY', value: keyText, ok: settings.connectionStatus === 'ready' },
            { label: 'VOICE SERVER', value: voiceText, ok: serverOk === 'ok' },
            { label: 'MICROPHONE', value: micText, ok: micState === 'granted' },
            { label: 'ACCOUNT SESSION', value: hasSession ? 'CONNECTED' : 'SIGNED OUT', ok: hasSession },
          ].map((row) => (
            <div
              key={row.label}
              className="flex h-11 items-center justify-between rounded-xl border border-white/[0.08] bg-[#11151E] px-3.5 text-xs"
            >
              <span className="font-semibold text-slate-200">{row.label}</span>
              <span
                className={`font-mono-code text-[11px] font-semibold ${
                  row.ok ? 'text-teal-400' : 'text-amber-400'
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </SettingsShell>
    );
  }

  if (activeBar) {
    const contentMap: Record<string, string[]> = {
      app_info: [
        'TIYA is a mobile-only real-time Bengali & multilingual voice and chat assistant.',
        'Supports live voice calls, text chat, female voice previews, memory recall, and confirmed Android phone actions.',
      ],
      developer: [
        'Developer: MD YOUSUF KHAN',
        'Designed and built for fast mobile-first voice and chat interaction.',
      ],
      how_to_use: [
        '1. Open 02 CONNECTIONS and save your Gemini or Groq API key.',
        '2. Tap the voice switch on Home to start talking live with TIYA.',
        '3. Use voice or chat commands to open any setting, e.g. "ভয়েস সেটিং খোলো" or "ফোন কন্ট্রোল খোলো".',
      ],
      help_contact: [
        'Developer: MD YOUSUF KHAN',
        'If voice or chat does not respond, run 01 ABOUT & GUIDE > HEALTH CHECK and verify your API key in 02 CONNECTIONS.',
      ],
    };

    const lines = contentMap[activeBar.id] || [];

    return (
      <SettingsShell title={activeBar.title} onBack={() => onSelectSubpage(null)}>
        <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          {activeBar.id === 'developer' && (
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <span className="font-display text-sm font-bold text-white">
                MD YOUSUF KHAN
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock className="h-3.5 w-3.5" />
                <span>Locked</span>
              </span>
            </div>
          )}

          {lines.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed text-slate-200">
              {line}
            </p>
          ))}
        </div>
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
            locked={bar.locked}
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
  { id: 'tiya_accessibility', label: 'TIYA Access (Accessibility)' },
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

    setNotice('Phone control works in the TIYA Android app.');
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
              Phone control works in the TIYA Android app.
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
            Phone control works in the TIYA Android app.
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
