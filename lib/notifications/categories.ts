/**
 * iOS notification categories for pill reminders
 *
 * MUST be called once on app startup before scheduling any notifications.
 */

import * as Notifications from 'expo-notifications';

/**
 * Register notification categories with action buttons
 *
 * PILL_REMINDER category includes:
 * - TAKE_NOW: Mark dose as taken without opening app
 * - SNOOZE_30: Reschedule reminder for 30 minutes later
 *
 * CRITICAL: opensAppToForeground must be false for lock screen actions to work
 */
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('PILL_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '今飲む',
        options: {
          opensAppToForeground: false,
          isDestructive: false,
        },
      },
      {
        identifier: 'SNOOZE_30',
        buttonTitle: '⏰ 30分後に再通知',
        options: {
          opensAppToForeground: false,
          isDestructive: false,
        },
      },
    ]);

    console.log('[Notifications] Categories registered successfully');
  } catch (error) {
    console.error('[Notifications] Failed to register categories:', error);
    throw error;
  }
}
