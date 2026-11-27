/**
 * Quiet listening for ROSE PREMIUM voice: the microphone stays open for the whole talk and ROSE finds the
 * start and end of his words herself (by loudness). The phone's speech recognizer is not restarted after
 * every reply, so its "টুং / ঠাস" start sound never plays. Each finished sentence comes out as a 16 kHz WAV
 * (base64) that the ROSE server turns into text.
 */
export type QuietMic = {
  /** true = waiting for him to talk; false = ignore the mic (ROSE is thinking or speaking) */
  setListening: (on: boolean) => void;
  close: () => void;
};

export async function openQuietMic(onSpeech: (wavB64: string) => void, onLevel?: (level: number) => void): Promise<QuietMic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const rate = ctx.sampleRate;

  let listening = false;
  let talking = false;
  let chunks: Float32Array[] = [];
  let pre: Float32Array[] = [];
  let quietFor = 0;
  let spokeFor = 0;
  let floor = 0.008; // background noise, learned while he is quiet

  proc.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    onLevel?.(Math.min(1, rms * 8));
    const ms = (data.length / rate) * 1000;
    if (!listening) {
      talking = false;
      chunks = [];
      pre = [];
      return;
    }
    const loud = rms > Math.max(0.018, floor * 3);
    if (!talking) {
      floor = floor * 0.95 + rms * 0.05;
      pre.push(data);
      if (pre.length > 3) pre.shift(); // keep the first sound of the word
      if (loud) {
        talking = true;
        chunks = [...pre];
        pre = [];
        quietFor = 0;
        spokeFor = 0;
      }
      return;
    }
    chunks.push(data);
    spokeFor += ms;
    quietFor = loud ? 0 : quietFor + ms;
    // he stopped for a moment (or talked very long): that is one sentence
    if (quietFor > 1100 || spokeFor > 15000) {
      const parts = chunks;
      talking = false;
      chunks = [];
      if (spokeFor - quietFor < 350) return; // a cough or a click, not words
      onSpeech(toWav16k(parts, rate));
    }
  };
  src.connect(proc);
  proc.connect(ctx.destination);

  return {
    setListening: (on) => {
      listening = on;
    },
    close: () => {
      listening = false;
      try {
        proc.disconnect();
        src.disconnect();
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    },
  };
}

function toWav16k(parts: Float32Array[], rate: number): string {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const step = rate / 16000;
  const n = Math.floor(total / step);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, all[Math.floor(i * step)]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
