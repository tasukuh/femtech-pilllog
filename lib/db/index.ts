/**
 * データベース初期化とマイグレーション
 *
 * expo-sqlite の同期APIを使用
 * アプリ起動時に一度だけ initDB() を呼ぶ
 */

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// データベース名
const DB_NAME = 'pilllog.db';

// グローバルなDB接続（初期化後に設定される）
let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: SQLiteDatabase | null = null;

/**
 * Drizzle ORM インスタンスを取得
 */
export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return _db;
}

/**
 * 生のSQLite接続を取得（必要な場合のみ）
 */
export function getSqlite() {
  if (!_sqlite) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return _sqlite;
}

/**
 * データベース初期化
 * アプリ起動時（app/_layout.tsx）で一度だけ呼ぶ
 */
export async function initDB() {
  try {
    // SQLite接続を開く
    _sqlite = openDatabaseSync(DB_NAME);

    // Drizzle ORM インスタンスを作成
    _db = drizzle(_sqlite, { schema });

    console.log('[DB] Database opened:', DB_NAME);

    // マイグレーション実行
    await runMigrations(_sqlite);

    console.log('[DB] Initialization complete');
  } catch (error) {
    console.error('[DB] Initialization failed:', error);
    throw error;
  }
}

/**
 * マイグレーション実行
 */
async function runMigrations(sqlite: SQLiteDatabase) {
  try {
    // 現在のスキーマバージョンを取得
    const currentVersion = await getCurrentSchemaVersion(sqlite);
    console.log('[DB] Current schema version:', currentVersion);

    // 実行すべきマイグレーション
    const migrations = [
      { version: 1, name: '0001_initial', statements: MIGRATION_0001_STATEMENTS },
      { version: 2, name: '0002_add_daily_notes', statements: MIGRATION_0002_STATEMENTS },
      { version: 3, name: '0003_add_health_samples', statements: MIGRATION_0003_STATEMENTS },
    ];

    console.log(`[DB] Total migrations available: ${migrations.length}`);

    // 未実行のマイグレーションのみ実行
    let executed = 0;
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`[DB] Running migration ${migration.name} (version ${migration.version})...`);
        await executeMigration(sqlite, migration.statements);
        console.log(`[DB] Migration ${migration.name} completed successfully`);
        executed++;
      } else {
        console.log(`[DB] Skipping migration ${migration.name} (already applied)`);
      }
    }

    console.log(`[DB] Executed ${executed} migration(s)`);
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}

/**
 * 現在のスキーマバージョンを取得
 */
async function getCurrentSchemaVersion(sqlite: SQLiteDatabase): Promise<number> {
  try {
    const result = sqlite.getFirstSync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'schema_version'"
    );
    return result ? parseInt(result.value, 10) : 0;
  } catch {
    // app_settingsテーブルがまだ存在しない場合
    return 0;
  }
}

/**
 * マイグレーションSQLを実行
 */
async function executeMigration(sqlite: SQLiteDatabase, statements: string[]) {
  console.log(`[DB] Executing ${statements.length} SQL statements`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[DB] Statement ${i + 1}/${statements.length}: ${preview}...`);
      sqlite.execSync(statement);
      console.log(`[DB] ✓ Statement ${i + 1} executed successfully`);
    } catch (error) {
      console.error(`[DB] ✗ Failed to execute statement ${i + 1}:`, error);
      console.error(`[DB] Statement was:\n${statement}`);
      throw error;
    }
  }
}

/**
 * マイグレーション 0001 - 個別ステートメント
 */
const MIGRATION_0001_STATEMENTS = [
  // ピル種類テーブル
  `CREATE TABLE IF NOT EXISTS pill_medications (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    manufacturer TEXT,
    type TEXT NOT NULL CHECK(type IN ('monophasic', 'triphasic', 'continuous', 'extended')),
    sheet_pattern_json TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    color TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    started_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // シートテーブル
  `CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY NOT NULL,
    pill_medication_id TEXT NOT NULL,
    sheet_number INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pill_medication_id) REFERENCES pill_medications(id) ON DELETE CASCADE
  )`,

  // 服薬記録テーブル
  `CREATE TABLE IF NOT EXISTS dose_records (
    id TEXT PRIMARY KEY NOT NULL,
    sheet_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    actual_taken_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('scheduled', 'taken', 'missed', 'skipped')),
    taken_via TEXT CHECK(taken_via IN ('app', 'notification', 'manual')),
    pill_day_number INTEGER NOT NULL,
    is_placebo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE
  )`,

  // 服薬記録インデックス
  `CREATE INDEX IF NOT EXISTS idx_dose_records_scheduled_date ON dose_records(scheduled_date)`,
  `CREATE INDEX IF NOT EXISTS idx_dose_records_sheet_id ON dose_records(sheet_id)`,

  // 副作用記録テーブル
  `CREATE TABLE IF NOT EXISTS side_effects (
    id TEXT PRIMARY KEY NOT NULL,
    dose_record_id TEXT,
    recorded_at TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('headache', 'nausea', 'bleeding', 'mood', 'breast_tenderness', 'weight_change', 'other')),
    severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 5),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (dose_record_id) REFERENCES dose_records(id) ON DELETE SET NULL
  )`,

  // 通知設定テーブル
  `CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    primary_time TEXT NOT NULL DEFAULT '08:00',
    reminder_intervals_json TEXT NOT NULL DEFAULT '[5,30]',
    evening_reminder_enabled INTEGER NOT NULL DEFAULT 1,
    evening_reminder_time TEXT NOT NULL DEFAULT '22:00',
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // アプリ設定テーブル
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,

  // デフォルトレコード
  `INSERT OR IGNORE INTO notification_settings (id) VALUES (1)`,
  `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', '1')`,
];

/**
 * マイグレーション 0002 - 1行日記（daily_notes）テーブル追加
 */
const MIGRATION_0002_STATEMENTS = [
  // 1行日記テーブル（1日1件、健康データは完全ローカル）
  `CREATE TABLE IF NOT EXISTS daily_notes (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL UNIQUE,
    note TEXT NOT NULL DEFAULT '',
    mood INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // 日付インデックス（期間取得用）
  `CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date)`,

  // スキーマバージョンを 2 に更新
  `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', '2')`,
];

/**
 * マイグレーション 0003 - HealthKit キャッシュテーブル追加
 */
const MIGRATION_0003_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS health_samples (
    id TEXT PRIMARY KEY NOT NULL,
    sample_type TEXT NOT NULL CHECK(sample_type IN ('sleep', 'resting_hr')),
    date TEXT NOT NULL,
    value INTEGER NOT NULL,
    source_start_at TEXT NOT NULL,
    source_end_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_health_samples_date_type
    ON health_samples(date, sample_type)`,

  `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', '3')`,
];

/**
 * データベースをリセット（開発用）
 */
export async function resetDB() {
  const sqlite = getSqlite();

  // データのみ削除（テーブル構造は保持）
  const tables = [
    'dose_records',
    'side_effects',
    'daily_notes',
    'health_samples',
    'sheets',
    'pill_medications',
    'notification_settings',
    'app_settings',
  ];

  for (const table of tables) {
    sqlite.execSync(`DELETE FROM ${table}`);
  }

  console.log('[DB] All data deleted');
}
