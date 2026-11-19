import React from 'react';
import { OrbStyle, VoiceState } from '../types/tiya';

interface VoiceOrbProps {
  voiceState: VoiceState;
  audioLevel: number;
  reduceMotion: boolean;
  orbStyle?: OrbStyle;
  tiyaAlive?: boolean;
  onToggle: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  voiceState,
  audioLevel,
  reduceMotion,
  orbStyle = 'Classic',
  tiyaAlive = true,
  onToggle,
}) => {
  const isActive =
    voiceState === 'listening' ||
    voiceState === 'thinking' ||
    voiceState === 'speaking' ||
    voiceState === 'connecting';

  const shouldAnimateIdle = !reduceMotion && tiyaAlive && voiceState === 'idle';

  const dynamicScale = reduceMotion
    ? 1
    : voiceState === 'speaking'
      ? 1 + Math.min(0.18, audioLevel * 0.22)
      : voiceState === 'listening'
        ? 1 + Math.min(0.12, audioLevel * 0.16)
        : 1;

  const ariaLabel = isActive
    ? `Stop TIYA voice conversation (currently ${voiceState})`
    : 'Start TIYA live voice conversation';

  const ringColor =
    voiceState === 'error'
      ? 'border-rose-500/50 bg-rose-500/10'
      : voiceState === 'speaking'
        ? 'border-teal-400/60 bg-teal-400/15'
        : voiceState === 'listening'
          ? 'border-sky-400/55 bg-sky-400/10'
          : voiceState === 'thinking' || voiceState === 'connecting'
            ? 'border-amber-400/50 bg-amber-400/10'
            : 'border-slate-300/60 dark:border-white/15 bg-slate-200/40 dark:bg-white/[0.04]';

  const coreGradient =
    voiceState === 'error'
      ? 'from-rose-500 via-rose-600 to-rose-800 shadow-rose-500/25'
      : voiceState === 'speaking'
        ? 'from-teal-300 via-teal-500 to-cyan-700 shadow-teal-500/35'
        : voiceState === 'listening'
          ? 'from-sky-300 via-teal-400 to-sky-700 shadow-sky-500/30'
          : voiceState === 'thinking' || voiceState === 'connecting'
            ? 'from-amber-300 via-teal-400 to-cyan-700 shadow-amber-500/20'
            : orbStyle === 'Pulse'
              ? 'from-cyan-300 via-teal-500 to-indigo-900 shadow-cyan-500/25'
              : orbStyle === 'Wave'
                ? 'from-emerald-300 via-teal-500 to-slate-900 shadow-emerald-500/25'
                : 'from-teal-400 via-cyan-500 to-slate-800 shadow-teal-500/20';

  const barMultipliers =
    orbStyle === 'Wave'
      ? [0.4, 0.75, 1.0, 0.75, 0.4, 0.85, 0.55]
      : orbStyle === 'Pulse'
        ? [0.65, 1.0, 0.65]
        : [0.55, 0.95, 1.0, 0.8, 0.5];

  return (
    <div className="relative flex items-center justify-center" data-orb-style={orbStyle}>
      {/* Outer ripple ring when active OR Pulse style alive */}
      {((isActive && !reduceMotion) || (orbStyle === 'Pulse' && shouldAnimateIdle)) && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute h-44 w-44 rounded-full border ${
            voiceState === 'speaking'
              ? 'border-teal-400/40 animate-orb-ripple'
              : 'border-sky-400/30 animate-orb-ripple'
          }`}
        />
      )}

      {/* Ambient halo */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute h-40 w-40 rounded-full border transition-colors duration-200 ${ringColor} ${
          orbStyle === 'Wave' && shouldAnimateIdle ? 'border-dashed' : ''
        }`}
      />

      {/* Interactive Center Orb Button (stable hitbox, inner layer animates) */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={ariaLabel}
        aria-pressed={isActive}
        data-testid="tiya-voice-orb"
        data-voice-state={voiceState}
        className="relative flex h-32 w-32 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400 active:scale-95"
      >
        {/* Animated gradient sphere */}
        <span
          aria-hidden="true"
          style={{ transform: `scale(${dynamicScale})` }}
          className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br ${coreGradient} shadow-2xl transition-transform duration-150 ${
            shouldAnimateIdle ? 'animate-orb-breathe' : ''
          }`}
        />

        {/* Subtle inner specular layer */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-full bg-gradient-to-b from-white/30 via-transparent to-black/30"
        />

        {/* Crisp inner geometric vocal waveform bars / pulse core */}
        {orbStyle === 'Pulse' ? (
          <span className="relative z-10 flex items-center justify-center" aria-hidden="true">
            <span
              style={{
                transform: `scale(${isActive ? 1 + audioLevel * 0.45 : 1})`,
              }}
              className={`h-8 w-8 rounded-full border-2 border-white/80 bg-white/25 transition-transform duration-100 ${
                shouldAnimateIdle ? 'animate-pulse' : ''
              }`}
            />
          </span>
        ) : (
          <span className="relative z-10 flex items-center gap-1" aria-hidden="true">
            {barMultipliers.map((multiplier, idx) => {
              const barHeight = isActive
                ? Math.max(
                    10,
                    Math.round(
                      voiceState === 'thinking' || voiceState === 'connecting'
                        ? 14 + (idx % 2) * 8
                        : 12 + audioLevel * 32 * multiplier,
                    ),
                  )
                : Math.round(10 + multiplier * 10);

              return (
                <span
                  key={idx}
                  style={{ height: `${barHeight}px` }}
                  className="w-1.5 rounded-full bg-white/90 transition-all duration-100"
                />
              );
            })}
          </span>
        )}
      </button>
    </div>
  );
};
