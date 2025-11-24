import { Check, AlertTriangle, Crown, Zap, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

const plans = Object.values(SUBSCRIPTION_PLANS);

const planIcons = {
  professional: Zap,
  business: Building2,
  enterprise: Crown,
};

export default function PricingPlans() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubscribe = async (priceId: string, planId: string, planName: string) => {
    if (!user) {
      navigate("/signup");
      return;
    }

    // Direct users to create an organization first
    toast.info('Create an organization to select a plan');
    navigate('/create-org');
  };

  const handleSkipForNow = () => {
    navigate('/orgs');
  };

  return (
    <div className="min-h-screen" style={{ 
      background: '#0f1419',
      position: 'relative',
    }}>
      {/* Animated background */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(14, 165, 233, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.15) 0%, transparent 50%)',
        backgroundSize: '100% 100%',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div className="container mx-auto px-4 py-16" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="text-center mb-12" style={{
          animation: 'fadeIn 0.8s ease-out',
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Choose Your Perfect Plan
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#9ca3af',
            maxWidth: '42rem',
            margin: '0 auto',
          }}>
            Scale your verification infrastructure with plans designed for every stage of growth
          </p>
        </div>

        {/* Alert */}
        <div style={{
          maxWidth: '48rem',
          margin: '0 auto 3rem',
          padding: '1rem 1.25rem',
          background: 'rgba(14, 165, 233, 0.1)',
          border: '1px solid rgba(14, 165, 233, 0.3)',
          borderRadius: '0.75rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}>
          <AlertTriangle style={{ width: '1.25rem', height: '1.25rem', color: '#0ea5e9', flexShrink: 0, marginTop: '0.125rem' }} />
          <p style={{ fontSize: '0.875rem', color: '#93c5fd', lineHeight: 1.6 }}>
            <strong>Note:</strong> Plans are applied per organization. Create or select an organization to choose a subscription plan.
          </p>
        </div>
        
        {/* Pricing Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '75rem',
          margin: '0 auto',
        }}>
          {plans.map((plan, index) => {
            const Icon = planIcons[plan.id as keyof typeof planIcons];
            return (
              <div 
                key={plan.id}
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '0.75rem',
                  padding: '2rem 1.5rem',
                  position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: `fadeIn 0.6s ease-out ${index * 0.1}s both`,
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.5)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(14, 165, 233, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#30363d';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                }}>
                  {Icon && <Icon style={{ width: '1.5rem', height: '1.5rem', color: '#020617' }} />}
                </div>

                {/* Plan Name & Description */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: '0.5rem',
                }}>
                  {plan.name}
                </h3>
                <p style={{
                  fontSize: '0.9rem',
                  color: '#94a3b8',
                  marginBottom: '1.5rem',
                }}>
                  {plan.description}
                </p>

                {/* Price */}
                <div style={{ marginBottom: '2rem' }}>
                  <span style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: '#e5e7eb',
                  }}>
                    {plan.price}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '1rem' }}>/month</span>
                </div>

                {/* Features */}
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 2rem 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                    }}>
                      <Check style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        color: '#22c55e',
                        flexShrink: 0,
                        marginTop: '0.125rem',
                      }} />
                      <span style={{
                        fontSize: '0.875rem',
                        color: '#cbd5e1',
                        lineHeight: 1.5,
                      }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan.priceId, plan.id, plan.name)}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
                    color: '#020617',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(14, 165, 233, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)';
                  }}
                >
                  Select Plan
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '3rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
        }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            All plans include a 14-day money-back guarantee. Need a custom solution?{" "}
            <span style={{ color: '#0ea5e9', cursor: 'pointer' }}>Contact our sales team</span>
          </p>
          <button
            onClick={handleSkipForNow}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid #30363d',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#9ca3af',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.5)';
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#30363d';
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)';
            }}
          >
            View My Organizations
          </button>
        </div>
      </div>
    </div>
  );
}
