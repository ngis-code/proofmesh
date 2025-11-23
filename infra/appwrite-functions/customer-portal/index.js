import { Client, Databases } from 'node-appwrite';
import Stripe from 'stripe';

const DATABASE_ID = process.env.DATABASE_ID;
const ORGANIZATIONS_COLLECTION_ID = process.env.ORGANIZATIONS_COLLECTION_ID;

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
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      error('No user ID in headers');
      return res.json({ error: 'unauthorized' }, 401, headers);
    }

    const body = req.body ? JSON.parse(req.body) : {};
    const { orgId } = body;

    if (!orgId) {
      error('Missing orgId');
      return res.json({ error: 'orgId required' }, 400, headers);
    }

    log(`Creating portal session for org: ${orgId}`);

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const billingOrg = await databases.getDocument(
      DATABASE_ID,
      ORGANIZATIONS_COLLECTION_ID,
      orgId,
    );

    if (!billingOrg.stripe_subscription_id) {
      error('No active subscription found for org');
      return res.json({ error: 'no_subscription' }, 400, headers);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const subscription = await stripe.subscriptions.retrieve(
      billingOrg.stripe_subscription_id,
    );

    const origin = req.headers['origin'] || 'https://yourdomain.com';

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customer,
      return_url: `${origin}/orgs/${orgId}`,
    });

    log(`Portal session created: ${session.id}`);

    return res.json({ url: session.url }, 200, headers);
  } catch (err) {
    error(`Portal creation failed: ${err.message || String(err)}`);
    return res.json({ error: err.message || 'Internal error' }, 500, headers);
  }
};



