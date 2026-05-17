/**
 * 服薬記録モーダル
 *
 * ホーム画面や履歴画面から開く
 * 過去の遡及記録や時刻指定が必要な時に使用
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Pill, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from '@/lib/toast';
import { formatDateDisplay, formatTime, combineDateAndTime } from '@/lib/utils/date';
import { useMarkDoseTaken } from '@/lib/queries/hooks';

type TimeOption = 'now' | 'scheduled' | 'custom';

export default function DoseLogModal() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // URL params から取得
  const doseRecordId = params.doseRecordId as string;
  const scheduledDate = params.scheduledDate as string; // 'yyyy-MM-dd'
  const scheduledTime = params.scheduledTime as string; // 'HH:mm'
  const medicationName = params.medicationName as string;

  // 状態
  const [selectedOption, setSelectedOption] = useState<TimeOption>('now');
  const [customTime, setCustomTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Mutation
  const markDoseTaken = useMarkDoseTaken();

  const handleClose = () => {
    router.back();
  };

  const handleSelectOption = (option: TimeOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOption(option);
    if (option === 'custom') {
      setShowTimePicker(true);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setCustomTime(selectedDate);
    }
  };

  const handleSubmit = async () => {
    try {
      let takenAt: Date;

      switch (selectedOption) {
        case 'now':
          takenAt = new Date();
          break;
        case 'scheduled':
          takenAt = combineDateAndTime(new Date(scheduledDate), scheduledTime);
          break;
        case 'custom':
          takenAt = combineDateAndTime(new Date(scheduledDate), formatTime(customTime));
          break;
      }

      await markDoseTaken.mutateAsync({
        doseRecordId,
        takenAt,
        via: 'manual',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('服薬を記録しました');
      router.back();
    } catch (error) {
      console.error('[DoseLog] Failed to mark dose:', error);
      toast.error(error, '記録に失敗しました');
    }
  };

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <X size={24} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* タイトル */}
        <View style={styles.titleSection}>
          <View style={styles.iconContainer}>
            <Pill size={48} color={palette.primary} />
          </View>
          <Text style={styles.title}>服薬を記録する</Text>
          <Text style={styles.date}>{formatDateDisplay(new Date(scheduledDate))}</Text>
          <Text style={styles.medication}>{medicationName}</Text>
        </View>

        {/* 時刻選択オプション */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>服薬しましたか？</Text>

          {/* 今すぐ */}
          <Pressable
            style={[
              styles.optionCard,
              selectedOption === 'now' && styles.optionCardSelected,
            ]}
            onPress={() => handleSelectOption('now')}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>今すぐ</Text>
                <Text style={styles.optionSubtitle}>現在時刻で記録</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedOption === 'now' && styles.radioSelected,
                ]}
              >
                {selectedOption === 'now' && <View style={styles.radioDot} />}
              </View>
            </View>
          </Pressable>

          {/* 予定時刻 */}
          <Pressable
            style={[
              styles.optionCard,
              selectedOption === 'scheduled' && styles.optionCardSelected,
            ]}
            onPress={() => handleSelectOption('scheduled')}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>{scheduledTime}</Text>
                <Text style={styles.optionSubtitle}>予定時刻</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedOption === 'scheduled' && styles.radioSelected,
                ]}
              >
                {selectedOption === 'scheduled' && <View style={styles.radioDot} />}
              </View>
            </View>
          </Pressable>

          {/* 時間指定 */}
          <Pressable
            style={[
              styles.optionCard,
              selectedOption === 'custom' && styles.optionCardSelected,
            ]}
            onPress={() => handleSelectOption('custom')}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                <Text style={styles.optionTitle}>時間指定</Text>
                <Text style={styles.optionSubtitle}>
                  {selectedOption === 'custom'
                    ? formatTime(customTime)
                    : '任意の時刻を選択'}
                </Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selectedOption === 'custom' && styles.radioSelected,
                ]}
              >
                {selectedOption === 'custom' && <View style={styles.radioDot} />}
              </View>
            </View>
          </Pressable>
        </View>

        {/* 時刻ピッカー（iOS または Custom選択時） */}
        {(showTimePicker || (selectedOption === 'custom' && Platform.OS === 'ios')) && (
          <View style={styles.timePickerContainer}>
            <DateTimePicker
              value={customTime}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              style={styles.timePicker}
            />
          </View>
        )}

        {/* 確定ボタン */}
        <View style={styles.actionSection}>
          <Button
            onPress={handleSubmit}
            loading={markDoseTaken.isPending}
            disabled={markDoseTaken.isPending}
            fullWidth
          >
            ✓ 服薬済みにする
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    gap: spacing['2xl'],
  },
  titleSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
  },
  date: {
    fontSize: typography.scale.body,
    color: palette.muted,
  },
  medication: {
    fontSize: typography.scale.h3,
    fontWeight: typography.weight.semibold,
    color: palette.primary,
  },
  optionsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  optionCard: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryBg,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  optionSubtitle: {
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: palette.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.primary,
  },
  timePickerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  timePicker: {
    width: '100%',
  },
  actionSection: {
    paddingTop: spacing.lg,
  },
});
