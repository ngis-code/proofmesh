import { Pool } from 'pg';
import { loadApiConfig, logger } from '@proofmesh/shared-config';
import type {
  Proof,
  Validator,
  ValidatorRun,
  ValidatorResult,
  ProofStatus,
  Org,
} from '@proofmesh/shared-types';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const config = loadApiConfig();

// Aggregated per-validator statistics for reputation / rewards / governance.
// This is kept up to date incrementally as new validator_runs are written so
// that public APIs like /api/validator-stats never need to scan the full
// validator_runs table.
export interface ValidatorStats {
  validator_id: string;
  total_runs: number;
  total_valid: number;
  total_invalid: number;
  total_unknown: number;
  last_seen_at: string | null;
}

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

export async function runMigrations(): Promise<void> {
  // Support both local dev (ts-node from apps/api/src) and compiled
  // Docker runtime (entrypoint under dist/ or dist/apps/api/src).
  const candidates = [
    join(__dirname, '../../../infra/migrations'),
    join(__dirname, '../../../../infra/migrations'),
    join(process.cwd(), 'infra/migrations'),
  ];

  const migrationsDir = candidates.find((p) => existsSync(p));
  if (!migrationsDir) {
    throw new Error(`Could not locate migrations directory. Tried: ${candidates.join(', ')}`);
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    logger.info('Running migration', { file });

    // CockroachDB (and pg) don't accept multiple statements in a single query
    // over the extended protocol, so we split on semicolons and run each one.
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await pool.query(stmt);
    }
  }
}

export async function getEnabledValidators(limit: number | null = null): Promise<Validator[]> {
  const sql = 'SELECT * FROM validators WHERE enabled = true ORDER BY created_at ASC' + (limit ? ' LIMIT $1' : '');
  const params = limit ? [limit] : [];
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function getOnlineEnabledValidators(limit: number | null = null): Promise<Validator[]> {
  // Randomize order so that when we sample, we get a different cohort
  // over time rather than always the same first N validators.
  //
  // IMPORTANT: scope "online" validators to this API's region so that:
  // - each region only sends MQTT commands to validators connected to
  //   its own broker, and
  // - cross-region work happens via HTTP /api/stamp fallback rather than
  //   trying to talk to remote-region validators over MQTT directly.
  //
  // This relies on validators having a region string that matches the
  // API_REGION env for the region they are physically running in.
  const params: unknown[] = [];
  let paramIndex = 1;

  let sql =
    'SELECT * FROM validators WHERE enabled = true AND online = true';

  if (config.region) {
    sql += ` AND region = $${paramIndex++}`;
    params.push(config.region);
  }

  sql += ' ORDER BY random()';

  if (limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(limit);
  }

  const res = await pool.query<Validator>(sql, params);
  return res.rows;
}

export async function getValidatorById(id: string): Promise<Validator | null> {
  const res = await pool.query<Validator>('SELECT * FROM validators WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function upsertValidator(params: {
  id: string;
  name: string;
  region: string;
  apiKeyHash: string;
  enabled?: boolean;
  online?: boolean;
  lastSeenAt?: string | null;
}): Promise<Validator> {
  const res = await pool.query<Validator>(
    `INSERT INTO validators (id, name, region, api_key_hash, enabled, online, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       region = EXCLUDED.region,
       api_key_hash = EXCLUDED.api_key_hash,
       enabled = EXCLUDED.enabled
     RETURNING *`,
    [
      params.id,
      params.name,
      params.region,
      params.apiKeyHash,
      params.enabled ?? true,
      params.online ?? false,
      params.lastSeenAt ?? null,
    ],
  );
  return res.rows[0];
}

export async function updateValidatorPresence(params: {
  id: string;
  online: boolean;
  lastSeenAt: string;
}): Promise<Validator | null> {
  const res = await pool.query<Validator>(
    `UPDATE validators
     SET online = $2,
         last_seen_at = $3
     WHERE id = $1
     RETURNING *`,
    [params.id, params.online, params.lastSeenAt],
  );
  return res.rows[0] ?? null;
}

export async function insertProof(params: {
  orgId: string;
  hash: string;
  artifactType: string;
  artifactId?: string | null;
  versionOf?: string | null;
}): Promise<Proof> {
  const res = await pool.query<Proof>(
    `INSERT INTO proofs (org_id, hash, artifact_type, artifact_id, version_of)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.orgId, params.hash, params.artifactType, params.artifactId ?? null, params.versionOf ?? null],
  );
  return res.rows[0];
}

export async function findLatestProofByOrgAndArtifact(orgId: string, artifactId: string): Promise<Proof | null> {
  const res = await pool.query<Proof>(
    `SELECT * FROM proofs
     WHERE org_id = $1 AND artifact_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [orgId, artifactId],
  );
  return res.rows[0] ?? null;
}

export async function findProofsByOrgAndHash(orgId: string, hash: string): Promise<Proof[]> {
  const res = await pool.query<Proof>(
    `SELECT * FROM proofs
     WHERE org_id = $1 AND hash = $2
     ORDER BY created_at DESC`,
    [orgId, hash],
  );
  return res.rows;
}

export async function getProofById(id: string): Promise<Proof | null> {
  const res = await pool.query<Proof>('SELECT * FROM proofs WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function getValidatorRunsForProof(proofId: string): Promise<ValidatorRun[]> {
  const res = await pool.query<ValidatorRun>(
    'SELECT * FROM validator_runs WHERE proof_id = $1 ORDER BY signed_at ASC',
    [proofId],
  );
  return res.rows;
}

export async function insertValidatorRun(params: {
  proofId: string;
  validatorId: string;
  result: ValidatorResult;
  signature: string;
  signedAt: string;
  latencyMs?: number | null;
}): Promise<ValidatorRun> {
  const res = await pool.query<ValidatorRun>(
    `INSERT INTO validator_runs (proof_id, validator_id, result, signature, signed_at, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [params.proofId, params.validatorId, params.result, params.signature, params.signedAt, params.latencyMs ?? null],
  );
  return res.rows[0];
}

export async function updateValidatorStatsForValidator(validatorId: string): Promise<void> {
  await pool.query(
    `UPSERT INTO validator_stats (
       validator_id,
       total_runs,
       total_valid,
       total_invalid,
       total_unknown,
       last_seen_at
     )
     SELECT
       validator_id,
       COUNT(*)                                       AS total_runs,
       COUNT(*) FILTER (WHERE result = 'valid')   AS total_valid,
       COUNT(*) FILTER (WHERE result = 'invalid') AS total_invalid,
       COUNT(*) FILTER (WHERE result = 'unknown') AS total_unknown,
       MAX(signed_at)                               AS last_seen_at
     FROM validator_runs
     WHERE validator_id = $1
     GROUP BY validator_id`,
    [validatorId],
  );
}

export async function listValidatorStats(limit = 100): Promise<ValidatorStats[]> {
  const res = await pool.query<ValidatorStats>(
    'SELECT * FROM validator_stats ORDER BY total_runs DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}

export async function recomputeProofStatus(proofId: string): Promise<Proof> {
  const runs = await getValidatorRunsForProof(proofId);

  let status: ProofStatus = 'pending';
  const hasInvalid = runs.some((r) => r.result === 'invalid');
  const validCount = runs.filter((r) => r.result === 'valid').length;
  const total = runs.length;

  // Quorum threshold is configurable so that production can demand a
  // stronger consensus (e.g. 3-of-4) while local dev can stay simple.
  const quorumFraction =
    config.stampQuorumDenominator === 0
      ? 1
      : config.stampQuorumNumerator / config.stampQuorumDenominator;

  if (hasInvalid) {
    // Any validator explicitly saying "invalid" is a hard failure.
    status = 'failed';
  } else {
    if (total >= 1 && validCount / total >= quorumFraction) {
      // Quorum of validators say "valid" → confirmed.
      status = 'confirmed';
    } else if (total >= 1 && validCount === 0) {
      // We have at least one run but zero "valid" results
      // (i.e. all "unknown" or "error"). In this case we treat the
      // proof as failed rather than leaving it indefinitely "pending".
      status = 'failed';
    }
  }

  const res = await pool.query<Proof>('UPDATE proofs SET status = $1 WHERE id = $2 RETURNING *', [status, proofId]);
  return res.rows[0];
}

export async function listProofs(limit = 100): Promise<Proof[]> {
  const res = await pool.query<Proof>(
    'SELECT * FROM proofs ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}

export async function listOrgs(): Promise<Org[]> {
  const res = await pool.query<Org>('SELECT * FROM orgs ORDER BY created_at DESC');
  return res.rows;
}

export async function listValidators(): Promise<Validator[]> {
  const res = await pool.query<Validator>('SELECT * FROM validators ORDER BY created_at DESC');
  return res.rows;
}

export async function listValidatorRuns(limit = 100): Promise<ValidatorRun[]> {
  const res = await pool.query<ValidatorRun>(
    'SELECT * FROM validator_runs ORDER BY signed_at DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}


