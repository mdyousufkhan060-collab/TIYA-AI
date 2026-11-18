import React from 'react';
import { Bell, X } from 'lucide-react';
import { NotificationItem } from '../types/tiya';

interface NotificationsSheetProps {
  open: boolean;
  notifications: NotificationItem[];
  loading: boolean;
  onClose: () => void;
}

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({
  open,
  notifications,
  loading,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex max-h-[82%] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#11151E]">
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-[#F4F5F7]">
              Notifications
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="tiya-scroll flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No notifications yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/[0.08] dark:bg-[#090B10]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
