/**
 * オンボーディング画面の共通コンテナ
 *
 * - プログレス表示
 * - 戻るボタン
 * - 統一されたレイアウト
 */

import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette, typography, spacing, radius } from '@/design-tokens';

type OnboardingContainerProps = {
  children: React.ReactNode;
  step: number;
  totalSteps: number;
  showBack?: boolean;
};

export function OnboardingContainer({
  children,
  step,
  totalSteps,
  showBack = true,
}: OnboardingContainerProps) {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {showBack && (
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={16}
            accessibilityLabel="戻る"
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color={palette.ink} />
          </Pressable>
        )}

        <View style={styles.progressWrapper}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.backButtonPlaceholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  progressWrapper: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'center',
  },
  progressDot: {
    width: 32,
    height: 4,
    backgroundColor: palette.border,
    borderRadius: radius.sm,
  },
  progressDotActive: {
    backgroundColor: palette.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
});
