/**
 * 通知設定の操作
 *
 * notification_settings は常に1レコードのみ存在
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { notificationSettings, type NotificationSettings } from '../schema';

/**
 * 通知設定を取得
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = getDb();
  const result = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, 1))
    .limit(1);

  if (!result[0]) {
    // デフォルト設定を返す（マイグレーションで作成されるはず）
    throw new Error('Notification settings not found. Run migrations first.');
  }

  return result[0];
}

/**
 * 通知設定を更新
 */
export async function updateNotificationSettings(
  updates: Partial<Omit<NotificationSettings, 'id' | 'updatedAt'>>
): Promise<void> {
  const db = getDb();

  await db
    .update(notificationSettings)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(notificationSettings.id, 1));

  console.log('[NotificationSettings] Updated:', updates);
}

/**
 * 服薬時刻を更新
 */
export async function updatePrimaryTime(time: string): Promise<void> {
  await updateNotificationSettings({ primaryTime: time });
}

/**
 * リマインダー間隔を更新
 */
export async function updateReminderIntervals(intervals: number[]): Promise<void> {
  await updateNotificationSettings({
    reminderIntervalsJson: JSON.stringify(intervals),
  });
}

/**
 * 夜の確認通知を有効/無効化
 */
export async function toggleEveningReminder(enabled: boolean): Promise<void> {
  await updateNotificationSettings({ eveningReminderEnabled: enabled });
}

/**
 * 通知音を有効/無効化
 */
export async function toggleSound(enabled: boolean): Promise<void> {
  await updateNotificationSettings({ soundEnabled: enabled });
}

/**
 * リマインダー間隔を配列としてパース
 */
export function parseReminderIntervals(settings: NotificationSettings): number[] {
  try {
    return JSON.parse(settings.reminderIntervalsJson);
  } catch {
    return [5, 30]; // デフォルト
  }
}
