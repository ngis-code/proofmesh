import { Client, Databases, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return res.json({}, 200, headers);
  }

  try {
    const body = req.body ? JSON.parse(req.body) : {};
    const { name, planId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.json({ error: 'Organization name is required' }, 400, headers);
    }

    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      return res.json({ error: 'Unauthorized' }, 401, headers);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const existingOrgs = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.ORGANIZATIONS_COLLECTION_ID,
      [Query.equal('created_by_user_id', userId)],
    );

    const plan = planId || 'free';

    if (plan === 'free' && existingOrgs.total >= 1) {
      return res.json({ error: 'free_plan_limit' }, 400, headers);
    }

    const orgData = {
      name: name.trim(),
      created_by_user_id: userId,
      subscription_status: plan === 'free' ? 'active' : 'pending',
      stripe_product_id: '',
      stripe_subscription_id: '',
      subscription_end: null,
    };

    const org = await databases.createDocument(
      process.env.DATABASE_ID,
      process.env.ORGANIZATIONS_COLLECTION_ID,
      'unique()',
      orgData,
    );

    log(`Organization created: ${org.$id}`);

    return res.json(
      {
        org: { id: org.$id, name: org.name },
        requiresPayment: plan !== 'free',
      },
      200,
      headers,
    );
  } catch (err) {
    error(`Error creating org: ${err.message || String(err)}`);
    return res.json({ error: err.message || 'Internal error' }, 500, headers);
  }
};


