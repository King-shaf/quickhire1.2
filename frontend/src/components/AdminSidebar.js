import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useUser } from '../context/UserContext';

const adminLinks = [
  { section: 'Overview', items: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'chart-bar' },
  ]},
  { section: 'Management', items: [
    { to: '/admin/users', label: 'User Management', icon: 'users' },
    { to: '/admin/config', label: 'System Configuration', icon: 'wrench' },
    { to: '/admin/models', label: 'AI Model Management', icon: 'brain' },
    { to: '/admin/monitoring', label: 'Performance Monitoring', icon: 'gauge-high' },
  ]},
  { section: 'System', items: [
    { to: '/admin/audit', label: 'Audit Logs', icon: 'clipboard-list' },
    { to: '/admin/settings', label: 'System Settings', icon: 'gear' },
    { to: '/admin/database', label: 'Database Management', icon: 'database' },
  ]},
];

const AdminSidebar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { logout } = useUser();

  const handleSignOut = async () => {
    try {
      if (onLogout) await onLogout();
      else if (logout) await logout('Admin clicked Sign Out');
    } catch (_) {}
    navigate('/login', { replace: true });
  };

  const initials = user
    ? `${(user.first_name || user.username || 'A')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : 'A';


  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ background: 'linear-gradient(135deg,#c62828,#8e0000)' }}>QH</div>
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">QUICK HIRE</span>
          <span className="sidebar-brand-tag">Admin Console</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {adminLinks.map(section => (
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
          <div className="sidebar-user-avatar" style={{ background: 'linear-gradient(135deg,#c62828,#8e0000)', color: '#fff' }}>
            {initials}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Administrator'}
            </div>
            <div className="sidebar-user-role">Administrator</div>
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

export default AdminSidebar;
