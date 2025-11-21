import http from 'http';
import https from 'https';
import { logger } from '@proofmesh/shared-config';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT ?? '';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? '';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY ?? '';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
  logger.info('Appwrite admin client disabled (APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID not set)');
} else if (!APPWRITE_API_KEY) {
  logger.info('Appwrite admin client has no APPWRITE_API_KEY; invite endpoints will be disabled');
}

async function appwriteRequest<T>(opts: {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}): Promise<T> {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error('Appwrite admin API not configured (APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID/APPWRITE_API_KEY)');
  }

  const url = new URL(opts.path, APPWRITE_ENDPOINT);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const payload = opts.body ? JSON.stringify(opts.body) : '';

  return new Promise<T>((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: url.pathname + (url.search || ''),
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Appwrite-Project': APPWRITE_PROJECT_ID,
          'X-Appwrite-Key': APPWRITE_API_KEY,
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
            logger.error('Appwrite admin request failed', {
              path: opts.path,
              status: res.statusCode,
              body: raw,
            });
            return reject(new Error(`Appwrite admin request failed with status ${res.statusCode}`));
          }
          if (!raw) {
            resolve({} as T);
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy(new Error('Appwrite admin request timeout'));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

interface AppwriteUser {
  $id: string;
  email: string;
}

interface AppwriteUsersList {
  total: number;
  users: AppwriteUser[];
}

export async function ensureAppwriteUserForEmail(email: string): Promise<AppwriteUser> {
  // Try to create a user; if email already exists we fall back to lookup.
  try {
    const created = await appwriteRequest<AppwriteUser>({
      method: 'POST',
      path: '/v1/users',
      body: {
        userId: 'unique()',
        email,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      },
    });
    return created;
  } catch (err: any) {
    // If creation failed (e.g., email exists), try to find by search.
    logger.error('Appwrite create user failed, attempting lookup', { email, err });
    const list = await appwriteRequest<AppwriteUsersList>({
      method: 'GET',
      path: `/v1/users?search=${encodeURIComponent(email)}`,
    });
    if (!list.users || list.users.length === 0) {
      throw new Error('Appwrite user not found for email and creation failed');
    }
    return list.users[0];
  }
}


