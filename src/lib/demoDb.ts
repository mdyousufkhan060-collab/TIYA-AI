/**
 * Demo admin: the SAME website admin as real shops, run on sample data kept in memory.
 * window.__roseDemoDb takes the place of Supabase while the demo admin page is open,
 * so the demo can never look or work differently from the real admin. Nothing is saved.
 */
type Row = Record<string, any>;
type Res = { data: any; error: null | { message: string }; count?: number | null };

let seq = 1;
const uid = () => `demo-${Date.now().toString(36)}-${(seq++).toString(36)}`;

class Q implements PromiseLike<Res> {
  private filters: Array<(r: Row) => boolean> = [];
  private sort: Array<[string, boolean]> = [];
  private lim = Infinity;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private one: '' | 'single' | 'maybe' = '';
  private head = false;
  private wantCount = false;
  constructor(private db: Record<string, Row[]>, private table: string) {
    if (!db[table]) db[table] = [];
  }
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { if (opts?.count) this.wantCount = true; if (opts?.head) this.head = true; return this; }
  insert(v: Row | Row[]) { this.op = 'insert'; this.payload = v; return this; }
  upsert(v: Row | Row[]) { this.op = 'upsert'; this.payload = v; return this; }
  update(v: Row) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: any) { this.filters.push((r) => String(r[k]) === String(v)); return this; }
  neq(k: string, v: any) { this.filters.push((r) => String(r[k]) !== String(v)); return this; }
  in(k: string, v: any[]) { const s = new Set(v.map(String)); this.filters.push((r) => s.has(String(r[k]))); return this; }
  gte(k: string, v: any) { this.filters.push((r) => r[k] >= v); return this; }
  gt(k: string, v: any) { this.filters.push((r) => r[k] > v); return this; }
  lte(k: string, v: any) { this.filters.push((r) => r[k] <= v); return this; }
  lt(k: string, v: any) { this.filters.push((r) => r[k] < v); return this; }
  is(k: string, v: any) { this.filters.push((r) => (r[k] ?? null) === v); return this; }
  ilike(k: string, v: string) { const re = new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); this.filters.push((r) => re.test(String(r[k] ?? ''))); return this; }
  or() { return this; }
  not() { return this; }
  match(o: Row) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this; }
  order(k: string, o?: { ascending?: boolean }) { this.sort.push([k, o?.ascending !== false]); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.lim = b - a + 1; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  private run(): Res {
    const all = this.db[this.table];
    const pass = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
      list.forEach((r: Row) => { const i = all.findIndex((x) => x.id === r.id); if (i >= 0) all[i] = { ...all[i], ...r }; else all.push(r); });
      out = list;
    } else if (this.op === 'update') {
      all.forEach((r, i) => { if (pass(r)) { all[i] = { ...r, ...this.payload }; out.push(all[i]); } });
    } else if (this.op === 'delete') {
      out = all.filter(pass);
      this.db[this.table] = all.filter((r) => !pass(r));
    } else {
      out = all.filter(pass);
      for (const [k, asc] of [...this.sort].reverse()) out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1));
      const count = out.length;
      out = out.slice(0, this.lim);
      if (this.head) return { data: null, error: null, count };
      if (this.wantCount) return { data: this.oneOf(out), error: null, count };
    }
    return { data: this.oneOf(out), error: null };
  }
  private oneOf(out: Row[]) { return this.one ? (out[0] ?? null) : JSON.parse(JSON.stringify(out)); }
  then<A = Res, B = never>(res?: ((v: Res) => A | PromiseLike<A>) | null, rej?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(res, rej);
  }
}

export function makeDemoDb(tables: Record<string, Row[]>, rpcs: Record<string, any>) {
  const user = { id: 'demo-owner', email: 'demo@myrosebd.com', user_metadata: { full_name: 'Demo Owner' } };
  const chan: any = { on: () => chan, subscribe: () => chan, unsubscribe: () => undefined, send: () => undefined };
  return {
    from: (t: string) => new Q(tables, t),
    rpc: async (name: string, args?: Row) => ({ data: typeof rpcs[name] === 'function' ? rpcs[name](args || {}, tables) : name in rpcs ? rpcs[name] : null, error: null }),
    functions: { invoke: async () => ({ data: { ok: false, message: 'Demo: this works in a real shop.' }, error: null }) },
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: { user } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    storage: {
      from: () => ({
        upload: async (_p: string, blob: Blob) => { (window as any).__demoLastBlob = URL.createObjectURL(blob); return { data: {}, error: null }; },
        getPublicUrl: () => ({ data: { publicUrl: (window as any).__demoLastBlob || '' } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    channel: () => chan,
    removeChannel: () => undefined,
  };
}
