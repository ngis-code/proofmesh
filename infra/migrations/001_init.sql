CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validators (
  id STRING PRIMARY KEY,
  name STRING NOT NULL,
  region STRING NOT NULL,
  api_key_hash STRING NOT NULL,
  enabled BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  online BOOL NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  hash STRING NOT NULL,
  artifact_type STRING NOT NULL,
  artifact_id STRING NULL,
  version_of UUID NULL REFERENCES proofs(id),
  status STRING NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proofs_org_hash ON proofs (org_id, hash);
CREATE INDEX IF NOT EXISTS idx_proofs_hash ON proofs (hash);

CREATE TABLE IF NOT EXISTS validator_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id UUID NOT NULL REFERENCES proofs(id),
  validator_id STRING NOT NULL REFERENCES validators(id),
  result STRING NOT NULL,
  signature STRING NULL,
  signed_at TIMESTAMP NOT NULL,
  latency_ms INT NULL
);

CREATE INDEX IF NOT EXISTS idx_validator_runs_proof ON validator_runs (proof_id);
CREATE INDEX IF NOT EXISTS idx_validator_runs_validator ON validator_runs (validator_id);


