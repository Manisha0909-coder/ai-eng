import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/message';

interface Chat {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
}

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, messages: Message[]) => void;
  setCurrentChat: (chatId: string | null) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  deleteChat: (chatId: string) => void;
  addMessageById: (id: string, message: Message) => void;
  clearAllChats: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      chats: [],
      currentChatId: null,
      addChat: (chat) => set((state) => ({ 
        chats: [chat, ...state.chats],
        currentChatId: chat.id 
      })),
      updateChat: (chatId, messages) => set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, messages } : chat
        ),
      })),
      setCurrentChat: (chatId) => set({ currentChatId: chatId }),
      updateChatTitle: (chatId, title) => set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, title } : chat
        ),
      })),
      deleteChat: (chatId) => set((state) => {
        const newChats = state.chats.filter(chat => chat.id !== chatId);
        return {
          chats: newChats,
          currentChatId: state.currentChatId === chatId ? (newChats[0]?.id || null) : state.currentChatId
        };
      }),
      addMessageById: (id, message) => set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === id ? { ...chat, messages: [...chat.messages, message] } : chat
        )
      })),
      clearAllChats: () => set({ chats: [], currentChatId: null }),
   
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        chats: state.chats.map(({ id, title, timestamp }) => ({
          id,
          title,
          timestamp,
          messages: [],
        })),
        currentChatId: state.currentChatId,
      }),
    }
  )
); 