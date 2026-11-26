import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ChatMessage, MemoryItem } from '../../types/tiya';
import { groupMessagesIntoChatSessions } from '../../utils/storage';
import { SettingsShell } from './SettingsShell';
import { RoseBrainPanel } from './RoseBrainPanel';

interface ChatsMemoryPageProps {
  messages: ChatMessage[];
  memories: MemoryItem[];
  isAdmin?: boolean;
  onDeleteSessionMessages: (ids: string[]) => void;
  onDeleteMemory?: (id: string) => void;
  onClearAll: () => void;
  onBack: () => void;
}

export const ChatsMemoryPage: React.FC<ChatsMemoryPageProps> = ({
  messages,
  memories,
  isAdmin = false,
  onDeleteSessionMessages,
  onDeleteMemory,
  onClearAll,
  onBack,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const sessions = useMemo(
    () => groupMessagesIntoChatSessions(messages),
    [messages],
  );

  return (
    <SettingsShell title="05 CHATS & MEMORY" onBack={onBack}>
      <div className="flex min-h-full flex-col justify-between gap-4 pb-3">
        <div className="space-y-3">
          {/* 3 Small Stat Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
              <p className="font-mono-code text-sm font-bold text-teal-600 dark:text-teal-400">
                {sessions.length}
              </p>
              <p className="mt-0.5 text-[9.5px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                CHATS
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
              <p className="font-mono-code text-sm font-bold text-slate-900 dark:text-white">
                {messages.length}
              </p>
              <p className="mt-0.5 text-[9.5px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                MESSAGES
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
              <p className="font-mono-code text-sm font-bold text-slate-900 dark:text-white">
                {memories.length}
              </p>
              <p className="mt-0.5 text-[9.5px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                MEMORIES
              </p>
            </div>
          </div>

          {/* ROSE BRAIN: switches + what ROSE remembers (server) */}
          <RoseBrainPanel />

          {/* SAVED CHATS list */}
          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              SAVED CHATS
            </p>

            {sessions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  No saved chats yet
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/[0.08] dark:bg-[#11151E]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {session.title}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                        {session.dateLabel} · {session.messageCount} messages
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteSessionMessages(session.messageIds)}
                      aria-label={`Delete chat ${session.title}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SAVED MEMORIES list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                SAVED MEMORIES
              </p>
              {isAdmin && (
                <span
                  data-testid="admin-private-memory-tag"
                  className="text-[9.5px] font-semibold tracking-wider text-amber-400"
                >
                  ADMIN PRIVATE
                </span>
              )}
            </div>

            {memories.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center dark:border-white/[0.08] dark:bg-[#11151E]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  No saved memories yet
                </p>
              </div>
            ) : (
              <div className="space-y-1.5" data-testid="saved-memories-list">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-[#11151E]"
                  >
                    <p className="min-w-0 flex-1 text-xs text-slate-800 dark:text-slate-200">
                      {mem.text}
                    </p>
                    {onDeleteMemory && (
                      <button
                        type="button"
                        onClick={() => onDeleteMemory(mem.id)}
                        aria-label={`Delete memory ${mem.text}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CLEAR ALL at bottom with confirmation */}
        {messages.length > 0 && (
          <div className="pt-2">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-semibold tracking-wide text-rose-600 dark:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>CLEAR ALL</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="h-10 rounded-xl bg-rose-600 text-xs font-semibold text-white"
                >
                  CONFIRM CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-[#11151E] dark:text-slate-300"
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsShell>
  );
};
