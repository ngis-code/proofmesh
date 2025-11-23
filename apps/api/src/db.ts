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

// Per-organization API keys for server-to-server access.
export interface OrgApiKey {
  id: string;
  org_id: string;
  key_hash: string;
  label: string | null;
  scopes: string[];
  rate_limit_per_minute: number | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Org/user role mapping.
export interface OrgUser {
  id: string;
  org_id: string;
  user_id: string;
  email: string | null;
  role: string;
  created_at: string;
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

export async function insertOrg(params: { name: string }): Promise<Org> {
  const res = await pool.query<Org>(
    `INSERT INTO orgs (name)
     VALUES ($1)
     RETURNING *`,
    [params.name],
  );
  return res.rows[0];
}

export interface OrgWithRole extends Org {
  role: string;
}

export async function listOrgsForUser(userId: string): Promise<OrgWithRole[]> {
  const res = await pool.query<OrgWithRole>(
    `SELECT o.id, o.name, o.created_at, ou.role
     FROM orgs o
     JOIN org_users ou ON ou.org_id = o.id
     WHERE ou.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId],
  );
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

export async function listOrgUsersForUser(userId: string): Promise<OrgUser[]> {
  const res = await pool.query<OrgUser>(
    `SELECT * FROM org_users
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows;
}

export async function listOrgUsersForOrg(orgId: string): Promise<OrgUser[]> {
  const res = await pool.query<OrgUser>(
    `SELECT * FROM org_users
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  );
  return res.rows;
}

export async function upsertOrgUser(params: {
  orgId: string;
  userId: string;
  email?: string | null;
  role: string;
}): Promise<OrgUser> {
  const res = await pool.query<OrgUser>(
    `INSERT INTO org_users (org_id, user_id, email, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, user_id)
     DO UPDATE SET role = EXCLUDED.role,
                   email = EXCLUDED.email
     RETURNING *`,
    [params.orgId, params.userId, params.email ?? null, params.role],
  );
  return res.rows[0];
}

export async function deleteOrgUser(params: { orgId: string; userId: string }): Promise<void> {
  await pool.query(
    `DELETE FROM org_users
     WHERE org_id = $1 AND user_id = $2`,
    [params.orgId, params.userId],
  );
}

export async function userHasOrgRole(params: {
  userId: string;
  orgId: string;
  roles: string[];
}): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM org_users
       WHERE org_id = $1
         AND user_id = $2
         AND role = ANY($3::STRING[])
     ) AS exists`,
    [params.orgId, params.userId, params.roles],
  );
  return res.rows[0]?.exists ?? false;
}

export async function countOrgAdmins(orgId: string): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::STRING AS count
     FROM org_users
     WHERE org_id = $1 AND role = 'admin'`,
    [orgId],
  );
  const raw = res.rows[0]?.count ?? '0';
  return Number(raw);
}

export async function getOrgOwnerUserId(orgId: string): Promise<string | null> {
  const res = await pool.query<{ user_id: string }>(
    `SELECT user_id
     FROM org_users
     WHERE org_id = $1 AND role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1`,
    [orgId],
  );
  return res.rows[0]?.user_id ?? null;
}

export async function insertOrgApiKey(params: {
  orgId: string;
  keyHash: string;
  label?: string | null;
  scopes?: string[];
  rateLimitPerMinute?: number | null;
}): Promise<OrgApiKey> {
  const res = await pool.query<OrgApiKey>(
    `INSERT INTO org_api_keys (org_id, key_hash, label, scopes, rate_limit_per_minute)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.orgId,
      params.keyHash,
      params.label ?? null,
      params.scopes ?? ['read', 'write'],
      params.rateLimitPerMinute ?? null,
    ],
  );
  return res.rows[0];
}

export async function listOrgApiKeysForOrg(orgId: string): Promise<OrgApiKey[]> {
  const res = await pool.query<OrgApiKey>(
    `SELECT * FROM org_api_keys
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  );
  return res.rows;
}

export async function revokeOrgApiKey(orgId: string, id: string): Promise<OrgApiKey | null> {
  const res = await pool.query<OrgApiKey>(
    `UPDATE org_api_keys
     SET revoked_at = now()
     WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
     RETURNING *`,
    [id, orgId],
  );
  return res.rows[0] ?? null;
}

export async function findOrgApiKeyByHash(keyHash: string): Promise<OrgApiKey | null> {
  const res = await pool.query<OrgApiKey>(
    `SELECT * FROM org_api_keys
     WHERE key_hash = $1
       AND revoked_at IS NULL`,
    [keyHash],
  );
  return res.rows[0] ?? null;
}

export async function touchOrgApiKeyUsage(id: string): Promise<void> {
  await pool.query(
    `UPDATE org_api_keys
     SET last_used_at = now()
     WHERE id = $1`,
    [id],
  );
}

export async function countProofsForOrgSince(orgId: string, sinceIso: string): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::STRING AS count
     FROM proofs
     WHERE org_id = $1
       AND created_at >= $2`,
    [orgId, sinceIso],
  );
  const raw = res.rows[0]?.count ?? '0';
  return Number(raw);
}

// Delete an organization and its related data in a single transaction.
// CockroachDB is the source of truth; higher layers handle external mirrors
// like Appwrite billing.
export async function deleteOrgCascade(orgId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove org-scoped relationships first.
    await client.query('DELETE FROM org_users WHERE org_id = $1', [orgId]);
    await client.query('DELETE FROM org_api_keys WHERE org_id = $1', [orgId]);
    // Remove proofs for this org; any validator_runs should either cascade or
    // be left for a separate clean-up if you decide to keep historical runs.
    await client.query('DELETE FROM proofs WHERE org_id = $1', [orgId]);

    // Finally, remove the org itself.
    await client.query('DELETE FROM orgs WHERE id = $1', [orgId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


