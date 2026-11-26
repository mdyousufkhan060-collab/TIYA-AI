import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { ChannelConnect, CourierConnect } from './BusinessConnect';
import { supabase } from '../../lib/supabase';
import { SettingsBar, SettingsSelectBar, SettingsShell } from '../settings/SettingsShell';
import { CrudConfig, CrudSection, CrudField, SingleRowForm } from './CrudSection';
import { refreshModeContext } from '../../utils/modeContext';
import { WriterPanel } from '../desktop/WriterPanel';
import { CustomerCheck } from './CustomerCheck';
import { TutorialStrip } from '../TutorialVideos';
import { SocialPostPanel } from './SocialPostPanel';
import { SiteProfile, StorePanel } from './StorePanel';
import { AdminBrandPage, RoseSupportCard } from '../admin/AdminBrandPage';
import { DomainAccess } from './DomainAccess';

type Mode = 'personal' | 'student' | 'business';

interface WorkspacePageProps {
  userId: string;
  mode: Mode | null;
  isMinor: boolean;
  onBack: () => void;
  /** reload the profile after the mode changes */
  onModeChanged: () => void;
  /** open a section directly (ROSE voice/chat navigation), e.g. "products" */
  subpage?: string | null;
  /** admin: every Personal, Student and Business section at once */
  allModes?: boolean;
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
  { key: 'parcel_ask_on', label: 'ROSE ASKS DAILY TO SEND PARCELS', type: 'bool', defaultValue: true },
  {
    key: 'parcel_ask_time',
    label: 'PARCEL ASK TIME',
    type: 'select',
    defaultValue: '16:00',
    options: Array.from({ length: 15 }, (_, i) => {
      const h = i + 8;
      return { value: `${String(h).padStart(2, '0')}:00`, label: `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}` };
    }),
  },
  { key: 'parcel_email', label: 'E-MAIL ME THE PARCEL LIST AFTER SENDING', type: 'bool', defaultValue: true },
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
    {
      key: 'payment_mode',
      label: 'PAYMENT MODE',
      type: 'select',
      defaultValue: 'cod',
      options: [
        { value: 'cod', label: 'CASH ON DELIVERY' },
        { value: 'advance', label: 'ADVANCE REQUIRED' },
        { value: 'paid', label: 'FULLY PAID' },
      ],
    },
    { key: 'advance_amount', label: 'ADVANCE (TK)', type: 'number', defaultValue: 0 },
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
  | 'rose_hub'
  | 'rose_support'
  | 'viewas'
  | 'profile'
  | 'social'
  | 'store'
  | 'domain'
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
  | 'channels'
  | 'writer'
  | 'customer_check'
  | 'biz_guide'
  | 'grp_rose'
  | 'grp_biz';

const TITLES: Record<View, string> = {
  hub: 'WORKSPACE',
  rose_hub: 'MYROSEBD.COM BUSINESS',
  rose_support: 'MYROSEBD.COM',
  viewas: 'MY STAFF',
  profile: 'MY DETAILS',
  mode: 'MODE',
  writer: 'WRITER',
  social: 'SOCIAL POST',
  store: 'MY STORE',
  domain: 'MY DOMAIN',
  customer_check: 'CUSTOMER CHECK',
  biz_guide: 'START HERE · GUIDE',
  grp_rose: 'ROSE',
  grp_biz: 'BUSINESS',
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
  channels: 'WHATSAPP · MESSENGER · WEBSITE CHAT',
};

/** Quick numbers on top of the business hub. */
const BusinessGlance: React.FC<{ onOpen: (v: View) => void }> = ({ onOpen }) => {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    void supabase.rpc('business_dashboard').then(({ data }) => setD(data || null));
  }, []);
  if (!d?.ok) return null;
  const tk = (n: number) => `৳${Number(n || 0).toLocaleString('en-IN')}`;
  const cells: Array<[string, string | number, View, boolean]> = [
    ['SALES TODAY', tk(d.sales_today), 'biz_dashboard', false],
    ['PENDING ORDERS', d.orders_pending ?? 0, 'orders', Number(d.orders_pending) > 0],
    ['WAITING APPROVAL', d.approvals_pending ?? 0, 'approvals', Number(d.approvals_pending) > 0],
    ['LOW STOCK', d.low_stock ?? 0, 'products', Number(d.low_stock) > 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {cells.map(([l, v, to, warn]) => (
        <button
          key={l}
          type="button"
          onClick={() => onOpen(to)}
          className={`rounded-[4px] border px-3 py-2 text-left ${warn ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/[0.08] bg-[#11151E]'}`}
        >
          <p className="text-[9px] font-bold tracking-wider text-slate-400">{l}</p>
          <p className={`font-mono text-base font-bold ${warn ? 'text-amber-300' : 'text-white'}`}>{v}</p>
        </button>
      ))}
    </div>
  );
};

/** START HERE: what to add, in what order, and what is already done. */
const BusinessGuide: React.FC<{ businessId: string | null; onOpen: (v: View) => void }> = ({ businessId, onOpen }) => {
  const [c, setC] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!businessId) {
      setC({});
      return;
    }
    const count = (t: string) =>
      supabase.from(t).select('id', { count: 'exact', head: true }).eq('business_id', businessId).then(({ count: n }) => n || 0);
    void Promise.all([
      count('business_products'),
      count('business_faqs'),
      count('business_couriers'),
      count('business_discount_rules'),
      count('business_ai_settings'),
      count('business_orders'),
      count('business_customers'),
    ]).then(([products, faqs, couriers, discounts, ai, orders, customers]) =>
      setC({ products, faqs, couriers, discounts, ai, orders, customers }),
    );
  }, [businessId]);

  if (!c)
    return (
      <div className="flex items-center justify-center py-10 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );

  const steps: Array<[View, string, string, boolean, string]> = [
    ['biz_profile', 'BUSINESS PROFILE', 'Shop name, owner, mobile, Gmail, address, payment numbers.', Boolean(businessId), businessId ? 'DONE' : 'START'],
    ['products', 'PRODUCTS & PRICES', 'Every item with price and stock. ROSE answers prices from here.', (c.products || 0) > 0, `${c.products || 0}`],
    ['faqs', 'CUSTOMER FAQ', 'Delivery time, charge, return policy. ROSE replies to customers from here.', (c.faqs || 0) > 0, `${c.faqs || 0}`],
    ['couriers', 'COURIERS', 'Steadfast, Pathao, RedX... with charge inside / outside Dhaka.', (c.couriers || 0) > 0, `${c.couriers || 0}`],
    ['discounts', 'DISCOUNT RULES', 'How much discount ROSE may give, and when to ask you first.', (c.discounts || 0) > 0, `${c.discounts || 0}`],
    ['biz_ai', 'ROSE AI REPLY CONTROL', 'Tone, language, what ROSE may and may not say.', (c.ai || 0) > 0, (c.ai || 0) > 0 ? 'DONE' : 'SET'],
  ];
  const done = steps.filter((s) => s[3]).length;
  const pct = Math.round((done / steps.length) * 100);

  const daily: Array<[View, string, string]> = [
    ['orders', 'ORDERS', 'Add each order, payment (COD / advance), courier and tracking.'],
    ['customers', 'CUSTOMERS', 'Name, phone, address. Saved once, used every time.'],
    ['customer_check', 'CUSTOMER CHECK', 'Type a phone number: see courier history before sending.'],
    ['approvals', 'APPROVALS', 'Discounts or big orders ROSE asked you to approve.'],
    ['expenses', 'EXPENSES', 'Rent, ads, packaging. Profit is worked out for you.'],
    ['biz_dashboard', 'DASHBOARD', 'Sales today, 7 and 30 days, profit, low stock.'],
    ['writer', 'WRITER', 'Posts, captions, invoices, messages. Copy, download or send.'],
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-[4px] border border-teal-500/40 bg-teal-500/[0.07] p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold tracking-wider text-teal-200">SETUP {done}/{steps.length}</p>
          <p className="font-mono text-sm font-bold text-teal-300">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 w-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[10.5px] text-slate-300">Finish these once. After that ROSE can answer your customers and help with orders.</p>
      </div>

      <p className="px-1 text-[10px] font-bold tracking-wider text-slate-400">STEP BY STEP</p>
      <div className="space-y-1.5">
        {steps.map(([v, t, d, ok, val], i) => (
          <button
            key={v}
            type="button"
            disabled={!businessId && v !== 'biz_profile'}
            onClick={() => onOpen(v)}
            className="flex w-full items-start gap-2.5 rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2.5 text-left disabled:opacity-40"
          >
            {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold text-white">{String(i + 1).padStart(2, '0')} · {t}</span>
              <span className="block text-[10.5px] leading-snug text-slate-400">{d}</span>
            </span>
            <span className={`shrink-0 font-mono text-[10px] font-bold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{val}</span>
          </button>
        ))}
      </div>

      <p className="px-1 pt-1 text-[10px] font-bold tracking-wider text-slate-400">EVERY DAY</p>
      <div className="space-y-1.5">
        {daily.map(([v, t, d]) => (
          <button
            key={v}
            type="button"
            disabled={!businessId}
            onClick={() => onOpen(v)}
            className="w-full rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2 text-left disabled:opacity-40"
          >
            <span className="block text-[11.5px] font-bold text-white">{t}</span>
            <span className="block text-[10.5px] text-slate-400">{d}</span>
          </button>
        ))}
      </div>

      <div className="rounded-[4px] border border-fuchsia-400/30 bg-fuchsia-500/[0.06] p-3 text-[10.5px] leading-relaxed text-slate-300">
        <p className="mb-1 text-[11px] font-extrabold tracking-wider text-fuchsia-200">TALK TO ROSE</p>
        "আজকে কত বিক্রি হলো?" · "কোন প্রোডাক্টের স্টক কম?" · "এই নম্বরের কাস্টমারের কুরিয়ার হিস্ট্রি দেখো" · "নতুন পোস্টের ক্যাপশন লেখো"
        <p className="mt-1 text-slate-400">Totals so far: {c.orders || 0} orders · {c.customers || 0} customers.</p>
      </div>
    </div>
  );
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

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ userId, mode, isMinor, onBack, onModeChanged, subpage = null, allModes = false }) => {
  const [view, setView] = useState<View>('hub');
  useEffect(() => {
    if (subpage && subpage in TITLES) setView(subpage as View);
  }, [subpage]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [bizLoaded, setBizLoaded] = useState(false);
  const [bizInfo, setBizInfo] = useState<{ name: string | null; pay: string | null } | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  const [modeMsg, setModeMsg] = useState('');
  // Website owners and their staff: the workspace opens with two bars, WEBSITE ADMIN and ROSE
  const [siteOwner, setSiteOwner] = useState(false);
  const [me, setMe] = useState<{ email: string; pic: string }>({ email: '', pic: '' });
  const [roseCard, setRoseCard] = useState(true);
  const [shopUrl, setShopUrl] = useState('');
  const [supportId, setSupportId] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [staffCount, setStaffCount] = useState(0);
  useEffect(() => {
    if (allModes) return;
    let gone = false;
    void (async () => {
      const [{ data: own }, { data: staff }, { data: u }, { data: flags }] = await Promise.all([
        supabase.from('stores').select('id,slug,subdomain_ready,custom_domain,domain_ready,support_code').eq('owner_id', userId).limit(1),
        supabase.rpc('my_staff_stores'),
        supabase.auth.getUser(),
        supabase.from('site_settings').select('key,value').eq('key', 'store_admin_rose_card'),
      ]);
      if (gone) return;
      const md = (u.user?.user_metadata || {}) as Record<string, string>;
      setMe({ email: u.user?.email || '', pic: md.avatar_url || md.picture || '' });
      setRoseCard(!((flags as Array<{ value: unknown }>) || []).some((f) => f.value === false));
      setSiteOwner(Boolean((own && own.length) || (Array.isArray(staff) && staff.length)));
      // the customer side of the shop (owner's shop, or the shop a staff member works for)
      type St = { slug: string; subdomain_ready?: boolean; custom_domain?: string | null; domain_ready?: boolean };
      let st = ((own as St[]) || [])[0];
      setSupportId(((own as Array<{ support_code?: string }>) || [])[0]?.support_code || '');
      setIsOwner(Boolean(own && own.length));
      const ownId = ((own as Array<{ id: string }>) || [])[0]?.id;
      if (ownId) {
        const { count } = await supabase.from('store_staff').select('email', { count: 'exact', head: true }).eq('store_id', ownId);
        if (!gone) setStaffCount(count || 0);
      }
      if (!st && Array.isArray(staff) && staff.length) {
        const { data: ss } = await supabase.from('stores').select('slug,subdomain_ready,custom_domain,domain_ready').eq('id', (staff[0] as { store_id: string }).store_id).maybeSingle();
        st = (ss as St) || undefined;
      }
      if (!gone && st) setShopUrl(st.custom_domain && st.domain_ready ? `https://${st.custom_domain}` : st.subdomain_ready ? `https://${st.slug}.myrosebd.com` : `https://www.myrosebd.com/shop/${st.slug}`);
    })();
    return () => {
      gone = true;
    };
  }, [userId, allModes]);
  // things the WEBSITE ADMIN already has: not shown again inside ROSE
  const SITE_HIDES = new Set<string>(['store', 'couriers', 'orders', 'customers', 'expenses']);

  const loadBusiness = useCallback(async () => {
    if (mode !== 'business') return;
    const { data } = await supabase.from('businesses').select('id,name,payment_methods').eq('owner_id', userId).maybeSingle();
    setBusinessId(data?.id ?? null);
    setBizInfo(data ? { name: data.name, pay: data.payment_methods } : null);
    setBizLoaded(true);
  }, [mode, userId]);

  useEffect(() => {
    void loadBusiness();
  }, [loadBusiness]);

  const refreshAi = () => void refreshModeContext(allModes ? 'admin' : mode, userId);

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

  // business mode: bars sit inside two groups, 01 ROSE and 02 BUSINESS
  const ROSE_GRP: View[] = ['biz_ai', 'writer', 'social', 'store', 'domain', 'channels'];
  const BIZ_GRP: View[] = ['biz_profile', 'products', 'faqs', 'couriers', 'discounts', 'orders', 'customers', 'customer_check', 'approvals', 'biz_dashboard', 'expenses'];
  const grouped = mode === 'business' && !allModes;
  const back = () => {
    if (view === 'hub') return onBack();
    if (grouped && ROSE_GRP.includes(view) && !(siteOwner && view === 'store')) return setView('grp_rose');
    if (grouped && BIZ_GRP.includes(view)) return setView('grp_biz');
    if (view === 'grp_rose' || view === 'grp_biz') return setView(siteOwner ? 'rose_hub' : 'hub');
    if (siteOwner && !['store', 'rose_hub', 'rose_support', 'profile', 'viewas'].includes(view)) return setView('rose_hub');
    setView('hub');
  };
  // one list, numbered 01, 02, 03… in order; for website owners the hidden bars drop out and the rest close up
  const tidy = (items: React.ReactElement[]): React.ReactElement[] => {
    if (!siteOwner) return items;
    const kept = items.filter((el) => !SITE_HIDES.has(String(el.key)));
    const noEmptyLabels = kept.filter((el, i) => {
      if (!String(el.key).startsWith('l_')) return true;
      const next = kept[i + 1];
      return Boolean(next && !String(next.key).startsWith('l_'));
    });
    let n = 0;
    return noEmptyLabels.map((el) => {
      const b = (el.props as { badge?: unknown }).badge;
      if (typeof b === 'string' && /^\d+$/.test(b) && b !== '00') return React.cloneElement(el as React.ReactElement<{ badge?: string }>, { badge: String(++n).padStart(2, '0') });
      return el;
    });
  };
  const uScope = { user_id: userId };
  const bScope = businessId ? { business_id: businessId } : null;
  const modeLabel = mode ? mode.toUpperCase() : 'NOT SET';

  const bar = (n: string, v: View, extra?: string) => (
    <SettingsBar key={v} badge={n} title={TITLES[v]} value={extra} onClick={() => setView(v)} testId={`ws-${v}`} />
  );

  let body: React.ReactNode = null;
  if (view === 'hub' && siteOwner) {
    body = (
      <div className="space-y-1.5">
        {roseCard && <RoseSupportCard onOpen={() => setView('rose_support')} />}
        <button type="button" onClick={() => setView('profile')} data-testid="ws-profile" className="flex h-14 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left dark:border-white/[0.08] dark:bg-[#11151E]">
          <span className="rounded-md bg-[#1e293b] px-1.5 py-[3px] font-mono text-[10px] font-bold text-teal-400">01</span>
          {me.pic ? (
            <img src={me.pic} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white">{(me.email || '?').charAt(0).toUpperCase()}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold text-slate-900 dark:text-slate-100">{me.email}</span>
            <span className="block text-[10.5px] text-slate-400">{supportId ? <>ID <b className="font-mono tracking-wider text-teal-300">{supportId}</b> · MY DETAILS</> : 'MY DETAILS'}</span>
          </span>
          <span className="text-base text-slate-500">›</span>
        </button>
        <SettingsBar badge="02" title="MYROSEBD.COM BUSINESS" value={modeLabel} onClick={() => setView('rose_hub')} testId="ws-rose" />
        <SettingsBar badge="03" title="WEBSITE ADMIN" value="STORE · ORDERS · PRODUCTS" onClick={() => setView('store')} testId="ws-site-admin" />
        {shopUrl && (
          <SettingsBar
            badge="04"
            title="MY SHOP"
            value="OPEN ↗"
            onClick={() => {
              // open the shop's home page, already signed in with this Gmail (the shop is another address, so the sign-in goes along)
              const w = window.open('', '_blank');
              void supabase.auth.getSession().then(({ data }) => {
                const ss = data.session;
                const base = shopUrl;
                const url = ss
                  ? `${base}#access_token=${encodeURIComponent(ss.access_token)}&refresh_token=${encodeURIComponent(ss.refresh_token)}&expires_in=${Math.max(60, (ss.expires_at || 0) - Math.round(Date.now() / 1000))}&token_type=bearer`
                  : `${base}#/`;
                if (w) w.location.href = url;
                else window.location.href = url;
              });
            }}
            testId="ws-shop"
          />
        )}
        {isOwner && shopUrl && (
          <SettingsBar
            badge="05"
            title="CUSTOMER VIEW"
            value="AS A CUSTOMER ↗"
            onClick={() => {
              // the shop as a guest customer sees it (owner sign-in is not used there); BACK TO ADMIN returns here
              const u = shopUrl + (shopUrl.includes('?') ? '&' : '?') + 'as=customer#/';
              if (!window.open(u, '_blank')) window.location.href = u;
            }}
            testId="ws-customer-view"
          />
        )}
        {isOwner && <SettingsBar badge="06" title="MY STAFF" value={`${staffCount} STAFF`} onClick={() => setView('viewas')} testId="ws-my-staff" />}
      </div>
    );
  } else if (view === 'hub' || view === 'rose_hub') {
    const personal = [bar('01', 'tasks'), bar('02', 'content'), bar('03', 'writer'), bar('04', 'social', 'YT · FB · TT · IG'), bar('05', 'store', 'WEBSITE'), bar('06', 'domain', 'ROSE ACCESS')];
    const student = [bar('01', 'notes'), bar('02', 'routine'), bar('03', 'tests'), bar('04', 'tasks'), bar('05', 'writer'), bar('06', 'social', 'YT · FB · TT · IG'), bar('07', 'store', 'WEBSITE'), bar('08', 'domain', 'ROSE ACCESS')];
    const label = (t: string) => (
      <p key={`l_${t}`} className="px-1 pt-2 text-[10px] font-bold tracking-wider text-slate-400">
        {t}
      </p>
    );
    const business = grouped
      ? [
          <SettingsBar key="biz_guide" badge="00" title="START HERE · GUIDE" value="SETUP" tone="accent" onClick={() => setView('biz_guide')} testId="ws-biz_guide" />,
          <SettingsBar key="grp_rose" badge="01" title="ROSE" value="AI · POSTS · CHANNELS" onClick={() => setView('grp_rose')} testId="ws-grp_rose" />,
          <SettingsBar key="grp_biz" badge="02" title="BUSINESS" value="PROFILE · PRODUCTS · REPORTS" onClick={() => setView('grp_biz')} testId="ws-grp_biz" />,
        ]
      : [
          <SettingsBar key="biz_guide" badge="00" title="START HERE · GUIDE" value="SETUP" tone="accent" onClick={() => setView('biz_guide')} testId="ws-biz_guide" />,
          label('SETUP'),
          bar('01', 'biz_profile', businessId ? 'READY' : 'SET UP'),
          bar('02', 'products'),
          bar('03', 'faqs'),
          bar('04', 'couriers'),
          bar('05', 'discounts'),
          bar('06', 'biz_ai'),
          label('DAILY WORK'),
          bar('07', 'orders'),
          bar('08', 'customers'),
          bar('09', 'customer_check', 'COURIER HISTORY'),
          bar('10', 'approvals'),
          label('MONEY & REPORTS'),
          bar('11', 'biz_dashboard'),
          bar('12', 'expenses'),
          label('CHANNELS'),
          bar('13', 'channels', 'KEYS'),
        ];
    body = (
      <div className="space-y-3">
        <TutorialStrip audience={mode || 'personal'} />
        {mode === 'business' && !businessId && bizLoaded && (
          <p className="px-1 text-[11px] text-amber-300">Fill in your Business Profile first (02 BUSINESS → 01). Then products, orders and the dashboard appear.</p>
        )}
        {allModes ? (
          <SettingsBar badge="A" title="MODE" value="ADMIN · ALL" tone="accent" hideChevron onClick={() => undefined} testId="ws-mode" />
        ) : (
          <SettingsBar badge="M" title="MODE" value={modeLabel} tone="accent" onClick={() => setView('mode')} testId="ws-mode" />
        )}
        {allModes && (
          <div className="space-y-1.5">
            {label('PERSONAL')}
            {[bar('P1', 'tasks'), bar('P2', 'content')]}
            {label('STUDENT')}
            {[bar('S1', 'notes'), bar('S2', 'routine'), bar('S3', 'tests')]}
            {label('WRITE & POST')}
            {[bar('W1', 'writer'), bar('W2', 'social', 'YT · FB · TT · IG'), bar('W3', 'store', 'WEBSITE'), bar('W4', 'domain', 'ROSE ACCESS')]}
            {label('BUSINESS')}
          </div>
        )}
        <div className="space-y-1.5">
          {mode === 'business' && !bizLoaded ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            </div>
          ) : mode === 'business' ? (
            tidy(business)
          ) : mode === 'student' ? (
            tidy(student)
          ) : (
            tidy(personal)
          )}
        </div>
      </div>
    );
  } else if (view === 'grp_rose') {
    body = (
      <div className="space-y-1.5">
        {tidy([bar('01', 'biz_ai'), bar('02', 'writer'), bar('03', 'social', 'YT · FB · TT · IG'), bar('04', 'store', 'WEBSITE'), bar('05', 'domain', 'DNS · ROSE ACCESS'), bar('06', 'channels', 'KEYS')])}
      </div>
    );
  } else if (view === 'grp_biz') {
    body = (
      <div className="space-y-1.5">
        {tidy([
          bar('01', 'biz_profile', businessId ? 'READY' : 'SET UP'),
          bar('02', 'products'),
          bar('03', 'faqs'),
          bar('04', 'couriers'),
          bar('05', 'discounts'),
          bar('06', 'orders'),
          bar('07', 'customers'),
          bar('08', 'customer_check', 'COURIER HISTORY'),
          bar('09', 'approvals'),
          bar('10', 'biz_dashboard'),
          bar('11', 'expenses'),
        ])}
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
  } else if (view === 'social') body = <SocialPostPanel />;
  else if (view === 'store') body = <StorePanel userId={userId} />;
  else if (view === 'rose_support') body = <AdminBrandPage />;
  else if (view === 'profile') body = <SiteProfile userId={userId} />;
  else if (view === 'viewas') body = <StorePanel userId={userId} startTab="viewas" />;
  else if (view === 'domain') body = <DomainAccess userId={userId} />;
  else if (view === 'writer') body = <div className="h-[calc(100dvh-140px)]"><WriterPanel /></div>;
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
  else if (view === 'biz_guide') body = <BusinessGuide businessId={businessId} onOpen={setView} />;
  else if (bScope) {
    if (view === 'biz_ai')
      body = <SingleRowForm table="business_ai_settings" match={bScope} fields={AI_FIELDS} onSaved={refreshAi} />;
    else if (view === 'products') body = <CrudSection config={PRODUCTS} scope={bScope} onChanged={refreshAi} />;
    else if (view === 'customers') body = <CrudSection config={CUSTOMERS} scope={bScope} />;
    else if (view === 'orders') body = <CrudSection config={ORDERS} scope={bScope} />;
    else if (view === 'expenses') body = <CrudSection config={EXPENSES} scope={bScope} />;
    else if (view === 'faqs') body = <CrudSection config={FAQS} scope={bScope} onChanged={refreshAi} />;
    else if (view === 'discounts') body = <CrudSection config={DISCOUNTS} scope={bScope} />;
    else if (view === 'approvals')
      body = (
        <CrudSection
          config={APPROVALS}
          scope={bScope}
          onChanged={() => void supabase.functions.invoke('rose-approval', { body: { action: 'notify' } }).catch(() => undefined)}
        />
      );
    else if (view === 'couriers')
      body = (
        <div className="space-y-2">
          <CourierConnect businessId={bScope.business_id} />
          <CrudSection config={COURIERS} scope={bScope} />
        </div>
      );
    else if (view === 'channels') body = <ChannelConnect />;
  }
  if (view === 'customer_check') body = <CustomerCheck shopName={bizInfo?.name} bkash={(bizInfo?.pay || '').match(/01\d{9}/)?.[0] || null} />;
  if (!body && !bScope && mode === 'business' && view !== 'hub')
    body = (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm font-bold text-white">Fill in your Business Profile first</p>
        <p className="text-[11.5px] text-slate-400">Shop name, owner name, Gmail and mobile. After that this section opens.</p>
        <button type="button" onClick={() => setView('biz_profile')} className="mx-auto flex h-10 items-center justify-center rounded-[4px] bg-teal-600 px-5 text-xs font-bold text-white">
          OPEN BUSINESS PROFILE
        </button>
      </div>
    );

  return (
    <SettingsShell title={view === 'hub' ? '07 WORKSPACE' : view === 'store' && siteOwner ? 'WEBSITE ADMIN' : TITLES[view]} onBack={back}>
      <div className="pb-4">{body}</div>
    </SettingsShell>
  );
};
