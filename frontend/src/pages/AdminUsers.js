import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminLayout from '../components/AdminLayout';
import { adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const pageSize = 10;

const AddUserModal = ({ open, onClose, onAdd }) => {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'recruiter',
    first_name: '',
    last_name: '',
    notify: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onAdd(form);
      setForm({ username: '', email: '', password: '', role: 'recruiter', first_name: '', last_name: '', notify: true });
    } catch (err) {
      setError(err?.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title"><FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} />Add New User</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            <div className="grid-2 mb-3" style={{ gap: '0.8rem' }}>
              <div>
                <label className="form-label">First Name</label>
                <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Jane" />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="grid-2 mb-3" style={{ gap: '0.8rem' }}>
              <div>
                <label className="form-label">Username <span style={{ color: 'var(--error)' }}>*</span></label>
                <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="jane.doe" />
              </div>
              <div>
                <label className="form-label">Email <span style={{ color: 'var(--error)' }}>*</span></label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@university.edu" />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Temporary Password <span style={{ color: 'var(--error)' }}>*</span></label>
              <input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.3rem' }}>Account will be created in Active status.</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Role</label>
              <div className="grid-2" style={{ gap: '0.6rem' }}>
                {[
                  { v: 'recruiter', t: 'Recruiter', desc: 'Upload CVs, rank candidates, generate reports' },
                  { v: 'company', t: 'Company Manager', desc: 'Hiring manager, job owner, limited access' },
                  { v: 'admin', t: 'Administrator', desc: 'Full system access including security' },
                ].map(r => (
                  <label key={r.v} style={{
                    display: 'flex', gap: '0.6rem', padding: '0.75rem 0.85rem', borderRadius: 10, cursor: 'pointer',
                    border: form.role === r.v ? '2px solid var(--primary-mid)' : '1.5px solid var(--border-color)',
                    background: form.role === r.v ? 'var(--primary-50)' : '#fff',
                  }}>
                    <input type="radio" name="role" checked={form.role === r.v} onChange={() => setForm({ ...form, role: r.v })} className="form-check-input" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{r.t}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm spinner-gold"></span> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditUserModal = ({ open, user, onClose, onSave, isSelf }) => {
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm({
        ...user,
        status: user.is_active !== false ? 'active' : 'disabled',
      });
    }
  }, [open, user]);

  if (!open || !user) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        is_active: form.status === 'active',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title"><FontAwesomeIcon icon="pen" style={{ marginRight: 6 }} />Edit User · {form.username}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="grid-2 mb-3" style={{ gap: '0.8rem' }}>
              <div>
                <label className="form-label">First Name</label>
                <input value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid-2 mb-3" style={{ gap: '0.8rem' }}>
              <div>
                <label className="form-label">Username</label>
                <input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Role</label>
              <select value={form.role || 'recruiter'} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="recruiter">Recruiter</option>
                <option value="company">Company Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Account Status</label>
              <select
                value={form.status || 'active'}
                onChange={e => setForm({ ...form, status: e.target.value })}
                disabled={isSelf}
              >
                <option value="active">Active (Can sign in)</option>
                <option value="disabled">Deactivated (Access blocked)</option>
              </select>
              {isSelf && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.3rem' }}>
                  You cannot deactivate your own administrative account.
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm spinner-gold"></span> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminUsers = () => {
  const { user: me } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const list = await adminService.getUsers();
      setUsers(list);
    } catch (err) {
      showToast(err?.message || 'Failed to fetch users.', 'warn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) fetchUsers();
  }, [me, fetchUsers]);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.is_active !== false).length;
  const deactivatedUsersCount = users.filter(u => u.is_active === false).length;

  const filtered = useMemo(() => {
    let list = users.filter(u => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${u.username} ${u.email} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)) return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && u.is_active === false) return false;
      if (statusFilter === 'disabled' && u.is_active !== false) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let av = a[sort.field], bv = b[sort.field];
      if (sort.field === 'created_at' || sort.field === 'last_login') {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [users, search, roleFilter, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (f) => setSort(s => ({ field: f, dir: s.field === f ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }));
  const SortArrow = ({ f }) => sort.field !== f ? null : <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>;

  const handleAdd = async (form) => {
    try {
      const newUser = await adminService.createUser(form);
      setUsers(prev => [newUser, ...prev]);
      showToast(`User ${form.username} created successfully.`);
      setAddOpen(false);
    } catch (e) {
      showToast(e.message || 'Failed to create user.', 'warn');
      throw e;
    }
  };

  const handleEdit = async (form) => {
    try {
      const updated = await adminService.updateUser(form.id, {
        username: form.username,
        email: form.email,
        role: form.role,
        first_name: form.first_name,
        last_name: form.last_name,
        is_active: form.is_active,
      });
      setUsers(u => u.map(x => x.id === form.id ? updated : x));
      showToast(`User ${form.username} updated.`);
      setEditing(null);
    } catch (e) {
      showToast(e.message || 'Update failed.', 'warn');
    }
  };

  const handleToggleActiveClick = (u) => {
    const isSelf = u.id === me?.id || (me?.email && u.email?.toLowerCase() === me.email.toLowerCase());
    if (isSelf && u.is_active !== false) {
      showToast('You cannot deactivate your own account.', 'warn');
      return;
    }

    if (u.is_active !== false) {
      setConfirmDeactivate(u);
    } else {
      executeActivate(u);
    }
  };

  const executeActivate = async (u) => {
    setActionLoading(u.id);
    try {
      const updated = await adminService.activateUser(u.id);
      setUsers(list => list.map(x => x.id === u.id ? { ...x, ...updated, is_active: true, status: 'active' } : x));
      showToast(`User account ${u.username} activated successfully.`, 'success');
    } catch (e) {
      showToast(e.message || 'Activation failed.', 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  const executeDeactivate = async () => {
    if (!confirmDeactivate) return;
    const u = confirmDeactivate;
    setActionLoading(u.id);
    setConfirmDeactivate(null);
    try {
      const updated = await adminService.deactivateUser(u.id);
      setUsers(list => list.map(x => x.id === u.id ? { ...x, ...updated, is_active: false, status: 'disabled' } : x));
      showToast(`User account ${u.username} has been deactivated.`, 'info');
    } catch (e) {
      showToast(e.message || 'Deactivation failed.', 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const u = confirmDel;
    setActionLoading(u.id);
    setConfirmDel(null);
    try {
      await adminService.deleteUser(u.id);
      setUsers(list => list.filter(x => x.id !== u.id));
      showToast(`User ${u.username} deleted permanently.`, 'info');
    } catch (e) {
      showToast(e.message || 'Deletion failed.', 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      user={me}
      title="User Management"
      subtitle={`${totalUsersCount} registered users (${activeUsersCount} active, ${deactivatedUsersCount} deactivated)`}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          <FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} />Add User
        </button>
      }
    >
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--primary-mid)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Total Users</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: 4 }}>{totalUsersCount}</div>
        </div>
        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Active Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>{activeUsersCount}</div>
        </div>
        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Deactivated Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{deactivatedUsersCount}</div>
        </div>
      </div>

      <div className="filter-bar mb-4">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 6 }} />Search</div>
            <input type="search" placeholder="Username, email, name…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem', fontSize: '0.88rem' }} />
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="users" style={{ marginRight: 6 }} />Role</div>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }}>
              <option value="all">All Roles</option>
              <option value="recruiter">Recruiter</option>
              <option value="company">Company Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} />Account Status</div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="disabled">Deactivated Accounts</option>
            </select>
          </div>
          <div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setPage(1); }}>
              <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />Reset
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('username')}>User <SortArrow f="username" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>Email <SortArrow f="email" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('role')}>Role <SortArrow f="role" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('is_active')}>Status <SortArrow f="is_active" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('last_login')}>Last Login <SortArrow f="last_login" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>Created <SortArrow f="created_at" /></th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {current.map(u => {
              const isSelf = u.id === me?.id || (me?.email && u.email?.toLowerCase() === me.email.toLowerCase());
              const isActive = u.is_active !== false;

              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="avatar avatar-sm" style={{
                        background: u.role === 'admin' ? 'linear-gradient(135deg, var(--error), #b71c1c)' :
                                    u.role === 'company' ? 'linear-gradient(135deg, var(--gold-dark), #9b7a2e)' :
                                    'linear-gradient(135deg, var(--primary-mid), var(--primary-light))',
                        color: '#fff', fontSize: '0.78rem', fontWeight: 800,
                      }}>
                        {(u.first_name?.[0] || u.username[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.86rem' }}>
                          {u.username}
                          {isSelf && (
                            <span className="badge badge-secondary" style={{ marginLeft: 6, fontSize: '0.68rem', padding: '2px 6px' }}>
                              You
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{u.first_name || ''} {u.last_name || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.84rem', color: 'var(--text-gray)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-error' : u.role === 'company' ? 'badge-gold' : 'badge-primary'}`}>
                      {u.role === 'company' ? 'Company' : u.role ? (u.role[0].toUpperCase() + u.role.slice(1)) : 'Recruiter'}
                    </span>
                  </td>
                  <td>
                    {isActive ? (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <FontAwesomeIcon icon="circle-check" /> Active
                      </span>
                    ) : (
                      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }}>
                        <FontAwesomeIcon icon="circle-xmark" /> Deactivated
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginRight: 6 }}
                      onClick={() => setEditing(u)}
                    >
                      <FontAwesomeIcon icon="pen" style={{ marginRight: 4 }} />Edit
                    </button>

                    <button
                      className={`btn btn-sm ${isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginRight: 6, minWidth: 95 }}
                      onClick={() => handleToggleActiveClick(u)}
                      disabled={isSelf || actionLoading === u.id}
                      title={isSelf ? 'You cannot deactivate your own account' : (isActive ? 'Deactivate this account' : 'Activate this account')}
                    >
                      {actionLoading === u.id ? (
                        '...'
                      ) : isActive ? (
                        <><FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 4 }} />Deactivate</>
                      ) : (
                        <><FontAwesomeIcon icon="circle-check" style={{ marginRight: 4 }} />Activate</>
                      )}
                    </button>

                    <button
                      className="btn btn-sm btn-danger-outline"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => setConfirmDel(u)}
                      disabled={isSelf || actionLoading === u.id}
                      title={isSelf ? 'Cannot delete self' : 'Delete user permanently'}
                    >
                      <FontAwesomeIcon icon="trash-can" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {current.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>No users match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {filtered.length} total
          </div>
          <div className="pagination">
            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹ Prev</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
            })}
            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next ›</button>
          </div>
        </div>
      )}

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditUserModal
        open={!!editing}
        user={editing}
        isSelf={editing && (editing.id === me?.id || editing.email?.toLowerCase() === me?.email?.toLowerCase())}
        onClose={() => setEditing(null)}
        onSave={handleEdit}
      />

      {/* Confirmation Modal for Deactivation */}
      {confirmDeactivate && (
        <div className="modal-overlay" onClick={() => setConfirmDeactivate(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: '#dc2626' }}>
                <FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />Deactivate Account?
              </h3>
              <button className="modal-close" onClick={() => setConfirmDeactivate(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '0.75rem' }}>
                Are you sure you want to deactivate the user account <strong>{confirmDeactivate.username}</strong> ({confirmDeactivate.email})?
              </p>
              <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '0.85rem' }}>
                This user will immediately be blocked from logging in or accessing the application. You can reactivate this account at any time.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setConfirmDeactivate(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={executeDeactivate}>
                <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 6 }} />Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletion */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />Delete user?</h3>
              <button className="modal-close" onClick={() => setConfirmDel(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '0.5rem' }}>Permanently delete the user account <strong>{confirmDel.username}</strong>?</p>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-light)', marginBottom: 0 }}>
                This action cannot be undone and will permanently remove this user record.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><FontAwesomeIcon icon="trash-can" style={{ marginRight: 6 }} />Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`alert alert-${toast.kind}`} style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
