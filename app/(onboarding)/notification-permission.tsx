/**
 * オンボーディング - 通知許可画面
 *
 * 通知許可をリクエストし、データを保存してオンボーディング完了
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OnboardingContainer } from '@/components/ui/OnboardingContainer';
import { Button } from '@/components/ui/Button';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { requestNotificationPermission, setupGradualReminders } from '@/lib/notifications/setup';
import { createMedication } from '@/lib/db/queries/pillMedications';
import { initializeSheet } from '@/lib/db/queries/sheets';
import { getTodaysDoseRecord } from '@/lib/db/queries/doseRecords';
import { updatePrimaryTime } from '@/lib/db/queries/notificationSettings';
import { setOnboardingStatus } from '@/lib/db/queries/appSettings';
import { useAppStore } from '@/stores/appStore';
import { format, subDays } from 'date-fns';

// ピルのシートパターン定義
const PILL_PATTERNS: Record<string, { active: number; placebo?: number; max?: number }> = {
  triquilar28: { active: 21, placebo: 7 },
  triquilar21: { active: 21 },
  yaz_flex: { active: 24, max: 120 }, // ヤーズフレックスは最大120日
  yaz: { active: 24, placebo: 4 },
  marvelon28: { active: 21, placebo: 7 },
  ange28: { active: 21, placebo: 7 },
  custom: { active: 21, placebo: 7 }, // デフォルト
};

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pillId: string;
    pillName: string;
    pillType: string;
    scheduledTime: string;
    sheetStatus: 'new' | 'ongoing';
    currentDay: string;
  }>();

  const { completeOnboarding } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleAllowNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      // 通知許可をリクエスト（シミュレータでは失敗する可能性がある）
      try {
        const granted = await requestNotificationPermission();
        if (!granted) {
          console.warn('[Onboarding] Notification permission not granted');
        }
      } catch (notifError) {
        console.warn('[Onboarding] Notification permission request failed (simulator?)', notifError);
        // シミュレータの場合は続行
      }

      // データを保存してオンボーディング完了（通知許可失敗でも続行）
      await completeSetup();
    } catch (error) {
      console.error('[Onboarding] Failed to complete setup:', error);
      Alert.alert('エラー', 'セットアップに失敗しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);

    try {
      await completeSetup();
    } catch (error) {
      console.error('[Onboarding] Failed to complete setup:', error);
      Alert.alert('エラー', 'セットアップに失敗しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };

  const completeSetup = async () => {
    try {
      // パラメータの取得
      const { pillId, pillName, pillType, scheduledTime, sheetStatus, currentDay } = params;

      console.log('[Onboarding] Setup params:', { pillId, pillName, pillType, scheduledTime, sheetStatus, currentDay });

      if (!pillId || !pillName || !scheduledTime) {
        const missing = [];
        if (!pillId) missing.push('pillId');
        if (!pillName) missing.push('pillName');
        if (!scheduledTime) missing.push('scheduledTime');
        throw new Error(`Required parameters missing: ${missing.join(', ')}`);
      }

      // シートパターンを取得
      const pattern = PILL_PATTERNS[pillId] || PILL_PATTERNS.custom;
      console.log('[Onboarding] Using pattern:', pattern);

      // ピルを作成
      console.log('[Onboarding] Creating medication...');
      const today = new Date();
      const medicationId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        const medication = await createMedication({
          id: medicationId,
          name: pillName,
          type: pillType as 'monophasic' | 'triphasic' | 'continuous' | 'extended',
          sheetPatternJson: JSON.stringify(pattern),
          scheduledTime,
          isActive: true,
          startedAt: format(today, 'yyyy-MM-dd'),
        });
        console.log('[Onboarding] Created medication:', medication.id);
      } catch (medError) {
        console.error('[Onboarding] Failed to create medication:', medError);
        throw new Error(`Medication creation failed: ${medError}`);
      }

      // シート開始日を計算
      let sheetStartDate: Date;
      if (sheetStatus === 'new') {
        sheetStartDate = today;
      } else {
        // すでに服用中の場合、currentDayから逆算
        const daysPassed = parseInt(currentDay || '1', 10) - 1;
        sheetStartDate = subDays(today, daysPassed);
      }

      // シートを初期化
      console.log('[Onboarding] Initializing sheet...');
      let sheet;
      try {
        sheet = await initializeSheet(medicationId, sheetStartDate);
        console.log('[Onboarding] Initialized sheet starting from:', format(sheetStartDate, 'yyyy-MM-dd'));
      } catch (sheetError) {
        console.error('[Onboarding] Failed to initialize sheet:', sheetError);
        throw new Error(`Sheet initialization failed: ${sheetError}`);
      }

      // 通知設定を更新
      console.log('[Onboarding] Updating notification settings...');
      try {
        await updatePrimaryTime(scheduledTime);
        console.log('[Onboarding] ✓ Notification settings updated:', scheduledTime);
      } catch (settingsError) {
        console.warn('[Onboarding] Failed to update notification settings:', settingsError);
      }

      // 今日の通知をスケジュール
      console.log('[Onboarding] Scheduling today\'s notification...');
      try {
        const todayRecord = await getTodaysDoseRecord(sheet.id);
        if (todayRecord && todayRecord.status !== 'taken') {
          const [hours, minutes] = scheduledTime.split(':').map(Number);
          const scheduledDateTime = new Date();
          scheduledDateTime.setHours(hours, minutes, 0, 0);

          console.log('[Onboarding] Scheduling for dose:', todayRecord.id, 'at', scheduledDateTime.toISOString());
          await setupGradualReminders(todayRecord.id, scheduledDateTime);
          console.log('[Onboarding] ✓ Notification scheduled successfully');
        } else {
          console.log('[Onboarding] No notification to schedule (already taken or not found)');
        }
      } catch (notifError) {
        console.warn('[Onboarding] Failed to schedule notification:', notifError);
        // 通知スケジューリングに失敗してもオンボーディングは完了させる
      }

      // オンボーディング完了状態をデータベースに保存
      console.log('[Onboarding] Saving onboarding status to DB...');
      await setOnboardingStatus(true);
      console.log('[Onboarding] Onboarding status saved successfully');

      // メモリ内の状態も更新
      console.log('[Onboarding] Updating in-memory state...');
      completeOnboarding();
      console.log('[Onboarding] State updated successfully');

      // ホーム画面に遷移
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[Onboarding] Navigating to home...');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Onboarding] Setup failed:', error);
      throw error;
    }
  };

  return (
    <OnboardingContainer step={5} totalSteps={5}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>
            服薬を忘れないために{'\n'}通知を許可してください
          </Text>
          <Text style={styles.subtitle}>
            ロック画面から直接記録できます
          </Text>

          {/* Notification preview mockup */}
          <View style={styles.mockupContainer}>
            <View style={styles.mockup}>
              <View style={styles.mockupHeader}>
                <Text style={styles.mockupApp}>ピルログ</Text>
                <Text style={styles.mockupTime}>今</Text>
              </View>
              <Text style={styles.mockupTitle}>おはようございます ☀️</Text>
              <Text style={styles.mockupBody}>今日のピルを忘れずに</Text>
            </View>
          </View>

          <View style={styles.benefitsList}>
            <Text style={styles.benefitItem}>✓ 毎日決まった時間にお知らせ</Text>
            <Text style={styles.benefitItem}>✓ 段階的なリマインダー</Text>
            <Text style={styles.benefitItem}>✓ アプリを開かずに記録完了</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleAllowNotifications}
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            通知を許可
          </Button>
          <Button
            onPress={handleSkip}
            variant="text"
            fullWidth
            disabled={isLoading}
          >
            後で設定する
          </Button>
        </View>
      </View>
    </OnboardingContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    marginBottom: spacing.sm,
    lineHeight: typography.scale.h2 * typography.lineHeight.tight,
  },
  subtitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    marginBottom: spacing['2xl'],
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  mockupContainer: {
    alignItems: 'center',
    marginVertical: spacing['2xl'],
  },
  mockup: {
    width: '100%',
    backgroundColor: palette.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...{
      shadowColor: palette.ink,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  mockupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mockupApp: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.semibold,
    color: palette.muted,
    textTransform: 'uppercase',
  },
  mockupTime: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.regular,
    color: palette.muted,
  },
  mockupTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  mockupBody: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.regular,
    color: palette.muted,
  },
  benefitsList: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  benefitItem: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.regular,
    color: palette.ink,
    paddingLeft: spacing.sm,
  },
  buttonContainer: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
});
