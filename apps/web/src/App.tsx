import React from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from './AuthContext';
import { OrgDashboard } from './OrgDashboard';
import { LoginPage } from './LoginPage';
import { MyOrgsPage } from './MyOrgsPage';
import { NetworkPage } from './NetworkPage';
import { PublicVerifyPage } from './PublicVerifyPage';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Public login route
  if (
    !user &&
    !loading &&
    location.pathname !== '/login' &&
    location.pathname !== '/public/verify'
  ) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="login-layout">
        <div className="login-card">
          <h1>Loading ProofMesh…</h1>
          <p>Checking your session.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/verify" element={<PublicVerifyPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/verify" element={<PublicVerifyPage />} />
      <Route element={<SaaSLayout />}>
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/orgs">
          <Route index element={<MyOrgsPage />} />
          <Route path=":orgId/*" element={<OrgDashboard />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/orgs" replace />} />
      <Route path="*" element={<Navigate to="/orgs" replace />} />
    </Routes>
  );
};

const SaaSLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">P</div>
          <div className="sidebar-logo-text">
            <span>ProofMesh</span>
            <span>Digital integrity mesh</span>
          </div>
        </div>

        <div>
          <div className="sidebar-section-title">Navigation</div>
          <div className="sidebar-nav">
            <button
              type="button"
              className={
                location.pathname.startsWith('/orgs') && !location.pathname.match(/\/orgs\/[^/]+/)
                  ? 'sidebar-link active'
                  : 'sidebar-link'
              }
              onClick={() => navigate('/orgs')}
            >
              My orgs
            </button>
            <button
              type="button"
              className={location.pathname.startsWith('/network') ? 'sidebar-link active' : 'sidebar-link'}
              onClick={() => navigate('/network')}
            >
              Network health
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-email">{user.email}</span>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={() => {
                void logout().then(() => navigate('/login'));
              }}
            >
              Logout
            </button>
          </div>
          <div className="muted">Signed in via Appwrite</div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
};
