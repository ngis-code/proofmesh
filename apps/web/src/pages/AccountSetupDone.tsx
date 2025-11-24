import { useAuth } from '@/contexts/AuthContext';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function AccountSetupDonePage() {
  const { user } = useAuth();
  
  return (
    <div className="login-layout">
      <div className="login-card">
        {/* Icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          <p className="text-slate-400">
            {user?.email
              ? `We've sent a password setup email to ${user.email}.`
              : "We've sent a password setup email to your address."}
          </p>
        </div>

        {/* Info */}
        <div className="alert">
          <p className="text-sm text-center">
            Follow the link in your inbox to choose a secure password. You can close this window.
          </p>
        </div>
      </div>
    </div>
  );
}
