import React, { useState, useEffect } from 'react';
import { jobService, authService, adminService } from '../services/supabaseService';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import UserDashboard from './UserDashboard';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const profile = await authService.getUserProfile();
        setUser(profile);
        if (profile.company_id) {
          const [jobsRes, dashStats] = await Promise.all([
            jobService.getJobs(profile.company_id),
            adminService.getDashboardStats(profile.company_id),
          ]);
          setJobs(jobsRes);
          setStats({
            total_candidates: dashStats.total_candidates,
            total_jobs: dashStats.total_jobs,
            recent_rankings: dashStats.recent_rankings,
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };
    fetchDashboardData();
  }, []);

  if (!user) return (
    <div className="text-center mt-5 p-5">
      <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );

  // Render role-specific dashboard
  switch (user.role) {
    case 'admin':
      return <AdminDashboard stats={stats} />;
    case 'company':
      return <ManagerDashboard stats={stats} jobs={jobs} />;
    default:
      return <UserDashboard stats={stats} jobs={jobs} />;
  }
};

export default Dashboard;
