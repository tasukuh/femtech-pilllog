/**
 * データベーススキーマ定義
 *
 * expo-sqlite + Drizzle ORM
 * 仕様書 4.1節 に基づく5テーブル構成
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ピル種類マスター
export const pillMedications = sqliteTable('pill_medications', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  manufacturer: text('manufacturer'),
  type: text('type', {
    enum: ['monophasic', 'triphasic', 'continuous', 'extended']
  }).notNull(),
  sheetPatternJson: text('sheet_pattern_json').notNull(),
  scheduledTime: text('scheduled_time').notNull(),
  color: text('color'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  startedAt: text('started_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// シート（1枚のピルシート）
export const sheets = sqliteTable('sheets', {
  id: text('id').primaryKey().notNull(),
  pillMedicationId: text('pill_medication_id').notNull()
    .references(() => pillMedications.id, { onDelete: 'cascade' }),
  sheetNumber: integer('sheet_number').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// 服薬記録（最重要テーブル）
export const doseRecords = sqliteTable(
  'dose_records',
  {
    id: text('id').primaryKey().notNull(),
    sheetId: text('sheet_id').notNull()
      .references(() => sheets.id, { onDelete: 'cascade' }),
    scheduledDate: text('scheduled_date').notNull(),
    scheduledTime: text('scheduled_time').notNull(),
    actualTakenAt: text('actual_taken_at'),
    status: text('status', {
      enum: ['scheduled', 'taken', 'missed', 'skipped']
    }).notNull(),
    takenVia: text('taken_via', {
      enum: ['app', 'notification', 'manual']
    }),
    pillDayNumber: integer('pill_day_number').notNull(),
    isPlacebo: integer('is_placebo', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    scheduledDateIdx: index('idx_dose_records_scheduled_date').on(table.scheduledDate),
    sheetIdIdx: index('idx_dose_records_sheet_id').on(table.sheetId),
  })
);

// 副作用記録（Premium機能）
export const sideEffects = sqliteTable('side_effects', {
  id: text('id').primaryKey().notNull(),
  doseRecordId: text('dose_record_id')
    .references(() => doseRecords.id, { onDelete: 'set null' }),
  recordedAt: text('recorded_at').notNull(),
  category: text('category', {
    enum: [
      'headache',
      'nausea',
      'bleeding',
      'mood',
      'breast_tenderness',
      'weight_change',
      'other'
    ]
  }).notNull(),
  severity: integer('severity').notNull(), // 1-5
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// 通知設定
export const notificationSettings = sqliteTable('notification_settings', {
  id: integer('id').primaryKey().notNull(), // 常に1
  primaryTime: text('primary_time').notNull().default('08:00'),
  reminderIntervalsJson: text('reminder_intervals_json').notNull().default('[5,30,60]'),
  eveningReminderEnabled: integer('evening_reminder_enabled', { mode: 'boolean' })
    .notNull().default(true),
  eveningReminderTime: text('evening_reminder_time').notNull().default('22:00'),
  soundEnabled: integer('sound_enabled', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// アプリ設定（key-value store）
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
});

// 型推論（Drizzle ORM の強み）
export type PillMedication = typeof pillMedications.$inferSelect;
export type NewPillMedication = typeof pillMedications.$inferInsert;

export type Sheet = typeof sheets.$inferSelect;
export type NewSheet = typeof sheets.$inferInsert;

export type DoseRecord = typeof doseRecords.$inferSelect;
export type NewDoseRecord = typeof doseRecords.$inferInsert;

export type SideEffect = typeof sideEffects.$inferSelect;
export type NewSideEffect = typeof sideEffects.$inferInsert;

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type NewNotificationSettings = typeof notificationSettings.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
