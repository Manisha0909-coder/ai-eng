import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TTSStore {
  isListening: boolean;
  isSpeaking: boolean;
  setIsListening: (isListening: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  isSTTActive: boolean;
  setIsSTTActive: (isSTTActive: boolean) => void;
}

const useTTSStore = create<TTSStore>()(
  persist(
    (set) => ({
      isListening: false,
      isSpeaking: false,
      isSTTActive: false,
      setIsListening: (isListening: boolean) => set({ isListening }),
      setIsSpeaking: (isSpeaking: boolean) => set({ isSpeaking }),
      setIsSTTActive: (isSTTActive: boolean) => set({ isSTTActive }),
    }),
    {
      name: 'tts-storage',
      partialize: (state) => ({ 
        isSTTActive: state.isSTTActive 
      }),
    }
  )
);

export default useTTSStore;
