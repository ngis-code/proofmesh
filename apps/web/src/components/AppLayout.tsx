import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AppLayout() {
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
            <span className="sidebar-user-email">{user?.email}</span>
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
}
