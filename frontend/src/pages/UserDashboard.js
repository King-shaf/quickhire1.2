import React from 'react';
import { Link } from 'react-router-dom';

const UserDashboard = ({ stats, jobs }) => {
  return (
    <div>
      <h1 className="mb-4 text-primary">User Dashboard</h1>
      <div className="alert alert-primary">
        Welcome to QuickHire AI. You can view job descriptions and rankings.
      </div>
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card text-white bg-primary shadow">
            <div className="card-body text-center p-4">
              <h5 className="card-title">Available Candidates</h5>
              <p className="display-4">{stats.total_candidates || 0}</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card text-white bg-info shadow">
            <div className="card-body text-center p-4">
              <h5 className="card-title">Total Job Postings</h5>
              <p className="display-4">{jobs.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-8">
          <h3>Job Descriptions & Rankings</h3>
          <div className="list-group mb-4 shadow-sm">
            {jobs.map(job => (
              <Link key={job.id} to={`/ranking/${job.id}`} className="list-group-item list-group-item-action">
                <div className="d-flex w-100 justify-content-between">
                  <h5 className="mb-1 fw-bold">{job.title}</h5>
                  <small className="badge bg-secondary rounded-pill">{new Date(job.created_at).toLocaleDateString()}</small>
                </div>
                <p className="mb-1 text-truncate text-muted">{job.description_text}</p>
              </Link>
            ))}
          </div>
          <Link to="/upload" className="btn btn-primary btn-lg shadow-sm">Post New Job & Rank</Link>
        </div>
        <div className="col-md-4">
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">User Actions</div>
            <div className="card-body text-center">
              <Link to="/upload" className="btn btn-outline-primary w-100 mb-2">Upload Your CV</Link>
              <button className="btn btn-outline-primary w-100 mb-2">View My Rankings</button>
              <button className="btn btn-outline-primary w-100">Help Center</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
