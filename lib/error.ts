/**
 * エラーハンドリング
 *
 * web-to-rn-translation.md の設計思想を流用
 */

/**
 * 型安全にエラーメッセージを抽出
 */
export function getErrorMessage(error: unknown, fallback = 'エラーが発生しました'): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isSqliteError(error)) {
    return `データベースエラー: ${error.message}`;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return fallback;
}

/**
 * SQLiteエラーの型ガード
 */
export function isSqliteError(error: unknown): error is SqliteError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string' &&
    'code' in error
  );
}

/**
 * SQLiteエラーの型定義
 */
export interface SqliteError {
  message: string;
  code: string;
}

/**
 * ログレベル別のログ関数
 */
export function logDebug(context: string, message: string, data?: any): void {
  if (__DEV__) {
    console.log(`[DEBUG][${context}] ${message}`, data ?? '');
  }
}

export function logInfo(context: string, message: string, data?: any): void {
  console.log(`[INFO][${context}] ${message}`, data ?? '');
}

export function logWarn(context: string, message: string, data?: any): void {
  console.warn(`[WARN][${context}] ${message}`, data ?? '');
}

export function logError(context: string, error: unknown, data?: any): void {
  const message = getErrorMessage(error);
  console.error(`[ERROR][${context}] ${message}`, data ?? '');

  // TODO: Phase 2で本番エラー追跡（PostHog or Sentry）
  // if (!__DEV__) {
  //   posthog.capture('error_occurred', {
  //     context,
  //     message,
  //   });
  // }
}
