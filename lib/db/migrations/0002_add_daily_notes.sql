-- マイグレーション 0002: 1行日記（daily_notes）テーブル追加
-- 「その日のひとこと」を記録する無料機能。健康データは完全ローカル保存。
-- 無料: 書く・編集 + 過去7日の閲覧 / Premium: 7日以上前の閲覧 + トレンドグラフ。

-- 1行日記（1日1件）
CREATE TABLE IF NOT EXISTS daily_notes (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,            -- "yyyy-MM-dd"
  note TEXT NOT NULL DEFAULT '',
  mood INTEGER,                         -- 1-5（将来のトレンドグラフ用、現状UIなし）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);

-- スキーマバージョンを記録
INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', '2');
