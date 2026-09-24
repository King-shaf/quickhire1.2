import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CompanyLayout from '../components/CompanyLayout';
import { useUser } from '../context/UserContext';
import { companyService, ensureCompanyForUser } from '../services/supabaseService';

const CompanyActivity = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let cid = user?.company_id || user?.companies?.id;
        if (!cid && user) {
          cid = await ensureCompanyForUser(user);
        }
        if (!cid) {
          setItems([]);
          return;
        }
        const data = await companyService.getActivity(cid);
        setItems(data || []);
      } catch (err) {
        console.error('Failed to load activity:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.recruiter} ${a.action} ${a.target}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, statusFilter, q]);

  if (loading) {
    return (
      <CompanyLayout user={user} title="Recruiter Activity" subtitle="All recruiter actions in your workspace.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      </CompanyLayout>
    );
  }

  const statusBadge = (status) => {
    const map = {
      pending: 'warning',
      approved: 'success',
      auto: 'secondary',
    };
    const cls = map[status] || 'secondary';
    return <span className={`badge badge-${cls}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
  };

  return (
    <CompanyLayout
      user={user}
      title="Recruiter Activity"
      subtitle="All recruiter actions in your workspace."
    >
      <div className="card mb-4" style={{ padding: '1.25rem' }}>
        <div className="grid-2" style={{ gap: '1rem', alignItems: 'end' }}>
          <div>
            <div className="filter-label">
              <FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 6 }} />
              Search
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="search"
                placeholder="Search recruiter, action, target…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ padding: '0.55rem 0.8rem 0.55rem 2.2rem', fontSize: '0.88rem', width: '100%' }}
              />
              <FontAwesomeIcon
                icon="magnifying-glass"
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-light)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
          <div>
            <div className="filter-label">
              <FontAwesomeIcon icon="filter" style={{ marginRight: 6 }} />
              Status
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.55rem 0.8rem', fontSize: '0.88rem', width: '100%' }}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>
                <FontAwesomeIcon icon="user" style={{ marginRight: 6 }} />
                Recruiter
              </th>
              <th>
                <FontAwesomeIcon icon="sort" style={{ marginRight: 6 }} />
                Action
              </th>
              <th>
                <FontAwesomeIcon icon="sliders" style={{ marginRight: 6 }} />
                Target
              </th>
              <th>
                <FontAwesomeIcon icon="filter" style={{ marginRight: 6 }} />
                Status
              </th>
              <th>
                <FontAwesomeIcon icon="clock" style={{ marginRight: 6 }} />
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 700 }}>
                  <FontAwesomeIcon icon="user" style={{ marginRight: 8, color: 'var(--text-light)' }} />
                  {a.recruiter}
                </td>
                <td>{a.action}</td>
                <td style={{ color: 'var(--text-light)' }}>{a.target || '—'}</td>
                <td>{statusBadge(a.status)}</td>
                <td style={{ color: 'var(--text-light)' }}>
                  <FontAwesomeIcon icon="clock" style={{ marginRight: 6, fontSize: '0.8rem' }} />
                  {a.time}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-light)' }}>
                  No activity matches your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CompanyLayout>
  );
};

export default CompanyActivity;
