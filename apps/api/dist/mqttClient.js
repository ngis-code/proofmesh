"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMqttClient = getMqttClient;
exports.publishCommandToValidator = publishCommandToValidator;
exports.sendStampToValidators = sendStampToValidators;
exports.sendVerifyToValidators = sendVerifyToValidators;
exports.waitForResults = waitForResults;
const mqtt_1 = __importDefault(require("mqtt"));
const shared_config_1 = require("@proofmesh/shared-config");
const db_1 = require("./db");
const config = (0, shared_config_1.loadApiConfig)();
let client = null;
const resultListeners = new Map();
function getMqttClient() {
    if (client)
        return client;
    client = mqtt_1.default.connect(config.mqttUrl);
    client.on('connect', () => {
        shared_config_1.logger.info('MQTT connected', { url: config.mqttUrl });
        client?.subscribe('proofmesh/validators/+/results', (err) => {
            if (err) {
                shared_config_1.logger.error('Failed to subscribe to results topic', { err });
            }
            else {
                shared_config_1.logger.info('Subscribed to validator results topic');
            }
        });
    });
    client.on('reconnect', () => {
        shared_config_1.logger.info('MQTT reconnecting');
    });
    client.on('error', (err) => {
        shared_config_1.logger.error('MQTT error', { err });
    });
    client.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            shared_config_1.logger.debug('Received MQTT result', { topic, payload });
            await (0, db_1.insertValidatorRun)({
                proofId: payload.proofId,
                validatorId: payload.validatorId,
                result: payload.result,
                signature: payload.signature,
                signedAt: payload.timestamp,
            });
            await (0, db_1.recomputeProofStatus)(payload.proofId);
            const listeners = resultListeners.get(payload.proofId);
            if (listeners) {
                listeners.forEach((fn) => fn(payload));
            }
        }
        catch (err) {
            shared_config_1.logger.error('Error handling MQTT message', { err, topic });
        }
    });
    return client;
}
function publishCommandToValidator(validatorId, command) {
    const c = getMqttClient();
    const topic = `proofmesh/validators/${validatorId}/commands`;
    const payload = JSON.stringify(command);
    c.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
            shared_config_1.logger.error('Failed to publish MQTT command', { topic, err });
        }
        else {
            shared_config_1.logger.debug('Published MQTT command', { topic, command });
        }
    });
}
async function sendStampToValidators(params) {
    const command = {
        type: 'STAMP',
        proofId: params.proofId,
        orgId: params.orgId,
        hash: params.hash,
    };
    params.validatorIds.forEach((id) => publishCommandToValidator(id, command));
}
async function sendVerifyToValidators(params) {
    const command = {
        type: 'VERIFY',
        proofId: params.proofId,
        orgId: params.orgId,
        hash: params.hash,
    };
    params.validatorIds.forEach((id) => publishCommandToValidator(id, command));
}
function waitForResults(proofId, timeoutMs) {
    return new Promise((resolve) => {
        const results = [];
        const listener = (payload) => {
            results.push(payload);
        };
        const existing = resultListeners.get(proofId) ?? [];
        existing.push(listener);
        resultListeners.set(proofId, existing);
        setTimeout(() => {
            const listeners = resultListeners.get(proofId) ?? [];
            resultListeners.set(proofId, listeners.filter((fn) => fn !== listener));
            resolve(results);
        }, timeoutMs);
    });
}
