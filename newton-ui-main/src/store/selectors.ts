import { useChatStore } from './chatStore';
import { useEmailStore } from './emailStore';
import useTTSStore from './ttsStore';
import { useLanguageStore } from './languageStore';
import { useStore } from './useStore';
import { useScreenStore } from './useScreenStore';
import { shallow } from 'zustand/shallow';

// Chat store selectors
export const useChatActions = () => useChatStore(
  (state) => ({
    addChat: state.addChat,
    updateChat: state.updateChat,
    setCurrentChat: state.setCurrentChat,
    updateChatTitle: state.updateChatTitle,
    deleteChat: state.deleteChat,
    addMessageById: state.addMessageById,
  }),
  shallow
);

export const useChatData = () => useChatStore(
  (state) => ({
    chats: state.chats,
    currentChatId: state.currentChatId,
  }),
  shallow
);

export const useCurrentChat = () => useChatStore(
  (state) => {
    const currentChat = state.chats.find(chat => chat.id === state.currentChatId);
    return {
      currentChat,
      currentChatId: state.currentChatId,
    };
  },
  shallow
);

// Email store selectors
export const useEmailActions = () => useEmailStore(
  (state) => ({
    setReplyClicked: state.setReplyClicked,
    setReplyAllClicked: state.setReplyAllClicked,
    setForwardClicked: state.setForwardClicked,
    setActiveCard: state.setActiveCard,
  }),
  shallow
);

export const useEmailState = () => useEmailStore(
  (state) => ({
    activeCard: state.activeCard,
    isReplyClicked: state.isReplyClicked,
    isReplyAllClicked: state.isReplyAllClicked,
    isForwardClicked: state.isForwardClicked,
  }),
  shallow
);




// TTS store selectors
export const useTTSActions = () => useTTSStore(
  (state) => ({
    setIsSpeaking: state.setIsSpeaking,
    setIsSTTActive: state.setIsSTTActive,
    setIsListening: state.setIsListening,
  }),
  shallow
);

export const useTTSState = () => useTTSStore(
  (state) => ({
    isSpeaking: state.isSpeaking,
    isSTTActive: state.isSTTActive,
    isListening: state.isListening,
  }),
  shallow
);

// Language store selectors
export const useLanguageActions = () => useLanguageStore(
  (state) => ({
    setLanguageType: state.setLanguageType,
  }),
  shallow
);

export const useLanguageState = () => useLanguageStore(
  (state) => ({
    languageType: state.languageType,
  }),
  shallow
);

// Auth store selectors
export const useAuthActions = () => useStore(
  (state) => ({
    setUserId: state.setUserId,
    login: state.login,
    logout: state.logout,
  }),
  shallow
);

export const useAuthState = () => useStore(
  (state) => ({
    isAuthenticated: state.isAuthenticated,
    userId: state.userId,
  }),
  shallow
);

// Screen store selectors (if it exists)
export const useScreenActions = () => useScreenStore(
  (state) => ({
    setScreen: state.setScreen,
  }),
  shallow
);

export const useScreenState = () => useScreenStore(
  (state) => ({
    screen: state.screen,
  }),
  shallow
);

// Composite selectors for complex state combinations
export const useAppState = () => {
  const chatData = useChatData();
  const emailState = useEmailState();
  const ttsState = useTTSState();
  const languageState = useLanguageState();
  const authState = useAuthState();

  return {
    ...chatData,
    ...emailState,
    ...ttsState,
    ...languageState,
    ...authState,
  };
};

export const useAppActions = () => {
  const chatActions = useChatActions();
  const emailActions = useEmailActions();
  const ttsActions = useTTSActions();
  const languageActions = useLanguageActions();
  const authActions = useAuthActions();

  return {
    ...chatActions,
    ...emailActions,
    ...ttsActions,
    ...languageActions,
    ...authActions,
  };
};

// Memoized selectors for specific use cases
export const useIsEmailModeActive = () => useEmailStore(
  (state) => state.isReplyClicked || state.isReplyAllClicked || state.isForwardClicked,
  shallow
);

export const useHasActiveEmail = () => useEmailStore(
  (state) => !!state.activeCard,
  shallow
);

export const useCurrentChatMessages = () => useChatStore(
  (state) => {
    const currentChat = state.chats.find(chat => chat.id === state.currentChatId);
    return currentChat?.messages || [];
  },
  shallow
);

export const useHasChats = () => useChatStore(
  (state) => state.chats.length > 0,
  shallow
);


export const useIsAudioActive = () => useTTSStore(
  (state) => state.isSpeaking || state.isListening,
  shallow
); 