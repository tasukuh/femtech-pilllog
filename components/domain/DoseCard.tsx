/**
 * 服薬カードコンポーネント
 *
 * 薬の表示と服薬記録のためのカード
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { palette, typography, spacing, radius, shadow } from '@/design-tokens';
import { formatTime, parseTime } from '@/lib/utils/date';
import type { PillMedication, DoseRecord } from '@/lib/db/schema';

type DoseCardProps = {
  medication: PillMedication;
  doseRecord: DoseRecord;
  onTap: () => void;
};

export function DoseCard({ medication, doseRecord, onTap }: DoseCardProps) {
  const isTaken = doseRecord.status === 'taken';
  const scheduledTime = doseRecord.scheduledTime;
  const takenTime = doseRecord.actualTakenAt
    ? formatTime(new Date(doseRecord.actualTakenAt))
    : null;

  const handlePress = () => {
    if (isTaken) return; // 服薬済みの場合はタップ不可
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isTaken && styles.containerTaken,
        !isTaken && pressed && styles.pressed,
      ]}
      onPress={handlePress}
      disabled={isTaken}
      accessibilityLabel={
        isTaken
          ? `${medication.name}、服薬済み、${takenTime}に服薬`
          : `${medication.name}、未服薬、予定時刻${scheduledTime}`
      }
      accessibilityRole="button"
    >
      <View style={styles.content}>
        {/* 左側: 薬情報 */}
        <View style={styles.medicationInfo}>
          <View style={styles.pillIndicator}>
            {medication.color && (
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: medication.color },
                ]}
              />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.medicationName}>{medication.name}</Text>
            <Text style={styles.time}>
              {isTaken ? `${takenTime}に服薬` : `予定: ${scheduledTime}`}
            </Text>
          </View>
        </View>

        {/* 右側: ステータス */}
        <View style={styles.statusContainer}>
          {isTaken ? (
            <View style={styles.checkContainer}>
              <Check size={24} color={palette.success} strokeWidth={3} />
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <Text style={styles.buttonText}>服薬する</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.sm,
  },
  containerTaken: {
    backgroundColor: palette.gray50,
    borderColor: palette.gray200,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medicationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pillIndicator: {
    marginRight: spacing.md,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textContainer: {
    flex: 1,
  },
  medicationName: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: typography.scale.sm,
    color: palette.muted,
  },
  statusContainer: {
    marginLeft: spacing.md,
  },
  checkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.semibold,
    color: '#FFFFFF',
  },
});
