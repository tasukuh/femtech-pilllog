/**
 * オンボーディング - 服薬時刻設定画面
 *
 * タイムピッカーで服薬時刻を設定
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { OnboardingContainer } from '@/components/ui/OnboardingContainer';
import { Button } from '@/components/ui/Button';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { format } from 'date-fns';

export default function ScheduleTimeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // デフォルトは朝8時
  const [selectedTime, setSelectedTime] = useState(new Date(2000, 0, 1, 8, 0));
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const handleTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (date) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedTime(date);
    }
  };

  const handleShowPicker = () => {
    if (Platform.OS === 'android') {
      setShowPicker(true);
    }
  };

  const handleNext = () => {
    const timeString = format(selectedTime, 'HH:mm');

    router.push({
      pathname: '/(onboarding)/current-status',
      params: {
        ...params,
        scheduledTime: timeString,
      },
    });
  };

  const timeDisplay = format(selectedTime, 'HH:mm');
  const timeLabel = selectedTime.getHours() < 12 ? '毎朝' : selectedTime.getHours() < 18 ? '毎日' : '毎晩';

  return (
    <OnboardingContainer step={3} totalSteps={5}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>服薬時刻はいつですか？</Text>
          <Text style={styles.subtitle}>
            毎日この時間に通知でお知らせします
          </Text>

          {/* Time display */}
          <Pressable
            style={styles.timeDisplay}
            onPress={handleShowPicker}
            accessibilityLabel="時刻を変更"
            accessibilityRole="button"
          >
            <Text style={styles.timeLabel}>{timeLabel}</Text>
            <Text style={styles.timeValue}>{timeDisplay}</Text>
          </Pressable>

          {/* iOS inline picker */}
          {Platform.OS === 'ios' && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                locale="ja-JP"
                style={styles.picker}
              />
            </View>
          )}

          {/* Android modal picker */}
          {Platform.OS === 'android' && showPicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
              is24Hour={true}
            />
          )}

          <Text style={styles.hint}>
            飲み忘れを防ぐため、毎日確実に対応できる時間を選びましょう
          </Text>
        </View>

        {/* CTA */}
        <View style={styles.buttonContainer}>
          <Button onPress={handleNext} fullWidth>
            次へ
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
  },
  subtitle: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    marginBottom: spacing['2xl'],
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  timeDisplay: {
    backgroundColor: palette.cardBg,
    borderWidth: 2,
    borderColor: palette.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timeLabel: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.medium,
    color: palette.muted,
    marginBottom: spacing.xs,
  },
  timeValue: {
    fontSize: 48,
    fontWeight: typography.weight.bold,
    color: palette.primary,
    fontVariant: ['tabular-nums'],
  },
  pickerContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  picker: {
    width: '100%',
    height: 200,
  },
  hint: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: typography.scale.xs * typography.lineHeight.normal,
    marginTop: spacing.md,
  },
  buttonContainer: {
    marginBottom: spacing.xl,
  },
});
