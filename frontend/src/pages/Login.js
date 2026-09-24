import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import { authService, dashboardForRole, normalizeRole } from '../services/api';

const Login = ({ onAuth }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimit, setRateLimit] = useState({ attempts: 0, locked: false });
  const [authMode, setAuthMode] = useState(authService.mode); // 'django' or 'supabase'
  const [logoutNotice, setLogoutNotice] = useState('');

  useEffect(() => {
    const notice = localStorage.getItem('qh_logout_notice');
    if (notice) {
      setLogoutNotice(notice);
      localStorage.removeItem('qh_logout_notice');
    }

    const stored = localStorage.getItem('qh_login_attempts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) {
          setRateLimit({ attempts: parsed.attempts || 0, locked: true });
        } else if (parsed.attempts) {
          setRateLimit({ attempts: parsed.attempts, locked: false });
        }
      } catch (_) {}
    }
    const rememberedEmail = localStorage.getItem('qh_remember_email');
    if (rememberedEmail) setForm(f => ({ ...f, email: rememberedEmail, remember: true }));
    setAuthMode(authService.mode);
  }, []);


  const recordAttempt = (success) => {
    let next;
    let maxAttempts = 5;
    try {
      const localOverrides = JSON.parse(localStorage.getItem('qh_system_config_overrides') || '{}');
      if (localOverrides.security?.max_login_attempts) {
        maxAttempts = Number(localOverrides.security.max_login_attempts);
      }
    } catch (_) {}

    if (success) {
      next = { attempts: 0, lockedUntil: 0 };
    } else {
      const attempts = rateLimit.attempts + 1;
      next = {
        attempts,
        lockedUntil: attempts >= maxAttempts ? Date.now() + 300 * 1000 : 0,
      };
      if (attempts >= maxAttempts) setRateLimit({ attempts, locked: true });
      else setRateLimit({ attempts, locked: false });
    }
    localStorage.setItem('qh_login_attempts', JSON.stringify(next));
  };

  const clearLockout = () => {
    authService.clearLoginAttempts();
    setRateLimit({ attempts: 0, locked: false });
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (rateLimit.locked) {
      setError('Too many failed attempts. Please try again in 5 minutes, or click "Reset attempts" below.');
      return;
    }
    setLoading(true);
    try {
      const session = await authService.login(form.email, form.password);
      recordAttempt(true);
      if (form.remember) localStorage.setItem('qh_remember_email', form.email);
      else localStorage.removeItem('qh_remember_email');
      const role = normalizeRole(session.user?.role);
      if (typeof onAuth === 'function') {
        try { await onAuth(session); } catch (_) {}
      }
      navigate(dashboardForRole(role), { replace: true });
    } catch (err) {
      recordAttempt(false);
      let msg = 'Invalid credentials. Please try again.';
      if (err) {
        if (err.response && err.response.data) {
          const d = err.response.data;
          const dm = d.detail || d.message || d.msg || (typeof d === 'string' ? d : null);
          if (dm && typeof dm === 'string') msg = dm;
          if (Array.isArray(d.non_field_errors) && d.non_field_errors.length) {
            const nf = d.non_field_errors[0];
            if (nf && typeof nf === 'string') msg = nf;
          }
        } else if (err.message && typeof err.message === 'string' && err.message.trim()) {
          msg = err.message;
        }
        if (typeof msg !== 'string' || !msg.trim()) {
          try { msg = JSON.stringify(err); } catch (_) { msg = 'An unexpected error occurred. Please try again.'; }
        }
        if (err.code) {
          const c = String(err.code).toLowerCase();
          if (c === 'invalid_credentials' || c === 'invalid_grant' || c === 'bad_json') {
            msg = 'Invalid email/username or password. Please check your credentials and try again.';
          } else if (c === 'email_not_confirmed') {
            msg = 'Your email address has not been confirmed yet. Please check your inbox (or ask an admin to create the account with "Auto-confirm" enabled).';
          } else if (c === 'user_not_found' || c === 'over_email_send_rate_limit') {
            msg = 'No account was found with these credentials. If using Supabase, ensure the auth user exists in Supabase Dashboard → Authentication → Users, and that a matching row exists in the "users" table with role="admin".';
          } else if (c === 'too_many_requests') {
            msg = 'Too many login attempts. Please wait a moment and try again.';
          }
        }
        const finalMsg = typeof msg === 'string' ? msg : String(msg || '');
        const trimmed = finalMsg.trim();
        if (
          !trimmed ||
          trimmed === '{}' ||
          trimmed === 'null' ||
          trimmed === 'undefined' ||
          trimmed.startsWith('[object ') ||
          /^\{[\s\S]*\}$/.test(trimmed)
        ) {
          msg = 'Invalid credentials. Please try again.';
        } else {
          msg = finalMsg;
        }
        console.warn('[Login] full error for diagnostics:', err);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const lockSecsLeft = rateLimit.locked
    ? Math.max(0, Math.ceil((((JSON.parse(localStorage.getItem('qh_login_attempts') || '{}').lockedUntil || 0) - Date.now()) / 1000)))
    : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />

      <div style={{
        flex: 1,
        background: 'radial-gradient(ellipse at top, rgba(92,107,192,0.18), transparent 55%), linear-gradient(180deg, #eef1fb 0%, #f5f7fa 60%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.25rem',
      }}>
        <div className="grid-2" style={{ maxWidth: 1080, width: '100%', gap: '2.5rem', alignItems: 'center' }}>
          {/* Left info panel */}
          <div className="d-none d-lg-flex flex-column" style={{ padding: '2rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.4rem', color: 'var(--primary-dark)',
                boxShadow: '0 10px 24px rgba(201,168,76,0.28)',
              }}>QH</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.35rem', color: 'var(--primary-dark)' }}>QUICK HIRE</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', letterSpacing: '0.04em' }}>AI-Powered Semantic Candidate Ranking</div>
              </div>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 800,
              lineHeight: 1.15, color: 'var(--primary-dark)', marginBottom: '1rem',
            }}>
              Welcome back to the future of <span style={{ color: 'var(--gold-dark)' }}>intelligent hiring</span>.
            </h1>
            <p style={{ color: 'var(--text-gray)', lineHeight: 1.7, fontSize: '0.92rem', marginBottom: '1.5rem' }}>
              Sign in to access ranked candidates, launch new analyses, or chat with our AI assistant. University of Limpopo (Group 19) managed accounts with full audit-trail protection.
            </p>

            <div style={{
              marginBottom: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.8rem', borderRadius: 10,
              background: authMode === 'django' ? 'rgba(92,107,192,0.10)' : 'rgba(16, 185, 129, 0.10)',
              border: `1px solid ${authMode === 'django' ? 'rgba(92,107,192,0.25)' : 'rgba(16,185,129,0.30)'}`,
              fontSize: '0.78rem', fontWeight: 600, color: authMode === 'django' ? 'var(--primary-mid)' : '#0f766e',
            }}>
              <FontAwesomeIcon icon={authMode === 'django' ? 'server' : 'cloud'} />
              Auth Mode: <strong style={{ marginLeft: 4 }}>{authMode.toUpperCase()}</strong>
              <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: 4 }}>
                ({authMode === 'django' ? 'Local JWT (Django / SQLite demo)' : 'Supabase Postgres + RLS'})
              </span>
            </div>

            <div className="d-flex flex-column gap-3 mb-3">
              {[
                ['shield-halved', 'Secure SSO-ready authentication with per-session RBAC'],
                ['school', 'University of Limpopo data residency & audit logging'],
                ['robot', 'Real-time pipeline status for all ranking jobs'],
              ].map(([icon, t]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.15rem', color: 'var(--primary-mid)' }}>
                    <FontAwesomeIcon icon={icon} />
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-gray)', lineHeight: 1.5 }}>{t}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.5rem', padding: '1rem 1.1rem', borderRadius: 12, background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold-dark)', marginBottom: '0.5rem' }}>
                <FontAwesomeIcon icon="lightbulb" style={{ marginRight: 6 }} /> Demo Credentials
                <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: 8 }}>(same password for all)</span>
              </div>
              <div style={{ fontSize: '0.8rem', lineHeight: 1.8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '0 0.8rem' }}>
                  <span style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>🔑 Password:</span>
                  <span style={{ color: 'var(--primary-dark)', fontFamily: 'ui-monospace, Menlo, monospace' }}>QuickHire@2026</span>
                  <span></span>

                  <span style={{ color: 'var(--text-light)' }}>Role</span>
                  <span style={{ color: 'var(--text-light)' }}>Username or Email</span>
                  <span style={{ color: 'var(--text-light)' }}>Tenant</span>

                  <span style={{ fontWeight: 700, color: 'var(--primary-mid)' }}>admin</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>admin · admin@quickhire.ai</span>
                  <span style={{ color: 'var(--text-gray)' }}>All tenants</span>

                  <span style={{ fontWeight: 700, color: 'var(--text-gray)' }}>recruiter</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>sarah_recruiter · sarah@acme.corp</span>
                  <span style={{ color: 'var(--text-gray)' }}>ACME Corp</span>

                  <span style={{ fontWeight: 700, color: 'var(--text-gray)' }}>recruiter</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>mike_recruiter · mike@acme.corp</span>
                  <span style={{ color: 'var(--text-gray)' }}>ACME Corp</span>

                  <span style={{ fontWeight: 700, color: 'var(--text-gray)' }}>company</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>linda_company · linda.hr@globex.com</span>
                  <span style={{ color: 'var(--text-gray)' }}>Globex</span>

                  <span style={{ fontWeight: 700, color: 'var(--text-gray)' }}>recruiter</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>david_recruiter · david.talent@initech.io</span>
                  <span style={{ color: 'var(--text-gray)' }}>Initech</span>
                </div>
              </div>
            </div>
          </div>

          {/* Login form card */}
          <div className="card" style={{ padding: '2.25rem', boxShadow: 'var(--shadow-xl)', maxWidth: 460, width: '100%', marginLeft: 'auto' }}>
            <div className="text-center mb-4">
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem', color: 'var(--primary-mid)' }}>
                <FontAwesomeIcon icon="key" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--primary-dark)' }}>
                Sign in to your account
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 0 }}>Enter your credentials below</p>
            </div>

            {logoutNotice && (
              <div className="alert alert-info mb-3" style={{ fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="circle-info" style={{ marginRight: 6 }} />
                {logoutNotice}
              </div>
            )}
            {rateLimit.locked && (
              <div className="alert alert-error mb-3" style={{ fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />
                {' '}Account temporarily locked due to too many attempts. Try again in {lockSecsLeft || 300} seconds.
              </div>
            )}
            {error && <div className="alert alert-error mb-3" style={{ fontSize: '0.85rem' }}>{error}</div>}


            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label">Email or Username</label>
                <input
                  type="text"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="sarah@acme.corp or admin"
                  required
                  autoComplete="email"
                  disabled={loading || rateLimit.locked}
                />
              </div>

              <div className="mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--primary-mid)', fontWeight: 500, textDecoration: 'none' }}>
                    <FontAwesomeIcon icon="circle-question" style={{ marginRight: 4 }} /> Forgot password?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="QuickHire@2026"
                    required
                    autoComplete="current-password"
                    disabled={loading || rateLimit.locked}
                    style={{ paddingRight: '4.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0.5rem', borderRadius: 6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <FontAwesomeIcon icon={showPw ? 'eye-slash' : 'eye'} style={{ marginRight: 4 }} />
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="password-hints" style={{ marginTop: '0.35rem' }}>
                  <li>Minimum 6 characters</li>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-gray)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={e => setForm({ ...form, remember: e.target.checked })}
                    className="form-check-input"
                  />
                  Remember me
                </label>
                {rateLimit.attempts > 0 && (
                  <button type="button" onClick={clearLockout} className="btn btn-text" style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}>
                    <FontAwesomeIcon icon="rotate-right" style={{ marginRight: 4 }} />
                    Reset attempts ({rateLimit.attempts}/5)
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 btn-lg"
                disabled={loading || rateLimit.locked}
              >
                {loading ? <><span className="spinner spinner-sm spinner-gold"></span> Signing in...</> : <><FontAwesomeIcon icon="lock" style={{ marginRight: 8 }} /> Sign In</>}
              </button>
            </form>

            <div style={{
              margin: '1.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem',
              fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
              New to QUICK HIRE?
              <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
            </div>

            <Link to="/signup" className="btn btn-outline-primary w-100">
              <FontAwesomeIcon icon="gift" style={{ marginRight: 8 }} /> Create an account
            </Link>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
};

export default Login;
