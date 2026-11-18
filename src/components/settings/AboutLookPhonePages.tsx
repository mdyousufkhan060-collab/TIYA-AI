import React from 'react';
import { Lock, Moon, Sun, Smartphone } from 'lucide-react';
import { TiyaSettings } from '../../types/tiya';
import { SUPPORTED_PHONE_ACTIONS_META } from '../../utils/phoneActions';
import { SettingsShell } from './SettingsShell';

interface AboutPageProps {
  onBack: () => void;
}

export const AboutGuidePage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <SettingsShell title="1. About & Guide" onBack={onBack}>
      <div className="space-y-4 pb-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            How to use TIYA
          </h2>
          <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>1. Open Connections and save your Gemini API key.</li>
            <li>2. Tap the center Orb on Home to start a hands-free voice call.</li>
            <li>3. Speak naturally in Bengali (default), or ask TIYA to switch languages anytime.</li>
            <li>4. Interrupt TIYA mid-sentence simply by speaking, or tap the Orb to end.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            What TIYA can do
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>· Real-time Bengali & multilingual native voice conversations</li>
            <li>· Text chat sharing the same personality, name, and memory</li>
            <li>· Prepare phone calls, WhatsApp, Messenger, and app launch confirmations</li>
          </ul>

          <h2 className="font-display mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            What TIYA cannot do in a browser
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>· Cannot directly open apps, place WhatsApp/Messenger calls, or access phone contacts from a web browser (requires the TIYA Android app)</li>
            <li>· Never claims a message or call was sent unless your device confirms success</li>
          </ul>
        </div>

        {/* Locked Developer Credit */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
              DEVELOPER
            </p>
            <p className="font-display mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
              MD YOUSUF KHAN
            </p>
          </div>
          <span
            aria-label="Locked developer credit"
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Locked</span>
          </span>
        </div>
      </div>
    </SettingsShell>
  );
};

interface LookFeelPageProps {
  settings: TiyaSettings;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

export const LookFeelPage: React.FC<LookFeelPageProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  return (
    <SettingsShell title="6. Look & Feel" onBack={onBack}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            THEME
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'dark' })}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-colors ${
                settings.theme === 'dark'
                  ? 'border-teal-500 bg-teal-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
              }`}
            >
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'light' })}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-colors ${
                settings.theme === 'light'
                  ? 'border-teal-500 bg-teal-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
              }`}
            >
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              REDUCE MOTION
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Disables orb pulse animations and smooth transitions.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.reduceMotion}
            aria-label="Toggle Reduce Motion"
            onClick={() => onUpdateSettings({ reduceMotion: !settings.reduceMotion })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.reduceMotion
                ? 'bg-teal-600'
                : 'bg-slate-300 dark:bg-white/15'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                settings.reduceMotion ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </SettingsShell>
  );
};

interface PhoneControlPageProps {
  onBack: () => void;
}

export const PhoneControlPage: React.FC<PhoneControlPageProps> = ({ onBack }) => {
  const hasNativeBridge =
    typeof window !== 'undefined' && typeof window.TiyaNative?.run === 'function';

  return (
    <SettingsShell title="7. Phone Control" onBack={onBack}>
      <div className="space-y-4 pb-4">
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
            <Smartphone className="h-4 w-4" />
            <span>Full phone control works in the TIYA Android app</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {hasNativeBridge
              ? 'TIYA Android native bridge (window.TiyaNative) is active on this device.'
              : 'Currently running in browser mode. Standard phone numbers use tel: links and WhatsApp messages use wa.me fallbacks; other actions require the TIYA Android app.'}
          </p>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            SUPPORTED PHONE ACTIONS
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
            {SUPPORTED_PHONE_ACTIONS_META.map((item) => (
              <div key={item.action} className="p-3.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
                <p className="font-mono-code mt-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 dark:bg-[#090B10] dark:text-teal-400">
                  {item.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsShell>
  );
};
