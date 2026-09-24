import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import AdminLayout from '../components/AdminLayout';
import { authService } from '../services/api';
import { adminService, sendRecruiterInvite, acceptRecruiterInvite } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../context/UserContext';

const SettingsForm = ({ user, onSave, adminUpdate, refreshProfile }) => {
  const [form, setForm] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '',
    email: user?.email || '', username: user?.username || '',
    notifications: true, newsletter: false, weekly_digest: true, theme: 'university',
    current_password: '', new_password: '', confirm_password: '',
  });
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(f => ({
      ...f,
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      username: user?.username || '',
    }));
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form);
      if (adminUpdate && user?.id) {
        await adminService.updateUser(user.id, {
          first_name: form.first_name,
          last_name: form.last_name,
          username: form.username,
          settings: {
            notifications: form.notifications,
            weekly_digest: form.weekly_digest,
            newsletter: form.newsletter,
            theme: form.theme,
          },
        });
        if (refreshProfile) await refreshProfile();
      }
      if (form.new_password && form.new_password === form.confirm_password) {
        if (form.new_password.length < 8) {
          throw new Error('New password must be at least 8 characters.');
        }
        await authService.changePassword(form.new_password);
        setForm(f => ({ ...f, current_password: '', new_password: '', confirm_password: '' }));
      } else if (form.new_password && form.new_password !== form.confirm_password) {
        throw new Error('New passwords do not match.');
      }
      setToast({ type: 'success', msg: 'Settings saved successfully.' });
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };
  const Row = ({ label, child }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1rem', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{label}</div>
      <div>{child}</div>
    </div>
  );

  // Invitation Management state and handlers
  const [inviteEmail, setInviteEmail] = useState('');
  const [invites, setInvites] = useState([]);
  const [acceptTokenInput, setAcceptTokenInput] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!user?.company_id) return;
    const { data, error } = await supabase
      .from('recruiter_invites')
      .select('*')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false });
    if (!error) setInvites(data || []);
  }, [user?.company_id]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteEmail.trim()) return;
    try {
      const res = await sendRecruiterInvite(user.company_id, inviteEmail.trim());
      setInviteEmail('');
      setToast({ type: 'success', msg: `Invitation sent to ${inviteEmail}. Link created!` });
      loadInvites();
      if (res?.inviteUrl) {
        navigator.clipboard?.writeText(res.inviteUrl).catch(() => {});
      }
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Failed to send invitation.' });
    }
  };

  const handleAcceptInviteDirect = async () => {
    if (!acceptTokenInput.trim()) return;
    setAcceptingInvite(true);
    try {
      const res = await acceptRecruiterInvite(acceptTokenInput.trim());
      setAcceptTokenInput('');
      setToast({ type: 'success', msg: res.message || 'Invitation accepted! You are now linked to the company.' });
      if (refreshProfile) await refreshProfile();
    } catch (e) {
      setToast({ type: 'error', msg: e?.message || 'Failed to accept invitation.' });
    } finally {
      setAcceptingInvite(false);
    }
  };

  const InvitationSection = () => (
    <div className="card mb-4">
      <div className="card-header"><FontAwesomeIcon icon="envelope" style={{ marginRight: 6 }} />Company & Recruiter Invitations</div>
      <div className="card-body" style={{ padding: '0.9rem 1.4rem' }}>
        
        {/* Accept an invitation if user does not have company yet, or wants to join a different company */}
        <div style={{ background: 'rgba(26,35,126,0.03)', padding: '0.9rem', borderRadius: 10, border: '1px dashed var(--border-color)', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)', marginBottom: '0.35rem' }}>
            <FontAwesomeIcon icon="link" style={{ marginRight: 6, color: 'var(--gold-mid)' }} />
            Accept Company Invitation Code
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginBottom: '0.6rem' }}>
            Enter your invitation token/code below to link your account to a company workspace.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. tok-1712345678-abc"
              value={acceptTokenInput}
              onChange={e => setAcceptTokenInput(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
            <button
              className="btn btn-gold btn-sm"
              onClick={handleAcceptInviteDirect}
              disabled={acceptingInvite || !acceptTokenInput.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {acceptingInvite ? <span className="spinner spinner-sm spinner-gold"></span> : 'Join Company'}
            </button>
          </div>
        </div>

        {/* Invite team recruiters if user is part of a company */}
        {user?.company_id && (
          <>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)', marginBottom: '0.35rem' }}>
              <FontAwesomeIcon icon="paper-plane" style={{ marginRight: 6, color: 'var(--primary-light)' }} />
              Invite Recruiters to Your Workspace
            </div>
            <div className="mb-3" style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="email"
                className="form-control"
                placeholder="Recruiter email (e.g. recruiter@company.com)"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSendInvite} style={{ whiteSpace: 'nowrap' }}>
                Send Invite
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '0.4rem' }}>
              Pending Workspace Invites
            </div>
            <table className="table table-sm" style={{ fontSize: '0.82rem' }}>
              <thead><tr><th>Email</th><th>Status</th><th style={{ textAlign: 'right' }}>Invite Link</th></tr></thead>
              <tbody>
                {invites.map(i => {
                  const inviteUrl = `${window.location.origin}/recruiter/accept-invite?token=${i.token}`;
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.email}</td>
                      <td>
                        <span className={`badge ${i.status === 'accepted' ? 'badge-success' : 'badge-gold'}`} style={{ fontSize: '0.7rem' }}>
                          {i.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.74rem' }}
                          onClick={() => {
                            navigator.clipboard?.writeText(inviteUrl);
                            setToast({ type: 'success', msg: 'Invitation link copied to clipboard!' });
                          }}
                          title="Copy Invitation Link"
                        >
                          <FontAwesomeIcon icon="copy" style={{ marginRight: 4 }} /> Copy Link
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {invites.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '1rem' }}>No pending invitations.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="user" style={{ marginRight: 6 }} />Personal Information</div>
            <div className="card-body" style={{ padding: '0 1.4rem' }}>
              <Row label="First Name" child={<input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />} />
              <Row label="Last Name" child={<input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />} />
              <Row label="Email" child={<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled />} />
              <Row label="Username" child={<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />} />
            </div>
          </div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="lock" style={{ marginRight: 6 }} />Change Password</div>
            <div className="card-body" style={{ padding: '0 1.4rem' }}>
              <Row label="Current Password" child={<input type="password" placeholder="••••••••" value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })} />} />
              <Row label="New Password" child={<input type="password" placeholder="Minimum 8 chars" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />} />
              <Row label="Confirm New Password" child={<input type="password" placeholder="Re-enter new password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} />} />
            </div>
          </div>
        </div>
        <div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="bell" style={{ marginRight: 6 }} />Notification Preferences</div>
            <div className="card-body" style={{ padding: '0.5rem 1.4rem 1rem' }}>
              {[
                { k: 'notifications', t: 'Push Notifications', d: 'Browser notifications when a ranking job finishes.' },
                { k: 'weekly_digest', t: 'Weekly Digest', d: 'Summary email every Monday with top candidates and KPIs.' },
                { k: 'newsletter', t: 'Product Updates', d: 'Occasional emails about new AI features and model releases.' },
              ].map(s => (
                <label key={s.k} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <input type="checkbox" className="form-check-input" checked={form[s.k]} onChange={e => setForm({ ...form, [s.k]: e.target.checked })} style={{ marginTop: 4 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{s.t}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>{s.d}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="palette" style={{ marginRight: 6 }} />Appearance</div>
            <div className="card-body" style={{ padding: '1rem 1.4rem 1.4rem' }}>
              <Row label="Theme" child={<select value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })}>
                <option value="university">University Navy + Gold</option>
                <option value="light">Light (neutral)</option>
                <option value="dark">Dark (beta)</option>
              </select>} />
            </div>
          </div>
          <InvitationSection />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-gold" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner spinner-sm spinner-gold"></span> Saving…</> : <><FontAwesomeIcon icon="floppy-disk" style={{ marginRight: 6 }} />Save All Settings</>}
            </button>
          </div>
        </div>
      </div>
      {toast && (
        <div className={`alert alert-${toast.type === 'error' ? 'danger' : 'success'}`} style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 260, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
          {toast.type === 'error' ? <><FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} /></> : <><FontAwesomeIcon icon="check" style={{ marginRight: 6 }} /></>}{toast.msg}
        </div>
      )}
    </>
  );
};

export const RecruiterSettings = () => {
  const { user, refreshProfile } = useUser();
  return (
    <RecruiterLayout user={user} title="Settings" subtitle="Profile, notifications and appearance">
      <SettingsForm user={user} onSave={async () => {}} adminUpdate={true} refreshProfile={refreshProfile} />
    </RecruiterLayout>
  );
};

export const AdminSettings = () => {
  const { user, refreshProfile } = useUser();
  return (
    <AdminLayout user={user} title="Admin Settings" subtitle="Your profile and global admin preferences">
      <SettingsForm user={user} onSave={async () => {}} adminUpdate={true} refreshProfile={refreshProfile} />
    </AdminLayout>
  );
};

export default RecruiterSettings;
