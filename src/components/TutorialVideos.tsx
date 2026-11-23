import React, { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface TutorialVideo {
  id: string;
  audience: 'all' | 'personal' | 'student' | 'business';
  title: string;
  youtube_url: string;
  description: string | null;
}

export function youtubeId(url: string): string | null {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function useTutorialVideos(audience?: string | null) {
  const [list, setList] = useState<TutorialVideo[]>([]);
  useEffect(() => {
    let q = supabase.from('tutorial_videos').select('id,audience,title,youtube_url,description').eq('is_active', true);
    if (audience) q = q.in('audience', [audience, 'all']);
    void q.order('sort').then(({ data }) => setList((data as TutorialVideo[]) || []));
  }, [audience]);
  return list;
}

/** One YouTube video, loads only when tapped (fast, no tracking until played). */
export const YouTubeCard: React.FC<{ video: TutorialVideo; compact?: boolean }> = ({ video, compact }) => {
  const [play, setPlay] = useState(false);
  const id = youtubeId(video.youtube_url);
  if (!id) return null;
  return (
    <div className="overflow-hidden rounded-[6px] border border-white/10 bg-black">
      <div className="relative aspect-video w-full">
        {play ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`Play ${video.title}`}>
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10">
              <PlayCircle className="h-14 w-14 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />
            </span>
          </button>
        )}
      </div>
      {!compact && (
        <div className="px-3 py-2">
          <p className="text-[12.5px] font-bold text-white">{video.title}</p>
          {video.description && <p className="mt-0.5 text-[11px] text-slate-400">{video.description}</p>}
        </div>
      )}
    </div>
  );
};

/** "HOW TO USE" videos for this user's mode (shown at the top of Workspace). */
export const TutorialStrip: React.FC<{ audience?: string | null }> = ({ audience }) => {
  const list = useTutorialVideos(audience);
  if (!list.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[10px] font-bold tracking-wider text-red-300">▶ HOW TO USE ROSE</p>
      {list.slice(0, 2).map((v) => (
        <YouTubeCard key={v.id} video={v} />
      ))}
    </div>
  );
};
