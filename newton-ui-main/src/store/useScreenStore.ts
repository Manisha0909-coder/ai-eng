import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScreenState {
    screen: "chat" | "communication" | 'auth';
    setScreen: (screen: "chat" | "communication" | 'auth') => void;
}

export const useScreenStore = create<ScreenState>()(
    persist(
        (set) => ({
            screen: "chat",
            setScreen: (screen) => set({ screen }),
        }),
        {
            name: 'screen-storage',
            partialize: (state) => ({
                screen: state.screen,
            }),
        }
    )
);


