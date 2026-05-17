/**
 * TanStack Query hooks for data fetching
 *
 * 全てのデータフェッチングはこのファイルを経由
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getActiveMedication } from '../db/queries/pillMedications';
import { getCurrentSheet } from '../db/queries/sheets';
import {
  getTodaysDoseRecord,
  markDoseAsTaken as markDoseAsTakenDb,
} from '../db/queries/doseRecords';
import type { PillMedication, Sheet, DoseRecord } from '../db/schema';

/**
 * アクティブなピル情報を取得
 */
export function useActiveMedication() {
  return useQuery<PillMedication | null, Error>({
    queryKey: ['medication', 'active'],
    queryFn: getActiveMedication,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ（頻繁に変わらない）
  });
}

/**
 * 現在のシートを取得
 */
export function useCurrentSheet(medicationId: string | undefined) {
  return useQuery<Sheet | null, Error>({
    queryKey: ['sheet', 'current', medicationId],
    queryFn: () => {
      if (!medicationId) return null;
      return getCurrentSheet(medicationId);
    },
    enabled: !!medicationId,
    staleTime: 2 * 60 * 1000, // 2分間キャッシュ
  });
}

/**
 * 今日の服薬記録を取得
 */
export function useTodaysDose(sheetId: string | undefined) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery<DoseRecord | null, Error>({
    queryKey: ['dose', 'today', sheetId, today],
    queryFn: () => {
      if (!sheetId) return null;
      return getTodaysDoseRecord(sheetId);
    },
    enabled: !!sheetId,
    staleTime: 60 * 1000, // 1分間キャッシュ（頻繁に変わる可能性）
    refetchInterval: 60 * 1000, // 1分ごとに自動更新（日付が変わった時のため）
  });
}

/**
 * 服薬を記録するミューテーション
 */
export function useMarkDoseTaken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      doseRecordId,
      takenAt,
      via = 'app',
    }: {
      doseRecordId: string;
      takenAt?: Date;
      via?: 'app' | 'notification' | 'manual';
    }) => {
      await markDoseAsTakenDb(doseRecordId, takenAt, via);
    },
    onSuccess: () => {
      // 関連するクエリを無効化して再フェッチを促す
      queryClient.invalidateQueries({ queryKey: ['dose'] });
      queryClient.invalidateQueries({ queryKey: ['sheet'] });
      console.log('[Hooks] Invalidated dose and sheet queries');
    },
    onError: (error: Error) => {
      console.error('[Hooks] Failed to mark dose as taken:', error);
    },
  });
}
