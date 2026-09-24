import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import { supabase } from '../services/supabaseClient';
import { authService, dashboardForRole, normalizeRole } from '../services/api';
import { useUser } from '../context/UserContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { refreshProfile, user } = useUser();
  const [status, setStatus] = useState('loading'); // loading | success | error | password-reset
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { hash, search } = window.location;
        let accessToken = null;
        let refreshToken = null;
        let typeHint = null;

        if (hash && hash.length > 1) {
          const hashParams = new URLSearchParams(hash.slice(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          typeHint = hashParams.get('type');
        }
        if (!accessToken && search) {
          const qs = new URLSearchParams(search.slice(1));
          accessToken = qs.get('access_token') || qs.get('token');
          refreshToken = qs.get('refresh_token');
          if (!typeHint) typeHint = qs.get('type') || qs.get('mode');
        }

        if (!accessToken) {
          const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
          if (sessErr) throw sessErr;
          const s = sessionData.session;
          if (s) {
            accessToken = s.access_token;
            refreshToken = s.refresh_token;
          }
        }

        if (accessToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (setErr) throw setErr;

          const isRecovery =
            (typeHint === 'recovery') ||
            ((typeHint !== 'signup') && (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery') || window.location.search.includes('mode=resetPassword')));

          if (typeHint === 'signup' || (!isRecovery && !user?.role)) {
            try { await refreshProfile(); } catch {}
            setStatus('success');
          } else if (isRecovery || typeHint === 'recovery') {
            setStatus('password-reset');
          } else {
            try { await refreshProfile(); } catch {}
            setStatus('success');
          }
        } else {
          throw new Error('No access token was found in the URL or current session. The link may be expired or invalid.');
        }
      } catch (err) {
        setStatus('error');
        setError(err?.message || 'Unable to complete authentication.');
      }
    };
    handleCallback();
  }, [refreshProfile, user]);

  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      (async () => {
        try {
          const profile = user || (await authService.getUserProfile());
          navigate(dashboardForRole(normalizeRole(profile?.role)), { replace: true });
        } catch {
          navigate('/recruiter/dashboard', { replace: true });
        }
      })();
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [status, countdown, user, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />
      <div style={{
        flex: 1,
        background: 'radial-gradient(ellipse at top, rgba(92,107,192,0.18), transparent 55%), linear-gradient(180deg, #eef1fb 0%, #f5f7fa 60%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.25rem',
      }}>
        <div className="card" style={{ padding: '2.5rem 2rem', boxShadow: 'var(--shadow-xl)', maxWidth: 520, width: '100%', textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <div className="spinner spinner-lg" style={{ marginBottom: '1.25rem' }}></div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
                Just a moment…
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: 0 }}>
                We&apos;re verifying your secure link and setting up your session.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.25rem',
                background: 'linear-gradient(135deg, rgba(46,160,67,0.14), rgba(46,160,67,0.24))',
                color: 'var(--success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.25rem',
              }}>
                <FontAwesomeIcon icon="check" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
                You&apos;re all set!
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-gray)', marginBottom: '1.25rem' }}>
                Redirecting you to your dashboard in <strong>{countdown}</strong> seconds…
              </p>
              <div className="progress mb-3" style={{ height: 6 }}>
                <div className="progress-bar" style={{ width: `${((4 - countdown) / 4) * 100}%`, background: 'var(--primary-mid)' }}></div>
              </div>
              <div className="d-grid gap-2">
                <Link to="/recruiter/dashboard" className="btn btn-primary w-100">
                  <FontAwesomeIcon icon="arrow-right" style={{ marginRight: 8 }} /> Go to Recruiter Dashboard
                </Link>
                <Link to="/admin/dashboard" className="btn btn-outline-secondary w-100">
                  Or Admin Dashboard
                </Link>
              </div>
            </>
          )}

          {status === 'password-reset' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: 18, margin: '0 auto 1.25rem',
                background: 'linear-gradient(135deg, rgba(92,107,192,0.12), rgba(201,168,76,0.12))',
                color: 'var(--primary-mid)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.25rem',
              }}>
                <FontAwesomeIcon icon="key" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
                Create your new password
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-gray)', marginBottom: '1.5rem' }}>
                Your identity has been verified. For security reasons, choose a strong password that is at least 8 characters long and different from your previous one.
              </p>
              <PasswordSetterForm />
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1.25rem',
                background: 'linear-gradient(135deg, rgba(207,34,46,0.14), rgba(207,34,46,0.24))',
                color: 'var(--error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.25rem',
              }}>
                <FontAwesomeIcon icon="triangle-exclamation" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
                That link didn&apos;t work
              </h2>
              <div className="alert alert-error text-start mb-4" style={{ fontSize: '0.86rem' }}>
                <FontAwesomeIcon icon="circle-exclamation" style={{ marginRight: 6 }} />
                {error || 'The confirmation or reset link is invalid, expired, or has already been used.'}
              </div>
              <div className="d-grid gap-2">
                <Link to="/forgot-password" className="btn btn-primary w-100">
                  <FontAwesomeIcon icon="rotate" style={{ marginRight: 8 }} /> Request a new password reset
                </Link>
                <Link to="/login" className="btn btn-outline-secondary w-100">
                  Back to Sign In
                </Link>
              </div>
              <div style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                <FontAwesomeIcon icon="circle-info" style={{ marginRight: 5 }} />
                For security, password reset links expire after 60 minutes and are single-use. Email confirmation links expire after 24 hours.
              </div>
            </>
          )}
        </div>
      </div>
      <LandingFooter />
    </div>
  );
};

const PasswordSetterForm = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reqs = [
    { k: '≥ 8 chars', ok: password.length >= 8 },
    { k: 'Mixed case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { k: 'Has a number', ok: /\d/.test(password) },
    { k: 'Matches confirmation', ok: confirm.length > 0 && password === confirm },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const failed = reqs.find(r => !r.ok);
    if (failed) {
      setError(`Please meet all password requirements: missing "${failed.k}".`);
      return;
    }
    setLoading(true);
    try {
      await authService.changePassword(password);
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not update the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        <div className="alert alert-success mb-4 text-start">
          <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />
          Password updated successfully. You can now sign in with your new password.
        </div>
        <Link to="/login" className="btn btn-primary w-100 btn-lg">
          <FontAwesomeIcon icon="right-from-bracket" style={{ marginRight: 8 }} /> Continue to Sign In
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error mb-3" style={{ fontSize: '0.85rem', textAlign: 'left' }}>
        <FontAwesomeIcon icon="circle-exclamation" style={{ marginRight: 6 }} /> {error}
      </div>}

      <div className="mb-3 text-start">
        <label className="form-label">New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose a strong password"
            required
            autoComplete="new-password"
            style={{ paddingRight: '3.5rem' }}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer',
              fontSize: '0.9rem', padding: '0.3rem 0.5rem', borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FontAwesomeIcon icon={show ? 'eye-slash' : 'eye'} />
          </button>
        </div>
      </div>

      <div className="mb-3 text-start">
        <label className="form-label">Confirm New Password</label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter the new password"
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>

      <div style={{
        background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: 10,
        padding: '0.75rem 0.9rem', marginBottom: '1.25rem', textAlign: 'left',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-light)', marginBottom: '0.4rem' }}>
          Password Requirements
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
          {reqs.map(r => (
            <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: r.ok ? 'var(--success)' : 'var(--text-light)' }}>
              <FontAwesomeIcon icon={r.ok ? 'check-square' : 'square'} />
              {r.k}
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-gold w-100 btn-lg"
        disabled={loading}
      >
        {loading ? (
          <><span className="spinner spinner-sm spinner-gold"></span> Updating password…</>
        ) : (
          <><FontAwesomeIcon icon="floppy-disk" style={{ marginRight: 8 }} /> Save New Password</>
        )}
      </button>
    </form>
  );
};

export default AuthCallback;
