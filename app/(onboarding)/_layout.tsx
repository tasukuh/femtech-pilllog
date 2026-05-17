/**
 * オンボーディンググループレイアウト
 *
 * - ヘッダー非表示
 * - 戻る操作を制限（welcome画面のみ戻れない）
 */

import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export default function OnboardingLayout() {
  const router = useRouter();

  // Android ハードウェアバックボタンを無効化
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // 戻る操作をブロック（welcome画面からは抜けられない）
      return true;
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // iOS スワイプバック無効
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="pill-selection" />
      <Stack.Screen name="schedule-time" />
      <Stack.Screen name="current-status" />
      <Stack.Screen name="notification-permission" />
    </Stack>
  );
}
