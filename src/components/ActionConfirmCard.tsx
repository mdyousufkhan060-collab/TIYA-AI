import React from 'react';
import { Check, ExternalLink, Package, Phone, MessageSquare, Search, Smartphone, X } from 'lucide-react';
import { ActionStatus, PhoneAction } from '../types/tiya';
import { getConfirmationPromptText } from '../utils/phoneActions';

interface ActionConfirmCardProps {
  action: PhoneAction;
  status: ActionStatus;
  note?: string;
  fallbackUrl?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ActionConfirmCard: React.FC<ActionConfirmCardProps> = ({
  action,
  status,
  note,
  fallbackUrl,
  onConfirm,
  onCancel,
}) => {
  const getIcon = () => {
    switch (action.action) {
      case 'open_app':
        return <Smartphone className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
      case 'call':
      case 'whatsapp_call':
      case 'messenger_call':
        return <Phone className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
      case 'whatsapp_message':
      case 'messenger_message':
        return <MessageSquare className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
      case 'web_search':
        return <Search className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
      case 'close_opened':
        return <X className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
      case 'courier_dispatch':
      case 'parcels_email':
        return <Package className="h-4 w-4 text-teal-500 dark:text-teal-400" />;
    }
  };

  const getTitle = () => {
    switch (action.action) {
      case 'open_app':
        return `Open ${action.app}`;
      case 'call':
        return `Phone Call · ${action.contact}`;
      case 'whatsapp_call':
        return `WhatsApp Call · ${action.contact}`;
      case 'whatsapp_message':
        return `WhatsApp Message · ${action.contact}`;
      case 'messenger_message':
        return `Messenger Message · ${action.contact}`;
      case 'messenger_call':
        return `Messenger Call · ${action.contact}`;
      case 'web_search':
        return `Search ${action.site.toUpperCase()} · ${action.query}`;
      case 'close_opened':
        return 'Close & back to ROSE';
      case 'courier_dispatch':
        return 'Send parcels to courier';
      case 'parcels_email':
        return 'E-mail parcel list';
    }
  };

  const hasText =
    action.action === 'whatsapp_message' || action.action === 'messenger_message';

  return (
    <div
      className="mt-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 dark:border-white/10 dark:bg-[#141923] dark:text-[#F4F5F7]"
      data-testid="phone-action-card"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        {getIcon()}
        <span>{getTitle()}</span>
      </div>

      {hasText && (
        <p className="mt-2 border-y border-slate-100 py-2 text-xs text-slate-700 dark:border-white/[0.06] dark:text-slate-200">
          “{action.text}”
        </p>
      )}

      {status === 'pending' && (
        <>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {getConfirmationPromptText(action)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500 active:scale-[0.98]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Confirm</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10 active:scale-[0.98]"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </>
      )}

      {status !== 'pending' && note && (
        <div className="mt-2 flex flex-col gap-2">
          <p
            className={`text-xs ${
              status === 'failed'
                ? 'text-rose-600 dark:text-rose-400'
                : status === 'cancelled'
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-teal-700 dark:text-teal-300'
            }`}
          >
            {note}
          </p>
          {fallbackUrl && (
            <a
              href={fallbackUrl}
              target={fallbackUrl.startsWith('http') ? '_blank' : undefined}
              rel={fallbackUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-700 dark:text-teal-300"
            >
              <span>Open Link</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
