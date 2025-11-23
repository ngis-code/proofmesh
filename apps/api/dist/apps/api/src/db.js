"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.runMigrations = runMigrations;
exports.getEnabledValidators = getEnabledValidators;
exports.getOnlineEnabledValidators = getOnlineEnabledValidators;
exports.getValidatorById = getValidatorById;
exports.upsertValidator = upsertValidator;
exports.updateValidatorPresence = updateValidatorPresence;
exports.insertProof = insertProof;
exports.findLatestProofByOrgAndArtifact = findLatestProofByOrgAndArtifact;
exports.findProofsByOrgAndHash = findProofsByOrgAndHash;
exports.getProofById = getProofById;
exports.getValidatorRunsForProof = getValidatorRunsForProof;
exports.insertValidatorRun = insertValidatorRun;
exports.updateValidatorStatsForValidator = updateValidatorStatsForValidator;
exports.listValidatorStats = listValidatorStats;
exports.recomputeProofStatus = recomputeProofStatus;
exports.listProofs = listProofs;
exports.listOrgs = listOrgs;
exports.insertOrg = insertOrg;
exports.listOrgsForUser = listOrgsForUser;
exports.listValidators = listValidators;
exports.listValidatorRuns = listValidatorRuns;
exports.listOrgUsersForUser = listOrgUsersForUser;
exports.listOrgUsersForOrg = listOrgUsersForOrg;
exports.upsertOrgUser = upsertOrgUser;
exports.deleteOrgUser = deleteOrgUser;
exports.userHasOrgRole = userHasOrgRole;
exports.insertOrgApiKey = insertOrgApiKey;
exports.listOrgApiKeysForOrg = listOrgApiKeysForOrg;
exports.revokeOrgApiKey = revokeOrgApiKey;
exports.findOrgApiKeyByHash = findOrgApiKeyByHash;
exports.touchOrgApiKeyUsage = touchOrgApiKeyUsage;
const pg_1 = require("pg");
const shared_config_1 = require("@proofmesh/shared-config");
const fs_1 = require("fs");
const path_1 = require("path");
const config = (0, shared_config_1.loadApiConfig)();
exports.pool = new pg_1.Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
});
async function runMigrations() {
    // Support both local dev (ts-node from apps/api/src) and compiled
    // Docker runtime (entrypoint under dist/ or dist/apps/api/src).
    const candidates = [
        (0, path_1.join)(__dirname, '../../../infra/migrations'),
        (0, path_1.join)(__dirname, '../../../../infra/migrations'),
        (0, path_1.join)(process.cwd(), 'infra/migrations'),
    ];
    const migrationsDir = candidates.find((p) => (0, fs_1.existsSync)(p));
    if (!migrationsDir) {
        throw new Error(`Could not locate migrations directory. Tried: ${candidates.join(', ')}`);
    }
    const files = (0, fs_1.readdirSync)(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        const sql = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf8');
        shared_config_1.logger.info('Running migration', { file });
        // CockroachDB (and pg) don't accept multiple statements in a single query
        // over the extended protocol, so we split on semicolons and run each one.
        const statements = sql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        for (const stmt of statements) {
            await exports.pool.query(stmt);
        }
    }
}
async function getEnabledValidators(limit = null) {
    const sql = 'SELECT * FROM validators WHERE enabled = true ORDER BY created_at ASC' + (limit ? ' LIMIT $1' : '');
    const params = limit ? [limit] : [];
    const res = await exports.pool.query(sql, params);
    return res.rows;
}
async function getOnlineEnabledValidators(limit = null) {
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
    const params = [];
    let paramIndex = 1;
    let sql = 'SELECT * FROM validators WHERE enabled = true AND online = true';
    if (config.region) {
        sql += ` AND region = $${paramIndex++}`;
        params.push(config.region);
    }
    sql += ' ORDER BY random()';
    if (limit) {
        sql += ` LIMIT $${paramIndex++}`;
        params.push(limit);
    }
    const res = await exports.pool.query(sql, params);
    return res.rows;
}
async function getValidatorById(id) {
    const res = await exports.pool.query('SELECT * FROM validators WHERE id = $1', [id]);
    return res.rows[0] ?? null;
}
async function upsertValidator(params) {
    const res = await exports.pool.query(`INSERT INTO validators (id, name, region, api_key_hash, enabled, online, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       region = EXCLUDED.region,
       api_key_hash = EXCLUDED.api_key_hash,
       enabled = EXCLUDED.enabled
     RETURNING *`, [
        params.id,
        params.name,
        params.region,
        params.apiKeyHash,
        params.enabled ?? true,
        params.online ?? false,
        params.lastSeenAt ?? null,
    ]);
    return res.rows[0];
}
async function updateValidatorPresence(params) {
    const res = await exports.pool.query(`UPDATE validators
     SET online = $2,
         last_seen_at = $3
     WHERE id = $1
     RETURNING *`, [params.id, params.online, params.lastSeenAt]);
    return res.rows[0] ?? null;
}
async function insertProof(params) {
    const res = await exports.pool.query(`INSERT INTO proofs (org_id, hash, artifact_type, artifact_id, version_of)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [params.orgId, params.hash, params.artifactType, params.artifactId ?? null, params.versionOf ?? null]);
    return res.rows[0];
}
async function findLatestProofByOrgAndArtifact(orgId, artifactId) {
    const res = await exports.pool.query(`SELECT * FROM proofs
     WHERE org_id = $1 AND artifact_id = $2
     ORDER BY created_at DESC
     LIMIT 1`, [orgId, artifactId]);
    return res.rows[0] ?? null;
}
async function findProofsByOrgAndHash(orgId, hash) {
    const res = await exports.pool.query(`SELECT * FROM proofs
     WHERE org_id = $1 AND hash = $2
     ORDER BY created_at DESC`, [orgId, hash]);
    return res.rows;
}
async function getProofById(id) {
    const res = await exports.pool.query('SELECT * FROM proofs WHERE id = $1', [id]);
    return res.rows[0] ?? null;
}
async function getValidatorRunsForProof(proofId) {
    const res = await exports.pool.query('SELECT * FROM validator_runs WHERE proof_id = $1 ORDER BY signed_at ASC', [proofId]);
    return res.rows;
}
async function insertValidatorRun(params) {
    const res = await exports.pool.query(`INSERT INTO validator_runs (proof_id, validator_id, result, signature, signed_at, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`, [params.proofId, params.validatorId, params.result, params.signature, params.signedAt, params.latencyMs ?? null]);
    return res.rows[0];
}
async function updateValidatorStatsForValidator(validatorId) {
    await exports.pool.query(`UPSERT INTO validator_stats (
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
     GROUP BY validator_id`, [validatorId]);
}
async function listValidatorStats(limit = 100) {
    const res = await exports.pool.query('SELECT * FROM validator_stats ORDER BY total_runs DESC LIMIT $1', [limit]);
    return res.rows;
}
async function recomputeProofStatus(proofId) {
    const runs = await getValidatorRunsForProof(proofId);
    let status = 'pending';
    const hasInvalid = runs.some((r) => r.result === 'invalid');
    const validCount = runs.filter((r) => r.result === 'valid').length;
    const total = runs.length;
    // Quorum threshold is configurable so that production can demand a
    // stronger consensus (e.g. 3-of-4) while local dev can stay simple.
    const quorumFraction = config.stampQuorumDenominator === 0
        ? 1
        : config.stampQuorumNumerator / config.stampQuorumDenominator;
    if (hasInvalid) {
        // Any validator explicitly saying "invalid" is a hard failure.
        status = 'failed';
    }
    else {
        if (total >= 1 && validCount / total >= quorumFraction) {
            // Quorum of validators say "valid" → confirmed.
            status = 'confirmed';
        }
        else if (total >= 1 && validCount === 0) {
            // We have at least one run but zero "valid" results
            // (i.e. all "unknown" or "error"). In this case we treat the
            // proof as failed rather than leaving it indefinitely "pending".
            status = 'failed';
        }
    }
    const res = await exports.pool.query('UPDATE proofs SET status = $1 WHERE id = $2 RETURNING *', [status, proofId]);
    return res.rows[0];
}
async function listProofs(limit = 100) {
    const res = await exports.pool.query('SELECT * FROM proofs ORDER BY created_at DESC LIMIT $1', [limit]);
    return res.rows;
}
async function listOrgs() {
    const res = await exports.pool.query('SELECT * FROM orgs ORDER BY created_at DESC');
    return res.rows;
}
async function insertOrg(params) {
    const res = await exports.pool.query(`INSERT INTO orgs (name)
     VALUES ($1)
     RETURNING *`, [params.name]);
    return res.rows[0];
}
async function listOrgsForUser(userId) {
    const res = await exports.pool.query(`SELECT o.id, o.name, o.created_at, ou.role
     FROM orgs o
     JOIN org_users ou ON ou.org_id = o.id
     WHERE ou.user_id = $1
     ORDER BY o.created_at DESC`, [userId]);
    return res.rows;
}
async function listValidators() {
    const res = await exports.pool.query('SELECT * FROM validators ORDER BY created_at DESC');
    return res.rows;
}
async function listValidatorRuns(limit = 100) {
    const res = await exports.pool.query('SELECT * FROM validator_runs ORDER BY signed_at DESC LIMIT $1', [limit]);
    return res.rows;
}
async function listOrgUsersForUser(userId) {
    const res = await exports.pool.query(`SELECT * FROM org_users
     WHERE user_id = $1
     ORDER BY created_at DESC`, [userId]);
    return res.rows;
}
async function listOrgUsersForOrg(orgId) {
    const res = await exports.pool.query(`SELECT * FROM org_users
     WHERE org_id = $1
     ORDER BY created_at DESC`, [orgId]);
    return res.rows;
}
async function upsertOrgUser(params) {
    const res = await exports.pool.query(`INSERT INTO org_users (org_id, user_id, email, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, user_id)
     DO UPDATE SET role = EXCLUDED.role,
                   email = EXCLUDED.email
     RETURNING *`, [params.orgId, params.userId, params.email ?? null, params.role]);
    return res.rows[0];
}
async function deleteOrgUser(params) {
    await exports.pool.query(`DELETE FROM org_users
     WHERE org_id = $1 AND user_id = $2`, [params.orgId, params.userId]);
}
async function userHasOrgRole(params) {
    const res = await exports.pool.query(`SELECT EXISTS (
       SELECT 1 FROM org_users
       WHERE org_id = $1
         AND user_id = $2
         AND role = ANY($3::STRING[])
     ) AS exists`, [params.orgId, params.userId, params.roles]);
    return res.rows[0]?.exists ?? false;
}
async function insertOrgApiKey(params) {
    const res = await exports.pool.query(`INSERT INTO org_api_keys (org_id, key_hash, label, scopes, rate_limit_per_minute)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [
        params.orgId,
        params.keyHash,
        params.label ?? null,
        params.scopes ?? ['read', 'write'],
        params.rateLimitPerMinute ?? null,
    ]);
    return res.rows[0];
}
async function listOrgApiKeysForOrg(orgId) {
    const res = await exports.pool.query(`SELECT * FROM org_api_keys
     WHERE org_id = $1
     ORDER BY created_at DESC`, [orgId]);
    return res.rows;
}
async function revokeOrgApiKey(orgId, id) {
    const res = await exports.pool.query(`UPDATE org_api_keys
     SET revoked_at = now()
     WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
     RETURNING *`, [id, orgId]);
    return res.rows[0] ?? null;
}
async function findOrgApiKeyByHash(keyHash) {
    const res = await exports.pool.query(`SELECT * FROM org_api_keys
     WHERE key_hash = $1
       AND revoked_at IS NULL`, [keyHash]);
    return res.rows[0] ?? null;
}
async function touchOrgApiKeyUsage(id) {
    await exports.pool.query(`UPDATE org_api_keys
     SET last_used_at = now()
     WHERE id = $1`, [id]);
}
