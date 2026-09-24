import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Footer = () => {
  const footerStyle = {
    backgroundColor: '#1a2a44',
    color: '#ffffff',
    padding: '60px 0 30px 0',
    fontSize: '0.85rem'
  };

  const headerStyle = {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: '20px',
    fontSize: '1rem',
    textTransform: 'uppercase'
  };

  const linkStyle = {
    color: '#b0c4de',
    textDecoration: 'none',
    display: 'block',
    marginBottom: '8px'
  };

  return (
    <footer style={footerStyle}>
      <div className="container">
        <div className="row mb-5 text-center">
          <div className="col-12">
            <div className="mb-3">
              <span style={{ fontSize: '2.5rem' }}><FontAwesomeIcon icon="graduation-cap" /></span>
            </div>
            <h4 className="fw-bold">QUICK HIRE AI</h4>
            <p className="text-muted">Innovating the Future of Recruitment</p>
          </div>
        </div>
        
        <div className="row">
          <div className="col-md-3 mb-4">
            <h5 style={headerStyle}>Services</h5>
            <Link to="#" style={linkStyle}>CV Screening</Link>
            <Link to="#" style={linkStyle}>Candidate Ranking</Link>
            <Link to="#" style={linkStyle}>AI Chatbot Assistant</Link>
            <Link to="#" style={linkStyle}>Skill Analysis</Link>
            <Link to="#" style={linkStyle}>Reporting Tools</Link>
          </div>
          
          <div className="col-md-3 mb-4">
            <h5 style={headerStyle}>Platform</h5>
            <Link to="#" style={linkStyle}>Dashboard</Link>
            <Link to="#" style={linkStyle}>Job Postings</Link>
            <Link to="#" style={linkStyle}>Audit Logs</Link>
            <Link to="#" style={linkStyle}>API Reference</Link>
          </div>
          
          <div className="col-md-3 mb-4">
            <h5 style={headerStyle}>Quick Links</h5>
            <Link to="#" style={linkStyle}>About Us</Link>
            <Link to="#" style={linkStyle}>Contact Support</Link>
            <Link to="#" style={linkStyle}>Privacy Policy</Link>
            <Link to="#" style={linkStyle}>Terms of Service</Link>
          </div>
          
          <div className="col-md-3 mb-4">
            <h5 style={headerStyle}>Contact</h5>
            <p style={{ color: '#b0c4de', marginBottom: '8px' }}>+27 15 268 3332</p>
            <p style={{ color: '#b0c4de', marginBottom: '8px' }}>info@quickhire.ai</p>
            <div className="mt-3">
              <span className="me-2">𝕏</span>
              <span className="me-2">𝑓</span>
              <span className="me-2"><FontAwesomeIcon icon="camera-retro" /></span>
              <span className="me-2"><FontAwesomeIcon icon="video" /></span>
            </div>
          </div>
        </div>
        
        <div className="border-top border-secondary pt-4 mt-4 text-center">
          <p className="mb-0 text-muted">&copy; 2026 QUICK HIRE — University of Limpopo, Group 19. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
