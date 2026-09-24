import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { jobService, deleteJobDescription, candidateService, rankingService, removeCandidateFromJob } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const RecruiterJobsList = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedJobIdParam = searchParams.get('id');

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [deletingId, setDeletingId] = useState(null);

  // Manual candidate selection modal states
  const [candidateSelectJob, setCandidateSelectJob] = useState(null);
  const [allCandidates, setAllCandidates] = useState([]);
  const [loadingAllCandidates, setLoadingAllCandidates] = useState(false);
  const [candidateSearchInModal, setCandidateSearchInModal] = useState('');
  const [modalSelectedCandidateIds, setModalSelectedCandidateIds] = useState(new Set());
  const [savingCandidateSelection, setSavingCandidateSelection] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const openCandidateSelectionModal = async (job) => {
    setCandidateSelectJob(job);
    setCandidateSearchInModal('');
    setLoadingAllCandidates(true);
    try {
      const companyId = user?.company_id || user?.id;
      const cands = await candidateService.getCandidates(companyId, user?.id);
      setAllCandidates(cands || []);
      // Pre-select candidates currently attached to this job
      const currentIds = new Set((job.candidates || []).map(c => c.candidate_id || c.id));
      setModalSelectedCandidateIds(currentIds);
    } catch (err) {
      console.error('Failed to load candidates for selection modal:', err);
    } finally {
      setLoadingAllCandidates(false);
    }
  };

  const toggleModalCandidate = (id) => {
    setModalSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveCandidateSelection = async () => {
    if (!candidateSelectJob) return;
    setSavingCandidateSelection(true);
    try {
      const companyId = user?.company_id || user?.id;
      const selectedIds = Array.from(modalSelectedCandidateIds);
      await rankingService.manuallyAssignCandidates(candidateSelectJob.id, selectedIds, companyId, user?.id);
      showToast(`Successfully updated candidates for "${candidateSelectJob.title}" (${selectedIds.length} candidate(s) selected and ranked).`);
      setCandidateSelectJob(null);
      await loadJobs();
    } catch (err) {
      console.error('Failed to update candidate selection:', err);
      showToast(err.message || 'Failed to update candidate selection.', 'warn');
    } finally {
      setSavingCandidateSelection(false);
    }
  };

  const handleRemoveSingleCandidate = async (jobId, candidateId, candidateName) => {
    if (!window.confirm(`Remove candidate "${candidateName}" from this job?`)) return;
    try {
      await removeCandidateFromJob(jobId, candidateId, user?.id);
      showToast(`Removed candidate from job.`);
      await loadJobs();
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(prev => prev ? {
          ...prev,
          candidates: (prev.candidates || []).filter(c => (c.candidate_id || c.id) !== candidateId),
          candidate_count: Math.max(0, (prev.candidate_count || 1) - 1),
        } : null);
      }
    } catch (err) {
      console.error('Failed to remove candidate from job:', err);
      showToast(err.message || 'Failed to remove candidate.', 'warn');
    }
  };

  const handleDeleteJob = async (jobId, jobTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${jobTitle}"? This will also remove associated rankings.`)) {
      return;
    }
    setDeletingId(jobId);
    try {
      await deleteJobDescription(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } catch (err) {
      console.error('Failed to delete job:', err);
      alert(err.message || 'Failed to delete job.');
    } finally {
      setDeletingId(null);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await jobService.getJobsWithCreatorDetails(user?.company_id, user?.id);
      setJobs(data || []);
      if (selectedJobIdParam && data) {
        const matched = data.find(j => j.id === selectedJobIdParam);
        if (matched) setSelectedJob(matched);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredJobs = jobs.filter(j => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (j.title || '').toLowerCase();
    const dept = (j.department || '').toLowerCase();
    const creator = (j.created_by_name || '').toLowerCase();
    const email = (j.created_by_email || '').toLowerCase();
    const skills = (j.required_skills || []).join(' ').toLowerCase();
    return title.includes(q) || dept.includes(q) || creator.includes(q) || email.includes(q) || skills.includes(q);
  });

  return (
    <RecruiterLayout
      user={user}
      title="Jobs Created"
      subtitle="View all job descriptions, creation timestamps, who created each job, and candidate match shortlists"
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadJobs}>
            <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} /> Refresh
          </button>
          <button className="btn btn-gold btn-sm" onClick={() => navigate('/recruiter/upload-job')}>
            <FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} /> Create New Job
          </button>
        </div>
      }
    >
      {/* Metrics Summary */}
      <div className="grid-4 mb-4" style={{ gap: '1rem' }}>
        <div className="stats-card">
          <div className="stats-label">TOTAL JOBS CREATED</div>
          <div className="stats-value">{jobs.length}</div>
          <div className="stats-footer">Across company departments</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">ACTIVE RECRUITMENT</div>
          <div className="stats-value">{jobs.filter(j => j.status === 'active' || j.status === 'queued' || !j.status).length}</div>
          <div className="stats-footer">Open candidate matching jobs</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">TOTAL CANDIDATES MATCHED</div>
          <div className="stats-value">{jobs.reduce((acc, j) => acc + (j.candidate_count || 0), 0)}</div>
          <div className="stats-footer">Candidates evaluated</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">RECENT CREATIONS</div>
          <div className="stats-value">{jobs.slice(0, 5).length}</div>
          <div className="stats-footer">Latest recruitment drives</div>
        </div>
      </div>

      {/* Filter and View Control Bar */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '0.85rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <FontAwesomeIcon icon="magnifying-glass" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-light)', fontSize: '0.85rem' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search created jobs by title, department, creator name or skill..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 34, fontSize: '0.88rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>View:</span>
            <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('grid')}>
              <FontAwesomeIcon icon="table-cells-large" /> Cards
            </button>
            <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')}>
              <FontAwesomeIcon icon="list" /> Table
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 1rem' }}>
          <div style={{ fontSize: 54, color: 'var(--text-light)', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon="folder-open" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--primary-dark)' }}>No Jobs Created Found</h3>
          <p style={{ color: 'var(--text-gray)', maxWidth: 460, margin: '0.5rem auto 1.5rem' }}>
            {searchQuery ? `No created jobs matched your query "${searchQuery}".` : 'You have not created any job descriptions yet.'}
          </p>
          <div>
            <button className="btn btn-gold" onClick={() => navigate('/recruiter/upload-job')}>
              <FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} /> Create First Job
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid-2 mb-4" style={{ gap: '1.25rem' }}>
          {filteredJobs.map(job => (
            <div key={job.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1.5px solid var(--border-color)', borderRadius: 14 }}>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div>
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', marginBottom: '0.4rem', display: 'inline-block' }}>
                      {job.department || 'General Department'}
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1.15rem', marginBottom: '0.2rem' }}>
                      {job.title}
                    </h3>
                  </div>
                  <span className={`badge ${job.status === 'closed' ? 'badge-secondary' : 'badge-success'}`}>
                    {job.status || 'Active'}
                  </span>
                </div>

                {/* Creation Metadata & Who Created It */}
                <div style={{ background: 'rgba(26,35,126,0.03)', border: '1px dashed rgba(92,107,192,0.2)', borderRadius: 10, padding: '0.6rem 0.8rem', marginBottom: '0.85rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-dark)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <FontAwesomeIcon icon="user-gear" style={{ color: 'var(--gold-mid)' }} />
                    Created By: {job.created_by_name} <span style={{ opacity: 0.65, fontWeight: 400 }}>({job.created_by_role})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-gray)' }}>
                    <FontAwesomeIcon icon="clock" style={{ color: 'var(--primary-light)' }} />
                    Created On: <strong>{job.created_at_formatted || job.created_at}</strong>
                  </div>
                </div>

                {/* Description Snippet */}
                <p style={{ fontSize: '0.84rem', color: 'var(--text-gray)', lineHeight: 1.5, marginBottom: '0.85rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {job.description_text || job.description || 'No detailed description text provided for this job profile.'}
                </p>

                {/* Required Skills */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Required Skills:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {(job.required_skills && job.required_skills.length > 0 ? job.required_skills : ['General Skills']).slice(0, 6).map((sk, idx) => (
                      <span key={idx} className="tag tag-gold" style={{ fontSize: '0.72rem', padding: '0.12rem 0.5rem' }}>
                        {sk}
                      </span>
                    ))}
                    {(job.required_skills?.length || 0) > 6 && (
                      <span className="tag" style={{ fontSize: '0.72rem', padding: '0.12rem 0.4rem', background: '#e0e0e0' }}>
                        +{(job.required_skills?.length || 0) - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{ background: '#fafbfc', borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', borderRadius: '0 0 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline-primary btn-sm" onClick={() => setSelectedJob(job)}>
                    <FontAwesomeIcon icon="file-lines" style={{ marginRight: 6 }} /> Details
                  </button>
                  <button className="btn btn-outline-gold btn-sm" onClick={() => openCandidateSelectionModal(job)}>
                    <FontAwesomeIcon icon="user-plus" style={{ marginRight: 5 }} /> Select Candidates
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(`/recruiter/assigned-candidates?jobId=${job.id}`)} title="View Pipeline Status for this Job">
                    <FontAwesomeIcon icon="user-check" style={{ marginRight: 5 }} /> Pipeline
                  </button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteJob(job.id, job.title)} disabled={deletingId === job.id} title="Delete Job">
                    <FontAwesomeIcon icon="trash-can" />
                  </button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/recruiter/candidates?jobId=${job.id}${job.batch_id ? `&batchId=${job.batch_id}` : ''}`)}>
                  <FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> View Ranked ({job.candidate_count || job.direct_assigned_count || job.pool_candidate_count || 0})
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Job Title & Dept</th>
                <th>Created Date & Time</th>
                <th>Created By</th>
                <th>Required Skills</th>
                <th>Matched</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{job.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{job.department || 'General'}</div>
                  </td>
                  <td style={{ fontSize: '0.82rem', fontFamily: 'ui-monospace, monospace' }}>
                    {job.created_at_formatted || job.created_at}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{job.created_by_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{job.created_by_email}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: 220 }}>
                      {(job.required_skills || []).slice(0, 3).map((sk, idx) => (
                        <span key={idx} className="tag tag-gold" style={{ fontSize: '0.68rem', padding: '0.05rem 0.35rem' }}>{sk}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gold">{job.candidate_count || job.direct_assigned_count || job.pool_candidate_count || 0}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-outline-primary" style={{ marginRight: 6 }} onClick={() => setSelectedJob(job)}>
                      Details
                    </button>
                    <button className="btn btn-sm btn-outline-gold" style={{ marginRight: 6 }} onClick={() => openCandidateSelectionModal(job)}>
                      <FontAwesomeIcon icon="user-plus" style={{ marginRight: 4 }} /> Select
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" style={{ marginRight: 6 }} onClick={() => navigate(`/recruiter/assigned-candidates?jobId=${job.id}`)}>
                      <FontAwesomeIcon icon="user-check" style={{ marginRight: 4 }} /> Pipeline
                    </button>
                    <button className="btn btn-sm btn-primary" style={{ marginRight: 6 }} onClick={() => navigate(`/recruiter/candidates?jobId=${job.id}${job.batch_id ? `&batchId=${job.batch_id}` : ''}`)}>
                      Candidates
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteJob(job.id, job.title)} disabled={deletingId === job.id} title="Delete Job">
                      <FontAwesomeIcon icon="trash-can" />
                    </button>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        </div>
      )}

      {/* FULL JOB DETAILS VIEW MODAL */}
      {selectedJob && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-dark)', color: '#fff', padding: '1.2rem 1.5rem' }}>
              <div>
                <span className="badge badge-gold" style={{ fontSize: '0.72rem', marginBottom: '0.3rem', display: 'inline-block' }}>
                  {selectedJob.department || 'Department Job Profile'}
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.35rem', margin: 0, color: '#fff' }}>
                  {selectedJob.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="card-body" style={{ padding: '1.5rem' }}>
              {/* Creator & Creation Timestamp Bar */}
              <div className="grid-2 mb-4" style={{ gap: '1rem', background: 'rgba(26,35,126,0.04)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(92,107,192,0.15)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Created By
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem' }}>
                    {selectedJob.created_by_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                    {selectedJob.created_by_email} · {selectedJob.created_by_role}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Creation Date & Time
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem', fontFamily: 'ui-monospace, monospace' }}>
                    {selectedJob.created_at_formatted || selectedJob.created_at}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                    Job ID: <code style={{ fontSize: '0.75rem' }}>{selectedJob.id}</code>
                  </div>
                </div>
              </div>

              {/* Required & Preferred Skills */}
              <div className="mb-4">
                <h4 style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  <FontAwesomeIcon icon="tags" style={{ marginRight: 6, color: 'var(--gold-mid)' }} /> Required Skills & Competencies
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                  {(selectedJob.required_skills || ['None Specified']).map((sk, idx) => (
                    <span key={idx} className="tag tag-gold">{sk}</span>
                  ))}
                </div>

                {selectedJob.preferred_skills && selectedJob.preferred_skills.length > 0 && (
                  <>
                    <h4 style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      <FontAwesomeIcon icon="star" style={{ marginRight: 6, color: 'var(--gold-mid)' }} /> Preferred / Nice-to-have Skills
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {selectedJob.preferred_skills.map((sk, idx) => (
                        <span key={idx} className="tag tag-info">{sk}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Full Description Text */}
              <div className="mb-4">
                <h4 style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  <FontAwesomeIcon icon="file-lines" style={{ marginRight: 6, color: 'var(--primary-light)' }} /> Full Job Description & Requirements
                </h4>
                <div style={{
                  background: '#f8fafc', padding: '1.2rem', borderRadius: 12,
                  border: '1px solid var(--border-color)', fontSize: '0.88rem',
                  lineHeight: 1.6, color: 'var(--text-dark)', whiteSpace: 'pre-wrap'
                }}>
                  {selectedJob.description_text || selectedJob.description || 'No long-form text provided for this job creation.'}
                </div>
              </div>

              {/* Selected Candidate List & CV Documents Section */}
              <div className="mb-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem', margin: 0 }}>
                    <FontAwesomeIcon icon="clipboard-user" style={{ marginRight: 6, color: 'var(--gold-mid)' }} />
                    Candidates Selected For This Job ({selectedJob.candidates?.length || 0})
                  </h4>
                  <button
                    className="btn btn-outline-gold btn-xs"
                    onClick={() => { const j = selectedJob; setSelectedJob(null); openCandidateSelectionModal(j); }}
                    style={{ fontWeight: 700 }}
                  >
                    <FontAwesomeIcon icon="user-gear" style={{ marginRight: 4 }} /> Manage / Select Candidates
                  </button>
                </div>

                {(!selectedJob.candidates || selectedJob.candidates.length === 0) ? (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 10, padding: '1.5rem', textAlign: 'center', color: 'var(--text-gray)', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 0.75rem 0' }}>No candidates selected or ranked for this job yet.</p>
                    <button className="btn btn-gold btn-sm" onClick={() => { const j = selectedJob; setSelectedJob(null); openCandidateSelectionModal(j); }}>
                      <FontAwesomeIcon icon="user-plus" style={{ marginRight: 6 }} /> Select Candidates Now
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                    <table className="table" style={{ marginBottom: 0, fontSize: '0.83rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th>Rank</th>
                          <th>Candidate</th>
                          <th>CV Document</th>
                          <th>Match Score</th>
                          <th>Contact</th>
                          <th style={{ textAlign: 'right' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJob.candidates.map((cand, cIdx) => (
                          <tr key={cIdx}>
                            <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>#{cIdx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{cand.candidate_name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>{cand.experience_years} yrs exp</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-mid)', fontWeight: 600 }}>
                                <FontAwesomeIcon icon="file-pdf" style={{ color: 'var(--gold-mid)' }} />
                                {cand.source_file}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${cand.overall_score >= 0.8 ? 'badge-success' : cand.overall_score >= 0.65 ? 'badge-warning' : 'badge-gold'}`} style={{ fontWeight: 800 }}>
                                {Math.round((cand.overall_score || 0) * 100)}%
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.75rem' }}>{cand.email}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>{cand.phone}</div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-xs btn-outline-danger"
                                onClick={() => handleRemoveSingleCandidate(selectedJob.id, cand.candidate_id || cand.id, cand.candidate_name)}
                                title="Remove candidate from this job"
                              >
                                <FontAwesomeIcon icon="xmark" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#f5f7fa', borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button className="btn btn-outline-secondary" onClick={() => setSelectedJob(null)}>
                Close
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline-gold" onClick={() => { const j = selectedJob; setSelectedJob(null); openCandidateSelectionModal(j); }}>
                  <FontAwesomeIcon icon="user-gear" style={{ marginRight: 6 }} /> Select Candidates
                </button>
                <button className="btn btn-gold" onClick={() => { navigate(`/recruiter/candidates?jobId=${selectedJob.id}&matchedOnly=true${selectedJob.batch_id ? `&batchId=${selectedJob.batch_id}` : ''}`); setSelectedJob(null); }}>
                  <FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> View Ranked Candidate Cards ({selectedJob.candidate_count || selectedJob.candidates?.length || 0})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECT CANDIDATES MANUALLY FOR CREATED JOB */}
      {candidateSelectJob && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 740, width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0d1442 0%, #1a237e 100%)', color: '#fff', padding: '1.2rem 1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gold-mid)', fontWeight: 800 }}>
                  Manual Candidate Selection
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', margin: '0.2rem 0 0', color: '#fff' }}>
                  Select Candidates for "{candidateSelectJob.title}"
                </h3>
              </div>
              <button
                onClick={() => setCandidateSelectJob(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
                disabled={savingCandidateSelection}
              >
                &times;
              </button>
            </div>

            <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  Check candidate CVs to include in this job's evaluation and ranking pool.
                </div>
                <span className="badge badge-gold" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem', fontWeight: 800 }}>
                  {modalSelectedCandidateIds.size} of {allCandidates.length} Selected
                </span>
              </div>

              {/* Search & Quick Select Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search candidates by name, email, skills, degree..."
                  value={candidateSearchInModal}
                  onChange={e => setCandidateSearchInModal(e.target.value)}
                  style={{ flex: 1, minWidth: 220, fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    const filtered = allCandidates.filter(c => {
                      if (!candidateSearchInModal.trim()) return true;
                      const q = candidateSearchInModal.toLowerCase();
                      return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.all_skills || []).join(' ').toLowerCase().includes(q);
                    });
                    setModalSelectedCandidateIds(prev => {
                      const next = new Set(prev);
                      filtered.forEach(c => next.add(c.id));
                      return next;
                    });
                  }}
                >
                  <FontAwesomeIcon icon="check-double" style={{ marginRight: 4 }} /> Select Filtered
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setModalSelectedCandidateIds(new Set())}
                  disabled={modalSelectedCandidateIds.size === 0}
                >
                  <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Clear All
                </button>
              </div>

              {/* Candidate List with Checkboxes */}
              <div style={{
                maxHeight: 320, overflowY: 'auto', border: '1.5px solid var(--border-color)',
                borderRadius: 12, background: '#fff', padding: '0.4rem'
              }}>
                {loadingAllCandidates ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    <div className="spinner spinner-sm"></div> Loading candidate records...
                  </div>
                ) : allCandidates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                    No candidates found in your organization. Please upload CVs first.
                  </div>
                ) : (
                  allCandidates.filter(c => {
                    if (!candidateSearchInModal.trim()) return true;
                    const q = candidateSearchInModal.toLowerCase();
                    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.all_skills || []).join(' ').toLowerCase().includes(q);
                  }).map(cand => {
                    const isSelected = modalSelectedCandidateIds.has(cand.id);
                    const candCode = cand.candidate_code || cand.simple_id || ('CAND-' + String(cand.id).slice(0, 4).toUpperCase());
                    const skills = (cand.all_skills || []).slice(0, 4);
                    return (
                      <div
                        key={cand.id}
                        onClick={() => toggleModalCandidate(cand.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem', borderRadius: 8, cursor: 'pointer',
                          background: isSelected ? 'rgba(26,35,126,0.06)' : 'transparent',
                          borderBottom: '1px solid rgba(0,0,0,0.04)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by container
                            style={{ width: 18, height: 18, accentColor: 'var(--primary-dark)', cursor: 'pointer' }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <strong style={{ color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{cand.name}</strong>
                              <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '0.08rem 0.4rem' }}>{candCode}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.15rem' }}>
                              {cand.email} · {cand.years_experience || cand.structured_data?.total_experience_years || 0} yrs experience · {cand.education?.degree || cand.structured_data?.education?.degree || 'Candidate'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: 220, justifyContent: 'flex-end' }}>
                          {skills.map(s => (
                            <span key={s} className="tag tag-gold" style={{ fontSize: '0.68rem', padding: '0.08rem 0.4rem' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ background: '#f5f7fa', borderTop: '1px solid var(--border-color)', padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px' }}>
              <button className="btn btn-outline-secondary" onClick={() => setCandidateSelectJob(null)} disabled={savingCandidateSelection}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleSaveCandidateSelection}
                disabled={savingCandidateSelection}
                style={{ fontWeight: 800, minWidth: 200 }}
              >
                {savingCandidateSelection ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Saving & Ranking...</>
                ) : (
                  <><FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Save & Rank {modalSelectedCandidateIds.size} Candidates</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`alert alert-${toast.kind || 'success'}`} style={{
          position: 'fixed', top: 80, right: 24, zIndex: 99999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          {toast.msg}
        </div>
      )}
    </RecruiterLayout>
  );
};

export default RecruiterJobsList;
