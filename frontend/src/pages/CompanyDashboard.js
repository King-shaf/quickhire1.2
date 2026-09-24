import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CompanyLayout from '../components/CompanyLayout';
import { useUser } from '../context/UserContext';
import { companyService, ensureCompanyForUser } from '../services/supabaseService';

const CompanyDashboard = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('all');
  const [candidateTab, setCandidateTab] = useState('all'); // 'all' | 'reviewed' | 'backlog' | 'hired'
  const [searchCand, setSearchCand] = useState('');
  const [toast, setToast] = useState(null);

  // Hiring Modal State
  const [hireModalCand, setHireModalCand] = useState(null);
  const [hireSelectedJobId, setHireSelectedJobId] = useState('');
  const [hireNotes, setHireNotes] = useState('');
  const [hireError, setHireError] = useState('');
  const [hiringProcessing, setHiringProcessing] = useState(false);

  // Clear Backlog Modal State
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const [clearingBacklog, setClearingBacklog] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const resolveCompanyId = useCallback(async () => {
    let cid = user?.company_id || user?.companies?.id;
    if (!cid && user) {
      cid = await ensureCompanyForUser(user);
    }
    return cid;
  }, [user]);

  const loadData = useCallback(async () => {
    const cid = await resolveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }
    try {
      const recId = selectedRecruiterId === 'all' ? null : selectedRecruiterId;
      const data = await companyService.getCompanyOverview(cid, recId);
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load company overview:', err);
      showToast(err.message || 'Failed to load company data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [resolveCompanyId, selectedRecruiterId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Recruiter Change
  const handleRecruiterChange = (e) => {
    setSelectedRecruiterId(e.target.value);
  };

  // Quick Monitor Button
  const handleQuickMonitor = (recruiterId) => {
    setSelectedRecruiterId(recruiterId);
    const el = document.getElementById('company-candidate-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Open Hire Modal
  const openHireModal = (candidate) => {
    setHireModalCand(candidate);
    setHireSelectedJobId(candidate.matched_job_id || (overviewData?.jobs?.[0]?.id || ''));
    setHireNotes('');
    setHireError('');
  };

  // Submit Candidate Hire
  const handleConfirmHire = async () => {
    if (!hireModalCand) return;
    const cid = await resolveCompanyId();
    setHiringProcessing(true);
    setHireError('');
    try {
      await companyService.hireCandidate(
        hireModalCand.id,
        hireSelectedJobId || null,
        cid,
        hireNotes.trim()
      );
      showToast(`Congratulations! ${hireModalCand.name} has been officially marked as Hired!`);
      setHireModalCand(null);
      await loadData();
    } catch (err) {
      console.error('Hiring failed:', err);
      setHireError(err.message || 'Failed to hire candidate. Please try again.');
      showToast(err.message || 'Failed to hire candidate.', 'error');
    } finally {
      setHiringProcessing(false);
    }
  };

  // Submit Clear Backlog
  const handleConfirmClearBacklog = async () => {
    const cid = await resolveCompanyId();
    setClearingBacklog(true);
    try {
      const recId = selectedRecruiterId === 'all' ? null : selectedRecruiterId;
      const res = await companyService.clearBacklog(cid, recId);
      showToast(res.message || 'Backlog cleared successfully!');
      setBacklogModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Clear backlog failed:', err);
      showToast(err.message || 'Failed to clear backlog.', 'error');
    } finally {
      setClearingBacklog(false);
    }
  };

  // Filter candidates by tab and search
  const filteredCandidates = useMemo(() => {
    if (!overviewData?.candidates) return [];
    let list = overviewData.candidates;

    if (candidateTab === 'reviewed') {
      list = list.filter(c => c.is_reviewed && !c.is_hired);
    } else if (candidateTab === 'backlog') {
      list = list.filter(c => c.is_backlog);
    } else if (candidateTab === 'hired') {
      list = list.filter(c => c.is_hired);
    }

    if (searchCand.trim()) {
      const q = searchCand.toLowerCase().trim();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.recruiter_name || '').toLowerCase().includes(q) ||
        (c.matched_job_title || '').toLowerCase().includes(q) ||
        (c.batch_name || '').toLowerCase().includes(q) ||
        (c.candidate_code || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [overviewData?.candidates, candidateTab, searchCand]);

  if (loading) {
    return (
      <CompanyLayout user={user} title="Company Overview">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      </CompanyLayout>
    );
  }

  const recruiters = overviewData?.recruiters || [];
  const metrics = overviewData?.metrics || {
    totalCandidates: 0,
    reviewedCount: 0,
    backlogCount: 0,
    hiredCount: 0,
    totalJobs: 0,
    totalBatches: 0,
    activeRecruiters: 0,
  };
  const jobs = overviewData?.jobs || [];

  const selectedRecruiterObj = recruiters.find(r => r.id === selectedRecruiterId);
  const monitorTitle = selectedRecruiterId === 'all'
    ? 'All Company Recruiters'
    : selectedRecruiterObj?.name || 'Selected Recruiter';

  return (
    <CompanyLayout
      user={user}
      title="Company Overview & Recruiter Monitor"
      subtitle="Monitor recruiter performance, CV uploads, job postings, review candidates, and hire top talent."
      actions={
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/company/recruiters" className="btn btn-outline-secondary btn-sm">
            <FontAwesomeIcon icon="users" style={{ marginRight: 6 }} /> Manage Recruiters
          </Link>
          <Link to="/recruiter/candidates" className="btn btn-primary btn-sm">
            <FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> Ranked View
          </Link>
        </div>
      }
    >
      {/* Toast Alert */}
      {toast && (
        <div className={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1.25rem' }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? 'circle-exclamation' : 'circle-check'} style={{ marginRight: 8 }} />
          {toast.message}
        </div>
      )}

      {/* Recruiter Selector Header Bar */}
      <div className="card" style={{
        padding: '1.1rem 1.35rem',
        marginBottom: '1.25rem',
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--primary-dark), #1e40af)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
          }}>
            <FontAwesomeIcon icon="user-gear" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Monitoring Filter
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
              {monitorTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="recruiter-select" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', margin: 0 }}>
            Select Recruiter to Monitor:
          </label>
          <select
            id="recruiter-select"
            value={selectedRecruiterId}
            onChange={handleRecruiterChange}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 8,
              border: '1.5px solid var(--primary-mid)',
              background: '#fff',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--primary-dark)',
              minWidth: 260,
              cursor: 'pointer',
            }}
          >
            <option value="all">🌐 All Recruiters (Company Overview)</option>
            {recruiters.map(r => (
              <option key={r.id} value={r.id}>
                👤 {r.name} ({r.cvsUploaded || 0} CVs · {r.batchesCreated || 0} Batches · {r.backlogCount || 0} Backlog)
              </option>
            ))}
          </select>

          {selectedRecruiterId !== 'all' && (
            <button
              onClick={() => setSelectedRecruiterId('all')}
              className="btn btn-sm btn-outline-secondary"
              title="Reset to all recruiters"
            >
              <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Backlog Alert & Clearance Action Banner */}
      {metrics.backlogCount > 0 && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08))',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#f59e0b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
            }}>
              <FontAwesomeIcon icon="clock-rotate-left" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>
                {metrics.backlogCount} Unreviewed CV{metrics.backlogCount !== 1 ? 's' : ''} in Backlog
              </div>
              <div style={{ fontSize: '0.82rem', color: '#b45309', marginTop: 2 }}>
                These candidate resumes have been uploaded by {monitorTitle} but not yet evaluated or assigned.
              </div>
            </div>
          </div>
          <button
            onClick={() => setBacklogModalOpen(true)}
            className="btn btn-warning btn-sm"
            style={{ fontWeight: 700, padding: '0.55rem 1.1rem' }}
          >
            <FontAwesomeIcon icon="broom" style={{ marginRight: 6 }} />
            Clear Backlog ({metrics.backlogCount})
          </button>
        </div>
      )}

      {/* Primary KPI Statistics Row */}
      <div className="grid-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {/* Total Candidates */}
        <div className="stats-card gold" style={{ borderLeft: '4px solid var(--gold-mid)' }}>
          <div className="stats-icon gold"><FontAwesomeIcon icon="file-lines" /></div>
          <div className="stats-value">{metrics.totalCandidates}</div>
          <div className="stats-label">Total Candidates</div>
          <div className="stats-trend up" style={{ fontWeight: 600 }}>
            {selectedRecruiterId === 'all' ? 'All company CVs' : `By ${monitorTitle}`}
          </div>
        </div>

        {/* Reviewed Candidates */}
        <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="stats-icon primary"><FontAwesomeIcon icon="check-double" /></div>
          <div className="stats-value" style={{ color: '#2563eb' }}>{metrics.reviewedCount}</div>
          <div className="stats-label">Reviewed Candidates</div>
          <div className="stats-trend up">
            {metrics.totalCandidates > 0 ? `${Math.round((metrics.reviewedCount / metrics.totalCandidates) * 100)}% evaluated` : '0%'}
          </div>
        </div>

        {/* Unreviewed Backlog */}
        <div className="stats-card warning" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stats-icon warning"><FontAwesomeIcon icon="hourglass-half" /></div>
          <div className="stats-value" style={{ color: '#d97706' }}>{metrics.backlogCount}</div>
          <div className="stats-label">Pending Backlog</div>
          <div className="stats-trend up" style={{ color: metrics.backlogCount > 0 ? '#b45309' : 'var(--text-light)' }}>
            {metrics.backlogCount > 0 ? 'Awaiting review' : 'Zero backlog'}
          </div>
        </div>

        {/* Hired Candidates */}
        <div className="stats-card success" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stats-icon success"><FontAwesomeIcon icon="handshake" /></div>
          <div className="stats-value" style={{ color: '#10b981' }}>{metrics.hiredCount}</div>
          <div className="stats-label">Hired by Company</div>
          <div className="stats-trend up" style={{ color: '#059669' }}>
            Top candidates hired
          </div>
        </div>

        {/* Total Jobs */}
        <div className="stats-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stats-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
            <FontAwesomeIcon icon="briefcase" />
          </div>
          <div className="stats-value" style={{ color: '#8b5cf6' }}>{metrics.totalJobs}</div>
          <div className="stats-label">Jobs Posted</div>
          <div className="stats-trend up">{metrics.totalBatches} upload batches</div>
        </div>
      </div>

      {/* Recruiter Monitoring Performance Table / Cards */}
      <div className="card mb-4">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <FontAwesomeIcon icon="users" style={{ marginRight: 8, color: 'var(--primary-mid)' }} />
              Recruiter Monitoring & Upload Tracking ({recruiters.length})
            </span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: 2 }}>
              Track how many CVs were uploaded, batches created, and backlogs by each recruiter under your company.
            </div>
          </div>
          <Link to="/company/recruiters" className="btn btn-sm btn-outline-secondary">
            View All Recruiters →
          </Link>
        </div>

        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th>Recruiter</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>CVs Uploaded</th>
                <th style={{ textAlign: 'center' }}>Batches Created</th>
                <th style={{ textAlign: 'center' }}>Jobs Posted</th>
                <th>Reviewed vs Backlog</th>
                <th style={{ textAlign: 'center' }}>Hired</th>
                <th style={{ textAlign: 'right' }}>Monitor Action</th>
              </tr>
            </thead>
            <tbody>
              {recruiters.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                    No recruiters invited yet. Invite recruiters to begin tracking their CV uploads and batches.
                  </td>
                </tr>
              ) : (
                recruiters.map(r => {
                  const isSelected = selectedRecruiterId === r.id;
                  const total = r.cvsUploaded || 0;
                  const rev = r.candidatesReviewed || 0;
                  const back = r.backlogCount || 0;
                  const pct = total > 0 ? Math.round((rev / total) * 100) : 0;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div className="avatar avatar-sm avatar-gold" style={{ width: 34, height: 34, fontSize: '0.82rem' }}>
                            {(r.name || 'R').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                              {r.name}
                              {isSelected && (
                                <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: '0.68rem' }}>
                                  Active Monitor
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{r.email}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                          {r.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.25rem 0.6rem' }}>
                          {r.cvsUploaded || 0}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.25rem 0.6rem' }}>
                          {r.batchesCreated || 0}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.25rem 0.6rem' }}>
                          {r.jobsCreated || 0}
                        </span>
                      </td>

                      <td>
                        <div style={{ width: 140 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>{rev} Rev.</span>
                            <span style={{ color: back > 0 ? '#d97706' : 'var(--text-light)', fontWeight: 700 }}>{back} Backlog</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${pct}%`, background: '#2563eb', height: '100%' }} />
                            <div style={{ width: `${100 - pct}%`, background: back > 0 ? '#f59e0b' : 'transparent', height: '100%' }} />
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                          {r.hiredCount || 0}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleQuickMonitor(r.id)}
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'}`}
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        >
                          <FontAwesomeIcon icon="crosshairs" style={{ marginRight: 5 }} />
                          {isSelected ? 'Monitoring' : 'Monitor'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jobs Created by Recruiters Section */}
      <div className="card mb-4">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <FontAwesomeIcon icon="briefcase" style={{ marginRight: 8, color: '#8b5cf6' }} />
              Jobs Posted by {monitorTitle} ({jobs.length})
            </span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: 2 }}>
              Active and queued job requisitions created under your company workspace.
            </div>
          </div>
          <Link to="/recruiter/upload-job" className="btn btn-sm btn-outline-secondary">
            <FontAwesomeIcon icon="plus" style={{ marginRight: 4 }} /> New Job
          </Link>
        </div>

        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th>Job Title</th>
                <th>Department</th>
                <th>Posted By Recruiter</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Candidates Ranked</th>
                <th style={{ textAlign: 'right' }}>View</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                    No jobs posted yet by {monitorTitle}.
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>
                        {j.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        Created {new Date(j.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '0.78rem' }}>
                        {j.department || 'General'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{j.creator_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{j.creator_email}</div>
                    </td>
                    <td>
                      <span className={`badge ${j.status === 'active' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                        {j.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-primary" style={{ fontWeight: 800 }}>
                        {j.rankings?.[0]?.count ?? j.candidates?.length ?? 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/recruiter/candidates?jobId=${j.id}`} className="btn btn-sm btn-outline-secondary" style={{ fontSize: '0.78rem' }}>
                        Rankings →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidates & Hiring Section */}
      <div id="company-candidate-section" className="card mb-5">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary-dark)' }}>
              <FontAwesomeIcon icon="user-tie" style={{ marginRight: 8, color: 'var(--primary-dark)' }} />
              Candidate Pool & Company Hiring ({overviewData?.candidates?.length || 0})
            </span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: 2 }}>
              Inspect reviewed candidates vs. unreviewed backlog, and make executive hiring decisions.
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setCandidateTab('all')}
              className={`btn btn-sm ${candidateTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.78rem', fontWeight: 700 }}
            >
              All ({overviewData?.candidates?.length || 0})
            </button>
            <button
              onClick={() => setCandidateTab('reviewed')}
              className={`btn btn-sm ${candidateTab === 'reviewed' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.78rem', fontWeight: 700 }}
            >
              <FontAwesomeIcon icon="check-double" style={{ marginRight: 4 }} />
              Reviewed ({metrics.reviewedCount - metrics.hiredCount})
            </button>
            <button
              onClick={() => setCandidateTab('backlog')}
              className={`btn btn-sm ${candidateTab === 'backlog' ? 'btn-warning' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.78rem', fontWeight: 700 }}
            >
              <FontAwesomeIcon icon="clock-rotate-left" style={{ marginRight: 4 }} />
              Backlog ({metrics.backlogCount})
            </button>
            <button
              onClick={() => setCandidateTab('hired')}
              className={`btn btn-sm ${candidateTab === 'hired' ? 'btn-success' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.78rem', fontWeight: 700 }}
            >
              <FontAwesomeIcon icon="handshake" style={{ marginRight: 4 }} />
              Hired ({metrics.hiredCount})
            </button>
          </div>
        </div>

        {/* Search Bar inside Candidate Card */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: '#fafbfc' }}>
          <div style={{ position: 'relative', maxWidth: 450 }}>
            <input
              type="search"
              placeholder="Search candidate name, skills, recruiter, or job title…"
              value={searchCand}
              onChange={(e) => setSearchCand(e.target.value)}
              style={{ paddingLeft: '2.3rem', width: '100%', fontSize: '0.85rem' }}
            />
            <FontAwesomeIcon
              icon="search"
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th>Candidate</th>
                <th>Uploaded By / Batch</th>
                <th>Matched Job</th>
                <th>Match Score</th>
                <th>Review Status</th>
                <th style={{ textAlign: 'right' }}>Company Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-light)' }}>
                    <FontAwesomeIcon icon="inbox" style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                    <div>No candidates found matching the selected filter.</div>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map(c => {
                  const scorePct = Math.round((c.relevance_score || 0) * 100);

                  return (
                    <tr key={c.id}>
                      {/* Candidate Column */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div className="avatar avatar-sm avatar-gold" style={{ width: 36, height: 36, fontSize: '0.85rem' }}>
                            {(c.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.9rem' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                              {c.email} · {c.phone}
                            </div>
                            {c.all_skills && c.all_skills.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.25rem', marginTop: 3, flexWrap: 'wrap' }}>
                                {c.all_skills.slice(0, 3).map((sk, idx) => (
                                  <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                                    {sk}
                                  </span>
                                ))}
                                {c.all_skills.length > 3 && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>
                                    +{c.all_skills.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Recruiter & Batch */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                          <FontAwesomeIcon icon="user" style={{ marginRight: 5, color: 'var(--primary-mid)', fontSize: '0.75rem' }} />
                          {c.recruiter_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 2 }}>
                          <FontAwesomeIcon icon="folder" style={{ marginRight: 5, fontSize: '0.72rem' }} />
                          {c.batch_name}
                        </div>
                      </td>

                      {/* Matched Job */}
                      <td>
                        {c.matched_job_title && c.matched_job_title !== 'No matching job' ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', fontSize: '0.78rem' }} />
                              {c.matched_job_title}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 2 }}>
                              {c.matched_job_department || 'General'}
                              {c.matched_job_created_at ? ` · ${new Date(c.matched_job_created_at).toLocaleDateString()}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', fontStyle: 'italic' }}>
                            <FontAwesomeIcon icon="briefcase" style={{ marginRight: 4, opacity: 0.5 }} />
                            General Pool (Unassigned)
                          </div>
                        )}
                      </td>

                      {/* Score */}
                      <td>
                        {scorePct > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              className="badge"
                              style={{
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                padding: '0.22rem 0.55rem',
                                borderRadius: 12,
                                background: scorePct >= 80 ? 'rgba(16, 185, 129, 0.14)' : (scorePct >= 60 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.14)'),
                                color: scorePct >= 80 ? '#059669' : (scorePct >= 60 ? '#d97706' : '#dc2626'),
                                border: `1px solid ${scorePct >= 80 ? 'rgba(16, 185, 129, 0.3)' : (scorePct >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <FontAwesomeIcon icon={scorePct >= 60 ? "circle-check" : "circle-xmark"} style={{ fontSize: '0.72rem' }} />
                              {scorePct}% match
                            </span>
                          </div>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            Evaluating...
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {c.is_hired ? (
                          <span className="badge badge-success" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                            <FontAwesomeIcon icon="handshake" style={{ marginRight: 4 }} /> Hired
                          </span>
                        ) : c.is_reviewed ? (
                          <span className="badge badge-primary" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                            <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> Reviewed
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                            <FontAwesomeIcon icon="clock" style={{ marginRight: 4 }} /> Backlog
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'right' }}>
                        {c.is_hired ? (
                          <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>
                            <FontAwesomeIcon icon="circle-check" style={{ marginRight: 4 }} /> Hired
                          </span>
                        ) : (
                          <button
                            onClick={() => openHireModal(c)}
                            className="btn btn-sm btn-gold"
                            style={{ fontWeight: 700, fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                          >
                            <FontAwesomeIcon icon="handshake" style={{ marginRight: 5 }} />
                            Hire Candidate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hire Candidate Modal */}
      {hireModalCand && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: 520, width: '100%', padding: '1.75rem', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem'
                }}>
                  <FontAwesomeIcon icon="handshake" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary-dark)', fontWeight: 800 }}>
                    Hire Candidate
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    Executive hiring decision for your company
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHireModalCand(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-light)', cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon="xmark" />
              </button>
            </div>

            {hireError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="circle-exclamation" style={{ marginRight: 6 }} />
                {hireError}
              </div>
            )}

            <div style={{ padding: '0.9rem', background: '#f8fafc', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary-dark)' }}>
                {hireModalCand.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>
                {hireModalCand.email} · Uploaded by: {hireModalCand.recruiter_name}
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-dark)' }}>
                Assign to Job Position (Optional):
              </label>
              <select
                value={hireSelectedJobId}
                onChange={(e) => setHireSelectedJobId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.88rem' }}
              >
                <option value="">-- General Company Hire (No specific job) --</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-dark)' }}>
                Offer / Hiring Notes (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="Add hiring notes, starting department, or salary package details…"
                value={hireNotes}
                onChange={(e) => setHireNotes(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setHireModalCand(null)}
                disabled={hiringProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleConfirmHire}
                disabled={hiringProcessing}
                style={{ fontWeight: 800, padding: '0.55rem 1.25rem' }}
              >
                {hiringProcessing ? (
                  <div className="spinner spinner-sm" style={{ marginRight: 6 }} />
                ) : (
                  <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />
                )}
                Confirm Hire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Backlog Confirmation Modal */}
      {backlogModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: '1.75rem', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', marginBottom: '0.75rem'
              }}>
                <FontAwesomeIcon icon="broom" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-dark)', fontWeight: 800 }}>
                Clear Candidate CV Backlog?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                You are about to clear the pending backlog of <strong>{metrics.backlogCount} unreviewed CVs</strong> for <strong>{monitorTitle}</strong>.
                All pending candidate CVs will be marked as reviewed and cleared from the backlog queue.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setBacklogModalOpen(false)}
                disabled={clearingBacklog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleConfirmClearBacklog}
                disabled={clearingBacklog}
                style={{ fontWeight: 800, padding: '0.55rem 1.25rem' }}
              >
                {clearingBacklog ? (
                  <div className="spinner spinner-sm" style={{ marginRight: 6 }} />
                ) : (
                  <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />
                )}
                Yes, Clear Backlog
              </button>
            </div>
          </div>
        </div>
      )}
    </CompanyLayout>
  );
};

export default CompanyDashboard;
