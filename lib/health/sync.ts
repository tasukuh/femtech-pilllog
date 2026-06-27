/**
 * HealthKit データの読み取り（@kingstinct/react-native-healthkit / New Architecture 対応）
 *
 * 読み取り: 睡眠時間・安静時心拍数 → ローカル DB に保存
 *
 * NOTE: 服薬記録の HealthKit への書き込み（避妊法カテゴリ）は将来対応。
 */

import { Platform } from 'react-native';
import { format, subDays } from 'date-fns';
import {
  queryCategorySamples,
  queryQuantitySamples,
} from '@kingstinct/react-native-healthkit';
import { upsertHealthSamples } from '../db/queries/healthSamples';
import type { NewHealthSampleRow } from '../db/schema';

// HKCategoryValueSleepAnalysis: 0=inBed, 1=asleep(legacy), 2=awake, 3=core, 4=deep, 5=REM
// 実際の睡眠区間のみ集計（inBed と awake を除外）
const SLEEP_VALUES = new Set<number>([1, 3, 4, 5]);

/**
 * 過去 N 週の睡眠データを HealthKit から取得してキャッシュに保存
 */
export async function syncSleepSamples(weeks: number = 12): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const endDate = new Date();
    const startDate = subDays(endDate, weeks * 7);

    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0, // 全件
      filter: { date: { startDate, endDate } },
    });

    // 実際の睡眠区間のみフィルタ
    const sleepSamples = samples.filter((s) => SLEEP_VALUES.has(s.value as number));

    // 日付ごとに合計分数を計算
    const byDate = new Map<string, number>();
    for (const s of sleepSamples) {
      const date = format(s.startDate, 'yyyy-MM-dd');
      const durationMins = Math.round((s.endDate.getTime() - s.startDate.getTime()) / 60000);
      byDate.set(date, (byDate.get(date) ?? 0) + durationMins);
    }

    const rows: NewHealthSampleRow[] = Array.from(byDate.entries()).map(([date, minutes]) => ({
      id: `sleep-${date}`,
      sampleType: 'sleep' as const,
      date,
      value: minutes,
      sourceStartAt: `${date}T00:00:00.000Z`,
      sourceEndAt: `${date}T23:59:59.000Z`,
    }));

    await upsertHealthSamples('sleep', startDate, endDate, rows);
    console.log(`[Health] Synced ${rows.length} sleep day entries`);
  } catch (err) {
    console.warn('[Health] Sleep sync failed:', err);
  }
}

/**
 * 過去 N 週の安静時心拍数を HealthKit から取得してキャッシュに保存
 */
export async function syncRestingHeartRate(weeks: number = 12): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const endDate = new Date();
    const startDate = subDays(endDate, weeks * 7);

    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      limit: 0, // 全件
      ascending: true,
      filter: { date: { startDate, endDate } },
    });

    const rows: NewHealthSampleRow[] = samples.map((s) => ({
      id: s.uuid ?? `rhr-${s.startDate.toISOString()}`,
      sampleType: 'resting_hr' as const,
      date: format(s.startDate, 'yyyy-MM-dd'),
      value: Math.round(s.quantity),
      sourceStartAt: s.startDate.toISOString(),
      sourceEndAt: s.endDate.toISOString(),
    }));

    await upsertHealthSamples('resting_hr', startDate, endDate, rows);
    console.log(`[Health] Synced ${rows.length} resting HR entries`);
  } catch (err) {
    console.warn('[Health] Resting HR sync failed:', err);
  }
}
