import dotenv from 'dotenv';

dotenv.config();

export interface ApiConfig {
  port: number;
  logLevel: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  mqttUrl: string;
  verifyTimeoutMs: number;
  stampValidatorSampleSize: number;
  stampMinOnlineValidators: number;
  stampQuorumNumerator: number;
  stampQuorumDenominator: number;
  stampFallbackApis: string[];
}

export const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const getNumberEnv = (key: string, defaultValue?: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (defaultValue === undefined) {
      throw new Error(`Missing required numeric env var: ${key}`);
    }
    return defaultValue;
  }
  const n = Number(raw);
  if (Number.isNaN(n)) {
    throw new Error(`Env var ${key} must be a number, got: ${raw}`);
  }
  return n;
};

export const loadApiConfig = (): ApiConfig => ({
  port: getNumberEnv('API_PORT', 3000),
  logLevel: getEnv('API_LOG_LEVEL', 'debug'),
  db: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getNumberEnv('DB_PORT', 26257),
    user: getEnv('DB_USER', 'root'),
    password: getEnv('DB_PASSWORD', ''),
    // CockroachDB creates a defaultdb database automatically; using that
    // as the default means a fresh cluster works without manual DB
    // creation. In production you can override DB_NAME to something else.
    database: getEnv('DB_NAME', 'defaultdb'),
  },
  mqttUrl: getEnv('MQTT_URL', 'mqtt://localhost:1883'),
  verifyTimeoutMs: getNumberEnv('VERIFY_TIMEOUT_MS', 1000),
  // How many validators we try to involve in a stamp/verify cohort.
  // For production you might raise this (and run more validators);
  // for local dev the default of 3 keeps things simple.
  stampValidatorSampleSize: getNumberEnv('STAMP_VALIDATOR_SAMPLE_SIZE', 3),
  // Minimum number of online validators required to accept a new stamp.
  // If fewer are online, /api/stamp will fail with 503 so you don't
  // accidentally create "unattested" proofs.
  stampMinOnlineValidators: getNumberEnv('STAMP_MIN_ONLINE_VALIDATORS', 1),
  // Quorum for marking a proof as confirmed, expressed as a fraction.
  // Default is 2/3 meaning "at least two thirds of responding validators
  // for this proof must report valid".
  stampQuorumNumerator: getNumberEnv('STAMP_QUORUM_NUMERATOR', 2),
  stampQuorumDenominator: getNumberEnv('STAMP_QUORUM_DENOMINATOR', 3),
  // Optional comma-separated list of fallback API base URLs to use for
  // /api/stamp if the local region does not have enough online validators.
  // Example: "http://api-west.internal:3000,http://api-central.internal:3000"
  stampFallbackApis: (getEnv('STAMP_FALLBACK_APIS', '') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
});

export const logger = {
  info: (msg: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() }));
  },
  error: (msg: string, meta?: unknown) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() }));
  },
  debug: (msg: string, meta?: unknown) => {
    if (process.env.API_LOG_LEVEL === 'debug') {
      // eslint-disable-next-line no-console
      console.debug(JSON.stringify({ level: 'debug', msg, meta, ts: new Date().toISOString() }));
    }
  },
};


