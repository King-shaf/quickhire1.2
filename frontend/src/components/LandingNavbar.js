import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const LandingNavbar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;
  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/#features', label: 'Features' },
    { to: '/#how', label: 'How It Works' },
    { to: '/#about', label: 'About' },
    { to: '/#contact', label: 'Contact' },
  ];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="topbar-brand">
          <div className="topbar-brand-logo">QH</div>
          <div className="topbar-brand-text">
            <span className="topbar-brand-title">QUICK HIRE</span>
            <span className="topbar-brand-tag">AI-Powered Semantic Candidate Ranking</span>
          </div>
        </Link>

        <nav className="topbar-nav d-none d-lg-flex">
          {navLinks.map(link => (
            <a key={link.label} href={link.to} className={`topbar-link ${isActive(link.to.split('#')[0]) ? 'active' : ''}`}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="topbar-actions">
          <Link to="/login" className="btn btn-outline-gold btn-sm" style={{ borderColor: 'rgba(255,215,0,0.4)', color: 'var(--gold)' }}>
            Login
          </Link>
          <Link to="/signup" className="btn btn-gold btn-sm">
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;
