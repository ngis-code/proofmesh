"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.loadApiConfig = exports.getNumberEnv = exports.getEnv = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getEnv = (key, defaultValue) => {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
};
exports.getEnv = getEnv;
const getNumberEnv = (key, defaultValue) => {
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
exports.getNumberEnv = getNumberEnv;
const loadApiConfig = () => ({
    port: (0, exports.getNumberEnv)('API_PORT', 3000),
    logLevel: (0, exports.getEnv)('API_LOG_LEVEL', 'debug'),
    db: {
        host: (0, exports.getEnv)('DB_HOST', 'localhost'),
        port: (0, exports.getNumberEnv)('DB_PORT', 26257),
        user: (0, exports.getEnv)('DB_USER', 'root'),
        password: (0, exports.getEnv)('DB_PASSWORD', ''),
        // CockroachDB creates a defaultdb database automatically; using that
        // as the default means a fresh cluster works without manual DB
        // creation. In production you can override DB_NAME to something else.
        database: (0, exports.getEnv)('DB_NAME', 'defaultdb'),
    },
    mqttUrl: (0, exports.getEnv)('MQTT_URL', 'mqtt://localhost:1883'),
    verifyTimeoutMs: (0, exports.getNumberEnv)('VERIFY_TIMEOUT_MS', 1000),
});
exports.loadApiConfig = loadApiConfig;
exports.logger = {
    info: (msg, meta) => {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() }));
    },
    error: (msg, meta) => {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() }));
    },
    debug: (msg, meta) => {
        if (process.env.API_LOG_LEVEL === 'debug') {
            // eslint-disable-next-line no-console
            console.debug(JSON.stringify({ level: 'debug', msg, meta, ts: new Date().toISOString() }));
        }
    },
};
