import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/** One field of a simple record form */
export interface CrudField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'time' | 'select' | 'bool' | 'ref';
  options?: Array<{ value: string; label: string }>;
  /** for type 'ref': table + label column to pick from (same business) */
  refTable?: string;
  refLabel?: string;
  required?: boolean;
  placeholder?: string;
  /** value used for a new row (matches the database default) */
  defaultValue?: any;
}

export interface CrudConfig {
  table: string;
  title: string;
  fields: CrudField[];
  /** column shown as the bar title / sub line */
  titleKey: string;
  subKey?: string;
  /** right-side value on each bar */
  badgeKey?: string;
  orderBy?: { column: string; ascending: boolean };
  emptyText?: string;
}

interface Props {
  config: CrudConfig;
  /** fixed values added to every row and used to filter, e.g. { user_id } or { business_id } */
  scope: Record<string, string>;
  onChanged?: () => void;
}

export const inputCls =
  'mt-1 h-11 w-full rounded-[4px] border border-white/12 bg-[#0B0F16] px-3 text-xs text-white placeholder:text-slate-500 focus:border-teal-400 focus:outline-none';
export const labelCls = 'block text-[10px] font-semibold tracking-wider text-slate-400';

function toInputValue(f: CrudField, v: any): any {
  if (v === null || v === undefined) return f.type === 'bool' ? false : '';
  if (f.type === 'datetime' && typeof v === 'string') {
    const d = new Date(v);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (f.type === 'time' && typeof v === 'string') return v.slice(0, 5);
  if (f.type === 'select' || f.type === 'ref') return String(v);
  return v;
}

function fromInputValue(f: CrudField, v: any): any {
  if (f.type === 'bool') return Boolean(v);
  if (v === '' || v === undefined) return null;
  if (f.type === 'number') return Number(v);
  if (f.type === 'datetime') return new Date(v).toISOString();
  return v;
}

export const FieldInput: React.FC<{
  field: CrudField;
  value: any;
  onChange: (v: any) => void;
  refOptions?: Array<{ value: string; label: string }>;
}> = ({ field: f, value, onChange, refOptions }) => {
  if (f.type === 'bool')
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="flex h-11 w-full items-center justify-between rounded-[4px] border border-white/12 bg-[#0B0F16] px-3 text-xs font-semibold text-slate-200"
      >
        <span>{f.label}</span>
        <span className={`relative h-6 w-11 rounded-[3px] transition-colors ${value ? 'bg-teal-500' : 'bg-white/15'}`}>
          <span className={`absolute top-1 h-4 w-4 rounded-[2px] bg-white transition-all ${value ? 'left-6' : 'left-1'}`} />
        </span>
      </button>
    );
  return (
    <label className="block">
      <span className={labelCls}>
        {f.label}
        {f.required ? ' *' : ''}
      </span>
      {f.type === 'textarea' ? (
        <textarea
          rows={3}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} h-auto py-2.5`}
        />
      ) : f.type === 'select' || f.type === 'ref' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {(f.type === 'ref' ? refOptions || [] : f.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={f.type === 'datetime' ? 'datetime-local' : f.type}
          inputMode={f.type === 'number' ? 'decimal' : undefined}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </label>
  );
};

/** List + add/edit/delete for one table. Square bars like Settings. */
export const CrudSection: React.FC<Props> = ({ config, scope, onChanged }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null); // {} = new row
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [refOpts, setRefOpts] = useState<Record<string, Array<{ value: string; label: string }>>>({});
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from(config.table).select('*');
    for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
    const ob = config.orderBy || { column: 'created_at', ascending: false };
    const { data, error } = await q.order(ob.column, { ascending: ob.ascending }).limit(300);
    setRows(error ? [] : data || []);
    if (error) setMsg(error.message);
    setLoading(false);
  }, [config.table, config.orderBy, JSON.stringify(scope)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  // options for reference fields (e.g. customer of an order)
  useEffect(() => {
    const refs = config.fields.filter((f) => f.type === 'ref' && f.refTable);
    refs.forEach(async (f) => {
      let q = supabase.from(f.refTable!).select(`id,${f.refLabel || 'name'}`);
      for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
      const { data } = await q.limit(500);
      setRefOpts((p) => ({
        ...p,
        [f.key]: (data || []).map((r: any) => ({ value: r.id, label: String(r[f.refLabel || 'name'] || 'Unnamed') })),
      }));
    });
  }, [config.fields, JSON.stringify(scope)]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (row: any | null) => {
    const base: Record<string, any> = {};
    config.fields.forEach((f) => (base[f.key] = toInputValue(f, row ? row[f.key] : f.defaultValue ?? null)));
    setDraft(base);
    setEditing(row || {});
    setMsg('');
    setConfirmDel(false);
  };

  const save = async () => {
    for (const f of config.fields) {
      if (f.required && (draft[f.key] === '' || draft[f.key] === null || draft[f.key] === undefined)) {
        setMsg(`${f.label} is required.`);
        return;
      }
    }
    const payload: Record<string, any> = {};
    config.fields.forEach((f) => {
      const v = fromInputValue(f, draft[f.key]);
      payload[f.key] = v === null && f.defaultValue !== undefined ? f.defaultValue : v;
    });
    setBusy(true);
    const res = editing?.id
      ? await supabase.from(config.table).update(payload).eq('id', editing.id)
      : await supabase.from(config.table).insert({ ...payload, ...scope });
    setBusy(false);
    if (res.error) {
      setMsg(res.error.message);
      return;
    }
    setEditing(null);
    await load();
    onChanged?.();
  };

  const remove = async () => {
    if (!editing?.id) return;
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from(config.table).delete().eq('id', editing.id);
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setEditing(null);
    await load();
    onChanged?.();
  };

  const fmt = (v: any) => {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'boolean') return v ? 'YES' : 'NO';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    return String(v);
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-widest text-teal-300">{editing.id ? 'EDIT' : 'NEW'}</p>
          <button type="button" onClick={() => setEditing(null)} className="flex h-9 items-center gap-1 text-[11px] text-slate-400">
            <X className="h-4 w-4" /> CANCEL
          </button>
        </div>
        {config.fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={draft[f.key]}
            refOptions={refOpts[f.key]}
            onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
          />
        ))}
        {msg && <p className="rounded-[4px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{msg}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-teal-500 text-xs font-bold tracking-widest text-black disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} SAVE
        </button>
        {editing.id && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-rose-500/50 text-xs font-semibold text-rose-300"
          >
            <Trash2 className="h-4 w-4" /> {confirmDel ? 'TAP AGAIN TO DELETE' : 'DELETE'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => open(null)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-teal-400/60 text-xs font-bold tracking-widest text-teal-300"
      >
        <Plus className="h-4 w-4" /> ADD NEW
      </button>
      {msg && <p className="text-xs text-rose-300">{msg}</p>}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-500">{config.emptyText || 'Nothing here yet.'}</p>
      ) : (
        rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => open(r)}
            className="flex min-h-[52px] w-full items-center gap-2 rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3.5 py-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{fmt(r[config.titleKey]) || '—'}</span>
              {config.subKey && fmt(r[config.subKey]) && (
                <span className="block truncate text-[10.5px] text-slate-400">{fmt(r[config.subKey])}</span>
              )}
            </span>
            {config.badgeKey && fmt(r[config.badgeKey]) && (
              <span className="shrink-0 rounded-[3px] bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-teal-300">
                {fmt(r[config.badgeKey])}
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          </button>
        ))
      )}
    </div>
  );
};

/** Edit a single row (one per user/business), e.g. business profile. */
export const SingleRowForm: React.FC<{
  table: string;
  match: Record<string, string>;
  fields: CrudField[];
  onSaved?: (row: any) => void;
}> = ({ table, match, fields, onSaved }) => {
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  useEffect(() => {
    let q = supabase.from(table).select('*');
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    void q.maybeSingle().then(({ data }) => {
      const base: Record<string, any> = {};
      fields.forEach((f) => (base[f.key] = toInputValue(f, data ? data[f.key] : f.defaultValue ?? null)));
      setDraft(base);
      setLoading(false);
    });
  }, [table, JSON.stringify(match)]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    for (const f of fields) {
      if (f.required && !draft[f.key]) {
        setMsg({ t: `${f.label} is required.`, ok: false });
        return;
      }
    }
    const payload: Record<string, any> = { ...match };
    fields.forEach((f) => {
      const v = fromInputValue(f, draft[f.key]);
      payload[f.key] = v === null && f.defaultValue !== undefined ? f.defaultValue : v;
    });
    setBusy(true);
    const conflict = Object.keys(match).join(',');
    const { data, error } = await supabase.from(table).upsert(payload, { onConflict: conflict }).select().maybeSingle();
    setBusy(false);
    if (error) setMsg({ t: error.message, ok: false });
    else {
      setMsg({ t: 'Saved.', ok: true });
      onSaved?.(data);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-10 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
      ))}
      {msg && (
        <p className={`rounded-[4px] border px-3 py-2 text-xs ${msg.ok ? 'border-teal-500/40 text-teal-300' : 'border-rose-500/40 text-rose-300'}`}>{msg.t}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-teal-500 text-xs font-bold tracking-widest text-black disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} SAVE
      </button>
    </div>
  );
};
