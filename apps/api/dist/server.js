"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const shared_config_1 = require("@proofmesh/shared-config");
const db_1 = require("./db");
const mqttClient_1 = require("./mqttClient");
const config = (0, shared_config_1.loadApiConfig)();
const fastify = (0, fastify_1.default)({
    logger: false,
});
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
    const validators = await (0, db_1.getEnabledValidators)(3);
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
    const validators = await (0, db_1.getEnabledValidators)(3);
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
    await (0, mqttClient_1.sendVerifyToValidators)({
        validatorIds,
        proofId: proof.id,
        orgId: proof.org_id,
        hash: proof.hash,
    });
    const results = await (0, mqttClient_1.waitForResults)(proof.id, 3000);
    const validCount = results.filter((r) => r.result === 'valid').length;
    const invalidCount = results.filter((r) => r.result === 'invalid').length;
    let finalStatus = status;
    if (invalidCount > 0) {
        finalStatus = 'tampered';
    }
    else if (validCount === validatorIds.length) {
        finalStatus = 'valid';
    }
    else if (validCount > 0) {
        finalStatus = 'low_confidence';
    }
    else {
        finalStatus = 'unknown';
    }
    return {
        mode,
        status: finalStatus,
        validators_confirmed: validCount,
        validators_total: validatorIds.length,
        proofs: [proof],
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
async function start() {
    try {
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
