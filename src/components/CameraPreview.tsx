import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Small live camera window (front / back). Nothing is recorded or saved.
 * While voice is on (onFrame given), a small JPEG frame goes to ROSE every
 * 1.5 s so she can see; frames stop as soon as voice or the camera turns off.
 */
export const CameraPreview: React.FC<{
  onClose: () => void;
  onFrame?: (jpegBase64: string) => void;
}> = ({ onClose, onFrame }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const facing = 'user' as const;
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Camera is not available on this device.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
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
      })
      .catch(() => setErr('Camera blocked. Allow camera permission for ROSE and try again.'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // The picture is hidden (the user does not see himself); the red/normal camera
  // button shows that the camera is on. Only an error message is shown.
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-[2px] w-[2px] opacity-[0.01]"
      />
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
