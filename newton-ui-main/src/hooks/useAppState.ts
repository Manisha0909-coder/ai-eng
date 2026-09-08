import { useGroupedState } from './usePerformance';
import { useCallback } from 'react';

export interface AppLocalState {
  isOpen: boolean;
  isSettingsOpen: boolean;
  screen: "chat" | "communication";
  isGenerating: boolean;
  isLoading: boolean;
  isLoadingMessages: boolean;
  showUploadCard: boolean;
}

export interface SidebarState {
  width: number;
  isResizing: boolean;
  isMobile: boolean;
}

export interface ChatState {
  messages: any[];
  isTyping: boolean;
  error: string | null;
  ambiguousRecipients?: Array<{
    username: string;
    options: Array<{
      display_name: string;
      email: string;
    }>;
  }>;
}

const initialAppState: AppLocalState = {
  isOpen: false,
  isSettingsOpen: false,
  screen: "chat",
  isGenerating: false,
  isLoading: false,
  isLoadingMessages: false,
  showUploadCard: false,
};

const initialSidebarState: SidebarState = {
  width: 500, // DEFAULT_SIDEBAR_WIDTH
  isResizing: false,
  isMobile: false,
};

const initialChatState: ChatState = {
  messages: [],
  isTyping: false,
  error: null,
  ambiguousRecipients: [],
};

export const useAppLocalState = () => {
  const [appState, updateAppState] = useGroupedState<AppLocalState>(initialAppState);
  const [sidebarState, updateSidebarState] = useGroupedState<SidebarState>(initialSidebarState);
  const [chatState, updateChatState] = useGroupedState<ChatState>(initialChatState);

  // Optimized update functions
  const setIsOpen = useCallback((isOpen: boolean) => {
    updateAppState({ isOpen });
  }, [updateAppState]);

  const setIsSettingsOpen = useCallback((isSettingsOpen: boolean) => {
    updateAppState({ isSettingsOpen });
  }, [updateAppState]);

  const setScreen = useCallback((screen: "chat" | "communication") => {
    updateAppState({ screen });
  }, [updateAppState]);

  const setIsGenerating = useCallback((isGenerating: boolean) => {
    updateAppState({ isGenerating });
  }, [updateAppState]);

  const setIsLoading = useCallback((isLoading: boolean) => {
    updateAppState({ isLoading });
  }, [updateAppState]);

  const setIsLoadingMessages = useCallback((isLoadingMessages: boolean) => {
    updateAppState({ isLoadingMessages });
  }, [updateAppState]);

  const setShowUploadCard = useCallback((showUploadCard: boolean) => {
    updateAppState({ showUploadCard });
  }, [updateAppState]);

  const toggleUploadCard = useCallback(() => {
    updateAppState({ showUploadCard: !appState.showUploadCard });
  }, [updateAppState, appState.showUploadCard]);

  // Sidebar state updates
  const setSidebarWidth = useCallback((width: number) => {
    updateSidebarState({ width });
  }, [updateSidebarState]);

  const setIsResizing = useCallback((isResizing: boolean) => {
    updateSidebarState({ isResizing });
  }, [updateSidebarState]);

  const setIsMobile = useCallback((isMobile: boolean) => {
    updateSidebarState({ isMobile });
  }, [updateSidebarState]);

  const updateSidebarFullState = useCallback((updates: Partial<SidebarState>) => {
    updateSidebarState(updates);
  }, [updateSidebarState]);

  // Chat state updates
  const setChatMessages = useCallback((messages: any[]) => {
    updateChatState({ messages });
  }, [updateChatState]);

  const setIsTyping = useCallback((isTyping: boolean) => {
    updateChatState({ isTyping });
  }, [updateChatState]);

  const setChatError = useCallback((error: string | null) => {
    updateChatState({ error });
  }, [updateChatState]);

  const setAmbiguousRecipients = useCallback((ambiguousRecipients: any[]) => {
    updateChatState({ ambiguousRecipients });
  }, [updateChatState]);

  const updateChatFullState = useCallback((updates: Partial<ChatState>) => {
    updateChatState(updates);
  }, [updateChatState]);

  // Reset functions
  const resetAppState = useCallback(() => {
    updateAppState(initialAppState);
  }, [updateAppState]);

  const resetSidebarState = useCallback(() => {
    updateSidebarState(initialSidebarState);
  }, [updateSidebarState]);

  const resetChatState = useCallback(() => {
    updateChatState(initialChatState);
  }, [updateChatState]);

  return {
    // State
    appState,
    sidebarState,
    chatState,

    // App state actions
    setIsOpen,
    setIsSettingsOpen,
    setScreen,
    setIsGenerating,
    setIsLoading,
    setIsLoadingMessages,
    setShowUploadCard,
    toggleUploadCard,

    // Sidebar state actions
    setSidebarWidth,
    setIsResizing,
    setIsMobile,
    updateSidebarFullState,

    // Chat state actions
    setChatMessages,
    setIsTyping,
    setChatError,
    setAmbiguousRecipients,
    updateChatFullState,

    // Reset functions
    resetAppState,
    resetSidebarState,
    resetChatState,

    // Batch update functions
    updateAppState,
    updateSidebarState,
    updateChatState,
  };
};

// Additional utility hooks for specific app state needs
export const useLoadingState = () => {
  const { appState, setIsLoading, setIsLoadingMessages, setIsGenerating } = useAppLocalState();
  
  const setLoadingState = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, [setIsLoading]);

  const setGeneratingState = useCallback((generating: boolean) => {
    setIsGenerating(generating);
  }, [setIsGenerating]);

  const setMessagesLoadingState = useCallback((loading: boolean) => {
    setIsLoadingMessages(loading);
  }, [setIsLoadingMessages]);

  return {
    isLoading: appState.isLoading,
    isLoadingMessages: appState.isLoadingMessages,
    isGenerating: appState.isGenerating,
    setLoadingState,
    setGeneratingState,
    setMessagesLoadingState,
  };
};

export const useModalState = () => {
  const {
    appState,
    setIsOpen,
    setIsSettingsOpen,
    setShowUploadCard,
    toggleUploadCard,
  } = useAppLocalState();

  const closeAllModals = useCallback(() => {
    setIsOpen(false);
    setIsSettingsOpen(false);
    setShowUploadCard(false);
  }, [setIsOpen, setIsSettingsOpen, setShowUploadCard]);

  return {
    isOpen: appState.isOpen,
    isSettingsOpen: appState.isSettingsOpen,
    showUploadCard: appState.showUploadCard,
    setIsOpen,
    setIsSettingsOpen,
    setShowUploadCard,
    toggleUploadCard,
    closeAllModals,
  };
};

export const useScreenState = () => {
  const { appState, setScreen } = useAppLocalState();

  return {
    screen: appState.screen,
    setScreen,
  };
}; 