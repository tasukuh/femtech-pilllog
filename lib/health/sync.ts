/**
 * HealthKit データの読み書き
 *
 * 読み取り: 睡眠時間・安静時心拍数 → ローカル DB に保存
 *
 * NOTE: react-native-health v1.x は HKCategoryTypeIdentifierContraceptive への
 * 書き込み（saveContraceptive）をサポートしていない。
 * 将来的にカスタム Expo Module で対応予定。
 */

import { Platform } from 'react-native';
import { format, subDays } from 'date-fns';
import type { HealthValue } from 'react-native-health';
import { upsertHealthSamples } from '../db/queries/healthSamples';
import type { NewHealthSampleRow } from '../db/schema';

// iOS 16以降の sleep analysis 値
// 0 = inBed, 1 = asleep (legacy), 2 = awakeInBed, 3 = asleepCore, 4 = asleepDeep, 5 = asleepREM
const SLEEP_VALUES = new Set([1, 3, 4, 5]);

/**
 * 過去 N 週の睡眠データを HealthKit から取得してキャッシュに保存
 */
export async function syncSleepSamples(weeks: number = 12): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const AppleHealthKit = (await import('react-native-health')).default;
    const endDate = new Date();
    const startDate = subDays(endDate, weeks * 7);

    const rawSamples = await new Promise<HealthValue[]>((resolve, reject) => {
      AppleHealthKit.getSleepSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 0,
        },
        (err: string, results: HealthValue[]) => {
          if (err) reject(new Error(err));
          else resolve(results ?? []);
        }
      );
    });

    // 実際の睡眠区間のみフィルタ（inBed と awakeInBed を除外）
    const sleepSamples = rawSamples.filter((s) => SLEEP_VALUES.has(s.value));

    // 日付ごとに分計算して NewHealthSampleRow に変換
    const byDate = new Map<string, number>();
    for (const s of sleepSamples) {
      const date = format(new Date(s.startDate), 'yyyy-MM-dd');
      const durationMins = Math.round(
        (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000
      );
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
    const AppleHealthKit = (await import('react-native-health')).default;
    const endDate = new Date();
    const startDate = subDays(endDate, weeks * 7);

    const rawSamples = await new Promise<HealthValue[]>((resolve, reject) => {
      AppleHealthKit.getRestingHeartRateSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 0,
          ascending: true,
        },
        (err: string, results: HealthValue[]) => {
          if (err) reject(new Error(err));
          else resolve(results ?? []);
        }
      );
    });

    const rows: NewHealthSampleRow[] = rawSamples.map((s) => ({
      id: s.id ?? `rhr-${s.startDate}`,
      sampleType: 'resting_hr' as const,
      date: format(new Date(s.startDate), 'yyyy-MM-dd'),
      value: Math.round(s.value),
      sourceStartAt: s.startDate,
      sourceEndAt: s.endDate,
    }));

    await upsertHealthSamples('resting_hr', startDate, endDate, rows);
    console.log(`[Health] Synced ${rows.length} resting HR entries`);
  } catch (err) {
    console.warn('[Health] Resting HR sync failed:', err);
  }
}
