-- Migration 0001: initial schema — habits, schedules, settings.
-- All date keys are local YYYY-MM-DD text. Timestamps are ISO-8601 text.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('spiritual', 'health', 'learning', 'productivity', 'personal')),
  tracking_type TEXT NOT NULL CHECK (tracking_type IN ('boolean', 'quantity', 'duration')),
  target_value REAL NOT NULL CHECK (target_value > 0),
  unit TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#32B77A',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS habit_schedules (
  habit_id TEXT PRIMARY KEY REFERENCES habits (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekdays')),
  weekdays TEXT NOT NULL DEFAULT '' CHECK (weekdays = '' OR weekdays GLOB '*[0-6]*'),
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date TEXT CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_sort_order ON habits (sort_order);
CREATE INDEX IF NOT EXISTS idx_habits_archived_at ON habits (archived_at);
