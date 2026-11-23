import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SettingsBar, SettingsSelectBar, SettingsShell } from '../settings/SettingsShell';
import { CrudConfig, CrudSection, CrudField, SingleRowForm } from './CrudSection';
import { refreshModeContext } from '../../utils/modeContext';
import { WriterPanel } from '../desktop/WriterPanel';

type Mode = 'personal' | 'student' | 'business';

interface WorkspacePageProps {
  userId: string;
  mode: Mode | null;
  isMinor: boolean;
  onBack: () => void;
  /** reload the profile after the mode changes */
  onModeChanged: () => void;
}

// ---------- Personal / Student tables ----------
const TASKS: CrudConfig = {
  table: 'user_tasks',
  title: 'TASKS & REMINDERS',
  titleKey: 'title',
  subKey: 'due_at',
  badgeKey: 'done',
  orderBy: { column: 'created_at', ascending: false },
  emptyText: 'No tasks yet. Tap ADD NEW, or tell ROSE "remind me…".',
  fields: [
    { key: 'title', label: 'TASK', type: 'text', required: true, placeholder: 'e.g. Pay electricity bill' },
    { key: 'notes', label: 'NOTES', type: 'textarea' },
    { key: 'due_at', label: 'DUE', type: 'datetime' },
    { key: 'remind_at', label: 'REMIND AT', type: 'datetime' },
    { key: 'done', label: 'DONE', type: 'bool', defaultValue: false },
  ],
};

const CONTENT: CrudConfig = {
  table: 'content_items',
  title: 'CONTENT STUDIO',
  titleKey: 'title',
  subKey: 'hashtags',
  badgeKey: 'platform',
  emptyText: 'Save video titles, captions, hashtags and scripts here. Ask ROSE in chat to write them.',
  fields: [
    {
      key: 'platform',
      label: 'PLATFORM',
      type: 'select',
      options: ['youtube', 'facebook', 'tiktok', 'instagram', 'other'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
    { key: 'title', label: 'TITLE', type: 'text', required: true },
    { key: 'caption', label: 'CAPTION', type: 'textarea' },
    { key: 'description', label: 'DESCRIPTION', type: 'textarea' },
    { key: 'hashtags', label: 'HASHTAGS', type: 'text', placeholder: '#tiya #ai' },
    { key: 'script', label: 'SCRIPT', type: 'textarea' },
    {
      key: 'status',
      label: 'STATUS',
      type: 'select',
      defaultValue: 'draft',
      options: ['draft', 'ready', 'published'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
  ],
};

const NOTES: CrudConfig = {
  table: 'study_notes',
  title: 'NOTES',
  titleKey: 'title',
  subKey: 'subject',
  badgeKey: 'chapter',
  emptyText: 'No notes yet. Ask ROSE to summarise a chapter, then save it here.',
  fields: [
    { key: 'subject', label: 'SUBJECT', type: 'text', placeholder: 'e.g. Physics' },
    { key: 'chapter', label: 'CHAPTER', type: 'text' },
    { key: 'title', label: 'TITLE', type: 'text', required: true },
    { key: 'content', label: 'NOTE', type: 'textarea' },
  ],
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROUTINE: CrudConfig = {
  table: 'study_routines',
  title: 'STUDY ROUTINE',
  titleKey: 'subject',
  subKey: 'start_time',
  badgeKey: 'day_of_week',
  orderBy: { column: 'day_of_week', ascending: true },
  emptyText: 'Build your weekly study routine.',
  fields: [
    { key: 'day_of_week', label: 'DAY', type: 'select', required: true, options: DAYS.map((d, i) => ({ value: String(i), label: d })) },
    { key: 'subject', label: 'SUBJECT', type: 'text', required: true },
    { key: 'start_time', label: 'START', type: 'time' },
    { key: 'end_time', label: 'END', type: 'time' },
    { key: 'note', label: 'NOTE', type: 'text' },
  ],
};

const TESTS: CrudConfig = {
  table: 'practice_tests',
  title: 'PRACTICE TESTS',
  titleKey: 'title',
  subKey: 'subject',
  badgeKey: 'score',
  emptyText: 'Keep your MCQ / test scores here. Ask ROSE "give me 10 MCQ on …" in chat.',
  fields: [
    { key: 'subject', label: 'SUBJECT', type: 'text' },
    { key: 'title', label: 'TEST NAME', type: 'text', required: true },
    { key: 'score', label: 'SCORE', type: 'number' },
    { key: 'total', label: 'OUT OF', type: 'number' },
  ],
};

// ---------- Business tables ----------
const BUSINESS_FIELDS: CrudField[] = [
  { key: 'name', label: 'BUSINESS NAME', type: 'text', required: true },
  { key: 'category', label: 'CATEGORY', type: 'text', placeholder: 'e.g. Clothing shop' },
  { key: 'description', label: 'DESCRIPTION', type: 'textarea' },
  { key: 'owner_name', label: 'OWNER FULL NAME', type: 'text', required: true },
  { key: 'owner_email', label: 'OWNER EMAIL (GMAIL)', type: 'text', required: true },
  { key: 'phone', label: 'MOBILE NUMBER', type: 'text', required: true },
  { key: 'whatsapp', label: 'WHATSAPP NUMBER', type: 'text' },
  { key: 'address', label: 'FULL ADDRESS', type: 'textarea' },
  { key: 'city', label: 'CITY / DISTRICT', type: 'text' },
  { key: 'postcode', label: 'POST CODE', type: 'text' },
  { key: 'emergency_phone', label: 'EMERGENCY PHONE (WE CALL THIS IF NEEDED)', type: 'text' },
  { key: 'notify_email', label: 'REPORT EMAIL (GMAIL FOR TEAM REPORTS)', type: 'text' },
  { key: 'email_reports', label: 'EMAIL ME TEAM REPORTS', type: 'bool', defaultValue: true },
  { key: 'website', label: 'WEBSITE', type: 'text' },
  { key: 'facebook_page', label: 'FACEBOOK PAGE', type: 'text' },
  { key: 'instagram', label: 'INSTAGRAM', type: 'text' },
  { key: 'delivery_info', label: 'DELIVERY INFORMATION', type: 'textarea' },
  { key: 'payment_methods', label: 'PAYMENT METHODS', type: 'text', placeholder: 'bKash, Nagad, Cash on delivery' },
  { key: 'return_policy', label: 'RETURN & REFUND POLICY', type: 'textarea' },
  { key: 'support_info', label: 'CUSTOMER SUPPORT INFO', type: 'textarea' },
  { key: 'business_rules', label: 'BUSINESS RULES', type: 'textarea' },
  { key: 'communication_style', label: 'REPLY STYLE WITH CUSTOMERS', type: 'text', placeholder: 'Polite, short, Bangla' },
  { key: 'logo_url', label: 'LOGO LINK', type: 'text' },
];

const AI_FIELDS: CrudField[] = [
  { key: 'auto_reply', label: 'AI AUTO REPLY', type: 'bool', defaultValue: false },
  { key: 'whatsapp_auto', label: 'WHATSAPP AUTO REPLY', type: 'bool', defaultValue: false },
  { key: 'messenger_auto', label: 'MESSENGER AUTO REPLY', type: 'bool', defaultValue: false },
  { key: 'email_auto', label: 'EMAIL AUTO REPLY', type: 'bool', defaultValue: false },
  { key: 'business_hours_only', label: 'REPLY ONLY IN BUSINESS HOURS', type: 'bool', defaultValue: false },
  { key: 'welcome_message', label: 'WELCOME MESSAGE', type: 'textarea' },
  { key: 'away_message', label: 'AWAY MESSAGE', type: 'textarea' },
  { key: 'max_discount_percent', label: 'MAX DISCOUNT %', type: 'number', defaultValue: 0 },
  { key: 'discount_needs_approval', label: 'DISCOUNT NEEDS MY APPROVAL', type: 'bool', defaultValue: true },
  { key: 'ai_can_confirm_orders', label: 'AI CAN CONFIRM ORDERS', type: 'bool', defaultValue: false },
  { key: 'human_handover', label: 'HAND OVER TO ME WHEN NEEDED', type: 'bool', defaultValue: true },
  { key: 'restricted_topics', label: 'TOPICS AI MUST NOT DISCUSS', type: 'textarea' },
  { key: 'reply_style', label: 'CUSTOM REPLY STYLE', type: 'text' },
];

export const PRODUCTS: CrudConfig = {
  table: 'business_products',
  title: 'PRODUCTS & SERVICES',
  titleKey: 'name',
  subKey: 'category',
  badgeKey: 'price',
  orderBy: { column: 'name', ascending: true },
  emptyText: 'Add your products. ROSE uses these prices to answer customers.',
  fields: [
    { key: 'name', label: 'NAME', type: 'text', required: true },
    { key: 'kind', label: 'TYPE', type: 'select', defaultValue: 'product', options: [{ value: 'product', label: 'PRODUCT' }, { value: 'service', label: 'SERVICE' }] },
    { key: 'category', label: 'CATEGORY', type: 'text' },
    { key: 'price', label: 'PRICE (TK)', type: 'number', required: true, defaultValue: 0 },
    { key: 'stock', label: 'STOCK', type: 'number' },
    { key: 'low_stock_alert', label: 'LOW STOCK ALERT AT', type: 'number', defaultValue: 5 },
    { key: 'description', label: 'DESCRIPTION', type: 'textarea' },
    { key: 'image_url', label: 'IMAGE LINK', type: 'text' },
    { key: 'discount_allowed', label: 'DISCOUNT ALLOWED', type: 'bool', defaultValue: true },
    { key: 'is_active', label: 'ACTIVE (SHOW TO CUSTOMERS)', type: 'bool', defaultValue: true },
  ],
};

export const CUSTOMERS: CrudConfig = {
  table: 'business_customers',
  title: 'CUSTOMERS',
  titleKey: 'name',
  subKey: 'phone',
  badgeKey: 'segment',
  emptyText: 'No customers yet.',
  fields: [
    { key: 'name', label: 'NAME', type: 'text', required: true },
    { key: 'phone', label: 'PHONE', type: 'text' },
    { key: 'email', label: 'EMAIL', type: 'text' },
    { key: 'address', label: 'ADDRESS', type: 'textarea' },
    { key: 'segment', label: 'GROUP', type: 'select', options: ['new', 'regular', 'vip'].map((v) => ({ value: v, label: v.toUpperCase() })) },
    { key: 'preferences', label: 'PREFERENCES', type: 'text' },
    { key: 'follow_up_at', label: 'FOLLOW UP', type: 'datetime' },
    { key: 'notes', label: 'NOTES', type: 'textarea' },
  ],
};

export const COURIER_OPTS = [
  { value: 'pathao', label: 'PATHAO' },
  { value: 'steadfast', label: 'STEADFAST' },
  { value: 'redx', label: 'REDX' },
  { value: 'paperfly', label: 'PAPERFLY' },
  { value: 'sundarban', label: 'SUNDARBAN' },
  { value: 'ecourier', label: 'ECOURIER' },
  { value: 'sa_paribahan', label: 'SA PARIBAHAN' },
  { value: 'own', label: 'OWN DELIVERY' },
];

const COURIERS: CrudConfig = {
  table: 'business_couriers',
  title: 'COURIERS',
  titleKey: 'courier',
  subKey: 'account_name',
  badgeKey: 'is_default',
  orderBy: { column: 'created_at', ascending: true },
  emptyText: 'Add the couriers you use. When you APPROVE an order it is marked ready for your default courier.',
  fields: [
    { key: 'courier', label: 'COURIER', type: 'select', required: true, options: COURIER_OPTS },
    { key: 'account_name', label: 'MERCHANT / SHOP NAME', type: 'text' },
    { key: 'merchant_id', label: 'MERCHANT ID', type: 'text' },
    { key: 'pickup_address', label: 'PICKUP ADDRESS', type: 'textarea' },
    { key: 'pickup_phone', label: 'PICKUP PHONE', type: 'text' },
    { key: 'is_default', label: 'DEFAULT COURIER', type: 'bool', defaultValue: false },
  ],
};

const STATUS_OPTS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((v) => ({ value: v, label: v.toUpperCase() }));
export const ORDERS: CrudConfig = {
  table: 'business_orders',
  title: 'ORDERS',
  titleKey: 'note',
  subKey: 'created_at',
  badgeKey: 'status',
  emptyText: 'No orders yet.',
  fields: [
    { key: 'customer_id', label: 'CUSTOMER', type: 'ref', refTable: 'business_customers', refLabel: 'name' },
    { key: 'note', label: 'ITEMS / DETAILS', type: 'textarea', required: true, placeholder: '2 x T-shirt (L), 1 x Cap' },
    { key: 'subtotal', label: 'SUBTOTAL (TK)', type: 'number', defaultValue: 0 },
    { key: 'discount', label: 'DISCOUNT (TK)', type: 'number', defaultValue: 0 },
    { key: 'total', label: 'TOTAL (TK)', type: 'number', required: true },
    { key: 'status', label: 'STATUS', type: 'select', defaultValue: 'pending', options: STATUS_OPTS },
    {
      key: 'payment_status',
      label: 'PAYMENT',
      type: 'select',
      defaultValue: 'unpaid',
      options: ['unpaid', 'paid', 'refunded'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
    { key: 'delivery_address', label: 'DELIVERY ADDRESS', type: 'textarea' },
    { key: 'courier', label: 'COURIER', type: 'select', options: COURIER_OPTS },
    {
      key: 'courier_status',
      label: 'COURIER STATUS',
      type: 'select',
      defaultValue: 'not_sent',
      options: ['not_sent', 'ready', 'booked', 'picked', 'delivered', 'returned'].map((v) => ({ value: v, label: v.replace('_', ' ').toUpperCase() })),
    },
    { key: 'tracking_code', label: 'TRACKING CODE', type: 'text' },
    {
      key: 'source',
      label: 'SOURCE',
      type: 'select',
      options: ['whatsapp', 'messenger', 'facebook', 'phone', 'shop', 'website', 'other'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
  ],
};

export const EXPENSES: CrudConfig = {
  table: 'business_expenses',
  title: 'EXPENSES',
  titleKey: 'title',
  subKey: 'spent_on',
  badgeKey: 'amount',
  orderBy: { column: 'spent_on', ascending: false },
  fields: [
    { key: 'title', label: 'EXPENSE', type: 'text', required: true },
    { key: 'amount', label: 'AMOUNT (TK)', type: 'number', required: true, defaultValue: 0 },
    { key: 'category', label: 'CATEGORY', type: 'text' },
    { key: 'spent_on', label: 'DATE', type: 'date' },
  ],
};

const FAQS: CrudConfig = {
  table: 'business_faqs',
  title: 'FAQ',
  titleKey: 'question',
  subKey: 'answer',
  orderBy: { column: 'sort', ascending: true },
  emptyText: 'Add common customer questions. ROSE answers from these.',
  fields: [
    { key: 'question', label: 'QUESTION', type: 'text', required: true },
    { key: 'answer', label: 'ANSWER', type: 'textarea', required: true },
    { key: 'sort', label: 'ORDER', type: 'number', defaultValue: 0 },
  ],
};

const DISCOUNTS: CrudConfig = {
  table: 'business_discount_rules',
  title: 'DISCOUNT RULES',
  titleKey: 'title',
  subKey: 'expires_at',
  badgeKey: 'percent',
  fields: [
    { key: 'title', label: 'OFFER NAME', type: 'text', required: true },
    { key: 'percent', label: 'DISCOUNT %', type: 'number', required: true },
    { key: 'product_id', label: 'ONLY FOR PRODUCT (OPTIONAL)', type: 'ref', refTable: 'business_products', refLabel: 'name' },
    { key: 'customer_id', label: 'ONLY FOR CUSTOMER (OPTIONAL)', type: 'ref', refTable: 'business_customers', refLabel: 'name' },
    { key: 'min_order', label: 'MINIMUM ORDER (TK)', type: 'number' },
    { key: 'needs_approval', label: 'NEEDS MY APPROVAL', type: 'bool', defaultValue: false },
    { key: 'starts_at', label: 'STARTS', type: 'datetime' },
    { key: 'expires_at', label: 'EXPIRES', type: 'datetime' },
    { key: 'is_active', label: 'ACTIVE', type: 'bool', defaultValue: true },
  ],
};

const APPROVALS: CrudConfig = {
  table: 'business_approvals',
  title: 'APPROVAL REQUESTS',
  titleKey: 'message',
  subKey: 'created_at',
  badgeKey: 'status',
  emptyText: 'No requests. When a customer asks for more discount than allowed, it shows here.',
  fields: [
    {
      key: 'kind',
      label: 'TYPE',
      type: 'select',
      required: true,
      options: ['discount', 'refund', 'cancel', 'other'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
    { key: 'customer_id', label: 'CUSTOMER', type: 'ref', refTable: 'business_customers', refLabel: 'name' },
    { key: 'order_id', label: 'ORDER (APPROVE = CONFIRM + COURIER, REJECT = CANCEL)', type: 'ref', refTable: 'business_orders', refLabel: 'note' },
    { key: 'requested_percent', label: 'REQUESTED DISCOUNT %', type: 'number' },
    { key: 'requested_amount', label: 'REQUESTED AMOUNT (TK)', type: 'number' },
    { key: 'message', label: 'DETAILS', type: 'textarea', required: true },
    {
      key: 'status',
      label: 'DECISION',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { value: 'pending', label: 'PENDING' },
        { value: 'approved', label: 'APPROVE' },
        { value: 'rejected', label: 'REJECT' },
      ],
    },
  ],
};

type View =
  | 'hub'
  | 'mode'
  | 'tasks'
  | 'content'
  | 'notes'
  | 'routine'
  | 'tests'
  | 'biz_profile'
  | 'biz_ai'
  | 'biz_dashboard'
  | 'products'
  | 'customers'
  | 'orders'
  | 'expenses'
  | 'faqs'
  | 'discounts'
  | 'approvals'
  | 'couriers'
  | 'writer';

const TITLES: Record<View, string> = {
  hub: 'WORKSPACE',
  mode: 'MODE',
  writer: 'WRITER',
  tasks: TASKS.title,
  content: CONTENT.title,
  notes: NOTES.title,
  routine: ROUTINE.title,
  tests: TESTS.title,
  biz_profile: 'BUSINESS PROFILE',
  biz_ai: 'AI REPLY CONTROL',
  biz_dashboard: 'DASHBOARD',
  products: PRODUCTS.title,
  customers: CUSTOMERS.title,
  orders: ORDERS.title,
  expenses: EXPENSES.title,
  faqs: FAQS.title,
  discounts: DISCOUNTS.title,
  approvals: APPROVALS.title,
  couriers: COURIERS.title,
};

const BusinessDashboard: React.FC = () => {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    void supabase.rpc('business_dashboard').then(({ data }) => setD(data || { ok: false }));
  }, []);
  if (!d)
    return (
      <div className="flex items-center justify-center py-10 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  if (!d.ok) return <p className="py-10 text-center text-xs text-slate-400">Set up your Business Profile first.</p>;
  const tk = (n: number) => `৳${Number(n || 0).toLocaleString('en-IN')}`;
  const tiles: Array<[string, string | number, boolean?]> = [
    ['SALES TODAY', tk(d.sales_today), true],
    ['SALES 7 DAYS', tk(d.sales_week)],
    ['SALES 30 DAYS', tk(d.sales_month), true],
    ['EXPENSES 30 DAYS', tk(d.expense_month)],
    ['PROFIT 30 DAYS', tk(Number(d.sales_month) - Number(d.expense_month)), true],
    ['TOTAL ORDERS', d.orders_total],
    ['PENDING ORDERS', d.orders_pending],
    ['DELIVERED', d.orders_done],
    ['CANCELLED', d.orders_cancelled],
    ['CUSTOMERS', d.customers],
    ['LOW STOCK ITEMS', d.low_stock],
    ['WAITING APPROVAL', d.approvals_pending],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map(([l, v, hi]) => (
        <div key={l} className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
          <p className="text-[9.5px] font-semibold tracking-wider text-slate-400">{l}</p>
          <p className={`mt-1 font-mono text-lg font-bold ${hi ? 'text-teal-300' : 'text-white'}`}>{v}</p>
        </div>
      ))}
    </div>
  );
};

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ userId, mode, isMinor, onBack, onModeChanged }) => {
  const [view, setView] = useState<View>('hub');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [bizLoaded, setBizLoaded] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [modeMsg, setModeMsg] = useState('');

  const loadBusiness = useCallback(async () => {
    if (mode !== 'business') return;
    const { data } = await supabase.from('businesses').select('id').eq('owner_id', userId).maybeSingle();
    setBusinessId(data?.id ?? null);
    setBizLoaded(true);
  }, [mode, userId]);

  useEffect(() => {
    void loadBusiness();
  }, [loadBusiness]);

  const refreshAi = () => void refreshModeContext(mode, userId);

  const changeMode = async (m: Mode) => {
    if (m === mode) return;
    setModeBusy(true);
    setModeMsg('');
    const { data, error } = await supabase.rpc('set_account_mode', { p_mode: m, p_dob: null });
    setModeBusy(false);
    if (error) return setModeMsg(error.message);
    if (data && data.ok === false) return setModeMsg(data.error || 'Not allowed.');
    onModeChanged();
    setView('hub');
  };

  const back = () => (view === 'hub' ? onBack() : setView('hub'));
  const uScope = { user_id: userId };
  const bScope = businessId ? { business_id: businessId } : null;
  const modeLabel = mode ? mode.toUpperCase() : 'NOT SET';

  const bar = (n: string, v: View, extra?: string) => (
    <SettingsBar key={v} badge={n} title={TITLES[v]} value={extra} onClick={() => setView(v)} testId={`ws-${v}`} />
  );

  let body: React.ReactNode = null;
  if (view === 'hub') {
    const personal = [bar('01', 'tasks'), bar('02', 'content'), bar('03', 'writer')];
    const student = [bar('01', 'notes'), bar('02', 'routine'), bar('03', 'tests'), bar('04', 'tasks'), bar('05', 'writer')];
    const business = [
      bar('01', 'biz_profile', businessId ? 'READY' : 'SET UP'),
      ...(businessId
        ? [
            bar('02', 'biz_dashboard'),
            bar('03', 'products'),
            bar('04', 'orders'),
            bar('05', 'customers'),
            bar('06', 'approvals'),
            bar('07', 'discounts'),
            bar('08', 'faqs'),
            bar('09', 'expenses'),
            bar('10', 'couriers'),
            bar('11', 'biz_ai'),
            bar('12', 'writer'),
          ]
        : []),
    ];
    body = (
      <div className="space-y-3">
        <SettingsBar badge="M" title="MODE" value={modeLabel} tone="accent" onClick={() => setView('mode')} testId="ws-mode" />
        <div className="space-y-1.5">
          {mode === 'business' && !bizLoaded ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : mode === 'business' ? (
            business
          ) : mode === 'student' ? (
            student
          ) : (
            personal
          )}
        </div>
        {mode === 'business' && !businessId && bizLoaded && (
          <p className="px-1 text-[11px] text-slate-400">Fill in your Business Profile first. Then products, orders and the dashboard appear here.</p>
        )}
      </div>
    );
  } else if (view === 'mode') {
    body = (
      <div className="space-y-1.5">
        {(['personal', 'student', 'business'] as Mode[]).map((m, i) => (
          <SettingsSelectBar
            key={m}
            badge={String(i + 1).padStart(2, '0')}
            title={m.toUpperCase()}
            value={m === 'business' && isMinor ? '18+ ONLY' : undefined}
            selected={mode === m}
            disabled={modeBusy || (m === 'business' && isMinor)}
            onSelect={() => void changeMode(m)}
            testId={`ws-mode-${m}`}
          />
        ))}
        {modeBusy && <p className="pt-2 text-center text-xs text-slate-400">Saving...</p>}
        {modeMsg && <p className="pt-2 text-xs text-rose-300">{modeMsg}</p>}
      </div>
    );
  } else if (view === 'writer') body = <div className="h-[calc(100dvh-140px)]"><WriterPanel /></div>;
  else if (view === 'tasks') body = <CrudSection config={TASKS} scope={uScope} />;
  else if (view === 'content') body = <CrudSection config={CONTENT} scope={uScope} />;
  else if (view === 'notes') body = <CrudSection config={NOTES} scope={uScope} />;
  else if (view === 'routine') body = <CrudSection config={ROUTINE} scope={uScope} />;
  else if (view === 'tests') body = <CrudSection config={TESTS} scope={uScope} />;
  else if (view === 'biz_profile')
    body = (
      <SingleRowForm
        table="businesses"
        match={{ owner_id: userId }}
        fields={BUSINESS_FIELDS}
        onSaved={(row) => {
          if (row?.id) setBusinessId(row.id);
          refreshAi();
        }}
      />
    );
  else if (view === 'biz_dashboard') body = <BusinessDashboard />;
  else if (bScope) {
    if (view === 'biz_ai')
      body = <SingleRowForm table="business_ai_settings" match={bScope} fields={AI_FIELDS} onSaved={refreshAi} />;
    else if (view === 'products') body = <CrudSection config={PRODUCTS} scope={bScope} onChanged={refreshAi} />;
    else if (view === 'customers') body = <CrudSection config={CUSTOMERS} scope={bScope} />;
    else if (view === 'orders') body = <CrudSection config={ORDERS} scope={bScope} />;
    else if (view === 'expenses') body = <CrudSection config={EXPENSES} scope={bScope} />;
    else if (view === 'faqs') body = <CrudSection config={FAQS} scope={bScope} onChanged={refreshAi} />;
    else if (view === 'discounts') body = <CrudSection config={DISCOUNTS} scope={bScope} />;
    else if (view === 'approvals') body = <CrudSection config={APPROVALS} scope={bScope} />;
    else if (view === 'couriers') body = <CrudSection config={COURIERS} scope={bScope} />;
  }

  return (
    <SettingsShell title={view === 'hub' ? '07 WORKSPACE' : TITLES[view]} onBack={back}>
      <div className="pb-4">{body}</div>
    </SettingsShell>
  );
};
