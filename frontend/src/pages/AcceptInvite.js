import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { acceptRecruiterInvite } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const otpFromUrl = searchParams.get('otp') || '';
  const [otpInput, setOtpInput] = useState(otpFromUrl || tokenFromUrl);
  const [status, setStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const { user, refreshProfile } = useUser();
  const navigate = useNavigate();

  const handleAccept = async (codeToUse) => {
    const activeCode = codeToUse || otpInput;
    if (!activeCode || !activeCode.trim()) {
      setStatus('error');
      setMessage('Please provide the 6-digit OTP code or invitation token.');
      return;
    }

    setStatus('processing');
    setMessage('');

    try {
      const res = await acceptRecruiterInvite(activeCode.trim(), user);
      setStatus('success');
      setMessage(res.message || 'Invitation accepted successfully! You are now connected to the company workspace.');
      if (refreshProfile) {
        await refreshProfile();
      }
      setTimeout(() => {
        navigate('/recruiter/dashboard');
      }, 2500);
    } catch (err) {
      console.error('Accept invite error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to accept invitation. Please verify the 6-digit OTP code and try again.');
    }
  };

  useEffect(() => {
    if ((otpFromUrl || tokenFromUrl) && user) {
      handleAccept(otpFromUrl || tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpFromUrl, tokenFromUrl, user]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d1442 0%, #1a237e 60%, #283593 100%)',
      padding: '1.5rem',
    }}>
      <div className="card" style={{
        maxWidth: 520,
        width: '100%',
        borderRadius: 16,
        padding: '2.5rem 2rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        background: '#fff',
      }}>
        {/* Header Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: status === 'success' ? 'rgba(46,125,50,0.1)' : status === 'error' ? 'rgba(198,40,40,0.1)' : 'rgba(26,35,126,0.08)',
          color: status === 'success' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--primary-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          margin: '0 auto 1.25rem',
        }}>
          {status === 'processing' ? (
            <div className="spinner spinner-md"></div>
          ) : status === 'success' ? (
            <FontAwesomeIcon icon="circle-check" />
          ) : status === 'error' ? (
            <FontAwesomeIcon icon="circle-exclamation" />
          ) : (
            <FontAwesomeIcon icon="shield-halved" />
          )}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1.6rem',
          color: 'var(--primary-dark)',
          marginBottom: '0.5rem',
        }}>
          {status === 'success' ? 'Invitation Confirmed!' : 'Company Invitation OTP'}
        </h1>

        <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
          {status === 'success'
            ? 'Your recruiter account has been verified and linked to the company workspace. Redirecting to your dashboard…'
            : 'Enter the 6-digit One-Time PIN (OTP) code or invitation link token provided by your company manager to join the workspace.'}
        </p>

        {!user && (
          <div className="alert alert-warning mb-4" style={{ fontSize: '0.85rem', textAlign: 'left' }}>
            <FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />
            <strong>You are not signed in.</strong> Please log in or register before confirming this OTP invite.
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <Link to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="btn btn-sm btn-primary">
                Log In
              </Link>
              <Link to={`/signup?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="btn btn-sm btn-outline-primary">
                Create Account
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="alert alert-error mb-4" style={{ fontSize: '0.85rem' }}>
            <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 6 }} />
            {message}
          </div>
        )}

        {status === 'success' && (
          <div className="alert alert-success mb-4" style={{ fontSize: '0.85rem' }}>
            <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} />
            {message}
          </div>
        )}

        {status !== 'success' && (
          <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)', display: 'flex', justifyContent: 'space-between' }}>
              <span>6-Digit Invitation OTP</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 400 }}>e.g. 842190 or token</span>
            </label>
            <input
              type="text"
              className="form-control text-center"
              placeholder="••••••"
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.trim())}
              disabled={status === 'processing'}
              maxLength={64}
              style={{
                fontSize: '1.4rem',
                letterSpacing: '0.2em',
                fontWeight: 800,
                padding: '0.75rem',
                fontFamily: 'ui-monospace, monospace',
                borderRadius: 10,
                border: '2px solid var(--primary-mid)',
              }}
            />
          </div>
        )}

        {status !== 'success' && (
          <button
            className="btn btn-gold"
            onClick={() => handleAccept(otpInput)}
            disabled={status === 'processing' || !otpInput.trim() || !user}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '0.95rem' }}
          >
            {status === 'processing' ? (
              <><span className="spinner spinner-sm spinner-gold"></span> Verifying OTP…</>
            ) : (
              <><FontAwesomeIcon icon="check-double" style={{ marginRight: 8 }} /> Confirm OTP & Link Workspace</>
            )}
          </button>
        )}

        {status === 'success' && (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/recruiter/dashboard')}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
          >
            Go to Recruiter Dashboard <FontAwesomeIcon icon="arrow-right" style={{ marginLeft: 8 }} />
          </button>
        )}

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-light)' }}>
          <Link to="/" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>
            <FontAwesomeIcon icon="house" style={{ marginRight: 6 }} /> Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;

