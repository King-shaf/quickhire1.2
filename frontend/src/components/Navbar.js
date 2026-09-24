import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useUser();

  const handleLogout = async () => {
    try {
      await logout('User clicked Navbar Logout');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/">QuickHire AI</Link>
        {!loading && user && (
          <div className="collapse navbar-collapse">
            <ul className="navbar-nav me-auto">
              <li className="nav-item"><Link className="nav-link" to="/dashboard">Dashboard</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/upload">Upload CVs</Link></li>
            </ul>
            <div className="d-flex align-items-center">
              <span className="badge bg-light text-dark me-3">{user.role}</span>
              <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
