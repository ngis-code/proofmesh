-- Aggregated per-validator statistics for reputation / rewards / governance.
-- This table is maintained by the API whenever new validator_runs are inserted,
-- so that /api/validator-stats can read from a small, pre-aggregated data set
-- instead of scanning billions of validator_runs rows.

CREATE TABLE IF NOT EXISTS validator_stats (
  validator_id STRING PRIMARY KEY,
  total_runs   INT8 NOT NULL DEFAULT 0,
  total_valid  INT8 NOT NULL DEFAULT 0,
  total_invalid INT8 NOT NULL DEFAULT 0,
  total_unknown INT8 NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NULL
);


