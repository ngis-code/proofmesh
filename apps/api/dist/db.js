"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.runMigrations = runMigrations;
exports.getEnabledValidators = getEnabledValidators;
exports.insertProof = insertProof;
exports.findLatestProofByOrgAndArtifact = findLatestProofByOrgAndArtifact;
exports.findProofsByOrgAndHash = findProofsByOrgAndHash;
exports.getProofById = getProofById;
exports.getValidatorRunsForProof = getValidatorRunsForProof;
exports.insertValidatorRun = insertValidatorRun;
exports.recomputeProofStatus = recomputeProofStatus;
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
    const migrationsDir = (0, path_1.join)(__dirname, '../../../infra/migrations');
    const files = (0, fs_1.readdirSync)(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        const sql = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf8');
        shared_config_1.logger.info('Running migration', { file });
        await exports.pool.query(sql);
    }
}
async function getEnabledValidators(limit = null) {
    const sql = 'SELECT * FROM validators WHERE enabled = true ORDER BY created_at ASC' + (limit ? ' LIMIT $1' : '');
    const params = limit ? [limit] : [];
    const res = await exports.pool.query(sql, params);
    return res.rows;
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
async function recomputeProofStatus(proofId) {
    const runs = await getValidatorRunsForProof(proofId);
    let status = 'pending';
    if (runs.some((r) => r.result === 'invalid')) {
        status = 'failed';
    }
    else {
        const validCount = runs.filter((r) => r.result === 'valid').length;
        const total = runs.length;
        if (total >= 1 && validCount / total >= 2 / 3) {
            status = 'confirmed';
        }
    }
    const res = await exports.pool.query('UPDATE proofs SET status = $1 WHERE id = $2 RETURNING *', [status, proofId]);
    return res.rows[0];
}
