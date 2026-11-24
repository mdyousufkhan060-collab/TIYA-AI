import React, { useEffect, useRef } from 'react';
import { VoiceState } from '../types/tiya';

/**
 * ROSE live background: glowing pink and white light rings spiralling in 3D,
 * with sparks running along them and soft star dust. Calm when idle; when ROSE
 * listens or speaks the rings spin faster, open up and glow with her voice.
 */
interface Props {
  voiceState?: VoiceState;
  audioLevel?: number;
  reduceMotion?: boolean;
  className?: string;
}

const PINK = [255, 77, 141];
const WHITE = [235, 242, 255];

export const RoseVortex: React.FC<Props> = ({ voiceState = 'idle', audioLevel = 0, reduceMotion = false, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ voiceState, audioLevel, reduceMotion });
  live.current = { voiceState, audioLevel, reduceMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    // star dust
    const stars = Array.from({ length: 110 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      p: Math.random() * Math.PI * 2,
    }));
    // rings: each is a tilted loop of the spiral with a few parallel strands
    const RINGS = 6;
    const STRANDS = 7;
    const SEG = 96;
    const sparks = Array.from({ length: 9 }, (_, i) => ({ ring: i % RINGS, t: Math.random(), v: 0.05 + Math.random() * 0.05, pink: i % 2 === 0 }));

    let spin = 0;
    let energy = 0;
    // bounce (spring): it jumps on every word, like the old ROSE ball
    let bounce = 0;
    let bounceV = 0;
    let prevLvl = 0;
    let nextBeat = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { voiceState: vs, audioLevel: lvl, reduceMotion: still } = live.current;
      const active = vs === 'listening' || vs === 'speaking' || vs === 'thinking' || vs === 'connecting';
      const target = !active ? 0.15 : vs === 'speaking' ? 0.65 + Math.min(1, lvl) * 0.6 : vs === 'thinking' ? 0.75 : 0.45 + Math.min(1, lvl) * 0.5;
      energy += (target - energy) * Math.min(1, dt * 4);
      if (!still) spin += dt * (0.12 + energy * 0.9);

      // words: a kick on each loudness peak; premium voice has no level, so a soft beat while speaking
      let lv = Math.min(1, lvl || 0);
      if (vs === 'speaking' && lv < 0.02 && now > nextBeat) {
        lv = 0.35 + Math.random() * 0.45;
        nextBeat = now + 180 + Math.random() * 220;
      }
      if (!still && active && lv - prevLvl > 0.1) bounceV += 2.4 * lv + 0.6;
      prevLvl = prevLvl * 0.6 + lv * 0.4;
      bounceV += (-55 * bounce - 7 * bounceV) * dt;
      bounce += bounceV * dt;
      bounce = Math.max(-0.12, Math.min(0.45, bounce));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // dust
      for (const s of stars) {
        const a = 0.25 + 0.35 * Math.sin(now / 900 + s.p);
        ctx.fillStyle = `rgba(220,230,255,${a * (0.5 + energy * 0.5)})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = w / 2;
      const cy = h * 0.47 - bounce * Math.min(w, h) * 0.16;
      const base = Math.min(w, h * 0.9) * (0.34 + energy * 0.04) * (1 + bounce * 0.35);
      const tilt = 1.05; // look down on the spiral
      const fov = base * 3.2;

      const project = (ring: number, strand: number, t: number) => {
        const k = ring / (RINGS - 1); // 0 top .. 1 bottom
        const ang = t * Math.PI * 2 + spin + ring * 0.55;
        const rad = base * (0.55 + 0.5 * Math.sin(k * Math.PI)) * (1 + strand * 0.018) * (1 + energy * 0.12);
        const x = Math.cos(ang) * rad;
        const z0 = Math.sin(ang) * rad;
        const y0 = (k - 0.5) * base * 1.25 + Math.sin(ang * 2 + spin) * base * 0.04 * energy;
        // tilt around the x axis
        const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
        const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
        const sc = fov / (fov + z);
        return { x: cx + x * sc, y: cy + y * sc, z, sc };
      };

      ctx.globalCompositeOperation = 'lighter';
      for (let ring = 0; ring < RINGS; ring++) {
        const col = ring % 2 === 0 ? PINK : WHITE;
        for (let s = 0; s < STRANDS; s++) {
          ctx.beginPath();
          let prev = project(ring, s, 0);
          ctx.moveTo(prev.x, prev.y);
          for (let i = 1; i <= SEG; i++) {
            const p = project(ring, s, i / SEG);
            ctx.lineTo(p.x, p.y);
            prev = p;
          }
          const edge = s === 0 || s === STRANDS - 1;
          const a = (edge ? 0.42 : 0.1) * (0.45 + energy * 0.85);
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
          ctx.lineWidth = edge ? 1.6 : 0.8;
          ctx.stroke();
        }
      }

      // sparks running along the rings, with short tails
      for (const sp of sparks) {
        if (!still) sp.t = (sp.t + dt * sp.v * (1 + energy * 2.5)) % 1;
        const col = sp.pink ? PINK : WHITE;
        for (let k = 0; k < 10; k++) {
          const p = project(sp.ring, 0, (sp.t - k * 0.006 + 1) % 1);
          const a = (1 - k / 10) * (0.55 + energy * 0.45);
          ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (k === 0 ? 2.6 : 1.6) * p.sc * (1 + energy * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        const head = project(sp.ring, 0, sp.t);
        const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 18 * head.sc * (1 + energy));
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.35 + energy * 0.35})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 18 * head.sc * (1 + energy), 0, Math.PI * 2);
        ctx.fill();
      }

      // soft core glow that breathes with her voice
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * (0.9 + energy * 0.3));
      core.addColorStop(0, `rgba(255,77,141,${0.06 + energy * 0.12})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible') {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none block h-full w-full ${className}`} />;
};
