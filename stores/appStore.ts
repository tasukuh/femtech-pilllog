/**
 * アプリケーション状態管理
 *
 * Zustand store for app-wide state
 * - オンボーディング完了状態
 * - セッション状態
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // オンボーディング状態
  hasCompletedOnboarding: boolean;
  isOnboarded: boolean;

  // Actions
  setOnboarded: (value: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      isOnboarded: false,

      setOnboarded: (value: boolean) => set({ isOnboarded: value }),

      completeOnboarding: () => set({
        hasCompletedOnboarding: true,
        isOnboarded: true,
      }),

      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        isOnboarded: false,
      }),
    }),
    {
      name: 'pilllog-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
