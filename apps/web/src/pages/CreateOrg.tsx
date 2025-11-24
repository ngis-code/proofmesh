import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/api';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionPlans';
import { Building2, Check, Crown, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Client, Functions } from 'appwrite';

const planIcons = {
  professional: Zap,
  business: Building2,
  enterprise: Crown,
};

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();
  const api = useApi();
  const [orgName, setOrgName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('professional');
  const [loading, setLoading] = useState(false);

  const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
  
  const functions = new Functions(client);

  const allPlans = Object.values(SUBSCRIPTION_PLANS);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error('Please enter an organization name');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create org via ProofMesh API (also mirrors to Appwrite billing)
      const createResponse = await api.post<{ org: { id: string; name: string } }>('/api/orgs', {
        name: orgName.trim(),
      });

      const orgId = createResponse.org.id;

      // Step 2: Redirect to Stripe checkout for selected plan
      toast.info('Redirecting to secure payment...');
      
      const checkoutResult = await functions.createExecution(
        import.meta.env.VITE_APPWRITE_FUNCTION_CREATE_CHECKOUT,
        JSON.stringify({ orgId, planId: selectedPlan }),
        false
      );

      const checkoutResponse = JSON.parse(checkoutResult.responseBody);
      
      if (checkoutResult.responseStatusCode !== 200) {
        throw new Error(checkoutResponse.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = checkoutResponse.checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#0f1419',
        position: 'relative',
      }}
    >
      {/* Background */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(14, 165, 233, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="container mx-auto px-4 py-16" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 700,
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Create New Organization
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#9ca3af', maxWidth: '42rem', margin: '0 auto' }}>
            Choose a plan for your organization
          </p>
        </div>

        {/* Org Name Input */}
        <div style={{ maxWidth: '32rem', margin: '0 auto 3rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb', fontSize: '0.875rem' }}>
            Organization Name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Inc."
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid #30363d',
              background: '#161b22',
              color: '#e5e7eb',
              fontSize: '1rem',
            }}
          />
        </div>

        {/* Plan Selection */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
            maxWidth: '80rem',
            margin: '0 auto 3rem',
          }}
        >
          {allPlans.map((plan) => {
            const Icon = planIcons[plan.id as keyof typeof planIcons] || Building2;
            const isSelected = selectedPlan === plan.id;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  background: '#161b22',
                  border: isSelected ? '2px solid #0ea5e9' : '1px solid #30363d',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.5)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = '#30363d';
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-0.5rem',
                      right: '-0.5rem',
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check style={{ width: '1rem', height: '1rem', color: '#020617' }} />
                  </div>
                )}

                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    background: isSelected
                      ? 'linear-gradient(135deg, #0ea5e9, #22c55e)'
                      : 'rgba(14, 165, 233, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Icon style={{ width: '1.25rem', height: '1.25rem', color: isSelected ? '#020617' : '#0ea5e9' }} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                  {plan.name}
                </h3>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.5rem' }}>
                  {plan.price}
                  {plan.price !== '$0' && <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>/mo</span>}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>{plan.description}</p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {plan.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <Check style={{ width: '1rem', height: '1rem', color: '#22c55e', flexShrink: 0 }} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Create Button */}
        <div style={{ maxWidth: '32rem', margin: '0 auto', textAlign: 'center' }}>
          <button
            onClick={handleCreateOrg}
            disabled={loading || !orgName.trim()}
            style={{
              width: '100%',
              padding: '1rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: loading ? '#666' : 'linear-gradient(135deg, #0ea5e9, #22c55e)',
              color: '#020617',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
            }}
          >
            {loading ? 'Creating...' : selectedPlan === 'free' ? 'Create Free Organization' : 'Continue to Payment'}
          </button>
          <button
            onClick={() => navigate('/orgs')}
            style={{
              marginTop: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
