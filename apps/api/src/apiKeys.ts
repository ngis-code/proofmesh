import { randomBytes, createHash } from 'crypto';
import type { AuthContext } from './auth';
import { findOrgApiKeyByHash, insertOrgApiKey, touchOrgApiKeyUsage, type OrgApiKey } from './db';

// Simple in-memory rate limiter per API key (per process).
const rateBuckets = new Map<string, { windowStartMs: number; count: number }>();

export function generateRawApiKey(): string {
  // 32 bytes → 64 hex chars. Plenty of entropy for API keys.
  return randomBytes(32).toString('hex');
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createApiKeyForOrg(params: {
  orgId: string;
  label?: string | null;
  scopes?: string[];
  rateLimitPerMinute?: number | null;
}): Promise<{ apiKey: OrgApiKey; rawKey: string }> {
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);

  const apiKey = await insertOrgApiKey({
    orgId: params.orgId,
    keyHash,
    label: params.label ?? null,
    scopes: params.scopes,
    rateLimitPerMinute: params.rateLimitPerMinute,
  });

  return { apiKey, rawKey };
}

export class ApiKeyRateLimitError extends Error {
  code = 'RATE_LIMIT';
}

export async function verifyApiKey(rawKey: string): Promise<AuthContext | null> {
  const trimmed = rawKey.trim();
  if (!trimmed) return null;

  const keyHash = hashApiKey(trimmed);
  const key = await findOrgApiKeyByHash(keyHash);
  if (!key) return null;

  // Simple per-process rate limiting.
  if (key.rate_limit_per_minute && key.rate_limit_per_minute > 0) {
    const now = Date.now();
    const windowMs = 60_000;
    const bucket = rateBuckets.get(key.id) ?? { windowStartMs: now, count: 0 };

    if (now - bucket.windowStartMs >= windowMs) {
      bucket.windowStartMs = now;
      bucket.count = 0;
    }

    if (bucket.count >= key.rate_limit_per_minute) {
      throw new ApiKeyRateLimitError('API key rate limit exceeded');
    }

    bucket.count += 1;
    rateBuckets.set(key.id, bucket);
  }

  await touchOrgApiKeyUsage(key.id);

  const ctx: AuthContext = {
    via: 'api-key',
    userId: undefined,
    orgId: key.org_id,
    scopes: key.scopes,
    raw: {
      apiKeyId: key.id,
      label: key.label,
      scopes: key.scopes,
    },
  };

  return ctx;
}


