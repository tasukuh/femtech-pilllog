/**
 * 設定画面
 *
 * ピル管理・通知設定・データ管理・その他
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Trash2, Edit } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { palette, typography, spacing, radius } from '@/design-tokens';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { usePremium } from '@/lib/premium';
import { requestHealthPermissions, isHealthKitAvailable } from '@/lib/health/permissions';

import { getActiveMedication } from '@/lib/db/queries/pillMedications';
import {
  getNotificationSettings,
  updatePrimaryTime,
  toggleEveningReminder,
  toggleSound,
  parseReminderIntervals,
} from '@/lib/db/queries/notificationSettings';
import { setOnboardingStatus } from '@/lib/db/queries/appSettings';
import { clearFutureDoseRecords } from '@/lib/db/queries/doseRecords';
import { resetDB } from '@/lib/db/index';
import {
  scheduleDailyReminders,
  cancelAllDailyReminders,
} from '@/lib/notifications/setup';
import { formatTime, parseTime } from '@/lib/utils/date';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'expo-router';

// アプリバージョン（app.jsonから取得）
const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { resetOnboarding } = useAppStore();
  const { isPremium } = usePremium();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState<Date | null>(null);
  const [healthPermissionGranted, setHealthPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (isPremium && Platform.OS === 'ios') {
      isHealthKitAvailable().then(setHealthPermissionGranted);
    }
  }, [isPremium]);

  // ピル情報を取得
  const {
    data: medication,
    isLoading: isMedicationLoading,
    error: medicationError,
  } = useQuery({
    queryKey: ['medication'],
    queryFn: getActiveMedication,
  });

  // 通知設定を取得
  const {
    data: notificationSettings,
    isLoading: isSettingsLoading,
    error: settingsError,
  } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: getNotificationSettings,
  });

  // 通知設定が変わったら DB の最新値で再スケジュール
  const rescheduleFromDb = async () => {
    try {
      const latest = await getNotificationSettings();
      await scheduleDailyReminders({
        primaryTime: latest.primaryTime,
        reminderIntervals: parseReminderIntervals(latest),
        eveningEnabled: latest.eveningReminderEnabled,
        eveningTime: latest.eveningReminderTime,
        sound: latest.soundEnabled,
      });
    } catch (error) {
      console.error('[Settings] Failed to reschedule reminders:', error);
    }
  };

  // 服薬時刻更新
  const updateTimeMutation = useMutation({
    mutationFn: (time: string) => updatePrimaryTime(time),
    onSuccess: async () => {
      await rescheduleFromDb();
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('保存しました', '服薬時刻を更新しました');
    },
    onError: (error) => {
      Alert.alert('エラー', '時刻の更新に失敗しました');
      console.error('[Settings] Failed to update time:', error);
    },
  });

  // 夜の確認通知トグル
  const toggleEveningMutation = useMutation({
    mutationFn: (enabled: boolean) => toggleEveningReminder(enabled),
    onSuccess: async () => {
      await rescheduleFromDb();
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  // 通知音トグル
  const toggleSoundMutation = useMutation({
    mutationFn: (enabled: boolean) => toggleSound(enabled),
    onSuccess: async () => {
      await rescheduleFromDb();
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  // 未来のデータをクリア
  const handleClearFutureData = async () => {
    Alert.alert(
      '未来のデータをクリア',
      '未来の日付に誤って記録したデータをクリアします。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'クリアする',
          onPress: async () => {
            try {
              await clearFutureDoseRecords();
              queryClient.invalidateQueries({ queryKey: ['dose'] });
              queryClient.invalidateQueries({ queryKey: ['doseRecords'] });
              queryClient.invalidateQueries({ queryKey: ['sheet'] });
              queryClient.invalidateQueries({ queryKey: ['monthStats'] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('完了', '未来のデータをクリアしました');
            } catch (error) {
              Alert.alert('エラー', 'データのクリアに失敗しました');
              console.error('[Settings] Failed to clear future data:', error);
            }
          },
        },
      ]
    );
  };

  // データ削除
  const handleDeleteData = () => {
    Alert.alert(
      'データを削除',
      'すべての服薬記録とピル情報を削除します。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            // 2段階確認
            Alert.alert(
              '本当に削除しますか？',
              'すべてのデータが失われます。',
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '完全に削除',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      console.log('[Settings] Deleting all data...');

                      // 通知も全キャンセル（毎日リマインダーが残らないように）
                      await cancelAllDailyReminders();

                      // データベースをリセット
                      await resetDB();

                      // オンボーディング状態をリセット（DB）
                      await setOnboardingStatus(false);

                      // メモリ内の状態もリセット
                      resetOnboarding();

                      // キャッシュをクリア
                      queryClient.clear();

                      console.log('[Settings] All data deleted, redirecting to onboarding...');

                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                      // ウェルカム画面に遷移
                      router.replace('/(onboarding)/welcome');
                    } catch (error) {
                      Alert.alert('エラー', 'データの削除に失敗しました');
                      console.error('[Settings] Failed to delete data:', error);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // タイムピッカー変更
  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setTempTime(selectedDate);
      if (Platform.OS === 'android') {
        const timeStr = formatTime(selectedDate);
        updateTimeMutation.mutate(timeStr);
      }
    } else if (event.type === 'dismissed') {
      setShowTimePicker(false);
      setTempTime(null);
    }
  };

  // iOSのタイムピッカー確定
  const handleConfirmTime = () => {
    if (tempTime) {
      const timeStr = formatTime(tempTime);
      updateTimeMutation.mutate(timeStr);
    }
    setShowTimePicker(false);
    setTempTime(null);
  };

  // リンクを開く
  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  if (isMedicationLoading || isSettingsLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (medicationError || settingsError) {
    return (
      <View style={styles.container}>
        <ErrorDisplay
          message="設定の読み込みに失敗しました。アプリを再起動してください"
          
        />
      </View>
    );
  }

  const reminderIntervals = notificationSettings
    ? parseReminderIntervals(notificationSettings)
    : [5, 30, 60];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>設定</Text>
        </View>

        {/* セクション1: ピルの管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ピルの管理</Text>

          {medication ? (
            <Card style={styles.settingCard}>
              <Pressable
                style={styles.settingRow}
                onPress={() => {
                  // TODO: ピル編集画面へ
                  Alert.alert('準備中', 'ピル編集機能は現在開発中です');
                }}
                accessibilityRole="button"
                accessibilityLabel="ピル情報を編集"
              >
                <View style={styles.settingLeft}>
                  <Text style={styles.settingLabel}>現在のピル</Text>
                  <Text style={styles.settingValue}>{medication.name}</Text>
                </View>
                <Edit color={palette.primary} size={20} />
              </Pressable>
            </Card>
          ) : (
            <Card style={styles.settingCard}>
              <Text style={styles.emptyText}>ピルが登録されていません</Text>
            </Card>
          )}

          <Card style={styles.settingCard}>
            <Pressable
              style={styles.settingRow}
              onPress={() => router.push('/modal/paywall')}
              accessibilityRole="button"
              accessibilityLabel="新しいピルを追加"
            >
              <View style={styles.settingLeft}>
                <Text style={[styles.settingLabel, styles.premiumLabel]}>
                  新しいピルを追加
                </Text>
                <Text style={styles.premiumBadge}>Premium</Text>
              </View>
              <ChevronRight color={palette.gray400} size={20} />
            </Pressable>
          </Card>
        </View>

        {/* セクション2: 通知 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知</Text>

          <Card style={styles.settingCard}>
            {/* 服薬時刻 */}
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                if (notificationSettings) {
                  setTempTime(parseTime(notificationSettings.primaryTime));
                  setShowTimePicker(true);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="服薬時刻を変更"
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>服薬時刻</Text>
                <Text style={styles.settingValue}>
                  {notificationSettings?.primaryTime}
                </Text>
              </View>
              <ChevronRight color={palette.muted} size={20} />
            </Pressable>

            <View style={styles.divider} />

            {/* 段階的リマインダー */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>段階的リマインダー</Text>
                <Text style={styles.settingHint}>
                  {reminderIntervals.join('分後、')}分後に再通知
                </Text>
              </View>
              <Switch
                value={true}
                disabled
                trackColor={{
                  false: palette.gray300,
                  true: palette.primarySoft,
                }}
                thumbColor={palette.primary}
              />
            </View>

            <View style={styles.divider} />

            {/* 夜の確認通知 */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>夜の確認通知</Text>
                <Text style={styles.settingHint}>
                  記録がない場合、22:00に通知
                </Text>
              </View>
              <Switch
                value={notificationSettings?.eveningReminderEnabled ?? true}
                onValueChange={(value) => toggleEveningMutation.mutate(value)}
                trackColor={{
                  false: palette.gray300,
                  true: palette.primarySoft,
                }}
                thumbColor={palette.primary}
              />
            </View>

            <View style={styles.divider} />

            {/* 通知音 */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>通知音</Text>
              </View>
              <Switch
                value={notificationSettings?.soundEnabled ?? true}
                onValueChange={(value) => toggleSoundMutation.mutate(value)}
                trackColor={{
                  false: palette.gray300,
                  true: palette.primarySoft,
                }}
                thumbColor={palette.primary}
              />
            </View>
          </Card>
        </View>

        {/* セクション3: ヘルスケア連携（iOS のみ） */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ヘルスケア連携</Text>
            <Card style={styles.settingCard}>
              {isPremium ? (
                <Pressable
                  style={styles.settingRow}
                  onPress={async () => {
                    if (healthPermissionGranted) {
                      Linking.openSettings();
                    } else {
                      const granted = await requestHealthPermissions();
                      setHealthPermissionGranted(granted);
                      if (!granted) Linking.openSettings();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Appleヘルスケアの権限を管理"
                >
                  <View style={styles.settingLeft}>
                    <Text style={styles.settingLabel}>Appleヘルスケア</Text>
                    <Text style={styles.settingHint}>
                      {healthPermissionGranted ? '接続済み' : '権限を許可する'}
                    </Text>
                  </View>
                  <ChevronRight color={palette.muted} size={20} />
                </Pressable>
              ) : (
                <Pressable
                  style={styles.settingRow}
                  onPress={() => router.push('/modal/paywall')}
                  accessibilityRole="button"
                  accessibilityLabel="Appleヘルスケア連携をアンロック"
                >
                  <View style={styles.settingLeft}>
                    <Text style={[styles.settingLabel, styles.premiumLabel]}>
                      Appleヘルスケア連携
                    </Text>
                    <Text style={styles.premiumBadge}>Premium</Text>
                  </View>
                  <ChevronRight color={palette.gray400} size={20} />
                </Pressable>
              )}
            </Card>
          </View>
        )}

        {/* セクション5: データ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ</Text>

          <Card style={styles.settingCard}>
            <Pressable
              style={styles.settingRow}
              onPress={handleClearFutureData}
              accessibilityRole="button"
              accessibilityLabel="未来のデータをクリア"
            >
              <View style={styles.settingLeft}>
                <Text style={styles.settingLabel}>
                  未来のデータをクリア
                </Text>
                <Text style={styles.settingHint}>
                  誤って記録した未来の日付をクリア
                </Text>
              </View>
              <Trash2 color={palette.primary} size={20} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={styles.settingRow}
              onPress={handleDeleteData}
              accessibilityRole="button"
              accessibilityLabel="データを削除"
            >
              <View style={styles.settingLeft}>
                <Text style={[styles.settingLabel, styles.dangerLabel]}>
                  すべてのデータを削除
                </Text>
                <Text style={styles.settingHint}>
                  この操作は取り消せません
                </Text>
              </View>
              <Trash2 color={palette.error} size={20} />
            </Pressable>
          </Card>
        </View>

        {/* セクション4: その他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>その他</Text>

          <Card style={styles.settingCard}>
            <Pressable
              style={styles.settingRow}
              onPress={() => openLink('https://example.com/privacy')}
              accessibilityRole="button"
              accessibilityLabel="プライバシーポリシー"
            >
              <Text style={styles.settingLabel}>プライバシーポリシー</Text>
              <ChevronRight color={palette.muted} size={20} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={styles.settingRow}
              onPress={() => openLink('https://example.com/terms')}
              accessibilityRole="button"
              accessibilityLabel="利用規約"
            >
              <Text style={styles.settingLabel}>利用規約</Text>
              <ChevronRight color={palette.muted} size={20} />
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>バージョン</Text>
              <Text style={styles.settingValue}>{APP_VERSION}</Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* タイムピッカー（iOS） */}
      {showTimePicker && Platform.OS === 'ios' && tempTime && (
        <View style={styles.timePickerContainer}>
          <View style={styles.timePickerHeader}>
            <Pressable onPress={() => {
              setShowTimePicker(false);
              setTempTime(null);
            }}>
              <Text style={styles.timePickerCancel}>キャンセル</Text>
            </Pressable>
            <Text style={styles.timePickerTitle}>服薬時刻</Text>
            <Pressable onPress={handleConfirmTime}>
              <Text style={styles.timePickerConfirm}>完了</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={tempTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            style={styles.timePicker}
          />
        </View>
      )}

      {/* タイムピッカー（Android） */}
      {showTimePicker && Platform.OS === 'android' && tempTime && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  header: {
    paddingTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.scale.h1,
    fontWeight: typography.weight.bold,
    color: palette.ink,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.semibold,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  settingCard: {
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  settingLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.medium,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  settingValue: {
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  settingHint: {
    fontSize: typography.scale.xs,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  premiumLabel: {
    color: palette.gray400,
  },
  premiumBadge: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
    backgroundColor: palette.primaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  dangerLabel: {
    color: palette.error,
  },
  emptyText: {
    fontSize: typography.scale.body,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.xs,
  },
  timePickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.cardBg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  timePickerTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  timePickerCancel: {
    fontSize: typography.scale.body,
    color: palette.muted,
  },
  timePickerConfirm: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
  },
  timePicker: {
    height: 200,
  },
});
