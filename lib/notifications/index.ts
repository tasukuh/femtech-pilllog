/**
 * Notification system entry point
 *
 * 起動時の初期化順:
 *   1. registerNotificationCategories()
 *   2. configureForegroundNotificationBehavior()
 *   3. registerNotificationHandler()
 *   4. requestNotificationPermission()
 *   5. ensureDailyReminders()  ← 起動時の再スケジュール
 *
 * 通知設定が変わったとき:
 *   - scheduleDailyReminders({ primaryTime, reminderIntervals, eveningEnabled, eveningTime, sound })
 *
 * 全消去:
 *   - cancelAllDailyReminders()
 */

export { registerNotificationCategories } from './categories';

export {
  requestNotificationPermission,
  scheduleDailyReminders,
  cancelAllDailyReminders,
  areDailyRemindersScheduled,
  cancelFollowUpReminders,
  scheduleOneShotReminder,
  cancelAllScheduledNotifications,
  cancelScheduledNotificationsForDose,
  // 旧 API 互換
  schedulePillReminder,
  setupGradualReminders,
  NOTIFICATION_IDS,
} from './setup';

export {
  registerNotificationHandler,
  configureForegroundNotificationBehavior,
} from './handlers';
