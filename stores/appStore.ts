/**
 * アプリケーション状態管理
 *
 * Zustand store for app-wide state
 * - オンボーディング完了状態（メモリ内のみ、永続化はDBで）
 * - セッション状態
 */

import { create } from 'zustand';

interface AppState {
  // オンボーディング状態（メモリ内のみ）
  hasCompletedOnboarding: boolean;
  isOnboarded: boolean;

  // Actions
  setOnboarded: (value: boolean) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  hasCompletedOnboarding: false,
  isOnboarded: false,

  setOnboarded: (value: boolean) => set({ isOnboarded: value }),

  setHasCompletedOnboarding: (value: boolean) =>
    set({ hasCompletedOnboarding: value }),

  completeOnboarding: () =>
    set({
      hasCompletedOnboarding: true,
      isOnboarded: true,
    }),

  resetOnboarding: () =>
    set({
      hasCompletedOnboarding: false,
      isOnboarded: false,
    }),
}));
