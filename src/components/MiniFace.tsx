import React, { useState } from 'react';

/** Tiny round photo next to a chat bubble (ROSE, or the signed-in user's Gmail photo). */
export const MiniFace: React.FC<{ src?: string | null; name?: string; rose?: boolean }> = ({ src, name, rose }) => {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img
      src={src}
      alt={name || ''}
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
      className={`mt-0.5 h-7 w-7 shrink-0 self-start rounded-full object-cover ring-2 ${rose ? 'ring-fuchsia-400/70' : 'ring-cyan-400/60'}`}
    />
  ) : (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 self-start items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-[11px] font-bold text-white">
      {(name || '?').trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
};
