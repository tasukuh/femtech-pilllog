/**
 * Notification permission and scheduling
 *
 * 設計: 日付別 DATE 通知のローリングウィンドウ（今日〜WINDOW_DAYS 日先）
 *   各日について以下を個別の DATE 通知としてスケジュールする:
 *     - pill-primary  : 服薬時刻ちょうど
 *     - pill-reminder : +5分 / +30分
 *     - pill-evening  : 22:00（記録がない日のバックアップ）
 *
 * なぜ repeats:true をやめたか:
 *   CALENDAR repeats:true は「毎日繰り返す 1 個の通知」なので、
 *   服薬後に「今日分だけ」抑制しようとキャンセルするとシリーズ全体が消え、
 *   アプリを再起動するまで通知が一切来なくなる（重大バグ）。
 *   日付別 DATE 通知なら「今日分だけ」キャンセルでき、未来日の通知は残る。
 *
 * 各通知の data には { kind, dateStr } を持たせ、dateStr で「その日の分」を特定する。
 * 起動時・設定変更時にウィンドウを再構築（古い分を全消去→未来分を再生成）する。
 */

import * as Notifications from 'expo-notifications';
import { addDays, format, startOfDay } from 'date-fns';

/**
 * ローリングウィンドウの日数（iOS の保留通知上限 64 を超えないこと）
 * 最大 4 通知/日 × 12 日 = 48 + スヌーズ等 < 64。
 */
const WINDOW_DAYS = 12;

/**
 * 通知 data の kind フィールド（ハンドラ側で判別）
 */
export type NotificationKind = 'pill-primary' | 'pill-reminder' | 'pill-evening';

/**
 * 通知 data の型（日付別 DATE 通知で共通）
 */
interface PillNotificationData {
  kind: NotificationKind;
  dateStr: string; // 対象の服薬日 "yyyy-MM-dd"
  [key: string]: unknown;
}

/**
 * 旧コードとの互換のため identifier 定数を残す（新設計では固定 ID は使わない）。
 * @deprecated 日付別 DATE 通知へ移行済み。data.kind / data.dateStr で判別する。
 */
export const NOTIFICATION_IDS = {
  PILL_PRIMARY: 'pill-primary',
  PILL_REMINDER_1: 'pill-reminder-1',
  PILL_REMINDER_2: 'pill-reminder-2',
  PILL_EVENING: 'pill-evening',
} as const;

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
 * 指定日の "HH:MM" 時刻の Date を生成（ローカルタイムゾーン）
 */
function dateAtTime(day: Date, time: string): Date {
  const { hour, minute } = parseHourMinute(time);
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * ピル通知かどうか（data.kind が pill-* か）を判定
 */
function isPillNotification(
  n: Notifications.NotificationRequest
): n is Notifications.NotificationRequest & {
  content: { data: PillNotificationData };
} {
  const kind = (n.content.data as Partial<PillNotificationData> | undefined)?.kind;
  return kind === 'pill-primary' || kind === 'pill-reminder' || kind === 'pill-evening';
}

/**
 * 単一の DATE 通知をスケジュール（過去時刻はスキップ）
 */
async function scheduleDateNotification(params: {
  title: string;
  body: string;
  fireDate: Date;
  kind: NotificationKind;
  dateStr: string;
  sound: boolean;
  now: Date;
}): Promise<void> {
  // 過去（または現在以前）の時刻はスケジュールしない（iOS が即時発火するため）
  if (params.fireDate.getTime() <= params.now.getTime()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: { kind: params.kind, dateStr: params.dateStr } satisfies PillNotificationData,
      categoryIdentifier: 'PILL_REMINDER',
      sound: params.sound,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.fireDate,
    },
  });
}

/**
 * すべてのピル通知（pill-*）をキャンセル
 */
async function cancelAllPillNotifications(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (isPillNotification(n)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

/**
 * リマインダーのローリングウィンドウを構築（メインAPI）
 *
 * 今日〜WINDOW_DAYS 日先まで、各日の服薬時刻 / +N分 / 22:00 を
 * 個別の DATE 通知としてスケジュールする。古いピル通知は全消去してから再生成する。
 *
 * @param primaryTime - 服薬時刻 "HH:MM"
 * @param reminderIntervals - 段階的リマインダーの分数 [5, 30] など（先頭2件まで使用）
 * @param eveningEnabled - 夜の確認通知の有効/無効
 * @param eveningTime - 夜の確認通知の時刻 "HH:MM"（デフォルト "22:00"）
 * @param sound - 通知音 ON/OFF
 * @param skipToday - 今日分をスケジュールしない（既に服薬済みのとき true）
 */
export async function scheduleDailyReminders(params: {
  primaryTime: string;
  reminderIntervals?: number[];
  eveningEnabled?: boolean;
  eveningTime?: string;
  sound?: boolean;
  skipToday?: boolean;
}): Promise<void> {
  const {
    primaryTime,
    reminderIntervals = [5, 30],
    eveningEnabled = true,
    eveningTime = '22:00',
    sound = true,
    skipToday = false,
  } = params;

  // 古いピル通知を全消去してからウィンドウを再構築
  await cancelAllPillNotifications();

  const now = new Date();
  const intervals = reminderIntervals.slice(0, 2);

  for (let offset = 0; offset < WINDOW_DAYS; offset++) {
    const day = startOfDay(addDays(now, offset));
    const dateStr = format(day, 'yyyy-MM-dd');
    const isToday = offset === 0;

    if (isToday && skipToday) continue;

    // 1. 服薬時刻ちょうど
    const primaryAt = dateAtTime(day, primaryTime);
    await scheduleDateNotification({
      title: 'おはようございます ☀️',
      body: '今日のピルを忘れずに',
      fireDate: primaryAt,
      kind: 'pill-primary',
      dateStr,
      sound,
      now,
    });

    // 2. +N分後（最大2件）— その日の dateStr で紐付け
    for (const offsetMin of intervals) {
      await scheduleDateNotification({
        title: 'ピルの時間です ⏰',
        body: 'まだ記録されていません。タップで確認',
        fireDate: new Date(primaryAt.getTime() + offsetMin * 60 * 1000),
        kind: 'pill-reminder',
        dateStr,
        sound,
        now,
      });
    }

    // 3. 22:00 夜の確認通知
    if (eveningEnabled) {
      await scheduleDateNotification({
        title: '今日のピル、記録しましたか？🌙',
        body: 'まだの方はタップして記録',
        fireDate: dateAtTime(day, eveningTime),
        kind: 'pill-evening',
        dateStr,
        sound,
        now,
      });
    }
  }

  console.log(
    `[Notifications] Rolling window scheduled: primary=${primaryTime}, intervals=${intervals}, evening=${eveningEnabled ? eveningTime : 'off'}, days=${WINDOW_DAYS}, skipToday=${skipToday}, sound=${sound}`
  );
}

/**
 * すべてのピルリマインダーをキャンセル
 */
export async function cancelAllDailyReminders(): Promise<void> {
  await cancelAllPillNotifications();
  console.log('[Notifications] All pill reminders cancelled');
}

/**
 * リマインダーウィンドウが現在スケジュール済みかチェック
 *
 * @returns 未来日のピル通知が 1 件以上あれば true
 */
export async function areDailyRemindersScheduled(): Promise<boolean> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.some(isPillNotification);
}

/**
 * 服薬・スヌーズ後に「今日分」の通知のみキャンセル
 *
 * dateStr が今日のピル通知だけを消す。未来日の通知は残るため、
 * アプリを再起動しなくても翌日以降の通知は届き続ける。
 * （旧設計では全 repeats 通知を消していたため、再起動するまで通知が来なくなっていた）
 */
export async function cancelFollowUpReminders(): Promise<void> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const all = await Notifications.getAllScheduledNotificationsAsync();
  let cancelled = 0;
  for (const n of all) {
    if (isPillNotification(n) && n.content.data.dateStr === todayStr) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      cancelled++;
    }
  }
  console.log(`[Notifications] Cancelled ${cancelled} of today's reminders (future days preserved)`);
}

/**
 * 単発の DATE 通知（スヌーズ等）
 *
 * @param scheduledDateTime - 発火する日時
 */
export async function scheduleOneShotReminder(
  scheduledDateTime: Date
): Promise<string> {
  // 今日の dateStr を付与しておくと、後で服薬したとき cancelFollowUpReminders() で
  // 保留中のスヌーズ通知も一緒に消える。
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ピルの時間です ⏰',
      body: 'タップで確認',
      data: { kind: 'pill-reminder', dateStr: todayStr } satisfies PillNotificationData,
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
