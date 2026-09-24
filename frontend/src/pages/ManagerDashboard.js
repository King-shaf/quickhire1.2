import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authService, companyService } from '../services/supabaseService';

const ManagerDashboard = ({ stats, jobs }) => {
  const [recruiters, setRecruiters] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profile = await authService.getUserProfile();
        setUser(profile);
        if (profile.company_id) {
          const recruitersList = await companyService.getRecruiters(profile.company_id);
          setRecruiters(recruitersList);
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-success">Company Dashboard</h1>
      <div className="alert alert-info">
        Good morning! You have {jobs.length} active job postings and {recruiters.length} recruiters.
      </div>
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-white bg-success shadow">
            <div className="card-body text-center">
              <h5 className="card-title">Total Candidates</h5>
              <p className="display-4">{stats.total_candidates || 0}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-info shadow">
            <div className="card-body text-center">
              <h5 className="card-title">Active Job Postings</h5>
              <p className="display-4">{jobs.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-warning shadow">
            <div className="card-body text-center">
              <h5 className="card-title">Recruiters</h5>
              <p className="display-4">{recruiters.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <h3>Active Job Descriptions</h3>
          <div className="list-group mb-4 shadow-sm">
            {jobs.map(job => (
              <Link key={job.id} to={`/ranking/${job.id}`} className="list-group-item list-group-item-action">
                <div className="d-flex w-100 justify-content-between">
                  <h5 className="mb-1 fw-bold">{job.title}</h5>
                  <small className="badge bg-primary rounded-pill">{new Date(job.created_at).toLocaleDateString()}</small>
                </div>
                <p className="mb-1 text-truncate text-muted">{job.description_text}</p>
              </Link>
            ))}
          </div>
          <Link to="/upload" className="btn btn-success btn-lg shadow-sm mb-4">Post New Job & Start Ranking</Link>
        </div>
        <div className="col-md-6">
          <h3>Recruiters</h3>
          <div className="list-group mb-4 shadow-sm">
            {recruiters.map(recruiter => (
              <div key={recruiter.id} className="list-group-item">
                <div className="d-flex w-100 justify-content-between">
                  <h5 className="mb-1 fw-bold">{recruiter.first_name} {recruiter.last_name}</h5>
                  <small className="badge bg-secondary rounded-pill">{recruiter.role}</small>
                </div>
                <p className="mb-1 text-muted">{recruiter.email}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
