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

export async function recomputeProofStatus(proofId: string): Promise<Proof> {
  const runs = await getValidatorRunsForProof(proofId);

  let status: ProofStatus = 'pending';
  const hasInvalid = runs.some((r) => r.result === 'invalid');
  const validCount = runs.filter((r) => r.result === 'valid').length;
  const total = runs.length;

  if (hasInvalid) {
    // Any validator explicitly saying "invalid" is a hard failure.
    status = 'failed';
  } else {
    if (total >= 1 && validCount / total >= 2 / 3) {
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


