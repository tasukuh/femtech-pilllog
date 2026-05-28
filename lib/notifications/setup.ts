/**
 * Notification permission and scheduling
 *
 * 設計: CALENDAR トリガー + repeats:true で「毎日繰り返す」通知を 4 つセット
 *   - pill-primary       : 服薬時刻ちょうど
 *   - pill-reminder-1    : +5分
 *   - pill-reminder-2    : +30分
 *   - pill-evening       : 22:00（記録がない日のバックアップ）
 *
 * 各通知は固定 identifier を持ち、再スケジュール時は前回分をキャンセル→再生成する。
 *
 * doseRecordId は CALENDAR repeats:true では事前に決められないため通知 data には含めない。
 * ハンドラ側で「今日の dose record」を動的に取得する。
 */

import * as Notifications from 'expo-notifications';

/**
 * 通知識別子（固定）
 *
 * 同じ identifier で scheduleNotificationAsync を呼ぶと既存が置き換わる。
 */
export const NOTIFICATION_IDS = {
  PILL_PRIMARY: 'pill-primary',
  PILL_REMINDER_1: 'pill-reminder-1',
  PILL_REMINDER_2: 'pill-reminder-2',
  PILL_EVENING: 'pill-evening',
} as const;

/**
 * 通知 data の kind フィールド（ハンドラ側で判別）
 */
export type NotificationKind = 'pill-primary' | 'pill-reminder' | 'pill-evening';

/**
 * Request notification permission from iOS
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return false;
    }

    console.log('[Notifications] Permission granted');
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to request permission:', error);
    return false;
  }
}

/**
 * "HH:MM" 形式の文字列を {hour, minute} にパース
 */
function parseHourMinute(time: string): { hour: number; minute: number } {
  const [hStr, mStr] = time.split(':');
  return { hour: parseInt(hStr, 10), minute: parseInt(mStr, 10) };
}

/**
 * 時/分のオフセット計算（時の繰り上がり対応）
 */
function addMinutes(hour: number, minute: number, offsetMin: number): {
  hour: number;
  minute: number;
} {
  const total = hour * 60 + minute + offsetMin;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60,
  };
}

/**
 * 単一の毎日繰り返し通知をスケジュール
 */
async function scheduleDailyCalendar(params: {
  identifier: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  kind: NotificationKind;
  sound: boolean;
  category?: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: params.identifier,
    content: {
      title: params.title,
      body: params.body,
      data: { kind: params.kind },
      categoryIdentifier: params.category,
      sound: params.sound,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: params.hour,
      minute: params.minute,
      repeats: true,
    },
  });
}

/**
 * 毎日繰り返す通知をすべてセットアップ（メインAPI）
 *
 * 服薬時刻、5分後、30分後、夜22時の4種類を毎日繰り返しでスケジュール。
 * 既存の同名通知は自動的に置き換わる。
 *
 * @param primaryTime - 服薬時刻 "HH:MM"
 * @param reminderIntervals - 段階的リマインダーの分数 [5, 30] など（先頭2件まで使用）
 * @param eveningEnabled - 夜の確認通知の有効/無効
 * @param eveningTime - 夜の確認通知の時刻 "HH:MM"（デフォルト "22:00"）
 * @param sound - 通知音 ON/OFF
 */
export async function scheduleDailyReminders(params: {
  primaryTime: string;
  reminderIntervals?: number[];
  eveningEnabled?: boolean;
  eveningTime?: string;
  sound?: boolean;
}): Promise<void> {
  const {
    primaryTime,
    reminderIntervals = [5, 30],
    eveningEnabled = true,
    eveningTime = '22:00',
    sound = true,
  } = params;

  // 古い同名通知を必ず消してから再スケジュール（識別子上書きの挙動差を回避）
  for (const id of Object.values(NOTIFICATION_IDS)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }

  const { hour, minute } = parseHourMinute(primaryTime);

  // 1. 服薬時刻ちょうど
  await scheduleDailyCalendar({
    identifier: NOTIFICATION_IDS.PILL_PRIMARY,
    title: 'おはようございます ☀️',
    body: '今日のピルを忘れずに',
    hour,
    minute,
    kind: 'pill-primary',
    sound,
    category: 'PILL_REMINDER',
  });

  // 2. +N分後（最大2件）
  const intervalIds = [
    NOTIFICATION_IDS.PILL_REMINDER_1,
    NOTIFICATION_IDS.PILL_REMINDER_2,
  ];
  for (let i = 0; i < Math.min(reminderIntervals.length, 2); i++) {
    const offset = reminderIntervals[i];
    const t = addMinutes(hour, minute, offset);
    await scheduleDailyCalendar({
      identifier: intervalIds[i],
      title: 'ピルの時間です ⏰',
      body: 'まだ記録されていません。タップで確認',
      hour: t.hour,
      minute: t.minute,
      kind: 'pill-reminder',
      sound,
      category: 'PILL_REMINDER',
    });
  }
  // 使わない interval ID 分の旧通知を掃除
  for (let i = reminderIntervals.length; i < 2; i++) {
    await Notifications.cancelScheduledNotificationAsync(intervalIds[i]).catch(() => {});
  }

  // 3. 22:00 夜の確認通知
  if (eveningEnabled) {
    const ev = parseHourMinute(eveningTime);
    await scheduleDailyCalendar({
      identifier: NOTIFICATION_IDS.PILL_EVENING,
      title: '今日のピル、記録しましたか？🌙',
      body: 'まだの方はタップして記録',
      hour: ev.hour,
      minute: ev.minute,
      kind: 'pill-evening',
      sound,
      category: 'PILL_REMINDER',
    });
  } else {
    await Notifications.cancelScheduledNotificationAsync(
      NOTIFICATION_IDS.PILL_EVENING
    ).catch(() => {});
  }

  console.log(
    `[Notifications] Daily reminders scheduled: primary=${primaryTime}, intervals=${reminderIntervals}, evening=${eveningEnabled ? eveningTime : 'off'}, sound=${sound}`
  );
}

/**
 * すべての毎日リマインダーをキャンセル
 */
export async function cancelAllDailyReminders(): Promise<void> {
  for (const id of Object.values(NOTIFICATION_IDS)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  console.log('[Notifications] All daily reminders cancelled');
}

/**
 * 毎日リマインダーが現在スケジュール済みかチェック
 *
 * アプリ起動時に「すべて揃っているか」を確認するために使う。
 * フォローアップ通知（PILL_REMINDER_1）も確認する。
 * 服薬記録後にフォローアップがキャンセルされた場合は false になり、
 * 次回起動時に再スケジュールされる。
 *
 * @returns 必要な通知がすべて揃っていれば true
 */
export async function areDailyRemindersScheduled(): Promise<boolean> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ids = new Set(all.map((n) => n.identifier));
  return ids.has(NOTIFICATION_IDS.PILL_PRIMARY) && ids.has(NOTIFICATION_IDS.PILL_REMINDER_1);
}

/**
 * フォローアップリマインダーをキャンセル（服薬記録後に呼ぶ）
 *
 * PILL_REMINDER_1, PILL_REMINDER_2, PILL_EVENING をキャンセルする。
 * PILL_PRIMARY はキャンセルしない（翌日の主通知は維持）。
 * 次回アプリ起動時に areDailyRemindersScheduled() が false を返し、全通知が再スケジュールされる。
 */
export async function cancelFollowUpReminders(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.PILL_REMINDER_1).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.PILL_REMINDER_2).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.PILL_EVENING).catch(() => {});
  console.log('[Notifications] Follow-up reminders cancelled after dose taken');
}

/**
 * 単発の DATE 通知（スヌーズ等）
 *
 * @param scheduledDateTime - 発火する日時
 */
export async function scheduleOneShotReminder(
  scheduledDateTime: Date
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ピルの時間です ⏰',
      body: 'タップで確認',
      data: { kind: 'pill-reminder' satisfies NotificationKind },
      categoryIdentifier: 'PILL_REMINDER',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledDateTime,
    },
  });

  console.log(
    `[Notifications] One-shot reminder ${notificationId} at ${scheduledDateTime.toISOString()}`
  );

  return notificationId;
}

/**
 * すべての予約通知をキャンセル（注意：他の用途の通知も消える）
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Cancelled all scheduled notifications');
  } catch (error) {
    console.error('[Notifications] Failed to cancel all notifications:', error);
    throw error;
  }
}

// ============================================================
// 互換維持: 旧 API（doseRecordId ベース）
// ============================================================
// markDoseAsTaken から呼ばれているため残しているが、CALENDAR 設計では
// 個別 dose 単位のキャンセルは不要（毎日固定 ID で繰り返すため）。
// 念のため doseRecordId を data に持つ DATE 通知のみを掃除する。

export async function cancelScheduledNotificationsForDose(
  doseRecordId: string
): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = all.filter((n) => {
      const data = n.content.data as { doseRecordId?: string };
      return data?.doseRecordId === doseRecordId;
    });

    for (const n of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }

    if (toCancel.length > 0) {
      console.log(
        `[Notifications] Cancelled ${toCancel.length} dose-specific notifications for ${doseRecordId}`
      );
    }
  } catch (error) {
    console.error('[Notifications] Failed to cancel dose notifications:', error);
  }
}

// 旧名互換（誰からも呼ばれていないが import 切替を一括にするため残す）
export const schedulePillReminder = scheduleOneShotReminder;
export const setupGradualReminders = async (
  _doseRecordId: string,
  scheduledTime: Date
): Promise<string[]> => {
  // 旧API: 互換用。新コードからは scheduleDailyReminders を使うこと。
  const hh = scheduledTime.getHours().toString().padStart(2, '0');
  const mm = scheduledTime.getMinutes().toString().padStart(2, '0');
  await scheduleDailyReminders({ primaryTime: `${hh}:${mm}` });
  return [];
};
