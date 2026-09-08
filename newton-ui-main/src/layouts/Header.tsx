import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  fetchUserProfile,
  userApiService,
  clearUserProfileCache,
} from "@/services/user/userApi";
import { motion } from "framer-motion";
import {
  AlarmClock,
  AlertTriangle,
  BarChart2,
  Check,
  ChevronDown,
  Lock,
  PanelLeftOpen,
  Star,
  Table2,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, type Persona } from "@/store/useStore";
import { useChatStore } from "@/store/chatStore";
import { UserPanel, type UserPanelTab } from "@/features/user-panel/UserPanel";
import { getDisplayInitials } from "@/features/dashboard/utils/dashboardHelper";
import { peekConnectionsOAuthResult } from "@/features/auth/connectionsOAuthReturn";
import { subscribeUserEvents } from "@/services/chat/userEventsFeed";
import { fetchTasks } from "@/services/tasks/tasksApi";

export function Header() {
  const {
    setIsAdmin,
    sessionId,
    selectedPersonaId: storedPersonaId,
    setSelectedPersonaId: setStoreSelectedPersonaId,
    personas: storePersonas,
    personasFetched,
    setPersonas: setStorePersonas,
    setPersonasFetched: setStorePersonasFetched,
    isAuthenticated,
    isSearchModeActive,
    newChatType,
    setNewChatType,
    isSessionPersonaDeleted,
    defaultPersonas,
    setDefaultPersonas,
  } = useStore();
  // A chat's persona is fixed the moment its first message goes out. `sessionId`
  // only lands once the backend answers, so also watch the local message list to
  // cover the window between submitting and that response.
  const currentChatHasMessages = useChatStore(
    (s) =>
      (s.chats.find((c) => c.id === s.currentChatId)?.messages.length ?? 0) > 0,
  );
  const isPersonaLocked = Boolean(sessionId) || currentChatHasMessages;

  const personasForDropdown = storePersonas;
  const isNewChatWithoutType = !sessionId && newChatType === null;
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [userPanelTab, setUserPanelTab] = useState<UserPanelTab>("documents");
  const isMobile = useIsMobile();

  // Persona state - use personas from store
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    storedPersonaId !== null && storedPersonaId !== undefined
      ? storedPersonaId.toString()
      : "",
  );
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [personaScrollBottom, setPersonaScrollBottom] = useState(false);
  const personaMenuRef = useRef<HTMLDivElement | null>(null);
  const personaMenuRef2 = useRef<HTMLDivElement | null>(null);

  // Open UserPanel when AppSidebar or other components fire "openSettings"
  useEffect(() => {
    const handler = () => {
      setUserPanelTab("documents");
      setShowUserPanel(true);
    };
    window.addEventListener("openSettings", handler);
    return () => window.removeEventListener("openSettings", handler);
  }, []);

  // Pending reminders/tasks in the current chat — drives the alarm-clock chip.
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  useEffect(() => {
    if (!sessionId || !isAuthenticated) {
      setActiveTaskCount(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const { count } = await fetchTasks({ sessionId, activeOnly: true, limit: 1 });
        if (!cancelled) setActiveTaskCount(count);
      } catch {
        // Non-critical badge; leave the last known value on failure.
      }
    };
    refresh();
    const unsubscribe = subscribeUserEvents((event) => {
      if (
        event.type === "task_created" ||
        event.type === "task_cancelled" ||
        event.type === "reminder_fired"
      ) {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, isAuthenticated]);

  // Re-open UserPanel on the Connections tab after the Phase 2 OAuth callback
  useEffect(() => {
    const result = peekConnectionsOAuthResult();
    if (!result) return;
    setUserPanelTab("connections");
    setShowUserPanel(true);
    window.dispatchEvent(new Event("newton:connections-refresh"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear any stale isAdmin value from localStorage on mount
  useEffect(() => {
    // Since we removed isAdmin from persistence, clear any old value
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("newton-storage");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.state && "isAdmin" in parsed.state) {
            delete parsed.state.isAdmin;
            localStorage.setItem("newton-storage", JSON.stringify(parsed));
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }, []); // Run once on mount

  const refreshUserData = useCallback(async () => {
    setIsLoadingPersonas(true);
    setPersonaError(null);

    try {
      const userProfile = await fetchUserProfile();
      const isAdminFromApi = userProfile?.is_admin === true;
      setIsAdmin(isAdminFromApi);
      setDefaultPersonas({
        chat: userProfile?.default_personas?.chat ?? null,
        dashboard: userProfile?.default_personas?.dashboard ?? null,
      });

      if (!personasFetched || storePersonas.length === 0) {
        const personaList: Persona[] = await userApiService.getPersonas();

        if (!Array.isArray(personaList)) {
          console.error(
            "Personas from /me API returned invalid data structure",
          );
          setPersonaError("Invalid response format");
          setStorePersonas([]);
          setStorePersonasFetched(true);
          return;
        }

        setStorePersonas(personaList);
        setStorePersonasFetched(true);

        if (!sessionId && personaList.length > 0) {
          const defaultPersona = personaList.find((p) => p.is_default);
          const selectedExists =
            storedPersonaId != null && personaList.some((p) => p.id === storedPersonaId);

          if (!selectedExists) {
            const next = defaultPersona ?? personaList[0];
            if (next) {
              setSelectedPersonaId(next.id.toString());
              setStoreSelectedPersonaId(next.id);
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error("Failed to fetch user profile from /me API:", error);
      setIsAdmin(false);

      let errorMessage = "Unable to load user data";
      const errorObj = error as {
        isCorsError?: boolean;
        status?: number;
        message?: string;
      };
      if (errorObj?.isCorsError) {
        errorMessage = "CORS configuration issue. Please contact support.";
      } else if (errorObj?.status === 401) {
        errorMessage = "Please log in to continue";
        setIsAdmin(false);
      } else if (errorObj?.message) {
        errorMessage = errorObj.message;
      }

      setPersonaError(errorMessage);
      setStorePersonasFetched(true);
    } finally {
      setIsLoadingPersonas(false);
    }
  }, [
    personasFetched,
    sessionId,
    setIsAdmin,
    setDefaultPersonas,
    setSelectedPersonaId,
    setStorePersonas,
    setStorePersonasFetched,
    setStoreSelectedPersonaId,
    storePersonas.length,
    storedPersonaId,
  ]);

  // Fetch user profile from /me API (single source of truth)
  // This replaces both /v1/users/is_admin and /v1/users/personas API calls
  useEffect(() => {
    // Only fetch if user appears authenticated
    if (isAuthenticated) {
      refreshUserData();
    } else {
      // If not authenticated, reset isAdmin
      setIsAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, refreshUserData]); // Fetch when authentication status changes

  // Allow connect/disconnect flows to trigger a /me refresh + UI update.
  useEffect(() => {
    const handler = () => {
      if (!useStore.getState().isAuthenticated) return;
      clearUserProfileCache();
      refreshUserData();
    };
    window.addEventListener("newton:user-profile-refresh", handler);
    return () =>
      window.removeEventListener("newton:user-profile-refresh", handler);
  }, [refreshUserData]);

  // Sync selectedPersonaId with storedPersonaId from store (when session changes)
  // This ensures the persona from the session is used when a session is selected
  useEffect(() => {
    if (isSessionPersonaDeleted) {
      if (selectedPersonaId !== "") {
        setSelectedPersonaId("");
      }
      return;
    }

    if (storedPersonaId !== null && storedPersonaId !== undefined) {
      const storedIdString = storedPersonaId.toString();
      // Only update if different to avoid unnecessary re-renders
      if (selectedPersonaId !== storedIdString) {
        setSelectedPersonaId(storedIdString);
      }
    } else if (!sessionId && storePersonas.length > 0) {
      // For new sessions, set default persona if not already set or if selected persona doesn't exist
      const selectedPersonaExists =
        selectedPersonaId &&
        storePersonas.find((p) => p.id.toString() === selectedPersonaId);

      if (!selectedPersonaId || !selectedPersonaExists) {
        const defaultPersona = storePersonas.find(
          (persona) => persona.is_default,
        );
        if (defaultPersona) {
          setSelectedPersonaId(defaultPersona.id.toString());
          setStoreSelectedPersonaId(defaultPersona.id);
        } else if (storePersonas.length > 0) {
          // Fallback to first persona if no default exists
          setSelectedPersonaId(storePersonas[0].id.toString());
          setStoreSelectedPersonaId(storePersonas[0].id);
        }
      }
    } else if (
      !isSessionPersonaDeleted &&
      sessionId &&
      storedPersonaId === null &&
      selectedPersonaId &&
      storePersonas.length > 0
    ) {
      // If we have a sessionId but storedPersonaId is null, preserve the current selectedPersonaId in store
      // This prevents persona_id from being cleared after chat response
      const currentPersonaId = Number.parseInt(selectedPersonaId, 10);
      if (!Number.isNaN(currentPersonaId)) {
        setStoreSelectedPersonaId(currentPersonaId);
      }
    }
  }, [
    storedPersonaId,
    sessionId,
    storePersonas,
    selectedPersonaId,
    setStoreSelectedPersonaId,
    isSessionPersonaDeleted,
  ]);

  // Check scroll state when persona menu opens
  useEffect(() => {
    if (isPersonaMenuOpen) {
      const checkScrollState = () => {
        const container = personaMenuRef.current || personaMenuRef2.current;
        if (container) {
          const scrollTop = container.scrollTop;
          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          setPersonaScrollBottom(scrollTop + clientHeight < scrollHeight - 10);
        }
      };

      // Check immediately after menu opens
      setTimeout(checkScrollState, 100);

      // Also check on resize
      window.addEventListener("resize", checkScrollState);
      return () => window.removeEventListener("resize", checkScrollState);
    } else {
      // Reset scroll indicators when menu closes
      setPersonaScrollBottom(false);
    }
  }, [isPersonaMenuOpen, storePersonas.length]);

  const handlePersonaSelect = (personaId: string) => {
    // The persona is part of a conversation's identity, so it is fixed once the
    // chat has started. The trigger is disabled in this state; this guard keeps
    // keyboard/programmatic paths from slipping through.
    if (isPersonaLocked) {
      setIsPersonaMenuOpen(false);
      return;
    }

    setSelectedPersonaId(personaId);
    if (!personaId) {
      setStoreSelectedPersonaId(null);
      setIsPersonaMenuOpen(false);
      return;
    }

    const numericValue = Number.parseInt(personaId, 10);
    if (Number.isNaN(numericValue)) {
      setIsPersonaMenuOpen(false);
      return;
    }

    const picked = storePersonas.find((p) => p.id === numericValue);
    const targetType: "analytical" | "dashboard" | null = picked
      ? (picked.type ?? "chat") === "dashboard"
        ? "dashboard"
        : "analytical"
      : null;

    setStoreSelectedPersonaId(numericValue);
    if (targetType && newChatType !== targetType) {
      setNewChatType(targetType);
    }
    setIsPersonaMenuOpen(false);
  };

  const selectedPersona = isSessionPersonaDeleted
    ? undefined
    : personasForDropdown.find((p) => p.id.toString() === selectedPersonaId);
  // When a session is loaded, store has the session's persona_id; use full list as fallback so the header shows the correct name
  const sessionPersona =
    !isSessionPersonaDeleted &&
    storedPersonaId != null &&
    !selectedPersona
      ? storePersonas.find((p) => p.id === storedPersonaId)
      : undefined;
  const displayPersona = isSessionPersonaDeleted
    ? undefined
    : selectedPersona ?? sessionPersona;
  // Compact persona avatar (initials over the theme primary/secondary) so it
  // adapts to whatever theme is active.
  const personaInitials = (() => {
    const name = displayPersona?.persona_name?.trim() || "";
    if (!name) return "AI";
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();
  const PersonaAvatar = () => {
    if (isSessionPersonaDeleted) {
      return (
        <span
          className="mr-1.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-border-main text-text-muted opacity-70 sm:h-[21px] sm:w-[21px]"
          aria-hidden="true"
        >
          <Trash2 className="h-3 w-3" />
        </span>
      );
    }
    if (!displayPersona) return null;
    return (
      <span
        className={cn(
          "mr-1.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md font-display text-[9px] font-semibold sm:h-[21px] sm:w-[21px]",
          displayPersona.type === "dashboard"
            ? "bg-accent/15 text-accent"
            : "bg-primary/15 text-primary",
        )}
        aria-hidden="true"
      >
        {personaInitials}
      </span>
    );
  };
  // The dropdown lists every persona, but switching is only actionable before
  // the conversation starts — once a chat has its first message the persona is
  // fixed for that session (handlePersonaSelect guards this). The menu itself
  // stays openable while locked so the user can still star/unstar a default.
  // The persona currently in use is hoisted to the top of the list.
  const personasToShowInDropdown = (() => {
    const activeId = displayPersona?.id;
    if (activeId == null) return personasForDropdown;
    return [
      ...personasForDropdown.filter((p) => p.id === activeId),
      ...personasForDropdown.filter((p) => p.id !== activeId),
    ];
  })();
  // Disable when loading, when no personas available, or when new chat and
  // type not chosen yet.
  const isPersonaDisabled =
    isLoadingPersonas ||
    personasToShowInDropdown.length === 0 ||
    isNewChatWithoutType ||
    isSessionPersonaDeleted;

  /** Star/unstar a persona as the default for its workspace (optimistic). */
  const handleToggleStar = (persona: Persona) => {
    const modeKey = (persona.type ?? "chat") === "dashboard" ? "dashboard" : "chat";
    const previous = defaultPersonas;
    const previousPersonas = storePersonas;
    const isStarred = previous[modeKey] === persona.id;
    const next = { ...previous, [modeKey]: isStarred ? null : persona.id };
    setDefaultPersonas(next);
    setStorePersonas(
      storePersonas.map((p) => ({
        ...p,
        is_default:
          (p.type ?? "chat") === modeKey ? next[modeKey] === p.id : p.is_default,
      })),
    );
    const request = isStarred
      ? userApiService.clearDefaultPersona(modeKey)
      : userApiService.setDefaultPersona(persona.id);
    request.catch((err) => {
      console.error("Failed to update default persona:", err);
      setDefaultPersonas(previous);
      setStorePersonas(previousPersonas);
    });
  };

  /** One dropdown row — used by all three (desktop ×2 / mobile) menu copies. */
  const renderPersonaRow = (persona: Persona) => {
    const isActive = selectedPersonaId === persona.id.toString();
    const modeKey = (persona.type ?? "chat") === "dashboard" ? "dashboard" : "chat";
    const isStarred = defaultPersonas[modeKey] === persona.id;
    return (
      <DropdownMenuItem
        key={persona.id}
        onClick={() => handlePersonaSelect(persona.id.toString())}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-colors focus:bg-surface-2",
          isPersonaLocked && !isActive && "opacity-50",
        )}
        style={{
          background: isActive ? "rgb(var(--color-primary) / 0.08)" : undefined,
          color: "var(--color-text)",
        }}
      >
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-semibold",
            persona.type === "dashboard"
              ? "bg-accent/15 text-accent"
              : "bg-primary/15 text-primary",
          )}
        >
          {getDisplayInitials(persona.persona_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-main">{persona.persona_name}</p>
          <p className="text-2xs text-text-muted">{persona.type === "dashboard" ? "Dashboard" : "Chat"}</p>
        </div>
        {/* Star toggle — kept clickable even while the chat's persona is locked,
            and stops propagation so it never selects the row / closes the menu. */}
        <span
          role="button"
          tabIndex={-1}
          title={
            isStarred
              ? "Unstar — your next new chat will ask you to pick a persona"
              : "Star to make this your default persona"
          }
          aria-label={
            isStarred
              ? `Unstar ${persona.persona_name}`
              : `Star ${persona.persona_name} as default`
          }
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleStar(persona);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-colors",
            isStarred ? "text-yellow-400" : "text-text-muted/40 hover:text-yellow-400",
            isPersonaLocked && !isActive && "opacity-100",
          )}
        >
          <Star className={cn("h-3 w-3", isStarred && "fill-current")} />
        </span>
        {isActive && <Check className="h-3 w-3 shrink-0 text-primary" />}
      </DropdownMenuItem>
    );
  };
  const personaLockTitle =
    isPersonaLocked && !isSessionPersonaDeleted
      ? "Persona is locked for this chat. Start a new chat to use a different persona."
      : undefined;
  const displayText = isSessionPersonaDeleted
    ? "Deleted persona"
    : isNewChatWithoutType
      ? "Choose type below"
      : isLoadingPersonas
        ? "Loading personas..."
        : personasToShowInDropdown.length === 0 && !sessionPersona
          ? "No personas available"
          : displayPersona
            ? displayPersona.persona_name
            : "Select persona";
  const isDisplayTextMuted =
    isSessionPersonaDeleted ||
    isNewChatWithoutType ||
    isLoadingPersonas ||
    !displayPersona;
  const displayNameClassName = cn(
    "text-sm font-medium truncate",
    isDisplayTextMuted ? "text-text-muted" : "text-text-main",
  );

  const visualizationActiveTab = useStore((s) => s.visualizationActiveTab);
  const setVisualizationActiveTab = useStore((s) => s.setVisualizationActiveTab);

  const showDashboardDataToggle =
    !isSearchModeActive &&
    !isNewChatWithoutType &&
    !isSessionPersonaDeleted &&
    Boolean(displayPersona) &&
    displayPersona?.type === "dashboard";

  const dashboardDataToggle = showDashboardDataToggle ? (
    <div className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-full border border-border-main bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setVisualizationActiveTab("chart")}
        className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color:
            visualizationActiveTab === "chart"
              ? "var(--color-text)"
              : "var(--color-muted-foreground)",
          background:
            visualizationActiveTab === "chart"
              ? "var(--color-surface)"
              : "transparent",
        }}
        aria-pressed={visualizationActiveTab === "chart"}
      >
        <BarChart2 size={16} />
        Dashboard
      </button>
      <button
        type="button"
        onClick={() => setVisualizationActiveTab("data")}
        className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          color:
            visualizationActiveTab === "data"
              ? "var(--color-text)"
              : "var(--color-muted-foreground)",
          background:
            visualizationActiveTab === "data"
              ? "var(--color-surface)"
              : "transparent",
        }}
        aria-pressed={visualizationActiveTab === "data"}
      >
        <Table2 size={16} />
        Data
      </button>
    </div>
  ) : null;

  // Alarm-clock chip: visible while the open chat has pending reminders/tasks;
  // clicking it opens the Tasks tab in the UserPanel.
  const tasksChip =
    activeTaskCount > 0 ? (
      <button
        type="button"
        onClick={() => {
          setUserPanelTab("tasks");
          setShowUserPanel(true);
        }}
        className={cn(
          "pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
          "border border-primary/30 bg-primary/10 text-primary text-xs font-medium",
          "hover:bg-primary/15 transition-colors",
        )}
        title="View this chat's reminders and tasks"
        aria-label={`${activeTaskCount} active ${activeTaskCount === 1 ? "reminder" : "reminders"} in this chat`}
      >
        <AlarmClock size={13} strokeWidth={2} aria-hidden />
        {activeTaskCount === 1 ? "1 task" : `${activeTaskCount} tasks`}
      </button>
    ) : null;

  const headerCenter =
    dashboardDataToggle || tasksChip ? (
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        {dashboardDataToggle}
        {tasksChip}
      </div>
    ) : null;

  // Reset Dashboard/Data tab when switching between dashboard personas.
  const lastDashboardPersonaIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!displayPersona || displayPersona.type !== "dashboard") return;
    const nextId = displayPersona.id;
    if (lastDashboardPersonaIdRef.current != null && lastDashboardPersonaIdRef.current !== nextId) {
      setVisualizationActiveTab("chart");
    }
    lastDashboardPersonaIdRef.current = nextId;
  }, [displayPersona, setVisualizationActiveTab]);

  const getThemeLayout = () => {
    return isMobile === false ? (
      <div className="relative flex items-center px-3 mt-0 h-[calc(3rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
        {headerCenter}
        <div className="flex items-center">
          {!isSearchModeActive && (
            <div className="flex flex-col min-w-[100px] w-[45vw] max-w-[10px]">
              {!isPersonaMenuOpen ? (
                <div className="w-full" title={personaLockTitle}>
                  <DropdownMenu
                    open={isPersonaMenuOpen}
                    onOpenChange={setIsPersonaMenuOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isPersonaDisabled}
                        className={cn(
                          "w-auto min-w-[100px] max-w-[400px] sm:max-w-[450px] justify-between text-sm px-2.5 py-1.5 h-auto font-normal group",
                          "border border-transparent hover:border-primary hover:bg-surface hover:shadow-md hover:scale-[1.02]",
                          "focus-visible:ring-1 focus-visible:ring-primary/70",
                          "disabled:opacity-60 disabled:cursor-not-allowed",
                          "transition-all duration-200 ease-out cursor-pointer rounded-md",
                          isPersonaMenuOpen && "border-primary",
                        )}
                        style={{
                          backgroundColor: selectedPersonaId
                            ? "transparent"
                            : "var(--color-input-bg)",
                          boxShadow: "none",
                          color: "var(--color-text)",
                        }}
                      >
                        <div className="flex items-center min-w-0 text-left leading-tight ">
                          <PersonaAvatar />
                          <span className={displayNameClassName}>
                            {displayText}
                          </span>
                        </div>
                        {isSessionPersonaDeleted ? null : isPersonaLocked ? (
                          <Lock className="h-3 w-3 ml-1.5 flex-shrink-0 opacity-60" />
                        ) : (
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 ml-1.5 flex-shrink-0 opacity-60 transition-all duration-200",
                              "group-hover:opacity-100 group-hover:scale-110",
                              isPersonaMenuOpen && "rotate-180",
                            )}
                          />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className={cn(
                        "min-w-[216px] max-w-[288px] z-[60] overflow-hidden p-0",
                        "mt-1 rounded-xl border shadow-dialog backdrop-blur-md",
                        "data-[side=bottom]:origin-top data-[side=top]:origin-bottom",
                        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                      )}
                      align="start"
                      sideOffset={4}
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "rgb(var(--color-border))",
                        color: "var(--color-text)",
                      }}
                    >
                      {/* Header */}
                      <div className="border-b border-border-main/50 px-2.5 py-1.5">
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">Switch persona</p>
                      </div>
                      {/* Scrollable list */}
                      <div className="relative">
                        {personaScrollBottom && (
                          <div
                            className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-5"
                            style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }}
                          />
                        )}
                        <div
                          ref={personaMenuRef}
                          className="overflow-y-auto scrollbar-themed"
                          style={{ maxHeight: "min(352px, calc(var(--radix-dropdown-menu-content-available-height, 70vh) - 3.25rem))" }}
                          onScroll={(e) => {
                            const target = e.currentTarget;
                            setPersonaScrollBottom(target.scrollTop + target.clientHeight < target.scrollHeight - 10);
                          }}
                        >
                          {personasToShowInDropdown.length === 0 ? (
                            <DropdownMenuItem disabled className="px-3 py-3 text-xs text-text-muted">
                              {isLoadingPersonas ? "Loading personas..." : isNewChatWithoutType ? "Choose type below" : "No personas found"}
                            </DropdownMenuItem>
                          ) : (
                            personasToShowInDropdown.map(renderPersonaRow)
                          )}
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="w-full" title={personaLockTitle}>
                  <DropdownMenu
                    open={isPersonaMenuOpen}
                    onOpenChange={setIsPersonaMenuOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isPersonaDisabled}
                        className={cn(
                          "w-auto min-w-[100px] max-w-[400px] sm:max-w-[450px] justify-between text-sm px-2.5 py-1.5 h-auto font-normal group",
                          "border border-transparent hover:border-primary hover:bg-surface hover:shadow-md hover:scale-[1.02]",
                          "focus-visible:ring-1 focus-visible:ring-primary/70",
                          "disabled:opacity-60 disabled:cursor-not-allowed",
                          "transition-all duration-200 ease-out cursor-pointer rounded-md",
                          isPersonaMenuOpen && "border-primary",
                        )}
                        style={{
                          backgroundColor: selectedPersonaId
                            ? "transparent"
                            : "var(--color-input-bg)",
                          boxShadow: "none",
                          color: "var(--color-text)",
                        }}
                      >
                        <div className="flex items-center min-w-0 text-left leading-tight">
                          <PersonaAvatar />
                          <span className={displayNameClassName}>
                            {displayText}
                          </span>
                        </div>
                        {isSessionPersonaDeleted ? null : isPersonaLocked ? (
                          <Lock className="h-3 w-3 ml-1.5 flex-shrink-0 opacity-60" />
                        ) : (
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 ml-1.5 flex-shrink-0 opacity-60 transition-all duration-200",
                              "group-hover:opacity-100 group-hover:scale-110",
                              isPersonaMenuOpen && "rotate-180",
                            )}
                          />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className={cn(
                        "min-w-[216px] max-w-[288px] z-[60] overflow-hidden p-0",
                        "mt-1 rounded-xl border shadow-dialog backdrop-blur-md",
                        "data-[side=bottom]:origin-top data-[side=top]:origin-bottom",
                        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                      )}
                      align="start"
                      sideOffset={4}
                      style={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "rgb(var(--color-border))",
                        color: "var(--color-text)",
                      }}
                    >
                      {/* Header */}
                      <div className="border-b border-border-main/50 px-2.5 py-1.5">
                        <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">Switch persona</p>
                      </div>
                      {/* Scrollable list */}
                      <div className="relative">
                        {personaScrollBottom && (
                          <div
                            className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-5"
                            style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }}
                          />
                        )}
                        <div
                          ref={personaMenuRef2}
                          className="overflow-y-auto scrollbar-themed"
                          style={{ maxHeight: "min(352px, calc(var(--radix-dropdown-menu-content-available-height, 70vh) - 3.25rem))" }}
                          onScroll={(e) => {
                            const target = e.currentTarget;
                            setPersonaScrollBottom(target.scrollTop + target.clientHeight < target.scrollHeight - 10);
                          }}
                        >
                          {personasToShowInDropdown.length === 0 ? (
                            <DropdownMenuItem disabled className="px-3 py-3 text-xs text-text-muted">
                              {isLoadingPersonas ? "Loading personas..." : isNewChatWithoutType ? "Choose type below" : "No personas found"}
                            </DropdownMenuItem>
                          ) : (
                            personasToShowInDropdown.map(renderPersonaRow)
                          )}
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {personaError && (
                <span className="text-xs text-status-error mt-0.5">
                  {personaError}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="relative flex items-center px-3 mt-0 h-[calc(3rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
        {/* Visible way into the sidebar — swipe alone is undiscoverable. */}
        <button
          type="button"
          onClick={(e) => {
            // Don't bubble to the app-level click handler that flips
            // sidebarTracker — it would immediately re-collapse the sidebar.
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("openSidebar"));
          }}
          aria-label="Open menu"
          className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-main transition-colors hover:bg-surface-2 active:bg-surface-2"
        >
          <PanelLeftOpen size={20} strokeWidth={1.75} />
        </button>
        {headerCenter}
        <div className="flex items-center">
          {!isSearchModeActive && (
            <div className="flex flex-col" title={personaLockTitle}>
              <DropdownMenu
                open={isPersonaMenuOpen}
                onOpenChange={setIsPersonaMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isPersonaDisabled}
                    className={cn(
                      "w-auto min-w-[110px] max-w-[400px] justify-between text-sm px-2.5 py-1.5 h-auto font-normal group",
                      "border border-border-main/70 bg-surface-2/60 hover:border-primary hover:bg-surface hover:shadow-md hover:scale-[1.02]",
                      "focus-visible:ring-1 focus-visible:ring-primary/70",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                      "transition-all duration-200 ease-out cursor-pointer rounded-md",
                      isPersonaMenuOpen && "border-primary",
                    )}
                    style={{
                      backgroundColor: selectedPersonaId
                        ? "transparent"
                        : "var(--color-input-bg)",
                      boxShadow: "none",
                      color: "var(--color-text)",
                    }}
                  >
                    <div className="flex items-center min-w-0 text-left leading-tight">
                      <PersonaAvatar />
                      <span className={displayNameClassName}>
                        {displayText}
                      </span>
                    </div>
                    {isSessionPersonaDeleted ? null : isPersonaLocked ? (
                      <Lock className="h-3 w-3 ml-1.5 flex-shrink-0 opacity-60" />
                    ) : (
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 ml-1.5 flex-shrink-0 opacity-60 transition-all duration-200",
                          "group-hover:opacity-100 group-hover:scale-110",
                          isPersonaMenuOpen && "rotate-180",
                        )}
                      />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={cn(
                    "min-w-[216px] max-w-[288px] z-[100] overflow-hidden p-0",
                    "mt-1 rounded-xl border shadow-dialog backdrop-blur-md",
                    "data-[side=bottom]:origin-top data-[side=top]:origin-bottom",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                  )}
                  align="start"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "rgb(var(--color-border))",
                    color: "var(--color-text)",
                  }}
                >
                  {/* Header */}
                  <div className="border-b border-border-main/50 px-2.5 py-1.5">
                    <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">Switch persona</p>
                  </div>
                  {/* Scrollable list */}
                  <div className="relative">
                    {personaScrollBottom && (
                      <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-5"
                        style={{ background: "linear-gradient(to top, var(--color-surface), transparent)" }}
                      />
                    )}
                    <div
                      ref={personaMenuRef2}
                      className="overflow-y-auto touch-pan-y scrollbar-themed"
                      style={{ maxHeight: "min(352px, calc(var(--radix-dropdown-menu-content-available-height, 70vh) - 3.25rem))" }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        setPersonaScrollBottom(target.scrollTop + target.clientHeight < target.scrollHeight - 10);
                      }}
                    >
                      {personasToShowInDropdown.length === 0 ? (
                        <DropdownMenuItem disabled className="px-3 py-3 text-xs text-text-muted">
                          {isLoadingPersonas ? "Loading personas..." : isNewChatWithoutType ? "Choose type below" : "No personas found"}
                        </DropdownMenuItem>
                      ) : (
                        personasToShowInDropdown.map(renderPersonaRow)
                      )}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Enhanced Error Display */}
              {personaError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center mt-2 px-3 py-2 bg-status-error/10 border border-status-error/30 rounded-xl backdrop-blur-sm"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-status-error mr-2 flex-shrink-0 animate-pulse" />
                  <span className="text-xs text-status-error font-medium">
                    {personaError}
                  </span>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {getThemeLayout()}
      <UserPanel
        open={showUserPanel}
        onClose={() => setShowUserPanel(false)}
        defaultTab={userPanelTab}
      />
    </div>
  );
}
