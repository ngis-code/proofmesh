import mqtt from 'mqtt';
import crypto from 'crypto';
import { getEnv, logger } from '@proofmesh/shared-config';
import type {
  StampCommandPayload,
  VerifyCommandPayload,
  ResultPayload,
  StampResultPayload,
  VerifyResultPayload,
} from '@proofmesh/shared-types';

const VALIDATOR_ID = getEnv('VALIDATOR_ID');
const VALIDATOR_SECRET = getEnv('VALIDATOR_SECRET', 'dev-secret');
const MQTT_URL = getEnv('MQTT_URL', 'mqtt://localhost:1883');
const API_BASE_URL = getEnv('API_BASE_URL', 'http://api:3000');
// Logical region for this validator node (e.g. "us-east", "us-west").
// This is persisted in the shared CockroachDB `validators` table via
// the /api/validators/register endpoint so that:
// - external validators can declare their region at runtime via env
// - region changes survive restarts without manual SQL updates.
const VALIDATOR_REGION = getEnv('VALIDATOR_REGION', 'dev');
// NOTE: In this Docker dev build we keep validator storage in-memory for simplicity.
// The schema is designed so it can be swapped to real SQLite later without changing behavior.
const SQLITE_PATH = getEnv('SQLITE_PATH', './validator.db');

logger.info('Validator starting', {
  VALIDATOR_ID,
  MQTT_URL,
  SQLITE_PATH,
  API_BASE_URL,
  VALIDATOR_REGION,
});

// Simple in-memory hash store for dev; can be replaced with real SQLite-backed
// implementation that mirrors this interface.
const seenHashes = new Set<string>();

function hashExists(hash: string): boolean {
  return seenHashes.has(hash);
}

function recordHash(hash: string): void {
  seenHashes.add(hash);
}

async function registerWithApi(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/validators/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: VALIDATOR_ID,
        secret: VALIDATOR_SECRET,
        name: VALIDATOR_ID,
        region: VALIDATOR_REGION,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logger.error('Validator failed to register with API', { status: res.status, body });
      return;
    }

    const body = await res.json().catch(() => ({}));
    logger.info('Validator registered with API', { body });
  } catch (err) {
    logger.error('Validator registration with API failed', { err });
  }
}

function signPayload(hash: string, timestamp: string): string {
  const hmac = crypto.createHmac('sha256', VALIDATOR_SECRET);
  hmac.update(`${hash}:${timestamp}:${VALIDATOR_ID}`);
  return hmac.digest('hex');
}

const presenceTopic = `proofmesh/validators/${VALIDATOR_ID}/presence`;

const client = mqtt.connect(MQTT_URL, {
  // Last Will: if this validator disconnects uncleanly, the broker will
  // publish an \"offline\" presence message on its behalf.
  will: {
    topic: presenceTopic,
    payload: JSON.stringify({
      validatorId: VALIDATOR_ID,
      status: 'offline',
      timestamp: new Date().toISOString(),
    }),
    qos: 1,
    retain: false,
  },
});

client.on('connect', () => {
  logger.info('Validator MQTT connected', { MQTT_URL });
  // Fire-and-forget registration; if the API is not yet available this
  // will log an error but the validator will still operate against
  // MQTT. On next container restart it will try again.
  void registerWithApi();
  // Publish online presence.
  client.publish(
    presenceTopic,
    JSON.stringify({
      validatorId: VALIDATOR_ID,
      status: 'online',
      timestamp: new Date().toISOString(),
    }),
    { qos: 1 },
  );
  const commandsTopic = `proofmesh/validators/${VALIDATOR_ID}/commands`;
  client.subscribe(commandsTopic, (err) => {
    if (err) {
      logger.error('Validator failed to subscribe to commands topic', { err, commandsTopic });
    } else {
      logger.info('Validator subscribed to commands topic', { commandsTopic });
    }
  });
});

client.on('reconnect', () => {
  logger.info('Validator MQTT reconnecting');
});

client.on('error', (err) => {
  logger.error('Validator MQTT error', { err });
});

client.on('message', (topic, message) => {
  try {
    const raw = message.toString();
    const parsed = JSON.parse(raw) as StampCommandPayload | VerifyCommandPayload;

    if (parsed.type === 'STAMP') {
      handleStamp(parsed);
    } else if (parsed.type === 'VERIFY') {
      handleVerify(parsed);
    } else {
      logger.error('Validator received unknown command type', { parsed });
    }
  } catch (err) {
    logger.error('Validator failed to handle MQTT message', { err, topic });
  }
});

function publishResult(result: ResultPayload): void {
  const topic = `proofmesh/validators/${VALIDATOR_ID}/results`;
  client.publish(topic, JSON.stringify(result), { qos: 1 }, (err) => {
    if (err) {
      logger.error('Validator failed to publish result', { err, topic });
    } else {
      logger.debug('Validator published result', { topic, result });
    }
  });
}

function handleStamp(cmd: StampCommandPayload): void {
  const exists = hashExists(cmd.hash);
  if (!exists) {
    recordHash(cmd.hash);
  }
  const timestamp = new Date().toISOString();
  const signature = signPayload(cmd.hash, timestamp);

  const result: StampResultPayload = {
    type: 'STAMP_RESULT',
    proofId: cmd.proofId,
    validatorId: VALIDATOR_ID,
    result: 'valid',
    timestamp,
    signature,
  };

  publishResult(result);
}

function handleVerify(cmd: VerifyCommandPayload): void {
  const exists = hashExists(cmd.hash);
  const timestamp = new Date().toISOString();
  const signature = signPayload(cmd.hash, timestamp);

  const result: VerifyResultPayload = {
    type: 'VERIFY_RESULT',
    proofId: cmd.proofId ?? '',
    validatorId: VALIDATOR_ID,
    result: exists ? 'valid' : 'unknown',
    timestamp,
    signature,
  };

  publishResult(result);
}


