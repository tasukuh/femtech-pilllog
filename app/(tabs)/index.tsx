/**
 * ホーム画面
 *
 * 最も重要な画面 - 毎日見る
 * シート進捗リング + 今日の服薬カード + 履歴リンク
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { toast } from '@/lib/toast';
import { ChevronRight } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { SheetProgressRing } from '@/components/domain/SheetProgressRing';
import { DoseCard } from '@/components/domain/DoseCard';
import { DailyNoteInput } from '@/components/domain/DailyNoteInput';
import {
  useActiveMedication,
  useCurrentSheet,
  useTodaysDose,
  useMarkDoseTaken,
  useDailyNote,
  useUpsertDailyNote,
} from '@/lib/queries/hooks';
import { getDoseRecordsBySheet } from '@/lib/db/queries/doseRecords';

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  // Data fetching
  const { data: medication, isLoading: medicationLoading, refetch: refetchMedication } = useActiveMedication();
  const { data: sheet, isLoading: sheetLoading, refetch: refetchSheet } = useCurrentSheet(medication?.id);
  const { data: todaysDose, isLoading: doseLoading, refetch: refetchDose } = useTodaysDose(sheet?.id);

  // シートの全記録を取得（進捗計算用）
  const { data: allRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['doseRecords', 'all', sheet?.id],
    queryFn: () => {
      if (!sheet) return [];
      return getDoseRecordsBySheet(sheet.id);
    },
    enabled: !!sheet,
  });

  // Mutation
  const markDoseTaken = useMarkDoseTaken();

  // 今日の1行日記（無料機能）
  const today = React.useMemo(() => new Date(), []);
  const { data: todaysNote } = useDailyNote(today);
  const upsertNote = useUpsertDailyNote();
  const handleSaveNote = React.useCallback(
    (note: string) => {
      upsertNote.mutate({ date: today, note });
    },
    [upsertNote, today]
  );

  const isLoading = medicationLoading || sheetLoading || doseLoading || recordsLoading;

  // Calculate progress
  const [currentDay, setCurrentDay] = React.useState(0);
  const [totalDays, setTotalDays] = React.useState(0);
  const [daysUntilBreak, setDaysUntilBreak] = React.useState(0);

  React.useEffect(() => {
    if (!sheet || !medication || !allRecords) return;

    // Calculate current day based on taken doses
    const takenCount = allRecords.filter((r) => r.status === 'taken').length;
    const current = takenCount; // 服薬済み日数（リングの進捗）

    // Parse sheet pattern
    const pattern = JSON.parse(medication.sheetPatternJson) as {
      active: number;
      placebo?: number;
      max?: number;
    };
    const total = pattern.max || pattern.active + (pattern.placebo ?? 0);

    // Days until break
    const untilBreak = Math.max(0, pattern.active - current);

    setCurrentDay(current);
    setTotalDays(total);
    setDaysUntilBreak(untilBreak);
  }, [sheet, medication, allRecords]); // allRecordsを依存配列に追加

  // Pull to refresh
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMedication(), refetchSheet(), refetchDose()]);
    setRefreshing(false);
  }, [refetchMedication, refetchSheet, refetchDose]);

  // Handle dose tap
  const handleDoseTap = React.useCallback(async () => {
    if (!todaysDose) return;

    try {
      await markDoseTaken.mutateAsync({
        doseRecordId: todaysDose.id,
        takenAt: new Date(),
        via: 'app',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('服薬を記録しました');
    } catch (error) {
      console.error('[HomeScreen] Failed to mark dose:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error, '記録に失敗しました');
    }
  }, [todaysDose, markDoseTaken]);

  // Navigate to history
  const handleViewHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/history');
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - no medication
  if (!medication) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>ピルが登録されていません</Text>
          <Text style={styles.errorText}>
            設定からピルを登録してください
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - no sheet
  if (!sheet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>シートが開始されていません</Text>
          <Text style={styles.errorText}>
            新しいシートを開始してください
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - no dose record for today
  if (!todaysDose) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>今日の服薬記録がありません</Text>
          <Text style={styles.errorText}>
            シートに問題がある可能性があります
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Progress Ring */}
        <View style={styles.ringSection}>
          <SheetProgressRing
            currentDay={currentDay}
            totalDays={totalDays}
            sheetNumber={sheet.sheetNumber}
            daysUntilBreak={daysUntilBreak}
          />
        </View>

        {/* Today's Dose Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日の服薬</Text>
          <DoseCard
            medication={medication}
            doseRecord={todaysDose}
            onTap={handleDoseTap}
          />
        </View>

        {/* Today's Note Section（1行日記・無料） */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日のひとこと</Text>
          <DailyNoteInput
            value={todaysNote?.note ?? ''}
            onSave={handleSaveNote}
          />
        </View>

        {/* History Link */}
        <Pressable
          style={({ pressed }) => [
            styles.historyLink,
            pressed && styles.historyLinkPressed,
          ]}
          onPress={handleViewHistory}
          accessibilityLabel="今週の記録を見る"
          accessibilityRole="button"
        >
          <Text style={styles.historyLinkText}>今週の記録を見る</Text>
          <ChevronRight size={20} color={palette.primary} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  content: {
    paddingVertical: spacing['2xl'],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.scale.body,
    color: palette.muted,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.scale.body,
    color: palette.muted,
    textAlign: 'center',
  },
  ringSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.scale.h3,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    marginBottom: spacing.lg,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: palette.primaryBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.primarySoft,
  },
  historyLinkPressed: {
    opacity: 0.7,
  },
  historyLinkText: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
    marginRight: spacing.sm,
  },
});
