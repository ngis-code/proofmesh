import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/api';

export interface OrgUsage {
  plan: string;
  subscription_status: string;
  team: {
    current: number;
    limit: number;
  };
  monthly_ops: {
    current: number;
    limit: number;
  };
}

export function useOrgUsage(orgId: string) {
  const api = useApi();
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<OrgUsage>(`/api/orgs/${orgId}/usage`);
      setUsage(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch usage data');
      console.error('Error fetching usage:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const isTeamAtLimit = usage ? (usage.team.limit !== -1 && usage.team.current >= usage.team.limit) : false;
  const isOpsAtLimit = usage ? (usage.monthly_ops.limit !== -1 && usage.monthly_ops.current >= usage.monthly_ops.limit) : false;

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
    isTeamAtLimit,
    isOpsAtLimit,
  };
}
