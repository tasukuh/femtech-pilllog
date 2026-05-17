/**
 * ルートリダイレクト
 *
 * アプリ起動時のエントリーポイント
 * オンボーディング状態に応じてリダイレクト
 */

import { Redirect } from 'expo-router';
import { useAppStore } from '@/stores/appStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useEffect, useState } from 'react';

export default function Index() {
  const { hasCompletedOnboarding } = useAppStore();
  const [isReady, setIsReady] = useState(false);

  // ストアの hydration を待つ
  useEffect(() => {
    // AsyncStorage から状態が復元されるまで少し待つ
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingSpinner fullScreen />;
  }

  // オンボーディング完了状態に応じてリダイレクト
  if (hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(onboarding)/welcome" />;
}
