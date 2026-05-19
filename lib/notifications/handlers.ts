/**
 * Notification response handlers
 *
 * Handles user actions on notifications (TAKE_NOW, SNOOZE_30)
 */

import * as Notifications from 'expo-notifications';
import { markDoseAsTaken } from '@/lib/db/queries/doseRecords';
import { schedulePillReminder, cancelScheduledNotificationsForDose } from './setup';
import { queryClient } from '@/lib/queries/client';

/**
 * Register notification response handler
 *
 * This listens for user actions on notifications and handles them accordingly:
 * - TAKE_NOW: Mark dose as taken without opening app
 * - SNOOZE_30: Schedule another reminder 30 minutes later
 *
 * MUST be called once on app startup (after registerNotificationCategories).
 *
 * @returns Unsubscribe function to remove the listener
 */
export function registerNotificationHandler(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      try {
        const { actionIdentifier, notification } = response;
        const { doseRecordId } = notification.request.content.data as {
          doseRecordId: string;
        };

        if (!doseRecordId) {
          console.error('[Notifications] No doseRecordId in notification data');
          return;
        }

        console.log(
          `[Notifications] Received action: ${actionIdentifier} for dose ${doseRecordId}`
        );

        if (actionIdentifier === 'TAKE_NOW') {
          // Mark dose as taken via notification
          await markDoseAsTaken(doseRecordId, new Date(), 'notification');

          // Cancel any remaining scheduled notifications for this dose
          await cancelScheduledNotificationsForDose(doseRecordId);

          // Invalidate all dose-related queries to update UI
          await queryClient.invalidateQueries({ queryKey: ['dose'] });
          await queryClient.invalidateQueries({ queryKey: ['doseRecords'] });
          await queryClient.invalidateQueries({ queryKey: ['sheet'] });
          await queryClient.invalidateQueries({ queryKey: ['currentSheet'] });
          await queryClient.invalidateQueries({ queryKey: ['monthStats'] });

          console.log(
            `[Notifications] Dose ${doseRecordId} marked as taken from notification`
          );

          // TODO: Show success toast (when app is in foreground)
          // showToast('success', '服薬を記録しました');
        } else if (actionIdentifier === 'SNOOZE_30') {
          // Schedule reminder 30 minutes from now
          const snoozeTime = new Date(Date.now() + 30 * 60 * 1000);
          await schedulePillReminder(doseRecordId, snoozeTime);

          console.log(
            `[Notifications] Snoozed dose ${doseRecordId} until ${snoozeTime.toISOString()}`
          );

          // TODO: Show snooze confirmation (when app is in foreground)
          // showToast('info', '30分後に再通知します');
        } else if (
          actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
        ) {
          // User tapped notification body (not an action button)
          // This opens the app - no special handling needed
          console.log(
            `[Notifications] User opened app from notification for dose ${doseRecordId}`
          );
        }
      } catch (error) {
        console.error('[Notifications] Error handling notification response:', error);
      }
    }
  );

  console.log('[Notifications] Handler registered');

  // Return unsubscribe function
  return () => {
    subscription.remove();
    console.log('[Notifications] Handler unregistered');
  };
}

/**
 * Configure notification behavior when app is in foreground
 *
 * By default, notifications don't show when app is open.
 * This configures them to show with sound and badge.
 *
 * Call this once on app startup.
 */
export function configureForegroundNotificationBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  console.log('[Notifications] Foreground behavior configured');
}
