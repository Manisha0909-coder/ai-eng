import { AnimatePresence, motion } from "framer-motion";
import { NewtonMark, NewtonLockup } from "@/components/branding/NewtonLogo";
import { API_CONFIG } from "@/config/api";
import { VITE_API_BASE_URL } from "@/env";
import { useIsTruncated } from "@/hooks/useIsTruncated";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { clearSessionStorage } from "@/utils/helper";
import { flushClientSessionBeforeBffLogout } from "@/utils/logoutClientCleanup";
import { COLOR_SCHEME_CHANGED, isDarkMode, toggleDarkMode } from "@/utils/theme";
import axios from "axios";
import {
  AlarmClock,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  Send,
  Smartphone,
  Sun,
  UserCircle,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import notify from "@/utils/notify";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppLocalState } from "@/hooks/useAppState";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import {
  archiveChatSession,
  checkChatStreamStatus,
  deleteChatSession,
  fetchArchivedChatSessions,
  fetchChatSessions,
  fetchUserMessages,
  searchChats,
  unarchiveChatSession,
  updateChatPin,
  validateSession,
  type SessionTypeFilter,
} from "@/services/chat/api";
import { mergeServerMessages } from "@/services/chat/messageMerge";
import { sessionMessageCache } from "@/services/chat/sessionMessageCache";
import {
  isUserEventsFeedLive,
  subscribeUserEvents,
} from "@/services/chat/userEventsFeed";
import { useChatStore } from "@/store/chatStore";
import { generateChatId } from "@/utils/helper";
import type { Message } from "@/types/message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteConfirmationModal } from "@/features/dashboard/components/DeleteConfirmationModal";

function SessionTitle({
  title,
  isActive,
  onDoubleClick,
}: {
  title: string;
  isActive: boolean;
  onDoubleClick: (e: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  const { ref, isTruncated } = useIsTruncated(title);

  const titleEl = (
    <span
      ref={ref}
      className={`text-sm transition-colors duration-150 ${
        isActive ? "font-medium text-primary" : "text-text-main font-normal"
      } truncate block`}
      style={{ lineHeight: "1.4" }}
      onDoubleClick={onDoubleClick}
    >
      {title}
    </span>
  );

  if (!isTruncated) {
    return titleEl;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{titleEl}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="whitespace-nowrap rounded-md shadow-md bg-background/90 text-text-main px-3 py-1 border border-border-main pointer-events-none max-w-[240px]"
      >
        <p className="font-medium text-sm break-words">{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ChatSession {
  session_id: string;
  chat_title: string;
  user_id: string;
  is_pin?: boolean;
  persona_id: number;
  persona_name?: string;
  type?: "chat" | "dashboard";
  last_source?: string;
  active_task_count?: number;
}

const SESSION_SOURCE_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  telegram: { Icon: Send, label: "Last message from Telegram" },
  desktop: { Icon: Monitor, label: "Last message from desktop" },
  mobile: { Icon: Smartphone, label: "Last message from mobile" },
};

/** Alarm-clock badge shown while a chat has pending reminders/tasks. */
function SessionTaskIcon({ count }: { count?: number }) {
  if (!count) return null;
  const label = count === 1 ? "1 active reminder" : `${count} active reminders`;
  return (
    <span
      className="flex-shrink-0 text-primary/80"
      title={label}
      aria-label={label}
    >
      <AlarmClock className="h-[11px] w-[11px]" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function SessionSourceIcon({ source }: { source?: string | null }) {
  const entry = source ? SESSION_SOURCE_ICONS[source] : undefined;
  if (!entry) return null;
  const { Icon, label } = entry;
  return (
    <span
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      title={label}
      aria-label={label}
    >
      <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

export function AppSidebar({
  sidebarTracker,
}: {
  sidebarTracker: boolean | null;
}) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [isRecentChatsCollapsed, setIsRecentChatsCollapsed] = useState(false);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMoreArchived, setIsLoadingMoreArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [archivedCurrentPage, setArchivedCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreArchived, setHasMoreArchived] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const isMobile = useIsMobile();
  const [, setHoveredItem] = useState<string | null>(null);
  const [pendingSessionDelete, setPendingSessionDelete] = useState<{
    sessionId: string;
    chatTitle: string;
    activeTaskCount: number;
    /** "confirm" is the normal delete prompt; "tasks" is the extra prompt
     * shown when the chat still has pending reminders/tasks. */
    stage: "confirm" | "tasks";
  } | null>(null);
  const [sessionTypeFilter, setSessionTypeFilter] =
    useState<SessionTypeFilter>("all");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const archivedScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarContentRef = useRef<HTMLDivElement | null>(null);
  const isLoadingChatSessionsRef = useRef<boolean>(false);
  const loadChatSessionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingSessionRef = useRef<boolean>(false);
  /** Monotonic id per session click; only the latest click may touch shared state. */
  const selectSeqRef = useRef(0);
  const hasShownAccessErrorRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  // Start closed on mobile so the drawer doesn't flash open while
  // useIsMobile settles on first render.
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth < 768);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDark, setIsDark] = useState(() => isDarkMode());

  useEffect(() => {
    const handler = () => setIsDark(isDarkMode());
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const handleToggleTheme = useCallback(() => {
    try {
      toggleDarkMode();
      setIsDark(isDarkMode());
    } catch (e) {
      console.error(e);
    }
  }, []);
  const {
    searchQuery,
    searchResults,
    isSearchModeActive,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
    setIsSearchModeActive,
    searchPersonaIds,
    isAuthenticated,
    isAdmin,
  } = useStore();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isChatShare = location.pathname.includes("chat_share");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const {
    sessionId: storedSessionId,
    setSessionId,
    userId,
    setSelectedPersonaId,
    selectedPersonaId,
    personas,
    setNewChatType,
    setIsViewingArchivedSession,
    setIsSessionPersonaDeleted,
  } = useStore();
  useEffect(() => {
    setActiveSessionId(storedSessionId);
  }, [storedSessionId]);

  // Get chat store functions
  const { addChat, setCurrentChat, clearAllChats } = useChatStore();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  // Get app loading state
  const { setIsLoadingMessages } = useAppLocalState();

  // Pagination constants
  const PAGE_SIZE = isMobile ? 15 : 30;

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (isLoggingOut) return;
    flushSync(() => setIsLoggingOut(true));
    try {
      window.sessionStorage.setItem("logout_in_progress", "true");
    } catch {
      // ignore storage errors
    }

    const returnBase =
      typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
    const redirectUri = new URL("/login", returnBase).toString();
    const authBase = (VITE_API_BASE_URL || "").replace(/\/$/, "");

    try {
      if (typeof window !== "undefined" && authBase) {
        const url = new URL(`${authBase}/auth/logout`);
        url.searchParams.set("redirect_uri", redirectUri);
        try {
          await flushClientSessionBeforeBffLogout();
        } catch (e) {
          console.error("Local session cleanup before BFF logout failed:", e);
        }
        window.location.replace(url.toString());
        return;
      }
    } catch (error) {
      console.error("Failed to build upstream logout URL, falling back:", error);
    }

    try {
      await flushClientSessionBeforeBffLogout();
    } catch (e) {
      console.error("Local session cleanup (fallback logout) failed:", e);
    }
    clearSessionStorage();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  // Load chat sessions when component mounts and validate existing session
  useEffect(() => {
    if (hasInitializedRef.current || location.pathname === "/") {
      return;
    }

    const initializeSessions = async () => {
      hasInitializedRef.current = true;

      const loadedSessions = await loadChatSessions(true);

      const { sessionId: existingSessionId } = useStore.getState();
      if (existingSessionId) {
        const isValid = await validateSession(
          existingSessionId,
          loadedSessions || undefined,
        );
        if (isValid) {
          setActiveSessionId(existingSessionId);
          const activeSession = loadedSessions?.find(
            (s) => s.session_id === existingSessionId,
          );
          if (activeSession) {
            if (activeSession.persona_id === null) {
              setIsSessionPersonaDeleted(true);
              setSelectedPersonaId(null);
            } else {
              setIsSessionPersonaDeleted(false);
              setSelectedPersonaId(activeSession.persona_id);
              const persona = personas.find(
                (p) => p.id === activeSession.persona_id,
              );
              if (persona?.type) {
                setNewChatType(
                  persona.type === "chat" ? "analytical" : "dashboard",
                );
              }
            }
          }
        } else {
          notify.error(
            "You don't have access to this chat session or it no longer exists",
          );
          setSessionId(null);
          setActiveSessionId(null);
          if (location.pathname.startsWith("/chat/")) {
            clearAllChats();
            try {
              window.sessionStorage.setItem("newton.skipRouteSync", "true");
            } catch (error) {
              console.warn("Failed to persist skipRouteSync flag", error);
            }
            navigate("/", { replace: true });
            window.dispatchEvent(new CustomEvent("clearStreamingChatState"));
            window.dispatchEvent(new Event("newChatSessionStarted"));
            const newChatId = generateChatId();
            const newChat = {
              id: newChatId,
              title: "New Chat",
              timestamp: new Date(),
              messages: [],
            };
            addChat(newChat);
            setCurrentChat(newChatId);
          }
        }
      }
    };

    initializeSessions();
  }, [
    setSessionId,
    setSelectedPersonaId,
    location.pathname,
    navigate,
    clearAllChats,
    addChat,
    setCurrentChat,
  ]);

  // Listen for new chat session creation - add directly to sidebar
  useEffect(() => {
    const handleAddNewChatSession = (event: Event) => {
      const customEvent = event as CustomEvent<{
        session_id: string;
        chat_title: string;
        user_id?: string;
        persona_id?: number;
      }>;
      const { session_id, chat_title, user_id, persona_id } =
        customEvent.detail;

      setChatSessions((prev) => {
        const existingSession = prev.find((s) => s.session_id === session_id);
        if (existingSession) {
          if (existingSession.chat_title !== chat_title) {
            return prev.map((s) =>
              s.session_id === session_id ? { ...s, chat_title } : s,
            );
          }
          return prev;
        }

        const pinnedSessions = prev.filter((s) => s.is_pin);
        const unpinnedSessions = prev.filter((s) => !s.is_pin);

        let currentPersonaId: number;
        if (persona_id !== undefined) {
          currentPersonaId = persona_id;
        } else if (
          selectedPersonaId !== null &&
          selectedPersonaId !== undefined
        ) {
          currentPersonaId = selectedPersonaId;
        } else {
          currentPersonaId = 0;
        }

        const newSession: ChatSession = {
          session_id,
          chat_title,
          user_id: user_id || userId || "",
          is_pin: false,
          persona_id: currentPersonaId,
        };

        return [...pinnedSessions, newSession, ...unpinnedSessions];
      });
    };

    window.addEventListener("addNewChatSession", handleAddNewChatSession);

    return () => {
      window.removeEventListener("addNewChatSession", handleAddNewChatSession);
    };
  }, [userId, selectedPersonaId]);

  // Listen for session updates and re-sort sessions when updated_at changes.
  // Uses the silent fingerprinted refresh — a full loadChatSessions(true) here
  // would blank the list behind "Loading sessions..." on every session click.
  useEffect(() => {
    const handleSessionUpdate = () => {
      if (storedSessionId && !isLoadingChatSessionsRef.current) {
        silentRefreshRef.current();
      }
    };

    window.addEventListener("sessionLoadingComplete", handleSessionUpdate);

    const handleMessageUpdate = () => {
      if (loadChatSessionsTimeoutRef.current) {
        clearTimeout(loadChatSessionsTimeoutRef.current);
      }
      loadChatSessionsTimeoutRef.current = setTimeout(() => {
        handleSessionUpdate();
      }, 1000);
    };

    window.addEventListener("updateStreamingChatState", handleMessageUpdate);

    return () => {
      window.removeEventListener("sessionLoadingComplete", handleSessionUpdate);
      window.removeEventListener(
        "updateStreamingChatState",
        handleMessageUpdate,
      );
      if (loadChatSessionsTimeoutRef.current) {
        clearTimeout(loadChatSessionsTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedSessionId]);

  const handleRecentScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (
      scrollTop + clientHeight >= scrollHeight - 100 &&
      !isRecentChatsCollapsed &&
      !isLoadingMore &&
      hasMore
    ) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMore, isLoadingMore, isRecentChatsCollapsed]);

  const handleArchivedScroll = useCallback(() => {
    const container = archivedScrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (
      scrollTop + clientHeight >= scrollHeight - 100 &&
      isArchivedExpanded &&
      !isLoadingMoreArchived &&
      hasMoreArchived
    ) {
      setArchivedCurrentPage((prev) => prev + 1);
    }
  }, [hasMoreArchived, isArchivedExpanded, isLoadingMoreArchived]);

  // Scroll listeners for infinite scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener("scroll", handleRecentScroll);
    return () => scrollContainer.removeEventListener("scroll", handleRecentScroll);
  }, [handleRecentScroll]);

  useEffect(() => {
    const archivedScrollContainer = archivedScrollContainerRef.current;
    if (!archivedScrollContainer) return;

    archivedScrollContainer.addEventListener("scroll", handleArchivedScroll);
    return () =>
      archivedScrollContainer.removeEventListener("scroll", handleArchivedScroll);
  }, [handleArchivedScroll, isArchivedExpanded]);

  // Load more archived sessions when archivedCurrentPage changes
  useEffect(() => {
    if (
      archivedCurrentPage > 1 &&
      isArchivedExpanded &&
      !isLoadingArchived &&
      !isLoadingMoreArchived
    ) {
      loadArchivedSessions(false);
    }
  }, [archivedCurrentPage]);

  useEffect(() => {
    if (loadChatSessionsTimeoutRef.current) {
      clearTimeout(loadChatSessionsTimeoutRef.current);
    }

    if (
      currentPage > 1 &&
      !loadingSessionId &&
      !isLoadingChatSessionsRef.current &&
      !isSelectingSessionRef.current
    ) {
      loadChatSessionsTimeoutRef.current = setTimeout(() => {
        loadChatSessions(false);
      }, 200);
    }

    return () => {
      if (loadChatSessionsTimeoutRef.current) {
        clearTimeout(loadChatSessionsTimeoutRef.current);
      }
    };
  }, [currentPage, loadingSessionId]);

  // Debounced search function
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      if (searchResults.length > 0) {
        loadChatSessions(true);
      }
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const personaFilterIds =
          Array.isArray(searchPersonaIds) && searchPersonaIds.length > 0
            ? searchPersonaIds
            : undefined;

        const results = await searchChats(
          searchQuery.trim(),
          50,
          personaFilterIds,
        );
        setSearchResults(results.results || []);
      } catch (error) {
        console.error("Failed to search chats:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 1000);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchPersonaIds]);

  const loadArchivedSessions = async (
    reset: boolean = false,
  ): Promise<ChatSession[] | null> => {
    if (isLoadingArchived || (isLoadingMoreArchived && !reset)) {
      return null;
    }

    if (reset) {
      setIsLoadingArchived(true);
      setArchivedCurrentPage(1);
    } else {
      setIsLoadingMoreArchived(true);
    }

    try {
      const offset = reset ? 0 : archivedSessions.length;
      const result = await fetchArchivedChatSessions(PAGE_SIZE, offset);

      const newSessions: ChatSession[] = result.sessions.map((s) => ({
        session_id: s.session_id,
        chat_title: s.chat_title,
        user_id: userId || "",
        persona_id: s.persona_id,
        persona_name: s.persona_name,
        type: s.type,
        is_pin: false,
      }));

      if (reset) {
        setArchivedSessions(newSessions);
      } else {
        setArchivedSessions((prev) => {
          const existingIds = new Set(prev.map((s) => s.session_id));
          const filteredNew = newSessions.filter(
            (s) => !existingIds.has(s.session_id),
          );
          return [...prev, ...filteredNew];
        });
      }

      setHasMoreArchived(newSessions.length === PAGE_SIZE);
      return newSessions;
    } catch (error) {
      console.error("Failed to load archived chat sessions:", error);
      notify.error("Failed to load archived chat sessions");
      return null;
    } finally {
      setIsLoadingArchived(false);
      setIsLoadingMoreArchived(false);
    }
  };

  const loadChatSessions = async (
    reset: boolean = false,
    filter?: SessionTypeFilter,
  ): Promise<ChatSession[] | null> => {
    if (isLoadingChatSessionsRef.current) {
      return null;
    }

    if (isSelectingSessionRef.current || loadingSessionId !== null) {
      return null;
    }

    if (loadChatSessionsTimeoutRef.current) {
      clearTimeout(loadChatSessionsTimeoutRef.current);
      loadChatSessionsTimeoutRef.current = null;
    }

    isLoadingChatSessionsRef.current = true;

    if (reset) {
      setIsLoadingSessions(true);
      setCurrentPage(1);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const currentUserId = userId;

      if (currentUserId) {
        const offset = reset ? 0 : chatSessions.length;

        const typeFilter = filter ?? sessionTypeFilter;
        const result = await fetchChatSessions(
          PAGE_SIZE,
          offset,
          undefined,
          typeFilter,
        );

        const unPinnedSessions =
          result.sessions
            ?.filter((session) => !session.is_pin)
            ?.sort(
              (a: any, b: any) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            ) || [];
        const pinnedSessions =
          result.sessions?.filter((session) => session.is_pin) || [];
        const newSessions = [...pinnedSessions, ...unPinnedSessions];

        if (reset) {
          setChatSessions(newSessions);
        } else {
          setChatSessions((prev) => {
            const existingIds = new Set(prev.map((s) => s.session_id));
            const filteredNew = newSessions.filter(
              (s) => !existingIds.has(s.session_id),
            );
            return [...prev, ...filteredNew];
          });
        }

        setHasMore(result.hasMore);
        return newSessions;
      }
      return null;
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
      notify.error("Failed to load chat sessions");
      return null;
    } finally {
      setIsLoadingSessions(false);
      setIsLoadingMore(false);
      setTimeout(() => {
        isLoadingChatSessionsRef.current = false;
      }, 100);
    }
  };

  // Subtle background refresh: picks up conversations created or updated
  // outside this tab (e.g. from Telegram) without spinners, toasts, or
  // scroll resets. Runs every 30s while the tab is visible and on focus.
  const silentRefreshRef = useRef<() => void>(() => {});
  const silentRefreshInFlightRef = useRef(false);
  silentRefreshRef.current = async () => {
    if (
      silentRefreshInFlightRef.current ||
      isLoadingChatSessionsRef.current ||
      isSelectingSessionRef.current ||
      loadingSessionId !== null ||
      editingSessionId !== null ||
      !userId
    ) {
      return;
    }
    silentRefreshInFlightRef.current = true;
    try {
      const result = await fetchChatSessions(PAGE_SIZE, 0, undefined, sessionTypeFilter);
      const unPinned =
        result.sessions
          ?.filter((session) => !session.is_pin)
          ?.sort(
            (a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          ) || [];
      const pinned = result.sessions?.filter((session) => session.is_pin) || [];
      const fresh = [...pinned, ...unPinned];
      setChatSessions((prev) => {
        const itemFingerprint = (s: ChatSession) =>
          `${s.session_id}|${s.chat_title}|${s.is_pin ? 1 : 0}|${s.last_source ?? ""}`;
        const fingerprint = (list: ChatSession[]) =>
          list.map(itemFingerprint).join("~");
        if (fingerprint(prev.slice(0, fresh.length)) === fingerprint(fresh)) {
          return prev;
        }
        // Replace the first page but keep any deeper pages the user has
        // scrolled into. Reuse the previous object for any session that
        // hasn't changed so its row's props stay referentially identical.
        const prevById = new Map(prev.map((s) => [s.session_id, s]));
        const merged = fresh.map((s) => {
          const old = prevById.get(s.session_id);
          return old && itemFingerprint(old) === itemFingerprint(s) ? old : s;
        });
        const freshIds = new Set(fresh.map((s) => s.session_id));
        return [...merged, ...prev.filter((s) => !freshIds.has(s.session_id))];
      });
    } catch {
      // Background refresh must never surface errors.
    } finally {
      silentRefreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    // `focus` and `visibilitychange` both fire when the user returns to the
    // tab; debounce so a refocus triggers a single refresh. Events from the
    // user feed also funnel through here, coalescing bursts (created + title
    // + message) into one refetch.
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        silentRefreshRef.current();
      }, 250);
    };

    // Primary signal: the backend pushes session changes over the user feed.
    const unsubscribe = subscribeUserEvents((event) => {
      if (
        event.type === "session_updated" ||
        event.type === "session_deleted" ||
        event.type === "task_created" ||
        event.type === "task_cancelled" ||
        event.type === "reminder_fired"
      ) {
        tick();
      }
    });

    // Interval polling is a fallback for when the event feed is down; the
    // refocus refresh always runs (one cheap call to catch anything missed
    // while the tab was hidden).
    const fallbackTick = () => {
      if (!isUserEventsFeedLive()) tick();
    };
    const intervalId = setInterval(fallbackTick, 30_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
      if (debounceId) clearTimeout(debounceId);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const handleSaveRename = async (sessionId: string, originalTitle: string) => {
    try {
      if (!editingTitle.trim() || editingTitle === originalTitle) {
        setEditingSessionId(null);
        setEditingTitle("");
        return;
      }

      const res = await axios.post(
        `${API_CONFIG.LOCAL_API_BASE_URL}/session/rename_chat`,
        {
          session_id: sessionId,
          chat_title: editingTitle.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            credentials: "include",
          },
        },
      );

      if (res.status === 200) {
        await loadChatSessions(true);
      }
    } catch (error) {
      notify.error("Failed to rename chat!");
    } finally {
      setEditingSessionId(null);
      setEditingTitle("");
    }
  };

  /** Persona/type bookkeeping for the session being opened. */
  const applySessionPersona = (sessionId: string, isArchived: boolean) => {
    const selectedSession = (isArchived ? archivedSessions : chatSessions).find(
      (s) => s.session_id === sessionId,
    );
    if (!selectedSession) return;
    if (selectedSession.persona_id === null) {
      setIsSessionPersonaDeleted(true);
      setSelectedPersonaId(null);
    } else {
      setIsSessionPersonaDeleted(false);
      setSelectedPersonaId(selectedSession.persona_id);
      const persona = personas.find((p) => p.id === selectedSession.persona_id);
      if (persona?.type) {
        setNewChatType(persona.type === "chat" ? "analytical" : "dashboard");
      }
    }
  };

  /** Keep the outgoing conversation's messages so revisiting it is instant. */
  const snapshotCurrentSessionToCache = () => {
    const outgoingSessionId = useStore.getState().sessionId;
    const outgoingChatId = useChatStore.getState().currentChatId;
    if (!outgoingSessionId || !outgoingChatId) return;
    const chat = useChatStore
      .getState()
      .chats.find((c) => c.id === outgoingChatId);
    if (chat && chat.messages.length > 0) {
      sessionMessageCache.set(outgoingSessionId, {
        chatId: outgoingChatId,
        messages: chat.messages,
      });
    }
  };

  // Instant path for sessions viewed before: render cached messages
  // immediately (no skeleton, no blank-out), then silently revalidate against
  // the server and merge changes in place.
  const selectSessionFromCache = async (
    sessionId: string,
    chatTitle: string,
    cached: { chatId: string; messages: Message[] },
    isArchived: boolean,
    isStaleSelect: () => boolean,
  ) => {
    try {
      // sessionLoading tells useSessionManager to skip its own reload of this
      // session; the skeleton stays hidden because messages render right away.
      window.dispatchEvent(
        new CustomEvent("sessionLoading", { detail: { sessionId } }),
      );
      window.dispatchEvent(new CustomEvent("clearStreamingChatState"));

      applySessionPersona(sessionId, isArchived);
      setSessionId(sessionId);

      clearAllChats();
      addChat({
        id: cached.chatId,
        title: chatTitle,
        timestamp: new Date(),
        messages: cached.messages,
      });
      setCurrentChat(cached.chatId);

      try {
        window.sessionStorage.setItem("newton.skipRouteSync", "false");
      } catch (error) {
        console.warn("Failed to update skipRouteSync flag", error);
      }
      window.dispatchEvent(new Event("resumeRouteSync"));
      navigate(`/chat/${sessionId}`);

      // Silent revalidate: identity-preserving merge, so nothing re-animates
      // unless the server actually has new turns. sessionLoadingComplete is
      // deliberately NOT dispatched until this finishes — it clears the flag
      // that stops useSessionManager from re-fetching (and re-mounting) the
      // thread we just rendered from cache.
      const server = await fetchUserMessages(sessionId).catch(() => null);
      if (isStaleSelect() || useStore.getState().sessionId !== sessionId) return;
      if (server && server.length > 0) {
        const chat = useChatStore
          .getState()
          .chats.find((c) => c.id === cached.chatId);
        const merged = chat ? mergeServerMessages(chat.messages, server) : null;
        if (merged) {
          useChatStore.getState().updateChat(cached.chatId, merged);
          sessionMessageCache.set(sessionId, {
            chatId: cached.chatId,
            messages: merged,
          });
        }
      }

      window.dispatchEvent(new Event("sessionLoadingComplete"));

      if (!isArchived) {
        const stillStreaming = await checkChatStreamStatus(sessionId).catch(
          () => null,
        );
        if (isStaleSelect() || useStore.getState().sessionId !== sessionId)
          return;
        if (stillStreaming === true) {
          window.dispatchEvent(
            new CustomEvent("resumeStreamingSession", { detail: { sessionId } }),
          );
        }
      }
    } finally {
      if (!isStaleSelect()) {
        isSelectingSessionRef.current = false;
        window.dispatchEvent(new Event("sessionLoadingEnded"));
      }
    }
  };

  const handleSelectSession = async (
    sessionId: string,
    chatTitle: string,
    options?: { isArchived?: boolean },
  ) => {
    const isArchived = options?.isArchived === true;
    if (activeSessionId === sessionId) {
      return;
    }

    const seq = ++selectSeqRef.current;
    const isStaleSelect = () => seq !== selectSeqRef.current;

    hasShownAccessErrorRef.current = false;

    snapshotCurrentSessionToCache();

    isSelectingSessionRef.current = true;
    if (loadChatSessionsTimeoutRef.current) {
      clearTimeout(loadChatSessionsTimeoutRef.current);
      loadChatSessionsTimeoutRef.current = null;
    }
    setActiveSessionId(sessionId);
    setCurrentPage(1);

    if (isMobile && !isSearchModeActive) {
      setIsCollapsed(true);
    }

    if (isSearchModeActive) {
      setIsSearchModeActive(false);
      setSearchQuery("");
      setSearchResults([]);
    }

    const cached = sessionMessageCache.get(sessionId);
    if (cached) {
      await selectSessionFromCache(
        sessionId,
        chatTitle,
        cached,
        isArchived,
        isStaleSelect,
      );
      return;
    }

    setLoadingSessionId(sessionId);

    try {
      window.dispatchEvent(
        new CustomEvent("sessionLoading", { detail: { sessionId } }),
      );
      window.dispatchEvent(new CustomEvent("clearStreamingChatState"));

      setIsLoadingMessages(true);

      const currentUserId = userId;

      if (!currentUserId) {
        return;
      }

      if (!isArchived) {
        let isValid = false;
        try {
          isValid = await validateSession(sessionId, chatSessions);
        } catch (validationError: unknown) {
          console.warn("Session validation failed:", validationError);
          isValid = false;
        }

        if (!isValid) {
          hasShownAccessErrorRef.current = true;
          notify.error(
            "You don't have access to this chat session or it no longer exists",
          );
          setSessionId(null);
          setActiveSessionId(null);
          clearAllChats();
          try {
            window.sessionStorage.setItem("newton.skipRouteSync", "true");
          } catch (error) {
            console.warn("Failed to persist skipRouteSync flag", error);
          }
          navigate("/", { replace: true });
          window.dispatchEvent(new CustomEvent("clearStreamingChatState"));
          window.dispatchEvent(new Event("newChatSessionStarted"));
          const newChatId = generateChatId();
          const newChat = {
            id: newChatId,
            title: "New Chat",
            timestamp: new Date(),
            messages: [],
          };
          addChat(newChat);
          setCurrentChat(newChatId);
          isSelectingSessionRef.current = false;
          setLoadingSessionId(null);
          setIsLoadingMessages(false);
          return;
        }
      }

      if (isStaleSelect()) return;

      clearAllChats();

      applySessionPersona(sessionId, isArchived);

      setSessionId(sessionId);

      let messages;
      try {
        messages = await fetchUserMessages(sessionId);
      } catch (fetchError: any) {
        const statusFromMessage =
          typeof fetchError?.message === "string"
            ? Number(fetchError.message.match(/\b(\d{3})\b/)?.[1])
            : undefined;
        const status =
          fetchError?.response?.status || fetchError?.status || statusFromMessage;

        if (isArchived && (status === 403 || status === 404 || status === 400)) {
          notify.error("This chat is archived. Unarchive it to open and continue.");
          isSelectingSessionRef.current = false;
          setLoadingSessionId(null);
          setIsLoadingMessages(false);
          return;
        }
        if (status === 403 || status === 404 || status === 400) {
          hasShownAccessErrorRef.current = true;
          notify.error(
            "You don't have access to this chat session or it no longer exists",
          );
          setSessionId(null);
          setActiveSessionId(null);
          clearAllChats();
          try {
            window.sessionStorage.setItem("newton.skipRouteSync", "true");
          } catch (error) {
            console.warn("Failed to persist skipRouteSync flag", error);
          }
          navigate("/", { replace: true });
          window.dispatchEvent(new CustomEvent("clearStreamingChatState"));
          window.dispatchEvent(new Event("newChatSessionStarted"));
          const newChatId = generateChatId();
          const newChat = {
            id: newChatId,
            title: "New Chat",
            timestamp: new Date(),
            messages: [],
          };
          addChat(newChat);
          setCurrentChat(newChatId);
          isSelectingSessionRef.current = false;
          setLoadingSessionId(null);
          setIsLoadingMessages(false);
          return;
        }
        throw fetchError;
      }

      if (isStaleSelect()) return;

      if (messages && messages.length > 0) {
        clearAllChats();

        const transformedMessages = messages.map((msg) => ({
          ...msg,
          formfields: msg.formFields || null,
        }));

        const newChatId = generateChatId();
        const newChat = {
          id: newChatId,
          title: chatTitle,
          timestamp: new Date(),
          messages: messages,
        };

        addChat(newChat);
        setCurrentChat(newChatId);
        sessionMessageCache.set(sessionId, { chatId: newChatId, messages });

        window.dispatchEvent(
          new CustomEvent("updateStreamingChatState", {
            detail: { messages: transformedMessages },
          }),
        );

        window.dispatchEvent(new Event("sessionLoadingComplete"));

        const stillStreaming = await checkChatStreamStatus(sessionId).catch(
          () => null,
        );
        if (stillStreaming === true) {
          window.dispatchEvent(
            new CustomEvent("resumeStreamingSession", {
              detail: { sessionId },
            }),
          );
        }
      } else {
        const stillStreaming = await checkChatStreamStatus(sessionId).catch(
          () => null,
        );

        window.dispatchEvent(new Event("sessionLoadingComplete"));

        if (stillStreaming === true) {
          window.dispatchEvent(
            new CustomEvent("resumeStreamingSession", {
              detail: { sessionId },
            }),
          );
        } else {
          clearAllChats();
        }
      }

      if (useStore.getState().isSessionPersonaDeleted) {
        notify.error("This persona has been deleted");
      }

      try {
        window.sessionStorage.setItem("newton.skipRouteSync", "false");
      } catch (error) {
        console.warn("Failed to update skipRouteSync flag", error);
      }
      window.dispatchEvent(new Event("resumeRouteSync"));
      navigate(`/chat/${sessionId}`);
    } catch (error: any) {
      console.error("Failed to load chat session:", error);

      if (hasShownAccessErrorRef.current) {
        window.dispatchEvent(new Event("sessionLoadingFailed"));
        return;
      }

      const status = error?.response?.status || error?.status;
      if (status === 403 || status === 404 || status === 400) {
        hasShownAccessErrorRef.current = true;
        notify.error(
          "You don't have access to this chat session or it no longer exists",
        );
        setSessionId(null);
        setActiveSessionId(null);
        clearAllChats();
        try {
          window.sessionStorage.setItem("newton.skipRouteSync", "true");
        } catch (err) {
          console.warn("Failed to persist skipRouteSync flag", err);
        }
        navigate("/", { replace: true });
        window.dispatchEvent(new CustomEvent("clearStreamingChatState"));
        window.dispatchEvent(new Event("newChatSessionStarted"));
        const newChatId = generateChatId();
        const newChat = {
          id: newChatId,
          title: "New Chat",
          timestamp: new Date(),
          messages: [],
        };
        addChat(newChat);
        setCurrentChat(newChatId);
      } else {
        notify.error("Failed to load chat session");
      }
      window.dispatchEvent(new Event("sessionLoadingFailed"));
    } finally {
      // A newer click owns the shared loading state; don't clobber it.
      if (!isStaleSelect()) {
        isSelectingSessionRef.current = false;
        setLoadingSessionId(null);
        setIsLoadingMessages(false);
        // Guarantee a completion signal on every exit path (success, early
        // returns, and thrown errors) so App.tsx can end its loading skeleton.
        window.dispatchEvent(new Event("sessionLoadingEnded"));
      }
    }
  };

  const handleNewChat = async () => {
    snapshotCurrentSessionToCache();

    navigate("/", { replace: true });

    setNewChatType(null);

    if (isSearchModeActive) {
      setIsSearchModeActive(false);
      setSearchQuery("");
      setSearchResults([]);
    }

    setSessionId(null);
    setActiveSessionId(null);

    window.dispatchEvent(new Event("newChatSessionStarted"));
    try {
      window.sessionStorage.setItem("newton.skipRouteSync", "true");
    } catch (error) {
      console.warn("Failed to persist skipRouteSync flag", error);
    }

    clearAllChats();

    setIsViewingArchivedSession(false);
    setIsSessionPersonaDeleted(false);

    window.dispatchEvent(new CustomEvent("clearStreamingChatState"));

    const newChatId = generateChatId();
    const newChat = {
      id: newChatId,
      title: "New Chat",
      timestamp: new Date(),
      messages: [],
    };

    addChat(newChat);
    setCurrentChat(newChatId);
  };

  const handleArchiveSession = async (sessionId: string) => {
    try {
      await archiveChatSession(sessionId);
      const currentSessionId = storedSessionId;
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      loadChatSessions(true);
      if (isArchivedExpanded) {
        loadArchivedSessions(true);
      }
    } catch (error) {
      console.error("Failed to archive chat session:", error);
    }
  };

  const handleUnarchiveSession = async (sessionId: string) => {
    try {
      await unarchiveChatSession(sessionId);
      loadChatSessions(true);
      loadArchivedSessions(true);
    } catch (error) {
      console.error("Failed to unarchive chat session:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      setIsDeletingSession(sessionId);

      await deleteChatSession(sessionId);
      sessionMessageCache.delete(sessionId);

      setArchivedSessions((prev) =>
        prev.filter((s) => s.session_id !== sessionId),
      );

      const currentSessionId = storedSessionId;
      if (currentSessionId === sessionId) {
        handleNewChat();
      }

      loadChatSessions(true);
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      notify.error("Failed to delete chat session");
    } finally {
      setIsDeletingSession(null);
    }
  };

  const handleDeleteAllSessions = async () => {
    if (chatSessions.length === 0 || isDeletingAll) {
      return;
    }

    try {
      setIsDeletingAll(true);
      const currentUserId = userId;

      if (!currentUserId) {
        setIsDeletingAll(false);
        return;
      }

      await deleteChatSession();
      sessionMessageCache.clear();

      handleNewChat();

      setChatSessions([]);
      setSessionId(null);
      setActiveSessionId(null);
      setIsDeletingAll(false);
    } catch (error) {
      setIsDeletingAll(false);
      console.error("Failed to delete all chat sessions:", error);
      notify.error("Failed to delete all chat sessions");
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const openSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const closeSidebar = useCallback(() => {
    if (!isSearchModeActive) {
      setIsCollapsed(true);
    }
  }, [isSearchModeActive]);

  // On mobile, collapse sidebar when tracker changes; on desktop, stay open
  useEffect(() => {
    if (isMobile) setIsCollapsed(true);
  }, [sidebarTracker, isMobile]);

  // Listen for custom sidebar events from swipe gestures
  useEffect(() => {
    const handleOpen = () => openSidebar();
    const handleClose = () => closeSidebar();
    const handleToggle = () => toggleSidebar();

    window.addEventListener("openSidebar", handleOpen);
    window.addEventListener("closeSidebar", handleClose);
    window.addEventListener("toggleSidebar", handleToggle);

    return () => {
      window.removeEventListener("openSidebar", handleOpen);
      window.removeEventListener("closeSidebar", handleClose);
      window.removeEventListener("toggleSidebar", handleToggle);
    };
  }, [openSidebar, closeSidebar, toggleSidebar]);

  // Swipe left on sidebar to close it (mobile only)
  const handleSidebarSwipeLeft = useCallback(() => {
    if (!isCollapsed) {
      closeSidebar();
    }
  }, [isCollapsed, closeSidebar]);

  useSwipeGesture(sidebarContentRef, {
    onSwipeLeft: handleSidebarSwipeLeft,
    minSwipeDistance: 50,
    enabled: !isCollapsed,
  });

  const ensureSessionsFillViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    if (
      !container ||
      isCollapsed ||
      isLoadingMore ||
      isLoadingSessions ||
      !hasMore ||
      loadingSessionId !== null ||
      isSelectingSessionRef.current
    ) {
      return;
    }

    const threshold = 24;
    if (container.scrollHeight <= container.clientHeight + threshold) {
      if (!isSelectingSessionRef.current) {
        setCurrentPage((prev) => prev + 1);
      }
    }
  }, [
    hasMore,
    isCollapsed,
    isLoadingMore,
    isLoadingSessions,
    loadingSessionId,
  ]);

  useEffect(() => {
    if (isSelectingSessionRef.current) {
      return;
    }
    ensureSessionsFillViewport();
  }, [chatSessions, ensureSessionsFillViewport]);

  useEffect(() => {
    const handleResize = () => {
      ensureSessionsFillViewport();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [ensureSessionsFillViewport]);

  // ── Shared icon-button helper ──────────────────────────────────────────────
  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
    extraClass = "",
  ) => (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            extraClass,
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side={isCollapsed ? "right" : "top"} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  // ── Pinned / Recent splits ─────────────────────────────────────────────────
  const pinnedSessions = chatSessions.filter((s) => s.is_pin);
  const recentSessions = chatSessions.filter((s) => !s.is_pin);
  const activeSession = chatSessions.find((s) => s.session_id === activeSessionId);

  // ── Session item renderer ──────────────────────────────────────────────────
  const renderSessionItem = (session: ChatSession, index: number, isArchived = false) => {
    // Key on session_id alone (no index): background refreshes can reorder or
    // prepend rows, and an index-based key would remount every shifted row,
    // causing a visible flicker.
    const rowKey = `${isArchived ? "archived-" : ""}${session.session_id || `missing-${index}`}`;
    const isActive = activeSessionId === session.session_id;

    const personaName = (() => {
      const fromSession = session.persona_name;
      const fromStore = personas?.find((p) => p.id === session.persona_id)?.persona_name;
      return fromSession || fromStore || "";
    })();

    return (
      <div
        key={rowKey}
        className={cn(
          "group flex items-center gap-1 rounded-lg py-2 pl-3 pr-1.5 cursor-pointer select-none transition-colors",
          isActive
            ? "bg-primary/10 border border-primary/20 text-primary"
            : "hover:bg-surface-2 text-text-muted hover:text-text-main",
        )}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            editingSessionId !== session.session_id &&
            !(target && typeof target.closest === "function" && target.closest("input"))
          ) {
            if (isArchived) {
              setIsViewingArchivedSession(true);
              handleSelectSession(session.session_id, session.chat_title, { isArchived: true });
            } else {
              setIsViewingArchivedSession(false);
              setIsSessionPersonaDeleted(false);
              handleSelectSession(session.session_id, session.chat_title);
            }
          }
        }}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          {editingSessionId === session.session_id ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveRename(session.session_id, session.chat_title);
                } else if (e.key === "Escape") {
                  setEditingSessionId(null);
                  setEditingTitle("");
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full bg-transparent border-b border-border-main focus:outline-none focus:border-primary text-text-main text-xs"
              style={{ background: "transparent" }}
            />
          ) : (
            <>
              <div className="flex items-center gap-1 min-w-0">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <SessionTitle
                    title={session.chat_title}
                    isActive={isActive}
                    onDoubleClick={(e) => {
                      if (!isArchived) {
                        e.stopPropagation();
                        setEditingSessionId(session.session_id);
                        setEditingTitle(session.chat_title);
                      }
                    }}
                  />
                </div>
              </div>
              {session.persona_id !== null &&
                session.persona_id !== undefined &&
                session.persona_id !== 0 &&
                personaName && (
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-0.5 min-w-0",
                      isActive ? "text-primary/60" : "text-text-muted",
                    )}
                    style={{ fontSize: "10.5px" }}
                  >
                    <span className="flex-shrink-0 opacity-70">
                      {session.type === "dashboard" ? (
                        <LayoutDashboard className="h-[9px] w-[9px]" strokeWidth={1.5} aria-hidden />
                      ) : (
                        <UserRound className="h-[10px] w-[10px]" strokeWidth={1.75} aria-hidden />
                      )}
                    </span>
                    <span className="truncate min-w-0">{personaName}</span>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Row-level badges — siblings of the menu button so they share its
            vertical center instead of hugging the title line */}
        {editingSessionId !== session.session_id && (
          <>
            <SessionTaskIcon count={session.active_task_count} />
            <SessionSourceIcon source={session.last_source} />
          </>
        )}

        {/* Three-dot actions (or tick when editing) */}
        {editingSessionId === session.session_id ? (
          <button
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:text-text-main"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveRename(session.session_id, session.chat_title);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-60 transition-opacity hover:opacity-100 hover:bg-surface-2"
                onClick={(e) => e.stopPropagation()}
                aria-label="Session actions"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            {/* z-[90]: must layer above the mobile drawer (z-[80]) */}
            <DropdownMenuContent className="min-w-24 z-[90]">
              <DropdownMenuGroup>
                {isArchived ? (
                  <>
                    <DropdownMenuItem onClick={() => handleUnarchiveSession(session.session_id)}>
                      Unarchive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        window.setTimeout(() => {
                          setPendingSessionDelete({
                            sessionId: session.session_id,
                            chatTitle: session.chat_title,
                            activeTaskCount: session.active_task_count ?? 0,
                            stage: "confirm",
                          });
                        }, 0);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {!session.is_pin && (
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            if (!userId) return;
                            await updateChatPin(session.session_id, true);
                            await loadChatSessions(true);
                          } catch (e) {
                            console.error("Failed to pin chat:", e);
                          }
                        }}
                      >
                        Pin
                      </DropdownMenuItem>
                    )}
                    {session.is_pin && (
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            if (!userId) return;
                            await updateChatPin(session.session_id, false);
                            await loadChatSessions(true);
                          } catch (e) {
                            console.error("Failed to unpin chat:", e);
                          }
                        }}
                      >
                        Unpin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleArchiveSession(session.session_id)}>
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        window.setTimeout(() => {
                          setPendingSessionDelete({
                            sessionId: session.session_id,
                            chatTitle: session.chat_title,
                            activeTaskCount: session.active_task_count ?? 0,
                            stage: "confirm",
                          });
                        }, 0);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingSessionId(session.session_id);
                        setEditingTitle(session.chat_title);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  if (isChatShare) return null;

  // On mobile the sidebar is an overlay drawer, so it always renders its
  // expanded UI; "collapsed" only means it is slid off-screen.
  const showCollapsedUi = isCollapsed && !isMobile;

  return (
    <>
      {/* Mobile: dimmed backdrop behind the drawer; tap to close */}
      <AnimatePresence>
        {isMobile && !isCollapsed && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[75] bg-black/50"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <div
        ref={sidebarContentRef}
        className={cn(
          "flex flex-col border-r border-border-main/60 bg-surface",
          isMobile
            ? cn(
                // Height from the JS-measured --vh, not inset-y-0/h-full: on
                // standalone iOS the layout viewport can be taller than the
                // visible area, which clips bottom-anchored fixed elements.
                "fixed left-0 top-0 z-[80] h-[calc(var(--vh,1vh)*100)] w-[85vw] max-w-[320px] shadow-2xl",
                "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
                isCollapsed && "-translate-x-full pointer-events-none",
              )
            : cn(
                // h-dvh, not h-full: the SidebarProvider wrapper is min-h-svh
                // with no fixed height, so percentage heights collapse.
                "h-dvh shrink-0 transition-[width] duration-200",
                isCollapsed ? "w-12" : "w-52",
              ),
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className={cn(
            // Only the status-bar inset goes in padding; the 4rem row itself
            // vertically centers the logo so spacing stays symmetric. No py-*
            // here — tailwind-merge would drop the safe-area padding-top.
            "flex h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] shrink-0 items-center border-b border-border-main/60 px-2.5 gap-0.5",
            isMobile && "px-3",
            showCollapsedUi && "justify-center px-0",
          )}
        >
          {showCollapsedUi ? (
            /* Collapsed header: Newton mark = expand button. On hover the mark
               cross-fades to the expand icon; both share one grid cell so the
               swap can't shift the header's layout. */
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="group grid h-10 w-10 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                >
                  <span className="col-start-1 row-start-1 transition-opacity group-hover:opacity-0">
                    <NewtonMark size={32} />
                  </span>
                  <span className="col-start-1 row-start-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <PanelLeftOpen size={17} strokeWidth={1.75} />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Expand Sidebar
              </TooltipContent>
            </Tooltip>
          ) : (
            /* Expanded header: wordmark + actions */
            <>
              <div className="flex flex-1 items-center overflow-hidden">
                <NewtonLockup size={isMobile ? 32 : 38} />
              </div>

              {/* Collapse / close */}
              <button
                onClick={toggleSidebar}
                aria-label={isMobile ? "Close menu" : "Collapse sidebar"}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors",
                  isMobile ? "h-9 w-9" : "h-8 w-8",
                )}
              >
                <PanelLeftClose size={isMobile ? 19 : 17} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>

        {/* ── Nav body ────────────────────────────────────────────────────── */}
        {showCollapsedUi ? (
          /* Collapsed icon strip */
          <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-1.5 space-y-0.5 scrollbar-hide">
            {iconBtn("New chat", <Plus size={14} strokeWidth={1.75} />, handleNewChat)}
            {iconBtn(
              "Search chats",
              <Search size={13} strokeWidth={1.75} />,
              () => {
                setIsSearchModeActive(true);
                setSearchQuery("");
                openSidebar();
              },
            )}

            {activeSessionId && (
              <>
                <div className="my-1.5 mx-1 border-t border-border-main/60" />
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (activeSession) {
                          handleSelectSession(activeSession.session_id, activeSession.chat_title);
                        }
                      }}
                      aria-label={activeSession?.chat_title || "Active chat"}
                      className="flex w-full items-center justify-center rounded-lg p-2 bg-primary/10 border border-primary/20 text-primary transition-colors"
                    >
                      <MessageSquare size={14} strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs max-w-[180px]">
                    {activeSession?.chat_title || "Active chat"}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </nav>
        ) : (
          /* Expanded session list with fixed pinned/archived sections */
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Fixed pinned section below header */}
            {!isLoadingSessions && pinnedSessions.length > 0 && (
              <div className="shrink-0 bg-surface px-2 pb-2 pt-2 after:mx-2 after:mt-2 after:block after:h-px after:bg-border-main/40">
                <div className="pb-1 px-2">
                  <span className="text-2xs font-mono uppercase tracking-[0.1em] text-text-muted">
                    Pinned
                  </span>
                </div>
                <div
                  className="max-h-48 space-y-0.5 overflow-y-auto scrollbar-hide"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {pinnedSessions.map((s, i) => renderSessionItem(s, i))}
                </div>
              </div>
            )}

            {/* Fixed Recent toggle + actions below pinned */}
            <div className="shrink-0 bg-surface flex items-center gap-0.5 px-2 pt-1 pb-0.5">
                <button
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 px-2 hover:bg-surface-2 transition-colors"
                  onClick={() => setIsRecentChatsCollapsed((c) => !c)}
                >
                  <ChevronDown
                    size={12}
                    strokeWidth={1.75}
                    className={cn(
                      "text-text-muted transition-transform duration-200",
                      isRecentChatsCollapsed && "-rotate-90",
                    )}
                  />
                  <span className="text-2xs font-mono uppercase tracking-[0.1em] text-text-muted">
                    Recent
                  </span>
                </button>

                {/* New Chat */}
                <button
                  onClick={handleNewChat}
                  aria-label="New chat"
                  onMouseEnter={() => setHoveredItem("new-chat")}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                >
                  <Plus size={17} strokeWidth={1.75} />
                </button>

                {/* Search */}
                <button
                  onClick={() => {
                    setIsSearchModeActive(true);
                    setSearchQuery("");
                    if (isMobile) setIsCollapsed(true);
                  }}
                  aria-label="Search chats"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
                >
                  <Search size={17} strokeWidth={1.75} />
                </button>
              </div>

            <nav
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-hide"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {isLoadingSessions ? (
                <div className="text-center py-4">
                  <span className="text-xs text-text-muted">Loading sessions...</span>
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {!isRecentChatsCollapsed && (
                      <motion.div
                        key="recent-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden space-y-0.5"
                      >
                        {recentSessions.length > 0 ? (
                          recentSessions.map((s, i) => renderSessionItem(s, i))
                        ) : (
                          pinnedSessions.length === 0 && (
                            <div className="text-center py-4">
                              <span className="text-xs text-text-muted">No chat sessions found</span>
                            </div>
                          )
                        )}
                        {isLoadingMore && (
                          <div className="text-center py-2">
                            <span className="text-xs text-text-muted">Loading more...</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Dev-only: Clear all */}
                  {import.meta.env.DEV && chatSessions.length > 0 && (
                    <div className="pt-2 px-2">
                      <button
                        onClick={handleDeleteAllSessions}
                        disabled={isDeletingAll}
                        className="text-xs text-text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {isDeletingAll ? "Deleting..." : "Clear all sessions"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </nav>

            {/* Fixed archived section above footer */}
            <div className="shrink-0 border-t border-border-main/40 bg-surface px-2 pb-2 pt-1">
              <button
                className="flex w-full items-center gap-1.5 rounded-lg py-1 px-2 hover:bg-surface-2 transition-colors"
                onClick={() => {
                  const newExpanded = !isArchivedExpanded;
                  setIsArchivedExpanded(newExpanded);
                  if (newExpanded && archivedSessions.length === 0) {
                    loadArchivedSessions(true);
                  }
                }}
              >
                <ChevronDown
                  size={12}
                  strokeWidth={1.75}
                  className={cn(
                    "text-text-muted transition-transform duration-200",
                    !isArchivedExpanded && "-rotate-90",
                  )}
                />
                <span className="text-2xs font-mono uppercase tracking-[0.1em] text-text-muted">
                  Archived
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isArchivedExpanded && (
                  <motion.div
                    key="archived-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div
                      ref={archivedScrollContainerRef}
                      className="max-h-48 space-y-0.5 overflow-y-auto pt-1 scrollbar-hide"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      {isLoadingArchived ? (
                        <div className="text-center py-4">
                          <span className="text-xs text-text-muted">Loading archived...</span>
                        </div>
                      ) : archivedSessions.length > 0 ? (
                        <>
                          {archivedSessions.map((s, i) => renderSessionItem(s, i, true))}
                          {isLoadingMoreArchived && (
                            <div className="text-center py-2">
                              <span className="text-xs text-text-muted">Loading more...</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <span className="text-xs text-text-muted">No archived chats</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Pinned footer ────────────────────────────────────────────────── */}
        <div
          className={cn(
            "shrink-0 border-t border-border-main/40",
            isMobile
              ? "justify-around px-4 pt-2 pb-[max(0.625rem,var(--safe-bottom,0px))]"
              : "px-2 py-2",
            showCollapsedUi
              ? "flex flex-col items-center gap-0.5"
              : "flex items-center gap-1",
          )}
        >
          {showCollapsedUi ? (
            <>
              {isAdmin &&
                iconBtn(
                  "Admin console",
                  <LayoutDashboard size={17} strokeWidth={1.75} />,
                  () => navigate("/admin-dashboard"),
                  false,
                  "h-8 w-8",
                )}
              {iconBtn(
                  isDark ? "Switch to light mode" : "Switch to dark mode",
                  isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />,
                  handleToggleTheme,
                  false,
                  "h-8 w-8",
                )}
              {iconBtn(
                "Account",
                <UserCircle size={17} strokeWidth={1.75} />,
                () => window.dispatchEvent(new CustomEvent("openSettings")),
                false,
                "h-8 w-8",
              )}
              {(isAuthenticated || isLoggingOut) &&
                iconBtn(
                  "Logout",
                  isLoggingOut
                    ? <Loader2 size={17} className="animate-spin" />
                    : <LogOut size={17} strokeWidth={1.75} />,
                  handleLogout,
                  isLoggingOut,
                  "h-8 w-8",
                )}
            </>
          ) : (
            <>
              {isAdmin &&
                iconBtn(
                  "Admin console",
                  <LayoutDashboard size={17} strokeWidth={1.75} />,
                  () => navigate("/admin-dashboard"),
                  false,
                  isMobile ? "h-10 w-10" : "h-8 w-8",
                )}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleTheme}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors",
                      isMobile ? "h-10 w-10" : "h-8 w-8",
                    )}
                  >
                    {isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isDark ? "Switch to light mode" : "Switch to dark mode"}
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("openSettings"))}
                    aria-label="Account"
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors",
                      isMobile ? "h-10 w-10" : "h-8 w-8",
                    )}
                  >
                    <UserCircle size={17} strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Account</TooltipContent>
              </Tooltip>
              {(isAuthenticated || isLoggingOut) && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      aria-label="Logout"
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        isMobile ? "h-10 w-10" : "h-8 w-8",
                      )}
                    >
                      {isLoggingOut
                        ? <Loader2 size={17} className="animate-spin" />
                        : <LogOut size={17} strokeWidth={1.75} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Logout</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={pendingSessionDelete !== null}
        layerClassName="z-[95]"
        onClose={() => setPendingSessionDelete(null)}
        onConfirm={async () => {
          if (!pendingSessionDelete) return;
          // Chats with pending reminders get a second, explicit confirmation
          // before anything is deleted.
          if (
            pendingSessionDelete.stage === "confirm" &&
            pendingSessionDelete.activeTaskCount > 0
          ) {
            setPendingSessionDelete({ ...pendingSessionDelete, stage: "tasks" });
            return;
          }
          await handleDeleteSession(pendingSessionDelete.sessionId);
          setPendingSessionDelete(null);
        }}
        title={
          pendingSessionDelete?.stage === "tasks"
            ? "This chat has active reminders"
            : "Delete chat?"
        }
        description={
          pendingSessionDelete?.stage === "tasks"
            ? `${
                pendingSessionDelete.activeTaskCount === 1
                  ? "1 pending reminder/task"
                  : `${pendingSessionDelete.activeTaskCount} pending reminders/tasks`
              } will be cancelled and will never fire.`
            : "This action cannot be undone."
        }
        itemName={pendingSessionDelete?.chatTitle}
        usageNote={
          pendingSessionDelete?.stage === "confirm" &&
          (pendingSessionDelete?.activeTaskCount ?? 0) > 0
            ? `${
                pendingSessionDelete.activeTaskCount === 1
                  ? "1 active reminder is"
                  : `${pendingSessionDelete.activeTaskCount} active reminders are`
              } scheduled in this chat.`
            : undefined
        }
        confirmLabel={
          pendingSessionDelete?.stage === "tasks" ? "Delete anyway" : "Delete"
        }
        isLoading={
          pendingSessionDelete !== null &&
          isDeletingSession === pendingSessionDelete.sessionId
        }
      />
    </>
  );
}
