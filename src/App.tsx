import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  ChatMessage,
  MainTab,
  NotificationItem,
  PhoneAction,
  SettingsPageId,
  TiyaSettings,
  UserProfile,
} from './types/tiya';
import {
  clearAllChatsStorage,
  loadChats,
  loadSettings,
  saveChats,
  saveSettings,
} from './utils/storage';
import {
  calculateAge,
  getCachedBirthYear,
  parseUseReplyResult,
  ReplyUsageDecision,
  setCachedBirthYear,
} from './utils/authErrors';
import { buildTiyaSystemPrompt } from './utils/prompts';
import {
  executePhoneAction,
  extractActionFromText,
  getConfirmationPromptText,
} from './utils/phoneActions';
import { useTiyaLiveVoice } from './hooks/useTiyaLiveVoice';
import { LoginScreen } from './components/auth/LoginScreen';
import { AgeCheckScreen } from './components/auth/AgeCheckScreen';
import { HomeScreen } from './components/HomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { BottomNav } from './components/BottomNav';
import { NotificationsSheet } from './components/NotificationsSheet';
import { AdminScreen } from './components/admin/AdminScreen';
import { SettingsHub } from './components/settings/SettingsHub';
import { ConnectionsPage } from './components/settings/ConnectionsPage';
import { LiveModelPage } from './components/settings/LiveModelPage';
import { VoiceLanguagePage } from './components/settings/VoiceLanguagePage';
import { ChatsMemoryPage } from './components/settings/ChatsMemoryPage';
import { MyAccountPage } from './components/settings/MyAccountPage';
import {
  AboutGuidePage,
  LookFeelPage,
  PhoneControlPage,
} from './components/settings/AboutLookPhonePages';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [settings, setSettings] = useState<TiyaSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChats());
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [settingsPage, setSettingsPage] = useState<SettingsPageId>('hub');
  const [showAdminScreen, setShowAdminScreen] = useState(false);

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

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', settings.theme === 'dark' ? '#090B10' : '#F8FAFC');
    }
  }, [settings.theme]);

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

  const {
    voiceState,
    errorLabel,
    errorDetail,
    audioLevel,
    toggleVoice,
    stopVoice,
    sendActionFeedbackToLive,
  } = useTiyaLiveVoice({
    settings,
    messages,
    userAge,
    checkReplyUsage,
    onAppendVoiceMessage: handleAppendVoiceMessage,
    onUpdateLastVoiceMessage: handleUpdateLastVoiceMessage,
    onPhoneAction: handleLivePhoneAction,
  });

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

  const handleSendChat = useCallback(
    async (text: string) => {
      setChatError('');
      const key = settings.apiKey.trim();
      if (!key) {
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
        );
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
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          text?: string;
          action?: PhoneAction | null;
          label?: string;
          detail?: string;
        };

        if (!res.ok || !data.ok) {
          setChatError(data.label ? `${data.label}: ${data.detail || ''}` : 'Chat request failed.');
          return;
        }

        const { cleanText, action: inlineAction } = extractActionFromText(data.text || '');
        const pendingAction = data.action || inlineAction || undefined;
        const replyText =
          cleanText ||
          (pendingAction ? getConfirmationPromptText(pendingAction) : 'বলুন, কীভাবে সাহায্য করতে পারি?');

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
      } catch {
        setChatError('Network error while contacting Gemini.');
      } finally {
        setIsSendingChat(false);
      }
    },
    [checkReplyUsage, messages, settings, updateMessages, userAge],
  );

  const handleDeleteMessage = useCallback(
    (id: string) => {
      updateMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [updateMessages],
  );

  const handleClearAllChats = useCallback(() => {
    clearAllChatsStorage();
    setMessages([]);
    setActionLinks({});
  }, []);

  const openConnections = useCallback(() => {
    setActiveTab('settings');
    setSettingsPage('connections');
  }, []);

  const handleSelectTab = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    if (tab !== 'settings') {
      setSettingsPage('hub');
    }
  }, []);

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
    await supabase.auth.signOut();
    setShowAdminScreen(false);
    setActiveTab('home');
    setSettingsPage('hub');
  }, [stopVoice]);

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
          <LoginScreen />
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
            onBackToHome={() => setShowAdminScreen(false)}
            onLogout={handleSignOut}
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
                onToggleVoice={toggleVoice}
                onOpenConnections={openConnections}
                onOpenNotifications={handleOpenNotifications}
                onOpenAdmin={() => setShowAdminScreen(true)}
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
              />
            )}

            {activeTab === 'settings' && settingsPage === 'hub' && (
              <SettingsHub
                settings={settings}
                messageCount={messages.length}
                userEmail={session.user.email}
                onOpenPage={setSettingsPage}
                onClearAllChats={handleClearAllChats}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'about' && (
              <AboutGuidePage onBack={() => setSettingsPage('hub')} />
            )}

            {activeTab === 'settings' && settingsPage === 'connections' && (
              <ConnectionsPage
                settings={settings}
                onUpdateSettings={updateSettings}
                onBack={() => setSettingsPage('hub')}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'live_model' && (
              <LiveModelPage
                settings={settings}
                onUpdateSettings={updateSettings}
                onBack={() => setSettingsPage('hub')}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'voice_language' && (
              <VoiceLanguagePage
                settings={settings}
                onUpdateSettings={updateSettings}
                onBack={() => setSettingsPage('hub')}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'chats_memory' && (
              <ChatsMemoryPage
                messages={messages}
                onDeleteMessage={handleDeleteMessage}
                onClearAll={handleClearAllChats}
                onBack={() => setSettingsPage('hub')}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'look_feel' && (
              <LookFeelPage
                settings={settings}
                onUpdateSettings={updateSettings}
                onBack={() => setSettingsPage('hub')}
              />
            )}

            {activeTab === 'settings' && settingsPage === 'phone_control' && (
              <PhoneControlPage onBack={() => setSettingsPage('hub')} />
            )}

            {activeTab === 'settings' && settingsPage === 'my_account' && (
              <MyAccountPage
                user={session.user}
                profile={profile}
                onBack={() => setSettingsPage('hub')}
                onSignedOut={() => {
                  setActiveTab('home');
                  setSettingsPage('hub');
                }}
              />
            )}

            {!isInSettingsSubpage && (
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
