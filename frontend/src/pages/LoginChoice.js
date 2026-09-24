import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useNavigate } from 'react-router-dom';

const LoginChoice = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-8">
        <h1 className="text-center mb-5 fw-bold text-primary">QuickHire AI Login</h1>
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card shadow border-primary h-100">
              <div className="card-body text-center p-4">
                <div className="display-4 mb-3 text-primary"><FontAwesomeIcon icon="user" /></div>
                <h3 className="fw-bold">User</h3>
                <p className="text-muted mb-4">Sign in to view job rankings and upload your CV.</p>
                <div className="bg-light p-2 rounded mb-3 small">
                  <strong>Demo:</strong> user_demo / user123
                </div>
                <Link to="/login/user" className="btn btn-primary w-100">User Login</Link>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card shadow border-success h-100">
              <div className="card-body text-center p-4">
                <div className="display-4 mb-3 text-success"><FontAwesomeIcon icon="user-tie" /></div>
                <h3 className="fw-bold">Manager</h3>
                <p className="text-muted mb-4">Manage job postings and review candidate rankings.</p>
                <div className="bg-light p-2 rounded mb-3 small">
                  <strong>Demo:</strong> manager_demo / manager123
                </div>
                <Link to="/login/manager" className="btn btn-success w-100">Manager Login</Link>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-4">
            <div className="card shadow border-danger h-100">
              <div className="card-body text-center p-4">
                <div className="display-4 mb-3 text-danger"><FontAwesomeIcon icon="shield-halved" /></div>
                <h3 className="fw-bold">Admin</h3>
                <p className="text-muted mb-4">System administration and audit log management.</p>
                <div className="bg-light p-2 rounded mb-3 small">
                  <strong>Demo:</strong> admin_demo / admin123
                </div>
                <Link to="/login/admin" className="btn btn-danger w-100">Admin Login</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-4">
          <p className="text-muted">Don't have an account? <Link to="/register" className="fw-bold text-decoration-none">Sign Up Now</Link></p>
        </div>
      </div>
    </div>
  );
};

export default LoginChoice;
