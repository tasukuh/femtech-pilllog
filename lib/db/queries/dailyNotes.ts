/**
 * 1行日記（daily_notes）の操作
 *
 * 「その日のひとこと」を 1 日 1 件で保存する。健康データは完全ローカル。
 * date（"yyyy-MM-dd"）を一意キーとして upsert する。
 */

import { eq, and, gte, lte } from 'drizzle-orm';
import { format } from 'date-fns';
import { getDb } from '../index';
import { dailyNotes, type DailyNote } from '../schema';

/** メモの最大文字数（1行日記なので短く） */
export const DAILY_NOTE_MAX_LENGTH = 100;

/**
 * 簡易ID生成（timestamp + random）
 */
function generateId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 指定日の日記を取得（なければ null）
 */
export async function getDailyNote(date: Date): Promise<DailyNote | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const db = getDb();
  const result = await db
    .select()
    .from(dailyNotes)
    .where(eq(dailyNotes.date, dateStr))
    .limit(1);

  return result[0] ?? null;
}

/**
 * 期間内の日記を取得（カレンダー・トレンド用）
 */
export async function getDailyNotesInRange(
  startDate: Date,
  endDate: Date
): Promise<DailyNote[]> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  const db = getDb();
  return db
    .select()
    .from(dailyNotes)
    .where(and(gte(dailyNotes.date, start), lte(dailyNotes.date, end)))
    .orderBy(dailyNotes.date)
    .all();
}

/**
 * 日記を保存（upsert）
 *
 * note が空文字なら該当日のレコードを削除する（空メモを残さない）。
 * mood は将来のトレンドグラフ用（現状UIなし）。
 *
 * @param date - 対象日
 * @param note - ひとこと（前後の空白は呼び出し側でtrim想定）
 * @param mood - 気分スコア 1-5（任意）
 */
export async function upsertDailyNote(
  date: Date,
  note: string,
  mood?: number | null
): Promise<void> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const db = getDb();
  const trimmed = note.trim().slice(0, DAILY_NOTE_MAX_LENGTH);

  const existing = await getDailyNote(date);

  // 空メモ かつ 気分未設定ならレコードを残さない
  if (trimmed.length === 0 && (mood === undefined || mood === null)) {
    if (existing) {
      await db.delete(dailyNotes).where(eq(dailyNotes.date, dateStr));
      console.log(`[DailyNotes] Deleted empty note for ${dateStr}`);
    }
    return;
  }

  if (existing) {
    await db
      .update(dailyNotes)
      .set({
        note: trimmed,
        // mood は明示指定があるときだけ更新（既存値を消さない）
        ...(mood !== undefined ? { mood } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(dailyNotes.date, dateStr));
    console.log(`[DailyNotes] Updated note for ${dateStr}`);
  } else {
    await db.insert(dailyNotes).values({
      id: generateId(),
      date: dateStr,
      note: trimmed,
      mood: mood ?? null,
    });
    console.log(`[DailyNotes] Created note for ${dateStr}`);
  }
}

/**
 * 指定日の日記を削除
 */
export async function deleteDailyNote(date: Date): Promise<void> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const db = getDb();
  await db.delete(dailyNotes).where(eq(dailyNotes.date, dateStr));
  console.log(`[DailyNotes] Deleted note for ${dateStr}`);
}
