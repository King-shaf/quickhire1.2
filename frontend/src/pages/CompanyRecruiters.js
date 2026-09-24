import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CompanyLayout from '../components/CompanyLayout';
import { useUser } from '../context/UserContext';
import { companyService, ensureCompanyForUser } from '../services/supabaseService';

const CompanyRecruiters = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [q, setQ] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [toast, setToast] = useState(null);
  const [monitorRecruiter, setMonitorRecruiter] = useState(null);
  const [clearingRecruiterBacklog, setClearingRecruiterBacklog] = useState(false);

  const resolveCompanyId = async () => {
    let cid = user?.company_id || user?.companies?.id;
    if (!cid && user) {
      cid = await ensureCompanyForUser(user);
    }
    if (!cid) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        cid = u.company_id || u.companies?.id;
      } catch (_) {}
    }
    return cid;
  };

  const loadRecruiters = async () => {
    const cid = await resolveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, invites] = await Promise.all([
        companyService.getRecruiters(cid),
        companyService.getPendingInvites(cid),
      ]);
      setRecruiters(list || []);
      setPendingInvites(invites || []);
    } catch (err) {
      console.error('Failed to load recruiters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecruiters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id, user?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!q.trim()) return recruiters;
    const query = q.toLowerCase();
    return recruiters.filter(r =>
      (r.name || '').toLowerCase().includes(query) ||
      (r.email || '').toLowerCase().includes(query) ||
      (r.employeeId || '').toLowerCase().includes(query) ||
      (r.idNumber || '').toLowerCase().includes(query)
    );
  }, [recruiters, q]);

  const openInvite = () => {
    setInviteOpen(true);
    setInviteName('');
    setInviteEmail('');
    setInviteError('');
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteError('');
  };

  const sendInvite = async () => {
    setInviteError('');
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Please fill in both name and email.');
      return;
    }
    setSendingInvite(true);
    try {
      const cid = await resolveCompanyId();
      if (!cid) throw new Error('Company workspace could not be verified. Please reload the page.');

      const res = await companyService.inviteRecruiter(cid, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
      });
      const link = res?.inviteUrl || `${window.location.origin}/recruiter/accept-invite?otp=${res?.otp || ''}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      const emailStatus = res?.otpSent
        ? `6-digit OTP sent to ${inviteEmail.trim()}`
        : `OTP: ${res?.otp || 'Generated'}`;
      setToast({
        type: 'success',
        message: `Invitation created! ${emailStatus}. Link copied to clipboard.`,
      });
      closeInvite();
      await loadRecruiters();
    } catch (err) {
      setInviteError(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendOtp = async (inv) => {
    try {
      const cid = await resolveCompanyId();
      const res = await companyService.resendInviteOtp(cid, inv);
      setToast({ type: 'success', message: `New OTP (${res.otp}) generated and sent to ${res.email}!` });
      loadRecruiters();
    } catch (e) {
      setToast({ type: 'error', message: 'Failed to resend OTP.' });
    }
  };

  const handleCancelInvite = async (inv) => {
    if (!window.confirm(`Cancel invitation for ${inv.email}?`)) return;
    try {
      await companyService.cancelInvite(inv.id);
      setToast({ type: 'success', message: 'Invitation cancelled.' });
      loadRecruiters();
    } catch (e) {
      setToast({ type: 'error', message: 'Failed to cancel invite.' });
    }
  };

  const removeRecruiter = async (r) => {
    const ok = window.confirm(`Remove recruiter "${r.name}"? This will suspend their account.`);
    if (!ok) return;
    try {
      await companyService.removeRecruiter(r.id);
      setToast({ type: 'success', message: `Recruiter "${r.name}" has been removed.` });
      loadRecruiters();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to remove recruiter.' });
    }
  };

  const handleClearRecruiterBacklog = async (recruiterId) => {
    const cid = await resolveCompanyId();
    if (!cid) return;
    setClearingRecruiterBacklog(true);
    try {
      const res = await companyService.clearBacklog(cid, recruiterId);
      setToast({ type: 'success', message: res.message || 'Backlog cleared successfully!' });
      setMonitorRecruiter(null);
      await loadRecruiters();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to clear backlog.' });
    } finally {
      setClearingRecruiterBacklog(false);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'active') return 'badge badge-success';
    if (status === 'invited') return 'badge badge-warning';
    if (status === 'suspended') return 'badge badge-error';
    return 'badge';
  };

  const avatarInitials = (name) => {
    return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <CompanyLayout user={user} title="Recruiters">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      </CompanyLayout>
    );
  }

  return (
    <CompanyLayout user={user} title="Recruiters" subtitle={`${recruiters.length} recruiters in your workspace`}>
      {toast && (
        <div className={`alert ${toast.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
          {toast.type === 'success' && <FontAwesomeIcon icon="check" style={{ marginRight: 8 }} />}
          {toast.type === 'error' && <FontAwesomeIcon icon="xmark" style={{ marginRight: 8 }} />}
          {toast.message}
        </div>
      )}

      {(user?.company_code || user?.companies?.company_code) && (
        <div className="card" style={{
          padding: '1rem 1.25rem', marginBottom: '1rem',
          background: 'linear-gradient(135deg, rgba(30,58,138,0.06), rgba(245,158,11,0.06))',
          border: '1px solid rgba(30,58,138,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8, background: 'var(--primary-dark)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
            }}>
              <FontAwesomeIcon icon="building" />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                Your Company ID
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-dark)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                {user?.company_code || user?.companies?.company_code}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)', maxWidth: 460 }}>
            Share this ID with your recruiters so they can link directly to your company workspace upon signup.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: '0.8rem' }}>
          <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <div className="filter-label">
              <FontAwesomeIcon icon="filter" style={{ marginRight: 6 }} />Search Recruiters
            </div>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon
                icon="search"
                style={{
                  position: 'absolute',
                  left: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  fontSize: '0.88rem',
                }}
              />
              <input
                type="search"
                placeholder="Search by name, email, or employee ID…"
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{ paddingLeft: '2.25rem', padding: '0.55rem 0.8rem 0.55rem 2.25rem', fontSize: '0.88rem', width: '100%' }}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={openInvite}>
            <FontAwesomeIcon icon="user-plus" style={{ marginRight: 6 }} />
            Add recruiter
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Recruiter</th>
              <th style={{ width: 130 }}>Employee / ID No.</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 100, textAlign: 'center' }}>CVs Uploaded</th>
              <th style={{ width: 100, textAlign: 'center' }}>Batches</th>
              <th style={{ width: 90, textAlign: 'center' }}>Jobs</th>
              <th style={{ minWidth: 140 }}>Reviewed vs Backlog</th>
              <th style={{ width: 110 }}>Last active</th>
              <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: 'var(--text-light)' }}>
                    <FontAwesomeIcon icon="users" />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--primary-dark)' }}>
                    {q ? 'No recruiters match your search' : 'No recruiters yet'}
                  </h3>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                    {q
                      ? 'Try adjusting your search term or clear it to see all recruiters.'
                      : 'Click "Add recruiter" to invite your first team member.'}
                  </p>
                  {q && (
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setQ('')}>
                      <FontAwesomeIcon icon="xmark" style={{ marginRight: 6 }} />Clear Search
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div className="avatar avatar-sm avatar-gold">
                        {avatarInitials(r.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                          <FontAwesomeIcon icon="envelope" style={{ marginRight: 4 }} />
                          {r.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {r.employeeId ? (
                      <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}>
                        {r.employeeId}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>—</span>
                    )}
                    {r.idNumber && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
                        ID: {r.idNumber}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={statusBadgeClass(r.status)} style={{ textTransform: 'capitalize' }}>
                      {r.status === 'active' && <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} />}
                      {r.status === 'suspended' && <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} />}
                      {r.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-secondary" style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                      {r.cvsUploaded ?? 0}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-secondary" style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                      {r.batchesCreated ?? 0}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-secondary" style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                      {r.jobsCreated ?? 0}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>{r.candidatesReviewed ?? 0} rev</span>
                      {' · '}
                      <span style={{ color: (r.backlogCount || 0) > 0 ? '#d97706' : 'var(--text-light)', fontWeight: 700 }}>
                        {r.backlogCount ?? 0} backlog
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                    {r.lastActive}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setMonitorRecruiter(r)}
                        title={`Monitor ${r.name}`}
                        style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem' }}
                      >
                        <FontAwesomeIcon icon="crosshairs" style={{ marginRight: 4 }} />
                        Monitor
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => removeRecruiter(r)}
                        aria-label={`Remove ${r.name}`}
                        title={`Remove ${r.name}`}
                        style={{ padding: '0.3rem 0.5rem' }}
                      >
                        <FontAwesomeIcon icon="trash" style={{ color: 'var(--error)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations Section */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-dark)', margin: 0 }}>
              <FontAwesomeIcon icon="envelope-open-text" style={{ marginRight: 8, color: 'var(--gold-mid)' }} />
              Pending Recruiter Invitations ({pendingInvites.length})
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.15rem' }}>
              Share these invitation links or codes with recruiters so they can link their accounts to your workspace.
            </div>
          </div>
          <button className="btn btn-sm btn-gold" onClick={openInvite}>
            <FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} /> New Invite
          </button>
        </div>

        {pendingInvites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-light)', fontSize: '0.86rem' }}>
            No pending invitations. Click "Invite Recruiter" to add team members.
          </div>
        ) : (
          <table className="table table-sm" style={{ marginBottom: 0, fontSize: '0.84rem' }}>
            <thead>
              <tr>
                <th>Recruiter Email</th>
                <th>Name</th>
                <th>OTP / Token</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map(inv => {
                const inviteUrl = `${window.location.origin}/recruiter/accept-invite?token=${inv.token}&otp=${inv.otp || ''}`;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{inv.email}</td>
                    <td style={{ color: 'var(--text-gray)' }}>{inv.name || '—'}</td>
                    <td>
                      {inv.otp ? (
                        <span className="badge badge-gold" style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '0.8rem', fontWeight: 800 }}>
                          OTP: {inv.otp}
                        </span>
                      ) : (
                        <code style={{ fontSize: '0.76rem' }}>{inv.token}</code>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${inv.status === 'accepted' ? 'badge-success' : 'badge-gold'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleResendOtp(inv)}
                          title="Resend OTP Email"
                        >
                          <FontAwesomeIcon icon="rotate" style={{ marginRight: 4 }} /> Resend OTP
                        </button>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            navigator.clipboard?.writeText(inviteUrl);
                            setToast({ type: 'success', message: 'Invitation link copied to clipboard!' });
                          }}
                          title="Copy Invitation Link"
                        >
                          <FontAwesomeIcon icon="copy" style={{ marginRight: 4 }} /> Copy Link
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleCancelInvite(inv)}
                          title="Cancel Invitation"
                        >
                          <FontAwesomeIcon icon="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {inviteOpen && (
        <div className="modal-overlay" onClick={closeInvite}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="d-flex align-items-center gap-3">
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--primary-50)',
                  color: 'var(--primary-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.05rem',
                }}>
                  <FontAwesomeIcon icon="user-plus" />
                </div>
                <div>
                  <h3 className="modal-title">Invite a recruiter</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    A 6-digit OTP and workspace invite will be sent to their email.
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={closeInvite} aria-label="Close">×</button>
            </div>

            <div className="modal-body">
              {inviteError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <FontAwesomeIcon icon="xmark" style={{ marginRight: 6 }} />
                  {inviteError}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  Full name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Johnson"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  disabled={sendingInvite}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label className="form-label">
                  Email <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="sarah.johnson@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={sendingInvite}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeInvite} disabled={sendingInvite}>Cancel</button>
              <button className="btn btn-primary" onClick={sendInvite} disabled={sendingInvite}>
                {sendingInvite ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Sending OTP & Invite...</>
                ) : (
                  <><FontAwesomeIcon icon="paper-plane" style={{ marginRight: 6 }} /> Send OTP & Invitation</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recruiter Monitor Deep-Dive Modal */}
      {monitorRecruiter && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: '1.75rem', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-dark)',
                  color: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800
                }}>
                  {avatarInitials(monitorRecruiter.name)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-dark)', fontWeight: 800 }}>
                    {monitorRecruiter.name}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    {monitorRecruiter.email} · {monitorRecruiter.employeeId}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMonitorRecruiter(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: 'var(--text-light)', cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon="xmark" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem'
            }}>
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                  {monitorRecruiter.cvsUploaded || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  CVs Uploaded
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                  {monitorRecruiter.batchesCreated || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Batches Created
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6' }}>
                  {monitorRecruiter.jobsCreated || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Jobs Posted
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                  {monitorRecruiter.candidatesReviewed || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Reviewed
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (monitorRecruiter.backlogCount || 0) > 0 ? '#d97706' : 'var(--text-light)' }}>
                  {monitorRecruiter.backlogCount || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Backlog
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {monitorRecruiter.hiredCount || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Hired
                </div>
              </div>
            </div>

            {/* Backlog Clearance for this recruiter */}
            {(monitorRecruiter.backlogCount || 0) > 0 ? (
              <div style={{
                padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem'
              }}>
                <div style={{ fontSize: '0.82rem', color: '#92400e' }}>
                  <strong>{monitorRecruiter.backlogCount} unreviewed CVs</strong> pending in this recruiter&apos;s queue.
                </div>
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => handleClearRecruiterBacklog(monitorRecruiter.id)}
                  disabled={clearingRecruiterBacklog}
                  style={{ fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                >
                  {clearingRecruiterBacklog ? (
                    <div className="spinner spinner-sm" style={{ marginRight: 4 }} />
                  ) : (
                    <FontAwesomeIcon icon="broom" style={{ marginRight: 4 }} />
                  )}
                  Clear Backlog
                </button>
              </div>
            ) : (
              <div style={{
                padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.82rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <FontAwesomeIcon icon="circle-check" />
                No unreviewed CV backlog for this recruiter. All candidates have been evaluated or cleared.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                className="btn btn-outline-secondary"
                onClick={() => setMonitorRecruiter(null)}
              >
                Close
              </button>
              <a
                href="/company/dashboard"
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
              >
                <FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} />
                Open in Dashboard Monitor
              </a>
            </div>
          </div>
        </div>
      )}
    </CompanyLayout>
  );
};

export default CompanyRecruiters;
