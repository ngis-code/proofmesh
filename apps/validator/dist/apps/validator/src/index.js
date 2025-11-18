"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt_1 = __importDefault(require("mqtt"));
const crypto_1 = __importDefault(require("crypto"));
const shared_config_1 = require("@proofmesh/shared-config");
const VALIDATOR_ID = (0, shared_config_1.getEnv)('VALIDATOR_ID');
const VALIDATOR_SECRET = (0, shared_config_1.getEnv)('VALIDATOR_SECRET', 'dev-secret');
const MQTT_URL = (0, shared_config_1.getEnv)('MQTT_URL', 'mqtt://localhost:1883');
const API_BASE_URL = (0, shared_config_1.getEnv)('API_BASE_URL', 'http://api:3000');
// NOTE: In this Docker dev build we keep validator storage in-memory for simplicity.
// The schema is designed so it can be swapped to real SQLite later without changing behavior.
const SQLITE_PATH = (0, shared_config_1.getEnv)('SQLITE_PATH', './validator.db');
shared_config_1.logger.info('Validator starting', {
    VALIDATOR_ID,
    MQTT_URL,
    SQLITE_PATH,
    API_BASE_URL,
});
// Simple in-memory hash store for dev; can be replaced with real SQLite-backed
// implementation that mirrors this interface.
const seenHashes = new Set();
function hashExists(hash) {
    return seenHashes.has(hash);
}
function recordHash(hash) {
    seenHashes.add(hash);
}
async function registerWithApi() {
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
                region: 'dev',
            }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            shared_config_1.logger.error('Validator failed to register with API', { status: res.status, body });
            return;
        }
        const body = await res.json().catch(() => ({}));
        shared_config_1.logger.info('Validator registered with API', { body });
    }
    catch (err) {
        shared_config_1.logger.error('Validator registration with API failed', { err });
    }
}
function signPayload(hash, timestamp) {
    const hmac = crypto_1.default.createHmac('sha256', VALIDATOR_SECRET);
    hmac.update(`${hash}:${timestamp}:${VALIDATOR_ID}`);
    return hmac.digest('hex');
}
const presenceTopic = `proofmesh/validators/${VALIDATOR_ID}/presence`;
const client = mqtt_1.default.connect(MQTT_URL, {
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
    shared_config_1.logger.info('Validator MQTT connected', { MQTT_URL });
    // Fire-and-forget registration; if the API is not yet available this
    // will log an error but the validator will still operate against
    // MQTT. On next container restart it will try again.
    void registerWithApi();
    // Publish online presence.
    client.publish(presenceTopic, JSON.stringify({
        validatorId: VALIDATOR_ID,
        status: 'online',
        timestamp: new Date().toISOString(),
    }), { qos: 1 });
    const commandsTopic = `proofmesh/validators/${VALIDATOR_ID}/commands`;
    client.subscribe(commandsTopic, (err) => {
        if (err) {
            shared_config_1.logger.error('Validator failed to subscribe to commands topic', { err, commandsTopic });
        }
        else {
            shared_config_1.logger.info('Validator subscribed to commands topic', { commandsTopic });
        }
    });
});
client.on('reconnect', () => {
    shared_config_1.logger.info('Validator MQTT reconnecting');
});
client.on('error', (err) => {
    shared_config_1.logger.error('Validator MQTT error', { err });
});
client.on('message', (topic, message) => {
    try {
        const raw = message.toString();
        const parsed = JSON.parse(raw);
        if (parsed.type === 'STAMP') {
            handleStamp(parsed);
        }
        else if (parsed.type === 'VERIFY') {
            handleVerify(parsed);
        }
        else {
            shared_config_1.logger.error('Validator received unknown command type', { parsed });
        }
    }
    catch (err) {
        shared_config_1.logger.error('Validator failed to handle MQTT message', { err, topic });
    }
});
function publishResult(result) {
    const topic = `proofmesh/validators/${VALIDATOR_ID}/results`;
    client.publish(topic, JSON.stringify(result), { qos: 1 }, (err) => {
        if (err) {
            shared_config_1.logger.error('Validator failed to publish result', { err, topic });
        }
        else {
            shared_config_1.logger.debug('Validator published result', { topic, result });
        }
    });
}
function handleStamp(cmd) {
    const exists = hashExists(cmd.hash);
    if (!exists) {
        recordHash(cmd.hash);
    }
    const timestamp = new Date().toISOString();
    const signature = signPayload(cmd.hash, timestamp);
    const result = {
        type: 'STAMP_RESULT',
        proofId: cmd.proofId,
        validatorId: VALIDATOR_ID,
        result: 'valid',
        timestamp,
        signature,
    };
    publishResult(result);
}
function handleVerify(cmd) {
    const exists = hashExists(cmd.hash);
    const timestamp = new Date().toISOString();
    const signature = signPayload(cmd.hash, timestamp);
    const result = {
        type: 'VERIFY_RESULT',
        proofId: cmd.proofId ?? '',
        validatorId: VALIDATOR_ID,
        result: exists ? 'valid' : 'unknown',
        timestamp,
        signature,
    };
    publishResult(result);
}
