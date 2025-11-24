import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AccountSetup from "./pages/AccountSetup";
import AccountSetupDone from "./pages/AccountSetupDone";
import InviteAccept from "./pages/InviteAccept";
import PasswordReset from "./pages/PasswordReset";
import MyOrgs from "./pages/MyOrgs";
import Network from "./pages/Network";
import OrgDashboard from "./pages/OrgDashboard";
import PublicVerify from "./pages/PublicVerify";
import PricingPlans from "./pages/PricingPlans";
import CreateOrg from "./pages/CreateOrg";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<PublicVerify />} />
            <Route path="/invite" element={<InviteAccept />} />
            <Route path="/password/reset" element={<PasswordReset />} />
            <Route path="/pricing" element={<PricingPlans />} />
            <Route path="/create-org" element={<ProtectedRoute><CreateOrg /></ProtectedRoute>} />
            <Route path="/account/setup" element={<ProtectedRoute><AccountSetup /></ProtectedRoute>} />
            <Route path="/account/setup/done" element={<ProtectedRoute><AccountSetupDone /></ProtectedRoute>} />
            
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/orgs" element={<MyOrgs />} />
              <Route path="/orgs/:orgId/*" element={<OrgDashboard />} />
              <Route path="/network" element={<Network />} />
            </Route>

            <Route path="/" element={<Navigate to="/orgs" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
