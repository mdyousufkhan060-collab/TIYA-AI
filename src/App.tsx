import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  ChatMessage,
  ErrorLogEntry,
  MainTab,
  MemoryItem,
  MotivationPost,
  NotificationItem,
  PhoneAction,
  SettingsPageId,
  TiyaSettings,
  UserProfile,
} from './types/tiya';
import {
  appendErrorLog,
  clearAllChatsStorage,
  clearErrorLog,
  groupMessagesIntoChatSessions,
  loadChats,
  loadErrorLog,
  loadMemories,
  loadSettings,
  saveChats,
  saveMemories,
  saveSettings,
} from './utils/storage';
import {
  calculateAge,
  getCachedBirthYear,
  parseUseReplyResult,
  ReplyUsageDecision,
  setCachedBirthYear,
} from './utils/authErrors';
import { buildTiyaSystemPrompt, isTiyaOwnerEmail } from './utils/prompts';
import {
  executePhoneAction,
  openTracked,
  extractActionFromText,
  getConfirmationPromptText,
  requiresConfirmation,
  normalizeSearchSite,
} from './utils/phoneActions';
import {
  NavigationCommand,
  parseNavigationCommand,
  validateNavigateToolArgs,
} from './utils/tiyaNavigation';
import {
  formatMotivationReplyBn,
  hasBengaliScript,
  isMotivationRequest,
} from './utils/motivation';
import { useTiyaLiveVoice } from './hooks/useTiyaLiveVoice';
import { usePremiumVoice } from './hooks/usePremiumVoice';
import { TeamChecklist } from './components/settings/TeamChecklist';
import { SettingsShell } from './components/settings/SettingsShell';
import { ForgotPasswordFlow, usePwResetFlag } from './components/auth/ForgotPasswordFlow';
import { LoginScreen } from './components/auth/LoginScreen';
import { AgeCheckScreen } from './components/auth/AgeCheckScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { HomeScreen } from './components/HomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { BottomNav } from './components/BottomNav';
import { NotificationsSheet } from './components/NotificationsSheet';
import { AdminScreen } from './components/admin/AdminScreen';
import { MotivationScreen } from './components/admin/MotivationScreen';
import { SettingsHub } from './components/settings/SettingsHub';
import { ConnectionsPage } from './components/settings/ConnectionsPage';
import { VoiceLanguagePage } from './components/settings/VoiceLanguagePage';
import { ChatsMemoryPage } from './components/settings/ChatsMemoryPage';
import { PremiumPage, isProfilePremium } from './components/settings/PremiumPage';
import { premiumChat } from './lib/premium';
import { MyAccountPage } from './components/settings/MyAccountPage';
import {
  AboutGuidePage,
  PhoneControlPage,
} from './components/settings/AboutLookPhonePages';
import { PrivacyControlsPage } from './components/settings/DeveloperPrivacyPages';
import { WorkspacePage } from './components/workspace/WorkspacePage';
import { DesktopDashboard, DesktopRosePanel, DesktopTab, DesktopTeam, DesktopTopBar } from './components/desktop/DesktopHub';
import { WriterPanel } from './components/desktop/WriterPanel';
import { agentById, parseAgentCommand, runAgentTask } from './lib/agents';
import { clearModeContext, refreshModeContext } from './utils/modeContext';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [settings, setSettings] = useState<TiyaSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChats());
  const [memories, setMemories] = useState<MemoryItem[]>(() => loadMemories());
  const [errorLog, setErrorLog] = useState<ErrorLogEntry[]>(() => loadErrorLog());
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [settingsPage, setSettingsPage] = useState<SettingsPageId>('hub');
  const [settingsSubpage, setSettingsSubpage] = useState<string | null>(null);
  const [showAdminScreen, setShowAdminScreen] = useState(false);
  const [showMotivationScreen, setShowMotivationScreen] = useState(false);

  const navHistoryRef = useRef<
    Array<{ tab: MainTab; page: SettingsPageId; subpage: string | null }>
  >([]);
  const navStateRef = useRef({
    tab: activeTab,
    page: settingsPage,
    subpage: settingsSubpage,
  });
  navStateRef.current = {
    tab: activeTab,
    page: settingsPage,
    subpage: settingsSubpage,
  };

  // Supabase Auth & Account State
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [cachedBirthYear, setCachedBirthYearState] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [actionLinks, setActionLinks] = useState<Record<string, string>>({});

  const autoStartedListenRef = useRef(false);

  // Keep dark theme permanently fixed
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', '#090B10');
    }
  }, []);

  // Refresh error log when entering Admin Panel or Settings
  useEffect(() => {
    if (activeTab === 'settings' || showAdminScreen) {
      setErrorLog(loadErrorLog());
    }
  }, [activeTab, settingsPage, settingsSubpage, showAdminScreen]);

  // Restore persisted Supabase session & listen to auth changes
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      if (data.session?.user?.id) {
        setCachedBirthYearState(getCachedBirthYear(data.session.user.id));
      }
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      if (nextSession?.user?.id) {
        setCachedBirthYearState(getCachedBirthYear(nextSession.user.id));
      } else {
        setProfile(null);
        setProfileLoaded(false);
        setCachedBirthYearState(null);
        setIsAdmin(false);
        setNotifications([]);
        setShowAdminScreen(false);
      }
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadAccountData = useCallback(async (userId: string) => {
    setProfileLoaded(false);
    try {
      const [profileRes, adminRes, notifRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.rpc('is_admin'),
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (!profileRes.error && profileRes.data) {
        const prof = profileRes.data as UserProfile;
        setProfile(prof);
        if (typeof prof.birth_year === 'number') {
          setCachedBirthYear(userId, prof.birth_year);
          setCachedBirthYearState(prof.birth_year);
        }
      }

      if (!adminRes.error) {
        setIsAdmin(adminRes.data === true);
      } else {
        setIsAdmin(false);
      }

      if (!notifRes.error && Array.isArray(notifRes.data)) {
        setNotifications(notifRes.data as NotificationItem[]);
      }
    } catch {
      // Keep cached values if offline
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadAccountData(session.user.id);
    }
  }, [session?.user?.id, loadAccountData]);

  const effectiveBirthYear =
    typeof profile?.birth_year === 'number'
      ? profile.birth_year
      : cachedBirthYear;

  const userAge = calculateAge(effectiveBirthYear);
  // Owner (his Gmail + admin) always gets the emotional persona
  const isOwner = isAdmin && isTiyaOwnerEmail(session?.user?.email);

  const checkReplyUsage = useCallback(async (): Promise<ReplyUsageDecision> => {
    try {
      const { data, error } = await supabase.rpc('use_reply');
      return parseUseReplyResult(data, error);
    } catch (err: unknown) {
      return parseUseReplyResult(null, err);
    }
  }, []);

  const updateSettings = useCallback((partial: Partial<TiyaSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      saveChats(next);
      return next;
    });
  }, []);

  const navigateTo = useCallback(
    (tab: MainTab, page: SettingsPageId = 'hub', subpage: string | null = null) => {
      const cur = navStateRef.current;
      if (cur.tab !== tab || cur.page !== page || cur.subpage !== subpage) {
        navHistoryRef.current = [...navHistoryRef.current.slice(-24), cur];
      }
      setActiveTab(tab);
      setSettingsPage(page);
      setSettingsSubpage(subpage);
    },
    [],
  );

  const handleNavigateBack = useCallback(() => {
    const cur = navStateRef.current;
    if (cur.tab === 'settings' && cur.subpage) {
      setSettingsSubpage(null);
      return;
    }
    if (cur.tab === 'settings' && cur.page !== 'hub') {
      setSettingsPage('hub');
      setSettingsSubpage(null);
      return;
    }
    const prev = navHistoryRef.current.pop();
    if (prev) {
      setActiveTab(prev.tab);
      setSettingsPage(prev.page);
      setSettingsSubpage(prev.subpage);
      return;
    }
    setActiveTab('home');
    setSettingsPage('hub');
    setSettingsSubpage(null);
  }, []);

  const handleNavigateCommand = useCallback(
    (cmd: NavigationCommand) => {
      if (cmd.type === 'back') {
        handleNavigateBack();
        return;
      }
      navigateTo(cmd.tab, cmd.page || 'hub', cmd.subpage ?? null);
    },
    [handleNavigateBack, navigateTo],
  );

  const handleAppendVoiceMessage = useCallback(
    (role: 'user' | 'assistant', text: string, action?: PhoneAction) => {
      const { cleanText, action: parsedAction } = extractActionFromText(text);
      const finalAction = action || parsedAction || undefined;
      const newMsg: ChatMessage = {
        id: makeId(),
        role,
        text: cleanText || (finalAction ? getConfirmationPromptText(finalAction) : text),
        timestamp: Date.now(),
        source: 'voice',
        ...(finalAction ? { pendingAction: finalAction, actionStatus: 'pending' as const } : {}),
      };
      updateMessages((prev) => [...prev, newMsg]);
    },
    [updateMessages],
  );

  const handleUpdateLastVoiceMessage = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      const { cleanText, action: parsedAction } = extractActionFromText(text);
      updateMessages((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === role && copy[i].source === 'voice') {
            copy[i] = {
              ...copy[i],
              text: cleanText || copy[i].text,
              ...(parsedAction
                ? { pendingAction: parsedAction, actionStatus: 'pending' as const }
                : {}),
            };
            break;
          }
        }
        return copy;
      });
    },
    [updateMessages],
  );

  const handleLivePhoneAction = useCallback(
    (action: PhoneAction) => {
      const promptMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: getConfirmationPromptText(action),
        timestamp: Date.now(),
        source: 'voice',
        pendingAction: action,
        actionStatus: 'pending',
      };
      updateMessages((prev) => [...prev, promptMsg]);
    },
    [updateMessages],
  );

  const fetchLatestPublishedMotivation = useCallback(async (): Promise<MotivationPost | null> => {
    try {
      const { data, error } = await supabase
        .from('motivations')
        .select('id, title, body, is_published, created_at, updated_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !Array.isArray(data) || data.length === 0) return null;
      return data[0] as MotivationPost;
    } catch {
      return null;
    }
  }, []);

  const {
    voiceState: liveVoiceState,
    errorLabel: liveErrorLabel,
    errorDetail: liveErrorDetail,
    audioLevel,
    toggleVoice: liveToggleVoice,
    stopVoice: liveStopVoice,
    sendActionFeedbackToLive,
  } = useTiyaLiveVoice({
    settings,
    messages,
    memories,
    userAge,
    isOwner,
    checkReplyUsage,
    onAppendVoiceMessage: handleAppendVoiceMessage,
    onUpdateLastVoiceMessage: handleUpdateLastVoiceMessage,
    onPhoneAction: handleLivePhoneAction,
    onNavigate: handleNavigateCommand,
    onRequestLatestMotivation: fetchLatestPublishedMotivation,
  });

  // ROSE PREMIUM voice: no own key + Premium credits -> server voice (uses VOICE credits).
  // Welcome email: sent once by the server the first time a user signs in.
  const welcomeAskedRef = useRef(false);
  useEffect(() => {
    if (!session?.user?.id || !profile || welcomeAskedRef.current) return;
    if ((profile as any).welcome_email_sent_at) return;
    welcomeAskedRef.current = true;
    void supabase.functions.invoke('rose-welcome', { body: {} }).catch(() => undefined);
  }, [session?.user?.id, profile]);
  const userAvatarUrl: string | null =
    (profile as any)?.avatar_url ||
    (session?.user?.user_metadata as any)?.avatar_url ||
    (session?.user?.user_metadata as any)?.picture ||
    null;
  // Business owners: email YES / NO for any new approval requests (once per app open).
  const approvalAskedRef = useRef(false);
  useEffect(() => {
    if (!session?.user?.id || approvalAskedRef.current) return;
    if (profile?.account_mode !== 'business' && !isAdmin) return;
    approvalAskedRef.current = true;
    void supabase.functions.invoke('rose-approval', { body: { action: 'notify' } }).catch(() => undefined);
  }, [session?.user?.id, profile?.account_mode, isAdmin]);
  const pwResetOpen = usePwResetFlag();
  const hasOwnVoiceKey = Boolean(
    settings.apiKey.trim() || (settings.providerConnections?.groq?.apiKey || '').trim(),
  );
  const premiumVoiceMode = !hasOwnVoiceKey && isProfilePremium(profile);
  const premiumVoice = usePremiumVoice({
    language: settings.language,
    voiceName: settings.voiceName,
    volume: settings.volume,
    speechSpeed: settings.speechSpeed,
    buildSystemPrompt: () => buildTiyaSystemPrompt(settings, messages, 'chat', userAge, memories, isOwner),
    getHistory: () =>
      messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text })),
    onAppend: (role, text) => handleAppendVoiceMessage(role, text),
    onCredits: (v, t) =>
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              premium_voice_left: v ?? prev.premium_voice_left,
              premium_text_left: t ?? prev.premium_text_left,
            }
          : prev,
      ),
  });
  const voiceState = premiumVoiceMode ? premiumVoice.state : liveVoiceState;
  const errorLabel = premiumVoiceMode ? premiumVoice.errorText : liveErrorLabel;
  const errorDetail = premiumVoiceMode ? '' : liveErrorDetail;
  const toggleVoice = premiumVoiceMode ? premiumVoice.toggle : liveToggleVoice;
  const premiumVoiceStop = premiumVoice.stop;
  const stopVoice = useCallback(() => {
    liveStopVoice();
    premiumVoiceStop();
  }, [liveStopVoice, premiumVoiceStop]);

  // Sync voice errors into state error log
  useEffect(() => {
    if (voiceState === 'error') {
      setErrorLog(loadErrorLog());
    }
  }, [voiceState]);

  // Listen when app opens (if enabled and ready)
  useEffect(() => {
    if (
      authReady &&
      session?.user &&
      profileLoaded &&
      effectiveBirthYear !== null &&
      !autoStartedListenRef.current
    ) {
      autoStartedListenRef.current = true;
      if (
        settings.micListening.listenOnOpen &&
        settings.apiKey.trim() &&
        voiceState === 'idle'
      ) {
        toggleVoice();
      }
    }
  }, [
    authReady,
    effectiveBirthYear,
    profileLoaded,
    session?.user,
    settings.apiKey,
    settings.micListening.listenOnOpen,
    toggleVoice,
    voiceState,
  ]);

  const handleConfirmAction = useCallback(
    async (msgId: string, action: PhoneAction) => {
      // YouTube / song: find the first video and PLAY it (not just a results list).
      if (action.action === 'web_search') {
        const site = normalizeSearchSite(action.site);
        if (site === 'youtube' || site === 'music') {
          let videoId: string | null = null;
          try {
            const call = supabase.functions.invoke('rose-yt', { body: { query: action.query } });
            const timeout = new Promise<null>((r) => setTimeout(() => r(null), 5000));
            const res = (await Promise.race([call, timeout])) as { data?: { videoId?: string | null } } | null;
            videoId = res?.data?.videoId || null;
          } catch {
            videoId = null;
          }
          if (videoId) {
            const url =
              site === 'music'
                ? `https://music.youtube.com/watch?v=${videoId}`
                : `https://www.youtube.com/watch?v=${videoId}`;
            if (typeof window !== 'undefined' && window.TiyaNative) {
              // ROSE Android app: this link opens straight in the YouTube app and plays.
              window.location.href = url;
            } else {
              openTracked(url);
            }
            setActionLinks((prev) => ({ ...prev, [msgId]: url }));
            updateMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, actionStatus: 'executed', actionNote: `"${action.query}" চালানো হচ্ছে।` }
                  : m,
              ),
            );
            sendActionFeedbackToLive(`Action result: SUCCESS — "${action.query}" is now playing on YouTube.`);
            return;
          }
        }
      }
      const result = await executePhoneAction(
        action,
        typeof window !== 'undefined' ? window.TiyaNative : undefined,
        (url) => {
          setActionLinks((prev) => ({ ...prev, [msgId]: url }));
          if (/^https?:\/\//.test(url)) openTracked(url);
        },
      );

      updateMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionStatus: result.success ? 'executed' : 'failed',
                actionNote: result.messageBn,
              }
            : m,
        ),
      );

      sendActionFeedbackToLive(
        `Action result: ${result.success ? 'SUCCESS' : 'FAILED'} — ${result.messageBn}`,
      );
    },
    [sendActionFeedbackToLive, updateMessages],
  );

  // Safe actions (open app, search YouTube/Google/Maps, close tabs) run at once.
  // Calls and messages still wait for the user's Confirm.
  const autoRunIdsRef = useRef<Set<string>>(new Set());
  const autoRunSinceRef = useRef<number>(Date.now());
  const autoRunLastRef = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    for (const m of messages) {
      if (
        m.timestamp >= autoRunSinceRef.current &&
        m.pendingAction &&
        (m.actionStatus === 'pending' || !m.actionStatus) &&
        !requiresConfirmation(m.pendingAction) &&
        !autoRunIdsRef.current.has(m.id)
      ) {
        autoRunIdsRef.current.add(m.id);
        // The voice model sometimes sends the same action 2-3 times: run it once.
        const key = JSON.stringify(m.pendingAction);
        const last = autoRunLastRef.current;
        if (last && last.key === key && Date.now() - last.at < 15000) {
          updateMessages((prev) => prev.filter((x) => x.id !== m.id));
          continue;
        }
        autoRunLastRef.current = { key, at: Date.now() };
        void handleConfirmAction(m.id, m.pendingAction);
      }
    }
  }, [messages, handleConfirmAction, updateMessages]);

  const handleCancelAction = useCallback(
    (msgId: string) => {
      updateMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionStatus: 'cancelled',
                actionNote: 'বাতিল করা হয়েছে।',
              }
            : m,
        ),
      );
      sendActionFeedbackToLive('User cancelled the phone action.');
    },
    [sendActionFeedbackToLive, updateMessages],
  );

  const deliverMotivationInChat = useCallback(
    async (post: MotivationPost | null): Promise<string> => {
      if (!post || !post.body?.trim()) {
        return formatMotivationReplyBn(null);
      }

      const key = settings.apiKey.trim();
      if (hasBengaliScript(post.body) || !key) {
        return formatMotivationReplyBn(post);
      }

      try {
        const systemInstruction = buildTiyaSystemPrompt(
          settings,
          messages,
          'chat',
          userAge,
          memories,
          isOwner,
        );
        const titlePart = (post.title || '').trim()
          ? `Title: ${post.title?.trim()}\n`
          : '';
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': key,
          },
          body: JSON.stringify({
            message: `Read and deliver the following motivational post naturally to the user in Bengali. Keep the meaning faithful and warm:\n${titlePart}Message: ${post.body.trim()}`,
            history: [],
            systemInstruction,
            model: settings.chatModelOverride.trim() || undefined,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; text?: string };
        if (res.ok && data.ok && data.text?.trim()) {
          return data.text.trim();
        }
      } catch {
        // Fallback to direct formatted Bengali response
      }

      return formatMotivationReplyBn(post);
    },
    [isOwner, memories, messages, settings, userAge],
  );

  // Plan picked on the website (/app?buy=<plan>): kept through Google login, then PREMIUM opens with it
  const [buyPlanId, setBuyPlanId] = useState<string | null>(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('buy');
      if (fromUrl) {
        window.sessionStorage.setItem('rose_buy_plan', fromUrl);
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        return fromUrl;
      }
      return window.sessionStorage.getItem('rose_buy_plan');
    } catch {
      return null;
    }
  });

  // ROSE team (business users + admin): "আরিনকে বলো ..." in chat gives the task to that agent
  const teamRef = useRef<{ userId: string | null; enabled: boolean }>({ userId: null, enabled: false });
  teamRef.current = {
    userId: session?.user?.id ?? null,
    enabled: Boolean(session?.user?.id) && (isAdmin || profile?.account_mode === 'business'),
  };

  const handleSendChat = useCallback(
    async (text: string) => {
      setChatError('');

      const agentCmd = teamRef.current.enabled ? parseAgentCommand(text) : null;
      if (agentCmd && teamRef.current.userId) {
        const who = agentById(agentCmd.agent);
        updateMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'user', text, timestamp: Date.now(), source: 'chat' },
          {
            id: makeId(),
            role: 'assistant',
            text: `ঠিক আছে, কাজটা ${who.nameBn}কে দিলাম। শেষ হলে ${who.nameBn} এখানে রিপোর্ট দেবে।`,
            timestamp: Date.now() + 1,
            source: 'chat',
          },
        ]);
        void runAgentTask(teamRef.current.userId, agentCmd.agent, agentCmd.task, 'chat').then((done) => {
          if (!done) return;
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text:
                done.status === 'done'
                  ? `【${who.name}】 ${done.result || ''}`
                  : `【${who.name}】 কাজটা করতে পারিনি: ${done.result || 'unknown error'}`,
              timestamp: Date.now(),
              source: 'chat',
            },
          ]);
        });
        return;
      }

      // Check deterministic navigation commands first (works offline/without wasting reply quota)
      const navCmd = parseNavigationCommand(text);
      if (navCmd) {
        const userMsg: ChatMessage = {
          id: makeId(),
          role: 'user',
          text,
          timestamp: Date.now(),
          source: 'chat',
        };
        const confirmMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: navCmd.confirmBn,
          timestamp: Date.now() + 1,
          source: 'chat',
        };
        updateMessages((prev) => [...prev, userMsg, confirmMsg]);
        handleNavigateCommand(navCmd);
        return;
      }

      // Handle motivation requests directly from published motivations in Supabase
      if (isMotivationRequest(text)) {
        const userMsg: ChatMessage = {
          id: makeId(),
          role: 'user',
          text,
          timestamp: Date.now(),
          source: 'chat',
        };
        updateMessages((prev) => [...prev, userMsg]);
        setIsSendingChat(true);
        try {
          const usageDecision = await checkReplyUsage();
          if (!usageDecision.allowed) {
            updateMessages((prev) => [
              ...prev,
              {
                id: makeId(),
                role: 'assistant',
                text: usageDecision.messageBn || 'আজকের লিমিট শেষ',
                timestamp: Date.now(),
                source: 'chat',
              },
            ]);
            return;
          }
          const latestPost = await fetchLatestPublishedMotivation();
          const replyText = await deliverMotivationInChat(latestPost);
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text: replyText,
              timestamp: Date.now(),
              source: 'chat',
            },
          ]);
        } finally {
          setIsSendingChat(false);
        }
        return;
      }

      const key = settings.apiKey.trim();
      // No own key: Premium customers (and the admin) use the ROSE PREMIUM server
      const usePremiumServer = !key && (isAdmin || isProfilePremium(profile));
      if (!key && !usePremiumServer) {
        setChatError('No API key. Settings > Connections: add your free key, or buy ROSE Premium credits.');
        return;
      }

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        text,
        timestamp: Date.now(),
        source: 'chat',
      };

      const historySnapshot = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-16)
        .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text }));

      updateMessages((prev) => [...prev, userMsg]);
      setIsSendingChat(true);

      try {
        // Usage check before AI reply (blocked / daily limit)
        const usageDecision = await checkReplyUsage();
        if (!usageDecision.allowed) {
          const deniedMsg: ChatMessage = {
            id: makeId(),
            role: 'assistant',
            text: usageDecision.messageBn || 'আজকের লিমিট শেষ',
            timestamp: Date.now(),
            source: 'chat',
          };
          updateMessages((prev) => [...prev, deniedMsg]);
          return;
        }

        const systemInstruction = buildTiyaSystemPrompt(
          settings,
          messages,
          'chat',
          userAge,
          memories,
          isOwner,
        );
        if (usePremiumServer) {
          const premiumSystem =
            systemInstruction +
            '\n\nPHONE ACTIONS: when the user asks to open an app, call someone, or send/call on WhatsApp or Messenger, ' +
            'reply with one short Bengali sentence and then put exactly one JSON object at the end, for example ' +
            '{"action":"open_app","app":"YouTube"} or {"action":"call","contact":"Ma"} or {"action":"whatsapp_call","contact":"My House"} or ' +
            '{"action":"whatsapp_message","contact":"Rahim","text":"..."} or {"action":"messenger_message","contact":"Rahim","text":"..."}. ' +
            'Never claim the action is already done.';
          const pr = await premiumChat([
            { role: 'system', content: premiumSystem },
            ...historySnapshot.map((h) => ({ role: h.role, content: h.text })),
            { role: 'user', content: text },
          ]);
          if (!pr.ok) {
            updateMessages((prev) => [
              ...prev,
              {
                id: makeId(),
                role: 'assistant',
                text: pr.message || 'Premium উত্তর পাওয়া যায়নি।',
                timestamp: Date.now(),
                source: 'chat',
              },
            ]);
            if (pr.reason === 'server_error' || pr.reason === 'network') {
              setErrorLog(appendErrorLog('chat', 'PREMIUM_ERROR', pr.message || pr.reason || ''));
            }
            return;
          }
          if (typeof pr.voiceLeft === 'number' || typeof pr.textLeft === 'number') {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    premium_voice_left: pr.voiceLeft ?? prev.premium_voice_left,
                    premium_text_left: pr.textLeft ?? prev.premium_text_left,
                  }
                : prev,
            );
          }
          const { cleanText: pClean, action: pAction } = extractActionFromText(pr.text || '');
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text: pClean || (pAction ? getConfirmationPromptText(pAction) : 'বলুন, কীভাবে সাহায্য করতে পারি?'),
              timestamp: Date.now(),
              source: 'chat',
              ...(pAction ? { pendingAction: pAction, actionStatus: 'pending' as const } : {}),
            },
          ]);
          return;
        }

        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': key,
          },
          body: JSON.stringify({
            message: text,
            history: historySnapshot,
            systemInstruction,
            model: settings.chatModelOverride.trim() || undefined,
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          text?: string;
          action?: PhoneAction | null;
          navigate?: unknown;
          needsMotivation?: boolean;
          label?: string;
          detail?: string;
        };

        if (!res.ok || !data.ok) {
          const errTitle = data.label || 'CHAT_ERROR';
          const errDetail = data.detail || 'Chat request failed.';
          setChatError(`${errTitle}: ${errDetail}`);
          setErrorLog(appendErrorLog('chat', errTitle, errDetail));
          return;
        }

        const parsedNav = validateNavigateToolArgs(data.navigate);
        if (parsedNav) {
          handleNavigateCommand(parsedNav);
        }

        if (data.needsMotivation) {
          const latestPost = await fetchLatestPublishedMotivation();
          const motReply = await deliverMotivationInChat(latestPost);
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text: motReply,
              timestamp: Date.now(),
              source: 'chat',
            },
          ]);
          return;
        }

        const { cleanText, action: inlineAction } = extractActionFromText(data.text || '');
        const pendingAction = data.action || inlineAction || undefined;
        const replyText =
          cleanText ||
          (pendingAction
            ? getConfirmationPromptText(pendingAction)
            : parsedNav
              ? parsedNav.confirmBn
              : 'বলুন, কীভাবে সাহায্য করতে পারি?');

        const assistantMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: replyText,
          timestamp: Date.now(),
          source: 'chat',
          ...(pendingAction
            ? { pendingAction, actionStatus: 'pending' as const }
            : {}),
        };
        updateMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error while contacting Gemini.';
        setChatError('Network error while contacting Gemini.');
        setErrorLog(appendErrorLog('chat', 'NETWORK_ERROR', msg));
      } finally {
        setIsSendingChat(false);
      }
    },
    [
      checkReplyUsage,
      deliverMotivationInChat,
      fetchLatestPublishedMotivation,
      handleNavigateCommand,
      isAdmin,
      isOwner,
      profile,
      memories,
      messages,
      settings,
      updateMessages,
      userAge,
    ],
  );

  const handleDeleteSessionMessages = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      updateMessages((prev) => prev.filter((m) => !idSet.has(m.id)));
    },
    [updateMessages],
  );

  const handleClearAllChats = useCallback(() => {
    clearAllChatsStorage();
    setMessages([]);
    setActionLinks({});
  }, []);

  const handleAddMemory = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMemories((prev) => {
      const next: MemoryItem[] = [
        ...prev,
        { id: makeId(), text: clean, createdAt: Date.now() },
      ];
      saveMemories(next);
      return next;
    });
  }, []);

  const handleDeleteMemory = useCallback((id: string) => {
    setMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMemories(next);
      return next;
    });
  }, []);

  const handleClearMemories = useCallback(() => {
    setMemories([]);
    saveMemories([]);
  }, []);

  const openConnections = useCallback(() => {
    navigateTo('settings', 'connections', null);
  }, [navigateTo]);

  const handleSelectTab = useCallback(
    (tab: MainTab) => {
      navigateTo(tab, 'hub', null);
    },
    [navigateTo],
  );

  const handleOpenSettingsPage = useCallback(
    (page: SettingsPageId) => {
      navigateTo('settings', page, null);
    },
    [navigateTo],
  );

  const handleSelectSettingsSubpage = useCallback(
    (sub: string | null) => {
      if (sub === null) {
        setSettingsSubpage(null);
      } else {
        navigateTo('settings', navStateRef.current.page, sub);
      }
    },
    [navigateTo],
  );

  const handleOpenNotifications = useCallback(async () => {
    setNotifOpen(true);
    if (!session?.user?.id) return;

    setNotifLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const list = (data as NotificationItem[]) || [];
      setNotifications(list);

      const unreadIds = list.filter((n) => !n.read_at).map((n) => n.id);
      if (unreadIds.length > 0) {
        const nowIso = new Date().toISOString();
        await supabase
          .from('notifications')
          .update({ read_at: nowIso })
          .in('id', unreadIds);

        setNotifications((prev) =>
          prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: nowIso } : n)),
        );
      }
    } catch {
      // ignore fetch error
    } finally {
      setNotifLoading(false);
    }
  }, [session?.user?.id]);

  const handleSignOut = useCallback(async () => {
    stopVoice();
    try {
      await supabase.rpc('log_login_event', { p_event: 'logout', p_device: null, p_platform: 'web' });
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    setShowAdminScreen(false);
    setShowMotivationScreen(false);
    setActiveTab('home');
    setSettingsPage('hub');
    setSettingsSubpage(null);
    navHistoryRef.current = [];
  }, [stopVoice]);

  // Log the login once, then check every minute whether Admin logged this user out.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const isNative = typeof window !== 'undefined' && typeof (window as any).TiyaNative?.run === 'function';
    void supabase
      .rpc('log_login_event', {
        p_event: 'login',
        p_device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : null,
        p_platform: isNative ? 'android' : 'web',
      })
      .then(() => undefined, () => undefined);

    let stopped = false;
    const check = async () => {
      if (stopped || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      const { data, error } = await supabase.rpc('tiya_session_alive');
      if (!stopped && !error && data === false) {
        stopped = true;
        stopVoice();
        await supabase.auth.signOut({ scope: 'local' });
        setShowAdminScreen(false);
        setActiveTab('home');
        setSettingsPage('hub');
        setSettingsSubpage(null);
      }
    };
    const timer = window.setInterval(check, 60000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVis);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session?.user?.id, stopVoice]);

  // Keep ROSE's prompt in step with the account mode (Personal / Student / Business)
  useEffect(() => {
    if (!session?.user?.id || isAdmin) {
      clearModeContext();
      return;
    }
    void refreshModeContext(profile?.account_mode ?? null, session.user.id);
  }, [session?.user?.id, isAdmin, profile?.account_mode]);

  const chatSessionCount = useMemo(
    () => groupMessagesIntoChatSessions(messages).length,
    [messages],
  );

  const unreadNotifications = notifications.filter((n) => !n.read_at).length;
  // Admin goes straight in. Everyone else picks Personal/Student/Business (+ age) once.
  const needsOnboarding =
    Boolean(session?.user) &&
    profileLoaded &&
    !isAdmin &&
    Boolean(profile) &&
    !profile?.onboarding_done;
  const needsAgeCheck =
    Boolean(session?.user) &&
    profileLoaded &&
    !isAdmin &&
    !needsOnboarding &&
    effectiveBirthYear === null;

  useEffect(() => {
    if (!buyPlanId || !session?.user?.id || !profileLoaded || needsOnboarding || needsAgeCheck) return;
    setActiveTab('settings');
    setSettingsPage('premium');
    setSettingsSubpage(null);
    try {
      window.sessionStorage.removeItem('rose_buy_plan');
    } catch {
      /* ignore */
    }
  }, [buyPlanId, session?.user?.id, profileLoaded, needsOnboarding, needsAgeCheck]);

  // PC layout: wide window + business user or admin. Small windows keep the mobile app.
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1100px)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1100px)');
    if (!mq) return;
    const on = () => setIsWide(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  const [desktopTab, setDesktopTab] = useState<DesktopTab>('dashboard');
  const [writerInbox, setWriterInbox] = useState<string | null>(null);
  const [adminView, setAdminView] = useState<string>('dashboard');
  const desktopMode =
    isWide &&
    Boolean(session?.user?.id) &&
    profileLoaded &&
    !needsOnboarding &&
    !needsAgeCheck &&
    (isAdmin || profile?.account_mode === 'business');

  useEffect(() => {
    if (!desktopMode || desktopTab !== 'app' || showAdminScreen || showMotivationScreen) return;
    if (activeTab !== 'settings' || settingsPage === 'hub') {
      setActiveTab('settings');
      setSettingsPage('about');
      setSettingsSubpage(null);
    }
  }, [desktopMode, desktopTab, showAdminScreen, showMotivationScreen, activeTab, settingsPage]);

  const isInSettingsSubpage = activeTab === 'settings' && settingsPage !== 'hub';

  return (
    <div
      className={`${
        desktopMode
          ? 'grid h-[100dvh] w-full grid-cols-[minmax(0,1fr)_380px] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-[#07060F] p-3'
          : 'flex min-h-[100dvh] w-full items-center justify-center gap-4 bg-[#05070B] min-[481px]:p-3'
      } ${settings.reduceMotion ? 'reduce-motion' : ''}`}
    >
      {desktopMode && session?.user && (
        <>
          <DesktopTopBar
            tab={desktopTab}
            onTab={(t) => {
              if (t !== 'admin') setShowAdminScreen(false);
              setDesktopTab(t);
              if (t === 'app') {
                setShowAdminScreen(false);
                setShowMotivationScreen(false);
                navigateTo('settings', 'hub', null);
              }
            }}
            isAdmin={isAdmin}
            onAdmin={() => {
              setDesktopTab('admin');
              setShowMotivationScreen(false);
              setShowAdminScreen(true);
            }}
            unread={unreadNotifications}
            onBell={() => {
              setDesktopTab('app');
              handleOpenNotifications();
            }}
            voiceOn={['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState)}
            voiceState={voiceState}
            onVoice={toggleVoice}
            onMicSettings={() => {
              setDesktopTab('app');
              setShowAdminScreen(false);
              navigateTo('settings', 'voice_language', null);
            }}
            email={session.user.email}
            avatar={(session.user.user_metadata as any)?.avatar_url || null}
            onSignOut={handleSignOut}
          />
          {desktopTab === 'admin' && (
            <div className="col-start-1 row-start-2 flex min-h-0 w-[330px] flex-col overflow-hidden rounded-[10px] border border-amber-300/20 bg-[#0D0B1A]">
              <AdminScreen
                navOnly
                activeView={showMotivationScreen ? 'motivation' : adminView}
                onPick={(v) => {
                  setShowMotivationScreen(false);
                  setShowAdminScreen(true);
                  setAdminView(v);
                }}
                settings={settings}
                voiceState={voiceState}
                errorLog={errorLog}
                onClearErrorLog={() => {
                  clearErrorLog();
                  setErrorLog([]);
                }}
                onBackToHome={() => setDesktopTab('dashboard')}
                onOpenMotivation={() => {
                  setShowAdminScreen(false);
                  setShowMotivationScreen(true);
                }}
                onLogout={handleSignOut}
              />
            </div>
          )}
          {desktopTab === 'app' && (
            <div className="col-start-1 row-start-2 flex min-h-0 w-[330px] flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#0D0B1A]">
              <SettingsHub
                settings={settings}
                profile={profile}
                chatCount={chatSessionCount}
                userEmail={session.user.email}
                isAdmin={isAdmin}
                activePage={showAdminScreen ? null : settingsPage}
                onOpenPage={(pg) => {
                  setShowAdminScreen(false);
                  setShowMotivationScreen(false);
                  handleOpenSettingsPage(pg);
                }}
              />
            </div>
          )}
          {desktopTab !== 'app' && desktopTab !== 'admin' && (
            <div className="col-start-1 row-start-2 min-h-0">
              {desktopTab === 'dashboard' ? (
                <DesktopDashboard userId={session.user.id} isAdmin={isAdmin} onOpenTeam={() => setDesktopTab('team')} />
              ) : desktopTab === 'writer' ? (
                <WriterPanel initialText={writerInbox} onUsed={() => setWriterInbox(null)} />
              ) : (
                <DesktopTeam userId={session.user.id} email={session.user.email} />
              )}
            </div>
          )}
        </>
      )}
      {/* Portrait Phone Container */}
      <main className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 text-slate-900 min-[481px]:h-[min(calc(100dvh-24px),900px)] min-[481px]:max-w-[420px] min-[481px]:rounded-[28px] min-[481px]:border min-[481px]:border-white/[0.12] min-[481px]:shadow-2xl dark:bg-[#090B10] dark:text-[#F4F5F7] ${desktopMode ? (desktopTab === 'app' || desktopTab === 'admin' ? 'col-start-1 row-start-2 ml-[342px] !w-auto min-[481px]:!h-full min-[481px]:!max-w-none min-[481px]:!rounded-[10px]' : 'hidden') : ''}`}>
        {!authReady ? (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Loading ROSE...
          </div>
        ) : !session ? (
          <LoginScreen />
        ) : pwResetOpen ? (
          <ForgotPasswordFlow initialStep="newpass" initialEmail={session.user.email || ''} onBack={() => undefined} />
        ) : needsOnboarding ? (
          <OnboardingScreen
            userId={session.user.id}
            knownBirthYear={effectiveBirthYear}
            onComplete={(mode, year, dob) => {
              if (year !== null) setCachedBirthYearState(year);
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      account_mode: mode,
                      onboarding_done: true,
                      birth_year: prev.birth_year ?? year,
                      date_of_birth: prev.date_of_birth ?? dob,
                    }
                  : prev,
              );
            }}
            onSignOut={handleSignOut}
          />
        ) : needsAgeCheck ? (
          <AgeCheckScreen
            userId={session.user.id}
            onComplete={(year) => {
              setCachedBirthYearState(year);
              setProfile((prev) =>
                prev
                  ? { ...prev, birth_year: year }
                  : {
                      id: session.user.id,
                      email: session.user.email || null,
                      full_name: null,
                      avatar_url: null,
                      birth_year: year,
                      plan: 'free',
                      paid_until: null,
                      daily_limit: null,
                      used_today: 0,
                      blocked: false,
                      admin_note: null,
                    },
              );
            }}
            onSignOut={handleSignOut}
          />
        ) : showAdminScreen && isAdmin ? (
          <AdminScreen
            settings={settings}
            voiceState={voiceState}
            errorLog={errorLog}
            onClearErrorLog={() => {
              clearErrorLog();
              setErrorLog([]);
            }}
            onBackToHome={() => {
              setShowAdminScreen(false);
              if (desktopMode) setDesktopTab('dashboard');
            }}
            onOpenMotivation={() => {
              setShowAdminScreen(false);
              setShowMotivationScreen(true);
            }}
            onLogout={handleSignOut}
            controlledView={desktopMode && desktopTab === 'admin' ? adminView : null}
          />
        ) : showMotivationScreen && isAdmin ? (
          <MotivationScreen
            onBack={() => setShowMotivationScreen(false)}
            onBroadcastSaved={() => {
              if (session?.user?.id) {
                loadAccountData(session.user.id);
              }
            }}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                settings={settings}
                voiceState={voiceState}
                errorLabel={errorLabel}
                errorDetail={errorDetail}
                audioLevel={audioLevel}
                messages={messages}
                actionLinks={actionLinks}
                unreadNotifications={unreadNotifications}
                isAdmin={isAdmin}
                canUseWithoutKey={isAdmin || isProfilePremium(profile)}
                onToggleVoice={toggleVoice}
                onOpenConnections={openConnections}
                onOpenNotifications={handleOpenNotifications}
                onOpenAdmin={() => {
                  setShowMotivationScreen(false);
                  setShowAdminScreen(true);
                }}
                onOpenMotivation={() => {
                  setShowAdminScreen(false);
                  setShowMotivationScreen(true);
                }}
                onOpenHome={() => navigateTo('home', 'hub', null)}
                onOpenChatHistory={() => navigateTo('settings', 'chats_memory', null)}
                onOpenChat={() => navigateTo('chat', 'hub', null)}
                onOpenTools={() => navigateTo('settings', 'phone_control', 'quick_actions')}
                onOpenMore={() => navigateTo('settings', 'hub', null)}
                onConfirmAction={handleConfirmAction}
                onCancelAction={handleCancelAction}
              />
            )}

            {activeTab === 'chat' && (
              <ChatScreen
                settings={settings}
                messages={messages}
                isSending={isSendingChat}
                chatError={chatError}
                actionLinks={actionLinks}
                onSendMessage={handleSendChat}
                onConfirmAction={handleConfirmAction}
                onCancelAction={handleCancelAction}
                onClearChats={handleClearAllChats}
                userAvatar={userAvatarUrl}
                onOpenConnections={openConnections}
                isVoiceOn={['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState)}
                onToggleVoice={toggleVoice}
                onOpenHome={() => navigateTo('home', 'hub', null)}
                onOpenChatHistory={() => navigateTo('settings', 'chats_memory', null)}
                onOpenTools={() => navigateTo('settings', 'phone_control', 'quick_actions')}
                onOpenMore={() => navigateTo('settings', 'hub', null)}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'hub' && (
              <SettingsHub
                settings={settings}
                profile={profile}
                chatCount={chatSessionCount}
                userEmail={session.user.email}
                isAdmin={isAdmin}
                onOpenPage={handleOpenSettingsPage}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'about' && (
              <AboutGuidePage
                settings={settings}
                voiceState={voiceState}
                hasSession={Boolean(session)}
                isAdmin={isAdmin}
                canUseWithoutKey={isAdmin || isProfilePremium(profile)}
                subpage={settingsSubpage}
                onSelectSubpage={handleSelectSettingsSubpage}
                onOpenConnections={() => handleOpenSettingsPage('connections')}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'connections' && (
              <ConnectionsPage
                settings={settings}
                profile={profile}
                isAdmin={isAdmin}
                onOpenPremium={() => navigateTo('settings', 'premium')}
                subpage={settingsSubpage}
                onSelectSubpage={handleSelectSettingsSubpage}
                onUpdateSettings={updateSettings}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'voice_language' && (
              <VoiceLanguagePage
                settings={settings}
                isMinorUser={typeof userAge === 'number' && userAge < 18}
                subpage={settingsSubpage}
                onSelectSubpage={handleSelectSettingsSubpage}
                onUpdateSettings={updateSettings}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'phone_control' && (
              <PhoneControlPage
                subpage={settingsSubpage}
                onSelectSubpage={handleSelectSettingsSubpage}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'chats_memory' && (
              <ChatsMemoryPage
                messages={messages}
                memories={memories}
                onDeleteSessionMessages={handleDeleteSessionMessages}
                onClearAll={handleClearAllChats}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'premium' && (
              <PremiumPage
                profile={profile}
                isAdmin={isAdmin}
                initialPlanId={buyPlanId}
                onRefreshProfile={() => {
                  if (session?.user?.id) loadAccountData(session.user.id);
                }}
                onBack={() => {
                  setBuyPlanId(null);
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'team_list' && (
              <SettingsShell title="MY TASK LIST" onBack={() => { setSettingsPage('hub'); setSettingsSubpage(null); }}>
                <div className="pb-4">
                  <TeamChecklist canEdit={isAdmin} />
                </div>
              </SettingsShell>
            )}
            {activeTab === 'settings' && settingsPage === 'workspace' && session?.user?.id && (
              <WorkspacePage
                subpage={settingsSubpage}
                userId={session.user.id}
                mode={isAdmin ? 'business' : profile?.account_mode ?? 'personal'}
                isMinor={typeof userAge === 'number' && userAge < 18}
                onModeChanged={() => {
                  if (session?.user?.id) loadAccountData(session.user.id);
                }}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'privacy_controls' && (
              <PrivacyControlsPage
                settings={settings}
                messages={messages}
                memories={memories}
                subpage={settingsSubpage}
                onSelectSubpage={handleSelectSettingsSubpage}
                onUpdateSettings={updateSettings}
                onClearAllChats={handleClearAllChats}
                onAddMemory={handleAddMemory}
                onDeleteMemory={handleDeleteMemory}
                onClearMemories={handleClearMemories}
                onOpenPage={handleOpenSettingsPage}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'my_account' && (
              <MyAccountPage
                user={session.user}
                profile={profile}
                isAdmin={isAdmin}
                onBack={() => {
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
                onSignedOut={() => {
                  setActiveTab('home');
                  setSettingsPage('hub');
                  setSettingsSubpage(null);
                }}
              />
            )}

            {!desktopMode && activeTab !== 'home' && activeTab !== 'chat' && !isInSettingsSubpage && (
              <BottomNav
                activeTab={activeTab}
                voiceState={voiceState}
                onSelectTab={handleSelectTab}
                onToggleOrb={toggleVoice}
              />
            )}

            <NotificationsSheet
              open={notifOpen}
              notifications={notifications}
              loading={notifLoading}
              onClose={() => setNotifOpen(false)}
            />
          </>
        )}
      </main>

      {/* PC: ROSE picture + chat box on the right */}
      {desktopMode && (
        <div className="col-start-2 row-start-2 flex min-h-0">
          <DesktopRosePanel
            messages={messages}
            isSending={isSendingChat}
            voiceState={voiceState}
            onSend={(t) => void handleSendChat(t)}
            onVoice={toggleVoice}
            onClear={handleClearAllChats}
            userAvatar={userAvatarUrl}
            userName={settings.yourName || session?.user?.email || ''}
            apiKey={settings.apiKey}
            voiceName={settings.voiceName}
            onToWriter={(t) => {
              setWriterInbox(t);
              setDesktopTab('writer');
            }}
          />
        </div>
      )}
    </div>
  );
}
