import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Mic, Play, Square } from 'lucide-react';
import {
  FEMALE_VOICES,
  FemaleVoiceId,
  LanguageOption,
  TiyaSettings,
} from '../../types/tiya';
import { base64Pcm16ToFloat32, computeRmsEnergy } from '../../utils/audioPcm';
import { appendErrorLog } from '../../utils/storage';
import { LiveModelPage } from './LiveModelPage';
import { SettingsBar, SettingsShell, SettingsToggleBar } from './SettingsShell';

interface VoiceLanguagePageProps {
  settings: TiyaSettings;
  subpage: string | null;
  onSelectSubpage: (subpage: string | null) => void;
  onUpdateSettings: (partial: Partial<TiyaSettings>) => void;
  onBack: () => void;
}

const LANGUAGES: LanguageOption[] = ['Bengali', 'English', 'Urdu', 'Hindi', 'Arabic'];

export const VoiceLanguagePage: React.FC<VoiceLanguagePageProps> = ({
  settings,
  subpage,
  onSelectSubpage,
  onUpdateSettings,
  onBack,
}) => {
  // Voice preview state
  const [previewingVoice, setPreviewingVoice] = useState<FemaleVoiceId | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const previewCtxRef = useRef<AudioContext | null>(null);

  // Live Mic Test state
  const [micTesting, setMicTesting] = useState(false);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [micTestStatus, setMicTestStatus] = useState('');
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micProcRef = useRef<ScriptProcessorNode | null>(null);

  const stopPreviewAudio = () => {
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
  };

  const stopMicTest = () => {
    if (micProcRef.current) {
      try {
        micProcRef.current.disconnect();
        micProcRef.current.onaudioprocess = null;
      } catch {
        // ignore
      }
      micProcRef.current = null;
    }
    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) t.stop();
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    setMicTesting(false);
    setMicTestLevel(0);
  };

  useEffect(() => {
    if (subpage !== 'mic_test' && micTesting) {
      stopMicTest();
    }
    if (subpage !== 'voice') {
      stopPreviewAudio();
      setPreviewingVoice(null);
      setPreviewStatus('');
    }
    return () => {
      stopMicTest();
      stopPreviewAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subpage]);

  const startMicTest = async () => {
    setMicTestStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      micCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      micProcRef.current = proc;
      proc.onaudioprocess = (e) => {
        const rms =
          computeRmsEnergy(e.inputBuffer.getChannelData(0)) *
          settings.micListening.sensitivity;
        setMicTestLevel(Math.min(1, rms * 7));
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      setMicTesting(true);
      setMicTestStatus('Listening cleanly. Speak into your microphone.');
    } catch {
      appendErrorLog('voice', 'Mic Test', 'Microphone access denied or unavailable.');
      setMicTestStatus('Microphone permission denied or unavailable.');
    }
  };

  const handlePreviewVoice = async (voiceId: FemaleVoiceId) => {
    const key = settings.apiKey.trim();
    if (!key) {
      setPreviewStatus('Add your Gemini key in 02 CONNECTIONS to preview voices.');
      return;
    }

    stopPreviewAudio();
    setPreviewingVoice(voiceId);
    setPreviewStatus(`Loading ${voiceId} preview in ${settings.language}...`);

    try {
      const res = await fetch('/api/gemini/voice-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': key,
        },
        body: JSON.stringify({
          voiceName: voiceId,
          assistantName: settings.assistantName || 'TIYA',
          yourName: settings.yourName,
          language: settings.language,
          ttsModel: settings.ttsModel,
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
        setPreviewStatus(data.detail || data.label || 'Voice preview failed.');
        setPreviewingVoice(null);
        return;
      }

      const ctx = new AudioContext({ sampleRate: 24000 });
      previewCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const gainNode = ctx.createGain();
      gainNode.gain.value = settings.volume;
      gainNode.connect(ctx.destination);

      const playBuffer = (buffer: AudioBuffer) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = settings.speechSpeed;
        if (typeof src.detune !== 'undefined' && settings.pitch !== 1.0) {
          src.detune.value = (settings.pitch - 1.0) * 1200;
        }
        src.connect(gainNode);
        src.start();
        src.onended = () => {
          setPreviewingVoice((cur) => (cur === voiceId ? null : cur));
          ctx.close().catch(() => {});
          if (previewCtxRef.current === ctx) {
            previewCtxRef.current = null;
          }
        };
      };

      if (data.mimeType?.includes('wav') || data.mimeType?.includes('mp3')) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        playBuffer(decoded);
      } else {
        const float32 = base64Pcm16ToFloat32(data.audioBase64);
        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);
        playBuffer(buffer);
      }

      setPreviewStatus(`Playing ${voiceId} (${settings.language})`);
    } catch {
      setPreviewStatus('Unable to play voice preview.');
      setPreviewingVoice(null);
    }
  };

  const updateMic = (partial: Partial<TiyaSettings['micListening']>) => {
    onUpdateSettings({
      micListening: { ...settings.micListening, ...partial },
    });
  };

  // Sub-pages
  if (subpage === 'assistant_name') {
    return (
      <SettingsShell title="ASSISTANT NAME" onBack={() => onSelectSubpage(null)}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-3.5">
          <label
            htmlFor="assistant-name-input"
            className="block text-[10px] font-semibold tracking-wider text-slate-400"
          >
            ASSISTANT NAME
          </label>
          <input
            id="assistant-name-input"
            type="text"
            value={settings.assistantName}
            onChange={(e) => onUpdateSettings({ assistantName: e.target.value })}
            placeholder="TIYA"
            className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#090B10] px-3 text-xs text-white focus:border-teal-500 focus:outline-none"
          />
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'your_name') {
    return (
      <SettingsShell title="YOUR NAME" onBack={() => onSelectSubpage(null)}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-3.5">
          <label
            htmlFor="your-name-input"
            className="block text-[10px] font-semibold tracking-wider text-slate-400"
          >
            YOUR NAME
          </label>
          <input
            id="your-name-input"
            type="text"
            value={settings.yourName}
            onChange={(e) => onUpdateSettings({ yourName: e.target.value })}
            placeholder="Enter your name"
            className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#090B10] px-3 text-xs text-white focus:border-teal-500 focus:outline-none"
          />
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'language') {
    return (
      <SettingsShell title="LANGUAGE" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5">
          {LANGUAGES.map((lang) => {
            const active = settings.language === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => onUpdateSettings({ language: lang })}
                className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 text-xs font-medium ${
                  active
                    ? 'border-teal-500 bg-teal-500/10 font-semibold text-teal-300'
                    : 'border-white/[0.08] bg-[#11151E] text-slate-200'
                }`}
              >
                <span>{lang === 'Bengali' ? 'Bengali (Default)' : lang}</span>
                {active && <Check className="h-4 w-4 text-teal-400" />}
              </button>
            );
          })}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'voice') {
    return (
      <SettingsShell title="VOICE" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-2.5 pb-3">
          <p className="px-1 text-[10.5px] text-slate-400">
            Female voices only · Preview plays in {settings.language}
          </p>

          <div className="space-y-1.5">
            {FEMALE_VOICES.map((v) => {
              const active = settings.voiceName === v.id;
              const isPlaying = previewingVoice === v.id;
              return (
                <div
                  key={v.id}
                  data-testid={`voice-option-${v.id}`}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3 py-1.5 ${
                    active
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-white/[0.08] bg-[#11151E]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ voiceName: v.id as FemaleVoiceId })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        active
                          ? 'border-teal-500 bg-teal-500 text-white'
                          : 'border-white/25'
                      }`}
                    >
                      {active && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-semibold ${
                          active ? 'text-teal-300' : 'text-slate-100'
                        }`}
                      >
                        {v.label}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">{v.tone}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePreviewVoice(v.id)}
                    disabled={previewingVoice !== null && !isPlaying}
                    aria-label={`Preview ${v.label} in ${settings.language}`}
                    data-testid={`voice-preview-${v.id}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-500/35 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 disabled:opacity-45"
                  >
                    {isPlaying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {previewStatus && (
            <p className="rounded-xl border border-white/[0.08] bg-[#11151E] px-3 py-2 text-[11px] text-slate-300">
              {previewStatus}
            </p>
          )}
        </div>
      </SettingsShell>
    );
  }

  if (
    subpage === 'voice_model' ||
    subpage === 'custom_model' ||
    subpage === 'chat_model_override'
  ) {
    const nestedSubpage = subpage === 'voice_model' ? null : subpage;
    return (
      <LiveModelPage
        settings={settings}
        subpage={nestedSubpage}
        onSelectSubpage={(next) => onSelectSubpage(next ? next : 'voice_model')}
        onUpdateSettings={onUpdateSettings}
        onBack={() => onSelectSubpage(null)}
      />
    );
  }

  if (subpage === 'speech_speed') {
    return (
      <SettingsShell title="SPEECH SPEED" onBack={() => onSelectSubpage(null)}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="speech-speed-range" className="font-semibold text-slate-200">
              SPEECH SPEED
            </label>
            <span className="font-mono-code text-teal-400">
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
            className="mt-3 h-2 w-full accent-teal-600"
          />
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'volume') {
    return (
      <SettingsShell title="VOLUME" onBack={() => onSelectSubpage(null)}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="voice-volume-range" className="font-semibold text-slate-200">
              VOLUME
            </label>
            <span className="font-mono-code text-teal-400">
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
            className="mt-3 h-2 w-full accent-teal-600"
          />
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'mic_test') {
    return (
      <SettingsShell title="MIC TEST" onBack={() => onSelectSubpage('mic_listening')}>
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">INPUT LEVEL</span>
            <span className="font-mono-code text-teal-400">
              {Math.round(micTestLevel * 100)}%
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-[#090B10]">
            <div
              style={{ width: `${Math.round(micTestLevel * 100)}%` }}
              className="h-full rounded-full bg-teal-500 transition-all duration-75"
            />
          </div>

          <button
            type="button"
            onClick={micTesting ? stopMicTest : startMicTest}
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white ${
              micTesting ? 'bg-rose-600' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            {micTesting ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            <span>{micTesting ? 'STOP MIC TEST' : 'START MIC TEST'}</span>
          </button>

          {micTestStatus && <p className="text-xs text-slate-300">{micTestStatus}</p>}
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'mic_sensitivity') {
    return (
      <SettingsShell title="SENSITIVITY" onBack={() => onSelectSubpage('mic_listening')}>
        <div className="rounded-2xl border border-white/[0.08] bg-[#11151E] p-4">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="mic-sensitivity-range" className="font-semibold text-slate-200">
              MIC SENSITIVITY
            </label>
            <span className="font-mono-code text-teal-400">
              {settings.micListening.sensitivity.toFixed(2)}x
            </span>
          </div>
          <input
            id="mic-sensitivity-range"
            type="range"
            min="0.25"
            max="2.0"
            step="0.05"
            value={settings.micListening.sensitivity}
            onChange={(e) => updateMic({ sensitivity: Number(e.target.value) })}
            className="mt-3 h-2 w-full accent-teal-600"
          />
        </div>
      </SettingsShell>
    );
  }

  if (subpage === 'mic_listening') {
    return (
      <SettingsShell title="MIC & LISTENING" onBack={() => onSelectSubpage(null)}>
        <div className="space-y-1.5 pb-3">
          <SettingsBar
            badge="01"
            title="MIC TEST"
            value={micTesting ? 'Live' : 'Test'}
            onClick={() => onSelectSubpage('mic_test')}
            testId="mic-bar-mic_test"
          />
          <SettingsBar
            badge="02"
            title="SENSITIVITY"
            value={`${settings.micListening.sensitivity.toFixed(2)}x`}
            onClick={() => onSelectSubpage('mic_sensitivity')}
            testId="mic-bar-mic_sensitivity"
          />
          <SettingsToggleBar
            badge="03"
            title="BACKGROUND CALL"
            value={settings.micListening.backgroundCall ? 'On' : 'Off'}
            checked={settings.micListening.backgroundCall}
            onToggle={() =>
              updateMic({ backgroundCall: !settings.micListening.backgroundCall })
            }
          />
        </div>
      </SettingsShell>
    );
  }

  const activeLiveModel =
    settings.customLiveModel.trim() || settings.selectedLiveModel;

  const bars: Array<{
    num: string;
    id: string;
    title: string;
    value: string;
  }> = [
    {
      num: '01',
      id: 'assistant_name',
      title: 'ASSISTANT NAME',
      value: settings.assistantName || 'TIYA',
    },
    {
      num: '02',
      id: 'your_name',
      title: 'YOUR NAME',
      value: settings.yourName.trim() || 'Not set',
    },
    {
      num: '03',
      id: 'language',
      title: 'LANGUAGE',
      value: settings.language,
    },
    {
      num: '04',
      id: 'voice',
      title: 'VOICE',
      value: settings.voiceName,
    },
    {
      num: '05',
      id: 'voice_model',
      title: 'VOICE MODEL',
      value: activeLiveModel.replace(/^gemini-/, ''),
    },
    {
      num: '06',
      id: 'speech_speed',
      title: 'SPEECH SPEED',
      value: `${settings.speechSpeed.toFixed(2)}x`,
    },
    {
      num: '07',
      id: 'volume',
      title: 'VOLUME',
      value: `${Math.round(settings.volume * 100)}%`,
    },
    {
      num: '08',
      id: 'mic_listening',
      title: 'MIC & LISTENING',
      value: `Sens ${settings.micListening.sensitivity.toFixed(2)}x`,
    },
  ];

  return (
    <SettingsShell title="03 VOICE & LANGUAGE" onBack={onBack}>
      <div className="space-y-1.5 pb-3">
        {bars.map((bar) => (
          <SettingsBar
            key={bar.id}
            badge={bar.num}
            title={bar.title}
            value={bar.value}
            onClick={() => onSelectSubpage(bar.id)}
            testId={`voice-bar-${bar.id}`}
          />
        ))}
      </div>
    </SettingsShell>
  );
};
