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
  StorageAccountScope,
} from './utils/storage';
import {
  calculateAge,
  getCachedBirthYear,
  parseUseReplyResult,
  ReplyUsageDecision,
  setCachedBirthYear,
} from './utils/authErrors';
import {
  buildCleanUrlAfterAuthCallback,
  extractOAuthCallbackError,
} from './utils/authRedirect';
import { extractExplicitMemories, mergeMemories } from './utils/memoryEngine';
import { buildTiyaSystemPrompt, enforceAdminAddressingText } from './utils/prompts';
import {
  executePhoneAction,
  extractActionFromText,
  getConfirmationPromptText,
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
import { LoginScreen } from './components/auth/LoginScreen';
import { AgeCheckScreen } from './components/auth/AgeCheckScreen';
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

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [settings, setSettings] = useState<TiyaSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
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
  const [authCallbackError, setAuthCallbackError] = useState('');
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

    const cleanAuthUrlAfterSdk = () => {
      if (typeof window === 'undefined') return;
      const cleanUrl = buildCleanUrlAfterAuthCallback(window.location.href);
      if (cleanUrl) {
        try {
          window.history.replaceState(window.history.state, document.title, cleanUrl);
        } catch {
          // Ignore history errors in restricted WebViews
        }
      }
    };

    // Wait for Supabase SDK to finish detectSessionInUrl (#access_token or ?code)
    // before cleaning sensitive tokens/params from the address bar.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const callbackErr =
        typeof window !== 'undefined'
          ? extractOAuthCallbackError(window.location.search, window.location.hash)
          : null;

      if (data.session?.user?.id) {
        setSession(data.session);
        setAuthCallbackError('');
        setCachedBirthYearState(getCachedBirthYear(data.session.user.id));
        cleanAuthUrlAfterSdk();
      } else {
        setSession(null);
        if (callbackErr) {
          setAuthCallbackError(callbackErr);
          cleanAuthUrlAfterSdk();
        } else if (error?.message) {
          setAuthCallbackError(error.message);
        }
      }
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      if (nextSession?.user?.id) {
        setAuthCallbackError('');
        setCachedBirthYearState(getCachedBirthYear(nextSession.user.id));
        cleanAuthUrlAfterSdk();
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
  // Backend-verified Admin identity strictly from Supabase is_admin RPC + active authenticated session
  // (NEVER derived from a client-side email string, display name, or client-editable settings)
  const isVerifiedAdmin = Boolean(session?.user?.id) && isAdmin === true;

  const accountScope: StorageAccountScope = useMemo(
    () => ({
      userId: session?.user?.id,
      isVerifiedAdmin,
    }),
    [session?.user?.id, isVerifiedAdmin],
  );
  const accountScopeRef = useRef<StorageAccountScope>(accountScope);
  accountScopeRef.current = accountScope;

  // Reload isolated per-account chats & memories whenever authenticated user or verified Admin status changes
  useEffect(() => {
    if (!session?.user?.id) {
      setMessages([]);
      setMemories([]);
      return;
    }
    setMessages(loadChats(accountScope));
    setMemories(loadMemories(accountScope));
  }, [session?.user?.id, accountScope]);

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
      saveChats(next, accountScopeRef.current);
      return next;
    });
  }, []);

  const ingestExplicitMemory = useCallback((utterance: string) => {
    const scope = accountScopeRef.current;
    if (!scope.userId) return;
    const memScope = scope.isVerifiedAdmin ? 'admin' : 'user';
    setMemories((prev) => {
      const extracted = extractExplicitMemories(utterance, prev, memScope);
      if (extracted.length === 0) return prev;
      const merged = mergeMemories(prev, extracted);
      saveMemories(merged, scope);
      return merged;
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
    voiceState,
    errorLabel,
    errorDetail,
    audioLevel,
    cameraActive,
    cameraError,
    toggleVoice,
    stopVoice,
    toggleCamera,
    sendActionFeedbackToLive,
  } = useTiyaLiveVoice({
    settings,
    messages,
    memories,
    userAge,
    isOwner: isVerifiedAdmin,
    checkReplyUsage,
    onAppendVoiceMessage: handleAppendVoiceMessage,
    onUpdateLastVoiceMessage: handleUpdateLastVoiceMessage,
    onUserTranscriptFinalized: ingestExplicitMemory,
    onPhoneAction: handleLivePhoneAction,
    onNavigate: handleNavigateCommand,
    onRequestLatestMotivation: fetchLatestPublishedMotivation,
  });

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
      const result = await executePhoneAction(
        action,
        typeof window !== 'undefined' ? window.TiyaNative : undefined,
        (url) => {
          setActionLinks((prev) => ({ ...prev, [msgId]: url }));
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
          isVerifiedAdmin,
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
          const cleanMot = data.text.trim();
          return isVerifiedAdmin ? enforceAdminAddressingText(cleanMot) : cleanMot;
        }
      } catch {
        // Fallback to direct formatted Bengali response
      }

      return formatMotivationReplyBn(post);
    },
    [isVerifiedAdmin, memories, messages, settings, userAge],
  );

  const handleSendChat = useCallback(
    async (text: string) => {
      setChatError('');

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
      // No own key: Premium customers (and the admin) use the TIYA PREMIUM server
      const usePremiumServer = !key && (isAdmin || isProfilePremium(profile));
      if (!key && !usePremiumServer) {
        setChatError('No API key. Add your Gemini API key in Settings > Connections.');
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
      ingestExplicitMemory(text);
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
          isVerifiedAdmin,
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
          const pRaw =
            pClean ||
            (pAction
              ? getConfirmationPromptText(pAction)
              : isVerifiedAdmin
                ? 'স্যার, বলুন না, আপনার কী কথা আছে?'
                : 'বলুন, কীভাবে সাহায্য করতে পারি?');
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'assistant',
              text: isVerifiedAdmin ? enforceAdminAddressingText(pRaw) : pRaw,
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
        const rawReplyText =
          cleanText ||
          (pendingAction
            ? getConfirmationPromptText(pendingAction)
            : parsedNav
              ? parsedNav.confirmBn
              : isVerifiedAdmin
                ? 'স্যার, বলুন না, আপনার কী কথা আছে?'
                : 'বলুন, কীভাবে সাহায্য করতে পারি?');
        const replyText = isVerifiedAdmin ? enforceAdminAddressingText(rawReplyText) : rawReplyText;

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
      ingestExplicitMemory,
      isAdmin,
      isVerifiedAdmin,
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
    clearAllChatsStorage(accountScopeRef.current);
    setMessages([]);
    setActionLinks({});
  }, []);

  const handleAddMemory = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const scope = accountScopeRef.current;
    setMemories((prev) => {
      const next: MemoryItem[] = [
        ...prev,
        {
          id: makeId(),
          text: clean,
          createdAt: Date.now(),
          category: 'general',
          scope: scope.isVerifiedAdmin ? 'admin' : 'user',
        },
      ];
      saveMemories(next, scope);
      return next;
    });
  }, []);

  const handleDeleteMemory = useCallback((id: string) => {
    const scope = accountScopeRef.current;
    setMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMemories(next, scope);
      return next;
    });
  }, []);

  const handleClearMemories = useCallback(() => {
    setMemories([]);
    saveMemories([], accountScopeRef.current);
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
    setMessages([]);
    setMemories([]);
    await supabase.auth.signOut();
    setShowAdminScreen(false);
    setShowMotivationScreen(false);
    setActiveTab('home');
    setSettingsPage('hub');
    setSettingsSubpage(null);
    navHistoryRef.current = [];
  }, [stopVoice]);

  const chatSessionCount = useMemo(
    () => groupMessagesIntoChatSessions(messages).length,
    [messages],
  );

  const unreadNotifications = notifications.filter((n) => !n.read_at).length;
  const needsAgeCheck =
    Boolean(session?.user) &&
    profileLoaded &&
    effectiveBirthYear === null;

  const isInSettingsSubpage = activeTab === 'settings' && settingsPage !== 'hub';

  return (
    <div
      className={`flex min-h-[100dvh] w-full items-center justify-center bg-[#05070B] min-[481px]:p-3 ${
        settings.reduceMotion ? 'reduce-motion' : ''
      }`}
    >
      {/* Portrait Phone Container */}
      <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 text-slate-900 min-[481px]:h-[min(calc(100dvh-24px),900px)] min-[481px]:max-w-[420px] min-[481px]:rounded-[28px] min-[481px]:border min-[481px]:border-white/[0.12] min-[481px]:shadow-2xl dark:bg-[#090B10] dark:text-[#F4F5F7]">
        {!authReady ? (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Loading TIYA...
          </div>
        ) : !session ? (
          <LoginScreen initialError={authCallbackError} />
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
            onBackToHome={() => setShowAdminScreen(false)}
            onOpenMotivation={() => {
              setShowAdminScreen(false);
              setShowMotivationScreen(true);
            }}
            onLogout={handleSignOut}
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
                isAdmin={isVerifiedAdmin}
                canUseWithoutKey={isVerifiedAdmin || isProfilePremium(profile)}
                cameraActive={cameraActive}
                cameraError={cameraError}
                onToggleCamera={toggleCamera}
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
                onOpenConnections={openConnections}
                isVoiceOn={['connecting', 'listening', 'thinking', 'speaking', 'interrupted'].includes(voiceState)}
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
                isAdmin={isVerifiedAdmin}
                onOpenPage={handleOpenSettingsPage}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'about' && (
              <AboutGuidePage
                settings={settings}
                voiceState={voiceState}
                hasSession={Boolean(session)}
                isAdmin={isVerifiedAdmin}
                canUseWithoutKey={isVerifiedAdmin || isProfilePremium(profile)}
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
                isAdmin={isVerifiedAdmin}
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
                isAdmin={isVerifiedAdmin}
                onDeleteSessionMessages={handleDeleteSessionMessages}
                onDeleteMemory={handleDeleteMemory}
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
                onRefreshProfile={() => {
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

            {activeTab !== 'home' && activeTab !== 'chat' && !isInSettingsSubpage && (
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
    </div>
  );
}
