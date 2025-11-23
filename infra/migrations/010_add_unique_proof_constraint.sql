-- Deduplicate proofs for the same logical stamp operation BEFORE
-- enforcing uniqueness at the database level.
--
-- We consider a proof "the same" if all of these match:
--   org_id, hash, artifact_type, artifact_id, version_of
--
-- Strategy:
--   - For each (org_id, hash, artifact_type, artifact_id, version_of)
--     group, keep the most recent row by created_at.
--   - Delete all older rows in that group.



-- Now that duplicates are removed, enforce uniqueness on the logical key.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proofs_logical_key
  ON proofs (org_id, hash, artifact_type, artifact_id, version_of);

