/**
 * HealthKit 権限の要求と状態管理
 *
 * iOS 専用。Platform.OS !== 'ios' の場合は全て noop。
 * 権限は Premium 購入後の初回HealthDashboard 表示時に要求する。
 */

import { Platform } from 'react-native';
import type { HealthKitPermissions } from 'react-native-health';

export const HEALTH_PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: ['SleepAnalysis' as any, 'RestingHeartRate' as any],
    write: [],
  },
};

/**
 * app_settings に保存する「ヘルスケア接続済み」フラグのキー。
 * HealthKit の read 権限はプライバシー上アプリから照会できないため、
 * ユーザーが一度接続したことをこのフラグで永続化して両画面で共有する。
 */
export const HEALTH_CONNECTED_KEY = 'health_connected';

/**
 * HealthKit を初期化して権限を要求する。
 * iOS 以外では即座に false を返す。
 */
export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const AppleHealthKit = (await import('react-native-health')).default;
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(HEALTH_PERMISSIONS, (error: string) => {
        if (error) {
          console.warn('[Health] Permission request failed:', error);
          resolve(false);
          return;
        }
        console.log('[Health] HealthKit permissions granted');
        resolve(true);
      });
    });
  } catch (err) {
    console.warn('[Health] HealthKit not available:', err);
    return false;
  }
}

/**
 * HealthKit が利用可能か確認
 */
export async function isHealthKitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  try {
    const AppleHealthKit = (await import('react-native-health')).default;
    return await Promise.race([
      new Promise<boolean>((resolve) => {
        AppleHealthKit.isAvailable((error: Object, available: boolean) => {
          resolve(!error && available);
        });
      }),
      // フォールバック: ネイティブ callback が返らなくても固まらない（iPhone は HealthKit 利用可）
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000)),
    ]);
  } catch {
    return false;
  }
}
