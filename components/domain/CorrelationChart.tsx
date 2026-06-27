/**
 * 服薬日数 × 睡眠 × 安静時心拍の 12 週 SVG チャート
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { palette, typography, spacing } from '@/design-tokens';
import type { WeekBucket } from '@/lib/health/correlations';

type Props = {
  data: WeekBucket[];
};

const CHART_HEIGHT = 160;
const BAR_MAX = 100;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 8;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 24;

export function CorrelationChart({ data }: Props) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2 - PADDING_LEFT - PADDING_RIGHT;
  const drawWidth = chartWidth;
  const drawHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const barWidth = useMemo(() => drawWidth / data.length * 0.6, [drawWidth, data.length]);
  const barGap = useMemo(() => drawWidth / data.length, [drawWidth, data.length]);

  // 正規化ヘルパー
  const normY = (value: number, min: number, max: number) => {
    if (max === min) return drawHeight / 2;
    return drawHeight - ((value - min) / (max - min)) * drawHeight;
  };

  // 睡眠と心拍のスケール計算
  const sleepValues = data.map((d) => d.avgSleepHours).filter((v): v is number => v !== null);
  const hrValues = data.map((d) => d.avgRestingHR).filter((v): v is number => v !== null);

  const sleepMin = sleepValues.length > 0 ? Math.max(0, Math.min(...sleepValues) - 1) : 0;
  const sleepMax = sleepValues.length > 0 ? Math.max(...sleepValues) + 1 : 10;
  const hrMin = hrValues.length > 0 ? Math.max(40, Math.min(...hrValues) - 5) : 50;
  const hrMax = hrValues.length > 0 ? Math.max(...hrValues) + 5 : 100;

  // ポリライン座標生成
  const sleepPoints = data
    .map((d, i) => {
      if (d.avgSleepHours === null) return null;
      const x = PADDING_LEFT + i * barGap + barGap / 2;
      const y = PADDING_TOP + normY(d.avgSleepHours, sleepMin, sleepMax);
      return { x, y, value: d.avgSleepHours };
    })
    .filter((p): p is { x: number; y: number; value: number } => p !== null);

  const hrPoints = data
    .map((d, i) => {
      if (d.avgRestingHR === null) return null;
      const x = PADDING_LEFT + i * barGap + barGap / 2;
      const y = PADDING_TOP + normY(d.avgRestingHR, hrMin, hrMax);
      return { x, y, value: d.avgRestingHR };
    })
    .filter((p): p is { x: number; y: number; value: number } => p !== null);

  const totalWidth = PADDING_LEFT + drawWidth + PADDING_RIGHT;
  const totalHeight = CHART_HEIGHT;

  return (
    <View accessibilityLabel="服薬日数と健康データの12週間グラフ">
      <Svg width={totalWidth} height={totalHeight}>
        {/* グリッドライン */}
        {[0, 50, 100].map((pct) => {
          const y = PADDING_TOP + drawHeight - (pct / 100) * drawHeight;
          return (
            <Line
              key={pct}
              x1={PADDING_LEFT}
              y1={y}
              x2={PADDING_LEFT + drawWidth}
              y2={y}
              stroke={palette.border}
              strokeWidth={1}
            />
          );
        })}

        {/* Y軸ラベル（服薬日数: 0日・4日・7日） */}
        {([0, 50, 100] as const).map((pct) => {
          const y = PADDING_TOP + drawHeight - (pct / 100) * drawHeight;
          const label = pct === 0 ? '0' : pct === 50 ? '4日' : '7日';
          return (
            <SvgText
              key={pct}
              x={PADDING_LEFT - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={8}
              fill={palette.muted}
            >
              {label}
            </SvgText>
          );
        })}

        {/* 服薬遵守率 棒グラフ */}
        {data.map((d, i) => {
          const barH = (d.adherenceRate / BAR_MAX) * drawHeight;
          const x = PADDING_LEFT + i * barGap + (barGap - barWidth) / 2;
          const y = PADDING_TOP + drawHeight - barH;
          const isLow = d.adherenceRate < 70;
          return (
            <Rect
              key={d.weekStart}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, 1)}
              fill={isLow ? palette.error : palette.primary}
              opacity={0.7}
              rx={2}
            />
          );
        })}

        {/* 睡眠折れ線 */}
        {sleepPoints.length >= 2 && (
          <Polyline
            points={sleepPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={palette.success}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {sleepPoints.map((p, i) => (
          <Circle key={`s${i}`} cx={p.x} cy={p.y} r={3} fill={palette.success} />
        ))}

        {/* 心拍折れ線 */}
        {hrPoints.length >= 2 && (
          <Polyline
            points={hrPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={palette.warning}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {hrPoints.map((p, i) => (
          <Circle key={`h${i}`} cx={p.x} cy={p.y} r={3} fill={palette.warning} />
        ))}

        {/* X軸: 3週ごとにラベル表示 */}
        {data.map((d, i) => {
          if (i % 3 !== 0) return null;
          const x = PADDING_LEFT + i * barGap + barGap / 2;
          const label = format(parseISO(d.weekStart), 'M/d', { locale: ja });
          return (
            <SvgText
              key={d.weekStart}
              x={x}
              y={totalHeight - 4}
              textAnchor="middle"
              fontSize={8}
              fill={palette.muted}
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* 凡例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.primary }]} />
          <Text style={styles.legendText}>服薬日数 (/週)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
          <Text style={styles.legendText}>睡眠 (h)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.warning }]} />
          <Text style={styles.legendText}>安静時心拍 (bpm)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.scale.xs,
    color: palette.muted,
  },
});
