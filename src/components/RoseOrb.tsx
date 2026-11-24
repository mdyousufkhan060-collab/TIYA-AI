import React, { useEffect, useRef } from 'react';
import { VoiceState } from '../types/tiya';

interface RoseOrbProps {
  voiceState: VoiceState;
  /** 0..1 loudness from the voice hook */
  audioLevel: number;
  reduceMotion?: boolean;
  className?: string;
}

/** Colours per state: [core, glow, dots] */
const PALETTE: Record<string, [string, string, string]> = {
  idle: ['#1d4ed8', '#38bdf8', '#7dd3fc'],
  connecting: ['#b45309', '#fbbf24', '#fde68a'],
  listening: ['#0e7490', '#22d3ee', '#a5f3fc'],
  thinking: ['#6d28d9', '#a78bfa', '#ddd6fe'],
  speaking: ['#be185d', '#f472b6', '#fbcfe8'],
  error: ['#991b1b', '#f87171', '#fecaca'],
};

const POINTS = 420;

/**
 * ROSE ORB — a big living ball for voice mode.
 * A 3D sphere of glowing dots that spins all the time, breathes while listening,
 * and grows + bounces with ROSE's voice while she speaks.
 */
export const RoseOrb: React.FC<RoseOrbProps> = ({ voiceState, audioLevel, reduceMotion = false, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ voiceState, audioLevel, reduceMotion });
  stateRef.current = { voiceState, audioLevel, reduceMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Points evenly spread on a sphere (Fibonacci sphere)
    const pts: Array<[number, number, number]> = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < POINTS; i++) {
      const y = 1 - (i / (POINTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let rotY = 0;
    let rotX = 0.35;
    let level = 0; // smoothed loudness
    let jump = 0; // bounce offset
    let jumpV = 0;
    let lastPeak = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { voiceState: vs, audioLevel: rawLevel, reduceMotion: still } = stateRef.current;
      const [core, glow, dot] = PALETTE[vs] || PALETTE.idle;
      const t = now / 1000;

      // Premium voice has no loudness: give a soft natural talk pulse instead
      let target = Math.max(0, Math.min(1, rawLevel || 0));
      if (vs === 'speaking' && target < 0.05) target = 0.35 + 0.3 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1));
      level += (target - level) * Math.min(1, dt * 12);

      // Bounce: a spring that kicks up on voice peaks
      if (!still && vs === 'speaking' && level > 0.45 && now - lastPeak > 260) {
        jumpV -= 140 * level;
        lastPeak = now;
      }
      jumpV += (-jump * 90 - jumpV * 9) * dt;
      jump += jumpV * dt;

      const spin = still ? 0 : vs === 'speaking' ? 0.9 + level * 1.6 : vs === 'thinking' ? 1.4 : vs === 'listening' ? 0.55 : 0.25;
      rotY += spin * dt;
      rotX = 0.35 + (still ? 0 : Math.sin(t * 0.6) * 0.18);

      const breathe = still ? 0 : vs === 'listening' ? Math.sin(t * 2.2) * 0.025 : Math.sin(t * 1.2) * 0.015;
      const base = Math.min(w, h) * 0.3;
      const R = base * (1 + breathe + level * 0.28);
      const cx = w / 2;
      const cy = h / 2 + jump;

      ctx.clearRect(0, 0, w, h);

      // Outer glow
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.1);
      g.addColorStop(0, `${glow}55`);
      g.addColorStop(0.45, `${glow}22`);
      g.addColorStop(1, `${glow}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.1, 0, Math.PI * 2);
      ctx.fill();

      // Glass core
      const c = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      c.addColorStop(0, `${dot}cc`);
      c.addColorStop(0.35, `${glow}99`);
      c.addColorStop(1, `${core}33`);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
      ctx.fill();

      // Spinning rings
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        const a = rotY * (k % 2 ? -0.7 : 0.9) + k * 1.1;
        ctx.strokeStyle = `${glow}${k === 0 ? '88' : '44'}`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (1.12 + k * 0.1), R * (0.32 + k * 0.08), a, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Dot sphere (3D rotation + depth)
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      ctx.fillStyle = dot;
      for (let i = 0; i < POINTS; i++) {
        const [px, py, pz] = pts[i];
        // wobble the surface with the voice
        const wob = 1 + (still ? 0 : level * 0.12 * Math.sin(i * 0.7 + t * 9));
        const x1 = px * cosY - pz * sinY;
        const z1 = px * sinY + pz * cosY;
        const y2 = py * cosX - z1 * sinX;
        const z2 = py * sinX + z1 * cosX;
        const depth = (z2 + 1) / 2; // 0 back .. 1 front
        const sx = cx + x1 * R * wob;
        const sy = cy + y2 * R * wob;
        ctx.globalAlpha = 0.15 + depth * 0.85;
        const s = 0.6 + depth * 1.6 + level * 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Shine
      const sh = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, 0, cx - R * 0.4, cy - R * 0.45, R * 0.5);
      sh.addColorStop(0, '#ffffff55');
      sh.addColorStop(1, '#ffffff00');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full ${className}`} />;
};
