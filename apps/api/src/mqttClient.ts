import mqtt, { MqttClient } from 'mqtt';
import { loadApiConfig, logger } from '@proofmesh/shared-config';
import type {
  CommandPayload,
  ResultPayload,
  StampCommandPayload,
  VerifyCommandPayload,
  ValidatorPresencePayload,
} from '@proofmesh/shared-types';
import {
  insertValidatorRun,
  recomputeProofStatus,
  updateValidatorPresence,
  updateValidatorStatsForValidator,
} from './db';

type ResultListener = (payload: ResultPayload) => void;

const config = loadApiConfig();

let client: MqttClient | null = null;

const resultListeners: Map<string, ResultListener[]> = new Map();

export function getMqttClient(): MqttClient {
  if (client) return client;

  client = mqtt.connect(config.mqttUrl);

  client.on('connect', () => {
    logger.info('MQTT connected', { url: config.mqttUrl });

    const topics = [
      'proofmesh/validators/+/results',
      'proofmesh/validators/+/presence',
    ];

    client?.subscribe(topics, (err) => {
      if (err) {
        logger.error('Failed to subscribe to MQTT topics', { err, topics });
      } else {
        logger.info('Subscribed to MQTT topics', { topics });
      }
    });
  });

  client.on('reconnect', () => {
    logger.info('MQTT reconnecting');
  });

  client.on('error', (err) => {
    logger.error('MQTT error', { err });
  });

  client.on('message', async (topic, message) => {
    try {
      const raw = message.toString();

      if (topic.startsWith('proofmesh/validators/') && topic.endsWith('/results')) {
        const payload = JSON.parse(raw) as ResultPayload;
        logger.debug('Received MQTT result', { topic, payload });

        const run = await insertValidatorRun({
          proofId: payload.proofId,
          validatorId: payload.validatorId,
          result: payload.result,
          signature: payload.signature,
          signedAt: payload.timestamp,
        });

        await recomputeProofStatus(payload.proofId);
        await updateValidatorStatsForValidator(run.validator_id);

        const listeners = resultListeners.get(payload.proofId);
        if (listeners) {
          listeners.forEach((fn) => fn(payload));
        }
        return;
      }

      if (topic.startsWith('proofmesh/validators/') && topic.endsWith('/presence')) {
        const payload = JSON.parse(raw) as ValidatorPresencePayload;
        logger.debug('Received validator presence', { topic, payload });

        await updateValidatorPresence({
          id: payload.validatorId,
          online: payload.status === 'online',
          lastSeenAt: new Date().toISOString(),
        });
        return;
      }

      logger.debug('Received MQTT message on unknown topic', { topic });
    } catch (err) {
      logger.error('Error handling MQTT message', { err, topic });
    }
  });

  return client;
}

export function publishCommandToValidator(validatorId: string, command: CommandPayload): void {
  const c = getMqttClient();
  const topic = `proofmesh/validators/${validatorId}/commands`;
  const payload = JSON.stringify(command);
  c.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      logger.error('Failed to publish MQTT command', { topic, err });
    } else {
      logger.debug('Published MQTT command', { topic, command });
    }
  });
}

export async function sendStampToValidators(params: {
  validatorIds: string[];
  proofId: string;
  orgId: string;
  hash: string;
}): Promise<void> {
  const command: StampCommandPayload = {
    type: 'STAMP',
    proofId: params.proofId,
    orgId: params.orgId,
    hash: params.hash,
  };
  params.validatorIds.forEach((id) => publishCommandToValidator(id, command));
}

export async function sendVerifyToValidators(params: {
  validatorIds: string[];
  proofId: string;
  orgId: string;
  hash: string;
}): Promise<void> {
  const command: VerifyCommandPayload = {
    type: 'VERIFY',
    proofId: params.proofId,
    orgId: params.orgId,
    hash: params.hash,
  };
  params.validatorIds.forEach((id) => publishCommandToValidator(id, command));
}

export function waitForResults(
  proofId: string,
  timeoutMs: number,
  expectedCount?: number,
): Promise<ResultPayload[]> {
  return new Promise((resolve) => {
    const results: ResultPayload[] = [];

    let timer: NodeJS.Timeout;

    const cleanup = () => {
      const listeners = resultListeners.get(proofId) ?? [];
      resultListeners.set(
        proofId,
        listeners.filter((fn) => fn !== listener),
      );
      clearTimeout(timer);
    };

    const listener: ResultListener = (payload) => {
      results.push(payload);

      if (expectedCount && results.length >= expectedCount) {
        cleanup();
        resolve(results);
      }
    };

    const existing = resultListeners.get(proofId) ?? [];
    existing.push(listener);
    resultListeners.set(proofId, existing);

    timer = setTimeout(() => {
      cleanup();
      resolve(results);
    }, timeoutMs);
  });
}


