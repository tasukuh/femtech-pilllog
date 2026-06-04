/**
 * 履歴・カレンダー画面
 *
 * 月次カレンダーで服薬記録 + 1行日記を表示
 * Free版: 今月 + 過去7日間（日記の閲覧・編集も7日まで）
 * Premium版: 全履歴 + 7日以上前の日記 + トレンドグラフ（Phase 2）
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  isBefore,
  isAfter,
  startOfDay,
  subDays,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useMarkDoseTaken,
  useUndoDoseRecord,
  useDailyNote,
  useUpsertDailyNote,
} from '@/lib/queries/hooks';
import { isWithinFreeWindow, usePremium } from '@/lib/premium';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';

import { palette, typography, spacing, radius } from '@/design-tokens';
import { CalendarGrid } from '@/components/domain/CalendarGrid';
import { DailyNoteInput } from '@/components/domain/DailyNoteInput';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

import { getActiveMedication } from '@/lib/db/queries/pillMedications';
import { getCurrentSheet } from '@/lib/db/queries/sheets';
import {
  getDoseRecordsInRange,
  calculateAdherenceRate,
  getMissedCount,
} from '@/lib/db/queries/doseRecords';
import { formatDate, formatTime } from '@/lib/utils/date';
import type { DoseRecord } from '@/lib/db/schema';

export default function HistoryScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { isPremium } = usePremium();

  // Mutations
  const markDoseTaken = useMarkDoseTaken();
  const undoDoseRecord = useUndoDoseRecord();

  // 選択日の1行日記（無料: 過去7日まで閲覧・編集）
  const { data: selectedNote } = useDailyNote(selectedDate ?? new Date());
  const upsertNote = useUpsertDailyNote();

  // ピル情報を取得
  const { data: medication, isLoading: isMedicationLoading } = useQuery({
    queryKey: ['medication'],
    queryFn: getActiveMedication,
  });

  // 現在のシートを取得
  const { data: currentSheet, isLoading: isSheetLoading } = useQuery({
    queryKey: ['currentSheet', medication?.id],
    queryFn: () => getCurrentSheet(medication!.id),
    enabled: !!medication,
  });

  // 選択月の服薬記録を取得
  const { data: records = [], isLoading: isRecordsLoading } = useQuery({
    queryKey: ['doseRecords', currentSheet?.id, selectedMonth],
    queryFn: async () => {
      if (!currentSheet) return [];
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      return getDoseRecordsInRange(currentSheet.id, start, end);
    },
    enabled: !!currentSheet,
  });

  // 月次統計を取得
  const { data: stats } = useQuery({
    queryKey: ['monthStats', currentSheet?.id, selectedMonth],
    queryFn: async () => {
      if (!currentSheet) return null;
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      const adherence = await calculateAdherenceRate(currentSheet.id, start, end);
      const missed = await getMissedCount(currentSheet.id, start, end);
      return { adherence, missed };
    },
    enabled: !!currentSheet,
  });

  // 月を変更
  const handlePreviousMonth = () => {
    const newMonth = subMonths(selectedMonth, 1);

    // Free版: 月末日が7日前より前の月はペイウォール対象
    const sevenDaysAgo = subDays(new Date(), 7);
    const newMonthEnd = endOfMonth(newMonth);

    if (isBefore(newMonthEnd, sevenDaysAgo)) {
      // Premium機能のペイウォール
      Alert.alert(
        'Premium機能です',
        '7日以上前の履歴を見るには、Premiumにアップグレードが必要です。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'Premiumを見る', onPress: () => {
            // TODO: ペイウォール表示
            console.log('[History] Show paywall');
          }},
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(selectedMonth, 1);
    const now = new Date();

    // 未来の月には進めない
    if (newMonth > now) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth(newMonth);
  };

  // 日付タップ
  const handleDateTap = (date: Date) => {
    setSelectedDate(date);
  };

  // 7日以上前のメモ閲覧（Premium）のペイウォール
  const showNotePaywall = () => {
    Alert.alert(
      'Premium機能です',
      '7日以上前のメモを振り返るには、Premiumにアップグレードが必要です。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'Premiumを見る',
          onPress: () => {
            // TODO: ペイウォール表示
            console.log('[History] Show paywall (note)');
          },
        },
      ]
    );
  };

  // 選択日の記録を取得
  const selectedRecord = selectedDate
    ? records.find(r => r.scheduledDate === formatDate(selectedDate))
    : null;

  // 服薬済みにする
  const handleMarkAsTaken = async () => {
    if (!selectedRecord) return;

    try {
      await markDoseTaken.mutateAsync({
        doseRecordId: selectedRecord.id,
        takenAt: new Date(),
        via: 'manual',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('服薬を記録しました');
      setSelectedDate(null); // モーダルを閉じる
    } catch (error) {
      console.error('[History] Failed to mark dose:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error, '記録に失敗しました');
    }
  };

  // 記録を取り消す
  const handleUndoRecord = async () => {
    if (!selectedRecord) return;

    try {
      await undoDoseRecord.mutateAsync({
        doseRecordId: selectedRecord.id,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('記録を取り消しました');
      setSelectedDate(null); // モーダルを閉じる
    } catch (error) {
      console.error('[History] Failed to undo dose:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error, '取り消しに失敗しました');
    }
  };

  if (isMedicationLoading || isSheetLoading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!medication || !currentSheet) {
    return (
      <View style={styles.container}>
        <ErrorDisplay
          message="ピルが登録されていません。設定からピルを登録してください"
          
        />
      </View>
    );
  }

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const canGoNext = !isCurrentMonth;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ヘッダー: 月選択 */}
        <View style={styles.header}>
          <Text style={styles.title}>履歴</Text>
        </View>

        <View style={styles.monthSelector}>
          <Pressable
            onPress={handlePreviousMonth}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}
            accessibilityLabel="前の月"
            accessibilityRole="button"
          >
            <ChevronLeft color={palette.ink} size={24} />
          </Pressable>

          <Text style={styles.monthText}>
            {format(selectedMonth, 'yyyy年M月', { locale: ja })}
          </Text>

          <Pressable
            onPress={handleNextMonth}
            disabled={!canGoNext}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
              !canGoNext && styles.monthButtonDisabled,
            ]}
            accessibilityLabel="次の月"
            accessibilityRole="button"
          >
            <ChevronRight
              color={canGoNext ? palette.ink : palette.gray300}
              size={24}
            />
          </Pressable>
        </View>

        {/* カレンダー */}
        {isRecordsLoading ? (
          <Card style={styles.calendarCard}>
            <LoadingSpinner />
          </Card>
        ) : (
          <CalendarGrid
            month={selectedMonth}
            records={records}
            onDateTap={handleDateTap}
            isDateLocked={isPremium ? undefined : (date) => !isWithinFreeWindow(date)}
          />
        )}

        {/* 月次統計 */}
        {stats && stats.adherence.total > 0 && (
          <Card style={styles.statsCard}>
            <Text style={styles.statsTitle}>
              {format(selectedMonth, 'M月', { locale: ja })}の服薬達成率
            </Text>
            <Text style={styles.statsRate}>
              {Math.round(stats.adherence.rate)}%
            </Text>
            <Text style={styles.statsDetail}>
              {stats.adherence.taken} / {stats.adherence.total} 回
            </Text>
            {stats.missed > 0 && (
              <Text style={styles.statsMissed}>
                飲み忘れ: {stats.missed}回
              </Text>
            )}
          </Card>
        )}

        {/* Premium 案内（価値訴求） */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Premiumでできること</Text>
          <Text style={styles.infoText}>
            ・すべての履歴とメモをさかのぼって閲覧{'\n'}
            ・気分と服薬の記録をグラフで振り返り
          </Text>
        </Card>
      </ScrollView>

      {/* 日付詳細モーダル */}
      <Modal
        visible={!!selectedDate}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDate(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedDate(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrap}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate && format(selectedDate, 'M月d日（E）', { locale: ja })}
              </Text>
              <Pressable
                onPress={() => setSelectedDate(null)}
                style={styles.modalClose}
                accessibilityLabel="閉じる"
                accessibilityRole="button"
              >
                <X color={palette.muted} size={24} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {selectedRecord ? (
                <>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>ステータス</Text>
                    <Text style={[
                      styles.modalValue,
                      selectedRecord.status === 'taken' && { color: palette.success },
                      selectedRecord.status === 'missed' && { color: palette.error },
                    ]}>
                      {selectedRecord.status === 'taken' && '服薬済み'}
                      {selectedRecord.status === 'missed' && '飲み忘れ'}
                      {selectedRecord.status === 'scheduled' && '予定'}
                      {selectedRecord.status === 'skipped' && 'スキップ'}
                    </Text>
                  </View>

                  {selectedRecord.actualTakenAt && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>服薬時刻</Text>
                      <Text style={styles.modalValue}>
                        {formatTime(new Date(selectedRecord.actualTakenAt))}
                      </Text>
                    </View>
                  )}

                  {selectedRecord.takenVia && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>記録方法</Text>
                      <Text style={styles.modalValue}>
                        {selectedRecord.takenVia === 'app' && 'アプリから'}
                        {selectedRecord.takenVia === 'notification' && '通知から'}
                        {selectedRecord.takenVia === 'manual' && '手動'}
                      </Text>
                    </View>
                  )}

                  {selectedRecord.isPlacebo && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>種類</Text>
                      <Text style={styles.modalValue}>偽薬</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.modalEmpty}>この日の記録はありません</Text>
              )}

              {/* アクションボタン */}
              {selectedRecord && selectedDate && (() => {
                const today = startOfDay(new Date());
                const selected = startOfDay(selectedDate);
                const isFuture = isAfter(selected, today);

                return (
                  <View style={styles.modalActions}>
                    {selectedRecord.status === 'taken' ? (
                      // 服薬済みの場合は、未来でも取り消し可能
                      <Button
                        onPress={handleUndoRecord}
                        variant="secondary"
                        fullWidth
                        loading={undoDoseRecord.isPending}
                        disabled={undoDoseRecord.isPending}
                      >
                        記録を取り消す
                      </Button>
                    ) : isFuture ? (
                      // 未来の日付で未記録の場合は記録不可
                      <Text style={styles.modalNote}>
                        未来の日付は記録できません
                      </Text>
                    ) : (
                      // 過去・今日で未記録の場合は記録可能
                      <Button
                        onPress={handleMarkAsTaken}
                        fullWidth
                        loading={markDoseTaken.isPending}
                        disabled={markDoseTaken.isPending}
                      >
                        服薬済みにする
                      </Button>
                    )}
                  </View>
                );
              })()}

              {/* 1行日記（無料: 過去7日まで閲覧・編集 / Premium: それ以前） */}
              {selectedDate && (() => {
                const noteDate = selectedDate;
                const today = startOfDay(new Date());
                const isFuture = isAfter(startOfDay(noteDate), today);
                if (isFuture) return null; // 未来日はメモ非表示

                const locked = !isWithinFreeWindow(noteDate);

                return (
                  <View style={styles.modalNoteSection}>
                    <Text style={styles.modalNoteLabel}>ひとこと</Text>
                    {locked ? (
                      <DailyNoteInput
                        value=""
                        onSave={() => {}}
                        locked
                        compact
                        onLockedPress={showNotePaywall}
                      />
                    ) : (
                      <DailyNoteInput
                        key={formatDate(noteDate)}
                        value={selectedNote?.note ?? ''}
                        onSave={(note) =>
                          upsertNote.mutate({ date: noteDate, note })
                        }
                        compact
                      />
                    )}
                  </View>
                );
              })()}
            </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
    gap: spacing.lg,
  },
  header: {
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.scale.h1,
    fontWeight: typography.weight.bold,
    color: palette.ink,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  monthButton: {
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  monthButtonPressed: {
    backgroundColor: palette.gray100,
  },
  monthButtonDisabled: {
    opacity: 0.3,
  },
  monthText: {
    fontSize: typography.scale.h3,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  calendarCard: {
    marginBottom: spacing.md,
  },
  statsCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  statsTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.medium,
    color: palette.muted,
    marginBottom: spacing.xs,
  },
  statsRate: {
    fontSize: 48,
    fontWeight: typography.weight.bold,
    color: palette.primary,
    marginBottom: spacing.xs,
  },
  statsDetail: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    marginBottom: spacing.sm,
  },
  statsMissed: {
    fontSize: typography.scale.sm,
    color: palette.error,
    fontWeight: typography.weight.medium,
  },
  infoCard: {
    backgroundColor: palette.primaryBg,
    borderColor: palette.primarySoft,
  },
  infoTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.scale.sm,
    color: palette.ink,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalKeyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  modalTitle: {
    fontSize: typography.scale.h3,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  modalClose: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalLabel: {
    fontSize: typography.scale.body,
    color: palette.muted,
  },
  modalValue: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  modalEmpty: {
    fontSize: typography.scale.body,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  modalActions: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  modalNote: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  modalNoteSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: spacing.sm,
  },
  modalNoteLabel: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.medium,
    color: palette.muted,
  },
});
