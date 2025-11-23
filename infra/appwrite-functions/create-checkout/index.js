import { Client, Databases, Users } from 'node-appwrite';
import Stripe from 'stripe';

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
    const { orgId, planId } = body;

    if (!orgId || !planId) {
      return res.json({ error: 'orgId and planId are required' }, 400, headers);
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
    const users = new Users(client);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Validate that this org exists in Appwrite billing first. The orgId here
    // must match the Cockroach org.id because the ProofMesh API created this
    // document with that same identifier.
    const org = await databases.getDocument(
      process.env.DATABASE_ID,
      process.env.ORGANIZATIONS_COLLECTION_ID,
      orgId,
    );

    if (org.created_by_user_id !== userId) {
      return res.json({ error: 'Forbidden' }, 403, headers);
    }

    const PRICE_IDS = {
      professional: 'price_1SWLRDBzlOMsIkkzyAthXYm8',
      business: 'price_1SWLRZBzlOMsIkkzB1KAmUIg',
      enterprise: 'price_1SWLRkBzlOMsIkkz4YyRo11y',
    };

    const priceId = PRICE_IDS[planId];
    if (!priceId) {
      return res.json({ error: 'Invalid plan' }, 400, headers);
    }

    const user = await users.get(userId);

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers['origin'] || 'https://yourdomain.com';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/orgs/${orgId}`,
      cancel_url: `${origin}/orgs/${orgId}`,
      metadata: {
        orgId,
        proofmesh_org_id: orgId,
        userId,
        planId,
      },
      subscription_data: {
        metadata: {
          orgId,
          proofmesh_org_id: orgId,
          userId,
          planId,
        },
      },
    });

    log(`Checkout session created: ${session.id}`);

    return res.json({ checkoutUrl: session.url }, 200, headers);
  } catch (err) {
    error(`Error creating checkout: ${err.message || String(err)}`);
    return res.json({ error: err.message || 'Internal error' }, 500, headers);
  }
};


