import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useUser } from '../context/UserContext';

const recruiterLinks = [
  { section: 'Main', items: [
    { to: '/recruiter/dashboard', label: 'Dashboard', icon: 'chart-bar' },
    { to: '/recruiter/upload-cvs', label: 'Upload CVs', icon: 'file' },
    { to: '/recruiter/batches', label: 'Batches Created', icon: 'layer-group' },
    { to: '/recruiter/upload-job', label: 'Upload Job Description', icon: 'file-lines' },
    { to: '/recruiter/jobs', label: 'Jobs Created', icon: 'folder-open' },
    { to: '/recruiter/candidates', label: 'Ranked Candidates', icon: 'trophy' },
    { to: '/recruiter/assigned-candidates', label: 'Assigned Candidates', icon: 'user-check' },
    { to: '/recruiter/search', label: 'Candidate Search', icon: 'magnifying-glass' },
  ]},
  { section: 'Tools', items: [
    { to: '/recruiter/chatbot', label: 'Chatbot Assistant', icon: 'robot' },
    { to: '/recruiter/reports', label: 'Reports', icon: 'chart-line' },
    { to: '/recruiter/settings', label: 'Settings', icon: 'gear' },
  ]},
];

const RecruiterSidebar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { logout } = useUser();

  const handleSignOut = async () => {
    try {
      if (onLogout) await onLogout();
      else if (logout) await logout('Recruiter clicked Sign Out');
    } catch (_) {}
    navigate('/login', { replace: true });
  };


  const initials = user
    ? `${(user.first_name || user.username || 'U')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : 'R';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">QH</div>
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">QUICK HIRE</span>
          <span className="sidebar-brand-tag">AI Semantic Ranking</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {recruiterLinks.map(section => (
          <div key={section.section}>
            <div className="sidebar-section-title">{section.section}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={item.icon} /></span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Recruiter'}
            </div>
            <div className="sidebar-user-role">Recruiter</div>
            {user?.employee_id && (
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--accent-gold, #f59e0b)',
                fontWeight: 700,
                marginTop: '0.2rem',
                letterSpacing: '0.5px'
              }}>
                EMP: {user.employee_id}
              </div>
            )}
            {(user?.company_code || user?.companies?.company_code) && (
              <div style={{
                fontSize: '0.68rem',
                color: 'rgba(255,255,255,0.6)',
                marginTop: '0.1rem'
              }}>
                Co: {user?.company_code || user?.companies?.company_code}
              </div>
            )}
          </div>
        </div>
        <button
          className="btn btn-outline-secondary btn-sm w-100 mt-3"
          onClick={handleSignOut}
          style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}
        >
          <FontAwesomeIcon icon="right-from-bracket" /> Sign Out
        </button>

      </div>
    </aside>
  );
};

export default RecruiterSidebar;
