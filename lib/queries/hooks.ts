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
  undoDoseRecord as undoDoseRecordDb,
} from '../db/queries/doseRecords';
import {
  getDailyNote,
  upsertDailyNote as upsertDailyNoteDb,
} from '../db/queries/dailyNotes';
import type { PillMedication, Sheet, DoseRecord, DailyNote } from '../db/schema';

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
    onSuccess: async () => {
      // 関連するクエリを無効化して即座に再フェッチ
      await queryClient.invalidateQueries({
        queryKey: ['dose'],
        refetchType: 'active', // アクティブなクエリのみ再フェッチ
      });
      await queryClient.invalidateQueries({
        queryKey: ['doseRecords'], // 履歴画面用
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['sheet'],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['currentSheet'], // 履歴画面用
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['monthStats'], // 月次統計も更新
        refetchType: 'active',
      });
      console.log('[Hooks] Invalidated and refetched all dose-related queries');
    },
    onError: (error: Error) => {
      console.error('[Hooks] Failed to mark dose as taken:', error);
    },
  });
}

/**
 * 指定日の1行日記を取得
 */
export function useDailyNote(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery<DailyNote | null, Error>({
    queryKey: ['dailyNote', dateStr],
    queryFn: () => getDailyNote(date),
    staleTime: 60 * 1000,
  });
}

/**
 * 1行日記を保存するミューテーション（upsert）
 */
export function useUpsertDailyNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      note,
      mood,
    }: {
      date: Date;
      note: string;
      mood?: number | null;
    }) => {
      await upsertDailyNoteDb(date, note, mood);
    },
    onSuccess: async (_data, variables) => {
      const dateStr = format(variables.date, 'yyyy-MM-dd');
      await queryClient.invalidateQueries({
        queryKey: ['dailyNote', dateStr],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['dailyNotes'], // 期間取得（カレンダー・トレンド）
        refetchType: 'active',
      });
      console.log('[Hooks] Daily note saved, queries invalidated');
    },
    onError: (error: Error) => {
      console.error('[Hooks] Failed to save daily note:', error);
    },
  });
}

/**
 * 服薬記録を取り消すミューテーション
 */
export function useUndoDoseRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ doseRecordId }: { doseRecordId: string }) => {
      await undoDoseRecordDb(doseRecordId);
    },
    onSuccess: async () => {
      // 関連するクエリを無効化して即座に再フェッチ
      await queryClient.invalidateQueries({
        queryKey: ['dose'],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['doseRecords'],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['sheet'],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['currentSheet'],
        refetchType: 'active',
      });
      await queryClient.invalidateQueries({
        queryKey: ['monthStats'],
        refetchType: 'active',
      });
      console.log('[Hooks] Dose record undone, queries invalidated');
    },
    onError: (error: Error) => {
      console.error('[Hooks] Failed to undo dose record:', error);
    },
  });
}
