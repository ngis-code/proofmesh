import Fastify from 'fastify';
import http from 'http';
import https from 'https';
import cors from '@fastify/cors';
import { loadApiConfig, logger } from '@proofmesh/shared-config';
import {
  findLatestProofByOrgAndArtifact,
  findProofsByOrgAndHash,
  getEnabledValidators,
  getOnlineEnabledValidators,
  getProofById,
  getValidatorRunsForProof,
  insertProof,
  runMigrations,
  listProofs,
  listOrgs,
  listValidators,
  listValidatorRuns,
  upsertValidator,
  getValidatorById,
  updateValidatorPresence,
  listValidatorStats,
} from './db';
import { sendStampToValidators, sendVerifyToValidators, waitForResults, getMqttClient } from './mqttClient';

const config = loadApiConfig();
const fastify = Fastify({
  logger: false,
});

async function registerPlugins() {
  // CORS so the Vite dev server (localhost:5173) can call the API.
  await fastify.register(cors, {
    origin: true,
  });
}

fastify.get('/api/health', async () => ({ status: 'ok' }));

async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const data = JSON.stringify(body ?? {});
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
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
        },
        (res) => {
          const chunks: string[] = [];
          res.setEncoding('utf8');
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const raw = chunks.join('');
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              return reject(
                new Error(`Fallback stamp failed with status ${res.statusCode ?? 'unknown'}: ${raw}`),
              );
            }
            if (!raw) return resolve({});
            try {
              resolve(JSON.parse(raw));
            } catch (err) {
              reject(err);
            }
          });
        },
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

fastify.post('/api/stamp', async (request, reply) => {
  const body = request.body as {
    orgId: string;
    hash: string;
    artifactType?: string;
    artifactId?: string | null;
  };

  if (!body?.orgId || !body?.hash) {
    return reply.status(400).send({ error: 'orgId and hash are required' });
  }

  const isFallbackRequest = request.headers['x-proofmesh-stamp-fallback'] === '1';

  logger.info('Stamp request received', {
    bodyMeta: {
      orgId: body.orgId,
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
  const onlineValidators = await getOnlineEnabledValidators(null);
  const minOnline = config.stampMinOnlineValidators;

  logger.info('Stamp validator selection', {
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
          logger.info('Attempting stamp fallback', { target });
          const result = await postJson(
            target,
            body,
            config.verifyTimeoutMs,
            { 'x-proofmesh-stamp-fallback': '1' },
          );
          logger.info('Stamp fallback succeeded', { target });
          // Pass through the other region's response so the client sees a normal stamp result.
          return result;
        } catch (err) {
          logger.error('Stamp fallback failed', { target, err });
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

  let versionOf: string | null = null;
  if (body.artifactId) {
    const latest = await findLatestProofByOrgAndArtifact(body.orgId, body.artifactId);
    if (latest) {
      versionOf = latest.id;
    }
  }

  const proof = await insertProof({
    orgId: body.orgId,
    hash: body.hash,
    artifactType,
    artifactId: body.artifactId ?? null,
    versionOf,
  });

  const sampleSize = Math.min(config.stampValidatorSampleSize, onlineValidators.length);
  const validators = onlineValidators.slice(0, sampleSize);
  const validatorIds = validators.map((v) => v.id);

  if (validatorIds.length > 0) {
    await sendStampToValidators({
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
  const body = request.body as {
    orgId: string;
    hash: string;
    mode?: 'db_only' | 'db_plus_validators';
  };

  if (!body?.orgId || !body?.hash) {
    return reply.status(400).send({ error: 'orgId and hash are required' });
  }

  const mode = body.mode ?? 'db_only';

  const proofs = await findProofsByOrgAndHash(body.orgId, body.hash);

  const hasConfirmed = proofs.some((p) => p.status === 'confirmed');
  const hasAny = proofs.length > 0;

  let status: 'valid' | 'unknown' | 'tampered' | 'low_confidence' = 'unknown';
  if (hasConfirmed) {
    status = 'valid';
  } else if (hasAny) {
    status = 'low_confidence';
  }

  // Fast path: DB says this hash is already confirmed for this org.
  // In that case, we can safely return immediately without waiting
  // for live validator responses. This keeps repeated verifications
  // very fast even with many validators in the network, but we still
  // surface *which* validators contributed to the confirmation.
  if (mode === 'db_plus_validators' && hasConfirmed) {
    // Prefer the most recent confirmed proof when summarising validator runs.
    const confirmedProof =
      proofs.find((p) => p.status === 'confirmed') ?? proofs[0];

    let validatorsConfirmed = 0;
    let validatorsTotal = 0;
    let validatorsConfirmedIds: string[] = [];

    if (confirmedProof) {
      const runs = await getValidatorRunsForProof(confirmedProof.id);

      // Collapse multiple runs per validator down to the latest one, then
      // count how many ended in "valid".
      const latestByValidator = new Map<string, (typeof runs)[number]>();
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
  const validators = await getOnlineEnabledValidators(config.stampValidatorSampleSize);
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
    ?? (await insertProof({
      orgId: body.orgId,
      hash: body.hash,
      artifactType: 'verify',
      artifactId: null,
      versionOf: null,
    }));

  // Async pattern: fire-and-forget validator verification.
  // We do NOT wait for results on this HTTP request; clients can
  // poll /api/proofs/:id and /api/proofs/:id/validators for live status.
  void sendVerifyToValidators({
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
  const { id } = request.params as { id: string };
  const proof = await getProofById(id);
  if (!proof) {
    return reply.status(404).send({ error: 'Proof not found' });
  }
  return proof;
});

fastify.get('/api/proofs/:id/validators', async (request, reply) => {
  const { id } = request.params as { id: string };
  const proof = await getProofById(id);
  if (!proof) {
    return reply.status(404).send({ error: 'Proof not found' });
  }
  const runs = await getValidatorRunsForProof(id);
  return { proof, validatorRuns: runs };
});

fastify.get('/api/proofs', async (request) => {
  const { limit } = request.query as { limit?: string };
  const parsedLimit = limit ? Number(limit) : 100;
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
  const proofs = await listProofs(safeLimit);
  return { proofs };
});

fastify.get('/api/orgs', async () => {
  const orgs = await listOrgs();
  return { orgs };
});

// Lightweight registration endpoint so validators can self-register
// on startup. In production this would be authenticated and likely
// restricted to internal networks or mTLS; for dev we keep it open.
fastify.post('/api/validators/register', async (request, reply) => {
  const body = request.body as {
    id: string;
    secret: string;
    name?: string;
    region?: string;
  };

  if (!body?.id || !body?.secret) {
    return reply.status(400).send({ error: 'id and secret are required' });
  }

  const existing = await getValidatorById(body.id);
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

  const validator = await upsertValidator({
    id: body.id,
    name: body.name ?? existing.name,
    region: body.region ?? existing.region,
    apiKeyHash: existing.api_key_hash,
    enabled: true,
  });

  const presenceUpdated = await updateValidatorPresence({
    id: validator.id,
    online: true,
    lastSeenAt: new Date().toISOString(),
  });

  return { validator: presenceUpdated ?? validator };
});

fastify.get('/api/validators', async () => {
  const validators = await listValidators();
  return { validators };
});

fastify.get('/api/validator-runs', async (request) => {
  const { limit } = request.query as { limit?: string };
  const parsedLimit = limit ? Number(limit) : 100;
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
  const runs = await listValidatorRuns(safeLimit);
  return { validatorRuns: runs };
});

fastify.get('/api/validator-stats', async (request) => {
  const { limit } = request.query as { limit?: string };
  const parsedLimit = limit ? Number(limit) : 100;
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : Math.min(parsedLimit, 1000);
  const stats = await listValidatorStats(safeLimit);
  return { stats };
});

async function start() {
  try {
    await registerPlugins();
    await runMigrations();
    getMqttClient();

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`API listening on port ${config.port}`);
  } catch (err) {
    logger.error('Failed to start API', { err });
    process.exit(1);
  }
}

start();


