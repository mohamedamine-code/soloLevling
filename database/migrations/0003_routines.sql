-- Migration 0003: routines — reusable named groups of existing habits.
-- A routine is an ordered checklist of habit references; it does not duplicate
-- habit data and cascades cleanly in both directions.

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_habits (
  routine_id TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (routine_id, habit_id)
);

CREATE INDEX IF NOT EXISTS idx_routine_habits_order
  ON routine_habits (routine_id, position);

CREATE INDEX IF NOT EXISTS idx_routine_habits_habit
  ON routine_habits (habit_id);
