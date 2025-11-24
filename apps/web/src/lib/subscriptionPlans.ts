export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  priceId: string;
  productId: string;
  description: string;
  maxTeamMembers: number;
  maxVerifications: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    price: '$299',
    priceId: 'price_1SWLRDBzlOMsIkkzyAthXYm8',
    productId: 'prod_TTI1VMfeKaJ98Y',
    description: 'For teams ready to scale',
    maxTeamMembers: 20,
    maxVerifications: 5000,
    features: [
      'Up to 20 team members',
      '5,000 verifications per month',
      'Priority email support',
      'Advanced analytics dashboard',
      'API access with rate limiting',
      'Custom branding',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: '$799',
    priceId: 'price_1SWLRZBzlOMsIkkzB1KAmUIg',
    productId: 'prod_TTI12uQufKtVb3',
    description: 'For growing enterprises',
    maxTeamMembers: 50,
    maxVerifications: 10000,
    features: [
      'Up to 50 team members',
      '10,000 verifications per month',
      'Dedicated account manager',
      'Priority support (24/7)',
      'Advanced analytics & reporting',
      'Custom integrations',
      'White-label options',
      'SLA guarantee',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$2,499',
    priceId: 'price_1SWLRkBzlOMsIkkz4YyRo11y',
    productId: 'prod_TTI1fA7ZIundkK',
    description: 'Maximum scale',
    maxTeamMembers: -1, // unlimited
    maxVerifications: -1, // unlimited
    features: [
      'Unlimited team members',
      'Unlimited verifications',
      'White-label platform',
      '24/7 premium support',
      'Custom SLAs',
      'Dedicated infrastructure',
      'Custom feature development',
      'On-premise deployment options',
    ],
  },
};

export const FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'Free',
  price: '$0',
  priceId: '',
  productId: '',
  description: 'Get started with basic features',
  maxTeamMembers: 1,
  maxVerifications: 100,
  features: [
    'Single user',
    '100 verifications per month',
    'Community support',
    'Basic analytics',
  ],
};

export function getPlanByProductId(productId: string | null): SubscriptionPlan {
  if (!productId) return FREE_PLAN;
  
  const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.productId === productId);
  return plan || FREE_PLAN;
}

export function getPlanById(planId: string): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[planId] || FREE_PLAN;
}
