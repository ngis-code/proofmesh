import http from 'http';
import https from 'https';
import { getEnv, logger } from '@proofmesh/shared-config';

// Auth context used across both Appwrite JWTs and ProofMesh API keys.
export interface AuthContext {
  via: 'jwt' | 'api-key';
  userId?: string;
  orgId?: string;
  raw: Record<string, unknown>;
}

// Appwrite-based JWT auth wiring using the /v1/account endpoint.
//
// When a client calls /account/jwt and then sends that JWT to this API,
// we validate it by calling Appwrite's /v1/account with:
//   - X-Appwrite-Project: <projectId>
//   - X-Appwrite-JWT: <jwt>
// If Appwrite returns 200 and a user object, we treat the token as valid.

const APPWRITE_ENDPOINT = getEnv('APPWRITE_ENDPOINT', '');
const APPWRITE_PROJECT_ID = getEnv('APPWRITE_PROJECT_ID', '');

export function isAuthEnabled(): boolean {
  return APPWRITE_ENDPOINT.length > 0 && APPWRITE_PROJECT_ID.length > 0;
}

export async function verifyAppwriteJwt(token: string): Promise<AuthContext> {
  if (!isAuthEnabled()) {
    throw new Error('Appwrite auth is not enabled (APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID not set)');
  }

  const endpoint = APPWRITE_ENDPOINT;
  const projectId = APPWRITE_PROJECT_ID;

  const url = new URL('/v1/account', endpoint);

  const account = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: url.pathname + (url.search || ''),
        method: 'GET',
        headers: {
          'X-Appwrite-Project': projectId,
          'X-Appwrite-JWT': token,
        },
        timeout: 5000,
      },
      (res) => {
        const chunks: string[] = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = chunks.join('');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            logger.error('Appwrite /account JWT validation failed', {
              status: res.statusCode,
              body: raw,
            });
            return reject(new Error(`Appwrite /account validation failed with status ${res.statusCode}`));
          }
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
      req.destroy(new Error('Appwrite /account request timeout'));
    });
    req.end();
  });

  const userId = (account.$id as string | undefined) ?? undefined;
  const orgId = undefined;

  return {
    via: 'jwt',
    userId,
    orgId,
    raw: account,
  };
}


