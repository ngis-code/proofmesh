import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { SUBSCRIPTION_PLANS, FREE_PLAN } from '@/lib/subscriptionPlans';
import { CreditCard, AlertCircle, RefreshCw } from 'lucide-react';
import { Client, Functions } from 'appwrite';
import { toast } from 'sonner';

interface BillingOrg {
  $id: string;
  name: string;
  created_by_user_id: string;
  stripe_product_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  subscription_end: string | null;
}

interface BillingResponse {
  billing: BillingOrg;
}

interface OrgBillingStatusProps {
  orgId: string;
}

export default function OrgBillingStatus({ orgId }: OrgBillingStatusProps) {
  const api = useApi();
  const [billing, setBilling] = useState<BillingOrg | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
  
  const functions = new Functions(client);

  const loadBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<BillingResponse>(`/api/orgs/${orgId}/billing`);
      setBilling(response.billing);
    } catch (err: any) {
      if (err.message === 'billing_not_found') {
        setError('Billing not configured for this organization');
      } else {
        setError(err.message || 'Failed to load billing info');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBilling();
  }, [orgId]);

  const getCurrentPlan = () => {
    // If subscription is canceled or no product ID, return free plan
    if (!billing?.stripe_product_id || billing.subscription_status === 'canceled') {
      return FREE_PLAN;
    }
    
    const plan = Object.values(SUBSCRIPTION_PLANS).find(
      p => p.productId === billing.stripe_product_id
    );
    return plan || FREE_PLAN;
  };

  const handleUpgrade = async (planId: string) => {
    setLoading(true);
    try {
      const checkoutResult = await functions.createExecution(
        import.meta.env.VITE_APPWRITE_FUNCTION_CREATE_CHECKOUT,
        JSON.stringify({ orgId, planId }),
        false
      );

      const checkoutResponse = JSON.parse(checkoutResult.responseBody);
      
      if (checkoutResult.responseStatusCode !== 200) {
        throw new Error(checkoutResponse.error || 'Failed to create checkout session');
      }

      // Open checkout in new tab
      window.open(checkoutResponse.checkoutUrl, '_blank');
      toast.success('Opening checkout in new tab...');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const portalResult = await functions.createExecution(
        import.meta.env.VITE_APPWRITE_FUNCTION_CUSTOMER_PORTAL,
        JSON.stringify({ orgId }),
        false
      );

      const portalResponse = JSON.parse(portalResult.responseBody);
      
      if (portalResult.responseStatusCode !== 200) {
        throw new Error(portalResponse.error || 'Failed to open customer portal');
      }

      // Open portal in new tab
      window.open(portalResponse.url, '_blank');
      toast.success('Opening Stripe portal...');
    } catch (err: any) {
      toast.error(err.message || 'Failed to open customer portal');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !billing) {
    return (
      <div className="card">
        <div className="card-title">
          <h3>Subscription</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-[#9ca3af]">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-title">
          <h3>Subscription</h3>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-2 text-[#f59e0b]">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = getCurrentPlan();
  const isActive = billing?.subscription_status === 'active';
  const isFree = currentPlan.id === 'free';
  const subscriptionEnd = billing?.subscription_end 
    ? new Date(billing.subscription_end).toLocaleDateString()
    : null;

  return (
    <div className="card">
      <div className="card-title">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#0ea5e9]" />
          <h3>Subscription</h3>
        </div>
        <button
          type="button"
          onClick={loadBilling}
          disabled={loading}
          className="btn-secondary"
          title="Refresh billing status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="card-body space-y-4">
        {isFree && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <h4 className="font-semibold text-red-400">Limited Features</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              You're on the Free plan. Upgrade to unlock API keys, team management, stamping, verification, and advanced features.
            </p>
          </div>
        )}
        
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-400">Current Plan</span>
            <div className="flex items-center gap-2">
              <span className={`tag ${isActive ? 'green' : isFree ? '' : 'bg-red-900/40 text-red-400'}`}>
                {isActive ? 'active' : billing?.subscription_status || 'free'}
              </span>
              {isActive && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="btn-secondary text-xs"
                >
                  Manage
                </button>
              )}
            </div>
          </div>
          <h4 className="text-2xl font-bold text-slate-100 mb-2">{currentPlan.name}</h4>
          <p className="text-sm text-slate-400">{currentPlan.description}</p>
          {subscriptionEnd && isActive && (
            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-700">
              Renews on {subscriptionEnd}
            </p>
          )}
          {billing?.subscription_status === 'canceled' && subscriptionEnd && (
            <p className="text-xs text-red-400 mt-3 pt-3 border-t border-slate-700">
              Access ends on {subscriptionEnd}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-base font-semibold text-slate-100">Available Plans</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
              const isCurrent = plan.productId === billing?.stripe_product_id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading || isCurrent}
                  className={`relative p-6 rounded-xl border-2 transition-all text-left group ${
                    isCurrent
                      ? 'border-cyan-500/60 bg-cyan-950/30 cursor-not-allowed'
                      : 'border-slate-700 bg-slate-900/60 hover:border-cyan-500/40 hover:shadow-glow'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-4 px-3 py-1 bg-cyan-500 text-slate-950 text-xs font-bold rounded-full">
                      Current Plan
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="font-semibold text-base text-slate-200">{plan.name}</div>
                    <div className="text-3xl font-bold text-white">{plan.price}</div>
                    <div className="text-sm text-slate-300 pt-1">{plan.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {isActive && (
            <p className="text-sm text-slate-400 mt-3">
              Use "Manage Subscription" above to cancel or modify your subscription through Stripe.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
