"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const shared_config_1 = require("@proofmesh/shared-config");
const db_1 = require("./db");
const mqttClient_1 = require("./mqttClient");
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
fastify.get('/api/health', async () => ({ status: 'ok' }));
fastify.post('/api/stamp', async (request, reply) => {
    const body = request.body;
    if (!body?.orgId || !body?.hash) {
        return reply.status(400).send({ error: 'orgId and hash are required' });
    }
    const artifactType = body.artifactType ?? 'file';
    let versionOf = null;
    if (body.artifactId) {
        const latest = await (0, db_1.findLatestProofByOrgAndArtifact)(body.orgId, body.artifactId);
        if (latest) {
            versionOf = latest.id;
        }
    }
    const proof = await (0, db_1.insertProof)({
        orgId: body.orgId,
        hash: body.hash,
        artifactType,
        artifactId: body.artifactId ?? null,
        versionOf,
    });
    // Choose a cohort of online, enabled validators to attest this stamp.
    // We:
    // - require a minimum number of online validators (configurable) so we
    //   don't accidentally create unattested proofs, and
    // - sample up to stampValidatorSampleSize from the online pool, using
    //   random ordering in the DB helper so the cohort rotates naturally.
    const onlineValidators = await (0, db_1.getOnlineEnabledValidators)(null);
    const minOnline = config.stampMinOnlineValidators;
    if (onlineValidators.length < minOnline) {
        return reply.status(503).send({
            error: 'not_enough_online_validators',
            online: onlineValidators.length,
            required: minOnline,
        });
    }
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
    // very fast even with many validators in the network.
    if (mode === 'db_plus_validators' && hasConfirmed) {
        return {
            mode,
            status,
            validators_confirmed: 0,
            validators_total: 0,
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
