/**
 * バリデーション関数
 */

/**
 * 時刻文字列が 'HH:mm' 形式かどうか
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * 日付文字列が 'yyyy-MM-dd' 形式かどうか
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * シートパターンJSONが正しい形式かどうか
 */
export function isValidSheetPattern(json: string): boolean {
  try {
    const pattern = JSON.parse(json);
    return (
      typeof pattern === 'object' &&
      typeof pattern.active === 'number' &&
      pattern.active > 0 &&
      (pattern.placebo === undefined || typeof pattern.placebo === 'number') &&
      (pattern.max === undefined || typeof pattern.max === 'number')
    );
  } catch {
    return false;
  }
}

/**
 * 空文字列・null・undefinedをチェック
 */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * 必須フィールドのバリデーション
 */
export function required(value: unknown, fieldName: string): string | undefined {
  return isEmpty(value) ? `${fieldName}は必須です` : undefined;
}
