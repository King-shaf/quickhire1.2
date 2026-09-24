import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { assignmentService, jobService, candidateService, rankingService, ensureCompanyForUser } from '../services/supabaseService';
import { useUser } from '../context/UserContext';
import { useSearchParams } from 'react-router-dom';

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses', color: 'primary' },
  { id: 'hired', label: '🎉 Hired by Manager', color: 'success', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  { id: 'assigned', label: 'Assigned', color: 'primary', bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
  { id: 'under_review', label: 'Under Review', color: 'info', bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  { id: 'shortlisted', label: 'Shortlisted', color: 'gold', bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  { id: 'interview', label: 'Interview Scheduled', color: 'warning', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  { id: 'rejected', label: 'Rejected', color: 'error', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
];

const getStatusBadge = (status) => {
  const norm = (status === 'interview_scheduled' ? 'interview' : status) || 'assigned';
  const item = STATUS_OPTIONS.find(s => s.id === norm) || STATUS_OPTIONS[1];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        borderRadius: 20,
        fontSize: '0.75rem',
        fontWeight: 700,
        background: item.bg || '#eef2ff',
        color: item.text || '#3730a3',
        border: `1px solid ${item.border || '#c7d2fe'}`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.text || '#3730a3' }}></span>
      {item.label}
    </span>
  );
};

const RecruiterAssignedCandidates = () => {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get('jobId') || 'all';

  const [assignments, setAssignments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [toast, setToast] = useState(null);

  // Status edit state
  const [updatingId, setUpdatingId] = useState(null);

  // Profile modal
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // Notes modal
  const [editingNotesItem, setEditingNotesItem] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // New assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModalJobId, setAssignModalJobId] = useState('');
  const [assignModalSelectedCandIds, setAssignModalSelectedCandIds] = useState(new Set());
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Remove confirmation modal
  const [removingItem, setRemovingItem] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const companyId = user?.company_id || (await ensureCompanyForUser(user)) || user.id;
      const userId = user.id;

      // 1. Load jobs
      const jList = await jobService.getJobs(companyId, userId).catch(() => []);
      setJobs(jList || []);

      // 2. Load all assignments
      const filterJobId = selectedJobId !== 'all' ? selectedJobId : null;
      const assignList = await assignmentService.getAssignments(filterJobId, companyId, userId).catch(() => []);
      setAssignments(assignList || []);

      // 3. Load all candidates for picker
      const cList = await candidateService.getCandidates(companyId, userId).catch(() => []);
      setAllCandidates(cList || []);
    } catch (err) {
      console.error('Failed to load assigned candidates data:', err);
      showToast(err.message || 'Failed to load assignments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedJobId]);

  const handleJobFilterChange = (newJobId) => {
    setSelectedJobId(newJobId);
    if (newJobId === 'all') {
      searchParams.delete('jobId');
    } else {
      searchParams.set('jobId', newJobId);
    }
    setSearchParams(searchParams);
  };

  const handleStatusChange = async (item, newStatus) => {
    const assignmentId = item.id;
    setUpdatingId(assignmentId);
    try {
      await assignmentService.updateStatus(assignmentId, newStatus, null, user?.id, item.job_id, item.candidate_id);
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: newStatus } : a));
      showToast(`Updated candidate status to "${STATUS_OPTIONS.find(s => s.id === newStatus)?.label || newStatus}".`);
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast(err.message || 'Failed to update candidate status.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openNotesModal = (item) => {
    setEditingNotesItem(item);
    setNotesText(item.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!editingNotesItem) return;
    setSavingNotes(true);
    try {
      await assignmentService.updateStatus(
        editingNotesItem.id,
        editingNotesItem.status || 'assigned',
        notesText,
        user?.id,
        editingNotesItem.job_id,
        editingNotesItem.candidate_id
      );
      setAssignments(prev => prev.map(a => a.id === editingNotesItem.id ? { ...a, notes: notesText } : a));
      showToast('Assignment notes saved successfully!');
      setEditingNotesItem(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
      showToast(err.message || 'Failed to save notes.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!removingItem) return;
    setIsRemoving(true);
    try {
      await assignmentService.removeAssignment(removingItem.job_id, removingItem.candidate_id, user?.id);
      setAssignments(prev => prev.filter(a => a.id !== removingItem.id));
      showToast(`Removed candidate from "${removingItem.job?.title || 'Job Description'}".`);
      setRemovingItem(null);
    } catch (err) {
      console.error('Failed to remove assignment:', err);
      showToast(err.message || 'Failed to remove assignment.', 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const openNewAssignModal = () => {
    const defaultJobId = selectedJobId !== 'all' ? selectedJobId : jobs[0]?.id || '';
    setAssignModalJobId(defaultJobId);
    setAssignModalSearch('');
    // Pre-populate with already assigned candidates for this job
    const alreadyAssigned = new Set(
      assignments.filter(a => !defaultJobId || a.job_id === defaultJobId).map(a => a.candidate_id)
    );
    setAssignModalSelectedCandIds(alreadyAssigned);
    setShowAssignModal(true);
  };

  const handleAssignModalJobChange = (jobId) => {
    setAssignModalJobId(jobId);
    const alreadyAssigned = new Set(
      assignments.filter(a => a.job_id === jobId).map(a => a.candidate_id)
    );
    setAssignModalSelectedCandIds(alreadyAssigned);
  };

  const toggleAssignModalCand = (candId) => {
    setAssignModalSelectedCandIds(prev => {
      const next = new Set(prev);
      if (next.has(candId)) next.delete(candId);
      else next.add(candId);
      return next;
    });
  };

  const handleSaveBulkAssignments = async () => {
    if (!assignModalJobId) {
      showToast('Please select a target job.', 'warn');
      return;
    }
    setSubmittingAssign(true);
    try {
      const companyId = user?.company_id || (await ensureCompanyForUser(user)) || user.id;
      const selectedIds = Array.from(assignModalSelectedCandIds);
      await rankingService.manuallyAssignCandidates(assignModalJobId, selectedIds, companyId, user.id);
      const targetJob = jobs.find(j => j.id === assignModalJobId);
      showToast(`Assigned and ranked ${selectedIds.length} candidate(s) for "${targetJob?.title || 'Selected Job'}"!`);
      setShowAssignModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save assignments:', err);
      showToast(err.message || 'Failed to save assignments.', 'error');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      // 1. Job filter
      if (selectedJobId !== 'all' && item.job_id !== selectedJobId) return false;

      // 2. Status filter
      if (statusFilter !== 'all' && (item.status || 'assigned') !== statusFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const candName = String(item.candidate?.name || '').toLowerCase();
        const candEmail = String(item.candidate?.email || '').toLowerCase();
        const candCode = String(item.candidate?.candidate_code || '').toLowerCase();
        const jobTitle = String(item.job?.title || item.job_title || '').toLowerCase();
        const candSkills = (item.candidate?.all_skills || []).map(s => String(s).toLowerCase()).join(' ');
        const notes = String(item.notes || '').toLowerCase();
        const match = candName.includes(q) || candEmail.includes(q) || candCode.includes(q) || jobTitle.includes(q) || candSkills.includes(q) || notes.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [assignments, selectedJobId, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = assignments.length;
    const shortlisted = assignments.filter(a => a.status === 'shortlisted').length;
    const inReview = assignments.filter(a => a.status === 'under_review' || a.status === 'assigned').length;
    const interviews = assignments.filter(a => a.status === 'interview_scheduled' || a.status === 'offer_extended' || a.status === 'hired').length;
    return { total, shortlisted, inReview, interviews };
  }, [assignments]);

  // Modal filtered candidates
  const assignModalFilteredCandidates = useMemo(() => {
    if (!assignModalSearch.trim()) return allCandidates;
    const q = assignModalSearch.toLowerCase();
    return allCandidates.filter(c => {
      const name = String(c.name || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      const skills = (c.all_skills || []).map(s => String(s).toLowerCase()).join(' ');
      const code = String(c.candidate_code || '').toLowerCase();
      return name.includes(q) || email.includes(q) || skills.includes(q) || code.includes(q);
    });
  }, [allCandidates, assignModalSearch]);

  const activeJob = jobs.find(j => j.id === selectedJobId);

  return (
    <RecruiterLayout>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 11000,
          background: toast.kind === 'error' ? 'var(--error)' : toast.kind === 'warn' ? 'var(--warning)' : 'var(--success)',
          color: '#fff', padding: '0.85rem 1.4rem', borderRadius: 12, fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem'
        }}>
          <FontAwesomeIcon icon={toast.kind === 'error' ? 'circle-xmark' : toast.kind === 'warn' ? 'triangle-exclamation' : 'circle-check'} />
          {toast.msg}
        </div>
      )}

      {/* Header Banner */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-gold" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 800 }}>
                Candidate Pipeline
              </span>
              {activeJob && (
                <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                  <FontAwesomeIcon icon="briefcase" style={{ marginRight: 4 }} /> {activeJob.title}
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.85rem', color: 'var(--primary-dark)', margin: 0 }}>
              Assigned Candidates to Jobs
            </h1>
            <p style={{ color: 'var(--text-gray)', fontSize: '0.92rem', margin: '0.35rem 0 0' }}>
              Manage candidate selections, review AI semantic matching scores, track pipeline statuses, and assign candidates to created jobs.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh Assignments"
            >
              <FontAwesomeIcon icon="rotate" spin={loading} style={{ marginRight: 6 }} /> Refresh
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={openNewAssignModal}
              style={{ fontWeight: 800 }}
            >
              <FontAwesomeIcon icon="user-plus" style={{ marginRight: 6 }} /> Assign Candidates to Job
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid-4 mb-4" style={{ gap: '1rem' }}>
        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--primary-mid)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Total Assigned</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '0.2rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>Across created job profiles</div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--primary-light)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>In Pipeline / Review</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '0.2rem' }}>
            {stats.inReview}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>Assigned & Under Review</div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--gold-mid)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-mid)', textTransform: 'uppercase' }}>Shortlisted</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold-dark)', marginTop: '0.2rem' }}>
            {stats.shortlisted}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>Ready for next steps</div>
        </div>

        <div className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Interviews & Offers</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>
            {stats.interviews}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>Interview, offer & hired</div>
        </div>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="card mb-4" style={{ padding: '1.1rem 1.3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top Row: Job Dropdown + Search + View Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            {/* Job Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 300px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-dark)', whiteSpace: 'nowrap' }}>
                <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', marginRight: 5 }} /> Filter by Job:
              </label>
              <select
                value={selectedJobId}
                onChange={e => handleJobFilterChange(e.target.value)}
                style={{ flex: 1, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <option value="all">All Jobs ({jobs.length} created)</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <FontAwesomeIcon icon="magnifying-glass" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-light)', fontSize: '0.85rem' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search candidate, skill, job, or notes..."
                style={{ paddingLeft: '2.2rem', paddingRight: '1rem', width: '100%', fontSize: '0.86rem' }}
              />
            </div>

            {/* View Switcher */}
            <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-light'}`}
                onClick={() => setViewMode('table')}
                style={{ borderRadius: 0, padding: '0.45rem 0.85rem' }}
                title="Table View"
              >
                <FontAwesomeIcon icon="list" style={{ marginRight: 4 }} /> Table
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-light'}`}
                onClick={() => setViewMode('grid')}
                style={{ borderRadius: 0, padding: '0.45rem 0.85rem' }}
                title="Grid Cards View"
              >
                <FontAwesomeIcon icon="table-cells-large" style={{ marginRight: 4 }} /> Grid
              </button>
            </div>
          </div>

          {/* Bottom Row: Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid #eef2f6', paddingTop: '0.8rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-light)', alignSelf: 'center', marginRight: '0.3rem' }}>
              STATUS:
            </span>
            {STATUS_OPTIONS.map(opt => {
              const count = opt.id === 'all'
                ? assignments.length
                : assignments.filter(a => (a.status || 'assigned') === opt.id).length;
              const isActive = statusFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setStatusFilter(opt.id)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 20,
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isActive ? `1.5px solid var(--primary-mid)` : '1px solid var(--border-color)',
                    background: isActive ? 'var(--primary-dark)' : '#f8fafc',
                    color: isActive ? '#fff' : 'var(--text-dark)',
                  }}
                >
                  {opt.label} <span style={{ opacity: 0.75, marginLeft: 3 }}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area: Table / Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div className="spinner spinner-lg"></div>
          <div style={{ marginTop: '1rem', color: 'var(--text-gray)', fontWeight: 600 }}>Loading assigned candidates...</div>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 1.5rem', background: '#fafbff' }}>
          <div style={{ fontSize: '3rem', color: 'var(--primary-mid)', opacity: 0.4, marginBottom: '0.8rem' }}>
            <FontAwesomeIcon icon="user-check" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary-dark)', fontWeight: 800, fontSize: '1.3rem' }}>
            No Assigned Candidates Found
          </h3>
          <p style={{ color: 'var(--text-gray)', maxWidth: 460, margin: '0.4rem auto 1.4rem', fontSize: '0.9rem' }}>
            {searchQuery || statusFilter !== 'all' || selectedJobId !== 'all'
              ? 'No candidate assignments match your current search or filter criteria. Try adjusting your filters.'
              : 'Candidates assigned manually or through job creation will appear here.'}
          </p>
          <div>
            <button className="btn btn-gold" onClick={openNewAssignModal} style={{ fontWeight: 800 }}>
              <FontAwesomeIcon icon="user-plus" style={{ marginRight: 6 }} /> Assign Candidates to a Job
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th>Candidate</th>
                <th>Assigned Job</th>
                <th>Match Score</th>
                <th>Pipeline Status</th>
                <th>Notes</th>
                <th>Assigned Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(item => {
                const cand = item.candidate || {};
                const jobObj = item.job || {};
                const scoreVal = item.score !== null && item.score !== undefined ? item.score : (item.ranking ? Math.round(item.ranking.overall_score * 100) : null);
                const candCode = cand.candidate_code || ('CAND-' + String(cand.id || '').slice(0, 4).toUpperCase());
                const candBatchName = cand.batch_name || cand.structured_data?.batch_name || null;

                return (
                  <tr key={item.id} style={{ transition: 'background 0.15s ease' }}>
                    {/* Candidate Info */}
                    <td style={{ minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar avatar-sm avatar-gold">
                          {(cand.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.92rem' }}>
                              {cand.name || 'Candidate'}
                            </span>
                            <span className="badge badge-gold" style={{ fontSize: '0.68rem', fontFamily: 'monospace', padding: '0.1rem 0.4rem' }}>
                              {candCode}
                            </span>
                            {candBatchName && (
                              <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(92,107,192,0.1)', color: 'var(--primary-dark)', padding: '0.1rem 0.35rem' }}>
                                <FontAwesomeIcon icon="layer-group" style={{ color: 'var(--gold-mid)', marginRight: 3 }} />
                                {candBatchName}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                            {cand.email || 'N/A'} · {cand.years_experience || 0} yrs exp
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Assigned Job */}
                    <td style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                        <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', marginRight: 5 }} />
                        {jobObj.title || item.job_title || 'Assigned Job'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)' }}>
                        {jobObj.department || item.job_department || 'General'}
                      </div>
                    </td>

                    {/* Score */}
                    <td>
                      {scoreVal !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            className={`badge ${scoreVal >= 80 ? 'badge-success' : scoreVal >= 65 ? 'badge-gold' : 'badge-warning'}`}
                            style={{ fontWeight: 800, fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                          >
                            {scoreVal}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>

                    {/* Status Dropdown */}
                    <td style={{ minWidth: 170 }}>
                      <select
                        value={item.status || 'assigned'}
                        onChange={e => handleStatusChange(item, e.target.value)}
                        disabled={updatingId === item.id}
                        style={{
                          padding: '0.3rem 0.6rem',
                          borderRadius: 20,
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          border: '1.5px solid var(--border-color)',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {STATUS_OPTIONS.filter(s => s.id !== 'all').map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Notes */}
                    <td style={{ maxWidth: 200 }}>
                      <div
                        onClick={() => openNotesModal(item)}
                        style={{
                          fontSize: '0.78rem',
                          color: item.notes ? 'var(--text-dark)' : 'var(--text-light)',
                          cursor: 'pointer',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          borderBottom: '1px dashed var(--border-color)',
                        }}
                        title="Click to edit notes"
                      >
                        {item.notes || '+ Add note...'}
                      </div>
                    </td>

                    {/* Assigned Date */}
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-gray)', whiteSpace: 'nowrap' }}>
                      {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setSelectedCandidate(cand)}
                        style={{ marginRight: 4 }}
                        title="View Full Candidate Profile"
                      >
                        <FontAwesomeIcon icon="eye" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openNotesModal(item)}
                        style={{ marginRight: 4 }}
                        title="Edit Notes"
                      >
                        <FontAwesomeIcon icon="pen-to-square" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-error"
                        onClick={() => setRemovingItem(item)}
                        title="Unassign Candidate from Job"
                      >
                        <FontAwesomeIcon icon="trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid-3" style={{ gap: '1rem' }}>
          {filteredAssignments.map(item => {
            const cand = item.candidate || {};
            const jobObj = item.job || {};
            const scoreVal = item.score !== null && item.score !== undefined ? item.score : (item.ranking ? Math.round(item.ranking.overall_score * 100) : null);
            const candCode = cand.candidate_code || ('CAND-' + String(cand.id || '').slice(0, 4).toUpperCase());
            const candBatchName = cand.batch_name || cand.structured_data?.batch_name || null;

            return (
              <div key={item.id} className="candidate-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div className="avatar avatar-md avatar-gold">
                        {(cand.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.98rem' }}>
                          {cand.name || 'Candidate'}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginLeft: 6, fontWeight: 500 }}>
                            ({candCode})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                          {cand.email || 'N/A'}
                        </div>
                        {candBatchName && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--primary-mid)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <FontAwesomeIcon icon="layer-group" style={{ color: 'var(--gold-mid)', fontSize: '0.66rem' }} />
                            {candBatchName}
                          </div>
                        )}
                      </div>
                    </div>
                    {scoreVal !== null && (
                      <span className={`badge ${scoreVal >= 80 ? 'badge-success' : scoreVal >= 65 ? 'badge-gold' : 'badge-warning'}`} style={{ fontWeight: 800 }}>
                        {scoreVal}%
                      </span>
                    )}
                  </div>

                  {/* Assigned Job Badge */}
                  <div style={{ background: 'rgba(26,35,126,0.04)', borderRadius: 8, padding: '0.55rem 0.75rem', marginBottom: '0.75rem', border: '1px solid rgba(92,107,192,0.15)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Job</div>
                    <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                      <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', marginRight: 5 }} />
                      {jobObj.title || item.job_title || 'Assigned Job'}
                    </div>
                  </div>

                  {/* Status & Notes */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 700 }}>STATUS:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getStatusBadge(item.status)}
                        <select
                          value={item.status || 'assigned'}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          disabled={updatingId === item.id}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: 16,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            border: '1px solid var(--border-color)',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {STATUS_OPTIONS.filter(s => s.id !== 'all').map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-gray)', fontStyle: 'italic', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: 6 }}>
                        "{item.notes}"
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #eef2f6', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="btn btn-sm btn-outline-primary flex-1" onClick={() => setSelectedCandidate(cand)}>
                    <FontAwesomeIcon icon="eye" style={{ marginRight: 4 }} /> View
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => openNotesModal(item)}>
                    <FontAwesomeIcon icon="pen" />
                  </button>
                  <button className="btn btn-sm btn-outline-error" onClick={() => setRemovingItem(item)}>
                    <FontAwesomeIcon icon="trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ASSIGN CANDIDATES TO JOB */}
      {showAssignModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: 0 }}>
            {/* Modal Header */}
            <div style={{ background: 'var(--primary-dark)', color: '#fff', padding: '1.2rem 1.5rem', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gold-mid)', fontWeight: 800 }}>
                  Recruiter Assignment Manager
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: '0.2rem 0 0', color: '#fff' }}>
                  Assign Candidates to Job Profile
                </h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
                disabled={submittingAssign}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.3rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Job Selector */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                  Target Created Job Description <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  value={assignModalJobId}
                  onChange={e => handleAssignModalJobChange(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontWeight: 600 }}
                >
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Candidate Search and Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <FontAwesomeIcon icon="magnifying-glass" style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-light)', fontSize: '0.82rem' }} />
                  <input
                    type="text"
                    value={assignModalSearch}
                    onChange={e => setAssignModalSearch(e.target.value)}
                    placeholder="Search candidate name or skill..."
                    style={{ paddingLeft: '2rem', paddingRight: '0.75rem', width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.45rem 0.45rem 2rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setAssignModalSelectedCandIds(new Set(allCandidates.map(c => c.id)))}
                    type="button"
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setAssignModalSelectedCandIds(new Set())}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Selected Count Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                  Selected: <strong>{assignModalSelectedCandIds.size}</strong> of {allCandidates.length} Candidates
                </span>
              </div>

              {/* Candidates Checklist */}
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                {assignModalFilteredCandidates.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-gray)' }}>
                    No candidates found matching "{assignModalSearch}".
                  </div>
                ) : (
                  assignModalFilteredCandidates.map(cand => {
                    const isChecked = assignModalSelectedCandIds.has(cand.id);
                    return (
                      <div
                        key={cand.id}
                        onClick={() => toggleAssignModalCand(cand.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.65rem 0.85rem', borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer', background: isChecked ? 'rgba(26,35,126,0.04)' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                            {cand.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                            {cand.email} · {cand.years_experience} yrs · {(cand.all_skills || []).slice(0, 3).join(', ')}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ background: '#f8fafc', borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-outline-secondary" onClick={() => setShowAssignModal(false)} disabled={submittingAssign}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleSaveBulkAssignments}
                disabled={submittingAssign || !assignModalJobId || assignModalSelectedCandIds.size === 0}
                style={{ fontWeight: 800 }}
              >
                {submittingAssign ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Assigning & Ranking...</>
                ) : (
                  <><FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Save & Rank ({assignModalSelectedCandIds.size})</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT NOTES */}
      {editingNotesItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', borderRadius: 16 }}>
            <div className="card-header" style={{ fontWeight: 800, color: 'var(--primary-dark)' }}>
              <FontAwesomeIcon icon="pen-to-square" style={{ color: 'var(--gold-mid)', marginRight: 6 }} />
              Assignment Notes for {editingNotesItem.candidate?.name || 'Candidate'}
            </div>
            <div className="card-body">
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                Recruiter Notes & Screening Comments:
              </label>
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                rows={4}
                placeholder="e.g. Strong Python experience, pending interview with team lead..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: '0.88rem' }}
              />
            </div>
            <div style={{ padding: '0.85rem 1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderRadius: '0 0 16px 16px' }}>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingNotesItem(null)} disabled={savingNotes}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNotes} disabled={savingNotes} style={{ fontWeight: 700 }}>
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REMOVE ASSIGNMENT CONFIRMATION */}
      {removingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 440, width: '100%', borderRadius: 16, textAlign: 'center', padding: '1.8rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--error)', marginBottom: '0.6rem' }}>
              <FontAwesomeIcon icon="triangle-exclamation" />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
              Remove Assignment?
            </h3>
            <p style={{ color: 'var(--text-gray)', fontSize: '0.88rem', margin: '0 0 1.4rem' }}>
              Are you sure you want to remove <strong>{removingItem.candidate?.name || 'this candidate'}</strong> from the assigned pool for <strong>{removingItem.job?.title || 'this job'}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
              <button className="btn btn-outline-secondary" onClick={() => setRemovingItem(null)} disabled={isRemoving}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={handleRemoveAssignment} disabled={isRemoving} style={{ fontWeight: 700 }}>
                {isRemoving ? 'Removing...' : 'Yes, Remove Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE FULL PROFILE MODAL */}
      {selectedCandidate && (
        <div className="modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
            <div className="modal-header" style={{ background: 'var(--primary-dark)', color: '#fff', padding: '1.2rem 1.5rem' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="avatar avatar-lg avatar-gold">
                  {selectedCandidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h3 className="modal-title" style={{ color: '#fff', fontSize: '1.3rem' }}>{selectedCandidate.name}</h3>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>
                    {selectedCandidate.education?.degree || 'Candidate'} · {selectedCandidate.email}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedCandidate(null)} aria-label="Close" style={{ color: '#fff' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div className="grid-3 mb-3" style={{ gap: '0.8rem' }}>
                <div className="card" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 700 }}>TOTAL EXPERIENCE</div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary-dark)', marginTop: 2 }}>
                    {selectedCandidate.years_experience || 0} yrs
                  </div>
                </div>
                <div className="card" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 700 }}>EMAIL</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-dark)', marginTop: 2, wordBreak: 'break-all' }}>
                    {selectedCandidate.email || 'N/A'}
                  </div>
                </div>
                <div className="card" style={{ padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 700 }}>PHONE</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-dark)', marginTop: 2 }}>
                    {selectedCandidate.phone || '—'}
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="card mb-3" style={{ padding: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Extracted Skills</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {(selectedCandidate.all_skills || []).map((s, idx) => (
                    <span key={idx} className="tag tag-gold" style={{ fontSize: '0.76rem' }}>{s}</span>
                  ))}
                </div>
              </div>

              {/* Work Experience */}
              <div className="card mb-3" style={{ padding: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Work Experience</h4>
                {selectedCandidate.experience && selectedCandidate.experience.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedCandidate.experience.map((exp, idx) => (
                      <div key={idx} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 6 }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.86rem' }}>
                          {exp.role || exp.title} {exp.company ? `· ${exp.company}` : ''}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{exp.duration || (exp.years ? `${exp.years} years` : '')}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>No experience details available.</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setSelectedCandidate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </RecruiterLayout>
  );
};

export default RecruiterAssignedCandidates;
