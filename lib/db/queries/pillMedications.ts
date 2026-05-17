/**
 * ピル種類の CRUD 操作
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { pillMedications, type PillMedication, type NewPillMedication } from '../schema';

/**
 * アクティブなピルを取得
 * ユーザーは通常1種類のピルしか服用しないため、is_active=true の最初の1件を返す
 */
export async function getActiveMedication(): Promise<PillMedication | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(pillMedications)
    .where(eq(pillMedications.isActive, true))
    .limit(1);

  return result[0] ?? null;
}

/**
 * ピルをIDで取得
 */
export async function getPillMedicationById(id: string): Promise<PillMedication | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(pillMedications)
    .where(eq(pillMedications.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * 全てのピルを取得（Premium: 複数ピル管理）
 */
export async function getAllMedications(): Promise<PillMedication[]> {
  const db = getDb();
  return db.select().from(pillMedications).all();
}

/**
 * 新しいピルを登録
 */
export async function createMedication(data: NewPillMedication): Promise<PillMedication> {
  const db = getDb();
  const id = data.id || generateId();

  await db.insert(pillMedications).values({
    ...data,
    id,
  });

  const created = await getPillMedicationById(id);
  if (!created) {
    throw new Error('Failed to create medication');
  }

  return created;
}

/**
 * ピル情報を更新
 */
export async function updateMedication(
  id: string,
  data: Partial<Omit<NewPillMedication, 'id'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(pillMedications)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(pillMedications.id, id));
}

/**
 * ピルを削除
 */
export async function deleteMedication(id: string): Promise<void> {
  const db = getDb();
  await db.delete(pillMedications).where(eq(pillMedications.id, id));
}

/**
 * ピルを非アクティブ化（削除せず履歴保持）
 */
export async function deactivateMedication(id: string): Promise<void> {
  await updateMedication(id, { isActive: false });
}

/**
 * 簡易ID生成（timestamp + random）
 */
function generateId(): string {
  return `pill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
