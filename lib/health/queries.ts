/**
 * HealthKit 相関データの取得関数（TanStack Query 用）
 *
 * キャッシュ鮮度チェック → HealthKit 再取得 → DB → 相関計算
 */

import { Platform } from 'react-native';
import { subDays } from 'date-fns';
import { getDoseRecordsInRange } from '../db/queries/doseRecords';
import { getHealthSamplesInRange, isCacheFresh } from '../db/queries/healthSamples';
import { syncSleepSamples, syncRestingHeartRate } from './sync';
import { buildWeeklyCorrelations, type WeekBucket } from './correlations';

const WEEKS = 12;

export async function fetchCorrelationData(sheetId: string): Promise<WeekBucket[]> {
  if (Platform.OS !== 'ios') return [];

  const now = new Date();
  const startDate = subDays(now, WEEKS * 7);

  // キャッシュが古ければ HealthKit から再取得
  const [sleepFresh, hrFresh] = await Promise.all([
    isCacheFresh('sleep'),
    isCacheFresh('resting_hr'),
  ]);

  await Promise.all([
    sleepFresh ? Promise.resolve() : syncSleepSamples(WEEKS),
    hrFresh ? Promise.resolve() : syncRestingHeartRate(WEEKS),
  ]);

  // DB から期間データを取得
  const [doseRecords, healthSamples] = await Promise.all([
    getDoseRecordsInRange(sheetId, startDate, now),
    Promise.all([
      getHealthSamplesInRange('sleep', startDate, now),
      getHealthSamplesInRange('resting_hr', startDate, now),
    ]).then(([sleep, hr]) => [...sleep, ...hr]),
  ]);

  return buildWeeklyCorrelations({ doseRecords, healthSamples, referenceDate: now, weeks: WEEKS });
}
