/**
 * シート管理
 *
 * 最重要機能: initializeSheet()
 * シート開始時に全予定日分の dose_records を 'scheduled' で先行作成
 */

import { eq, and, desc, isNull } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { getDb } from '../index';
import { sheets, type Sheet, type NewSheet } from '../schema';
import { createDoseRecord } from './doseRecords';
import { getPillMedicationById } from './pillMedications';

/**
 * 現在のシートを取得（未完了のもの）
 */
export async function getCurrentSheet(medicationId: string): Promise<Sheet | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(sheets)
    .where(
      and(
        eq(sheets.pillMedicationId, medicationId),
        isNull(sheets.completedAt)
      )
    )
    .orderBy(desc(sheets.startedAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * シートをIDで取得
 */
export async function getSheetById(id: string): Promise<Sheet | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(sheets)
    .where(eq(sheets.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * 特定のピルの全シート履歴を取得
 */
export async function getSheetHistory(medicationId: string): Promise<Sheet[]> {
  const db = getDb();
  return db
    .select()
    .from(sheets)
    .where(eq(sheets.pillMedicationId, medicationId))
    .orderBy(desc(sheets.startedAt))
    .all();
}

/**
 * 次のシート番号を取得
 */
export async function getNextSheetNumber(medicationId: string): Promise<number> {
  const history = await getSheetHistory(medicationId);
  if (history.length === 0) return 1;

  const maxNumber = Math.max(...history.map(s => s.sheetNumber));
  return maxNumber + 1;
}

/**
 * 新しいシートを初期化
 *
 * 【最重要ロジック】
 * - シートレコードを作成
 * - そのシート期間分の全 dose_records を 'scheduled' で先行作成
 *
 * @param medicationId - ピルID
 * @param startDate - シート開始日
 */
export async function initializeSheet(
  medicationId: string,
  startDate: Date
): Promise<Sheet> {
  // ピル情報を取得
  const medication = await getPillMedicationById(medicationId);
  if (!medication) {
    throw new Error(`Medication not found: ${medicationId}`);
  }

  // シートパターンをパース
  const pattern = JSON.parse(medication.sheetPatternJson) as {
    active: number;
    placebo?: number;
    max?: number; // ヤーズフレックス等の可変長
  };

  // 総日数を計算
  const totalDays = pattern.max
    ? pattern.max // 可変長の場合は最大日数
    : pattern.active + (pattern.placebo ?? 0);

  // シート番号を決定
  const sheetNumber = await getNextSheetNumber(medicationId);

  // シートレコードを作成
  const sheetId = generateId();
  const db = getDb();
  await db.insert(sheets).values({
    id: sheetId,
    pillMedicationId: medicationId,
    sheetNumber,
    startedAt: format(startDate, 'yyyy-MM-dd'),
  });

  console.log(`[Sheets] Initialized sheet #${sheetNumber} with ${totalDays} days`);

  // 全日分の dose_records を先行作成
  for (let day = 0; day < totalDays; day++) {
    const date = addDays(startDate, day);
    const isPlacebo = day >= pattern.active; // active期間を超えたら偽薬

    await createDoseRecord({
      id: generateId(),
      sheetId,
      scheduledDate: format(date, 'yyyy-MM-dd'),
      scheduledTime: medication.scheduledTime,
      status: 'scheduled',
      pillDayNumber: day + 1,
      isPlacebo,
    });
  }

  const created = await getSheetById(sheetId);
  if (!created) {
    throw new Error('Failed to create sheet');
  }

  return created;
}

/**
 * シートを完了としてマーク
 */
export async function markSheetCompleted(sheetId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sheets)
    .set({
      completedAt: new Date().toISOString(),
    })
    .where(eq(sheets.id, sheetId));

  console.log(`[Sheets] Marked sheet ${sheetId} as completed`);
}

/**
 * 簡易ID生成
 */
function generateId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
