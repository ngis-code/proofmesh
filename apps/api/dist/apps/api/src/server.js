"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const cors_1 = __importDefault(require("@fastify/cors"));
const shared_config_1 = require("@proofmesh/shared-config");
const db_1 = require("./db");
const mqttClient_1 = require("./mqttClient");
const auth_1 = require("./auth");
const apiKeys_1 = require("./apiKeys");
const config = (0, shared_config_1.loadApiConfig)();
const fastify = (0, fastify_1.default)({
    logger: false,
});
async function registerPlugins() {
    // CORS so the Vite dev server (localhost:5173) can call the API.
    await fastify.register(cors_1.default, {
        origin: true,
    });
}
// Global auth hook.
fastify.addHook('preHandler', async (request, reply) => {
    // Public endpoints that remain open:
    // Use the raw URL so this works reliably in hooks.
    const urlPath = request.raw.url?.split('?')[0] ?? '';
    if (urlPath === '/api/health' || urlPath === '/api/verify') {
        return;
    }
    // 1) Try x-api-key first (server-to-server).
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
        try {
            const ctx = await (0, apiKeys_1.verifyApiKey)(apiKeyHeader);
            if (!ctx) {
                return reply.status(401).send({ error: 'invalid_api_key' });
            }
            // Enforce basic scopes: write is required for mutations; read for reads.
            ctx.scopes = ctx.scopes ?? ['read', 'write'];
            request.auth = ctx;
            return;
        }
        catch (err) {
            if (err instanceof apiKeys_1.ApiKeyRateLimitError) {
                return reply.status(429).send({ error: 'api_key_rate_limited' });
            }
            request.log.error({ err }, 'API key auth failed');
            return reply.status(401).send({ error: 'invalid_api_key' });
        }
    }
    // 2) Fall back to Appwrite JWT if configured.
    if (!(0, auth_1.isAuthEnabled)()) {
        // Auth not configured and no API key present: behave as before (open).
        return;
    }
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'missing_token' });
    }
    const token = authHeader.slice('Bearer '.length);
    try {
        const ctx = await (0, auth_1.verifyAppwriteJwt)(token);
        request.auth = ctx;
    }
    catch (err) {
        request.log.error({ err }, 'Auth failed');
        return reply.status(401).send({ error: 'invalid_token' });
    }
});
fastify.get('/api/health', async () => ({ status: 'ok' }));
async function postJson(url, body, timeoutMs, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const data = JSON.stringify(body ?? {});
            const isHttps = u.protocol === 'https:';
            const lib = isHttps ? https_1.default : http_1.default;
            const req = lib.request({
                hostname: u.hostname,
                port: u.port ? Number(u.port) : isHttps ? 443 : 80,
                path: u.pathname + (u.search || ''),
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(data),
                    ...extraHeaders,
                },
                timeout: timeoutMs,
            }, (res) => {
                const chunks = [];
                res.setEncoding('utf8');
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const raw = chunks.join('');
                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`Fallback stamp failed with status ${res.statusCode ?? 'unknown'}: ${raw}`));
                    }
                    if (!raw)
                        return resolve({});
                    try {
                        resolve(JSON.parse(raw));
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy(new Error('Request timeout'));
            });
            req.write(data);
            req.end();
        }
        catch (err) {
            reject(err);
        }
    });
}
fastify.post('/api/stamp', async (request, reply) => {
    const body = request.body;
    if (!body?.hash) {
        return reply.status(400).send({ error: 'hash is required' });
    }
    // Determine effective org ID.
    const auth = request.auth;
    const bodyOrgId = body.orgId;
    let orgId = bodyOrgId;
    if (auth?.via === 'api-key') {
        // For API keys, always trust the org from the key, not from the body.
        orgId = auth.orgId;
        if (!orgId) {
            return reply.status(403).send({ error: 'api_key_missing_org' });
        }
        // Enforce write scope for stamping.
        const scopes = auth.scopes ?? ['read', 'write'];
        if (!scopes.includes('write')) {
            return reply.status(403).send({ error: 'forbidden_scope' });
        }
    }
    if (!orgId) {
        return reply.status(400).send({ error: 'orgId is required' });
    }
    if (bodyOrgId && bodyOrgId !== orgId) {
        return reply.status(403).send({ error: 'org_mismatch' });
    }
    const isFallbackRequest = request.headers['x-proofmesh-stamp-fallback'] === '1';
    shared_config_1.logger.info('Stamp request received', {
        bodyMeta: {
            orgId,
            hasArtifactId: !!body.artifactId,
        },
        isFallbackRequest,
        stampConfig: {
            stampMinOnlineValidators: config.stampMinOnlineValidators,
            stampValidatorSampleSize: config.stampValidatorSampleSize,
            stampFallbackApis: config.stampFallbackApis,
        },
    });
    // First, see if this region has enough local validators online. If not,
    // try HTTP fallback to peer regions *before* creating any proof rows so
    // we don't end up with duplicate proofs (one per region) for a single
    // logical stamp request.
    const onlineValidators = await (0, db_1.getOnlineEnabledValidators)(null);
    const minOnline = config.stampMinOnlineValidators;
    shared_config_1.logger.info('Stamp validator selection', {
        isFallbackRequest,
        onlineValidatorsCount: onlineValidators.length,
        minOnline,
    });
    if (onlineValidators.length < minOnline) {
        // If this is the initial request in this region, try HTTP fallback
        // to peer API regions before failing. If this is *already* a
        // fallback request (x-proofmesh-stamp-fallback=1), we skip further
        // fallbacks but still enforce the minOnline requirement so we don't
        // create unattested proofs with zero validators.
        if (!isFallbackRequest && config.stampFallbackApis.length > 0) {
            for (const baseUrl of config.stampFallbackApis) {
                const trimmed = baseUrl.replace(/\/+$/, '');
                const target = `${trimmed}/api/stamp`;
                try {
                    shared_config_1.logger.info('Attempting stamp fallback', { target });
                    const result = await postJson(target, body, config.verifyTimeoutMs, { 'x-proofmesh-stamp-fallback': '1' });
                    shared_config_1.logger.info('Stamp fallback succeeded', { target });
                    // Pass through the other region's response so the client sees a normal stamp result.
                    return result;
                }
                catch (err) {
                    shared_config_1.logger.error('Stamp fallback failed', { target, err });
                }
            }
        }
        return reply.status(503).send({
            error: 'not_enough_online_validators',
            online: onlineValidators.length,
            required: minOnline,
        });
    }
    const artifactType = body.artifactType ?? 'file';
    let versionOf = null;
    if (body.artifactId) {
        const latest = await (0, db_1.findLatestProofByOrgAndArtifact)(orgId, body.artifactId);
        if (latest) {
            versionOf = latest.id;
        }
    }
    const proof = await (0, db_1.insertProof)({
        orgId,
        hash: body.hash,
        artifactType,
        artifactId: body.artifactId ?? null,
        versionOf,
    });
    const sampleSize = Math.min(config.stampValidatorSampleSize, onlineValidators.length);
    const validators = onlineValidators.slice(0, sampleSize);
    const validatorIds = validators.map((v) => v.id);
    if (validatorIds.length > 0) {
        await (0, mqttClient_1.sendStampToValidators)({
            validatorIds,
            proofId: proof.id,
            orgId: proof.org_id,
            hash: proof.hash,
        });
    }
    return {
        proof,
        validators: validatorIds,
    };
});
fastify.post('/api/verify', async (request, reply) => {
    const body = request.body;
    if (!body?.orgId || !body?.hash) {
        return reply.status(400).send({ error: 'orgId and hash are required' });
    }
    const auth = request.auth;
    if (auth?.via === 'api-key') {
        const apiOrgId = auth.orgId;
        const scopes = auth.scopes ?? ['read', 'write'];
        if (!scopes.includes('read')) {
            return reply.status(403).send({ error: 'forbidden_scope' });
        }
        if (apiOrgId && apiOrgId !== body.orgId) {
            return reply.status(403).send({ error: 'org_mismatch' });
        }
    }
    const mode = body.mode ?? 'db_only';
    const proofs = await (0, db_1.findProofsByOrgAndHash)(body.orgId, body.hash);
    const hasConfirmed = proofs.some((p) => p.status === 'confirmed');
    const hasAny = proofs.length > 0;
    let status = 'unknown';
    if (hasConfirmed) {
        status = 'valid';
    }
    else if (hasAny) {
        status = 'low_confidence';
    }
    // Fast path: DB says this hash is already confirmed for this org.
    // In that case, we can safely return immediately without waiting
    // for live validator responses. This keeps repeated verifications
    // very fast even with many validators in the network, but we still
    // surface *which* validators contributed to the confirmation.
    if (mode === 'db_plus_validators' && hasConfirmed) {
        // Prefer the most recent confirmed proof when summarising validator runs.
        const confirmedProof = proofs.find((p) => p.status === 'confirmed') ?? proofs[0];
        let validatorsConfirmed = 0;
        let validatorsTotal = 0;
        let validatorsConfirmedIds = [];
        if (confirmedProof) {
            const runs = await (0, db_1.getValidatorRunsForProof)(confirmedProof.id);
            // Collapse multiple runs per validator down to the latest one, then
            // count how many ended in "valid".
            const latestByValidator = new Map();
            for (const run of runs) {
                latestByValidator.set(run.validator_id, run);
            }
            const latestRuns = Array.from(latestByValidator.values());
            validatorsTotal = latestRuns.length;
            validatorsConfirmedIds = latestRuns
                .filter((r) => r.result === 'valid')
                .map((r) => r.validator_id);
            validatorsConfirmed = validatorsConfirmedIds.length;
        }
        return {
            mode,
            status,
            validators_confirmed: validatorsConfirmed,
            validators_total: validatorsTotal,
            validators_confirmed_ids: validatorsConfirmedIds,
            proofs,
        };
    }
    if (mode === 'db_only') {
        return {
            mode,
            status,
            validators_confirmed: 0,
            validators_total: 0,
            proofs,
        };
    }
    // db_plus_validators
    const validators = await (0, db_1.getOnlineEnabledValidators)(config.stampValidatorSampleSize);
    const validatorIds = validators.map((v) => v.id);
    if (validatorIds.length === 0) {
        return {
            mode,
            status,
            validators_confirmed: 0,
            validators_total: 0,
            proofs,
        };
    }
    // Tie this verification to either an existing proof or create a new "verify" proof record.
    const proof = proofs[0]
        ?? (await (0, db_1.insertProof)({
            orgId: body.orgId,
            hash: body.hash,
            artifactType: 'verify',
            artifactId: null,
            versionOf: null,
        }));
    // Async pattern: fire-and-forget validator verification.
    // We do NOT wait for results on this HTTP request; clients can
    // poll /api/proofs/:id and /api/proofs/:id/validators for live status.
    void (0, mqttClient_1.sendVerifyToValidators)({
        validatorIds,
        proofId: proof.id,
        orgId: proof.org_id,
        hash: proof.hash,
    });
    return {
        mode,
        status,
        validators_confirmed: 0,
        validators_total: validatorIds.length,
        proof,
        validators_requested: validatorIds,
    };
});
fastify.get('/api/proofs/:id', async (request, reply) => {
    const { id } = request.params;
    const proof = await (0, db_1.getProofById)(id);
    if (!proof) {
        return reply.status(404).send({ error: 'Proof not found' });
    }
    return proof;
});
fastify.get('/api/proofs/:id/validators', async (request, reply) => {
    const { id } = request.params;
    const proof = await (0, db_1.getProofById)(id);
    if (!proof) {
        return reply.status(404).send({ error: 'Proof not found' });
    }
    const runs = await (0, db_1.getValidatorRunsForProof)(id);
    return { proof, validatorRuns: runs };
});
fastify.get('/api/proofs', async (request) => {
    const { limit } = request.query;
    const parsedLimit = limit ? Number(limit) : 100;
    const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
    const proofs = await (0, db_1.listProofs)(safeLimit);
    return { proofs };
});
fastify.get('/api/orgs', async () => {
    const orgs = await (0, db_1.listOrgs)();
    return { orgs };
});
fastify.post('/api/orgs', async (request, reply) => {
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const body = request.body;
    if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
        return reply.status(400).send({ error: 'name is required' });
    }
    const org = await (0, db_1.insertOrg)({ name: body.name.trim() });
    // Make the creator an admin of this org.
    await (0, db_1.upsertOrgUser)({ orgId: org.id, userId, role: 'admin' });
    return { org };
});
fastify.get('/api/my-orgs', async (request, reply) => {
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const orgs = await (0, db_1.listOrgsForUser)(userId);
    return { orgs };
});
// Org user/role management (ties Appwrite users to orgs in Cockroach).
fastify.get('/api/orgs/:orgId/users', async (request, reply) => {
    const { orgId } = request.params;
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const allowed = await (0, db_1.userHasOrgRole)({ userId, orgId, roles: ['admin'] });
    if (!allowed) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const users = await (0, db_1.listOrgUsersForOrg)(orgId);
    return { users };
});
fastify.post('/api/orgs/:orgId/users', async (request, reply) => {
    const { orgId } = request.params;
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const allowed = await (0, db_1.userHasOrgRole)({ userId, orgId, roles: ['admin'] });
    if (!allowed) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const body = request.body;
    if (!body?.userId) {
        return reply.status(400).send({ error: 'userId is required' });
    }
    const role = body.role ?? 'viewer';
    const validRoles = new Set(['admin', 'viewer']);
    if (!validRoles.has(role)) {
        return reply.status(400).send({ error: 'invalid_role' });
    }
    const orgUser = await (0, db_1.upsertOrgUser)({ orgId, userId: body.userId, role });
    return { user: orgUser };
});
fastify.post('/api/orgs/:orgId/users/:userId/remove', async (request, reply) => {
    const { orgId, userId: targetUserId } = request.params;
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const allowed = await (0, db_1.userHasOrgRole)({ userId, orgId, roles: ['admin'] });
    if (!allowed) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    await (0, db_1.deleteOrgUser)({ orgId, userId: targetUserId });
    return { ok: true };
});
// Org API key management (for now, keep it simple and rely on orgId in the path).
fastify.get('/api/orgs/:orgId/api-keys', async (request, reply) => {
    const { orgId } = request.params;
    // Require some form of auth; in future we can enforce that the user belongs to orgId.
    if (!request.auth) {
        return reply.status(401).send({ error: 'missing_token_or_api_key' });
    }
    const keys = await (0, db_1.listOrgApiKeysForOrg)(orgId);
    // Never return raw keys, only metadata.
    return { apiKeys: keys };
});
fastify.post('/api/orgs/:orgId/api-keys', async (request, reply) => {
    const { orgId } = request.params;
    // Creation should be done by a logged-in user (JWT), not by an API key.
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const allowed = await (0, db_1.userHasOrgRole)({ userId, orgId, roles: ['admin'] });
    if (!allowed) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const body = request.body;
    const { apiKey, rawKey } = await (0, apiKeys_1.createApiKeyForOrg)({
        orgId,
        label: body?.label ?? null,
        scopes: body?.scopes,
        rateLimitPerMinute: body?.rateLimitPerMinute ?? null,
    });
    // Show the raw key once so the caller can store it securely.
    return {
        apiKey,
        rawKey,
    };
});
fastify.post('/api/orgs/:orgId/api-keys/:id/revoke', async (request, reply) => {
    const { orgId, id } = request.params;
    if (!request.auth || request.auth.via !== 'jwt') {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const userId = request.auth.userId;
    if (!userId) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const allowed = await (0, db_1.userHasOrgRole)({ userId, orgId, roles: ['admin'] });
    if (!allowed) {
        return reply.status(403).send({ error: 'forbidden' });
    }
    const revoked = await (0, db_1.revokeOrgApiKey)(orgId, id);
    if (!revoked) {
        return reply.status(404).send({ error: 'not_found' });
    }
    return { apiKey: revoked };
});
// Lightweight registration endpoint so validators can self-register
// on startup. In production this would be authenticated and likely
// restricted to internal networks or mTLS; for dev we keep it open.
fastify.post('/api/validators/register', async (request, reply) => {
    const body = request.body;
    if (!body?.id || !body?.secret) {
        return reply.status(400).send({ error: 'id and secret are required' });
    }
    const existing = await (0, db_1.getValidatorById)(body.id);
    if (!existing) {
        // Validator not provisioned in the network.
        return reply.status(403).send({ error: 'validator_not_provisioned' });
    }
    if (!existing.enabled) {
        // Provisioned but disabled/revoked.
        return reply.status(403).send({ error: 'validator_disabled' });
    }
    if (existing.api_key_hash !== body.secret) {
        // In production this should compare a hash of the secret; for dev
        // we treat api_key_hash as the shared secret itself so that the
        // control-plane pattern matches production even if storage is simpler.
        return reply.status(403).send({ error: 'invalid_secret' });
    }
    const validator = await (0, db_1.upsertValidator)({
        id: body.id,
        name: body.name ?? existing.name,
        region: body.region ?? existing.region,
        apiKeyHash: existing.api_key_hash,
        enabled: true,
    });
    const presenceUpdated = await (0, db_1.updateValidatorPresence)({
        id: validator.id,
        online: true,
        lastSeenAt: new Date().toISOString(),
    });
    return { validator: presenceUpdated ?? validator };
});
fastify.get('/api/validators', async () => {
    const validators = await (0, db_1.listValidators)();
    return { validators };
});
fastify.get('/api/validator-runs', async (request) => {
    const { limit } = request.query;
    const parsedLimit = limit ? Number(limit) : 100;
    const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
    const runs = await (0, db_1.listValidatorRuns)(safeLimit);
    return { validatorRuns: runs };
});
fastify.get('/api/validator-stats', async (request) => {
    const { limit } = request.query;
    const parsedLimit = limit ? Number(limit) : 100;
    const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
    const stats = await (0, db_1.listValidatorStats)(safeLimit);
    return { stats };
});
async function start() {
    try {
        await registerPlugins();
        await (0, db_1.runMigrations)();
        (0, mqttClient_1.getMqttClient)();
        await fastify.listen({ port: config.port, host: '0.0.0.0' });
        shared_config_1.logger.info(`API listening on port ${config.port}`);
    }
    catch (err) {
        shared_config_1.logger.error('Failed to start API', { err });
        process.exit(1);
    }
}
start();
