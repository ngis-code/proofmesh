import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import NetworkVisualization from '@/components/NetworkVisualization';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';

interface Validator {
  id: string;
  name: string;
  region: string;
  enabled: boolean;
  online: boolean;
  created_at: string;
  last_seen_at: string | null;
}

interface ValidatorsResponse {
  validators: Validator[];
}

interface ValidatorStatsRow {
  validator_id: string;
  total_runs: number;
  total_valid: number;
  total_invalid: number;
  total_unknown: number;
  last_seen_at: string | null;
}

interface ValidatorStatsResponse {
  stats: ValidatorStatsRow[];
}

interface HealthResponse {
  status: string;
}

export default function NetworkPage() {
  const api = useApi();
  const [validators, setValidators] = useState<Validator[]>([]);
  const [stats, setStats] = useState<ValidatorStatsRow[]>([]);
  const [health, setHealth] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, validatorsRes, statsRes] = await Promise.all([
        api.get<HealthResponse>('/api/health'),
        api.get<ValidatorsResponse>('/api/validators'),
        api.get<ValidatorStatsResponse>('/api/validator-stats'),
      ]);
      setHealth(healthRes.status);
      setValidators(validatorsRes.validators);
      setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load network data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onlineCount = validators.filter((v) => v.online).length;

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            ProofMesh Network
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Real-time validator mesh visualization</p>
        </div>
        <Button onClick={load} disabled={loading} size="lg" className="gap-2">
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg">
          <strong>Error: </strong>
          {error}
        </div>
      )}

      <NetworkVisualization 
        validators={validators} 
        onlineCount={onlineCount} 
        health={health} 
      />
    </div>
  );
}
