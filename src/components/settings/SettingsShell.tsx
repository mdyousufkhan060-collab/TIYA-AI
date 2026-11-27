import React from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Code2,
  Crown,
  FileText,
  Gift,
  HelpCircle,
  KeyRound,
  Languages,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogIn,
  Mail,
  MessageSquare,
  Mic,
  Package,
  Percent,
  Plug,
  Quote,
  Receipt,
  ScrollText,
  Server,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  ShoppingBag,
  Eye,
  UserCog,
  MonitorCog,
  Trash2,
  Truck,
  User,
  Users,
  Video,
  Wallet,
  Wrench,
  Flag,
  ClipboardCheck,
  BadgeCheck,
  Youtube,
  Globe,
  AtSign,
  ToggleRight,
} from 'lucide-react';

/** Small logo for each bar, picked from its title (shown next to the number). */
const BAR_ICONS: Array<[RegExp, React.ElementType, string]> = [
  [/^WEBSITE ADMIN$/, MonitorCog, '#14b8a6'],
  [/^MY SHOP$/, ShoppingBag, '#22c55e'],
  [/^CUSTOMER VIEW$/, Eye, '#38bdf8'],
  [/^MY STAFF$/, UserCog, '#a78bfa'],
  [/SUPPORT ID/, BadgeCheck, '#2dd4bf'],
  [/ALERT/, Bell, '#fbbf24'],
  [/ALL STORES|DEMO STORES|NEW STORE/, Store, '#22d3ee'],
  [/^MYROSEBD\.COM$/, Sparkles, '#2dd4bf'],
  [/^ROSE$/, Sparkles, '#f472b6'],
  [/BUSINESS INFO/, BadgeCheck, '#22c55e'],
  [/MY DETAILS/, User, '#c4b5fd'],
  [/SOCIAL/, AtSign, '#f472b6'],
  [/MY STORE/, Store, '#22c55e'],
  [/DOMAIN/, Globe, '#0891b2'],
  [/WHATSAPP|MESSENGER/, MessageSquare, '#22c55e'],
  [/AI KEY|BILLING/, KeyRound, '#fbbf24'],
  [/WEBSITE BUILDER/, Globe, '#22d3ee'],
  [/WEBSITE ACCESS/, AtSign, '#60a5fa'],
  [/SITE SWITCH/, ToggleRight, '#34d399'],
  [/ABOUT|GUIDE|HOW TO/, BookOpen, '#38bdf8'],
  [/HEALTH/, Activity, '#34d399'],
  [/CONNECTION|API PROVIDER/, Plug, '#a78bfa'],
  [/VOICE|MIC|SPEECH/, Mic, '#f472b6'],
  [/LANGUAGE|DIALECT/, Languages, '#60a5fa'],
  [/PERSONALITY|EMOTION/, Sparkles, '#f9a8d4'],
  [/PHONE/, Smartphone, '#22d3ee'],
  [/CHATS|MEMORY|INBOX/, MessageSquare, '#93c5fd'],
  [/PREMIUM|PLANS|PRICE/, Crown, '#fbbf24'],
  [/WORKSPACE/, Briefcase, '#f59e0b'],
  [/REPORT|FEEDBACK/, Flag, '#fb7185'],
  [/IMTIAZ|CHECKLIST|TASK LIST/, ClipboardCheck, '#2dd4bf'],
  [/STORE READINESS|POLICY/, BadgeCheck, '#22c55e'],
  [/TUTORIAL|YOUTUBE/, Youtube, '#ef4444'],
  [/ADMIN GUIDE|GUIDE/, BookOpen, '#38bdf8'],
  [/PRIVACY|SECURITY/, ShieldCheck, '#34d399'],
  [/BUSINESS/, Store, '#f59e0b'],
  [/DEVELOPER TOOLS/, Wrench, '#94a3b8'],
  [/ACCOUNT|PROFILE|DEVELOPER/, User, '#c4b5fd'],
  [/DASHBOARD|OVERVIEW/, LayoutDashboard, '#a78bfa'],
  [/USERS|CUSTOMER|TEAM/, Users, '#60a5fa'],
  [/GIVE PREMIUM|GIFT/, Gift, '#f472b6'],
  [/PAYMENT|INCOME|EXPENSE/, Wallet, '#34d399'],
  [/LOGIN/, LogIn, '#93c5fd'],
  [/NOTIFY|NOTIFICATION/, Bell, '#fbbf24'],
  [/MOTIVATION/, Quote, '#f9a8d4'],
  [/DEVELOPER TOOLS|TOOLS/, Wrench, '#94a3b8'],
  [/LOG|ACTIVITY/, ScrollText, '#94a3b8'],
  [/DELETE/, Trash2, '#fb7185'],
  [/PRODUCT/, Package, '#a78bfa'],
  [/ORDER/, ShoppingCart, '#60a5fa'],
  [/APPROVAL/, ClipboardList, '#fbbf24'],
  [/DISCOUNT/, Percent, '#f472b6'],
  [/FAQ/, HelpCircle, '#38bdf8'],
  [/COURIER|DELIVERY/, Truck, '#fb923c'],
  [/AI REPLY|REPLY/, KeyRound, '#2dd4bf'],
  [/TASK/, ListChecks, '#34d399'],
  [/CONTENT|VIDEO/, Video, '#f472b6'],
  [/WRITER/, FileText, '#e879f9'],
  [/NOTES/, FileText, '#93c5fd'],
  [/ROUTINE/, CalendarDays, '#60a5fa'],
  [/TEST/, BarChart3, '#a78bfa'],
  [/MODE/, Sparkles, '#2dd4bf'],
  [/EMAIL/, Mail, '#93c5fd'],
  [/RECEIPT|INVOICE/, Receipt, '#34d399'],
  [/SERVER|SYSTEM/, Server, '#94a3b8'],
  [/CODE/, Code2, '#94a3b8'],
];

export function barIcon(title: string): React.ReactNode {
  const t = title.toUpperCase();
  const hit = BAR_ICONS.find(([re]) => re.test(t));
  if (!hit) return null;
  const [, Icon, color] = hit;
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-white"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        boxShadow: `0 4px 14px -4px ${color}, inset 0 1px 0 rgba(255,255,255,0.35)`,
      }}
    >
      <Icon className="h-[17px] w-[17px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" strokeWidth={2.2} />
    </span>
  );
}

interface SettingsShellProps {
  title: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export const SettingsShell: React.FC<SettingsShellProps> = ({
  title,
  onBack,
  rightAction,
  children,
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 pt-[env(safe-area-inset-top)] [min-height:calc(3rem+env(safe-area-inset-top))] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          data-testid="settings-back-button"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl px-2 text-teal-600 transition-colors hover:bg-slate-100 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h1 className="font-display truncate px-2 text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-[#F4F5F7]">
          {title}
        </h1>

        <div className="flex min-w-[40px] justify-end pr-1">{rightAction}</div>
      </header>

      <div className="one-layer tiya-scroll flex-1 overflow-y-auto px-3.5 py-3">{children}</div>
    </div>
  );
};

interface SettingsBarProps {
  badge?: string | React.ReactNode;
  title: string;
  value?: string;
  locked?: boolean;
  onClick: () => void;
  testId?: string;
  hideChevron?: boolean;
  tone?: 'default' | 'danger' | 'accent';
  /** a small picture in place of the bar's icon */
  iconSrc?: string;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  badge,
  title,
  value,
  locked = false,
  onClick,
  testId,
  hideChevron = false,
  tone = 'default',
  iconSrc,
}) => {
  const titleColor =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'accent'
        ? 'text-teal-700 dark:text-teal-300'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]"
    >
      {badge !== undefined && (
        <span className="font-mono-code flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md bg-[#1e293b] px-1.5 text-[10px] font-bold text-teal-300 dark:bg-white/[0.07] dark:font-semibold dark:text-teal-400">
          {badge}
        </span>
      )}

      {iconSrc ? <img src={iconSrc} alt="" className="h-8 w-8 shrink-0 rounded-[9px] object-cover" /> : barIcon(title)}

      <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide uppercase ${titleColor}`}>
        {title}
      </span>

      {value && (
        <span className="max-w-[115px] shrink-0 truncate text-[10.5px] font-semibold text-teal-700 dark:font-medium dark:text-slate-500">
          {value}
        </span>
      )}

      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-label="Locked" />
      ) : (
        !hideChevron && (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        )
      )}
    </button>
  );
};

interface SettingsToggleBarProps {
  badge?: string | React.ReactNode;
  title: string;
  value?: string;
  checked: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  testId?: string;
}

export const SettingsToggleBar: React.FC<SettingsToggleBarProps> = ({
  badge,
  title,
  value,
  checked,
  onToggle,
  ariaLabel,
  testId,
}) => {
  return (
    <div className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/[0.08] dark:bg-[#11151E]">
      {badge !== undefined && (
        <span className="font-mono-code flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md bg-[#1e293b] px-1.5 text-[10px] font-bold text-teal-300 dark:bg-white/[0.07] dark:font-semibold dark:text-teal-400">
          {badge}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
        {title}
      </span>

      {value && (
        <span className="max-w-[90px] shrink-0 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {value}
        </span>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || `Toggle ${title}`}
        data-testid={testId}
        onClick={onToggle}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-teal-600' : 'bg-slate-300 dark:bg-white/15'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

interface SettingsSelectBarProps {
  badge?: string;
  title: string;
  /** small grey text on the right, e.g. native language name */
  value?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  testId?: string;
}

/** Same look as SettingsBar, used for "pick one" lists (personality, language...). */
export const SettingsSelectBar: React.FC<SettingsSelectBarProps> = ({
  badge,
  title,
  value,
  selected,
  disabled = false,
  onSelect,
  testId,
}) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    aria-pressed={selected}
    data-testid={testId}
    className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-colors disabled:opacity-40 ${
      selected
        ? 'border-teal-500 bg-teal-500/10'
        : 'border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:hover:bg-white/[0.05] dark:active:bg-white/[0.08]'
    }`}
  >
    {badge !== undefined && (
      <span className="font-mono-code flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md bg-[#1e293b] px-1.5 text-[10px] font-bold text-teal-300 dark:bg-white/[0.07] dark:font-semibold dark:text-teal-400">
        {badge}
      </span>
    )}
    <span
      className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide uppercase ${
        selected ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-slate-100'
      }`}
    >
      {title}
    </span>
    {value && (
      <span className="max-w-[115px] shrink-0 truncate text-[10.5px] font-semibold text-teal-700 dark:font-medium dark:text-slate-500">
        {value}
      </span>
    )}
    {disabled ? (
      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-label="Locked" />
    ) : selected ? (
      <Check className="h-4 w-4 shrink-0 text-teal-500 dark:text-teal-400" />
    ) : (
      <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300 dark:border-white/20" aria-hidden="true" />
    )}
  </button>
);
