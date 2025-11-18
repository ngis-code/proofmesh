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


