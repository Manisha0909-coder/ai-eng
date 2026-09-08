import { create } from "zustand";
import { persist } from "zustand/middleware";

const SESSION_STORAGE_SESSION_KEY = "newton.sessionId";

const getInitialSessionId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSessionId = window.sessionStorage.getItem(
    SESSION_STORAGE_SESSION_KEY,
  );
  return storedSessionId || null;
};

interface Persona {
  id: number;
  persona_name: string;
  persona_prompt: string;
  persona?: string;
  display_text?: string;
  greeting_message?: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  document_tags?: any[];
  model_id?: string | null;
  tool_tags?: any[];
  // Persona type: chat or dashboard. Defaults to "chat" when omitted.
  type?: "chat" | "dashboard";
  has_datasources?: boolean;
  supports_documents?: boolean;
    /** From /me when provided; null means platform default agent instructions */
  system_prompt?: string | null;
}

interface AuthState {
  isAdmin: boolean;
  isAuthenticated: boolean;
  /** True once we've done at least one `/me` check in this browser session. */
  isAuthChecked: boolean;
  userId: string;
  sessionId: string | null;
  hasShownSTTMessage: boolean;
  activeThemeName: string | null;
  selectedEmailService: string;
  selectedPersonaId: number | null;
  personas: Persona[];
  personasFetched: boolean;
  /** Starred default persona id per surface (from /profile/me); null = none starred. */
  defaultPersonas: { chat: number | null; dashboard: number | null };
  setDefaultPersonas: (defaults: {
    chat: number | null;
    dashboard: number | null;
  }) => void;
  allowedUsers: string[];
  userSuggestions: any[];
  emailAuthStatus: any | null;
  setUserId: (userId: string) => void;
  setSessionId: (sessionId: string | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setHasShownSTTMessage: (value: boolean) => void;
  setActiveThemeName: (name: string | null) => void;
  setSelectedEmailService: (service: string) => void;
  setSelectedPersonaId: (personaId: number | null) => void;
  setPersonas: (personas: Persona[]) => void;
  setPersonasFetched: (fetched: boolean) => void;
  setAllowedUsers: (users: string[]) => void;
  setUserSuggestions: (suggestions: any[]) => void;
  setEmailAuthStatus: (status: any | null) => void;
  setIsAuthChecked: (value: boolean) => void;
  dashboardActiveTab: string | null;
  setDashboardActiveTab: (tab: string | null) => void;
  /** Visualization sidebar/header toggle: dashboard charts vs data sources. */
  visualizationActiveTab: "chart" | "data";
  setVisualizationActiveTab: (tab: "chart" | "data") => void;
  searchQuery: string;
  searchResults: Array<{
    session_id: string;
    chat_title: string;
    preview_text: string;
    match_type: "title" | "message" | "assistant";
    rank: number;
    created_at: string;
    persona_id?: number;
  }>;
  isSearching: boolean;
  isSearchModeActive: boolean;
  // Personas used for chat search filtering (can be multiple)
  searchPersonaIds: number[];
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Array<{
    session_id: string;
    chat_title: string;
    preview_text: string;
    match_type: "title" | "message" | "assistant";
    rank: number;
    created_at: string;
    persona_id?: number;
  }>) => void;
  setIsSearching: (isSearching: boolean) => void;
  setIsSearchModeActive: (isActive: boolean) => void;
  setSearchPersonaIds: (ids: number[]) => void;
  /** When true, user is viewing an archived chat session and input should be hidden. */
  isViewingArchivedSession: boolean;
  setIsViewingArchivedSession: (value: boolean) => void;
  /** When true, loaded session has no persona (deleted) and input should be hidden. */
  isSessionPersonaDeleted: boolean;
  setIsSessionPersonaDeleted: (value: boolean) => void;
  login: () => void;
  logout: () => void;
  /** For new chat: user choice "analytical" (chat personas) or "dashboard" (dashboard personas). Null until chosen. */
  newChatType: "analytical" | "dashboard" | null;
  setNewChatType: (type: "analytical" | "dashboard" | null) => void;
  /** Dashboard layout mode: collapse chat sidebar to view dashboard full width. */
  isDashboardFullscreen: boolean;
  setIsDashboardFullscreen: (value: boolean) => void;
  toggleDashboardFullscreen: () => void;
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      isAdmin: false,
      isAuthenticated: false,
      isAuthChecked: false,
      userId: "",
      sessionId: getInitialSessionId(),
      hasShownSTTMessage: false,
      activeThemeName: null,
      selectedEmailService: "gmail",
      selectedPersonaId: null,
      personas: [],
      personasFetched: false,
      defaultPersonas: { chat: null, dashboard: null },
      setDefaultPersonas: (defaults) => set({ defaultPersonas: defaults }),
      allowedUsers: [],
      userSuggestions: [],
      emailAuthStatus: null,
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      setUserId: (userId) => set({ userId }),
      setSessionId: (sessionId) => {
        set({ sessionId });

        if (typeof window !== "undefined") {
          if (sessionId) {
            window.sessionStorage.setItem(
              SESSION_STORAGE_SESSION_KEY,
              sessionId,
            );
          } else {
            window.sessionStorage.removeItem(
              SESSION_STORAGE_SESSION_KEY,
            );
          }
        }
      },
      setHasShownSTTMessage: (value) => set({ hasShownSTTMessage: value }),
      setActiveThemeName: (name) => set({ activeThemeName: name }),
      setSelectedEmailService: (service) => set({ selectedEmailService: service }),
      setSelectedPersonaId: (personaId) => set({ selectedPersonaId: personaId }),
      setPersonas: (personas) => set({ personas }),
      setPersonasFetched: (fetched) => set({ personasFetched: fetched }),
      setAllowedUsers: (users) => set({ allowedUsers: users }),
      setUserSuggestions: (suggestions) => set({ userSuggestions: suggestions }),
      setEmailAuthStatus: (status) => set({ emailAuthStatus: status }),
      setIsAuthChecked: (value) => set({ isAuthChecked: value }),
      dashboardActiveTab: "tools",
      setDashboardActiveTab: (tab) => set({ dashboardActiveTab: tab }),
      visualizationActiveTab: "chart",
      setVisualizationActiveTab: (tab) => set({ visualizationActiveTab: tab }),
      searchQuery: "",
      searchResults: [],
      isSearching: false,
      isSearchModeActive: false,
      searchPersonaIds: [],
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setIsSearchModeActive: (isActive) => set({ isSearchModeActive: isActive }),
      setSearchPersonaIds: (ids) => set({ searchPersonaIds: ids }),
      isViewingArchivedSession: false,
      setIsViewingArchivedSession: (value) =>
        set({ isViewingArchivedSession: value }),
      isSessionPersonaDeleted: false,
      setIsSessionPersonaDeleted: (value) =>
        set({ isSessionPersonaDeleted: value }),
      newChatType: null,
      setNewChatType: (type) => set({ newChatType: type }),
      isDashboardFullscreen: false,
      setIsDashboardFullscreen: (value) => set({ isDashboardFullscreen: value }),
      toggleDashboardFullscreen: () =>
        set((s) => ({ isDashboardFullscreen: !s.isDashboardFullscreen })),
      login: () => set({ isAuthenticated: true }),
      logout: () => {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(SESSION_STORAGE_SESSION_KEY);
        }

        // Reset store state
        set({
          isAdmin: false,
          isAuthenticated: false,
          isAuthChecked: false,
          userId: "",
          sessionId: null,
          hasShownSTTMessage: false,
          activeThemeName: null,
          selectedEmailService: "gmail",
          selectedPersonaId: null,
          personas: [],
          personasFetched: false,
          defaultPersonas: { chat: null, dashboard: null },
          allowedUsers: [],
          userSuggestions: [],
          emailAuthStatus: null,
          dashboardActiveTab: "tools",
          searchQuery: "",
          searchResults: [],
          isSearching: false,
          isSearchModeActive: false,
          searchPersonaIds: [],
          newChatType: null,
          isDashboardFullscreen: false,
        });
      },
    }),
    {
      name: "newton-storage",
      // Version bump forces a one-time purge of legacy PII (userId, allowedUsers,
      // userSuggestions, emailAuthStatus) from any existing localStorage payloads.
      version: 2,
      migrate: (persistedState: any, _version: number) => {
        if (persistedState && typeof persistedState === "object") {
          delete persistedState.userId;
          delete persistedState.allowedUsers;
          delete persistedState.userSuggestions;
          delete persistedState.emailAuthStatus;
        }
        return persistedState;
      },
      // PII (userId/email, allowedUsers, userSuggestions, emailAuthStatus) is
      // intentionally NOT persisted — it must be refetched from the API each
      // session so it cannot be harvested from localStorage by other scripts
      // or extensions, and so it clears on logout automatically.
      partialize: (state) => ({
        hasShownSTTMessage: state.hasShownSTTMessage,
        activeThemeName: state.activeThemeName,
        selectedEmailService: state.selectedEmailService,
        selectedPersonaId: state.selectedPersonaId,
        dashboardActiveTab: state.dashboardActiveTab,
        newChatType: state.newChatType,
      }),
    }
  )
);

export const getAuthState = () => useStore.getState();
export const getSessionId = () => useStore.getState().sessionId;
export const setSessionIdValue = (sessionId: string | null) =>
  useStore.getState().setSessionId(sessionId);
/** Drop persisted chat session id only — does not flip auth state (avoids UI flicker before redirect). */
export const clearStoredSessionId = (): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_STORAGE_SESSION_KEY);
  }
};
export const getUserIdValue = () => useStore.getState().userId;
export const setUserIdValue = (userId: string) => useStore.getState().setUserId(userId);
export const getIsAdmin = () => useStore.getState().isAdmin;
export const setIsAdminValue = (isAdmin: boolean) => useStore.getState().setIsAdmin(isAdmin);
export const getHasShownSTTMessage = () => useStore.getState().hasShownSTTMessage;
export const setHasShownSTTMessageValue = (value: boolean) =>
  useStore.getState().setHasShownSTTMessage(value);
export const getActiveThemeName = () => useStore.getState().activeThemeName;
export const setActiveThemeNameValue = (name: string | null) =>
  useStore.getState().setActiveThemeName(name);
export const getDashboardActiveTab = () => useStore.getState().dashboardActiveTab;
export const setDashboardActiveTabValue = (tab: string | null) =>
  useStore.getState().setDashboardActiveTab(tab);
export const getSelectedEmailService = () => useStore.getState().selectedEmailService || "gmail";
export const setSelectedEmailServiceValue = (service: string) =>
  useStore.getState().setSelectedEmailService(service);
export const getSelectedPersonaId = () => useStore.getState().selectedPersonaId;
export const setSelectedPersonaIdValue = (personaId: number | null) =>
  useStore.getState().setSelectedPersonaId(personaId);
export const getPersonas = () => useStore.getState().personas;
export const setPersonasValue = (personas: Persona[]) =>
  useStore.getState().setPersonas(personas);
export const getPersonasFetched = () => useStore.getState().personasFetched;
export const setPersonasFetchedValue = (fetched: boolean) =>
  useStore.getState().setPersonasFetched(fetched);
export const getAllowedUsers = () => useStore.getState().allowedUsers || [];
export const setAllowedUsersValue = (users: string[]) =>
  useStore.getState().setAllowedUsers(users);
export const getUserSuggestions = () => useStore.getState().userSuggestions || [];
export const setUserSuggestionsValue = (suggestions: any[]) =>
  useStore.getState().setUserSuggestions(suggestions);
export const getEmailAuthStatus = () => useStore.getState().emailAuthStatus;
export const setEmailAuthStatusValue = (status: any | null) =>
  useStore.getState().setEmailAuthStatus(status);

export type { Persona };
