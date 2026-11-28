/**
 * Plays ROSE's voice while it is still arriving (streamed 24 kHz 16-bit PCM pieces from the server), so she starts
 * talking about 2 seconds sooner. Looks like an <audio> element to the rest of the app (pause / ended / paused).
 */
export type PcmStreamPlayer = {
  push: (pcmB64: string) => void;
  /** no more pieces will come; resolves when the last piece has finished playing */
  end: () => Promise<void>;
  pause: () => void;
  ended: boolean;
  paused: boolean;
  started: boolean;
  /** false when the phone does not let this page play sound by itself (then the old way is used) */
  canPlay: () => Promise<boolean>;
  /** how long all pieces so far take to play, in ms */
  totalMs: () => number;
};

export function pcmStreamPlayer(volume = 1, rate = 1, sampleRate = 24000): PcmStreamPlayer {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  void ctx.resume().catch(() => undefined);
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  gain.connect(ctx.destination);
  const speed = Math.max(0.75, Math.min(1.35, rate || 1));
  let at = 0;
  let open = 0;
  let closed = false;
  let done: (() => void) | null = null;
  const sources: AudioBufferSourceNode[] = [];
  let first = true;
  let firstStart = 0;
  const finish = () => {
    if (p.ended) return;
    p.ended = true;
    void ctx.close().catch(() => undefined);
    done?.();
  };
  const p: PcmStreamPlayer = {
    ended: false,
    paused: false,
    started: false,
    push(b64: string) {
      if (p.paused || p.ended) return;
      const bin = atob(b64);
      const n = bin.length >> 1;
      if (!n) return;
      const buf = ctx.createBuffer(1, n, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
        if (v >= 32768) v -= 65536;
        ch[i] = v / 32768;
      }
      // a soft start on the very first piece (no click)
      if (first) {
        const f = Math.min(n, Math.round(sampleRate * 0.012));
        for (let i = 0; i < f; i++) ch[i] *= i / f;
        first = false;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = speed;
      src.connect(gain);
      const start = Math.max(at, ctx.currentTime + 0.04);
      if (!firstStart) firstStart = start;
      src.start(start);
      at = start + buf.duration / speed;
      open++;
      p.started = true;
      sources.push(src);
      src.onended = () => {
        open--;
        if (closed && open <= 0) finish();
      };
    },
    end() {
      closed = true;
      return new Promise<void>((res) => {
        done = res;
        if (open <= 0 || p.paused) finish();
      });
    },
    totalMs() {
      return firstStart ? Math.round((at - firstStart) * 1000) : 0;
    },
    async canPlay() {
      if (ctx.state === 'running') return true;
      await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 300))]);
      return (ctx.state as string) === 'running';
    },
    pause() {
      p.paused = true;
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      finish();
    },
  };
  return p;
}
