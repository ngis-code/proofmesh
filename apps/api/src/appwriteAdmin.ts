import http from 'http';
import https from 'https';
import { logger } from '@proofmesh/shared-config';

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT ?? '';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? '';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY ?? '';

// Optional: billing database/collection used to mirror org billing state
// from Appwrite into the ProofMesh control plane.
const APPWRITE_BILLING_DATABASE_ID = process.env.APPWRITE_BILLING_DATABASE_ID ?? '';
const APPWRITE_BILLING_ORGS_COLLECTION_ID =
  process.env.APPWRITE_BILLING_ORGS_COLLECTION_ID ?? '';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
  logger.info('Appwrite admin client disabled (APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID not set)');
} else if (!APPWRITE_API_KEY) {
  logger.info('Appwrite admin client has no APPWRITE_API_KEY; invite endpoints will be disabled');
}

class AppwriteAdminError extends Error {
  status: number;
  body: string;
  path: string;

  constructor(message: string, status: number, body: string, path: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

async function appwriteRequest<T>(opts: {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
}): Promise<T> {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error(
      'Appwrite admin API not configured (APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID/APPWRITE_API_KEY)',
    );
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
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
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
            return reject(
              new AppwriteAdminError(
                `Appwrite admin request failed with status ${res.statusCode}`,
                res.statusCode ?? 0,
                raw,
                opts.path,
              ),
            );
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

export async function createInviteForEmail(email: string): Promise<{
  user: AppwriteUser;
}> {
  const user = await ensureAppwriteUserForEmail(email);
  return { user };
}

export async function deleteAppwriteUser(userId: string): Promise<void> {
  await appwriteRequest<unknown>({
    method: 'DELETE',
    path: `/v1/users/${userId}`,
  });
}

// -------- Billing org helpers (Appwrite Databases) --------

interface BillingOrgDocument {
  $id: string;
  name: string;
  created_by_user_id: string;
  stripe_product_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
}

function isBillingConfigured(): boolean {
  return (
    !!APPWRITE_ENDPOINT &&
    !!APPWRITE_PROJECT_ID &&
    !!APPWRITE_API_KEY &&
    !!APPWRITE_BILLING_DATABASE_ID &&
    !!APPWRITE_BILLING_ORGS_COLLECTION_ID
  );
}

export async function upsertBillingOrg(opts: {
  orgId: string;
  name: string;
  createdByUserId: string;
}): Promise<BillingOrgDocument | null> {
  if (!isBillingConfigured()) {
    logger.info('Billing org upsert skipped; Appwrite billing env vars not fully configured');
    return null;
  }

  const data = {
    name: opts.name,
    created_by_user_id: opts.createdByUserId,
    // Initial subscription fields; these will be updated by the Stripe webhook.
    stripe_product_id: null,
    stripe_subscription_id: null,
    subscription_status: 'none',
    subscription_end: null,
  };

  const basePath = `/v1/databases/${APPWRITE_BILLING_DATABASE_ID}/collections/${APPWRITE_BILLING_ORGS_COLLECTION_ID}`;

  try {
    // Try to create the document with orgId as the Appwrite document ID so
    // billing.organizations and Cockroach orgs share a stable identifier.
    return await appwriteRequest<BillingOrgDocument>({
      method: 'POST',
      path: `${basePath}/documents`,
      body: {
        documentId: opts.orgId,
        data,
      },
    });
  } catch (err) {
    if (err instanceof AppwriteAdminError && err.status === 409) {
      // Document already exists, so fall back to a partial update.
      return await appwriteRequest<BillingOrgDocument>({
        method: 'PATCH',
        path: `${basePath}/documents/${opts.orgId}`,
        body: {
          data,
        },
      });
    }
    throw err;
  }
}

export async function getBillingOrg(orgId: string): Promise<BillingOrgDocument | null> {
  if (!isBillingConfigured()) {
    logger.info('Billing org lookup skipped; Appwrite billing env vars not fully configured');
    return null;
  }

  const basePath = `/v1/databases/${APPWRITE_BILLING_DATABASE_ID}/collections/${APPWRITE_BILLING_ORGS_COLLECTION_ID}`;

  try {
    return await appwriteRequest<BillingOrgDocument>({
      method: 'GET',
      path: `${basePath}/documents/${orgId}`,
    });
  } catch (err) {
    if (err instanceof AppwriteAdminError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function deleteBillingOrg(orgId: string): Promise<void> {
  if (!isBillingConfigured()) {
    logger.info('Billing org delete skipped; Appwrite billing env vars not fully configured');
    return;
  }

  const basePath = `/v1/databases/${APPWRITE_BILLING_DATABASE_ID}/collections/${APPWRITE_BILLING_ORGS_COLLECTION_ID}`;

  try {
    await appwriteRequest<unknown>({
      method: 'DELETE',
      path: `${basePath}/documents/${orgId}`,
    });
  } catch (err) {
    if (err instanceof AppwriteAdminError && err.status === 404) {
      // Already gone; nothing to do.
      return;
    }
    throw err;
  }
}

