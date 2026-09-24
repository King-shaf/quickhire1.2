import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { activityService, jobService, candidateService, adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const RecruiterDashboard = () => {
  const { user } = useUser();
  const [feed, setFeed] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingNow, setProcessingNow] = useState(0);
  const [stats, setStats] = useState({ total_candidates: 0, recent_rankings: 0, total_jobs: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const companyId = user?.company_id || user?.id;
        const [f, j, rc, dashStats, procCount] = await Promise.all([
          activityService.getFeed(8, user?.id, user).catch(() => []),
          jobService.getJobs(companyId, user?.id).catch(() => []),
          candidateService.getRankedCandidates(companyId, user?.id).catch(() => []),
          adminService.getDashboardStats(companyId, user?.id).catch(() => ({ total_candidates: 0, recent_rankings: 0, total_jobs: 0 })),
          adminService.getProcessingQueueCount(companyId, user?.id).catch(() => 0),
        ]);
        setFeed(f || []); setJobs(j || []); setRankedCandidates(rc || []); setStats(dashStats); setProcessingNow(procCount || 0);
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
    const t = setInterval(async () => {
      if (!user) return;
      const n = await adminService.getProcessingQueueCount(user?.company_id || user?.id, user?.id).catch(() => 0);
      setProcessingNow(n);
    }, 8000);
    return () => clearInterval(t);
  }, [user]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="spinner spinner-lg"></div></div>;

  const topCandidates = rankedCandidates.slice(0, 5);
  const totalCandidates = Math.max(stats.total_candidates || 0, rankedCandidates.length);
  const hiredCount = rankedCandidates.filter(c => Boolean(c.is_hired || c.hired || c.structured_data?.hired)).length;
  const activeJobs = jobs.length;
  const topScore = rankedCandidates[0] ? (rankedCandidates[0].relevance_score * 100).toFixed(1) : '0';

  const queueTotal = Math.max(processingNow + 3, 3);

  return (
    <RecruiterLayout
      user={user}
      title="Dashboard"
      subtitle={`Welcome back${user?.first_name ? `, ${user.first_name}` : ''}. Here's what's happening today.`}
      actions={
        <>
          <Link to="/recruiter/upload-job" className="btn btn-gold btn-sm"><FontAwesomeIcon icon="pen" style={{ marginRight: 6 }} /> New Job Posting</Link>
          <Link to="/recruiter/upload-cvs" className="btn btn-primary btn-sm"><FontAwesomeIcon icon="file" style={{ marginRight: 6 }} /> Upload CVs</Link>
        </>
      }
    >
      {(user?.employee_id || user?.id_number || user?.company_code) && (
        <div className="card" style={{
          padding: '0.9rem 1.25rem', marginBottom: '1.25rem',
          background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(92,107,192,0.06))',
          border: '1px solid rgba(5,150,105,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#059669',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
            }}>
              <FontAwesomeIcon icon="id-card" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>
                Recruiter Profile Identity
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.15rem' }}>
                {user?.employee_id && (
                  <span style={{ fontWeight: 800, color: '#065f46', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                    EMP: {user.employee_id}
                  </span>
                )}
                {user?.id_number && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                    ID No: {user.id_number}
                  </span>
                )}
              </div>
            </div>
          </div>
          {(user?.company_code || user?.companies?.company_code) && (
            <div style={{ fontSize: '0.82rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
              Linked Company: <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{user?.company_code || user?.companies?.company_code}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stats-card">
          <div className="stats-icon primary"><FontAwesomeIcon icon="users" /></div>
          <div className="stats-value">{totalCandidates}</div>
          <div className="stats-label">Total Candidates Processed</div>
          <div className="stats-trend up">↑ live from Supabase</div>
        </div>
        <Link to="/recruiter/candidates?tab=hired" style={{ textDecoration: 'none' }}>
          <div className="stats-card success" style={{ borderLeft: '4px solid #10b981', cursor: 'pointer' }}>
            <div className="stats-icon success" style={{ background: '#ecfdf5', color: '#059669' }}>
              <FontAwesomeIcon icon="trophy" />
            </div>
            <div className="stats-value" style={{ color: '#059669' }}>{hiredCount}</div>
            <div className="stats-label" style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>Candidates Hired by Manager</div>
            <div className="stats-trend up" style={{ color: '#059669' }}>🎉 Confirmed Placements →</div>
          </div>
        </Link>
        <div className="stats-card gold">
          <div className="stats-icon gold"><FontAwesomeIcon icon="file-lines" /></div>
          <div className="stats-value">{activeJobs}</div>
          <div className="stats-label">Active Job Descriptions</div>
          <div className="stats-trend up">{stats.total_jobs} total jobs</div>
        </div>
        <div className="stats-card success">
          <div className="stats-icon success"><FontAwesomeIcon icon="trophy" /></div>
          <div className="stats-value">{topScore}%</div>
          <div className="stats-label">Top-Ranked Candidate Score</div>
          <div className="stats-trend up">{stats.recent_rankings} rankings done</div>
        </div>
        <div className="stats-card warning">
          <div className="stats-icon warning"><FontAwesomeIcon icon="bolt" /></div>
          <div className="stats-value">{feed.length}</div>
          <div className="stats-label">Your Activity Count</div>
          <div className="stats-trend up">Actions logged by you</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card mb-5" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}><FontAwesomeIcon icon="bolt" style={{ marginRight: 6 }} />Quick Actions</h3>
        <div className="grid-4" style={{ gap: '0.9rem' }}>
          <Link to="/recruiter/upload-cvs" className="card" style={{
            padding: '1.25rem', textDecoration: 'none', cursor: 'pointer', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(92,107,192,0.04), rgba(92,107,192,0.01))',
            border: '1.5px solid rgba(92,107,192,0.18)',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}><FontAwesomeIcon icon="file" /></div>
            <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>Upload CVs</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>Drag & drop batch upload</div>
          </Link>
          <Link to="/recruiter/upload-job" className="card" style={{
            padding: '1.25rem', textDecoration: 'none', cursor: 'pointer', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(201,168,76,0.02))',
            border: '1.5px solid rgba(201,168,76,0.28)',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}><FontAwesomeIcon icon="file-lines" /></div>
            <div style={{ fontWeight: 700, color: 'var(--gold-dark)', fontSize: '0.88rem' }}>Upload Job Description</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>Create a new ranking job</div>
          </Link>
          <Link to="/recruiter/candidates" className="card" style={{
            padding: '1.25rem', textDecoration: 'none', cursor: 'pointer', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(46,125,50,0.04), rgba(46,125,50,0.01))',
            border: '1.5px solid rgba(46,125,50,0.2)',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}><FontAwesomeIcon icon="trophy" /></div>
            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.88rem' }}>View Top Candidates</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>Browse ranked profiles</div>
          </Link>
          <Link to="/recruiter/reports" className="card" style={{
            padding: '1.25rem', textDecoration: 'none', cursor: 'pointer', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(249,168,37,0.04), rgba(249,168,37,0.01))',
            border: '1.5px solid rgba(249,168,37,0.22)',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}><FontAwesomeIcon icon="chart-line" /></div>
            <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: '0.88rem' }}>Generate Report</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>CSV & Excel exports</div>
          </Link>
        </div>
      </div>

      <div className="grid-2-1 mb-5">
        {/* Activity Feed (GitHub-style) */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><FontAwesomeIcon icon="newspaper" style={{ marginRight: 6 }} />Your Recent Activity</span>
            <span className="badge badge-info">{feed.length} items</span>
          </div>
          <div className="card-body">
            <div className="timeline">
              {feed.length === 0 ? (
                <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                  No activity yet. Upload some CVs or create a job to get started.
                </div>
              ) : (
                feed.map((item, i) => (
                  <div key={i} className={`timeline-item ${item.type}`}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="timeline-title">
                          <FontAwesomeIcon icon={item.icon} style={{ marginRight: 6 }} />{item.title}
                        </div>
                        <div className="timeline-desc">{item.desc}</div>
                      </div>
                      <div className="timeline-time">{item.time}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="desktop" style={{ marginRight: 6 }} />System Status</div>
          <div className="card-body">
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-gray)', fontWeight: 600 }}>Processing Queue</span>
                <span className="badge badge-warning">{processingNow} active · {queueTotal} total</span>
              </div>
              <div className="progress" style={{ height: 6 }}>
                <div className="progress-bar progress-bar-gold progress-bar-striped progress-bar-animated" style={{ width: `${queueTotal ? (processingNow / queueTotal) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-gray)', fontWeight: 600 }}>Storage Used</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {stats.total_candidates > 0 ? Math.min(100, Math.round((stats.total_candidates / 5000) * 100)).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="progress" style={{ height: 6 }}>
                <div className="progress-bar" style={{ width: `${Math.min(100, (stats.total_candidates / 5000) * 100)}%` }}></div>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                {stats.total_candidates} candidates stored
              </div>
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-gray)', fontWeight: 600 }}>AI Model</span>
                <span className="badge badge-success"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} />Online</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
                <div><strong style={{ color: 'var(--text-dark)' }}>Ranking:</strong> semantic-v3.2</div>
                <div><strong style={{ color: 'var(--text-dark)' }}>Embedding:</strong> minilm-l12-v2</div>
                <div><strong style={{ color: 'var(--text-dark)' }}>OCR:</strong> paddleocr-v2.7</div>
                <div><strong style={{ color: 'var(--text-dark)' }}>Jobs:</strong> {stats.total_jobs} posted</div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-gray)', fontWeight: 600 }}>Rankings computed</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>{stats.recent_rankings} total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Rankings */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><FontAwesomeIcon icon="clipboard-list" style={{ marginRight: 6 }} /> Recent Ranking Jobs</span>
          <Link to="/recruiter/candidates" style={{ fontSize: '0.82rem', fontWeight: 600 }}>View all →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Department</th>
                <th>Candidates</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                    No jobs yet. <Link to="/recruiter/upload-job">Create your first job posting →</Link>
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{j.title}</div>
                    </td>
                    <td>{j.department || '—'}</td>
                    <td>{j.candidate_count ?? 0}</td>
                    <td>{j.created_at}</td>
                    <td>
                      {j.status === 'complete' && <span className="badge badge-success"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} />Complete</span>}
                      {j.status === 'processing' && <span className="badge badge-warning"><FontAwesomeIcon icon="hourglass" style={{ marginRight: 4 }} />Processing</span>}
                      {j.status === 'queued' && <span className="badge badge-info"><FontAwesomeIcon icon="inbox" style={{ marginRight: 4 }} />Queued</span>}
                      {j.status === 'error' && <span className="badge badge-error"><FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} />Error</span>}
                      {!['complete', 'processing', 'queued', 'error'].includes(j.status) && <span className="badge badge-secondary">{j.status}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to="/recruiter/candidates" className="btn btn-sm btn-outline-primary" style={{ padding: '0.3rem 0.7rem' }}>View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 candidates sidebar info */}
      <div className="card mt-5" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0 }}><FontAwesomeIcon icon="star" style={{ marginRight: 6 }} />Top-Ranked Candidates This Week</h3>
          <Link to="/recruiter/candidates" style={{ fontSize: '0.82rem', fontWeight: 600 }}>See full rankings →</Link>
        </div>
        {topCandidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>
            No ranked candidates yet. Upload CVs and create a job to generate ranking results.
          </div>
        ) : (
          <div className="grid-3" style={{ gap: '0.8rem' }}>
            {topCandidates.map((c, i) => {
              const pct = Math.round(c.relevance_score * 100);
              const scoreClass = pct >= 85 ? 'score-high' : pct >= 70 ? 'score-mid' : 'score-low';
              return (
                <div key={c.id} className="candidate-card" style={{ padding: '1rem' }}>
                  <div className="candidate-header" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div className="avatar avatar-gold">
                        {(c.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="candidate-info">
                        <div className="candidate-name" style={{ fontSize: '0.95rem' }}>{c.name}</div>
                        <div className="candidate-title" style={{ fontSize: '0.75rem' }}>{c.education?.degree || 'Candidate'}</div>
                      </div>
                    </div>
                    {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
                      <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', fontWeight: 800, background: '#059669', color: '#fff' }}>
                        🎉 HIRED
                      </span>
                    )}
                  </div>
                  <div className="candidate-score-section" style={{ padding: '0.5rem 0.6rem', marginBottom: '0.6rem' }}>
                    <div className={`score-ring ${scoreClass}`} style={{ '--score': pct, width: 48, height: 48 }}>
                      <div style={{ width: 38, height: 38, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                      <div style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: '0.7rem', color: pct >= 85 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--error)' }}>
                        {pct}%
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>Relevance</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', marginTop: '0.1rem' }}>{c.years_experience || 0} yrs exp · {c.all_skills?.length || 0} skills</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </RecruiterLayout>
  );
};

export default RecruiterDashboard;
