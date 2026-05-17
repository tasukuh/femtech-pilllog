/**
 * オンボーディング - Welcome画面
 *
 * アプリの価値提案を3点で伝える
 */

import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { OnboardingContainer } from '@/components/ui/OnboardingContainer';
import { Button } from '@/components/ui/Button';
import { palette, typography, spacing } from '@/design-tokens';

const VALUE_PROPS = [
  '1タップで記録',
  '通知から直接アクション',
  'プライバシー第一',
];

export default function WelcomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/(onboarding)/pill-selection');
  };

  return (
    <OnboardingContainer step={1} totalSteps={5} showBack={false}>
      <View style={styles.container}>
        {/* Hero section */}
        <View style={styles.hero}>
          <Text style={styles.title}>ピルログ</Text>
          <Text style={styles.subtitle}>ピル服薬記録に特化したアプリ</Text>
        </View>

        {/* Value propositions */}
        <View style={styles.valuePropsContainer}>
          {VALUE_PROPS.map((prop, index) => (
            <View key={index} style={styles.valueProp}>
              <View style={styles.checkIcon}>
                <Check size={20} color={palette.primary} strokeWidth={3} />
              </View>
              <Text style={styles.valuePropText}>{prop}</Text>
            </View>
          ))}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA */}
        <Button onPress={handleStart} fullWidth>
          はじめる
        </Button>

        {/* Legal */}
        <Text style={styles.legal}>
          続けることで、利用規約とプライバシーポリシーに同意したものとみなされます
        </Text>
      </View>
    </OnboardingContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  hero: {
    marginTop: spacing['4xl'],
    alignItems: 'center',
  },
  title: {
    fontSize: typography.scale.h1,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    textAlign: 'center',
  },
  valuePropsContainer: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropText: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.medium,
    color: palette.ink,
  },
  spacer: {
    flex: 1,
  },
  legal: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.regular,
    color: palette.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
