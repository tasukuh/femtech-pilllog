/**
 * Premium 判定の単一ソース
 *
 * RevenueCat の entitlement 'premium' を参照して返す。
 * Purchases.configure() は app/_layout.tsx の initialize() で一度だけ呼ぶこと。
 *
 * 無料 / Premium の境界:
 *   - 1行日記を書く・編集          : 無料
 *   - 過去 FREE_HISTORY_DAYS 日の閲覧 : 無料
 *   - それ以前の履歴・メモの閲覧     : Premium
 *   - Appleヘルスケア連携（睡眠・心拍相関グラフ）: Premium
 */

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

/** 無料で遡れる日数（今日を含めず過去 N 日） */
export const FREE_HISTORY_DAYS = 7;

const ENTITLEMENT_ID = 'premium';

/**
 * Premium 加入状態を返すフック。
 * RevenueCat が利用できない環境（Android・シミュレータ等）では false を返す。
 */
export function usePremium(): { isPremium: boolean; isLoading: boolean } {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const listenerRef = useRef<((info: import('react-native-purchases').CustomerInfo) => void) | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const Purchases = (await import('react-native-purchases')).default;
        const customerInfo = await Purchases.getCustomerInfo();
        if (!cancelled) {
          setIsPremium(!!customerInfo.entitlements.active[ENTITLEMENT_ID]);
        }

        const listener = (info: import('react-native-purchases').CustomerInfo) => {
          if (!cancelled) {
            setIsPremium(!!info.entitlements.active[ENTITLEMENT_ID]);
          }
        };
        listenerRef.current = listener;
        Purchases.addCustomerInfoUpdateListener(listener);
      } catch (err) {
        console.warn('[Premium] Could not fetch customer info:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (listenerRef.current) {
        import('react-native-purchases').then(({ default: Purchases }) => {
          if (listenerRef.current) {
            Purchases.removeCustomerInfoUpdateListener(listenerRef.current);
          }
        }).catch(() => {});
      }
    };
  }, []);

  return { isPremium, isLoading };
}

/**
 * その日付が無料の閲覧範囲内か（今日から過去 FREE_HISTORY_DAYS 日以内、または未来）。
 */
export function isWithinFreeWindow(date: Date, now: Date = new Date()): boolean {
  const diff = differenceInCalendarDays(startOfDay(now), startOfDay(date));
  return diff <= FREE_HISTORY_DAYS;
}
