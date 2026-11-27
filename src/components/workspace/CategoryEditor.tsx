import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * ADD / EDIT CATEGORY page (store admin › Categories). Own file so the rest of the admin never breaks.
 * Logo (uploaded image or an icon), name, description, parent (makes it a subcategory, e.g. Clothing › Shirt)
 * and an optional category banner.
 */
export type CatRow = { id: string; name: string; icon: string; sort: number; banner_url?: string | null; parent_id?: string | null; description?: string; logo_url?: string | null };

type Props = {
  storeId: string;
  cats: CatRow[];
  edit: CatRow | null; // null = new category
  parentId?: string | null; // preset parent when "+ ADD SUBCATEGORY" was pressed
  ready: Array<[string, string]>;
  IconPick: React.FC<{ value: string; onPick: (v: string) => void }>;
  iconFor: (name: string) => string;
  upload: (storeId: string, f: File, max?: number) => Promise<string>;
  onClose: (saved: boolean) => void;
};

const box = 'rounded-xl border border-white/[0.08] bg-[#11151E] p-3';
const input = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white';
const cap = 'mb-1.5 text-[11px] font-bold tracking-wider text-teal-300';
const small = 'rounded-lg border border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-white';

export const CategoryEditor: React.FC<Props> = ({ storeId, cats, edit, parentId, ready, IconPick, iconFor, upload, onClose }) => {
  const [name, setName] = useState(edit?.name || '');
  const [icon, setIcon] = useState(edit?.icon || '🏷️');
  const [logo, setLogo] = useState(edit?.logo_url || '');
  const [desc, setDesc] = useState(edit?.description || '');
  const [parent, setParent] = useState<string>(edit ? edit.parent_id || '' : parentId || '');
  const [banner, setBanner] = useState(edit?.banner_url || '');
  const [showReady, setShowReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const hasSubs = !!edit && cats.some((c) => c.parent_id === edit.id);
  const parents = cats.filter((c) => !c.parent_id && c.id !== edit?.id);
  const pickFile = async (f: File | undefined, kind: 'logo' | 'banner') => {
    if (!f) return;
    setBusy(kind);
    setMsg('');
    try {
      const url = await upload(storeId, f, kind === 'logo' ? 400 : 1400);
      if (kind === 'logo') setLogo(url);
      else setBanner(url);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    }
    setBusy('');
  };

  const save = async () => {
    const nm = name.trim();
    if (!nm) return setMsg('Write the category name.');
    if (cats.some((c) => c.id !== edit?.id && c.name.toLowerCase() === nm.toLowerCase() && (c.parent_id || '') === parent)) return setMsg('This category already exists.');
    setBusy('save');
    const row = { name: nm, icon: icon || iconFor(nm), logo_url: logo || null, description: desc.trim(), parent_id: parent || null, banner_url: banner || null };
    const { error } = edit
      ? await supabase.from('store_categories').update(row).eq('id', edit.id)
      : await supabase.from('store_categories').insert({ ...row, store_id: storeId, sort: cats.length });
    setBusy('');
    if (error) return setMsg(error.message);
    onClose(true);
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onClose(false)} className="flex items-center gap-1 px-1 text-[11px] font-bold tracking-wider text-teal-400">
        <ArrowLeft className="h-3.5 w-3.5" /> CATEGORIES
      </button>
      <p className="px-1 text-[15px] font-extrabold text-white">{edit ? 'EDIT CATEGORY' : parent ? 'ADD SUBCATEGORY' : 'ADD CATEGORY'}</p>

      <div className={box}>
        <p className={cap}>CATEGORY LOGO</p>
        <div className="flex items-center gap-3">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-white/25 text-3xl">
            {busy === 'logo' ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <span>{icon}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={small + ' flex cursor-pointer items-center gap-1'}>
              <ImagePlus className="h-3.5 w-3.5" /> UPLOAD IMAGE
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickFile(f, 'logo'); }} />
            </label>
            <div className="flex items-center gap-2">
              <IconPick value={icon} onPick={(v) => { setIcon(v); setLogo(''); }} />
              {logo && <button type="button" onClick={() => setLogo('')} className="text-[11px] font-bold text-rose-300">REMOVE IMAGE</button>}
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-[10.5px] text-slate-500">Upload a square image, or pick an icon. Without an image the shop shows the icon or the first product photo.</p>
      </div>

      <div className={box}>
        <p className={cap}>CATEGORY NAME</p>
        <input className={input} value={name} onChange={(e) => { setName(e.target.value); if (!logo && !edit) setIcon(iconFor(e.target.value)); }} placeholder="Shirt" />
        <button type="button" onClick={() => setShowReady((v) => !v)} className="mt-1.5 flex items-center gap-1 text-[11.5px] font-bold text-teal-300">
          Pick a ready name <ChevronDown className={`h-3.5 w-3.5 transition ${showReady ? 'rotate-180' : ''}`} />
        </button>
        {showReady && (
          <div className="mt-1.5 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {ready.map(([n, ic]) => (
              <button key={n} type="button" onClick={() => { setName(n); if (!logo) setIcon(ic); setShowReady(false); }} className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white">
                <span>{ic}</span>{n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={box}>
        <p className={cap}>DESCRIPTION</p>
        <textarea className={input} rows={3} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Cotton and formal shirts for men" />
        <p className="mt-1 text-[10.5px] text-slate-500">Shown at the top of this category in your shop.</p>
      </div>

      <div className={box}>
        <p className={cap}>PARENT CATEGORY</p>
        {hasSubs ? (
          <p className="text-[12px] text-slate-300">This is a main category with subcategories, so it stays a main category.</p>
        ) : (
          <select className={input} value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">None (main category)</option>
            {parents.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name} (makes this a subcategory)</option>)}
          </select>
        )}
      </div>

      <div className={box}>
        <p className={cap}>CATEGORY BANNER (OPTIONAL)</p>
        {banner && (
          <div className="relative mb-2">
            <img src={banner} alt="" className="h-20 w-full rounded-lg object-cover" />
            <button type="button" aria-label="Remove banner" onClick={() => setBanner('')} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <label className={small + ' flex cursor-pointer items-center justify-center gap-1'}>
          {busy === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {banner ? 'CHANGE BANNER' : '+ ADD BANNER'}
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickFile(f, 'banner'); }} />
        </label>
      </div>

      {msg && <p className="px-1 text-[12px] text-rose-300">{msg}</p>}
      <button type="button" onClick={() => void save()} disabled={!!busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[13px] font-bold text-white disabled:opacity-60">
        {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} SAVE CATEGORY
      </button>
    </div>
  );
};
