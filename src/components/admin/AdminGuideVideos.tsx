import React from 'react';
import { CrudConfig, CrudSection } from '../workspace/CrudSection';
import { youtubeId } from '../TutorialVideos';

const VIDEOS: CrudConfig = {
  table: 'tutorial_videos',
  title: 'TUTORIAL VIDEOS',
  titleKey: 'title',
  subKey: 'youtube_url',
  badgeKey: 'audience',
  orderBy: { column: 'sort', ascending: true },
  emptyText: 'No videos yet. Upload a video on the ROSE YouTube channel, then paste the link here.',
  renderLead: (r) => {
    const id = youtubeId(r.youtube_url);
    return id ? <img src={`https://i.ytimg.com/vi/${id}/default.jpg`} alt="" className="h-9 w-14 shrink-0 rounded-[3px] object-cover" /> : null;
  },
  fields: [
    {
      key: 'audience',
      label: 'SHOW TO',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { value: 'all', label: 'EVERYONE (WEBSITE + APP)' },
        { value: 'personal', label: 'PERSONAL USERS' },
        { value: 'student', label: 'STUDENTS' },
        { value: 'business', label: 'BUSINESS USERS' },
      ],
    },
    { key: 'title', label: 'TITLE', type: 'text', required: true, placeholder: 'How to use ROSE for business' },
    { key: 'youtube_url', label: 'YOUTUBE LINK', type: 'text', required: true, placeholder: 'https://youtu.be/...' },
    { key: 'description', label: 'SHORT DESCRIPTION', type: 'textarea' },
    { key: 'sort', label: 'ORDER (1 = FIRST)', type: 'number', defaultValue: 1 },
    { key: 'is_active', label: 'SHOW', type: 'bool', defaultValue: true },
  ],
};

/** Admin > 21 TUTORIAL VIDEOS: YouTube links shown in the app (by mode) and on the website. */
export const AdminVideosPage: React.FC = () => (
  <div className="space-y-3">
    <div className="rounded-[4px] border border-red-500/30 bg-red-500/[0.06] p-3 text-[11px] leading-relaxed text-slate-300">
      <p className="mb-1 text-[11.5px] font-extrabold tracking-wider text-red-200">ROSE YOUTUBE CHANNEL · 3 VIDEOS</p>
      <b className="text-white">PERSONAL:</b> install ROSE, sign in, talk by voice, type, search, YouTube, songs, maps, WhatsApp, Writer, Tasks.
      <br />
      <b className="text-white">STUDENT:</b> notes, routine, practice tests, step-by-step answers, essays and applications.
      <br />
      <b className="text-white">BUSINESS:</b> Start Here guide, profile, products, FAQ, couriers, orders, customer check, approvals by email, dashboard, profit.
      <br />
      Choose <b className="text-white">SHOW TO</b> so each user sees only their own video at the top of 07 WORKSPACE. EVERYONE videos also show on the website.
    </div>
    <CrudSection config={VIDEOS} scope={{}} />
  </div>
);

const GUIDE: Array<[string, string, string, string]> = [
  ['01', 'dashboard', 'DASHBOARD', 'Total users, premium, blocked, new and active today, ages, users by mode.'],
  ['02', 'users', 'USERS', 'Search any user. Tap a Gmail: photo, plan, block, note, GIVE PREMIUM & CREDITS (text / voice), FORCE LOGOUT.'],
  ['03', 'give_premium', 'GIVE PREMIUM', 'Type a Gmail and give premium and credits fast.'],
  ['04', 'payments', 'PAYMENTS', 'bKash / Nagad / Rocket requests. APPROVE adds the package credits, REJECT tells the user.'],
  ['05', 'plans', 'PLANS & PRICES', 'Payment numbers, free daily limit, AI models and cost per reply, every package with price, credits, max AI cost and profit.'],
  ['06', 'gifts', 'GIFT CODES', 'Make codes that give months and credits (giveaways, partners).'],
  ['07', 'income', 'INCOME', 'Money received: today, month, total, recent payments.'],
  ['08', 'logins', 'LOGIN ACTIVITY', 'Who signed in or out, when and on which device.'],
  ['09', 'notify_all', 'NOTIFY ALL', 'Send one notification to every user.'],
  ['10', '', 'MOTIVATION', 'Post today\'s motivation. ROSE reads it when users ask.'],
  ['11', 'developer_tools', 'DEVELOPER TOOLS', 'Error log and technical checks.'],
  ['12', 'api_providers', 'API PROVIDERS', 'Which AI services are on and their limits.'],
  ['13', 'system_logs', 'SYSTEM LOGS', 'App errors and security events.'],
  ['14', 'deletions', 'DELETE REQUESTS', 'Users who asked to delete their account (store rule).'],
  ['15', 'dev_profile', 'DEVELOPERS', 'Public developer profiles and photos on the website.'],
  ['16', 'businesses', 'BUSINESSES', 'Every business: owner, call / email, turn business access ON / OFF, notify.'],
  ['17', 'team_activity', 'TEAM ACTIVITY', 'Tasks done by the ROSE team agents (ROSE, MIRA, ARIN, ZAYAN, NAIRA).'],
  ['18', 'reports', 'REPORTS & FEEDBACK', 'Problems users sent (reply, seen, fixed, close) and 👍 / 👎 totals.'],
  ['19', 'team_list', 'IMTIAZ LIST', 'PC install list and app work for Imtiaz. He ticks items done.'],
  ['20', 'store', 'STORE READINESS', 'Everything Google Play and Microsoft Store need: policies, data safety, rating, payments, screenshots.'],
  ['21', 'videos', 'TUTORIAL VIDEOS', 'YouTube links for Personal, Student and Business how-to videos.'],
  ['22', 'website_builder', 'WEBSITE BUILDER', 'DEMO plan of the ROSE store builder: hosting, plans, 6 demo stores, store admin bars, SEO, live chat.'],
];

/** Admin > 00 ADMIN GUIDE: what every admin bar is for. */
export const AdminGuidePage: React.FC<{ onOpen: (view: string) => void }> = ({ onOpen }) => (
  <div className="space-y-1.5">
    <p className="px-1 pb-1 text-[11px] text-slate-400">Tap a row to open that bar.</p>
    {GUIDE.map(([n, v, t, d]) => (
      <button
        key={n}
        type="button"
        disabled={!v}
        onClick={() => v && onOpen(v)}
        className="flex w-full items-start gap-2.5 rounded-[4px] border border-white/[0.08] bg-[#11151E] px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span className="mt-0.5 flex h-6 w-7 shrink-0 items-center justify-center rounded-[3px] bg-white/[0.06] font-mono text-[10.5px] font-bold text-teal-300">{n}</span>
        <span className="min-w-0">
          <span className="block text-[11.5px] font-bold text-white">{t}</span>
          <span className="block text-[10.5px] leading-snug text-slate-400">{d}</span>
        </span>
      </button>
    ))}
  </div>
);
