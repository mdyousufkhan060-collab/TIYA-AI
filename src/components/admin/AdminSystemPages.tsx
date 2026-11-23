import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CrudConfig, CrudSection } from '../workspace/CrudSection';

/** Extra numbers for the Admin dashboard: users by mode, logins, errors... */
export const AdminOverviewTiles: React.FC = () => {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    void supabase.rpc('admin_overview').then(({ data }) => setD(data || {}));
  }, []);
  if (!d) return null;
  const tiles: Array<[string, number]> = [
    ['PERSONAL', d.personal],
    ['STUDENT', d.student],
    ['BUSINESS', d.business],
    ['ACTIVE 24H', d.active_24h],
    ['INACTIVE 30D', d.inactive_30d],
    ['LOGINS 24H', d.logins_24h],
    ['ERRORS 24H', d.errors_24h],
    ['DELETE REQUESTS', d.deletion_pending],
  ];
  return (
    <div className="mt-3">
      <p className="px-1 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-400">BY MODE & ACTIVITY</p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([l, v]) => (
          <div key={l} className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-3">
            <p className="text-[9.5px] font-semibold tracking-wider text-slate-400">{l}</p>
            <p className="mt-1 font-mono text-lg font-bold text-white">{v ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const API_PROVIDERS: CrudConfig = {
  table: 'api_providers',
  title: 'API PROVIDERS',
  titleKey: 'name',
  subKey: 'model',
  badgeKey: 'tier',
  orderBy: { column: 'priority', ascending: true },
  emptyText: 'List the AI providers TIYA uses. Keys stay in Supabase Secrets, never here.',
  fields: [
    { key: 'name', label: 'NAME', type: 'text', required: true, placeholder: 'Gemini main' },
    {
      key: 'provider',
      label: 'PROVIDER',
      type: 'select',
      required: true,
      options: ['gemini', 'groq', 'openai', 'anthropic', 'other'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
    { key: 'model', label: 'MODEL', type: 'text', placeholder: 'gemini-2.5-flash' },
    {
      key: 'purpose',
      label: 'USED FOR',
      type: 'select',
      options: ['chat', 'voice', 'tts', 'transcribe', 'search', 'other'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
    { key: 'tier', label: 'TIER', type: 'select', defaultValue: 'free', options: [{ value: 'free', label: 'FREE' }, { value: 'paid', label: 'PAID' }] },
    { key: 'secret_name', label: 'SECRET NAME IN SUPABASE (NOT THE KEY)', type: 'text', placeholder: 'GEMINI_API_KEY' },
    { key: 'priority', label: 'PRIORITY (0 = FIRST)', type: 'number', defaultValue: 0 },
    { key: 'is_enabled', label: 'ENABLED', type: 'bool', defaultValue: true },
    { key: 'is_backup', label: 'BACKUP PROVIDER', type: 'bool', defaultValue: false },
    { key: 'daily_limit', label: 'DAILY LIMIT', type: 'number' },
    { key: 'monthly_limit', label: 'MONTHLY LIMIT', type: 'number' },
    { key: 'rate_limit_per_min', label: 'RATE LIMIT / MIN', type: 'number' },
    {
      key: 'health',
      label: 'HEALTH',
      type: 'select',
      defaultValue: 'unknown',
      options: ['ok', 'down', 'unknown'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
  ],
};

const DELETIONS: CrudConfig = {
  table: 'account_deletion_requests',
  title: 'DELETE REQUESTS',
  titleKey: 'email',
  subKey: 'reason',
  badgeKey: 'status',
  emptyText: 'No account delete requests.',
  fields: [
    { key: 'email', label: 'EMAIL', type: 'text' },
    { key: 'reason', label: 'REASON', type: 'textarea' },
    {
      key: 'status',
      label: 'STATUS',
      type: 'select',
      defaultValue: 'pending',
      options: ['pending', 'done', 'cancelled'].map((v) => ({ value: v, label: v.toUpperCase() })),
    },
  ],
};

export const AdminApiProvidersPage: React.FC = () => <CrudSection config={API_PROVIDERS} scope={{}} />;
export const AdminDeletionRequestsPage: React.FC = () => <CrudSection config={DELETIONS} scope={{}} />;

/** Latest system / security errors */
export const AdminSystemLogsPage: React.FC = () => {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    void supabase
      .from('system_logs')
      .select('id,level,source,message,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setRows(data || []));
  }, []);
  if (!rows)
    return (
      <div className="flex items-center justify-center py-10 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  if (!rows.length) return <p className="py-10 text-center text-xs text-slate-400">No errors logged. All good.</p>;
  const tone: Record<string, string> = { info: 'text-slate-300', warn: 'text-amber-300', error: 'text-rose-400', security: 'text-fuchsia-400' };
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold uppercase ${tone[r.level] || 'text-slate-300'}`}>
              {r.level}
              {r.source ? ` · ${r.source}` : ''}
            </span>
            <span className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString('en-GB')}</span>
          </div>
          <p className="mt-1 break-words text-xs text-slate-200">{r.message}</p>
        </div>
      ))}
    </div>
  );
};
