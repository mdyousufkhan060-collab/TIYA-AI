import React, { useState } from 'react';
import { Check, Copy, Download, RotateCcw, Square, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react';
import { sendFeedback, speakText, stopSpeaking } from '../lib/feedback';

/** Small buttons under each ROSE reply: listen, copy, download, like, dislike, ask again. */
export const MessageActions: React.FC<{
  text: string;
  question?: string;
  voiceName?: string;
  onRegenerate?: () => void;
  compact?: boolean;
}> = ({ text, question, voiceName, onRegenerate, compact = false }) => {
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  const [note, setNote] = useState('');

  const btn = `flex ${compact ? 'h-7 w-7' : 'h-8 w-8'} items-center justify-center rounded-full text-cyan-100/60 transition-colors hover:bg-white/10 hover:text-white active:scale-95`;
  const icon = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const speak = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setNote('');
    setSpeaking(true);
    const err = await speakText(text, voiceName, () => setSpeaking(false));
    if (err) {
      setSpeaking(false);
      setNote(err);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setNote('কপি করা যায়নি।');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROSE-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const rate = async (v: 1 | -1) => {
    if (vote === v) return;
    setVote(v);
    const ok = await sendFeedback(v, text, question);
    setNote(ok ? (v === 1 ? 'ধন্যবাদ!' : 'ধন্যবাদ, আমরা উন্নত করব।') : '');
  };

  return (
    <div className="mt-1 flex flex-col">
      <div className="flex items-center gap-0.5" role="toolbar" aria-label="Reply actions">
        <button type="button" onClick={speak} aria-label={speaking ? 'Stop reading' : 'Read aloud'} title={speaking ? 'Stop' : 'Listen'} className={`${btn} ${speaking ? '!text-emerald-300' : ''}`}>
          {speaking ? <Square className={icon} /> : <Volume2 className={icon} />}
        </button>
        <button type="button" onClick={copy} aria-label="Copy" title="Copy" className={btn}>
          {copied ? <Check className={`${icon} text-emerald-300`} /> : <Copy className={icon} />}
        </button>
        <button type="button" onClick={download} aria-label="Download" title="Download" className={btn}>
          <Download className={icon} />
        </button>
        <button type="button" onClick={() => void rate(1)} aria-label="Good reply" title="Good" className={`${btn} ${vote === 1 ? '!text-emerald-300' : ''}`}>
          <ThumbsUp className={icon} />
        </button>
        <button type="button" onClick={() => void rate(-1)} aria-label="Bad reply" title="Bad" className={`${btn} ${vote === -1 ? '!text-rose-300' : ''}`}>
          <ThumbsDown className={icon} />
        </button>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} aria-label="Ask again" title="Ask again" className={btn}>
            <RotateCcw className={icon} />
          </button>
        )}
      </div>
      {note && <p className="px-1 text-[10.5px] text-cyan-100/60">{note}</p>}
    </div>
  );
};
