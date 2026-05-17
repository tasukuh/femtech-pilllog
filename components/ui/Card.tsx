/**
 * カードコンポーネント
 *
 * 白背景・角丸12pxのコンテナ
 */

import { View, StyleSheet, ViewStyle } from 'react-native';
import { palette, spacing, radius, shadow } from '@/design-tokens';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
  withShadow?: boolean;
};

export function Card({
  children,
  style,
  noPadding = false,
  withShadow = false,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        !noPadding && styles.withPadding,
        withShadow && shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  withPadding: {
    padding: spacing.lg,
  },
});
