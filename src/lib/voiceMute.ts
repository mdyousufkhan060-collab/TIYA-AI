/**
 * MUTE while ROSE's voice is on: ROSE stays on (she can still speak, finish a job, and come back), but she does
 * not hear the microphone until he un-mutes. One shared switch for both voice engines (Live and ROSE PREMIUM).
 */
let muted = false;
const subs = new Set<(m: boolean) => void>();

export function isVoiceMuted(): boolean {
  return muted;
}

export function setVoiceMuted(v: boolean): void {
  if (muted === v) return;
  muted = v;
  subs.forEach((f) => f(v));
}

export function onVoiceMuted(f: (m: boolean) => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
