import React, { useEffect, useRef, useState } from 'react';
import { SwitchCamera, X } from 'lucide-react';

/**
 * Small live camera window (front / back). Nothing is recorded or saved.
 * While voice is on (onFrame given), a small JPEG frame goes to ROSE every
 * 1.5 s so she can see; frames stop as soon as voice or the camera turns off.
 */
export type CameraFacing = 'user' | 'environment';

export const CameraPreview: React.FC<{
  onClose: () => void;
  onFrame?: (jpegBase64: string) => void;
  facing?: CameraFacing;
  onFlip?: () => void;
}> = ({ onClose, onFrame, facing = 'user', onFlip }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const seeing = Boolean(onFrame) && !err;

  useEffect(() => {
    if (!seeing) return;
    const canvas = document.createElement('canvas');
    const timer = window.setInterval(() => {
      const v = videoRef.current;
      const send = onFrameRef.current;
      if (!v || !send || v.readyState < 2 || !v.videoWidth) return;
      const w = 384;
      const h = Math.round((v.videoHeight / v.videoWidth) * w) || 512;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(v, 0, 0, w, h);
        const url = canvas.toDataURL('image/jpeg', 0.6);
        const b64 = url.split(',')[1];
        if (b64) send(b64);
      } catch {
        // ignore a frame that could not be read
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [seeing]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setErr('');
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Camera is not available on this device.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => setErr('Camera blocked. Allow camera permission for ROSE and try again.'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // Small live window at the top so the user knows the camera is on
  // (front camera is mirrored like a selfie). Flip = front / back camera.
  return (
    <>
      {!err && (
        <div className="pointer-events-auto fixed right-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 h-32 w-24 overflow-hidden rounded-2xl border-2 border-cyan-300/70 bg-black shadow-[0_0_18px_rgba(56,212,255,0.45)]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-cyan-200">Starting…</div>
          )}
          <span className="absolute left-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Camera off"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {onFlip && (
            <button
              type="button"
              onClick={onFlip}
              aria-label={facing === 'user' ? 'Back camera' : 'Front camera'}
              className="absolute bottom-1 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {err && (
        <div className="pointer-events-auto absolute right-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 flex max-w-[220px] items-start gap-2 rounded-2xl border border-rose-400/40 bg-black/80 p-3">
          <p className="text-[11px] leading-snug text-rose-300">{err}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
