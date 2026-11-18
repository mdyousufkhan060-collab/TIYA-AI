import React, { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import {
  FEMALE_VOICES,
  FemaleVoiceId,
  LanguageOption,
  Personality,
  ResponseStyle,
  TiyaSettings,
} from '../../types/tiya';
import { base64Pcm16ToFloat32 } from '../../utils/audioPcm';
import { SettingsShell } from './SettingsShell';

interface VoiceLanguagePageProps {
  settings: TiyaSettings;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

const PERSONALITIES: Personality[] = ['Normal', 'Friendly', 'Caring', 'Funny', 'Teacher'];
const LANGUAGES: LanguageOption[] = ['Bengali', 'English', 'Urdu', 'Hindi', 'Arabic'];
const STYLES: ResponseStyle[] = ['Short', 'Normal', 'Detailed'];

export const VoiceLanguagePage: React.FC<VoiceLanguagePageProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [checkingVoice, setCheckingVoice] = useState(false);
  const [voiceCheckStatus, setVoiceCheckStatus] = useState('');

  const handleVoiceCheck = async () => {
    const key = settings.apiKey.trim();
    if (!key) {
      setVoiceCheckStatus('No API key. Add your Gemini API key in Connections to run Voice Check.');
      return;
    }

    setCheckingVoice(true);
    setVoiceCheckStatus('Generating voice sample...');
    try {
      const res = await fetch('/api/gemini/voice-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': key,
        },
        body: JSON.stringify({
          voiceName: settings.voiceName,
          assistantName: settings.assistantName,
          yourName: settings.yourName,
          language: settings.language,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        audioBase64?: string;
        mimeType?: string;
        text?: string;
        detail?: string;
        label?: string;
      };

      if (!res.ok || !data.ok || !data.audioBase64) {
        setVoiceCheckStatus(data.detail || data.label || 'Voice check failed.');
        return;
      }

      const ctx = new AudioContext({ sampleRate: 24000 });
      if (ctx.state === 'suspended') await ctx.resume();

      const gainNode = ctx.createGain();
      gainNode.gain.value = settings.volume;
      gainNode.connect(ctx.destination);

      if (data.mimeType?.includes('wav') || data.mimeType?.includes('mp3')) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.playbackRate.value = settings.speechSpeed;
        src.connect(gainNode);
        src.start();
        src.onended = () => ctx.close().catch(() => {});
      } else {
        const float32 = base64Pcm16ToFloat32(data.audioBase64);
        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = settings.speechSpeed;
        src.connect(gainNode);
        src.start();
        src.onended = () => ctx.close().catch(() => {});
      }

      setVoiceCheckStatus(`Playing ${settings.voiceName}: "${data.text || ''}"`);
    } catch {
      setVoiceCheckStatus('Unable to play voice check sample.');
    } finally {
      setCheckingVoice(false);
    }
  };

  return (
    <SettingsShell title="4. Voice & Language" onBack={onBack}>
      <div className="space-y-4 pb-4">
        {/* Names */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div>
            <label
              htmlFor="assistant-name-input"
              className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
            >
              ASSISTANT NAME
            </label>
            <input
              id="assistant-name-input"
              type="text"
              value={settings.assistantName}
              onChange={(e) => onUpdateSettings({ assistantName: e.target.value })}
              placeholder="TIYA"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="your-name-input"
              className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
            >
              YOUR NAME
            </label>
            <input
              id="your-name-input"
              type="text"
              value={settings.yourName}
              onChange={(e) => onUpdateSettings({ yourName: e.target.value })}
              placeholder="Enter your name"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />
          </div>
        </div>

        {/* Personality */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            PERSONALITY
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {PERSONALITIES.map((p) => {
              const active = settings.personality === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onUpdateSettings({ personality: p })}
                  className={`min-h-[40px] rounded-xl px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-teal-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language & Response Style */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div>
            <label
              htmlFor="default-language-select"
              className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
            >
              LANGUAGE
            </label>
            <select
              id="default-language-select"
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value as LanguageOption })}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'Bengali' ? 'Bengali (Default)' : lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
              RESPONSE STYLE
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STYLES.map((style) => {
                const active = settings.responseStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onUpdateSettings({ responseStyle: style })}
                    className={`min-h-[42px] rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Female Voices Only */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
            VOICE (FEMALE VOICES ONLY)
          </p>
          <div className="mt-2.5 space-y-2">
            {FEMALE_VOICES.map((v) => {
              const active = settings.voiceName === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onUpdateSettings({ voiceName: v.id as FemaleVoiceId })}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold">{v.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.tone}</p>
                  </div>
                  <span
                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                      active
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-slate-300 dark:border-white/25'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Speech Speed, Volume & Voice Check */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="speech-speed-range"
                className="font-semibold tracking-wide text-slate-700 dark:text-slate-200"
              >
                SPEECH SPEED
              </label>
              <span className="font-mono-code text-teal-600 dark:text-teal-400">
                {settings.speechSpeed.toFixed(2)}x
              </span>
            </div>
            <input
              id="speech-speed-range"
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={settings.speechSpeed}
              onChange={(e) => onUpdateSettings({ speechSpeed: Number(e.target.value) })}
              className="mt-2 h-2 w-full accent-teal-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="voice-volume-range"
                className="font-semibold tracking-wide text-slate-700 dark:text-slate-200"
              >
                VOLUME
              </label>
              <span className="font-mono-code text-teal-600 dark:text-teal-400">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              id="voice-volume-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
              className="mt-2 h-2 w-full accent-teal-600"
            />
          </div>

          <button
            type="button"
            onClick={handleVoiceCheck}
            disabled={checkingVoice}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-60 active:scale-[0.98]"
          >
            {checkingVoice ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            <span>VOICE CHECK</span>
          </button>

          {voiceCheckStatus && (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {voiceCheckStatus}
            </p>
          )}
        </div>
      </div>
    </SettingsShell>
  );
};
