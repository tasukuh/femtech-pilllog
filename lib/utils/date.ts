/**
 * 日付ユーティリティ
 *
 * date-fns のラッパー + アプリ固有ロジック
 */

import {
  format as dateFnsFormat,
  parse,
  addDays as dateFnsAddDays,
  subDays,
  startOfMonth,
  endOfMonth,
  isToday as dateFnsIsToday,
  isPast,
  isFuture,
  differenceInDays,
} from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 日付を 'yyyy-MM-dd' 形式にフォーマット
 */
export function formatDate(date: Date): string {
  return dateFnsFormat(date, 'yyyy-MM-dd');
}

/**
 * 日付を表示用にフォーマット
 * @example '2025年5月17日（土）'
 */
export function formatDateDisplay(date: Date): string {
  return dateFnsFormat(date, 'yyyy年M月d日（E）', { locale: ja });
}

/**
 * 時刻を 'HH:mm' 形式にフォーマット
 */
export function formatTime(date: Date): string {
  return dateFnsFormat(date, 'HH:mm');
}

/**
 * 'yyyy-MM-dd' 文字列から Date に変換
 */
export function parseDate(dateStr: string): Date {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
}

/**
 * 'HH:mm' 文字列から Date に変換（今日の日付で）
 */
export function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * 日付と時刻を結合
 */
export function combineDateAndTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

/**
 * N日後の日付を取得
 */
export function addDays(date: Date, days: number): Date {
  return dateFnsAddDays(date, days);
}

/**
 * 今日かどうか
 */
export function isToday(date: Date): boolean {
  return dateFnsIsToday(date);
}

/**
 * 過去かどうか
 */
export function isPastDate(date: Date): boolean {
  return isPast(date) && !isToday(date);
}

/**
 * 未来かどうか
 */
export function isFutureDate(date: Date): boolean {
  return isFuture(date) && !isToday(date);
}

/**
 * 2つの日付の差分（日数）
 */
export function daysBetween(start: Date, end: Date): number {
  return differenceInDays(end, start);
}

/**
 * 月の最初の日
 */
export function getMonthStart(date: Date): Date {
  return startOfMonth(date);
}

/**
 * 月の最後の日
 */
export function getMonthEnd(date: Date): Date {
  return endOfMonth(date);
}

/**
 * 相対的な日付表示
 * @example '今日', '昨日', '明日', '3日前', '5日後'
 */
export function formatRelativeDate(date: Date): string {
  if (isToday(date)) return '今日';

  const diff = daysBetween(new Date(), date);

  if (diff === -1) return '昨日';
  if (diff === 1) return '明日';
  if (diff < 0) return `${Math.abs(diff)}日前`;
  return `${diff}日後`;
}
