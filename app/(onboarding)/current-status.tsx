/**
 * オンボーディング - 現在の状況設定画面
 *
 * 新しいシートを始めるか、すでに服用中かを選択
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OnboardingContainer } from '@/components/ui/OnboardingContainer';
import { Button } from '@/components/ui/Button';
import { palette, typography, spacing, radius } from '@/design-tokens';

type StatusOption = 'new' | 'ongoing';

export default function CurrentStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [selectedStatus, setSelectedStatus] = useState<StatusOption>('new');
  const [currentDay, setCurrentDay] = useState(1);

  const handleStatusSelect = (status: StatusOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStatus(status);
  };

  const handleDayChange = (increment: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDay((prev) => Math.max(1, Math.min(28, prev + increment)));
  };

  const handleNext = () => {
    router.push({
      pathname: '/(onboarding)/notification-permission',
      params: {
        ...params,
        sheetStatus: selectedStatus,
        currentDay: currentDay.toString(),
      },
    });
  };

  return (
    <OnboardingContainer step={4} totalSteps={5}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>今のシートの状況は？</Text>
        <Text style={styles.subtitle}>
          正確な記録のため、現在の状況を教えてください
        </Text>

        <View style={styles.optionsContainer}>
          {/* 新しいシート */}
          <Pressable
            style={[
              styles.optionCard,
              selectedStatus === 'new' && styles.optionCardSelected,
            ]}
            onPress={() => handleStatusSelect('new')}
            accessibilityLabel="今日から新しいシートを始める"
            accessibilityRole="button"
          >
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectedStatus === 'new' && styles.optionTitleSelected,
                ]}
              >
                今日から新しいシートを始める
              </Text>
              <Text style={styles.optionDescription}>
                今日が1日目として記録されます
              </Text>
            </View>
          </Pressable>

          {/* すでに服用中 */}
          <Pressable
            style={[
              styles.optionCard,
              selectedStatus === 'ongoing' && styles.optionCardSelected,
            ]}
            onPress={() => handleStatusSelect('ongoing')}
            accessibilityLabel="すでに服用中です"
            accessibilityRole="button"
          >
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectedStatus === 'ongoing' && styles.optionTitleSelected,
                ]}
              >
                すでに服用中です
              </Text>
              <Text style={styles.optionDescription}>
                現在何日目かを選択してください
              </Text>
            </View>
          </Pressable>

          {/* Day picker (when ongoing) */}
          {selectedStatus === 'ongoing' && (
            <View style={styles.dayPickerContainer}>
              <Text style={styles.dayPickerLabel}>今日は何日目ですか？</Text>
              <View style={styles.dayPicker}>
                <Pressable
                  style={styles.dayButton}
                  onPress={() => handleDayChange(-1)}
                  disabled={currentDay <= 1}
                  accessibilityLabel="日数を減らす"
                  accessibilityRole="button"
                >
                  <Text style={styles.dayButtonText}>−</Text>
                </Pressable>

                <View style={styles.dayDisplay}>
                  <Text style={styles.dayValue}>{currentDay}</Text>
                  <Text style={styles.dayUnit}>日目</Text>
                </View>

                <Pressable
                  style={styles.dayButton}
                  onPress={() => handleDayChange(1)}
                  disabled={currentDay >= 28}
                  accessibilityLabel="日数を増やす"
                  accessibilityRole="button"
                >
                  <Text style={styles.dayButtonText}>＋</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button onPress={handleNext} fullWidth>
            次へ
          </Button>
        </View>
      </ScrollView>
    </OnboardingContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing['2xl'],
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
    marginBottom: spacing.xl,
    lineHeight: typography.scale.sm * typography.lineHeight.normal,
  },
  optionsContainer: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  optionCard: {
    backgroundColor: palette.cardBg,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryBg,
  },
  optionContent: {
    gap: spacing.xs,
  },
  optionTitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: palette.ink,
  },
  optionTitleSelected: {
    color: palette.primary,
  },
  optionDescription: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.regular,
    color: palette.muted,
  },
  dayPickerContainer: {
    backgroundColor: palette.cardBg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  dayPickerLabel: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.medium,
    color: palette.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  dayPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: '#FFFFFF',
  },
  dayDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  dayValue: {
    fontSize: 48,
    fontWeight: typography.weight.bold,
    color: palette.primary,
    fontVariant: ['tabular-nums'],
  },
  dayUnit: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.medium,
    color: palette.muted,
  },
  buttonContainer: {
    marginTop: 'auto',
  },
});
