/**
 * Notification system entry point
 *
 * Usage:
 * 1. On app startup:
 *    - registerNotificationCategories()
 *    - configureForegroundNotificationBehavior()
 *    - registerNotificationHandler()
 *    - requestNotificationPermission()
 *
 * 2. When scheduling reminders:
 *    - setupGradualReminders(doseRecordId, scheduledTime)
 *
 * 3. When dose is taken/skipped:
 *    - cancelScheduledNotificationsForDose(doseRecordId)
 */

export { registerNotificationCategories } from './categories';

export {
  requestNotificationPermission,
  schedulePillReminder,
  setupGradualReminders,
  cancelScheduledNotificationsForDose,
  cancelAllScheduledNotifications,
} from './setup';

export {
  registerNotificationHandler,
  configureForegroundNotificationBehavior,
} from './handlers';
