/**
 * エラー表示
 *
 * エラー状態を統一的に表示するコンポーネント
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { palette, typography, spacing, radius } from '@/design-tokens';

type ErrorDisplayProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  backUrl?: string;
};

export function ErrorDisplay({
  title = 'エラーが発生しました',
  message,
  onRetry,
  backUrl = '/',
}: ErrorDisplayProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.actions}>
        {onRetry && (
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={onRetry}
          >
            <Text style={styles.primaryButtonText}>もう一度試す</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.replace(backUrl as Href)}
        >
          <Text style={styles.secondaryButtonText}>ホームに戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    backgroundColor: palette.cream,
  },
  title: {
    fontSize: typography.scale.h2,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.scale.body,
    color: palette.muted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    lineHeight: typography.scale.body * typography.lineHeight.normal,
  },
  actions: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 300,
  },
  button: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: palette.primary,
  },
  primaryButtonText: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.semibold,
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    fontSize: typography.scale.body,
    fontWeight: typography.weight.medium,
    color: palette.ink,
  },
});
