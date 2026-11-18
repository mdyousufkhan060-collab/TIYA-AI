import React from 'react';
import { Trash2 } from 'lucide-react';
import { ChatMessage } from '../../types/tiya';
import { SettingsShell } from './SettingsShell';

interface ChatsMemoryPageProps {
  messages: ChatMessage[];
  onDeleteMessage: (id: string) => void;
  onClearAll: () => void;
  onBack: () => void;
}

export const ChatsMemoryPage: React.FC<ChatsMemoryPageProps> = ({
  messages,
  onDeleteMessage,
  onClearAll,
  onBack,
}) => {
  return (
    <SettingsShell
      title="5. Chats & Memory"
      onBack={onBack}
      rightAction={
        messages.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="min-h-[40px] rounded-xl px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 whitespace-nowrap"
          >
            Clear All
          </button>
        ) : null
      }
    >
      {messages.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No saved chats yet
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Voice and text conversations saved on this phone will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
            {messages.length} saved entries · Shared between voice and chat
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
            {[...messages].reverse().map((msg) => (
              <div
                key={msg.id}
                className="flex items-start justify-between gap-3 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    <span className="font-semibold text-teal-600 dark:text-teal-400">
                      {msg.role === 'user' ? 'You' : 'TIYA'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{msg.source === 'voice' ? 'Voice' : 'Chat'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                    {msg.text}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteMessage(msg.id)}
                  aria-label={`Delete message "${msg.text.slice(0, 20)}"`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsShell>
  );
};
