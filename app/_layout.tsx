import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { QueryClientProvider } from '@tanstack/react-query';

import { Platform } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/stores/appStore';
import { initDB } from '@/lib/db';
import { getOnboardingStatus } from '@/lib/db/queries/appSettings';
import { queryClient } from '@/lib/queries/client';
import {
  registerNotificationCategories,
  configureForegroundNotificationBehavior,
  registerNotificationHandler,
  scheduleDailyReminders,
} from '@/lib/notifications';
import {
  getNotificationSettings,
  parseReminderIntervals,
} from '@/lib/db/queries/notificationSettings';
import { getActiveMedication } from '@/lib/db/queries/pillMedications';
import { getCurrentSheet } from '@/lib/db/queries/sheets';
import { getTodaysDoseRecord } from '@/lib/db/queries/doseRecords';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isDbReady, setIsDbReady] = useState(false);

  // DB初期化 + 通知システム初期化
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      try {
        console.log('[App] Starting initialization...');

        // データベース初期化（完了を待つ）
        await initDB();
        console.log('[App] Database initialized successfully');

        // RevenueCat 初期化（iOS のみ）
        if (Platform.OS === 'ios') {
          try {
            const { default: Purchases } = await import('react-native-purchases');
            const rcKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
            if (rcKey) {
              Purchases.configure({ apiKey: rcKey });
              console.log('[App] RevenueCat initialized');
            } else {
              console.warn('[App] EXPO_PUBLIC_REVENUECAT_IOS_KEY not set');
            }
          } catch (err) {
            console.warn('[App] RevenueCat init failed (non-fatal):', err);
          }
        }

        // オンボーディング状態をDBから読み込んでストアに設定
        const onboardingCompleted = await getOnboardingStatus();
        console.log('[App] Onboarding status from DB:', onboardingCompleted);
        useAppStore.getState().setHasCompletedOnboarding(onboardingCompleted);

        // 通知システム初期化
        await registerNotificationCategories();
        configureForegroundNotificationBehavior();
        unsubscribe = registerNotificationHandler();

        // オンボーディング完了済みなら、起動のたびにローリングウィンドウを再構築する。
        // 日付別 DATE 通知は毎日 1 日分ずつ消費されるため、起動時の補充が必須。
        // 今日分を既に服薬済みなら skipToday=true で今日の通知は再スケジュールしない。
        if (onboardingCompleted) {
          try {
            const medication = await getActiveMedication();
            if (medication) {
              const settings = await getNotificationSettings();
              const sheet = await getCurrentSheet(medication.id);
              const todaysDose = sheet ? await getTodaysDoseRecord(sheet.id) : null;
              const skipToday = todaysDose?.status === 'taken';

              console.log(`[App] Rebuilding reminder window (skipToday=${skipToday})`);
              await scheduleDailyReminders({
                primaryTime: settings.primaryTime,
                reminderIntervals: parseReminderIntervals(settings),
                eveningEnabled: settings.eveningReminderEnabled,
                eveningTime: settings.eveningReminderTime,
                sound: settings.soundEnabled,
                skipToday,
              });
            }
          } catch (rescheduleError) {
            console.warn('[App] Failed to ensure daily reminders:', rescheduleError);
          }
        }

        console.log('[App] Notification system initialized');

        // 初期化完了
        setIsDbReady(true);
      } catch (err) {
        console.error('[App] Failed to initialize:', err);
        // エラーでも表示を続ける（デバッグ用）
        setIsDbReady(true);
      }
    };

    initialize();

    // クリーンアップ
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && isDbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isDbReady]);

  // フォント読み込み中 または DB初期化中
  if (!loaded || !isDbReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const { hasCompletedOnboarding } = useAppStore();

  // オンボーディング状態に基づいて画面遷移を管理
  useEffect(() => {
    const inOnboarding = segments[0] === '(onboarding)';

    console.log('[RootLayout] Navigation check:', {
      hasCompletedOnboarding,
      inOnboarding,
      segments,
    });

    if (!hasCompletedOnboarding && !inOnboarding) {
      // オンボーディング未完了の場合、welcome画面へ
      console.log('[RootLayout] Redirecting to onboarding');
      router.replace('/(onboarding)/welcome');
    } else if (hasCompletedOnboarding && inOnboarding) {
      // オンボーディング完了済みの場合、ホーム画面へ
      console.log('[RootLayout] Redirecting to home');
      router.replace('/(tabs)');
    }
  }, [hasCompletedOnboarding, segments]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
