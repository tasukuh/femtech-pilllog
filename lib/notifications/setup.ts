/**
 * Notification permission and scheduling
 *
 * Core functions:
 * - Request iOS notification permission
 * - Schedule single/gradual reminders
 * - Cancel scheduled notifications
 */

import * as Notifications from 'expo-notifications';

/**
 * Request notification permission from iOS
 *
 * MUST be called before scheduling any notifications.
 * Returns true if permission granted, false otherwise.
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
 * Schedule a single pill reminder notification
 *
 * @param doseRecordId - Dose record ID to include in notification data
 * @param scheduledDateTime - When to trigger the notification
 * @returns Notification identifier (for cancellation)
 */
export async function schedulePillReminder(
  doseRecordId: string,
  scheduledDateTime: Date
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'おはようございます ☀️',
        body: '今日のピルを忘れずに',
        data: { doseRecordId },
        categoryIdentifier: 'PILL_REMINDER',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDateTime,
      },
    });

    console.log(
      `[Notifications] Scheduled reminder ${notificationId} for dose ${doseRecordId} at ${scheduledDateTime.toISOString()}`
    );

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to schedule reminder:', error);
    throw error;
  }
}

/**
 * Setup gradual reminders (3-stage: 0min, 30min, 60min)
 *
 * This is the primary scheduling function for pill reminders.
 * If user doesn't respond to first notification, they'll receive follow-ups.
 *
 * @param doseRecordId - Dose record ID
 * @param scheduledTime - Base scheduled time (first notification)
 * @returns Array of notification identifiers
 */
export async function setupGradualReminders(
  doseRecordId: string,
  scheduledTime: Date
): Promise<string[]> {
  const intervals = [0, 30, 60]; // minutes
  const notificationIds: string[] = [];

  for (const minutes of intervals) {
    const triggerTime = new Date(scheduledTime.getTime() + minutes * 60000);

    // Skip if trigger time is in the past
    if (triggerTime.getTime() < Date.now()) {
      console.log(
        `[Notifications] Skipping past trigger time: ${triggerTime.toISOString()}`
      );
      continue;
    }

    const id = await schedulePillReminder(doseRecordId, triggerTime);
    notificationIds.push(id);
  }

  console.log(
    `[Notifications] Setup ${notificationIds.length} gradual reminders for dose ${doseRecordId}`
  );

  return notificationIds;
}

/**
 * Cancel all scheduled notifications for a specific dose
 *
 * Should be called when:
 * - User marks dose as taken
 * - User skips the dose
 * - Dose schedule is changed
 *
 * @param doseRecordId - Dose record ID
 */
export async function cancelScheduledNotificationsForDose(
  doseRecordId: string
): Promise<void> {
  try {
    // Get all scheduled notifications
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();

    // Filter notifications for this dose record
    const notificationsToCancel = scheduledNotifications.filter(
      (notification) => {
        const data = notification.content.data as { doseRecordId?: string };
        return data.doseRecordId === doseRecordId;
      }
    );

    // Cancel each matching notification
    for (const notification of notificationsToCancel) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }

    console.log(
      `[Notifications] Cancelled ${notificationsToCancel.length} notifications for dose ${doseRecordId}`
    );
  } catch (error) {
    console.error('[Notifications] Failed to cancel notifications:', error);
    throw error;
  }
}

/**
 * Cancel all scheduled notifications
 *
 * Use with caution - this removes ALL pending notifications for the app.
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
