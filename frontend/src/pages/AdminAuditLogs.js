import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminLayout from '../components/AdminLayout';
import { adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const actionTypes = ['all', 'Login', 'Logout', 'Upload', 'Rank', 'Generate', 'Create', 'Update', 'Delete', 'Export', 'Config'];
const pageSize = 15;

const AdminAuditLogs = () => {
  const { user: me } = useUser();
  const [all, setAll] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logs, ul] = await Promise.all([
        adminService.getAuditLogs().catch(() => []),
        adminService.getUsers().catch(() => []),
      ]);
      setAll(logs);
      setUsers(ul);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) loadLogs();
  }, [me]);

  const filtered = useMemo(() => {
    return all.filter(l => {
      if (userFilter !== 'all' && l.user_id !== userFilter && l.user !== users.find(u => u.id === userFilter)?.username) {
        if (l.user !== userFilter) return false;
      }
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (fromDate) {
        const t = new Date(l.timestamp).getTime();
        if (t < new Date(fromDate + 'T00:00:00').getTime()) return false;
      }
      if (toDate) {
        const t = new Date(l.timestamp).getTime();
        if (t > new Date(toDate + 'T23:59:59').getTime()) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.user} ${l.action} ${l.ip} ${JSON.stringify(l.details || {}).toLowerCase()}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, userFilter, actionFilter, fromDate, toDate, search, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleExpand = (id) => setExpanded(s => {
    const ns = new Set(s);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    return ns;
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminService.exportLogs({ user: userFilter, action: actionFilter, from: fromDate, to: toDate, search }, filtered);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: `Exported ${filtered.length} log entries.` });
      setTimeout(() => setToast(null), 2500);
    } finally { setExporting(false); }
  };

  if (loading && !all.length) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner spinner-lg"></div></div>;

  const actionBadge = (a) => {
    const map = {
      Login: 'success', Logout: 'secondary', Upload: 'primary', Rank: 'primary',
      Generate: 'info', Create: 'gold', Update: 'gold', Delete: 'danger',
      Export: 'info', Config: 'warning',
    };
    const cls = map[a] || 'secondary';
    return <span className={`badge badge-${cls}`}>{a}</span>;
  };

  return (
    <AdminLayout
      user={me}
      title="Audit Logs"
      subtitle={`${all.length} total entries · immutable system audit trail`}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadLogs} disabled={loading}>
            <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} className={loading ? 'fa-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-gold btn-sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <span className="spinner spinner-sm spinner-gold"></span> : <><FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />Export CSV</>}
          </button>
        </div>
      }
    >
      {/* Filters */}
      <div className="filter-bar mb-4">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto', gap: '0.6rem', alignItems: 'end' }}>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 6 }} />Search</div>
            <input type="search" placeholder="User, IP, details…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem', fontSize: '0.88rem' }} />
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="user" style={{ marginRight: 6 }} />User</div>
            <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }}>
              <option value="all">All Users</option>
              {users.map(u => <option key={u.id} value={u.username}>{u.username} ({u.role})</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="bolt" style={{ marginRight: 6 }} />Action</div>
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }}>
              {actionTypes.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : a}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="calendar-days" style={{ marginRight: 6 }} />From</div>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }} />
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="calendar-days" style={{ marginRight: 6 }} />To</div>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} style={{ padding: '0.55rem 0.8rem' }} />
          </div>
          <div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSearch(''); setUserFilter('all'); setActionFilter('all'); setFromDate(''); setToDate(''); setPage(1); }}>
              <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem', fontSize: '0.84rem', color: 'var(--text-light)' }}>
        Showing <strong style={{ color: 'var(--primary-dark)' }}>{current.length}</strong> of{' '}
        <strong style={{ color: 'var(--primary-dark)' }}>{filtered.length}</strong> entries
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Summary</th>
              <th>IP Address</th>
              <th style={{ width: 42 }}></th>
            </tr>
          </thead>
          <tbody>
            {current.map(l => {
              const ex = expanded.has(l.id);
              const d = new Date(l.timestamp);
              const summary = l.details?.summary || [
                l.details?.target,
                l.details?.job_id && `Job: ${l.details.job_id}`,
                l.details?.count && `count: ${l.details.count}`,
                l.details?.format && `fmt: ${l.details.format}`,
              ].filter(Boolean).join(' · ') || '—';
              return (
                <React.Fragment key={l.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(l.id)}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-light)' }}>
                      {ex ? '▼' : '▶'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-gray)', whiteSpace: 'nowrap' }}>
                      {d.toLocaleDateString()} · {d.toLocaleTimeString()}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{l.user}</td>
                    <td>{actionBadge(l.action)}</td>
                    <td style={{ fontSize: '0.84rem', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</td>
                    <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', color: 'var(--text-light)' }}>{l.ip}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-light)', textAlign: 'right' }}>
                      {ex ? 'Less' : 'More'}
                    </td>
                  </tr>
                  {ex && (
                    <tr>
                      <td colSpan={7} style={{ background: 'linear-gradient(180deg, var(--primary-50), #fff)', padding: '1rem 1.25rem 1.25rem 2.4rem' }}>
                        <div style={{
                          padding: '0.8rem 1rem', borderRadius: 10,
                          background: '#0d1442', color: '#e6e9ff',
                          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                        }}>
                          {JSON.stringify({ id: l.id, timestamp: l.timestamp, user_id: l.user_id, user: l.user, action: l.action, ip: l.ip, details: l.details }, null, 2)}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {current.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-light)' }}>
                  No audit entries match the current filters.
                </td>
              </tr>
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

      {toast && (
        <div className="alert alert-success" style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          <FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />{toast.msg}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAuditLogs;
