import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useUser } from '../context/UserContext';

const companyLinks = [
  { section: 'Main', items: [
    { to: '/company/dashboard', label: 'Dashboard', icon: 'chart-bar' },
    { to: '/company/recruiters', label: 'Recruiters', icon: 'users' },
    { to: '/company/approvals', label: 'Approvals', icon: 'clipboard-check' },
    { to: '/company/activity', label: 'Recruiter Activity', icon: 'clipboard-list' },
  ]},
  { section: 'Recruiting', items: [
    { to: '/recruiter/candidates', label: 'Ranked Candidates', icon: 'trophy' },
    { to: '/recruiter/upload-cvs', label: 'Upload CVs', icon: 'file' },
    { to: '/recruiter/upload-job', label: 'Upload Job Description', icon: 'file-lines' },
  ]},
  { section: 'Account', items: [
    { to: '/company/preferences', label: 'Preferences', icon: 'sliders' },
  ]},
];

const CompanySidebar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { logout } = useUser();

  const handleSignOut = async () => {
    try {
      if (onLogout) await onLogout();
      else if (logout) await logout('Company manager clicked Sign Out');
    } catch (_) {}
    navigate('/login', { replace: true });
  };

  const initials = user
    ? `${(user.first_name || user.username || 'U')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : 'C';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">QH</div>
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">QUICK HIRE</span>
          <span className="sidebar-brand-tag">Company Manager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {companyLinks.map(section => (
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
              {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Company Manager'}
            </div>
            <div className="sidebar-user-role">
              {user?.company_name || (user?.companies && user.companies.name) || 'Company Admin'}
            </div>
            {(user?.company_code || user?.companies?.company_code) && (
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--accent-gold, #f59e0b)',
                fontWeight: 700,
                marginTop: '0.2rem',
                letterSpacing: '0.5px'
              }}>
                ID: {user?.company_code || user?.companies?.company_code}
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

export default CompanySidebar;

