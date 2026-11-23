import React, { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CrudField, SingleRowForm, labelCls } from '../workspace/CrudSection';

/** 15 DEVELOPER PROFILE: the admin's public details shown on the website and in About ROSE. English only. */
const FIELDS: CrudField[] = [
  { key: 'full_name', label: 'FULL NAME', type: 'text', required: true },
  { key: 'title', label: 'TITLE', type: 'text', placeholder: 'Founder & Developer, ROSE' },
  { key: 'about', label: 'ABOUT (SHORT BIO)', type: 'textarea' },
  { key: 'photo_url', label: 'PHOTO LINK (OR UPLOAD ABOVE)', type: 'text' },
  { key: 'email', label: 'EMAIL', type: 'text' },
  { key: 'phone', label: 'PHONE', type: 'text', placeholder: '+880 1XXX-XXXXXX' },
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
  { key: 'x_twitter', label: 'X (TWITTER) LINK', type: 'text' },
];

export const AdminDeveloperProfilePage: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setMsg('Choose an image file.');
    if (file.size > 4 * 1024 * 1024) return setMsg('Image must be under 4 MB.');
    setBusy(true);
    setMsg('');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `developer/photo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    const url = supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl;
    const { error: e2 } = await supabase.from('developer_profile').upsert({ id: 1, photo_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setBusy(false);
    if (e2) return setMsg(e2.message);
    setPhoto(url);
    setMsg('Photo updated.');
    setFormKey((k) => k + 1); // reload form so PHOTO LINK shows the new URL
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[4px] border border-white/[0.08] bg-[#11151E] p-4">
        <p className={labelCls}>PHOTO</p>
        <div className="mt-2 flex items-center gap-3">
          {photo && <img src={photo} alt="" className="h-14 w-14 rounded-[4px] object-cover" />}
          <label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-dashed border-teal-400/60 text-xs font-bold tracking-widest text-teal-300">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} UPLOAD PHOTO
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="mt-2 text-xs text-teal-300">{msg}</p>}
        <p className="mt-2 text-[10.5px] text-slate-500">Everything here is public: it shows on the website and in About ROSE.</p>
      </div>
      <SingleRowForm key={formKey} table="developer_profile" match={{ id: '1' }} fields={FIELDS} />
    </div>
  );
};
