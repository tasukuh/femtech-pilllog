/**
 * Notification response handlers
 *
 * 設計: CALENDAR repeats:true 設計に対応し、kind ベースで判別する。
 *   - TAKE_NOW: 今日の dose record を動的に取得して taken にする
 *   - SNOOZE_30: 30分後の DATE 通知を追加
 */

import * as Notifications from 'expo-notifications';
import { markDoseAsTaken, getTodaysDoseRecord } from '@/lib/db/queries/doseRecords';
import { getActiveMedication } from '@/lib/db/queries/pillMedications';
import { getCurrentSheet } from '@/lib/db/queries/sheets';
import { scheduleOneShotReminder, cancelFollowUpReminders } from './setup';
import { queryClient } from '@/lib/queries/client';

/**
 * 今日の dose record を取得（ピル → アクティブシート → 今日のレコード）
 */
async function resolveTodaysDoseRecordId(): Promise<string | null> {
  try {
    const medication = await getActiveMedication();
    if (!medication) {
      console.log('[Notifications] No active medication');
      return null;
    }
    const sheet = await getCurrentSheet(medication.id);
    if (!sheet) {
      console.log('[Notifications] No current sheet');
      return null;
    }
    const dose = await getTodaysDoseRecord(sheet.id);
    return dose?.id ?? null;
  } catch (error) {
    console.error('[Notifications] Failed to resolve today\'s dose:', error);
    return null;
  }
}

/**
 * 通知レスポンスハンドラを登録
 *
 * MUST be called once on app startup (after registerNotificationCategories).
 *
 * @returns Unsubscribe function
 */
export function registerNotificationHandler(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      try {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data as {
          kind?: string;
          doseRecordId?: string;
        };

        console.log(
          `[Notifications] Received action: ${actionIdentifier}, kind: ${data?.kind ?? 'unknown'}`
        );

        if (actionIdentifier === 'TAKE_NOW') {
          // 旧 DATE 通知由来なら data.doseRecordId、CALENDAR 由来ならその場で解決
          const doseRecordId = data?.doseRecordId ?? (await resolveTodaysDoseRecordId());
          if (!doseRecordId) {
            console.warn('[Notifications] TAKE_NOW: no dose record found for today');
            return;
          }

          await markDoseAsTaken(doseRecordId, new Date(), 'notification');

          await queryClient.invalidateQueries({ queryKey: ['dose'] });
          await queryClient.invalidateQueries({ queryKey: ['doseRecords'] });
          await queryClient.invalidateQueries({ queryKey: ['sheet'] });
          await queryClient.invalidateQueries({ queryKey: ['currentSheet'] });
          await queryClient.invalidateQueries({ queryKey: ['monthStats'] });

          console.log(`[Notifications] Dose ${doseRecordId} marked as taken from notification`);
        } else if (actionIdentifier === 'SNOOZE_30') {
          // 今日分の通知（+5分・+30分・夜）をキャンセルしてから 30 分後の単発通知を登録。
          // 未来日の通知は残るので翌日以降は通常どおり届く。
          await cancelFollowUpReminders();
          const snoozeTime = new Date(Date.now() + 30 * 60 * 1000);
          await scheduleOneShotReminder(snoozeTime);
          console.log(`[Notifications] Snoozed until ${snoozeTime.toISOString()}`);
        } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('[Notifications] User opened app from notification');
        }
      } catch (error) {
        console.error('[Notifications] Error handling notification response:', error);
      }
    }
  );

  console.log('[Notifications] Handler registered');

  return () => {
    subscription.remove();
    console.log('[Notifications] Handler unregistered');
  };
}

/**
 * フォアグラウンド時の通知表示挙動を設定
 *
 * 加えて、kind に応じて「すでに服薬済みなら通知を抑制」する。
 *  - pill-reminder / pill-evening: 今日のレコードが taken なら表示しない
 *  - pill-primary: 必ず表示
 */
export function configureForegroundNotificationBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { kind?: string };

      // 通知抑制が必要な kind（服薬済みなら主通知も含めて抑制）
      if (
        data?.kind === 'pill-primary' ||
        data?.kind === 'pill-reminder' ||
        data?.kind === 'pill-evening'
      ) {
        try {
          const medication = await getActiveMedication();
          const sheet = medication ? await getCurrentSheet(medication.id) : null;
          const dose = sheet ? await getTodaysDoseRecord(sheet.id) : null;

          if (dose?.status === 'taken') {
            console.log(`[Notifications] Suppressed ${data.kind} — already taken`);
            return {
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }
        } catch (error) {
          console.error('[Notifications] Suppression check failed:', error);
        }
      }

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  console.log('[Notifications] Foreground behavior configured');
}
