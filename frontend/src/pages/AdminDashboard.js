import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminLayout from '../components/AdminLayout';
import { adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const AdminDashboard = () => {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [userStats, l] = await Promise.all([
          adminService.getUserStats(),
          adminService.getAuditLogs(),
        ]);
        setStats({ users: userStats, infraComingSoon: true });
        const recent = l.slice(0, 8);
        setLogs(recent);
      } finally { setLoading(false); }
    };
    if (user) load();
  }, [user]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner spinner-lg"></div></div>;
  const s = stats || {};
  const users = s.users || { total: 0, recruiters: 0, company: 0, admins: 0, active: 0, last_7_days: 0 };
  const infraComingSoon = s.infraComingSoon !== false;
  const system = { cpu_pct: null, ram_pct: null, storage_pct: null, uptime_hours: null, active_sessions: null, processing_queue: null, api_p95_ms: null };
  const ai = { model: '—', embeddings: '—', ocr: '—', processed_today: '—', accuracy: null };

  return (
    <AdminLayout user={user} title="Admin Dashboard" subtitle="System overview, monitoring and quick actions">
      {/* Health stats — infrastructure monitoring coming soon */}
      {infraComingSoon && (
        <div className="alert alert-info mb-4" style={{ fontSize: '0.88rem' }}>
          <FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />CPU, RAM, storage, and API latency monitoring requires an external infra provider — coming soon. User and audit data below are live from Supabase.
        </div>
      )}
      <div className="grid-4 mb-5" style={{ gap: '1rem', opacity: infraComingSoon ? 0.55 : 1 }}>
        {[
          { title: 'CPU Usage', value: infraComingSoon ? '—' : `${system.cpu_pct}%`, icon: 'desktop', delta: 'Coming soon', pct: 0, level: 'good' },
          { title: 'RAM Usage', value: infraComingSoon ? '—' : `${system.ram_pct}%`, icon: 'brain', delta: 'Coming soon', pct: 0, level: 'good' },
          { title: 'Storage', value: infraComingSoon ? '—' : `${system.storage_pct}%`, icon: 'floppy-disk', delta: 'Coming soon', pct: 0, level: 'good' },
          { title: 'Uptime', value: infraComingSoon ? '—' : `${system.uptime_hours}h`, icon: null, delta: 'Coming soon', pct: 0, level: 'good' },
        ].map(x => (
          <div key={x.title} className="stats-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stats-label">{x.title.toUpperCase()}</div>
                <div className="stats-value">{x.value}</div>
              </div>
              <div className="stats-icon" style={{ fontSize: '1.6rem' }}>{x.icon ? <FontAwesomeIcon icon={x.icon} /> : <span style={{ color: 'var(--success)' }}>●</span>}</div>
            </div>
            <div className="progress mt-2">
              <div
                className="progress-bar"
                style={{
                  width: `${x.pct}%`,
                  background: x.level === 'danger' ? 'var(--error)' : x.level === 'warn' ? 'var(--warning)' : 'linear-gradient(90deg, var(--success), var(--primary-light))',
                }}
              ></div>
            </div>
            <div className="stats-footer">{x.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid-4 mb-5" style={{ gap: '1rem', gridTemplateColumns: 'repeat(4, 1fr)', opacity: infraComingSoon ? 0.55 : 1 }}>
        {[
          { label: 'Total Users', v: users.total, sub: `${users.recruiters} recruiters · ${users.company} company · ${users.admins} admins`, icon: 'users', tint: 'primary' },
          { label: 'Active Sessions', v: infraComingSoon ? '—' : system.active_sessions, sub: infraComingSoon ? 'Coming soon' : 'Right now', icon: 'lock', tint: 'success' },
          { label: 'Processing Queue', v: infraComingSoon ? '—' : system.processing_queue, sub: infraComingSoon ? 'Coming soon' : 'Pending OCR + NLP', icon: 'inbox', tint: 'warn' },
          { label: 'API p95 Latency', v: infraComingSoon ? '—' : `${system.api_p95_ms} ms`, sub: infraComingSoon ? 'Coming soon' : '< 200ms SLA', icon: 'bolt', tint: 'success' },
        ].map(x => (
          <div key={x.label} className="card" style={{
            padding: '1.15rem 1.25rem',
            borderTop: `3px solid ${x.tint === 'primary' ? 'var(--primary-mid)' : x.tint === 'success' ? 'var(--success)' : x.tint === 'danger' ? 'var(--error)' : 'var(--warning)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', letterSpacing: '0.05em', fontWeight: 700, textTransform: 'uppercase' }}>{x.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '0.1rem' }}>{x.v}</div>
              </div>
              <div style={{ fontSize: '1.8rem' }}><FontAwesomeIcon icon={x.icon} /></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.35rem' }}>{x.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid-4 mb-5" style={{ gap: '1rem' }}>
        {[
          { icon: 'plus', title: 'Add New User', desc: 'Create recruiter or admin account', to: '/admin/users', color: 'primary' },
          { icon: 'brain', title: 'Update AI Models', desc: 'Redeploy embeddings + ranking pipeline', to: '/admin/models', color: 'gold' },
          { icon: 'file-lines', title: 'View Audit Log', desc: 'Full system activity trail', to: '/admin/audit', color: 'secondary' },
          { icon: 'floppy-disk', title: 'Backup Database', desc: 'Create point-in-time snapshot', to: '/admin/database', color: 'outline-primary' },
        ].map(a => (
          <a key={a.title} href={a.to} onClick={e => e.preventDefault()} className="quick-action-card">
            <div style={{
              width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem',
              background: a.color === 'gold' ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(201,168,76,0.15))' :
                          a.color === 'secondary' ? 'var(--bg-light)' :
                          'linear-gradient(135deg, rgba(40,53,147,0.1), rgba(92,107,192,0.15))',
              border: a.color === 'gold' ? '1px solid rgba(201,168,76,0.35)' : '1px solid var(--border-color)',
            }}><FontAwesomeIcon icon={a.icon} /></div>
            <div className="quick-action-title">{a.title}</div>
            <div className="quick-action-desc">{a.desc}</div>
            <div className="quick-action-chevron">Go →</div>
          </a>
        ))}
      </div>

      <div className="grid-2-1">
        {/* Activity log */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><FontAwesomeIcon icon="clipboard-list" style={{ marginRight: 6 }} />Recent System Activity</span>
            <a href="/admin/audit" onClick={e => e.preventDefault()} style={{ fontSize: '0.78rem', color: 'var(--primary-mid)', fontWeight: 700 }}>View all →</a>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0.25rem 0.25rem' }}>
            <div className="timeline">
              {logs.map(l => {
                const d = new Date(l.timestamp);
                const kind = {
                  Login: 'success', Rank: 'primary', Upload: 'processing',
                  Delete: 'danger', Update: 'gold', Create: 'gold', Generate: 'primary',
                }[l.action] || 'processing';
                return (
                  <div key={l.id} className={`timeline-item ${kind}`}>
                    <div className="timeline-title">
                      <strong>{l.user}</strong> · {l.action.toLowerCase()} {l.details?.target?.toString().toLowerCase() || ''}
                    </div>
                    <div className="timeline-desc">{l.details?.summary || Object.keys(l.details).filter(k => k !== 'target' && k !== 'summary').map(k => `${k}: ${l.details[k]}`).join(' · ')}</div>
                    <div className="timeline-time">{d.toLocaleString()} · {l.ip}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI + User quick stats */}
        <div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="robot" style={{ marginRight: 6 }} />AI Model Status {infraComingSoon && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Coming soon</span>}</div>
            <div className="card-body" style={{ padding: '1rem 1.25rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-light)' }}>Ranking Model</span><strong>{ai.model}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-light)' }}>Embeddings</span><strong>{ai.embeddings}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-light)' }}>OCR Engine</span><strong>{ai.ocr}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-light)' }}>Processed Today</span><strong>{ai.processed_today}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                <span style={{ color: 'var(--text-light)' }}>Benchmark Accuracy</span>
                {ai.accuracy != null ? <span className="badge badge-success">{Math.round(ai.accuracy * 100)}%</span> : <span className="badge badge-secondary">—</span>}
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="users" style={{ marginRight: 6 }} />User Snapshot</div>
            <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
              <div className="mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Recruiters</span><strong>{users.recruiters}</strong>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${users.total ? (users.recruiters / users.total * 100) : 0}%`, background: 'var(--primary-mid)' }}></div></div>
              </div>
              <div className="mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Company Managers</span><strong>{users.company}</strong>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${users.total ? (users.company / users.total * 100) : 0}%`, background: 'var(--gold-dark)' }}></div></div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-light)' }}>Admins</span><strong>{users.admins}</strong>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${users.total ? (users.admins / users.total * 100) : 0}%`, background: 'var(--error)' }}></div></div>
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Active users</span><strong style={{ color: 'var(--success)' }}>{users.active}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span>New (last 7d)</span><strong>{users.last_7_days}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />Alerts {infraComingSoon && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Coming soon</span>}</div>
            <div className="card-body" style={{ padding: '0.8rem 1rem', fontSize: '0.82rem' }}>
              {infraComingSoon ? (
                <div style={{ padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--info-light)', borderLeft: '3px solid var(--info)' }}>
                  <strong>Infrastructure alerts</strong>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Connect a monitoring provider to enable storage, model, and uptime alerts.</div>
                </div>
              ) : (
                <>
              <div style={{ padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--warning-light)', borderLeft: '3px solid var(--warning)', marginBottom: '0.4rem' }}>
                <strong>Low storage warning</strong><div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Storage is at 42%. Consider archiving old CVs.</div>
              </div>
              <div style={{ padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--info-light)', borderLeft: '3px solid var(--info)', marginBottom: '0.4rem' }}>
                <strong>Model update available</strong><div style={{ fontSize: '0.75rem', opacity: 0.8 }}>semantic-v3.3 has been released (+3.2% accuracy).</div>
              </div>
              <div style={{ padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--success-light)', borderLeft: '3px solid var(--success)' }}>
                <strong>All systems operational</strong><div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Last status check 2 minutes ago.</div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
