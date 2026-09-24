import React from 'react';
import AdminSidebar from './AdminSidebar';
import { useUser } from '../context/UserContext';

const AdminLayout = ({ children, title, subtitle, actions, user }) => {
  const { logout } = useUser();
  const handleLogout = async () => {
    try { await logout('Admin sign out'); } catch (e) {}
  };


  return (
    <div className="app-layout">
      <AdminSidebar user={user} onLogout={handleLogout} />
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

export default AdminLayout;
