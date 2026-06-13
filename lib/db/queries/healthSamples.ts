/**
 * HealthKit キャッシュ（health_samples）の操作
 *
 * Apple Health から取得したデータのローカルキャッシュ。
 * 健康データは完全ローカル保存（サーバー送信なし）。
 */

import { eq, and, gte, lte } from 'drizzle-orm';
import { format, subHours } from 'date-fns';
import { getDb } from '../index';
import {
  healthSamples,
  type HealthSampleRow,
  type NewHealthSampleRow,
} from '../schema';

/**
 * 期間内のサンプルを取得
 */
export async function getHealthSamplesInRange(
  sampleType: 'sleep' | 'resting_hr',
  startDate: Date,
  endDate: Date
): Promise<HealthSampleRow[]> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');
  const db = getDb();

  return db
    .select()
    .from(healthSamples)
    .where(
      and(
        eq(healthSamples.sampleType, sampleType),
        gte(healthSamples.date, start),
        lte(healthSamples.date, end)
      )
    )
    .orderBy(healthSamples.date)
    .all();
}

/**
 * 特定タイプのキャッシュが 24 時間以内か確認
 * 最新 fetchedAt が TTL 以内なら true
 */
export async function isCacheFresh(
  sampleType: 'sleep' | 'resting_hr',
  referenceDate: Date = new Date()
): Promise<boolean> {
  const db = getDb();
  const ttlThreshold = subHours(referenceDate, 24).toISOString();

  const result = await db
    .select({ fetchedAt: healthSamples.fetchedAt })
    .from(healthSamples)
    .where(eq(healthSamples.sampleType, sampleType))
    .orderBy(healthSamples.fetchedAt)
    .limit(1)
    .all();

  if (result.length === 0) return false;
  return result[0].fetchedAt > ttlThreshold;
}

/**
 * 期間のサンプルを upsert（既存削除 → 一括 INSERT）
 */
export async function upsertHealthSamples(
  sampleType: 'sleep' | 'resting_hr',
  startDate: Date,
  endDate: Date,
  samples: NewHealthSampleRow[]
): Promise<void> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');
  const db = getDb();

  await db
    .delete(healthSamples)
    .where(
      and(
        eq(healthSamples.sampleType, sampleType),
        gte(healthSamples.date, start),
        lte(healthSamples.date, end)
      )
    );

  if (samples.length === 0) return;

  await db.insert(healthSamples).values(samples);
}

/**
 * 90 日超の古いキャッシュを削除
 */
export async function pruneOldHealthSamples(): Promise<void> {
  const cutoff = format(subDays(new Date(), 90), 'yyyy-MM-dd');
  const db = getDb();

  await db
    .delete(healthSamples)
    .where(lte(healthSamples.date, cutoff));
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}
