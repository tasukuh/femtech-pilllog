-- マイグレーション 0001: 初期テーブル作成
-- 仕様書 4.1節 に基づく

-- ピル種類
CREATE TABLE IF NOT EXISTS pill_medications (
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
);

-- シート
CREATE TABLE IF NOT EXISTS sheets (
  id TEXT PRIMARY KEY NOT NULL,
  pill_medication_id TEXT NOT NULL,
  sheet_number INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pill_medication_id) REFERENCES pill_medications(id) ON DELETE CASCADE
);

-- 服薬記録
CREATE TABLE IF NOT EXISTS dose_records (
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
);

CREATE INDEX IF NOT EXISTS idx_dose_records_scheduled_date
  ON dose_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dose_records_sheet_id
  ON dose_records(sheet_id);

-- 副作用記録（Premium）
CREATE TABLE IF NOT EXISTS side_effects (
  id TEXT PRIMARY KEY NOT NULL,
  dose_record_id TEXT,
  recorded_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN (
    'headache', 'nausea', 'bleeding', 'mood', 'breast_tenderness',
    'weight_change', 'other'
  )),
  severity INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (dose_record_id) REFERENCES dose_records(id) ON DELETE SET NULL
);

-- 通知設定
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  primary_time TEXT NOT NULL DEFAULT '08:00',
  reminder_intervals_json TEXT NOT NULL DEFAULT '[5,30,60]',
  evening_reminder_enabled INTEGER NOT NULL DEFAULT 1,
  evening_reminder_time TEXT NOT NULL DEFAULT '22:00',
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- アプリ設定
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- デフォルトの通知設定レコードを挿入
INSERT OR IGNORE INTO notification_settings (id) VALUES (1);

-- スキーマバージョンを記録
INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', '1');
