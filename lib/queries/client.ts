/**
 * TanStack Query client (singleton)
 *
 * アプリ全体で共有するQueryClientインスタンス
 * 通知ハンドラーなど、React外からもアクセス可能
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60 * 1000, // 1分
    },
  },
});
