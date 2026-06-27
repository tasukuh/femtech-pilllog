/**
 * HealthKit 権限の要求と状態管理（@kingstinct/react-native-healthkit / New Architecture 対応）
 *
 * iOS 専用。Platform.OS !== 'ios' の場合は全て noop。
 * 権限は Premium 購入後の初回 HealthDashboard 表示時に要求する。
 */

import { Platform } from 'react-native';
import {
  isHealthDataAvailable,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

/** 読み取りを要求する型（睡眠分析・安静時心拍数） */
const READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierRestingHeartRate',
] as const;

/**
 * app_settings に保存する「ヘルスケア接続済み」フラグのキー。
 * HealthKit の read 権限はプライバシー上アプリから照会できないため、
 * ユーザーが一度接続したことをこのフラグで永続化して両画面で共有する。
 */
export const HEALTH_CONNECTED_KEY = 'health_connected';

export type HealthPermissionResult = { granted: boolean; error: string | null };

/**
 * HealthKit の読み取り権限を要求する（iOS の権限ダイアログを表示）。
 * iOS 以外では即座に false を返す。
 */
export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  if (Platform.OS !== 'ios') return { granted: false, error: 'not-ios' };

  try {
    // 読み取り権限はプライバシー上、許可/拒否の区別が取れない。
    // requestAuthorization が成功（=ダイアログ完了）すれば true。
    const granted = await requestAuthorization({ toRead: READ_TYPES });
    console.log('[Health] requestAuthorization:', granted);
    return { granted, error: granted ? null : 'authorization-not-completed' };
  } catch (err: any) {
    console.warn('[Health] Permission request failed:', err);
    return { granted: false, error: err?.message ?? String(err) };
  }
}

/**
 * HealthKit がこの端末で利用可能か確認（iPad 等の非対応端末を除外）。
 */
export async function isHealthKitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}
