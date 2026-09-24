import React from 'react';
import RecruiterSidebar from './RecruiterSidebar';
import CompanySidebar from './CompanySidebar';
import AdminSidebar from './AdminSidebar';
import { normalizeRole } from '../services/api';
import { useUser } from '../context/UserContext';

const RecruiterLayout = ({ children, title, subtitle, actions, user }) => {
  const { logout } = useUser();
  const handleLogout = async () => {
    try { await logout('Recruiter sign out'); } catch (e) {}
  };


  const role = normalizeRole(user?.role);
  let SidebarComp = RecruiterSidebar;
  if (role === 'admin') SidebarComp = AdminSidebar;
  else if (role === 'company') SidebarComp = CompanySidebar;

  return (
    <div className="app-layout">
      <SidebarComp user={user} onLogout={handleLogout} />
      <div className="main-content">
        <div className="main-header">
          <div>
            <h1 className="main-header-title">{title}</h1>
            {subtitle && <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>{subtitle}</div>}
          </div>
          <div className="d-flex align-items-center gap-2">
            {actions}
          </div>
        </div>
        <div className="main-page">
          {children}
        </div>
      </div>
    </div>
  );
};

export default RecruiterLayout;
