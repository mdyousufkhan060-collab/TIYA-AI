import React, { useEffect, useId, useMemo, useRef } from 'react';
import { ChatMessage, PhoneAction, VoiceState } from '../types/tiya';
import { ActionConfirmCard } from './ActionConfirmCard';

interface TiyaHologramStageProps {
  voiceState: VoiceState;
  audioLevel: number;
  reduceMotion: boolean;
  assistantName: string;
  userName: string;
  messages: ChatMessage[];
  actionLinks: Record<string, string>;
  errorLabel: string;
  errorDetail: string;
  hasApiKey: boolean;
  onOpenConnections: () => void;
  onConfirmAction: (msgId: string, action: PhoneAction) => void;
  onCancelAction: (msgId: string) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  spark: boolean;
}

function createParticle(width: number, height: number, spark: boolean): Particle {
  if (spark) {
    // Rising spark emitted from glowing pedestal platform at bottom center
    return {
      x: width * (0.32 + Math.random() * 0.36),
      y: height * (0.76 + Math.random() * 0.1),
      vx: (Math.random() - 0.5) * 0.55,
      vy: -(1.4 + Math.random() * 2.2),
      size: 1.2 + Math.random() * 2.0,
      alpha: 0.65 + Math.random() * 0.35,
      life: 0,
      maxLife: 28 + Math.random() * 34,
      spark: true,
    };
  }
  // Gentle drifting ambient hologram dust
  return {
    x: width * (0.14 + Math.random() * 0.72),
    y: height * (0.15 + Math.random() * 0.68),
    vx: (Math.random() - 0.5) * 0.22,
    vy: -(0.15 + Math.random() * 0.35),
    size: 1 + Math.random() * 1.6,
    alpha: 0.25 + Math.random() * 0.45,
    life: Math.random() * 60,
    maxLife: 80 + Math.random() * 70,
    spark: false,
  };
}

export const TiyaHologramStage: React.FC<TiyaHologramStageProps> = ({
  voiceState,
  audioLevel,
  reduceMotion,
  assistantName,
  userName,
  messages,
  actionLinks,
  errorLabel,
  errorDetail,
  hasApiKey,
  onOpenConnections,
  onConfirmAction,
  onCancelAction,
}) => {
  const rawId = useId();
  const filterId = `tiya-hair-wave-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const turbRef = useRef<SVGFETurbulenceElement | null>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const beamRef = useRef<HTMLDivElement | null>(null);
  const platformPulseRef = useRef<HTMLDivElement | null>(null);
  const scanLineRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({ voiceState, audioLevel, reduceMotion });
  stateRef.current = { voiceState, audioLevel, reduceMotion };

  useEffect(() => {
    if (reduceMotion) {
      if (dispRef.current) dispRef.current.setAttribute('scale', '0');
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let rafId = 0;
    let isHidden = typeof document !== 'undefined' ? document.hidden : false;
    let lastFrameTs = 0;
    let phase = 0;
    const FRAME_INTERVAL_MS = 1000 / 30; // Strict max 30 fps

    const particles: Particle[] = [];

    const syncCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return { w: 0, h: 0 };
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { w, h };
    };

    const tick = (now: number) => {
      if (isHidden) {
        rafId = 0;
        return;
      }
      rafId = window.requestAnimationFrame(tick);

      if (now - lastFrameTs < FRAME_INTERVAL_MS) return;
      const dt = Math.min(0.1, lastFrameTs ? (now - lastFrameTs) / 1000 : 1 / 30);
      lastFrameTs = now;

      const { voiceState: vs, audioLevel: level } = stateRef.current;
      const clampedVol = Math.min(1, Math.max(0, level));

      const isSpeaking = vs === 'speaking';
      const isListening = vs === 'listening';
      const isThinking = vs === 'thinking' || vs === 'connecting';

      // Advance phase: very slow in idle/listening, much faster when speaking
      const speed = isSpeaking ? 4.4 + clampedVol * 3.8 : 0.75;
      phase += dt * speed;

      // 1. Hair wave SVG feTurbulence + feDisplacementMap
      if (turbRef.current && dispRef.current) {
        if (isSpeaking) {
          const bfX = (0.015 + Math.sin(phase * 1.1) * 0.005).toFixed(4);
          const bfY = (0.036 + Math.cos(phase * 1.35) * 0.009).toFixed(4);
          const scale = (11 + clampedVol * 12 + Math.sin(phase * 1.8) * 2.5).toFixed(1);
          turbRef.current.setAttribute('baseFrequency', `${bfX} ${bfY}`);
          dispRef.current.setAttribute('scale', scale);
        } else {
          // Very slow, subtle wave on upper-left hair during idle/listening/thinking
          const bfX = (0.011 + Math.sin(phase * 0.8) * 0.002).toFixed(4);
          const bfY = (0.025 + Math.cos(phase * 0.7) * 0.003).toFixed(4);
          const scale = (3.4 + Math.sin(phase * 0.9) * 1.1).toFixed(1);
          turbRef.current.setAttribute('baseFrequency', `${bfX} ${bfY}`);
          dispRef.current.setAttribute('scale', scale);
        }
      }

      // 2. Speaking vertical rising beam glow modulated by volume
      if (beamRef.current) {
        if (isSpeaking) {
          const beamAlpha = 0.5 + clampedVol * 0.48 + Math.sin(phase * 2.2) * 0.08;
          const beamOffsetY = -((phase * 18) % 36);
          beamRef.current.style.opacity = String(Math.min(1, Math.max(0.25, beamAlpha)));
          beamRef.current.style.transform = `translate3d(0, ${beamOffsetY.toFixed(1)}px, 0) scaleX(${(
            0.94 + clampedVol * 0.24
          ).toFixed(3)})`;
        } else {
          beamRef.current.style.opacity = '0';
        }
      }

      // 3. Listening soft blue pulse on platform rings only
      if (platformPulseRef.current) {
        if (isListening) {
          const pulse = 0.45 + Math.sin(now * 0.0045) * 0.35 + clampedVol * 0.25;
          const scale = 0.94 + Math.sin(now * 0.0045) * 0.08 + clampedVol * 0.06;
          platformPulseRef.current.style.opacity = String(Math.min(1, Math.max(0.2, pulse)));
          platformPulseRef.current.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
        } else {
          platformPulseRef.current.style.opacity = '0';
        }
      }

      // 4. Thinking thin horizontal scan line top -> bottom
      if (scanLineRef.current) {
        if (isThinking) {
          const pct = ((now * 0.042) % 104) - 2;
          scanLineRef.current.style.opacity = '0.92';
          scanLineRef.current.style.top = `${pct.toFixed(2)}%`;
        } else {
          scanLineRef.current.style.opacity = '0';
        }
      }

      // 5. Drifting light particles (idle) + rising bright sparks (speaking)
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { w, h } = syncCanvasSize();
      if (w <= 1 || h <= 1) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const desiredAmbient = 14;
      const desiredSparks = isSpeaking ? Math.round(18 + clampedVol * 18) : 0;

      let ambientCount = 0;
      let sparkCount = 0;
      for (const p of particles) {
        if (p.spark) sparkCount++;
        else ambientCount++;
      }
      while (ambientCount < desiredAmbient) {
        particles.push(createParticle(w, h, false));
        ambientCount++;
      }
      while (sparkCount < desiredSparks) {
        particles.push(createParticle(w, h, true));
        sparkCount++;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        if (p.spark) {
          p.x += p.vx * (1 + clampedVol);
          p.y += p.vy * (1 + clampedVol * 1.4);
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }

        const progress = p.life / p.maxLife;
        if (progress >= 1 || p.y < -10 || (p.spark && !isSpeaking && progress > 0.45)) {
          particles.splice(i, 1);
          continue;
        }

        const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
        const a = Math.max(0, Math.min(1, p.alpha * fade));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (p.spark) {
          ctx.fillStyle = `rgba(165, 243, 252, ${a.toFixed(3)})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
        } else {
          ctx.fillStyle = `rgba(125, 211, 252, ${(a * 0.85).toFixed(3)})`;
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.65)';
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const handleVisibility = () => {
      isHidden = document.hidden;
      if (!isHidden && !rafId) {
        lastFrameTs = 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (!isHidden) {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [reduceMotion]);

  const captionLines = useMemo(() => {
    return messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim())
      .slice(-2);
  }, [messages]);

  const pendingActionMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.pendingAction && (m.actionStatus === 'pending' || !m.actionStatus)) {
        return m;
      }
    }
    return null;
  }, [messages]);

  const isSpeaking = voiceState === 'speaking';

  return (
    <div
      ref={containerRef}
      data-testid="tiya-hologram-stage"
      data-voice-state={voiceState}
      className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#020714]"
    >
      {/* Hidden SVG Filter Definition for upper-left hair wave */}
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence
              ref={turbRef}
              type="fractalNoise"
              baseFrequency="0.011 0.025"
              numOctaves="2"
              seed="3"
              result="hairNoise"
            />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="hairNoise"
              scale={reduceMotion ? '0' : '3.5'}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Base Hologram Hero Image */}
      <img
        src="/tiya-hologram.png"
        alt="ROSE Hologram"
        draggable={false}
        className="h-full w-full select-none object-cover object-[50%_42%]"
      />

      {/* Masked Upper-Left Hair Wave Layer */}
      {!reduceMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage:
              'radial-gradient(ellipse 36% 29% at 36% 29%, #000 40%, rgba(0,0,0,0.6) 66%, transparent 95%)',
            maskImage:
              'radial-gradient(ellipse 36% 29% at 36% 29%, #000 40%, rgba(0,0,0,0.6) 66%, transparent 95%)',
            filter: `url(#${filterId})`,
            willChange: 'filter',
          }}
        >
          <img
            src="/tiya-hologram.png"
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover object-[50%_42%]"
          />
        </div>
      )}

      {/* SPEAKING: Rising Vertical Light Beam from Platform through Body */}
      <div
        ref={beamRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[18%] top-[6%] bottom-[12%] mix-blend-screen transition-opacity duration-200"
        style={{
          opacity: isSpeaking && reduceMotion ? 0.55 : 0,
          background:
            'linear-gradient(to top, rgba(34,211,238,0.88) 0%, rgba(125,211,252,0.52) 38%, rgba(56,189,248,0.22) 72%, rgba(56,189,248,0) 100%)',
          filter: 'blur(14px)',
        }}
      />

      {/* LISTENING: Soft Blue Pulse on Platform Rings Only */}
      <div
        ref={platformPulseRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[12%] left-1/2 h-[15%] w-[64%] rounded-full mix-blend-screen transition-opacity duration-200"
        style={{
          opacity: voiceState === 'listening' && reduceMotion ? 0.55 : 0,
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(ellipse at center, rgba(125,211,252,0.75) 0%, rgba(56,189,248,0.45) 48%, rgba(37,99,235,0) 76%)',
          boxShadow: '0 0 28px rgba(56, 189, 248, 0.7)',
        }}
      />

      {/* THINKING: Thin Scan Line Moving Top to Bottom */}
      <div
        ref={scanLineRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-[2px] transition-opacity duration-150"
        style={{
          opacity: 0,
          top: '0%',
          background:
            'linear-gradient(90deg, transparent 4%, rgba(56,189,248,0.85) 22%, rgba(224,242,254,0.98) 50%, rgba(56,189,248,0.85) 78%, transparent 96%)',
          boxShadow: '0 0 12px 2px rgba(56, 189, 248, 0.85)',
        }}
      />

      {/* Particles & Speaking Sparks Canvas (max 30fps rAF) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Subtle top & bottom edge vignettes for seamless framing */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#020714]/85 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#020714] via-[#020714]/75 to-transparent"
      />

      {/* Pending Phone Action Card (only when a phone action needs user confirm) */}
      {pendingActionMessage?.pendingAction && (
        <div className="absolute inset-x-3 bottom-14 z-20">
          <ActionConfirmCard
            action={pendingActionMessage.pendingAction}
            status={pendingActionMessage.actionStatus || 'pending'}
            note={pendingActionMessage.actionNote}
            fallbackUrl={actionLinks[pendingActionMessage.id]}
            onConfirm={() =>
              onConfirmAction(pendingActionMessage.id, pendingActionMessage.pendingAction!)
            }
            onCancel={() => onCancelAction(pendingActionMessage.id)}
          />
        </div>
      )}

      {/* Compact Voice Error / Missing Key Notice */}
      {voiceState === 'error' ? (
        <div className="absolute inset-x-3 bottom-11 z-10 flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-[#080D1B]/90 px-3 py-1.5 backdrop-blur-sm">
          <p className="truncate text-[11px] font-medium text-rose-300">
            {errorDetail || errorLabel || 'Voice error'}
          </p>
          {(errorLabel === 'No API key' || errorLabel === 'Invalid API key') && (
            <button
              type="button"
              onClick={onOpenConnections}
              className="shrink-0 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/30"
            >
              Connections
            </button>
          )}
        </div>
      ) : !hasApiKey && captionLines.length === 0 ? (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center px-3">
          <button
            type="button"
            onClick={onOpenConnections}
            className="text-[11px] font-medium text-cyan-300/90 underline underline-offset-4 hover:text-cyan-200"
          >
            Add Gemini API key in Settings
          </button>
        </div>
      ) : null}

      {/* Live Caption: Last 2 lines over the bottom of the hologram image */}
      {captionLines.length > 0 && (
        <div
          data-testid="home-live-caption"
          className="pointer-events-none absolute inset-x-3 bottom-2 z-10 space-y-0.5 rounded-xl bg-[#020817]/70 px-3 py-1.5 backdrop-blur-[2px]"
        >
          {captionLines.map((msg) => (
            <p
              key={msg.id}
              className="truncate text-[11px] leading-snug text-slate-100/95"
            >
              <span
                className={`mr-1.5 font-semibold ${
                  msg.role === 'user' ? 'text-sky-300' : 'text-cyan-300'
                }`}
              >
                {msg.role === 'user' ? userName.trim() || 'You' : assistantName}:
              </span>
              <span className="text-slate-200/95">{msg.text.replace(/\s+/g, ' ').trim()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
