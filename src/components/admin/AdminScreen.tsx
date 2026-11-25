import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Send,
  Shield,
  Users,
  BarChart3,
  Wrench,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  AdminStats,
  ErrorLogEntry,
  TiyaSettings,
  UserProfile,
  VoiceState,
} from '../../types/tiya';
import { calculateAge, computePaidUntilIso } from '../../utils/authErrors';
import { DeveloperToolsPage } from '../settings/DeveloperPrivacyPages';
import { PremiumGrantCard } from './PremiumGrantCard';
import { AdminGiftCodesPage, AdminIncomePage, AdminPaymentsPage, AdminPlansPage } from './AdminSalesPages';
import { SettingsBar } from '../settings/SettingsShell';
import { AdminGivePremiumPage, AdminLoginActivityPage, ForceLogoutButton } from './AdminUserControl';
import { AdminDeveloperProfilePage } from './AdminDeveloperProfilePage';
import { AdminBusinessesPage, AdminTeamActivityPage } from './AdminBusinessPages';
import { UserAvatar } from './UserAvatar';
import { AdminReportsPage } from './AdminReportsPage';
import { TeamChecklist } from '../settings/TeamChecklist';
import { AdminVideosPage, AdminGuidePage } from './AdminGuideVideos';
import { AdminWebsiteBuilderDemo } from './AdminWebsiteBuilderDemo';
import { AdminWebsiteAccessPage } from './AdminWebsiteAccessPage';
import { AdminBrandCard, AdminBrandPage, AdminSiteSwitchesPage } from './AdminBrandPage';
import { AdminApiProvidersPage, AdminDeletionRequestsPage, AdminOverviewTiles, AdminSystemLogsPage } from './AdminSystemPages';

type AdminView =
  | 'hub'
  | 'dashboard'
  | 'users'
  | 'user_detail'
  | 'notify_all'
  | 'give_premium'
  | 'api_providers'
  | 'system_logs'
  | 'deletions'
  | 'dev_profile'
  | 'businesses'
  | 'team_activity'
  | 'reports'
  | 'team_list'
  | 'store'
  | 'videos'
  | 'guide'
  | 'logins'
  | 'payments'
  | 'plans'
  | 'gifts'
  | 'income'
  | 'developer_tools'
  | 'website_builder'
  | 'website_access'
  | 'brand'
  | 'site_switches';

interface AdminScreenProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  errorLog: ErrorLogEntry[];
  onClearErrorLog: () => void;
  onBackToHome: () => void;
  /** Motivation writing page (moved here from HOME) */
  onOpenMotivation?: () => void;
  onLogout: () => void;
  /** PC: show only the admin bars (left pane); picking one calls onPick */
  navOnly?: boolean;
  onPick?: (view: string) => void;
  /** PC: the page chosen in the left pane (right pane follows it) */
  controlledView?: string | null;
  activeView?: string | null;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  settings,
  voiceState,
  errorLog,
  onClearErrorLog,
  onBackToHome,
  onOpenMotivation,
  onLogout,
  navOnly = false,
  onPick,
  controlledView = null,
  activeView = null,
}) => {
  const [view, setView] = useState<AdminView>((controlledView as AdminView) || 'hub');
  const [pendingPayments, setPendingPayments] = useState(0);
  const [openReports, setOpenReports] = useState(0);
  useEffect(() => {
    void supabase
      .from('user_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .then(({ count }) => setOpenReports(count || 0));
  }, [view]);

  // PC: right pane follows the bar picked on the left; never shows the bar list itself
  useEffect(() => {
    if (controlledView && controlledView !== view) setView(controlledView as AdminView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledView]);
  useEffect(() => {
    if (controlledView && view === 'hub') setView((controlledView as AdminView) || 'dashboard');
  }, [controlledView, view]);

  // show how many payments wait for approval on the PAYMENTS bar
  useEffect(() => {
    if (view !== 'hub') return;
    void supabase
      .from('payment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingPayments(count || 0));
  }, [view]);
  const [devSubpage, setDevSubpage] = useState<string | null>(null);

  // Dashboard state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  // Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // User Detail editable draft
  const [draftPremium, setDraftPremium] = useState(false);
  const [draftMonths, setDraftMonths] = useState<1 | 3 | 6 | 12>(1);
  const [monthsTouched, setMonthsTouched] = useState(false);
  const [draftDailyLimit, setDraftDailyLimit] = useState('');
  const [draftBlocked, setDraftBlocked] = useState(false);
  const [draftBirthYear, setDraftBirthYear] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [saveUserMsg, setSaveUserMsg] = useState('');

  // Per-user notification
  const [userNotifTitle, setUserNotifTitle] = useState('');
  const [userNotifBody, setUserNotifBody] = useState('');
  const [sendingUserNotif, setSendingUserNotif] = useState(false);
  const [userNotifMsg, setUserNotifMsg] = useState('');

  // Notify all state
  const [allTitle, setAllTitle] = useState('');
  const [allBody, setAllBody] = useState('');
  const [sendingAll, setSendingAll] = useState(false);
  const [allStatus, setAllStatus] = useState('');

  // Pull-to-refresh touch tracking (only triggers manual refresh when pulled at scrollTop === 0)
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) {
        setStatsError(error.message);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row === 'object') {
        setStats(row as AdminStats);
      }
    } catch {
      setStatsError('Failed to fetch stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('last_seen_at', { ascending: false, nullsFirst: false });

      if (error) {
        setUsersError(error.message);
        return;
      }
      // The database column is is_blocked; keep "blocked" in step for the UI
      setUsers(
        ((data as UserProfile[]) || []).map((u) => ({
          ...u,
          blocked: Boolean(u.is_blocked ?? u.blocked),
        })),
      );
      setUsersLoaded(true);
    } catch {
      setUsersError('Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Load initial view data once on entering a view (never auto-refreshes afterwards)
  useEffect(() => {
    if (view === 'dashboard' && !stats && !statsLoading) {
      loadStats();
    } else if (view === 'users' && !usersLoaded && !usersLoading) {
      loadUsers();
    }
  }, [view, stats, statsLoading, usersLoaded, usersLoading, loadStats, loadUsers]);

  const handleManualRefresh = useCallback(async () => {
    if (view === 'dashboard') {
      await loadStats();
    } else if (view === 'users' || view === 'user_detail') {
      await loadUsers();
    } else if (view === 'hub') {
      await loadStats();
    }
  }, [view, loadStats, loadUsers]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      pullStartYRef.current = e.touches[0].clientY;
    } else {
      pullStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartYRef.current === null) return;
    const delta = e.touches[0].clientY - pullStartYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(80, delta));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 56) {
      handleManualRefresh();
    }
    pullStartYRef.current = null;
    setPullDistance(0);
  };

  const openUserDetail = (user: UserProfile) => {
    setSelectedUser(user);
    const isPrem = (user.plan || '').toLowerCase() === 'premium';
    setDraftPremium(isPrem);
    setDraftMonths(1);
    setMonthsTouched(false);
    setDraftDailyLimit(
      typeof user.daily_limit === 'number' ? String(user.daily_limit) : '',
    );
    setDraftBlocked(Boolean(user.blocked));
    setDraftBirthYear(
      typeof user.birth_year === 'number' ? String(user.birth_year) : '',
    );
    setDraftNote(user.admin_note || '');
    setSaveUserMsg('');
    setUserNotifTitle('');
    setUserNotifBody('');
    setUserNotifMsg('');
    setView('user_detail');
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    setSaveUserMsg('');

    const parsedLimit =
      draftDailyLimit.trim() === '' ? null : Math.max(0, Number(draftDailyLimit));
    const parsedBirth =
      draftBirthYear.trim() === '' ? null : Number(draftBirthYear);

    if (
      parsedBirth !== null &&
      (!Number.isInteger(parsedBirth) ||
        parsedBirth < 1920 ||
        parsedBirth > new Date().getFullYear())
    ) {
      setSaveUserMsg('Invalid birth year.');
      setSavingUser(false);
      return;
    }

    const nextPlan = draftPremium ? 'premium' : 'free';
    // Keep an existing (e.g. granted) expiry unless the admin picked new months
    const currentExpiry = selectedUser.paid_until ? new Date(selectedUser.paid_until).getTime() : 0;
    const keepExpiry =
      draftPremium && !monthsTouched && currentExpiry > Date.now() &&
      (selectedUser.plan || '').toLowerCase() === 'premium';
    const nextPaidUntil = draftPremium
      ? keepExpiry
        ? selectedUser.paid_until
        : computePaidUntilIso(draftMonths)
      : null;

    const patch: Partial<UserProfile> = {
      plan: nextPlan,
      paid_until: nextPaidUntil,
      daily_limit: parsedLimit,
      is_blocked: draftBlocked,
      birth_year: parsedBirth,
      admin_note: draftNote.trim() || null,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', selectedUser.id);

      if (error) {
        setSaveUserMsg(error.message);
        return;
      }

      const updated: UserProfile = { ...selectedUser, ...patch, blocked: draftBlocked };
      setSelectedUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSaveUserMsg('Saved.');
    } catch {
      setSaveUserMsg('Network error while saving.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleSendUserNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!userNotifTitle.trim() || !userNotifBody.trim()) {
      setUserNotifMsg('Enter both title and message.');
      return;
    }

    setSendingUserNotif(true);
    setUserNotifMsg('');
    try {
      const { error } = await supabase.rpc('admin_notify', {
        target: selectedUser.id,
        t: userNotifTitle.trim(),
        b: userNotifBody.trim(),
      });
      if (error) {
        setUserNotifMsg(error.message);
      } else {
        setUserNotifTitle('');
        setUserNotifBody('');
        setUserNotifMsg('Notification sent.');
      }
    } catch {
      setUserNotifMsg('Failed to send notification.');
    } finally {
      setSendingUserNotif(false);
    }
  };

  const handleNotifyAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allTitle.trim() || !allBody.trim()) {
      setAllStatus('Enter both title and message.');
      return;
    }

    setSendingAll(true);
    setAllStatus('');
    try {
      const { error } = await supabase.rpc('admin_notify', {
        target: null,
        t: allTitle.trim(),
        b: allBody.trim(),
      });
      if (error) {
        setAllStatus(error.message);
      } else {
        setAllTitle('');
        setAllBody('');
        setAllStatus('Broadcast notification sent to all users.');
      }
    } catch {
      setAllStatus('Failed to send broadcast notification.');
    } finally {
      setSendingAll(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.plan || '').toLowerCase().includes(q)
    );
  });

  const handleHeaderBack = () => {
    if (view === 'user_detail') {
      setView('users');
    } else if (view !== 'hub') {
      setView('hub');
    } else {
      onBackToHome();
    }
  };

  const headerTitle =
    view === 'hub'
      ? 'Admin'
      : view === 'user_detail'
        ? selectedUser?.full_name || selectedUser?.email || 'User Detail'
        : (
            {
              dashboard: '01 Dashboard',
              users: '02 Users',
              give_premium: '03 Give Premium',
              payments: '04 Payments',
              plans: '05 Plans & Prices',
              gifts: '06 Gift Codes',
              income: '07 Income',
              logins: '08 Login Activity',
              notify_all: '09 Notify All',
              api_providers: '12 API Providers',
              system_logs: '13 System Logs',
              deletions: '14 Delete Requests',
              dev_profile: '15 Developers',
              businesses: '16 Businesses',
              team_activity: '17 Team Activity',
              reports: '18 Reports & Feedback',
              team_list: '19 Imtiaz List',
              store: '20 Store Readiness',
              videos: '21 Tutorial Videos',
              website_builder: '22 Website Builder',
              website_access: '23 Website Access',
              brand: 'myrosebd.com',
              site_switches: '24 Site Switches',
              guide: '00 Admin Guide',
            } as Record<string, string>
          )[view] || 'Admin';

  const isRefreshing = statsLoading || usersLoading;

  const go = (v: AdminView) => {
    if (navOnly) onPick?.(v);
    else setView(v);
  };
  const hubBars = (
          <div className="space-y-1.5">
            <AdminBrandCard onOpen={() => go('brand')} />
            <SettingsBar badge="00" title="ADMIN GUIDE" value="WHAT IS WHERE" tone={activeView === 'guide' ? 'accent' : 'default'} onClick={() => go('guide')} testId="admin-bar-guide" />
            <SettingsBar badge="01" title="DASHBOARD" tone={activeView === 'dashboard' ? 'accent' : 'default'} onClick={() => go('dashboard')} testId="admin-bar-dashboard" />
            <SettingsBar badge="02" title="USERS" tone={activeView === 'users' ? 'accent' : 'default'} onClick={() => go('users')} testId="admin-bar-users" />
            <SettingsBar badge="03" title="GIVE PREMIUM" value="GMAIL" tone="accent" onClick={() => go('give_premium')} testId="admin-bar-give-premium" />
            <SettingsBar
              badge="04"
              title="PAYMENTS"
              value={pendingPayments > 0 ? `${pendingPayments} NEW` : undefined}
              tone={pendingPayments > 0 || activeView === 'payments' ? 'accent' : 'default'}
              onClick={() => go('payments')}
              testId="admin-bar-payments"
            />
            <SettingsBar badge="05" title="PLANS & PRICES" tone={activeView === 'plans' ? 'accent' : 'default'} onClick={() => go('plans')} testId="admin-bar-plans" />
            <SettingsBar badge="06" title="GIFT CODES" tone={activeView === 'gifts' ? 'accent' : 'default'} onClick={() => go('gifts')} testId="admin-bar-gifts" />
            <SettingsBar badge="07" title="INCOME" tone={activeView === 'income' ? 'accent' : 'default'} onClick={() => go('income')} testId="admin-bar-income" />
            <SettingsBar badge="08" title="LOGIN ACTIVITY" tone={activeView === 'logins' ? 'accent' : 'default'} onClick={() => go('logins')} testId="admin-bar-logins" />
            <SettingsBar badge="09" title="NOTIFY ALL" tone={activeView === 'notify_all' ? 'accent' : 'default'} onClick={() => go('notify_all')} testId="admin-bar-notify" />
            {onOpenMotivation && (
              <SettingsBar badge="10" title="MOTIVATION" onClick={onOpenMotivation} testId="admin-motivation-btn" />
            )}
            <SettingsBar
              badge="11"
              title="DEVELOPER TOOLS"
              onClick={() => {
                setDevSubpage(null);
                go('developer_tools');
              }}
              testId="admin-developer-tools-btn"
            />
            <SettingsBar badge="12" title="API PROVIDERS" tone={activeView === 'api_providers' ? 'accent' : 'default'} onClick={() => go('api_providers')} testId="admin-bar-api" />
            <SettingsBar badge="13" title="SYSTEM LOGS" tone={activeView === 'system_logs' ? 'accent' : 'default'} onClick={() => go('system_logs')} testId="admin-bar-logs" />
            <SettingsBar badge="14" title="DELETE REQUESTS" tone={activeView === 'deletions' ? 'accent' : 'default'} onClick={() => go('deletions')} testId="admin-bar-deletions" />
            <SettingsBar badge="15" title="DEVELOPERS" value="PUBLIC" tone={activeView === 'dev_profile' ? 'accent' : 'default'} onClick={() => go('dev_profile')} testId="admin-bar-dev-profile" />
            <SettingsBar badge="16" title="BUSINESSES" tone={activeView === 'businesses' ? 'accent' : 'default'} onClick={() => go('businesses')} testId="admin-bar-businesses" />
            <SettingsBar badge="17" title="TEAM ACTIVITY" tone={activeView === 'team_activity' ? 'accent' : 'default'} onClick={() => go('team_activity')} testId="admin-bar-team" />
            <SettingsBar badge="18" title="REPORTS & FEEDBACK" value={openReports > 0 ? `${openReports} NEW` : undefined} tone={openReports > 0 || activeView === 'reports' ? 'accent' : 'default'} onClick={() => go('reports')} testId="admin-bar-reports" />
            <SettingsBar badge="19" title="IMTIAZ LIST" value="PC & APP" tone={activeView === 'team_list' ? 'accent' : 'default'} onClick={() => go('team_list')} testId="admin-bar-team-list" />
            <SettingsBar badge="20" title="STORE READINESS" value="PLAY · MS" tone={activeView === 'store' ? 'accent' : 'default'} onClick={() => go('store')} testId="admin-bar-store" />
            <SettingsBar badge="21" title="TUTORIAL VIDEOS" value="YOUTUBE" tone={activeView === 'videos' ? 'accent' : 'default'} onClick={() => go('videos')} testId="admin-bar-videos" />
            <SettingsBar badge="22" title="WEBSITE BUILDER" value="STORES · LIVE" tone={activeView === 'website_builder' ? 'accent' : 'default'} onClick={() => go('website_builder')} testId="admin-bar-website-builder" />
            <SettingsBar badge="23" title="WEBSITE ACCESS" value="GMAIL" tone={activeView === 'website_access' ? 'accent' : 'default'} onClick={() => go('website_access')} testId="admin-bar-website-access" />
            <SettingsBar badge="24" title="SITE SWITCHES" value="ROSE BRANDING" tone={activeView === 'site_switches' ? 'accent' : 'default'} onClick={() => go('site_switches')} testId="admin-bar-site-switches" />
          </div>
  );

  if (navOnly) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] px-4 pt-[env(safe-area-inset-top)] [min-height:calc(3rem+env(safe-area-inset-top))]">
          <span className="text-sm font-semibold tracking-wider text-amber-200">ADMIN</span>
        </header>
        <div className="tiya-scroll flex-1 overflow-y-auto px-3.5 py-3">{hubBars}</div>
      </div>
    );
  }

  if (view === 'developer_tools') {
    return (
      <DeveloperToolsPage
        settings={settings}
        voiceState={voiceState}
        errorLog={errorLog}
        subpage={devSubpage}
        onSelectSubpage={setDevSubpage}
        onClearErrorLog={onClearErrorLog}
        onBack={() => {
          setDevSubpage(null);
          setView('hub');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Admin Top Header */}
      <header className="flex shrink-0 pt-[env(safe-area-inset-top)] [min-height:calc(3.25rem+env(safe-area-inset-top))] items-center justify-between border-b border-slate-200 px-2 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={handleHeaderBack}
          className="flex min-h-[44px] min-w-[64px] shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-medium text-teal-600 hover:bg-slate-100 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{view === 'hub' ? 'Home' : 'Back'}</span>
        </button>

        <h1 className="font-display min-w-0 flex-1 truncate px-1 text-center text-sm font-semibold text-slate-900 dark:text-[#F4F5F7]">
          {headerTitle}
        </h1>

        <div className="flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh admin data"
            className="flex min-h-[44px] min-w-[44px] justify-center items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-teal-600 hover:bg-slate-100 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-white/[0.06]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden min-[400px]:inline">REFRESH</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="flex min-h-[44px] min-w-[44px] justify-center items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden min-[400px]:inline">LOGOUT</span>
          </button>
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      {pullDistance > 16 && (
        <div className="shrink-0 bg-teal-500/10 py-1.5 text-center text-[11px] font-medium text-teal-600 dark:text-teal-400">
          {pullDistance >= 56 ? 'Release to refresh' : 'Pull down to refresh'}
        </div>
      )}

      {/* Body */}
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="tiya-scroll flex-1 overflow-y-auto px-4 py-4"
      >
        {view === 'hub' && hubBars}

        {view === 'payments' && <AdminPaymentsPage onCountChange={setPendingPayments} />}
        {view === 'plans' && <AdminPlansPage />}
        {view === 'gifts' && <AdminGiftCodesPage />}
        {view === 'income' && <AdminIncomePage />}
        {view === 'give_premium' && <AdminGivePremiumPage />}
        {view === 'logins' && <AdminLoginActivityPage />}
        {view === 'api_providers' && <AdminApiProvidersPage />}
        {view === 'system_logs' && <AdminSystemLogsPage />}
        {view === 'deletions' && <AdminDeletionRequestsPage />}
        {view === 'dev_profile' && <AdminDeveloperProfilePage />}
        {view === 'businesses' && <AdminBusinessesPage />}
        {view === 'team_activity' && <AdminTeamActivityPage />}
        {view === 'reports' && <AdminReportsPage />}
        {view === 'team_list' && <TeamChecklist canEdit listName="IMTIAZ LIST" />}
        {view === 'store' && <TeamChecklist canEdit listName="STORE READINESS" />}
        {view === 'videos' && <AdminVideosPage />}
        {view === 'website_builder' && <AdminWebsiteBuilderDemo />}
        {view === 'website_access' && <AdminWebsiteAccessPage />}
        {view === 'brand' && <AdminBrandPage />}
        {view === 'site_switches' && <AdminSiteSwitchesPage />}
        {view === 'guide' && <AdminGuidePage onOpen={(v) => setView(v as AdminView)} />}

        {view === 'dashboard' && (
          <div className="space-y-4">
            {statsError && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                {statsError}
              </p>
            )}

            {statsLoading && !stats ? (
              <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading stats...
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Total Users', value: stats.total },
                  { label: 'Premium', value: stats.premium },
                  { label: 'Blocked', value: stats.blocked },
                  { label: 'New Today', value: stats.new_today },
                  { label: 'Active Today', value: stats.active_today },
                  { label: 'Adults (18+)', value: stats.adults },
                  { label: 'Teens (<18)', value: stats.teens },
                  { label: 'Age Unknown', value: stats.age_unknown },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#11151E]"
                  >
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {metric.label}
                    </p>
                    <p className="font-mono-code mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      {metric.value ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            <AdminOverviewTiles />
          </div>
        )}

        {view === 'users' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, name, or plan..."
                aria-label="Search users"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#11151E] dark:text-white"
              />
            </div>

            {usersError && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                {usersError}
              </p>
            )}

            {usersLoading && !usersLoaded ? (
              <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading users...
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
                {filteredUsers.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No matching users found.
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => openUserDetail(u)}
                      className="flex min-h-[60px] w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <UserAvatar src={(u as any).avatar_url} name={u.full_name} email={u.email} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {u.full_name || 'Unnamed'} ·{' '}
                          <span className="font-normal text-teal-600 dark:text-teal-400">
                            {u.plan || 'free'}
                          </span>
                          {u.blocked ? (
                            <span className="text-rose-500"> · Blocked</span>
                          ) : null}
                          {(u.premium_text_left || u.premium_voice_left) ? (
                            <span className="font-normal text-amber-500 dark:text-amber-300">
                              {' '}· T {u.premium_text_left ?? 0} · V {u.premium_voice_left ?? 0}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {u.email || u.id}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          Last seen:{' '}
                          {u.last_seen_at
                            ? new Date(u.last_seen_at).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {view === 'user_detail' && selectedUser && (
          <div className="space-y-4 pb-6">
            {/* Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
              <div className="flex items-center gap-3">
                <UserAvatar src={(selectedUser as any).avatar_url} name={selectedUser.full_name} email={selectedUser.email} size={56} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedUser.full_name || 'Unnamed User'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <span>
                  Age: {calculateAge(selectedUser.birth_year) ?? 'Unknown'}
                </span>
                <span>·</span>
                <span>Plan: {selectedUser.plan || 'free'}</span>
                <span>·</span>
                <span>Used today: {selectedUser.used_today ?? 0}</span>
              </div>
            </div>

            {/* GRANT PREMIUM (months + voice/text replies + payment record) */}
            <PremiumGrantCard
              user={selectedUser}
              onUpdated={(patchP) => {
                const upd: UserProfile = { ...selectedUser, ...patchP };
                setSelectedUser(upd);
                setDraftPremium(true);
                setUsers((prev) => prev.map((u) => (u.id === upd.id ? upd : u)));
              }}
            />

            {/* Editable Controls */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]">
              {/* PREMIUM ON/OFF + Months */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    PREMIUM
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sets plan and paid_until
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draftPremium}
                  onClick={() => setDraftPremium((p) => !p)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    draftPremium ? 'bg-teal-600' : 'bg-slate-300 dark:bg-white/15'
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                      draftPremium ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {draftPremium && (
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                    DURATION (MONTHS)
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {([1, 3, 6, 12] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setDraftMonths(m);
                          setMonthsTouched(true);
                        }}
                        className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                          draftMonths === m
                            ? 'bg-teal-600 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DAILY LIMIT */}
              <div>
                <label
                  htmlFor="admin-daily-limit"
                  className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
                >
                  DAILY LIMIT (EMPTY = UNLIMITED)
                </label>
                <input
                  id="admin-daily-limit"
                  type="number"
                  min={0}
                  value={draftDailyLimit}
                  onChange={(e) => setDraftDailyLimit(e.target.value)}
                  placeholder="Unlimited"
                  className="font-mono-code mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
                />
              </div>

              {/* BIRTH YEAR */}
              <div>
                <label
                  htmlFor="admin-birth-year"
                  className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
                >
                  BIRTH YEAR
                </label>
                <input
                  id="admin-birth-year"
                  type="number"
                  min={1920}
                  max={new Date().getFullYear()}
                  value={draftBirthYear}
                  onChange={(e) => setDraftBirthYear(e.target.value)}
                  placeholder="Unknown"
                  className="font-mono-code mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
                />
              </div>

              {/* BLOCK / UNBLOCK */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    ACCOUNT STATUS
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {draftBlocked ? 'Blocked from replies' : 'Active'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftBlocked((b) => !b)}
                  className={`min-h-[40px] rounded-xl px-4 text-xs font-semibold ${
                    draftBlocked
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200'
                  }`}
                >
                  {draftBlocked ? 'UNBLOCK' : 'BLOCK'}
                </button>
              </div>

              {/* ADMIN NOTE */}
              <div>
                <label
                  htmlFor="admin-note-input"
                  className="block text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400"
                >
                  ADMIN NOTE
                </label>
                <textarea
                  id="admin-note-input"
                  rows={2}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Internal note about this user..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
                />
              </div>

              {saveUserMsg && (
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
                  {saveUserMsg}
                </p>
              )}

              <button
                type="button"
                disabled={savingUser}
                onClick={handleSaveUser}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
              >
                {savingUser && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>SAVE</span>
              </button>
            </div>


            {/* FORCE LOGOUT */}
            <ForceLogoutButton user={selectedUser} />

            {/* SEND NOTIFICATION TO USER */}
            <form
              onSubmit={handleSendUserNotification}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
            >
              <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                SEND NOTIFICATION
              </p>
              <input
                type="text"
                value={userNotifTitle}
                onChange={(e) => setUserNotifTitle(e.target.value)}
                placeholder="Notification title"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
              />
              <textarea
                rows={2}
                value={userNotifBody}
                onChange={(e) => setUserNotifBody(e.target.value)}
                placeholder="Notification message"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
              />
              {userNotifMsg && (
                <p className="text-xs text-teal-600 dark:text-teal-400">{userNotifMsg}</p>
              )}
              <button
                type="submit"
                disabled={sendingUserNotif}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Notification</span>
              </button>
            </form>
          </div>
        )}

        {view === 'notify_all' && (
          <form
            onSubmit={handleNotifyAll}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#11151E]"
          >
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              BROADCAST TO ALL USERS
            </p>
            <input
              type="text"
              value={allTitle}
              onChange={(e) => setAllTitle(e.target.value)}
              placeholder="Title"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />
            <textarea
              rows={4}
              value={allBody}
              onChange={(e) => setAllBody(e.target.value)}
              placeholder="Message"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-white/10 dark:bg-[#090B10] dark:text-white"
            />
            {allStatus && (
              <p className="text-xs text-teal-600 dark:text-teal-400">{allStatus}</p>
            )}
            <button
              type="submit"
              disabled={sendingAll}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
            >
              {sendingAll && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>SEND TO ALL</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
