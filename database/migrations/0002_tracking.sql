-- Migration 0002: daily tracking — entries, day overrides (skip), timer sessions.
-- All date keys are local YYYY-MM-DD text. Timestamps are ISO-8601 text.

CREATE TABLE IF NOT EXISTS habit_entries (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  type TEXT NOT NULL CHECK (type IN ('boolean', 'quantity', 'duration')),
  value REAL NOT NULL CHECK (value >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One boolean record per habit/day: duplicates are impossible at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_boolean_unique
  ON habit_entries (habit_id, date)
  WHERE type = 'boolean';

CREATE INDEX IF NOT EXISTS idx_entries_habit_date ON habit_entries (habit_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_date ON habit_entries (date);

CREATE TABLE IF NOT EXISTS habit_day_overrides (
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('skipped')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_overrides_date ON habit_day_overrides (date);

CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  started_at TEXT,
  accumulated_seconds REAL NOT NULL DEFAULT 0 CHECK (accumulated_seconds >= 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'paused')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
