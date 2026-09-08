import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EmailCard {
  id: string;
  conversation_id: string;
  email_datetime: string;
  email_service: string;
  message_id?: string;
  from_address: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  cc_recipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  subject: string;
  summary: string;
  unique_body: string;
  has_attachments: boolean;
  is_read: boolean;
}

interface EmailStore {
  isReplyClicked:boolean;
  isReplyAllClicked:boolean;
  isForwardClicked:boolean;
  activeCard: EmailCard | null;
  removedCards: string[];
  setActiveCard: (card: EmailCard | null) => void;
  removeCard: (cardId: string) => void;
  clearActiveCard: () => void;
  setReplyClicked:(value:boolean)=>void;
  setReplyAllClicked:(value:boolean)=>void;
  setForwardClicked:(value:boolean)=>void;
}

export const useEmailStore = create<EmailStore>()(
  persist(
    (set) => ({
      isReplyClicked: false,
      isReplyAllClicked: false,
      isForwardClicked: false,
      activeCard: null,
      removedCards: [],
      setReplyClicked: (value: boolean) => set({ isReplyClicked: value }),
      setReplyAllClicked: (value: boolean) => set({ isReplyAllClicked: value }),
      setForwardClicked: (value: boolean) => set({ isForwardClicked: value }),
      setActiveCard: (card: EmailCard | null) => set({ activeCard: card }),
      removeCard: (cardId: string) => 
        set((state) => ({
          removedCards: [...state.removedCards, cardId],
          activeCard: state.activeCard?.id === cardId ? null : state.activeCard
        })),
      clearActiveCard: () => set({ activeCard: null }),
    }),
    {
      name: 'email-storage',
    }
  )
); 