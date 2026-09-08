// languageStore.ts - Update with keyboard direction
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  languageType: 'EN' | 'AR';
  keyboardDirection: 'ltr' | 'rtl';
  keyboardLanguage: 'en' | 'ar';
  setLanguageType: (languageType: 'EN' | 'AR') => void;
  setKeyboardDirection: (direction: 'ltr' | 'rtl') => void;
  setKeyboardLanguage: (language: 'en' | 'ar') => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      languageType: 'EN',
      keyboardDirection: 'ltr',
      keyboardLanguage: 'en',
      setLanguageType: (languageType) => set({ 
        languageType,
        keyboardDirection: languageType === 'AR' ? 'rtl' : 'ltr',
        keyboardLanguage: languageType === 'AR' ? 'ar' : 'en'
      }),
      setKeyboardDirection: (keyboardDirection) => set({ keyboardDirection }),
      setKeyboardLanguage: (keyboardLanguage) => set({ keyboardLanguage }),
    }),
    {
      name: 'language-storage',
    }
  )
); 