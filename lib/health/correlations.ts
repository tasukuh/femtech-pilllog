/**
 * 服薬記録 × 健康データの週次相関計算
 *
 * 純粋関数のみ。副作用なし。
 */

import { format, startOfWeek, addDays } from 'date-fns';
import type { DoseRecord, HealthSampleRow } from '../db/schema';

export type WeekBucket = {
  /** その週の月曜日 'yyyy-MM-dd' */
  weekStart: string;
  /** 服薬遵守率 0-100 */
  adherenceRate: number;
  /** 平均睡眠時間（時間）。データなし = null */
  avgSleepHours: number | null;
  /** 平均安静時心拍数（BPM）。データなし = null */
  avgRestingHR: number | null;
};

/**
 * 12 週分の週次バケットを生成する
 *
 * @param doseRecords - 期間内の服薬記録（全ステータス含む）
 * @param healthSamples - health_samples テーブルのデータ
 * @param referenceDate - 基準日（通常 new Date()）
 * @param weeks - 遡る週数（デフォルト 12）
 */
export function buildWeeklyCorrelations(params: {
  doseRecords: DoseRecord[];
  healthSamples: HealthSampleRow[];
  referenceDate: Date;
  weeks?: number;
}): WeekBucket[] {
  const { doseRecords, healthSamples, referenceDate, weeks = 12 } = params;
  const todayStr = format(referenceDate, 'yyyy-MM-dd');

  // 週の開始日（月曜始まり）を weeks 分生成（古い順）
  const weekStarts: Date[] = [];
  const currentWeekMonday = startOfWeek(referenceDate, { weekStartsOn: 1 });
  for (let i = weeks - 1; i >= 0; i--) {
    weekStarts.push(addDays(currentWeekMonday, -i * 7));
  }

  // 日付 → 健康データ のマップを構築
  const sleepByDate = new Map<string, number>();
  const hrByDate = new Map<string, number[]>();

  for (const sample of healthSamples) {
    if (sample.sampleType === 'sleep') {
      sleepByDate.set(sample.date, sample.value);
    } else if (sample.sampleType === 'resting_hr') {
      const existing = hrByDate.get(sample.date) ?? [];
      existing.push(sample.value);
      hrByDate.set(sample.date, existing);
    }
  }

  // 日付 → 服薬記録のマップ
  const doseByDate = new Map<string, DoseRecord[]>();
  for (const record of doseRecords) {
    const existing = doseByDate.get(record.scheduledDate) ?? [];
    existing.push(record);
    doseByDate.set(record.scheduledDate, existing);
  }

  return weekStarts.map((weekMonday) => {
    const weekStart = format(weekMonday, 'yyyy-MM-dd');
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekMonday, i), 'yyyy-MM-dd'));

    // 服薬遵守率（偽薬・未来日を除外）
    let totalDoses = 0;
    let takenDoses = 0;
    for (const day of days) {
      if (day > todayStr) continue;
      const records = doseByDate.get(day) ?? [];
      for (const r of records) {
        if (r.isPlacebo) continue;
        totalDoses++;
        if (r.status === 'taken') takenDoses++;
      }
    }
    const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

    // 平均睡眠時間（時間に変換）
    const sleepValues = days
      .map((d) => sleepByDate.get(d))
      .filter((v): v is number => v !== undefined);
    const avgSleepHours =
      sleepValues.length > 0
        ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length / 60) * 10) / 10
        : null;

    // 平均安静時心拍数
    const hrValues = days.flatMap((d) => hrByDate.get(d) ?? []);
    const avgRestingHR =
      hrValues.length > 0
        ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
        : null;

    return { weekStart, adherenceRate, avgSleepHours, avgRestingHR };
  });
}
