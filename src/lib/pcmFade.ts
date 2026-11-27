/**
 * Soft start and end for spoken PCM (16-bit, mono). A sound that starts or stops at a loud sample makes a
 * "ঠাস" click in the speaker; a few milliseconds of fade removes it without changing the words.
 */
export function fadePcm(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const n = Math.floor(pcm.length / 2);
  if (n < 4) return pcm;
  const v = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const inN = Math.min(n >> 1, Math.round(sampleRate * 0.012));
  const outN = Math.min(n >> 1, Math.round(sampleRate * 0.03));
  for (let i = 0; i < inN; i++) v.setInt16(i * 2, Math.round(v.getInt16(i * 2, true) * (i / inN)), true);
  for (let i = 0; i < outN; i++) {
    const at = n - 1 - i;
    v.setInt16(at * 2, Math.round(v.getInt16(at * 2, true) * (i / outN)), true);
  }
  return pcm.length % 2 ? pcm.subarray(0, n * 2) : pcm;
}
