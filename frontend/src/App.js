import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import AuthCallback from './pages/AuthCallback';
import RecruiterDashboard from './pages/RecruiterDashboard';
import RecruiterUploadCVs from './pages/RecruiterUploadCVs';
import RecruiterBatches from './pages/RecruiterBatches';
import RecruiterUploadJob from './pages/RecruiterUploadJob';
import RecruiterJobsList from './pages/RecruiterJobsList';
import RankedCandidates from './pages/RankedCandidates';
import RecruiterAssignedCandidates from './pages/RecruiterAssignedCandidates';
import CandidateSearch from './pages/CandidateSearch';

import RecruiterChatbot from './pages/RecruiterChatbot';
import RecruiterReports from './pages/RecruiterReports';
import AcceptInvite from './pages/AcceptInvite';
import { RecruiterSettings, AdminSettings } from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminConfig from './pages/AdminConfig';
import AdminAuditLogs from './pages/AdminAuditLogs';
import { AdminModels, AdminMonitoring, AdminDatabase } from './pages/AdminExtra';
import CompanyDashboard from './pages/CompanyDashboard';
import CompanyRecruiters from './pages/CompanyRecruiters';
import CompanyApprovals from './pages/CompanyApprovals';
import CompanyActivity from './pages/CompanyActivity';
import CompanyPreferences from './pages/CompanyPreferences';

import { normalizeRole, dashboardForRole } from './services/api';
import { UserProvider, useUser } from './context/UserContext';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'linear-gradient(180deg, #eef1fb, #f5f7fa)',
        }}>
          <div className="card" style={{ maxWidth: 560, width: '100%', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: 56, color: 'var(--error)', marginBottom: 12 }}>
              <FontAwesomeIcon icon="triangle-exclamation" />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--text-gray)', marginBottom: 16 }}>
              {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <a href="/" onClick={e => { e.preventDefault(); window.location.assign('/'); }} className="btn btn-primary">
              <FontAwesomeIcon icon="house" style={{ marginRight: 8 }} /> Return to Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RoleGuard = ({ children, allow }) => {
  const { user, loading, logout } = useUser();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-light)' }}>
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user && user.is_active === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-light)' }}>
        <div className="card" style={{ maxWidth: 480, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 56, color: 'var(--error)', marginBottom: 12 }}>
            <FontAwesomeIcon icon="circle-xmark" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 8, fontSize: '1.5rem' }}>
            Account Deactivated
          </h1>
          <p style={{ color: 'var(--text-gray)', marginBottom: 16 }}>
            Your account has been deactivated by an administrator. Please contact support.
          </p>
          <button onClick={() => logout('Account deactivated')} className="btn btn-primary">
            <FontAwesomeIcon icon="right-from-bracket" style={{ marginRight: 8 }} /> Sign Out
          </button>
        </div>
      </div>
    );
  }
  const roleStr = normalizeRole(user?.role);
  const allowList = Array.isArray(allow) ? allow.map(a => normalizeRole(a)) : [];
  const allowed = allowList.includes(roleStr);
  if (!allowed) {
    const dest = dashboardForRole(roleStr);
    if (dest === location.pathname) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-light)' }}>
          <div className="card" style={{ maxWidth: 480, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: 56, color: 'var(--warning)', marginBottom: 12 }}>
              <FontAwesomeIcon icon="shield-halved" />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: 8, fontSize: '1.5rem' }}>
              Access Restricted
            </h1>
            <p style={{ color: 'var(--text-gray)', marginBottom: 16 }}>
              Your account role is <strong>{roleStr}</strong>, which does not have permission to view this area.
            </p>
            <a href="/" onClick={e => { e.preventDefault(); window.location.assign('/'); }} className="btn btn-primary">
              <FontAwesomeIcon icon="house" style={{ marginRight: 8 }} /> Go Home
            </a>
          </div>
        </div>
      );
    }
    return <Navigate to={dest} replace />;
  }
  if (typeof children === 'function') return children(user);
  return children;
};

const RecruiterAllow = ({ children }) => (
  <RoleGuard allow={['recruiter', 'company', 'admin']}>{children}</RoleGuard>
);
const AdminAllow = ({ children }) => (
  <RoleGuard allow={['admin']}>{children}</RoleGuard>
);
const CompanyAllow = ({ children }) => (
  <RoleGuard allow={['company', 'admin']}>{children}</RoleGuard>
);

function AppContent() {
  const { user, logout, refreshProfile } = useUser();


  return (
    <div className="App" style={{ minHeight: '100vh', background: 'var(--bg-light)' }}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage user={user} onLogout={logout} />} />
        <Route path="/login" element={<Login onAuth={refreshProfile} />} />
        <Route path="/signup" element={<SignUp onAuth={refreshProfile} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/confirm" element={<Navigate to="/auth/callback" replace />} />
        <Route path="/reset-password" element={<Navigate to="/auth/callback" replace />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/recruiter/accept-invite" element={<AcceptInvite />} />

        {/* Legacy route aliases for convenience */}
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route path="/dashboard" element={<Navigate to="/recruiter/dashboard" replace />} />

        {/* Recruiter routes */}
        <Route path="/recruiter/dashboard" element={<RecruiterAllow><RecruiterDashboard /></RecruiterAllow>} />
        <Route path="/recruiter/upload-cvs" element={<RecruiterAllow><RecruiterUploadCVs /></RecruiterAllow>} />
        <Route path="/recruiter/batches" element={<RecruiterAllow><RecruiterBatches /></RecruiterAllow>} />
        <Route path="/recruiter/upload-job" element={<RecruiterAllow><RecruiterUploadJob /></RecruiterAllow>} />
        <Route path="/recruiter/jobs" element={<RecruiterAllow><RecruiterJobsList /></RecruiterAllow>} />
        <Route path="/recruiter/candidates" element={<RecruiterAllow><RankedCandidates /></RecruiterAllow>} />
        <Route path="/recruiter/assigned-candidates" element={<RecruiterAllow><RecruiterAssignedCandidates /></RecruiterAllow>} />
        <Route path="/recruiter/search" element={<RecruiterAllow><CandidateSearch /></RecruiterAllow>} />

        <Route path="/recruiter/chatbot" element={<RecruiterAllow><RecruiterChatbot /></RecruiterAllow>} />
        <Route path="/recruiter/reports" element={<RecruiterAllow><RecruiterReports /></RecruiterAllow>} />
        <Route path="/recruiter/settings" element={<RecruiterAllow><RecruiterSettings /></RecruiterAllow>} />

        {/* Company route aliases */}
        <Route path="/company" element={<Navigate to="/company/dashboard" replace />} />
        <Route path="/company/" element={<Navigate to="/company/dashboard" replace />} />
        <Route path="/manager" element={<Navigate to="/company/dashboard" replace />} />

        {/* Company routes */}
        <Route path="/company/dashboard" element={<CompanyAllow><CompanyDashboard /></CompanyAllow>} />
        <Route path="/company/recruiters" element={<CompanyAllow><CompanyRecruiters /></CompanyAllow>} />
        <Route path="/company/approvals" element={<CompanyAllow><CompanyApprovals /></CompanyAllow>} />
        <Route path="/company/activity" element={<CompanyAllow><CompanyActivity /></CompanyAllow>} />
        <Route path="/company/preferences" element={<CompanyAllow><CompanyPreferences /></CompanyAllow>} />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={<AdminAllow><AdminDashboard /></AdminAllow>} />
        <Route path="/admin/users" element={<AdminAllow><AdminUsers /></AdminAllow>} />
        <Route path="/admin/user-management" element={<AdminAllow><AdminUsers /></AdminAllow>} />
        <Route path="/user-management" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/config" element={<AdminAllow><AdminConfig /></AdminAllow>} />
        <Route path="/admin/models" element={<AdminAllow><AdminModels /></AdminAllow>} />
        <Route path="/admin/monitoring" element={<AdminAllow><AdminMonitoring /></AdminAllow>} />
        <Route path="/admin/audit" element={<AdminAllow><AdminAuditLogs /></AdminAllow>} />
        <Route path="/admin/settings" element={<AdminAllow><AdminSettings /></AdminAllow>} />
        <Route path="/admin/database" element={<AdminAllow><AdminDatabase /></AdminAllow>} />

        {/* Fallback */}
        <Route path="*" element={
          <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
            background: 'linear-gradient(180deg, #fff, #f5f7fa)',
          }}>
            <div style={{ fontSize: 80, marginBottom: 16, color: 'var(--primary-mid)', opacity: 0.9 }}>
              <FontAwesomeIcon icon="magnifying-glass" />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', fontSize: '2.2rem' }}>
              404 · Page not found
            </h1>
            <p style={{ color: 'var(--text-gray)', maxWidth: 480 }}>
              The page you are looking for may have been moved or does not exist.
            </p>
            <a href="/" onClick={e => { e.preventDefault(); window.location.assign('/'); }} className="btn btn-primary" style={{ marginTop: 8 }}>
              <FontAwesomeIcon icon="house" style={{ marginRight: 8 }} /> Back to Home
            </a>
          </div>
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <UserProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </UserProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
