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

type AdminView =
  | 'hub'
  | 'dashboard'
  | 'users'
  | 'user_detail'
  | 'notify_all'
  | 'developer_tools';

interface AdminScreenProps {
  settings: TiyaSettings;
  voiceState: VoiceState;
  errorLog: ErrorLogEntry[];
  onClearErrorLog: () => void;
  onBackToHome: () => void;
  onLogout: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  settings,
  voiceState,
  errorLog,
  onClearErrorLog,
  onBackToHome,
  onLogout,
}) => {
  const [view, setView] = useState<AdminView>('hub');
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
      : view === 'dashboard'
        ? '1. Dashboard'
        : view === 'users'
          ? '2. Users'
          : view === 'user_detail'
            ? selectedUser?.full_name || selectedUser?.email || 'User Detail'
            : '3. Notify All';

  const isRefreshing = statsLoading || usersLoading;

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
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 px-2 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={handleHeaderBack}
          className="flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-xs font-medium text-teal-600 hover:bg-slate-100 dark:text-teal-400 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{view === 'hub' ? 'Home' : 'Back'}</span>
        </button>

        <h1 className="font-display truncate px-2 text-sm font-semibold text-slate-900 dark:text-[#F4F5F7]">
          {headerTitle}
        </h1>

        <div className="flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh admin data"
            className="flex min-h-[40px] items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-teal-600 hover:bg-slate-100 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-white/[0.06]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="flex min-h-[40px] items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>LOGOUT</span>
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
        {view === 'hub' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Admin controls · Manual refresh only</span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-[#11151E] dark:divide-white/[0.06]">
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <span className="font-mono-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                    DASHBOARD
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Total, premium, blocked, active & age breakdown
                  </p>
                </div>
                <BarChart3 className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setView('users')}
                className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <span className="font-mono-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                    USERS
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Search users, manage Premium, limits, block & notes
                  </p>
                </div>
                <Users className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setView('notify_all')}
                className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <span className="font-mono-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                    NOTIFY ALL
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Send a broadcast notification to every user
                  </p>
                </div>
                <Bell className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                data-testid="admin-developer-tools-btn"
                onClick={() => {
                  setDevSubpage(null);
                  setView('developer_tools');
                }}
                className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <span className="font-mono-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-teal-700 dark:bg-white/[0.07] dark:text-teal-400">
                  4
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                    DEVELOPER TOOLS
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Error log, app status, diagnostics & system info
                  </p>
                </div>
                <Wrench className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}

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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {u.full_name || 'Unnamed'} ·{' '}
                          <span className="font-normal text-teal-600 dark:text-teal-400">
                            {u.plan || 'free'}
                          </span>
                          {u.blocked ? (
                            <span className="text-rose-500"> · Blocked</span>
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
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {selectedUser.full_name || 'Unnamed User'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {selectedUser.email}
              </p>
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
