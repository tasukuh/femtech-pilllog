/**
 * Premium 判定の単一ソース
 *
 * 現状 RevenueCat（課金）は未実装のため isPremium は常に false。
 * Phase 2 で RevenueCat を導入する際は、この 1 ファイルだけ差し替えれば
 * アプリ全体のゲートが連動する（各画面に課金ロジックを散らさない）。
 *
 * 無料 / Premium の境界:
 *   - 1行日記を書く・編集          : 無料
 *   - 過去 FREE_HISTORY_DAYS 日の閲覧 : 無料
 *   - それ以前の履歴・メモの閲覧     : Premium
 *   - 気分 × 服薬率のトレンドグラフ  : Premium（Phase 2）
 */

import { differenceInCalendarDays, startOfDay } from 'date-fns';

/** 無料で遡れる日数（今日を含めず過去 N 日） */
export const FREE_HISTORY_DAYS = 7;

/**
 * Premium 加入状態を返すフック。
 *
 * TODO(Phase2): RevenueCat の entitlement を参照して返す。
 */
export function usePremium(): { isPremium: boolean } {
  return { isPremium: false };
}

/**
 * その日付が無料の閲覧範囲内か（今日から過去 FREE_HISTORY_DAYS 日以内、または未来）。
 *
 * 例) 今日が 6/10 のとき、6/3（7日前）までは true、6/2 以前は false。
 * 未来日は負の差分になるため常に true（記録対象として開放）。
 */
export function isWithinFreeWindow(date: Date, now: Date = new Date()): boolean {
  const diff = differenceInCalendarDays(startOfDay(now), startOfDay(date));
  return diff <= FREE_HISTORY_DAYS;
}
