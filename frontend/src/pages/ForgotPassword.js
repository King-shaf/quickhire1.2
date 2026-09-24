import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import { authService } from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  // step: 'request' | 'verify' | 'done'
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Step 1: Request Password Reset Email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(cleanEmail);
      setSuccessMsg(`A password reset link has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`);
      setResendCooldown(60);
      setStep('verify');
    } catch (err) {
      setError(err?.message || 'Unable to send password reset email. Please verify the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP / Token and save new password
  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    setError('');
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setError('Please enter the OTP or recovery token from your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyOtpAndResetPassword(email.trim(), cleanOtp, newPassword);
      setStep('done');
    } catch (err) {
      setError(err?.message || 'Failed to reset password. Please check the code or use the direct link in your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />

      <div style={{
        flex: 1,
        background: 'radial-gradient(ellipse at top, rgba(92,107,192,0.18), transparent 55%), linear-gradient(180deg, #eef1fb 0%, #f5f7fa 60%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.25rem',
      }}>
        <div className="grid-2" style={{ maxWidth: 960, width: '100%', gap: '2.5rem', alignItems: 'center' }}>
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
              Forgot your password?<br />
              <span style={{ color: 'var(--gold-dark)' }}>Reset via secure email verification.</span>
            </h1>
            <p style={{ color: 'var(--text-gray)', lineHeight: 1.7, fontSize: '0.92rem', marginBottom: '2rem' }}>
              Enter your registered account email to receive a password reset link and verification token. Follow the link in your inbox to immediately choose a new password and regain access.
            </p>

            <div className="d-flex flex-column gap-3">
              {[
                ['envelope-open-text', 'Direct password reset link sent to your inbox'],
                ['shield-halved', 'Secure cryptographic token authentication'],
                ['clock', 'Password reset links expire for account safety'],
              ].map(([icon, t]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.15rem', color: 'var(--primary-mid)' }}>
                    <FontAwesomeIcon icon={icon} />
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-gray)', lineHeight: 1.5 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '2.25rem', boxShadow: 'var(--shadow-xl)', maxWidth: 460, width: '100%', marginLeft: 'auto' }}>
            <div className="text-center mb-4">
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: '0 auto 0.75rem',
                background: 'linear-gradient(135deg, rgba(92,107,192,0.12), rgba(201,168,76,0.12))',
                color: 'var(--primary-mid)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem',
              }}>
                <FontAwesomeIcon icon={step === 'done' ? 'circle-check' : 'unlock-keyhole'} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--primary-dark)' }}>
                {step === 'done' ? 'Password Reset Complete' : step === 'verify' ? 'Check Your Email' : 'Reset your password'}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 0 }}>
                {step === 'done'
                  ? 'Your new credentials are saved and ready to use'
                  : step === 'verify'
                  ? `Instructions sent to ${email}`
                  : "We'll send a password reset link to your email"}
              </p>
            </div>

            {error && (
              <div className="alert alert-error mb-3" style={{ fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="circle-exclamation" style={{ marginRight: 6 }} /> {error}
              </div>
            )}

            {/* STEP 1: Request Email Form */}
            {step === 'request' && (
              <form onSubmit={handleSendOtp}>
                <div className="mb-3">
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <FontAwesomeIcon icon="envelope" style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-light)', fontSize: '0.9rem',
                    }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@university.edu"
                      required
                      autoComplete="email"
                      disabled={loading}
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 btn-lg"
                  disabled={loading || resendCooldown > 0}
                >
                  {loading ? (
                    <><span className="spinner spinner-sm spinner-gold"></span> Sending Reset Email…</>
                  ) : resendCooldown > 0 ? (
                    `Please wait ${resendCooldown}s`
                  ) : (
                    <><FontAwesomeIcon icon="paper-plane" style={{ marginRight: 8 }} /> Send Reset Link</>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Instructions & Verification Form */}
            {step === 'verify' && (
              <form onSubmit={handleVerifyAndReset}>
                {successMsg && (
                  <div className="alert alert-success mb-3" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                    <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} />
                    {successMsg}
                  </div>
                )}

                <div style={{
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.4rem' }}>
                    <FontAwesomeIcon icon="envelope-open-text" style={{ marginRight: 6, color: 'var(--primary-mid)' }} />
                    How to complete your password reset:
                  </div>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-gray)', paddingLeft: '1.2rem', margin: '0 0 0.5rem 0', lineHeight: 1.55 }}>
                    <li>Open your inbox and check for an email from <strong>QuickHire</strong>.</li>
                    <li>Click the <strong>Reset Password</strong> link to choose your new password.</li>
                    <li>Alternatively, if you have a recovery code or token from the email, enter it below.</li>
                  </ol>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                    Don't see the email? Please verify your spam/junk folder.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Recovery Code or Token</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.trim())}
                    placeholder="Enter code/token from email"
                    disabled={loading}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      letterSpacing: '1px',
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      Sent to: <strong>{email}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || resendCooldown > 0}
                      style={{
                        background: 'none', border: 'none',
                        color: resendCooldown > 0 ? 'var(--text-light)' : 'var(--primary-mid)',
                        fontSize: '0.75rem', fontWeight: 600, textDecoration: 'underline',
                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Email'}
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">New Password <span style={{ color: 'var(--error)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                      }}
                    >
                      <FontAwesomeIcon icon={showPassword ? 'eye-slash' : 'eye'} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Confirm New Password <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  {confirmPassword && newPassword === confirmPassword && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 600 }}>
                      <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> Passwords match
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 btn-lg mb-2"
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner spinner-sm spinner-gold"></span> Resetting Password…</>
                  ) : (
                    <><FontAwesomeIcon icon="shield-halved" style={{ marginRight: 8 }} /> Save New Password</>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 btn-sm"
                  onClick={() => { setStep('request'); setOtp(''); }}
                >
                  Use a different email
                </button>
              </form>
            )}

            {/* STEP 3: Success Confirmation */}
            {step === 'done' && (
              <div>
                <div className="alert alert-success mb-4" style={{ fontSize: '0.9rem' }}>
                  <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} />
                  Your password has been successfully reset! You can now log in with your updated credentials.
                </div>
                <button
                  type="button"
                  className="btn btn-primary w-100 btn-lg"
                  onClick={() => navigate('/login')}
                >
                  <FontAwesomeIcon icon="arrow-right" style={{ marginRight: 8 }} /> Proceed to Sign In
                </button>
              </div>
            )}

            <div style={{
              margin: '1.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem',
              fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
              Remembered it after all?
              <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
            </div>

            <Link to="/login" className="btn btn-outline-primary w-100">
              <FontAwesomeIcon icon="key" style={{ marginRight: 8 }} /> Sign in instead
            </Link>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
};

export default ForgotPassword;
