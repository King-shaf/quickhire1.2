import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, useNavigate } from 'react-router-dom';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import { authService } from '../services/api';

const passwordRequirements = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { label: 'A number (0–9)', test: (p) => /\d/.test(p) },
  { label: 'Special symbol (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const calcStrength = (p) => {
  if (!p) return { score: 0, label: 'Weak', class: 'weak' };
  const met = passwordRequirements.filter(r => r.test(p)).length;
  if (met <= 1) return { score: 1, label: 'Very Weak', class: 'weak' };
  if (met === 2) return { score: 2, label: 'Weak', class: 'weak' };
  if (met === 3) return { score: 3, label: 'Fair', class: 'fair' };
  if (met === 4) return { score: 4, label: 'Good', class: 'good' };
  return { score: 5, label: 'Strong', class: 'strong' };
};

const SignUp = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', username: '',
    dateOfBirth: '',
    password: '', confirmPassword: '', role: 'recruiter', agree: false,
    // Company specific fields
    companyName: '',
    companySize: '11-50',
    companyIndustry: 'Technology & Software',
    companyRegistrationNumber: '', // SA CIPC format: YYYY/NNNNNN/NN
    // Recruiter specific fields
    idNumber: '', // SA ID: exactly 13 digits
    recruiterCompanyCode: '', // Enter CMP-XXXXXX or CIPC number to link
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredInfo, setRegisteredInfo] = useState(null);
  const [showPw, setShowPw] = useState(false);

  const strength = calcStrength(form.password);

  const displayError = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === '{}' || trimmed === '[]' || trimmed === '[object Object]') return null;
      return trimmed;
    }
    if (Array.isArray(val)) {
      return val.map(displayError).filter(Boolean).join(', ') || null;
    }
    if (typeof val === 'object') {
      return displayError(val.message || val.detail || val.msg || null);
    }
    return String(val);
  };

  const update = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) {
      const ne = { ...errors }; delete ne[k]; setErrors(ne);
    }
  };

  const validate = () => {
    const e = {};
    if (form.firstName.trim().length < 2) e.firstName = 'First name must be at least 2 characters';
    if (form.lastName.trim().length < 2) e.lastName = 'Last name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email';
    if (form.username.trim().length < 3) e.username = 'Username must be 3+ characters';
    if (!form.dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required';
    } else {
      const dobDate = new Date(form.dateOfBirth);
      const today = new Date();
      if (isNaN(dobDate.getTime()) || dobDate >= today) {
        e.dateOfBirth = 'Please select a valid past date of birth';
      }
    }
    if (strength.score < 3) e.password = 'Please use a stronger password (Fair or better)';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.agree) e.agree = 'You must accept the Terms & Conditions';

    if (form.role === 'company') {
      if (!form.companyName.trim()) e.companyName = 'Company name is required';
      if (!form.companySize) e.companySize = 'Company size is required';
      if (!form.companyIndustry.trim()) e.companyIndustry = 'Industry is required';
      
      const cipcClean = form.companyRegistrationNumber.trim();
      if (!cipcClean) {
        e.companyRegistrationNumber = 'Company ID (CIPC Registration Number) is required';
      } else {
        // SA CIPC format: YYYY/NNNNNN/NN (e.g. 2021/123456/07)
        const cipcPattern = /^(?:19|20)\d{2}\/\d{6}\/(?:06|07|08|21|CK|\d{2})$/i;
        if (!cipcPattern.test(cipcClean)) {
          e.companyRegistrationNumber = 'Invalid format. Must be a South African CIPC registration number like YYYY/NNNNNN/NN (e.g. 2021/123456/07)';
        }
      }
    } else if (form.role === 'recruiter') {
      const idTrimmed = form.idNumber.trim();
      if (!idTrimmed) {
        e.idNumber = 'South African ID number is required';
      } else if (!/^\d{13}$/.test(idTrimmed)) {
        e.idNumber = 'Must be a valid South African ID consisting of exactly 13 digits with no other characters';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (evt) => {
    evt.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authService.register(form.email, form.password, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        date_of_birth: form.dateOfBirth,
        role: form.role,
        companyName: form.companyName.trim(),
        companySize: form.companySize,
        companyIndustry: form.companyIndustry.trim(),
        registration_number: form.companyRegistrationNumber.trim(),
        companyCode: (form.recruiterCompanyCode || '').trim().toUpperCase(),
        idNumber: form.idNumber.trim(),
      });

      setRegisteredInfo({
        role: form.role,
        email: form.email,
        companyName: form.companyName,
        companyCode: res?.company_code,
        registrationNumber: form.companyRegistrationNumber.trim() || res?.registration_number,
        employeeId: res?.employee_id,
        idNumber: form.idNumber.trim(),
        dateOfBirth: form.dateOfBirth,
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 5000);
    } catch (err) {
      console.error('[SignUp] full error:', err, err?.response?.data);
      let msg = '';
      if (typeof err === 'string') {
        msg = err;
      } else if (err && typeof err.message === 'string') {
        msg = err.message;
      } else if (err && typeof err.detail === 'string') {
        msg = err.detail;
      } else if (err && typeof err.msg === 'string') {
        msg = err.msg;
      }

      if (err && err.response && err.response.data) {
        const d = err.response.data;
        const detailErr = d.detail || d.msg || d.message || (typeof d === 'string' ? d : null);
        if (detailErr && typeof detailErr === 'string') msg = detailErr;

        if (d.errors && Array.isArray(d.errors)) {
          const perField = {};
          for (const fe of d.errors) {
            if (fe && fe.field) {
              const fieldMsg = fe.message || (typeof fe === 'string' ? fe : 'Invalid value');
              perField[fe.field] = fieldMsg;
            }
          }
          if (Object.keys(perField).length) {
            setErrors(prev => ({ ...prev, ...perField }));
          }
        } else if (typeof d === 'object' && !Array.isArray(d)) {
          // DRF style field errors: { email: ['...'], username: ['...'] }
          const perField = {};
          for (const [key, val] of Object.entries(d)) {
            if (['detail', 'msg', 'message'].includes(key)) continue;
            let extracted = '';
            if (Array.isArray(val) && val.length) {
              extracted = typeof val[0] === 'string' ? val[0] : (val[0]?.message || '');
            } else if (typeof val === 'string') {
              extracted = val;
            } else if (val && typeof val.message === 'string') {
              extracted = val.message;
            }
            if (extracted && extracted !== '{}') {
              perField[key] = extracted;
            }
          }
          if (Object.keys(perField).length) {
            setErrors(prev => ({ ...prev, ...perField }));
          }
        }
      }

      const trimmedMsg = (msg || '').trim();
      if (!trimmedMsg || trimmedMsg === '{}' || trimmedMsg === '[]' || trimmedMsg === '[object Object]') {
        msg = 'An account with this email or username already exists. Please sign in or try another email.';
      }

      const lower = msg.toLowerCase();
      if (lower.includes('company id') || lower.includes('cipc') || lower.includes('registration number') || lower.includes('company registration')) {
        setErrors(prev => ({ ...prev, companyRegistrationNumber: msg }));
      } else if (lower.includes('id number') || lower.includes('south african id')) {
        setErrors(prev => ({ ...prev, idNumber: msg }));
      } else if (lower.includes('username')) {
        setErrors(prev => ({ ...prev, username: msg }));
      } else if (lower.includes('password')) {
        setErrors(prev => ({ ...prev, password: msg }));
      } else {
        setErrors(prev => ({ ...prev, email: msg }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />

      <div style={{
        flex: 1,
        background: 'radial-gradient(ellipse at top right, rgba(255,215,0,0.12), transparent 55%), radial-gradient(ellipse at bottom left, rgba(92,107,192,0.18), transparent 55%), linear-gradient(180deg, #eef1fb 0%, #f5f7fa 70%)',
        padding: '3rem 1.25rem',
      }}>
        <div className="container-md" style={{ maxWidth: 820 }}>
          <div className="card" style={{ boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-mid) 60%, #3949ab 100%)',
              padding: '2rem 2.25rem', color: '#fff', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at 90% 30%, rgba(255,215,0,0.18), transparent 40%)',
              }}></div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.3rem', color: 'var(--primary-dark)',
                  boxShadow: '0 8px 20px rgba(201,168,76,0.3)',
                }}>QH</div>
                <div>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#fff', margin: 0, fontWeight: 800 }}>Create your QUICK HIRE account</h1>
                  <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Join our research platform and unlock AI-powered candidate ranking</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '2rem 2.25rem' }}>
              {success ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1rem', color: 'var(--success)' }}>
                    <FontAwesomeIcon icon="circle-check" />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
                    Registration Successful!
                  </h2>
                  <p style={{ color: 'var(--text-gray)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    A verification email has been sent to <strong>{form.email}</strong>.
                  </p>

                  {registeredInfo?.role === 'company' && (
                    <div style={{
                      maxWidth: 440, margin: '0 auto 1.5rem', padding: '1.25rem 1.5rem',
                      background: 'rgba(30,58,138,0.06)', borderRadius: 12, border: '1px solid rgba(30,58,138,0.2)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-mid)', fontWeight: 700 }}>
                        Auto-Generated Simple Company ID
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-dark)', letterSpacing: '2px', margin: '0.4rem 0' }}>
                        {registeredInfo.companyCode}
                      </div>
                      {registeredInfo.registrationNumber && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)', marginBottom: '0.4rem' }}>
                          CIPC Reg: <strong>{registeredInfo.registrationNumber}</strong>
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                        Share this Simple Company ID with your recruiters so they can link to your workspace upon signup.
                      </div>
                    </div>
                  )}

                  {registeredInfo?.role === 'recruiter' && registeredInfo?.employeeId && (
                    <div style={{
                      maxWidth: 420, margin: '0 auto 1.5rem', padding: '1.25rem 1.5rem',
                      background: 'rgba(16,185,129,0.08)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.25)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--success)', fontWeight: 700 }}>
                        Your Generated Employee ID
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065f46', letterSpacing: '2px', margin: '0.4rem 0' }}>
                        {registeredInfo.employeeId}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                        Assigned to your profile for verified recruiter activity and tracking.
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-center gap-2">
                    <span className="spinner spinner-gold"></span>
                    <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Redirecting you to sign in...</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid var(--primary-50)' }}>
                      <FontAwesomeIcon icon="user" style={{ marginRight: 8 }} />Personal Information
                    </h3>
                    <div className="grid-2" style={{ gap: '0.8rem' }}>
                      <div>
                        <label className="form-label">First Name</label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={e => update('firstName', e.target.value)}
                          placeholder="Sarah"
                          style={{ borderColor: displayError(errors.firstName) ? 'var(--error)' : undefined }}
                        />
                        {displayError(errors.firstName) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.firstName)}</div>}
                      </div>
                      <div>
                        <label className="form-label">Last Name</label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={e => update('lastName', e.target.value)}
                          placeholder="Johnson"
                          style={{ borderColor: displayError(errors.lastName) ? 'var(--error)' : undefined }}
                        />
                        {displayError(errors.lastName) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.lastName)}</div>}
                      </div>
                    </div>
                    <div className="grid-2 mt-3" style={{ gap: '0.8rem' }}>
                      <div>
                        <label className="form-label">Email Address</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => update('email', e.target.value)}
                          placeholder="you@university.edu"
                          style={{ borderColor: displayError(errors.email) ? 'var(--error)' : undefined }}
                        />
                        {displayError(errors.email) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.email)}</div>}
                      </div>
                      <div>
                        <label className="form-label">Username</label>
                        <input
                          type="text"
                          value={form.username}
                          onChange={e => update('username', e.target.value)}
                          placeholder="sarahj"
                          style={{ borderColor: displayError(errors.username) ? 'var(--error)' : undefined }}
                        />
                        {displayError(errors.username) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.username)}</div>}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="form-label">
                        Date of Birth <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={e => update('dateOfBirth', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        style={{ borderColor: displayError(errors.dateOfBirth) ? 'var(--error)' : undefined }}
                      />
                      {displayError(errors.dateOfBirth) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.dateOfBirth)}</div>}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid var(--primary-50)' }}>
                      <FontAwesomeIcon icon="lock" style={{ marginRight: 8 }} />Account Credentials
                    </h3>
                    <div className="mb-3">
                      <label className="form-label">Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={form.password}
                          onChange={e => update('password', e.target.value)}
                          placeholder="Create a strong password"
                          style={{ paddingRight: '2.75rem', borderColor: displayError(errors.password) ? 'var(--error)' : undefined }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => !s)}
                          style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'transparent', border: 'none', color: 'var(--text-light)',
                            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            padding: '0.3rem 0.5rem', borderRadius: 6,
                          }}
                        >
                          {showPw ? <FontAwesomeIcon icon="eye-slash" /> : <FontAwesomeIcon icon="eye" />}
                        </button>
                      </div>
                      <div className="password-strength">
                        <div className="password-strength-bar">
                          {[1, 2, 3, 4].map(n => (
                            <div
                              key={n}
                              className={`password-strength-segment ${strength.score >= n ? 'active ' + strength.class : ''}`}
                            ></div>
                          ))}
                        </div>
                        <div className="password-strength-label" style={{
                          color: strength.class === 'weak' ? 'var(--error)' : strength.class === 'fair' ? 'var(--warning)' : 'var(--success)',
                        }}>
                          Password strength: <strong>{strength.label}</strong>
                        </div>
                      </div>
                      <ul className="password-hints">
                        {passwordRequirements.map(r => {
                          const met = r.test(form.password);
                          return <li key={r.label} className={met ? 'met' : ''}>{r.label}</li>;
                        })}
                      </ul>
                      {displayError(errors.password) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.4rem' }}>{displayError(errors.password)}</div>}
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Confirm Password</label>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={e => update('confirmPassword', e.target.value)}
                        placeholder="Repeat your password"
                        style={{ borderColor: displayError(errors.confirmPassword) ? 'var(--error)' : undefined }}
                      />
                      {displayError(errors.confirmPassword) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.confirmPassword)}</div>}
                      {form.confirmPassword && form.password === form.confirmPassword && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 600 }}><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} />Passwords match</div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid var(--primary-50)' }}>
                      <FontAwesomeIcon icon="bullseye" style={{ marginRight: 8 }} />User Role
                    </h3>
                    <div className="grid-2" style={{ gap: '0.8rem' }}>
                      {[
                        { v: 'recruiter', label: 'Recruiter', icon: 'user-tie', desc: 'Upload CVs & manage rankings' },
                        { v: 'company', label: 'Company Manager', icon: 'building', desc: 'Supervise a team & view reports' },
                      ].map(opt => (
                        <label
                          key={opt.v}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            padding: '0.9rem 1rem', borderRadius: 12,
                            border: form.role === opt.v ? '2px solid var(--primary-mid)' : '2px solid var(--border-color)',
                            background: form.role === opt.v ? 'var(--primary-50)' : '#fff',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          onClick={() => update('role', opt.v)}
                        >
                          <input
                            type="radio"
                            name="role"
                            checked={form.role === opt.v}
                            onChange={() => update('role', opt.v)}
                            className="form-check-input"
                            style={{ marginTop: '0.25rem' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <FontAwesomeIcon icon={opt.icon} />
                              <span style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{opt.label}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {form.role === 'company' && (
                    <div style={{
                      marginBottom: '1.5rem',
                      padding: '1.25rem',
                      background: 'rgba(30,58,138,0.03)',
                      borderRadius: 12,
                      border: '1px solid rgba(30,58,138,0.15)'
                    }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FontAwesomeIcon icon="building" /> Company Workspace & Registration
                      </h3>
                      
                      <div className="mb-3">
                        <label className="form-label">Company Name <span style={{ color: 'var(--error)' }}>*</span></label>
                        <input
                          type="text"
                          value={form.companyName}
                          onChange={e => update('companyName', e.target.value)}
                          placeholder="e.g. Acme Innovations (Pty) Ltd"
                          style={{ borderColor: displayError(errors.companyName) ? 'var(--error)' : undefined }}
                        />
                        {displayError(errors.companyName) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.companyName)}</div>}
                      </div>

                      <div className="grid-2" style={{ gap: '0.8rem', marginBottom: '1rem' }}>
                        <div>
                          <label className="form-label">Company Size</label>
                          <select
                            value={form.companySize}
                            onChange={e => update('companySize', e.target.value)}
                            style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                          >
                            <option value="1-10">1-10 Employees (Startup)</option>
                            <option value="11-50">11-50 Employees (Small)</option>
                            <option value="51-200">51-200 Employees (Medium)</option>
                            <option value="201-500">201-500 Employees (Mid-Market)</option>
                            <option value="500+">500+ Employees (Enterprise)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Industry</label>
                          <input
                            type="text"
                            value={form.companyIndustry}
                            onChange={e => update('companyIndustry', e.target.value)}
                            placeholder="e.g. Technology, Finance, Healthcare"
                            style={{ borderColor: displayError(errors.companyIndustry) ? 'var(--error)' : undefined }}
                          />
                          {displayError(errors.companyIndustry) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.companyIndustry)}</div>}
                        </div>
                      </div>

                      <div className="mb-2">
                        <label className="form-label">
                          Company ID (CIPC Registration Number) <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={form.companyRegistrationNumber}
                          onChange={e => update('companyRegistrationNumber', e.target.value)}
                          placeholder="YYYY/NNNNNN/NN (e.g. 2021/123456/07)"
                          style={{
                            borderColor: displayError(errors.companyRegistrationNumber) ? 'var(--error)' : undefined,
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            fontFamily: 'monospace'
                          }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                          A South African company ID is an official 14-digit code issued by CIPC in the format <strong>YYYY/NNNNNN/NN</strong> (e.g. 2021/123456/07). A simple Company ID will be automatically generated after creating your account to easily share with recruiters.
                        </div>
                        {displayError(errors.companyRegistrationNumber) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                            {displayError(errors.companyRegistrationNumber)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {form.role === 'recruiter' && (
                    <div style={{
                      marginBottom: '1.5rem',
                      padding: '1.25rem',
                      background: 'rgba(5,150,105,0.04)',
                      borderRadius: 12,
                      border: '1px solid rgba(5,150,105,0.2)'
                    }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: '#065f46', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FontAwesomeIcon icon="id-card" /> Recruiter Verification & Company Linking
                      </h3>

                      <div className="mb-3">
                        <label className="form-label">
                          South African ID Number <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={form.idNumber}
                          onChange={e => {
                            const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 13);
                            update('idNumber', onlyDigits);
                          }}
                          placeholder="e.g. 9508125432087 (13 digits)"
                          maxLength={13}
                          style={{
                            borderColor: displayError(errors.idNumber) ? 'var(--error)' : undefined,
                            fontFamily: 'monospace',
                            letterSpacing: '1px',
                            fontWeight: 600
                          }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                          Must be a valid South African ID consisting of exactly 13 numbers with no letters or special characters ({form.idNumber.length}/13 digits).
                        </div>
                        {displayError(errors.idNumber) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.idNumber)}</div>}
                      </div>

                      <div className="mb-2">
                        <label className="form-label">
                          Company ID <span style={{ color: 'var(--text-light)', fontWeight: 'normal' }}>(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={form.recruiterCompanyCode}
                          onChange={e => update('recruiterCompanyCode', e.target.value.toUpperCase())}
                          placeholder="e.g. CMP-849201 or 2021/123456/07"
                          style={{
                            borderColor: displayError(errors.recruiterCompanyCode) ? 'var(--error)' : undefined,
                            fontFamily: 'monospace',
                            letterSpacing: '1px'
                          }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                          If your company manager gave you a Company ID (e.g. CMP-XXXXXX or CIPC registration number), enter it here to link your account to their organization. An Employee ID will be automatically generated for you.
                        </div>
                        {displayError(errors.recruiterCompanyCode) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{displayError(errors.recruiterCompanyCode)}</div>}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                        padding: '0.85rem 1rem', borderRadius: 12,
                        background: displayError(errors.agree) ? 'rgba(198,40,40,0.05)' : 'var(--bg-light)',
                        border: displayError(errors.agree) ? '1px solid rgba(198,40,40,0.3)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.agree}
                        onChange={e => update('agree', e.target.checked)}
                        className="form-check-input"
                        style={{ marginTop: '0.15rem' }}
                      />
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-gray)', lineHeight: 1.5 }}>
                        I agree to the <button type="button" onClick={e => e.preventDefault()} style={{ fontWeight: 600, background: 'transparent', border: 'none', padding: 0, color: 'var(--primary-mid)', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</button> and
                        acknowledge the <button type="button" onClick={e => e.preventDefault()} style={{ fontWeight: 600, background: 'transparent', border: 'none', padding: 0, color: 'var(--primary-mid)', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</button>, including
                        how QUICK HIRE stores, processes, and encrypts CV data for research and ranking purposes.
                      </div>
                    </label>
                    {displayError(errors.agree) && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.4rem' }}>{displayError(errors.agree)}</div>}
                  </div>

                  <div className="d-flex gap-3 flex-wrap">
                    <button type="submit" className="btn btn-primary btn-lg flex-1" disabled={loading}>
                      {loading ? <><span className="spinner spinner-sm spinner-gold"></span> Creating your account...</> : <><FontAwesomeIcon icon="gift" style={{ marginRight: 8 }} />Create Account</>}
                    </button>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-gray)' }}>
                    Already have an account? <Link to="/login" style={{ fontWeight: 700 }}>Sign in instead</Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
};

export default SignUp;
