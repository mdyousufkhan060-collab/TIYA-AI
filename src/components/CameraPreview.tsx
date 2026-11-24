import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Small live camera window (front / back). Nothing is recorded or uploaded:
 * the picture stays on the phone and the camera turns off when it closes.
 */
export const CameraPreview: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [err, setErr] = useState('');

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
