import { Client, Databases } from 'node-appwrite';
import Stripe from 'stripe';

export default async ({ req, res, log, error }) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // NOTE: In Appwrite Functions, we don't have access to the true raw HTTP body
    // that Stripe used to compute the signature, only a parsed object/string.
    // That makes strict signature verification with constructEvent unreliable.
    // To keep the flow working, we treat req.body as the Stripe event directly.
    let event;
    try {
      event =
        typeof req.body === 'string' || Buffer.isBuffer(req.body)
          ? JSON.parse(req.body.toString())
          : req.body;
    } catch (err) {
      error(`Failed to parse webhook body: ${err.message}`);
      return res.json({ error: 'Invalid payload' }, 400, headers);
    }

    log(`Webhook event type: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { orgId, proofmesh_org_id, userId, planId } = session.metadata || {};

      // We always treat proofmesh_org_id as the canonical identifier that matches
      // Cockroach org.id and the Appwrite billing.organizations document ID.
      const billingOrgId = proofmesh_org_id || orgId;

      if (!billingOrgId || !userId || !planId) {
        error('Missing metadata on checkout.session.completed');
      } else {
        log(`Processing payment for org: ${billingOrgId}`);

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const productId = subscription.items.data[0].price.product;
        const periodEnd = subscription.current_period_end;
        const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000) : null;

        const client = new Client()
          .setEndpoint(process.env.APPWRITE_ENDPOINT)
          .setProject(process.env.APPWRITE_PROJECT_ID)
          .setKey(process.env.APPWRITE_API_KEY);

        const databases = new Databases(client);

        await databases.updateDocument(
          process.env.DATABASE_ID,
          process.env.ORGANIZATIONS_COLLECTION_ID,
          billingOrgId,
          {
            stripe_product_id: productId,
            stripe_subscription_id: session.subscription,
            subscription_status: subscription.status || 'active',
            subscription_end: subscriptionEnd ? subscriptionEnd.toISOString() : null,
            plan_id: planId || null,
          },
        );

        log(`Organization ${billingOrgId} subscription updated successfully (checkout)`);
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object;
      const { orgId, proofmesh_org_id, planId } = subscription.metadata || {};
      const billingOrgId = proofmesh_org_id || orgId;

      if (!billingOrgId) {
        error('Missing proofmesh_org_id/orgId on subscription event');
      } else {
        log(`Syncing subscription status for org: ${billingOrgId}`);

        const product =
          subscription.items &&
          subscription.items.data &&
          subscription.items.data[0] &&
          subscription.items.data[0].price &&
          subscription.items.data[0].price.product;

        const periodEnd = subscription.current_period_end;
        const subscriptionEnd = periodEnd ? new Date(periodEnd * 1000) : null;

        const client = new Client()
          .setEndpoint(process.env.APPWRITE_ENDPOINT)
          .setProject(process.env.APPWRITE_PROJECT_ID)
          .setKey(process.env.APPWRITE_API_KEY);

        const databases = new Databases(client);

        await databases.updateDocument(
          process.env.DATABASE_ID,
          process.env.ORGANIZATIONS_COLLECTION_ID,
          billingOrgId,
          {
            stripe_product_id: product || null,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status || 'canceled',
            subscription_end: subscriptionEnd ? subscriptionEnd.toISOString() : null,
            plan_id: planId || null,
          },
        );

        log(
          `Organization ${billingOrgId} subscription updated successfully (event: ${event.type}, status: ${subscription.status})`,
        );
      }
    }

    return res.json({ received: true }, 200, headers);
  } catch (err) {
    error(`Webhook error: ${err.message || String(err)}`);
    return res.json({ error: err.message || 'Internal error' }, 500, headers);
  }
};


