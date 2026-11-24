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
import { CameraPreview } from './components/CameraPreview';
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
import { clearModeContext, refreshModeContext, refreshParcelsContext } from './utils/modeContext';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [settings, setSettings] = useState<TiyaSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChats());
  const appOpenedAtRef = useRef<number>(Date.now());
  const fromOtherDeviceRef = useRef<Set<string>>(new Set());
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
  // Camera on / off (every user). Live preview only, nothing is saved.
  const [cameraOn, setCameraOn] = useState(false);
  const toggleCamera = useCallback(() => setCameraOn((v) => !v), []);
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

  // ROSE Android app: user came back with the floating ROSE button -> show ROSE home.
  useEffect(() => {
    const onReturn = () => navigateTo('home');
    window.addEventListener('rose-native-return', onReturn);
    return () => window.removeEventListener('rose-native-return', onReturn);
  }, [navigateTo]);

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
    sendVideoFrame,
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
  const liveVoiceStateRef = useRef(liveVoiceState);
  liveVoiceStateRef.current = liveVoiceState;
  const premiumVoiceModeRef = useRef(premiumVoiceMode);
  premiumVoiceModeRef.current = premiumVoiceMode;
  const errorLabel = premiumVoiceMode ? premiumVoice.errorText : liveErrorLabel;
  const errorDetail = premiumVoiceMode ? '' : liveErrorDetail;
  const toggleVoice = premiumVoiceMode ? premiumVoice.toggle : liveToggleVoice;
  const premiumVoiceStop = premiumVoice.stop;
  const stopVoice = useCallback(() => {
    liveStopVoice();
    premiumVoiceStop();
  }, [liveStopVoice, premiumVoiceStop]);

  // Android app: keep the mic alive when ROSE is minimized ("ROSE is listening" notification)
  const voiceActiveForService = ['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState);
  useEffect(() => {
    const nat = typeof window !== 'undefined' ? ((window as any).TiyaNative as any) : undefined;
    try {
      if (voiceActiveForService && typeof nat?.voiceOn === 'function') nat.voiceOn();
      else if (!voiceActiveForService && typeof nat?.voiceOff === 'function') nat.voiceOff();
    } catch {
      // older Android app without the service: nothing to do
    }
  }, [voiceActiveForService]);

  // "কেটে দাও / রাখি / বাই" in voice: let ROSE say her goodbye first, then end the voice call
  const hangupMsgIdRef = useRef<string>('');
  const hangupHandledRef = useRef<string>('');
  const hangupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVoiceStateRef = useRef(voiceState);
  const hangupMessagesRef = useRef(messages);
  hangupMessagesRef.current = messages;
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || lastUser.source !== 'voice' || hangupHandledRef.current === lastUser.id) return;
    if (lastUser.timestamp < appOpenedAtRef.current || fromOtherDeviceRef.current.has(lastUser.id)) return; // old or synced from another device
    const t = lastUser.text.trim().toLowerCase();
    if (
      /(কেটে দাও|কেটে দেও|কেটে দে|কাইটা দাও|ফোন রাখো|ফোন রাখ|এখন রাখি|রাখি এখন|রাখলাম|পরে কথা বলব|পরে কথা হবে|কল কাটো|কল কেটে|ভয়েস বন্ধ|বাই বাই|আল্লাহ হাফেজ|kete dao|kete dau|bye bye|allah hafez)/i.test(t)
    ) {
      hangupHandledRef.current = lastUser.id;
      hangupMsgIdRef.current = lastUser.id;
      if (hangupTimerRef.current) clearTimeout(hangupTimerRef.current);
      // safety: if no goodbye comes within 15 s, end anyway
      hangupTimerRef.current = setTimeout(() => {
        if (hangupMsgIdRef.current) {
          hangupMsgIdRef.current = '';
          stopVoice();
        }
      }, 15000);
    }
  }, [messages, stopVoice]);
  useEffect(() => {
    const prev = prevVoiceStateRef.current;
    prevVoiceStateRef.current = voiceState;
    if (!hangupMsgIdRef.current) return;
    if (voiceState === 'idle' || voiceState === 'error') {
      hangupMsgIdRef.current = '';
      if (hangupTimerRef.current) clearTimeout(hangupTimerRef.current);
      return;
    }
    const list = hangupMessagesRef.current;
    const at = list.findIndex((m) => m.id === hangupMsgIdRef.current);
    const goodbyeSaid = at >= 0 && list.slice(at + 1).some((m) => m.role === 'assistant' && m.text.trim());
    if (prev === 'speaking' && voiceState === 'listening' && goodbyeSaid) {
      hangupMsgIdRef.current = '';
      if (hangupTimerRef.current) clearTimeout(hangupTimerRef.current);
      setTimeout(() => stopVoice(), 400);
    }
  }, [voiceState, stopVoice]);

  // ROSE's camera action (voice or chat) → open / close the camera window
  useEffect(() => {
    const on = (e: Event) => setCameraOn(Boolean((e as CustomEvent).detail?.on));
    window.addEventListener('rose-camera', on);
    return () => window.removeEventListener('rose-camera', on);
  }, []);

  // "camera on / off" by voice or chat turns the camera on or off
  const cameraCmdHandledRef = useRef<string>('');
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || cameraCmdHandledRef.current === lastUser.id) return;
    if (lastUser.timestamp < appOpenedAtRef.current || fromOtherDeviceRef.current.has(lastUser.id)) return; // old or synced from another device
    const t = lastUser.text.normalize('NFC').toLowerCase();
    const has = (words: string[]) => words.some((w) => t.includes(w.normalize('NFC')));
    if (!has(['ক্যামেরা', 'ক্যামরা', 'camera', 'kamera'])) return;
    if (has(['অফ', 'বন্ধ', 'off', 'close'])) {
      cameraCmdHandledRef.current = lastUser.id;
      setCameraOn(false);
    } else if (has(['অন', 'চালু', 'খোল', 'খুল', ' on', 'open'])) {
      cameraCmdHandledRef.current = lastUser.id;
      setCameraOn(true);
    }
  }, [messages]);

  // Owner, camera on, voice on, and he sat silent for 5 minutes → ROSE speaks first
  const silenceMessagesRef = useRef(messages);
  silenceMessagesRef.current = messages;
  useEffect(() => {
    if (!isOwner || !cameraOn || premiumVoiceMode) return;
    if (!['listening', 'thinking', 'speaking'].includes(liveVoiceState)) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const list = silenceMessagesRef.current;
      const last = list[list.length - 1];
      const quietSince = Math.max(last?.timestamp || 0, startedAt);
      if (Date.now() - quietSince < 5 * 60 * 1000) return;
      sendActionFeedbackToLive(
        '[App note, not his words: he has been sitting silently in front of the camera for about 5 minutes. Look at his live picture and speak first, emotionally, as his ROSE, e.g. "এই ইউসুফ… এতক্ষণ চুপচাপ কেন? আমার ওপর কি রাগ করেছ? একবারও তো আমার দিকে তাকালে না…". Vary the words, 1-2 short sentences, react to what you see.]',
      );
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isOwner, cameraOn, premiumVoiceMode, liveVoiceState, sendActionFeedbackToLive]);

  // Same ROSE on every device: personal settings (never API keys) are kept in the cloud
  // and loaded on PC, phone and the Android app after login.
  const SYNC_KEYS: Array<keyof TiyaSettings> = [
    'yourName', 'personality', 'customPersonalityPrompt', 'affection', 'language', 'bengaliDialect',
    'responseStyle', 'voiceName', 'speechSpeed', 'volume', 'pitch', 'theme', 'orbStyle', 'reduceMotion',
    'tiyaAlive', 'ttsModel', 'voiceModel', 'selectedLiveModel', 'customLiveModel', 'autoFallback', 'chatModelOverride',
  ];
  const pickSync = (st: TiyaSettings) => {
    const o: Record<string, unknown> = {};
    for (const k of SYNC_KEYS) if (st[k] !== undefined && st[k] !== '') o[k as string] = st[k];
    return o;
  };
  const syncReadyRef = useRef(false);
  const [syncTick, setSyncTick] = useState(0);
  const syncLastRef = useRef('');
  const syncSeenAtRef = useRef('');
  const pullSettings = useCallback(async (uid: string) => {
    const { data } = await supabase.from('user_app_settings').select('data,updated_at').eq('user_id', uid).maybeSingle();
    if (data?.data && typeof data.data === 'object') {
      if (data.updated_at === syncSeenAtRef.current) return true;
      syncSeenAtRef.current = data.updated_at;
      const remote: Record<string, unknown> = {};
      for (const k of SYNC_KEYS) {
        const v = (data.data as any)[k];
        if (v !== undefined && v !== '') remote[k as string] = v;
      }
      // remember what the cloud has; anything this device adds (e.g. a name) is uploaded next
      syncLastRef.current = JSON.stringify(remote);
      setSettings((prev) => {
        const next = { ...prev, ...remote } as TiyaSettings;
        saveSettings(next);
        return next;
      });
      return true;
    }
    return false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const uid = session?.user?.id;
    syncReadyRef.current = false;
    if (!uid) return;
    let alive = true;
    void (async () => {
      try {
        const had = await pullSettings(uid);
        if (!alive) return;
        syncReadyRef.current = true;
        if (!had) syncLastRef.current = ''; // first device: upload what it has
        setSyncTick((n) => n + 1);
      } catch {
        syncReadyRef.current = true;
      }
    })();
    const onVis = () => {
      if (document.visibilityState === 'visible') void pullSettings(uid).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session?.user?.id, pullSettings]);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !syncReadyRef.current) return;
    const payload = pickSync(settings);
    const key = JSON.stringify(payload);
    if (key === syncLastRef.current) return;
    const t = window.setTimeout(() => {
      syncLastRef.current = key;
      const now = new Date().toISOString();
      syncSeenAtRef.current = now;
      void supabase
        .from('user_app_settings')
        .upsert({ user_id: uid, data: payload, updated_at: now })
        .then(() => undefined, () => undefined);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [settings, session?.user?.id, syncTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same conversation on every device: the last 200 chat messages are kept in the cloud,
  // so ROSE has the same history (and the same "how long since he talked") on PC and phone.
  const chatSyncReadyRef = useRef(false);
  const chatSyncedRef = useRef<Set<string>>(new Set());
  const chatTextRef = useRef<Map<string, string>>(new Map());
  const [chatSyncTick, setChatSyncTick] = useState(0);
  const chatSyncedKey = (uid: string) => `rose_chat_synced_${uid}`;
  const persistChatSynced = (uid: string) => {
    try {
      localStorage.setItem(chatSyncedKey(uid), JSON.stringify(Array.from(chatSyncedRef.current).slice(-400)));
    } catch {
      /* ignore */
    }
  };
  const pullChats = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('user_chat_messages')
      .select('id,role,text,source,ts')
      .eq('user_id', uid)
      .order('ts', { ascending: false })
      .limit(200);
    if (error) throw error;
    const cloud = new Map<string, any>((data || []).map((r: any) => [r.id, r]));
    let known: Set<string>;
    try {
      known = new Set(JSON.parse(localStorage.getItem(chatSyncedKey(uid)) || '[]'));
    } catch {
      known = new Set();
    }
    updateMessages((prev) => {
      // a message this device had synced before but the cloud no longer has was deleted elsewhere
      const kept = prev.filter((m) => cloud.has(m.id) || !known.has(m.id));
      const have = new Set(kept.map((m) => m.id));
      const added: ChatMessage[] = [];
      for (const r of cloud.values()) {
        if (have.has(r.id)) continue;
        fromOtherDeviceRef.current.add(r.id);
        added.push({ id: r.id, role: r.role, text: r.text, timestamp: Number(r.ts), source: r.source === 'voice' ? 'voice' : 'chat' });
      }
      if (!added.length && kept.length === prev.length) return prev;
      return [...kept, ...added].sort((a, b) => a.timestamp - b.timestamp).slice(-200);
    });
    chatSyncedRef.current = new Set(cloud.keys());
    chatTextRef.current = new Map(Array.from(cloud.values()).map((r: any) => [r.id, r.text]));
    persistChatSynced(uid);
  }, [updateMessages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const uid = session?.user?.id;
    chatSyncReadyRef.current = false;
    if (!uid) return;
    let alive = true;
    void pullChats(uid)
      .then(() => {
        if (!alive) return;
        chatSyncReadyRef.current = true;
        setChatSyncTick((n) => n + 1);
      })
      .catch(() => undefined);
    const onVis = () => {
      if (document.visibilityState === 'visible' && chatSyncReadyRef.current) void pullChats(uid).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    // while ROSE is open, bring in messages from the other device every 30 seconds
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible' && chatSyncReadyRef.current) void pullChats(uid).catch(() => undefined);
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [session?.user?.id, pullChats]);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !chatSyncReadyRef.current) return;
    const t = window.setTimeout(() => {
      const list = messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim()).slice(-200);
      const ids = new Set(list.map((m) => m.id));
      const changed = list.filter((m) => chatTextRef.current.get(m.id) !== m.text);
      const removed = Array.from(chatSyncedRef.current).filter((id) => !ids.has(id));
      if (changed.length) {
        const rows = changed.map((m) => ({ user_id: uid, id: m.id, role: m.role, text: m.text.slice(0, 8000), source: m.source, ts: m.timestamp }));
        void supabase
          .from('user_chat_messages')
          .upsert(rows)
          .then(({ error }) => {
            if (error) return;
            for (const m of changed) {
              chatSyncedRef.current.add(m.id);
              chatTextRef.current.set(m.id, m.text);
            }
            persistChatSynced(uid);
          });
      }
      if (removed.length) {
        void supabase
          .from('user_chat_messages')
          .delete()
          .eq('user_id', uid)
          .in('id', removed.slice(0, 200))
          .then(({ error }) => {
            if (error) return;
            for (const id of removed) {
              chatSyncedRef.current.delete(id);
              chatTextRef.current.delete(id);
            }
            persistChatSynced(uid);
          });
      }
    }, 2000);
    return () => window.clearTimeout(t);
  }, [messages, session?.user?.id, chatSyncTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android app: voice state + loudness for the floating ROSE rings shown outside the app
  const nativeLevelAtRef = useRef(0);
  useEffect(() => {
    const nat = typeof window !== 'undefined' ? ((window as any).TiyaNative as any) : undefined;
    if (typeof nat?.voiceLevel !== 'function') return;
    const now = Date.now();
    if (now - nativeLevelAtRef.current < 80 && voiceState === 'speaking') return;
    nativeLevelAtRef.current = now;
    try {
      nat.voiceLevel(String(voiceState), Number(audioLevel) || 0);
    } catch {
      /* older Android app */
    }
  }, [voiceState, audioLevel]);

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
      if (action.action === 'courier_dispatch') void refreshParcelsContext(true);

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

  // Voice "হ্যাঁ" / "না" answers the waiting Confirm card (calls and messages).
  const voiceDecidedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let lastUser: ChatMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = messages[i];
        break;
      }
    }
    if (!lastUser || voiceDecidedRef.current.has(lastUser.id)) return;
    const pending = [...messages]
      .reverse()
      .find(
        (m) =>
          m.pendingAction &&
          (m.actionStatus === 'pending' || !m.actionStatus) &&
          m.timestamp <= lastUser!.timestamp &&
          lastUser!.timestamp - m.timestamp < 120000,
      );
    if (!pending?.pendingAction) return;
    const said = lastUser.text
      .toLowerCase()
      .replace(/[.,!?।"'“”‘’¿¡]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const YES = ['হ্যাঁ', 'হ্যা', 'হা', 'হাঁ', 'হুম', 'জি', 'জ্বি', 'জী', 'ইয়েস', 'ওকে', 'ঠিক আছে', 'পাঠাও', 'পাঠিয়ে দাও', 'পাঠিয়ে দিন', 'দাও', 'কল দাও', 'সেন্ড', 'yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'send', 'haan', 'han', 'ha', 'हाँ', 'हां', 'हैं', 'sí', 'si'];
    const NO = ['না', 'নাহ', 'না থাক', 'বাতিল', 'থাক', 'cancel', 'no', 'nope', 'नहीं'];
    const starts = (words: string[]) => words.some((w) => said === w || said.startsWith(`${w} `));
    // "no" only cancels as a short answer, not a long sentence that starts with it
    const shortAnswer = said.split(' ').length <= 3;
    if (starts(NO) && shortAnswer) {
      voiceDecidedRef.current.add(lastUser.id);
      handleCancelAction(pending.id);
    } else if (starts(YES)) {
      voiceDecidedRef.current.add(lastUser.id);
      void handleConfirmAction(pending.id, pending.pendingAction);
    } else if (!starts(NO)) {
      // Voice text came out wrong (e.g. "un paredón") but ROSE heard his yes and said she is sending
      const at = messages.findIndex((m) => m.id === lastUser!.id);
      const roseReply = messages
        .slice(at + 1)
        .find((m) => m.role === 'assistant' && !m.pendingAction && m.text.trim());
      const reply = roseReply ? roseReply.text.normalize('NFC') : '';
      const sendingWords = ['পাঠাচ্ছি', 'পাঠাইতেছি', 'পাঠাই দিছি', 'পাঠাই দিচ্ছি', 'পাঠিয়ে দিচ্ছি', 'পাঠিয়ে দিলাম', 'কল দিচ্ছি', 'কল দিতেছি', 'কল দিলাম', 'দিয়ে দিচ্ছি', 'দিয়ে দিলাম', 'খুলে দিচ্ছি', 'খুলে দিলাম'].map((w) => w.normalize('NFC'));
      if (reply && sendingWords.some((w) => reply.includes(w)) && !/\?\s*$/.test(reply.trim())) {
        voiceDecidedRef.current.add(lastUser.id);
        void handleConfirmAction(pending.id, pending.pendingAction);
      }
    }
  }, [messages, handleConfirmAction, handleCancelAction]);

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

  // A team helper finished: ROSE tells him the main point; if he does not answer in 10 minutes, ROSE reminds once
  const agentReportsRef = useRef<Map<string, { at: number; name: string; nameBn: string; result: string; reminded: boolean }>>(new Map());
  const announceAgentResult = useCallback(
    (msgId: string, who: { name: string; nameBn: string }, ok: boolean, result: string) => {
      agentReportsRef.current.set(msgId, { at: Date.now(), name: who.name, nameBn: who.nameBn, result, reminded: false });
      if (['listening', 'thinking', 'speaking'].includes(liveVoiceStateRef.current) && !premiumVoiceModeRef.current) {
        sendActionFeedbackToLive(
          ok
            ? `[App note: ${who.name} (${who.nameBn}) finished the task. Result: ${result.slice(0, 700)}\nTell him the main point in 1-3 short sentences as ROSE, like "${who.nameBn} জানাল…". Do not read every line; the full report is in the chat.]`
            : `[App note: ${who.name} could not finish the task (${result.slice(0, 200)}). Tell him briefly.]`,
        );
      }
    },
    [sendActionFeedbackToLive],
  );
  useEffect(() => {
    const t = window.setInterval(() => {
      const list = hangupMessagesRef.current;
      for (const [id, r] of agentReportsRef.current) {
        if (r.reminded || Date.now() - r.at < 10 * 60 * 1000) continue;
        const at = list.findIndex((m) => m.id === id);
        const answered = at >= 0 && list.slice(at + 1).some((m) => m.role === 'user');
        r.reminded = true;
        if (answered || at < 0) continue;
        if (['listening', 'thinking', 'speaking'].includes(liveVoiceStateRef.current) && !premiumVoiceModeRef.current) {
          sendActionFeedbackToLive(`[App note: he has not answered ${r.name}'s report for 10 minutes. ${r.nameBn} asked you to make sure he knows. Remind him softly in one or two sentences with the main point: ${r.result.slice(0, 300)}]`);
        } else {
          updateMessages((prev) => [
            ...prev,
            { id: makeId(), role: 'assistant', text: `${r.nameBn} আবার মনে করিয়ে দিতে বলল: ওর রিপোর্টটা কি দেখেছ? উপরে 【${r.name}】 লেখা মেসেজে আছে।`, timestamp: Date.now(), source: 'chat' },
          ]);
        }
      }
    }, 60000);
    return () => window.clearInterval(t);
  }, [sendActionFeedbackToLive, updateMessages]);

  // Voice: "জায়ানকে প্রশ্ন করো ..." → the team helper does it (never a WhatsApp / call)
  const voiceTeamDoneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!teamRef.current.enabled || !teamRef.current.userId) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || lastUser.source !== 'voice' || voiceTeamDoneRef.current.has(lastUser.id)) return;
    if (lastUser.timestamp < appOpenedAtRef.current || fromOtherDeviceRef.current.has(lastUser.id)) return;
    const t = window.setTimeout(() => {
      // wait until he finished the sentence
      const cmd = parseAgentCommand(lastUser.text);
      if (!cmd || voiceTeamDoneRef.current.has(lastUser.id)) return;
      voiceTeamDoneRef.current.add(lastUser.id);
      const who = agentById(cmd.agent);
      const nameRe = new RegExp(`(${who.name}|${who.nameBn})`, 'i');
      // drop a phone action ROSE may have made for this name by mistake
      updateMessages((prev) =>
        prev.filter(
          (m) =>
            !(
              m.pendingAction &&
              m.timestamp >= lastUser.timestamp &&
              (m.actionStatus === 'pending' || !m.actionStatus) &&
              'contact' in m.pendingAction &&
              nameRe.test(String((m.pendingAction as any).contact || ''))
            ),
        ),
      );
      sendActionFeedbackToLive(`[App note: the task was given to ${who.name} (${who.nameBn}) on the ROSE team, not to a phone contact. Tell him in one short line that ${who.nameBn} is working on it.]`);
      const uid = teamRef.current.userId!;
      void runAgentTask(uid, cmd.agent, cmd.task, 'voice').then((done) => {
        if (!done) return;
        const reportId = makeId();
        announceAgentResult(reportId, who, done.status === 'done', String(done.result || ''));
        updateMessages((prev) => [
          ...prev,
          {
            id: reportId,
            role: 'assistant',
            text: done.status === 'done' ? `【${who.name}】 ${done.result || ''}` : `【${who.name}】 কাজটা করতে পারিনি: ${done.result || 'unknown error'}`,
            timestamp: Date.now(),
            source: 'chat',
          },
        ]);
      });
    }, 1800);
    return () => window.clearTimeout(t);
  }, [messages, updateMessages, sendActionFeedbackToLive, announceAgentResult]);

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
          const reportId = makeId();
          announceAgentResult(reportId, who, done.status === 'done', String(done.result || ''));
          updateMessages((prev) => [
            ...prev,
            {
              id: reportId,
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
      announceAgentResult,
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
    setCameraOn(false);
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
    if (!session?.user?.id || (isAdmin && profile?.account_mode !== 'business')) {
      clearModeContext();
      return;
    }
    void refreshModeContext(profile?.account_mode ?? null, session.user.id);
  }, [session?.user?.id, isAdmin, profile?.account_mode]);

  // Business: open parcels + couriers for ROSE (admin too, when his mode is Business),
  // and once a day at the shop's time ROSE asks which courier to send them with.
  const isBusinessMode = profile?.account_mode === 'business';
  useEffect(() => {
    void refreshParcelsContext(Boolean(session?.user?.id) && isBusinessMode);
  }, [session?.user?.id, isBusinessMode]);
  const parcelAskRef = useRef({ voiceOn: false, premium: false });
  parcelAskRef.current = {
    voiceOn: ['listening', 'thinking', 'speaking'].includes(liveVoiceState),
    premium: premiumVoiceMode,
  };
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isBusinessMode) return;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      const now = new Date();
      const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const doneKey = `rose_parcel_ask_${uid}_${day}`;
      try {
        if (localStorage.getItem(doneKey)) return;
      } catch {
        return;
      }
      busy = true;
      try {
        const { data: b } = await supabase.from('businesses').select('id').eq('owner_id', uid).maybeSingle();
        if (!b?.id) return;
        const { data: ai } = await supabase.from('business_ai_settings').select('parcel_ask_on,parcel_ask_time').eq('business_id', b.id).maybeSingle();
        if (ai && ai.parcel_ask_on === false) return;
        const [hh, mm] = String(ai?.parcel_ask_time || '16:00').split(':').map((x: string) => Number(x) || 0);
        if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
        const count = await refreshParcelsContext(true);
        try {
          localStorage.setItem(doneKey, '1');
        } catch {
          /* ignore */
        }
        if (count <= 0) return;
        if (parcelAskRef.current.voiceOn && !parcelAskRef.current.premium) {
          sendActionFeedbackToLive(
            `[App note, not his words: it is parcel time. ${count} open parcel(s) are waiting for a courier (see PARCELS). Tell him briefly and ask which courier to send them with, naming the shop couriers, or whether to split them.]`,
          );
        } else {
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text: `পার্সেল পাঠানোর সময় হয়েছে। আজ ${count}টা পার্সেল কুরিয়ারে দেওয়া বাকি। কোন কুরিয়ারে পাঠাব? চাইলে ভাগ করেও বলতে পারেন, যেমন "৩টা Steadfast-এ, বাকিগুলো Pathao-তে"।`,
              timestamp: Date.now(),
              source: 'chat',
            },
          ]);
        }
      } finally {
        busy = false;
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), 60000);
    return () => window.clearInterval(t);
  }, [session?.user?.id, isBusinessMode, sendActionFeedbackToLive, updateMessages]);

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
          ? 'relative isolate grid h-[100dvh] w-full grid-cols-[minmax(0,1fr)_380px] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-[#07060F] p-3'
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
                cameraOn={cameraOn}
                onToggleCamera={toggleCamera}
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
                cameraOn={cameraOn}
                onToggleCamera={toggleCamera}
              />
            )}

            {cameraOn && (
              <CameraPreview
                onClose={() => setCameraOn(false)}
                onFrame={
                  !premiumVoiceMode && ['listening', 'thinking', 'speaking'].includes(liveVoiceState)
                    ? sendVideoFrame
                    : undefined
                }
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
