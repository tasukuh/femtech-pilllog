/**
 * カレンダーグリッドコンポーネント
 *
 * 月次カレンダービューで服薬記録を表示
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { Lock } from 'lucide-react-native';
import { palette, typography, spacing, radius } from '@/design-tokens';
import { formatDate } from '@/lib/utils/date';
import type { DoseRecord } from '@/lib/db/schema';

type CalendarGridProps = {
  month: Date;
  records: DoseRecord[];
  onDateTap?: (date: Date) => void;
  /** Free版で閲覧できない日付か判定する関数 */
  isDateLocked?: (date: Date) => boolean;
};

type DayStatus = 'taken' | 'missed' | 'placebo' | 'future' | 'none';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

export function CalendarGrid({ month, records, onDateTap, isDateLocked }: CalendarGridProps) {
  // 月の最初と最後の日
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // カレンダー表示用に週の開始・終了を含める
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // 月曜始まり
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // カレンダーの全日付を取得
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // 記録をMapに変換（日付文字列 -> DoseRecord）
  const recordsMap = new Map<string, DoseRecord>();
  records.forEach((record) => {
    recordsMap.set(record.scheduledDate, record);
  });

  // 日付のステータスを取得
  const getDateStatus = (date: Date): DayStatus => {
    const dateStr = formatDate(date);
    const record = recordsMap.get(dateStr);

    if (!record) return 'none';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate > today) return 'future';

    if (record.isPlacebo) return 'placebo';

    switch (record.status) {
      case 'taken':
        return 'taken';
      case 'missed':
        return 'missed';
      default:
        return 'none';
    }
  };

  // ステータスに応じたアイコンと色を取得
  const getStatusDisplay = (status: DayStatus) => {
    switch (status) {
      case 'taken':
        return { icon: '✓', color: palette.success };
      case 'missed':
        return { icon: '✗', color: palette.error };
      case 'placebo':
        return { icon: '●', color: palette.gray400 };
      case 'future':
        return { icon: '?', color: palette.gray300 };
      default:
        return { icon: '', color: palette.gray200 };
    }
  };

  const handleDatePress = (date: Date) => {
    if (!isSameMonth(date, month)) return; // 他の月の日付はタップ不可
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDateTap?.(date);
  };

  // 週ごとに分割
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      {/* 曜日ヘッダー */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* 日付グリッド */}
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date) => {
            const isCurrentMonth = isSameMonth(date, month);
            const isToday = isSameDay(date, new Date());
            const locked = isCurrentMonth && !!isDateLocked?.(date);
            const status = getDateStatus(date);
            const { icon, color } = getStatusDisplay(status);

            return (
              <Pressable
                key={date.toISOString()}
                style={({ pressed }) => [
                  styles.dayCell,
                  isToday && styles.todayCell,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleDatePress(date)}
                disabled={!isCurrentMonth}
                accessibilityLabel={`${format(date, 'M月d日', { locale: ja })}、${locked ? 'Premium限定' : `ステータス: ${status}`}`}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.dayNumber,
                    !isCurrentMonth && styles.otherMonthText,
                    isToday && styles.todayText,
                    locked && styles.lockedText,
                  ]}
                >
                  {format(date, 'd')}
                </Text>
                {isCurrentMonth && (
                  locked
                    ? <Lock size={10} color={palette.gray300} />
                    : icon && <Text style={[styles.statusIcon, { color }]}>{icon}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  weekdayText: {
    fontSize: typography.scale.xs,
    fontWeight: typography.weight.semibold,
    color: palette.muted,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  todayCell: {
    backgroundColor: palette.primaryBg,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  dayNumber: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.medium,
    color: palette.ink,
    marginBottom: spacing.xs,
  },
  otherMonthText: {
    color: palette.gray300,
  },
  lockedText: {
    color: palette.gray300,
  },
  todayText: {
    color: palette.primary,
    fontWeight: typography.weight.bold,
  },
  statusIcon: {
    fontSize: typography.scale.sm,
    fontWeight: typography.weight.bold,
  },
});
