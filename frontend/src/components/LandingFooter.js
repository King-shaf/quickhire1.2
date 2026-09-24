import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const socialIcons = [
  { char: '𝕏' },
  { char: '𝑓' },
  { icon: 'camera-retro' },
  { icon: 'briefcase' },
  { icon: 'video' },
];

const LandingFooter = () => {
  return (
    <footer style={{
      background: 'linear-gradient(180deg, #0d1442 0%, #070a2b 100%)',
      color: '#fff',
      padding: '4rem 0 1.5rem',
      marginTop: '4rem',
    }}>
      <div className="container-xl">
        <div className="grid-4 mb-5">
          <div>
            <div className="d-flex align-items-center gap-2 mb-3">
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'linear-gradient(135deg, #ffd700, #c9a84c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 900, color: '#1a237e', fontSize: '1.1rem'
              }}>QH</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem' }}>QUICK HIRE</div>
                <div style={{ fontSize: '0.7rem', color: '#ffd700', letterSpacing: '0.04em' }}>University of Limpopo · Group 19</div>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              AI-Powered Semantic Candidate Ranking Platform — advancing recruitment research at the intersection of NLP and machine learning.
            </p>
            <div className="d-flex gap-2">
              {socialIcons.map((s, i) => (
                <a key={i} href="/" onClick={e => e.preventDefault()} style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.85rem',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.cssText += 'background:rgba(255,215,0,0.18);color:#ffd700;'}
                onMouseLeave={e => e.currentTarget.style.cssText += 'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);'}
                >
                  {s.icon ? <FontAwesomeIcon icon={s.icon} /> : s.char}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h5 style={{ color: '#ffd700', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                ['/', 'Home'], ['/login', 'Login'], ['/signup', 'Sign Up'],
                ['/recruiter/chatbot', 'AI Assistant']
              ].map(([to, label]) => (
                <li key={to} style={{ marginBottom: '0.5rem' }}>
                  <Link to={to} style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ffd700'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 style={{ color: '#ffd700', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resources</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Documentation', 'API Reference', 'Research Paper', 'Case Studies', 'Support Center'].map(label => (
                <li key={label} style={{ marginBottom: '0.5rem' }}>
                  <a href={`/${label.toLowerCase().replace(/\s+/g, '-')}`} onClick={e => e.preventDefault()} style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ffd700'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div id="contact">
            <h5 style={{ color: '#ffd700', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Us</h5>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.5rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
                <span><FontAwesomeIcon icon="location-dot" /></span>
                <span>University of Limpopo, Turfloop Campus, Building C, Room 302</span>
              </li>
              <li style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.5rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
                <span><FontAwesomeIcon icon="envelope" /></span>
                <a href="mailto:info@quickhire.edu" style={{ color: 'inherit', textDecoration: 'none' }}>info@quickhire.edu</a>
              </li>
              <li style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.5rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
                <span><FontAwesomeIcon icon="phone" /></span>
                <span>+1 (555) 123-4567</span>
              </li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.78rem',
          color: 'rgba(255,255,255,0.45)'
        }}>
          <div>© 2026 QUICK HIRE — University of Limpopo, Group 19. All rights reserved.</div>
          <div className="d-flex gap-3">
            {['Privacy Policy', 'Terms of Service', 'Accessibility'].map(l => (
              <a key={l} href={`/${l.toLowerCase().replace(/\s+/g, '-')}`} onClick={e => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffd700'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
              >{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
