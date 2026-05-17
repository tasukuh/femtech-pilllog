/**
 * ローディングスピナー
 *
 * ActivityIndicator のラッパー
 */

import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { palette, typography, spacing } from '@/design-tokens';

type LoadingSpinnerProps = {
  size?: 'small' | 'large';
  message?: string;
  fullScreen?: boolean;
};

export function LoadingSpinner({
  size = 'large',
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={palette.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  message: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    textAlign: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
  },
});
