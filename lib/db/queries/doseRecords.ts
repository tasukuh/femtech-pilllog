/**
 * 服薬記録の操作
 *
 * 最頻アクション: markDoseAsTaken()
 */

import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { format, startOfDay, endOfDay } from 'date-fns';
import { getDb } from '../index';
import { doseRecords, type DoseRecord, type NewDoseRecord } from '../schema';
import { cancelScheduledNotificationsForDose } from '../notifications';

/**
 * 今日の服薬記録を取得
 */
export async function getTodaysDoseRecord(sheetId: string): Promise<DoseRecord | null> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const db = getDb();
  const result = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.sheetId, sheetId),
        eq(doseRecords.scheduledDate, today)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * 特定日の服薬記録を取得
 */
export async function getDoseRecordByDate(
  sheetId: string,
  date: Date
): Promise<DoseRecord | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const db = getDb();
  const result = await db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.sheetId, sheetId),
        eq(doseRecords.scheduledDate, dateStr)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * IDで服薬記録を取得
 */
export async function getDoseRecordById(id: string): Promise<DoseRecord | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(doseRecords)
    .where(eq(doseRecords.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * シートの全服薬記録を取得
 */
export async function getDoseRecordsBySheet(sheetId: string): Promise<DoseRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(doseRecords)
    .where(eq(doseRecords.sheetId, sheetId))
    .orderBy(doseRecords.scheduledDate)
    .all();
}

/**
 * 期間内の服薬記録を取得
 */
export async function getDoseRecordsInRange(
  sheetId: string,
  startDate: Date,
  endDate: Date
): Promise<DoseRecord[]> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  const db = getDb();
  return db
    .select()
    .from(doseRecords)
    .where(
      and(
        eq(doseRecords.sheetId, sheetId),
        gte(doseRecords.scheduledDate, start),
        lte(doseRecords.scheduledDate, end)
      )
    )
    .orderBy(doseRecords.scheduledDate)
    .all();
}

/**
 * 服薬記録を作成（シート初期化時に使用）
 */
export async function createDoseRecord(data: NewDoseRecord): Promise<void> {
  const db = getDb();
  await db.insert(doseRecords).values(data);
}

/**
 * 服薬を記録する（最頻アクション）
 *
 * @param doseRecordId - 記録ID
 * @param takenAt - 服薬時刻（省略時は現在時刻）
 * @param via - 記録経路（app / notification / manual）
 */
export async function markDoseAsTaken(
  doseRecordId: string,
  takenAt: Date = new Date(),
  via: 'app' | 'notification' | 'manual' = 'app'
): Promise<void> {
  const db = getDb();

  await db
    .update(doseRecords)
    .set({
      status: 'taken',
      actualTakenAt: takenAt.toISOString(),
      takenVia: via,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(doseRecords.id, doseRecordId));

  console.log(`[DoseRecords] Marked ${doseRecordId} as taken via ${via}`);

  // Cancel any remaining scheduled notifications for this dose
  await cancelScheduledNotificationsForDose(doseRecordId);

  // TODO: PostHogイベント送信（内容は記録しない）
  // analytics.capture('dose_recorded', { via });
}

/**
 * 服薬記録を飲み忘れとしてマーク
 */
export async function markDoseAsMissed(doseRecordId: string): Promise<void> {
  const db = getDb();

  await db
    .update(doseRecords)
    .set({
      status: 'missed',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(doseRecords.id, doseRecordId));

  console.log(`[DoseRecords] Marked ${doseRecordId} as missed`);
}

/**
 * 服薬記録をスキップとしてマーク（意図的に飲まなかった）
 */
export async function markDoseAsSkipped(doseRecordId: string): Promise<void> {
  const db = getDb();

  await db
    .update(doseRecords)
    .set({
      status: 'skipped',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(doseRecords.id, doseRecordId));

  console.log(`[DoseRecords] Marked ${doseRecordId} as skipped`);

  // Cancel any remaining scheduled notifications for this dose
  await cancelScheduledNotificationsForDose(doseRecordId);
}

/**
 * 服薬記録を取り消す（scheduled に戻す）
 */
export async function undoDoseRecord(doseRecordId: string): Promise<void> {
  const db = getDb();

  await db
    .update(doseRecords)
    .set({
      status: 'scheduled',
      actualTakenAt: null,
      takenVia: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(doseRecords.id, doseRecordId));

  console.log(`[DoseRecords] Undid ${doseRecordId}`);
}

/**
 * 服薬達成率を計算
 */
export async function calculateAdherenceRate(
  sheetId: string,
  startDate: Date,
  endDate: Date
): Promise<{ total: number; taken: number; rate: number }> {
  const records = await getDoseRecordsInRange(sheetId, startDate, endDate);

  // 未来の予定と偽薬を除外
  const now = new Date();
  const relevant = records.filter(
    r => new Date(r.scheduledDate) <= now && !r.isPlacebo
  );

  const total = relevant.length;
  const taken = relevant.filter(r => r.status === 'taken').length;
  const rate = total > 0 ? (taken / total) * 100 : 0;

  return { total, taken, rate };
}

/**
 * 飲み忘れ回数を取得
 */
export async function getMissedCount(
  sheetId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const records = await getDoseRecordsInRange(sheetId, startDate, endDate);
  return records.filter(r => r.status === 'missed').length;
}
