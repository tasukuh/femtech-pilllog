/**
 * アプリ設定のクエリ
 *
 * app_settings テーブル（key-value store）へのアクセス
 */

import { getDb } from '../index';
import { appSettings } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * 設定値を取得
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  return results[0]?.value ?? null;
}

/**
 * 設定値を保存（upsert）
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();

  // SQLiteにはUPSERTがあるが、Drizzleでは明示的に実装
  const existing = await getSetting(key);

  if (existing !== null) {
    await db
      .update(appSettings)
      .set({ value })
      .where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value });
  }

  console.log(`[AppSettings] Set ${key} = ${value}`);
}

/**
 * 設定値を削除
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = getDb();
  await db.delete(appSettings).where(eq(appSettings.key, key));
  console.log(`[AppSettings] Deleted ${key}`);
}

/**
 * オンボーディング完了状態を取得
 */
export async function getOnboardingStatus(): Promise<boolean> {
  const value = await getSetting('has_completed_onboarding');
  return value === 'true';
}

/**
 * オンボーディング完了状態を保存
 */
export async function setOnboardingStatus(completed: boolean): Promise<void> {
  await setSetting('has_completed_onboarding', completed ? 'true' : 'false');
}
