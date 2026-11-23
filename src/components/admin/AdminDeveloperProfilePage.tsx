import React, { useState } from 'react';
import { Copy, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CrudConfig, CrudSection, labelCls } from '../workspace/CrudSection';

/** 15 DEVELOPERS: people shown on myrosebd.com/developers and in About ROSE. English only, all public. */
const DEVELOPERS: CrudConfig = {
  table: 'developers',
  title: 'DEVELOPERS',
  titleKey: 'full_name',
  subKey: 'title',
  badgeKey: 'sort',
  orderBy: { column: 'sort', ascending: true },
  emptyText: 'No developers yet.',
  fields: [
    { key: 'full_name', label: 'FULL NAME', type: 'text', required: true },
    { key: 'title', label: 'TITLE', type: 'text', placeholder: 'Web Developer' },
    { key: 'slug', label: 'PAGE ID (SHORT, NO SPACES)', type: 'text', placeholder: 'imtiaz' },
    { key: 'sort', label: 'ORDER (0 = FIRST)', type: 'number', defaultValue: 0 },
    { key: 'is_active', label: 'SHOW ON WEBSITE', type: 'bool', defaultValue: true },
    { key: 'photo_url', label: 'PHOTO LINK (UPLOAD ABOVE, THEN PASTE)', type: 'text' },
    { key: 'about', label: 'ABOUT (SHORT BIO)', type: 'textarea' },
    { key: 'skills', label: 'SKILLS (COMMA SEPARATED)', type: 'text', placeholder: 'Web apps, Android, AI' },
    { key: 'email', label: 'EMAIL', type: 'text' },
    { key: 'phone', label: 'PHONE', type: 'text' },
    { key: 'whatsapp', label: 'WHATSAPP', type: 'text' },
    { key: 'bkash', label: 'BKASH NUMBER', type: 'text' },
    { key: 'nagad', label: 'NAGAD NUMBER', type: 'text' },
    { key: 'address', label: 'ADDRESS', type: 'textarea' },
    { key: 'website', label: 'WEBSITE', type: 'text' },
    { key: 'facebook', label: 'FACEBOOK LINK', type: 'text' },
    { key: 'youtube', label: 'YOUTUBE LINK', type: 'text' },
    { key: 'tiktok', label: 'TIKTOK LINK', type: 'text' },
    { key: 'instagram', label: 'INSTAGRAM LINK', type: 'text' },
    { key: 'telegram', label: 'TELEGRAM LINK', type: 'text' },
    { key: 'linkedin', label: 'LINKEDIN LINK', type: 'text' },
    { key: 'github', label: 'GITHUB LINK', type: 'text' },
    { key: 'x_twitter', label: 'X (TWITTER) LINK', type: 'text' },
  ],
};

export const AdminDeveloperProfilePage: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setMsg('Choose an image file.');
    if (file.size > 4 * 1024 * 1024) return setMsg('Image must be under 4 MB.');
    setBusy(true);
    setMsg('');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `developers/photo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true, contentType: file.type });
    setBusy(false);
    if (error) return setMsg(error.message);
    setUrl(supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl);
    setMsg('Uploaded. Copy the link and paste it into PHOTO LINK of a developer.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-4">
        <p className={labelCls}>UPLOAD A PHOTO</p>
        <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-dashed border-teal-400/60 text-xs font-bold tracking-widest text-teal-300">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} CHOOSE IMAGE
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        {url && (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(url).then(() => setMsg('Link copied.'))}
            className="mt-2 flex w-full items-center gap-2 rounded-[4px] bg-black/40 px-3 py-2 text-left text-[10.5px] text-slate-300"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{url}</span>
          </button>
        )}
        {msg && <p className="mt-2 text-xs text-teal-300">{msg}</p>}
        <p className="mt-2 text-[10.5px] text-slate-500">
          Everything here is public: myrosebd.com/developers and About ROSE.
        </p>
      </div>
      <CrudSection config={DEVELOPERS} scope={{}} />
    </div>
  );
};
