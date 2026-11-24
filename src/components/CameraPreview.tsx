import React, { useEffect, useRef, useState } from 'react';
import { Eye, RefreshCw, X } from 'lucide-react';

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
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
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
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setErr('Camera blocked. Allow camera permission for ROSE and try again.'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <div className="pointer-events-auto absolute right-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 w-[42%] max-w-[190px] overflow-hidden rounded-2xl border border-cyan-300/40 bg-black shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)]">
      {err ? (
        <p className="p-3 text-[11px] leading-snug text-rose-300">{err}</p>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`aspect-[3/4] w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
      )}
      {seeing && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-semibold tracking-wide text-cyan-200">
          <Eye className="h-3 w-3" /> ROSE can see
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex justify-between p-1.5">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          aria-label="Switch camera"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Turn camera off"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
