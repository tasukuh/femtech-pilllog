/**
 * トースト通知（burnt使用）
 *
 * web-to-rn-translation.md の Sonner → burnt 翻訳パターン
 */

// import * as Burnt from 'burnt'; // 一時的に無効化
import { Alert } from 'react-native';
import { getErrorMessage } from './error';

export const toast = {
  /**
   * 成功メッセージ
   */
  success: (title: string, message?: string) => {
    console.log('[Toast] Success:', title, message);
    // Alert.alert(title, message); // 一時的にコメントアウト
  },

  /**
   * エラーメッセージ
   */
  error: (error: unknown, fallback = 'エラーが発生しました') => {
    const message = getErrorMessage(error);
    console.error('[Toast] Error:', fallback, message);
    Alert.alert(fallback, message);
  },

  /**
   * 情報メッセージ
   */
  info: (title: string, message?: string) => {
    console.log('[Toast] Info:', title, message);
    // Alert.alert(title, message); // 一時的にコメントアウト
  },

  /**
   * 警告メッセージ
   */
  warning: (title: string, message?: string) => {
    console.warn('[Toast] Warning:', title, message);
    Alert.alert(title, message);
  },

  /**
   * Promise処理中のトースト切替
   */
  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> => {
    console.log('[Toast] Loading:', messages.loading);

    try {
      const result = await promise;
      console.log('[Toast] Success:', messages.success);
      return result;
    } catch (e) {
      console.error('[Toast] Error:', messages.error);
      Alert.alert('エラー', messages.error);
      throw e;
    }
  },
};
