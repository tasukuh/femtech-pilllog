/**
 * シート進捗リングコンポーネント
 *
 * 円形のプログレスリングで現在のシート状況を表示
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { palette, typography, spacing, animation } from '@/design-tokens';

type SheetProgressRingProps = {
  currentDay: number;
  totalDays: number;
  sheetNumber: number;
  daysUntilBreak: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 180;
const STROKE_WIDTH = 12;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SheetProgressRing({
  currentDay,
  totalDays,
  sheetNumber,
  daysUntilBreak,
}: SheetProgressRingProps) {
  const router = useRouter();

  const progress = useSharedValue(0);

  // 初回マウント時にアニメーション実行
  React.useEffect(() => {
    progress.value = withSpring(currentDay / totalDays, {
      damping: animation.spring.damping,
      stiffness: animation.spring.stiffness,
    });
  }, [currentDay, totalDays]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/history');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityLabel={`シート${sheetNumber}枚目、${currentDay}日目、次の休薬期間まで${daysUntilBreak}日`}
      accessibilityRole="button"
    >
      <View style={styles.ringWrapper}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* 背景の円 */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={palette.gray200}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* プログレス円 */}
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={palette.primary}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>

        {/* 中央のテキスト */}
        <View style={styles.centerText}>
          <Text style={styles.dayCount}>
            {currentDay} / {totalDays}
          </Text>
          <Text style={styles.sheetLabel}>シート{sheetNumber}枚目</Text>
          <Text style={styles.breakLabel}>
            次の休薬期間まで {daysUntilBreak}日
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  ringWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCount: {
    fontSize: typography.scale.h1,
    fontWeight: typography.weight.bold,
    color: palette.ink,
    fontFamily: typography.mono,
  },
  sheetLabel: {
    fontSize: typography.scale.sm,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  breakLabel: {
    fontSize: typography.scale.xs,
    color: palette.muted,
    marginTop: spacing.xs,
  },
});
