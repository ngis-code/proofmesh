import { useEffect, useState } from 'react';
import { Shield, Globe, Activity, CheckCircle2, Clock, Users, FileCheck, AlertCircle } from 'lucide-react';
import { useApi } from '@/lib/api';
import { useOrgUsage } from '@/hooks/useOrgUsage';

interface Org {
  id: string;
  name: string;
  created_at: string;
}

interface OrgOverviewProps {
  org: Org | null;
}

interface Proof {
  id: string;
  org_id: string;
  hash: string;
  artifact_type: 'file' | 'verify';
  status: 'confirmed' | 'failed';
  created_at: string;
}

interface ProofsResponse {
  proofs: Proof[];
}

export default function OrgOverview({ org }: OrgOverviewProps) {
  const api = useApi();
  const { usage, loading: usageLoading } = useOrgUsage(org?.id || '');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!org?.id) return;
      
      setLoading(true);
      try {
        const proofsData = await api.get<ProofsResponse>('/api/proofs?limit=100');
        
        // Filter proofs for this org
        const orgProofs = proofsData.proofs.filter(p => p.org_id === org.id);
        setProofs(orgProofs);
      } catch (error) {
        console.error('Failed to load org data:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [org?.id]);

  // Calculate real stats from proofs
  const totalStamps = proofs.filter(p => p.artifact_type === 'file' && p.status === 'confirmed').length;
  const totalVerifications = proofs.filter(p => p.artifact_type === 'verify').length;
  const successfulVerifications = proofs.filter(p => p.artifact_type === 'verify' && p.status === 'confirmed').length;
  const failedVerifications = totalVerifications - successfulVerifications;

  const stats = [
    { label: 'Total Stamps', value: (usage?.monthly_ops.current || 0).toString(), icon: Shield, color: 'blue' },
    { label: 'Successful Verifications', value: successfulVerifications.toString(), icon: CheckCircle2, color: 'green' },
    { label: 'Failed Verifications', value: failedVerifications.toString(), icon: AlertCircle, color: 'red' },
    { label: 'Team Members', value: (usage?.team.current || 0).toString(), icon: Users, color: 'purple' },
  ];

  // Get recent activity from proofs
  const recentActivity = proofs
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map(proof => {
      const timeAgo = getTimeAgo(new Date(proof.created_at));
      const isStamp = proof.artifact_type === 'file';
      const isSuccess = proof.status === 'confirmed';
      
      return {
        action: isStamp ? 'Document stamped' : 'Verification completed',
        file: proof.hash.substring(0, 40) + '...',
        time: timeAgo,
        status: isSuccess ? 'success' : 'failed',
      };
    });

  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(loading || usageLoading) ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="card" style={{ padding: '1.5rem' }}>
              <div className="animate-pulse space-y-4">
                <div className="w-14 h-14 rounded-xl bg-slate-700"></div>
                <div className="h-8 bg-slate-700 rounded w-20"></div>
                <div className="h-4 bg-slate-700 rounded w-24"></div>
              </div>
            </div>
          ))
        ) : (
          stats.map((stat, idx) => (
            <div
              key={stat.label}
              className="relative group"
              style={{ animation: `fadeIn 0.5s ease ${idx * 0.1}s both` }}
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#0ea5e9] to-[#22c55e] rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-500"></div>
              <div className="relative card" style={{ padding: '1.5rem' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br shadow-xl ${
                    stat.color === 'blue' ? 'from-[#0ea5e9] to-[#06b6d4]' : 
                    stat.color === 'green' ? 'from-[#22c55e] to-[#16a34a]' :
                    stat.color === 'red' ? 'from-[#ef4444] to-[#dc2626]' :
                    'from-[#8b5cf6] to-[#7c3aed]'
                  } flex items-center justify-center`}>
                    <stat.icon className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization Info */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                Organization Details
              </h2>
            </div>
            <div className="card-body space-y-6">
              {org ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Organization Name</p>
                      <p className="text-lg font-bold text-slate-100">{org.name}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Created</p>
                      <p className="text-lg font-bold text-slate-100">{new Date(org.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Organization ID</p>
                      <div className="text-sm font-mono bg-slate-900/70 px-4 py-3 rounded-lg border border-slate-700 text-slate-300">
                        {org.id}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></div>
                        <span className="text-lg font-bold text-emerald-400">Active & Operational</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-700/50">
                    <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-[#0ea5e9]/10 to-[#22c55e]/10 rounded-xl border border-slate-700/50">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-bold">Distributed Validation Network</p>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          This organization is backed by CockroachDB and participates in the ProofMesh validator mesh network for distributed proof validation and consensus.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <Globe className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-lg text-slate-400 font-medium">No organization metadata loaded.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-title">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                Recent Activity
              </h2>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="animate-pulse flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-700"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity, idx) => (
                    <div 
                      key={idx} 
                      className="flex gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg ${
                        activity.status === 'success' 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {activity.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold group-hover:text-[#0ea5e9] transition-colors">
                          {activity.action}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-medium font-mono">{activity.file}</p>
                        <p className="text-xs text-slate-500 mt-1.5">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
