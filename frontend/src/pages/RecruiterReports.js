import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useSearchParams } from 'react-router-dom';
import RecruiterLayout from '../components/RecruiterLayout';
import {
  reportService,
  jobService,
  assignmentService,
  candidateService,
  calculateCandidateJobScore,
} from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const ranges = [
  { v: 'all', label: 'All Candidates in Scope' },
  { v: 'top-5', label: 'Top 5 Candidates' },
  { v: 'top-10', label: 'Top 10 Candidates' },
  { v: 'top-20', label: 'Top 20 Candidates' },
  { v: 'top-50', label: 'Top 50 Candidates' },
];

const qualificationOptions = [
  { v: 'all', label: 'All Evaluated Candidates' },
  { v: 'qualifying', label: 'Qualifying Only (Score ≥ 60%)' },
  { v: 'non_qualifying', label: 'Non-Qualifying Only (< 60% / Deficit)' },
  { v: 'shortlist', label: 'Shortlisted & In-Pipeline Only' },
];

const RecruiterReports = () => {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial query params from URL
  const initialJobId = searchParams.get('jobId') || searchParams.get('job_id') || '';
  const initialBatchId = searchParams.get('batchId') || searchParams.get('batch_id') || 'all';
  const initialQual = searchParams.get('qualification') || searchParams.get('status') || 'all';
  const initialRange = searchParams.get('range') || 'all';
  const initialMin = searchParams.get('minScore');
  const initialMax = searchParams.get('maxScore');
  const initialSearch = searchParams.get('search') || '';

  const [jobs, setJobs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reports, setReports] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [form, setForm] = useState({
    jobId: initialJobId,
    batchId: initialBatchId,
    qualification: initialQual,
    range: initialRange,
    minScore: initialMin !== null ? Number(initialMin) : 0,
    maxScore: initialMax !== null ? Number(initialMax) : 100,
    search: initialSearch,
    format: 'PDF',
  });

  const [generating, setGenerating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync state if URL query params change
  useEffect(() => {
    const qJob = searchParams.get('jobId') || searchParams.get('job_id');
    const qBatch = searchParams.get('batchId') || searchParams.get('batch_id');
    const qQual = searchParams.get('qualification') || searchParams.get('status');
    const qRange = searchParams.get('range');
    const qMin = searchParams.get('minScore');
    const qMax = searchParams.get('maxScore');
    const qSearch = searchParams.get('search');

    setForm(prev => ({
      ...prev,
      jobId: qJob !== null ? qJob : prev.jobId,
      batchId: qBatch !== null ? qBatch : prev.batchId,
      qualification: qQual !== null ? qQual : prev.qualification,
      range: qRange !== null ? qRange : prev.range,
      minScore: qMin !== null ? Number(qMin) : prev.minScore,
      maxScore: qMax !== null ? Number(qMax) : prev.maxScore,
      search: qSearch !== null ? qSearch : prev.search,
    }));
  }, [searchParams]);

  // Batch lookup map
  const batchMap = useMemo(() => {
    const map = {};
    (batches || []).forEach(b => {
      const bName = b.name || b.batch_name || `Batch ${String(b.id).slice(0, 6)}`;
      if (b.id) map[b.id] = bName;
    });
    return map;
  }, [batches]);

  // Fetch assignments for the selected job
  const fetchJobAssignments = useCallback(async (jobId) => {
    if (!jobId) {
      setAssignments([]);
      return;
    }
    try {
      const companyId = user?.company_id || user?.id;
      const userId = user?.id;
      const aData = await assignmentService.getAssignments(jobId, companyId, userId).catch(() => []);
      setAssignments(aData || []);
    } catch (err) {
      console.warn('Failed to fetch assignments:', err);
      setAssignments([]);
    }
  }, [user]);

  // Initial load of jobs, batches, candidates, and saved reports
  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const companyId = user?.company_id || user?.id;
        const userId = user?.id;

        const [jList, bList, cList, savedReports] = await Promise.all([
          jobService.getJobs(companyId, userId).catch(() => []),
          candidateService.getUploadBatches(companyId, userId).catch(() => []),
          candidateService.getCandidates(companyId, userId).catch(() => []),
          reportService.getReports().catch(() => []),
        ]);

        setJobs(jList || []);
        setBatches(bList || []);
        setAllCandidates(cList || []);
        setReports(savedReports || []);

        // Pick initial job
        let selectedJob = initialJobId;
        if (!selectedJob && jList && jList.length) {
          selectedJob = jList[0].id;
        }
        if (selectedJob) {
          setForm(f => ({ ...f, jobId: selectedJob }));
          await fetchJobAssignments(selectedJob);
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, initialJobId, fetchJobAssignments]);

  // When job selection changes, fetch its pipeline assignments
  useEffect(() => {
    if (!form.jobId || !user) return;
    fetchJobAssignments(form.jobId);
  }, [form.jobId, user, fetchJobAssignments]);

  // Refresh candidate pool and assignments
  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    const companyId = user?.company_id || user?.id;
    const userId = user?.id;
    try {
      const [cList, bList] = await Promise.all([
        candidateService.getCandidates(companyId, userId).catch(() => []),
        candidateService.getUploadBatches(companyId, userId).catch(() => []),
      ]);
      setAllCandidates(cList || []);
      setBatches(bList || []);
      if (form.jobId) {
        await fetchJobAssignments(form.jobId);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Map of candidate assignment statuses
  const assignmentMap = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      if (a.candidate_id) {
        map[a.candidate_id] = a;
      }
    });
    return map;
  }, [assignments]);

  // Selected job entity
  const targetJob = useMemo(() => {
    return jobs.find(j => j.id === form.jobId) || null;
  }, [jobs, form.jobId]);

  const selectedJobTitle = targetJob?.title || 'Untitled Role';

  // Evaluate candidate scores against target job using canonical scoring engine
  // This guarantees 100% parity with candidate card scores on Ranked Candidates!
  const evaluatedCandidatesList = useMemo(() => {
    if (!targetJob) return [];

    return (allCandidates || []).map((cand, i) => {
      const bId = cand.batch_id || cand.structured_data?.batch_id || null;
      const bName = cand.batch_name || (bId && batchMap[bId]) || cand.structured_data?.batch_name || 'General Pool';
      const assign = assignmentMap[cand.id];
      const stage = (assign?.status || 'assigned').replace('_', ' ').toUpperCase();
      const isRejected = assign?.status === 'rejected';

      // REAL SCORE COMPUTATION FROM SCORING ENGINE
      const scoreResult = calculateCandidateJobScore(cand, targetJob);
      const score = Math.round(scoreResult.overall_score * 100);
      const sem = Math.round(scoreResult.similarity_score * 100);
      const sk = Math.round(scoreResult.skill_match_score * 100);
      const isQualifying = scoreResult.isQualifying && !isRejected;

      let reason = isRejected
        ? 'Rejected in recruitment pipeline'
        : (scoreResult.explanation || (isQualifying ? 'Meets role qualification criteria (≥ 60% match)' : `Match score ${score}% is below 60% qualification threshold`));

      return {
        id: cand.id,
        code: cand.candidate_code || cand.simple_id || ('CAND-' + String(cand.id || i + 1001).slice(0, 4).toUpperCase()),
        name: cand.name || 'Candidate Profile',
        email: cand.email || 'N/A',
        batch_id: bId,
        batch_name: bName,
        score,
        sem,
        sk,
        stage,
        experience: cand.years_experience ?? 0,
        education: cand.education?.degree || 'Qualification',
        isQualifying,
        decision: isQualifying ? 'QUALIFIED' : 'FAILED',
        reason,
        matched_reqs: scoreResult.matchedReqs || [],
        missing_reqs: scoreResult.missingReqs || [],
        notes: assign?.notes || '',
      };
    });
  }, [targetJob, allCandidates, batchMap, assignmentMap]);

  // Apply all active filters: Batch, Qualification, Score Range, Search, Scope Limit
  const filteredCandidatesList = useMemo(() => {
    let list = [...evaluatedCandidatesList];

    // 1. Sort by real match score descending
    list.sort((a, b) => b.score - a.score);

    // 2. Filter by Batch
    if (form.batchId && form.batchId !== 'all') {
      const effLower = String(form.batchId).toLowerCase();
      list = list.filter(c => {
        const cBId = String(c.batch_id || '').toLowerCase();
        const cBName = String(c.batch_name || '').toLowerCase();
        return cBId === effLower || cBName === effLower;
      });
    }

    // 3. Filter by Qualification
    if (form.qualification === 'qualifying') {
      list = list.filter(c => c.isQualifying);
    } else if (form.qualification === 'non_qualifying') {
      list = list.filter(c => !c.isQualifying);
    } else if (form.qualification === 'shortlist') {
      list = list.filter(c => ['SHORTLISTED', 'INTERVIEW', 'INTERVIEW SCHEDULED', 'HIRED'].includes(c.stage));
    }

    // 4. Filter by Score Range
    if (form.minScore > 0 || form.maxScore < 100) {
      list = list.filter(c => c.score >= form.minScore && c.score <= form.maxScore);
    }

    // 5. Filter by Search Query
    if (form.search && form.search.trim()) {
      const q = form.search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.batch_name || '').toLowerCase().includes(q) ||
        (c.matched_reqs || []).some(m => m.toLowerCase().includes(q)) ||
        (c.missing_reqs || []).some(m => m.toLowerCase().includes(q))
      );
    }

    // 6. Filter by Range Limit (top-5, top-10, top-20, top-50, all)
    const limitMap = { 'top-5': 5, 'top-10': 10, 'top-20': 20, 'top-50': 50 };
    if (limitMap[form.range]) {
      list = list.slice(0, limitMap[form.range]);
    }

    // 7. Assign ranks based on filtered list
    return list.map((c, idx) => ({ ...c, rank: idx + 1 }));
  }, [evaluatedCandidatesList, form.batchId, form.qualification, form.minScore, form.maxScore, form.search, form.range]);

  const qualifyingCandidates = useMemo(() => {
    return filteredCandidatesList.filter(c => c.isQualifying);
  }, [filteredCandidatesList]);

  const failedCandidates = useMemo(() => {
    return filteredCandidatesList.filter(c => !c.isQualifying);
  }, [filteredCandidatesList]);

  const selectedBatchObj = batches.find(b => b.id === form.batchId);
  const selectedBatchName = form.batchId === 'all'
    ? 'All Batches (Candidate Pool)'
    : (selectedBatchObj?.name || selectedBatchObj?.batch_name || form.batchId);

  // Generate and export report using real filtered candidates
  const generate = async () => {
    if (!form.jobId) {
      alert('Please select a job description first.');
      return;
    }
    if (filteredCandidatesList.length === 0) {
      alert('No candidates match the active filters. Please adjust filters to generate a report.');
      return;
    }
    setGenerating(true);
    setJustCreated(null);
    try {
      const r = await reportService.generateReport({
        jobId: form.jobId,
        batchId: form.batchId,
        batchName: selectedBatchName,
        range: form.range,
        qualification: form.qualification,
        minScore: form.minScore,
        maxScore: form.maxScore,
        search: form.search,
        format: form.format,
        jobTitle: selectedJobTitle,
        candidates: filteredCandidatesList,
        companyId: user?.company_id || user?.id,
        userId: user?.id,
      });

      const scopeLabel = qualificationOptions.find(q => q.v === form.qualification)?.label || 'All';
      const rangeLabel = form.range === 'all' ? 'All in Scope' : form.range.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
      const fileSize = r?.file_size || `${(filteredCandidatesList.length * 1.2).toFixed(1)} KB`;

      const entry = {
        id: r?.id || `r-${Date.now()}`,
        job_title: selectedJobTitle,
        batch_name: selectedBatchName,
        range: `${rangeLabel} · ${scopeLabel}`,
        format: form.format,
        date: new Date().toISOString().slice(0, 10),
        size: fileSize,
        url: r?.url || null,
        count: filteredCandidatesList.length,
      };

      setReports(rs => [entry, ...rs]);
      setJustCreated(entry);
    } catch (err) {
      console.error('Failed to generate report:', err);
      alert('Error generating report: ' + (err.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleClearFilters = () => {
    setForm(prev => ({
      ...prev,
      batchId: 'all',
      qualification: 'all',
      range: 'all',
      minScore: 0,
      maxScore: 100,
      search: '',
    }));
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('batchId');
      next.delete('batch_id');
      next.delete('qualification');
      next.delete('status');
      next.delete('range');
      next.delete('minScore');
      next.delete('maxScore');
      next.delete('search');
      return next;
    });
  };

  const statusBadgeColor = (status) => {
    switch (status) {
      case 'SHORTLISTED': return 'badge-success';
      case 'INTERVIEW SCHEDULED':
      case 'INTERVIEW': return 'badge-primary';
      case 'HIRED': return 'badge-gold';
      case 'IN REVIEW': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  return (
    <RecruiterLayout
      user={user}
      title="Recruitment & Pipeline Reports"
      subtitle="Generate stakeholder-ready candidate ranking reports and pipeline audit summaries matching your active filters"
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      }
    >
      {/* Live Pipeline Statistics Header */}
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, var(--primary-dark), #10163a)', color: '#fff', border: 'none', borderRadius: 14 }}>
        <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>
                Active Report Target · {selectedJobTitle}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem' }}>
                {filteredCandidatesList.length} of {evaluatedCandidatesList.length} Candidates in Scope
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.15rem' }}>
                Batch: <strong>{selectedBatchName}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.6rem 0.9rem', borderRadius: 10, textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{filteredCandidatesList.length}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>In Filter</div>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', padding: '0.6rem 0.9rem', borderRadius: 10, textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
                  <FontAwesomeIcon icon="circle-check" style={{ marginRight: 4, fontSize: '0.9rem' }} />
                  {qualifyingCandidates.length}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 700 }}>Qualifying (≥60%)</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', padding: '0.6rem 0.9rem', borderRadius: 10, textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>
                  <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 4, fontSize: '0.9rem' }} />
                  {failedCandidates.length}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#fecaca', fontWeight: 700 }}>Deficit / Failed</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2-1 mb-5">
        <div>
          {/* Generate / Filter Controls Card */}
          <div className="card mb-4">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><FontAwesomeIcon icon="filter" style={{ marginRight: 6 }} />Report Filter Configuration</span>
              {(form.batchId !== 'all' || form.qualification !== 'all' || form.range !== 'all' || form.minScore > 0 || form.maxScore < 100 || form.search) && (
                <button className="btn btn-xs btn-outline-secondary" onClick={handleClearFilters}>
                  <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} />Reset Filters
                </button>
              )}
            </div>
            <div className="card-body">
              {/* Row 1: Job, Batch, Qualification */}
              <div className="grid-3 mb-3" style={{ gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <label className="form-label"><FontAwesomeIcon icon="briefcase" style={{ marginRight: 5, color: 'var(--gold)' }} />Job Description</label>
                  <select
                    value={form.jobId}
                    onChange={e => setForm({ ...form, jobId: e.target.value })}
                    disabled={loading}
                    style={{ fontWeight: 600, color: 'var(--primary-dark)' }}
                  >
                    <option value="">Select a job…</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({evaluatedCandidatesList.length || j.candidate_count || 0} candidates)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label"><FontAwesomeIcon icon="layer-group" style={{ marginRight: 5, color: 'var(--primary-mid)' }} />Batch Filter</label>
                  <select
                    value={form.batchId}
                    onChange={e => setForm({ ...form, batchId: e.target.value })}
                    style={{ fontWeight: 600 }}
                  >
                    <option value="all">All Batches (Candidate Pool)</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name || `Batch ${String(b.id).slice(0, 8)}`} ({b.file_count || b.count || 0} CVs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label"><FontAwesomeIcon icon="circle-check" style={{ marginRight: 5, color: 'var(--success)' }} />Qualification Status</label>
                  <select
                    value={form.qualification}
                    onChange={e => setForm({ ...form, qualification: e.target.value })}
                    style={{ fontWeight: 600 }}
                  >
                    {qualificationOptions.map(q => (
                      <option key={q.v} value={q.v}>{q.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Range, Score Range, Search */}
              <div className="grid-3 mb-3" style={{ gap: '0.8rem', gridTemplateColumns: '1.2fr 1.2fr 1.6fr' }}>
                <div>
                  <label className="form-label">Candidate Scope Limit</label>
                  <select
                    value={form.range}
                    onChange={e => setForm({ ...form, range: e.target.value })}
                  >
                    {ranges.map(r => (
                      <option key={r.v} value={r.v}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Score Range (%)</label>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Min"
                      value={form.minScore}
                      onChange={e => setForm({ ...form, minScore: Number(e.target.value) })}
                      style={{ width: '50%' }}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Max"
                      value={form.maxScore}
                      onChange={e => setForm({ ...form, maxScore: Number(e.target.value) })}
                      style={{ width: '50%' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label"><FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 5 }} />Search Candidates / Skills</label>
                  <input
                    type="search"
                    placeholder="Candidate name, code, skill..."
                    value={form.search}
                    onChange={e => setForm({ ...form, search: e.target.value })}
                  />
                </div>
              </div>

              {/* Format Radio */}
              <div className="mb-4">
                <label className="form-label">Export Format</label>
                <div className="grid-2" style={{ gap: '0.6rem', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {[
                    { v: 'PDF', icon: <FontAwesomeIcon icon="file-pdf" style={{ color: '#ef4444' }} />, desc: 'Branded printable HTML / PDF with skill badges' },
                    { v: 'Excel', icon: <FontAwesomeIcon icon="chart-bar" style={{ color: '#10b981' }} />, desc: 'Structured Excel .CSV with real scores & matched skills' },
                  ].map(opt => (
                    <label
                      key={opt.v}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.8rem 0.9rem',
                        border: form.format === opt.v ? '2px solid var(--primary-mid)' : '1.5px solid var(--border-color)',
                        background: form.format === opt.v ? 'var(--primary-50)' : '#fff',
                        borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onClick={() => setForm({ ...form, format: opt.v })}
                    >
                      <input
                        type="radio"
                        name="format"
                        checked={form.format === opt.v}
                        onChange={() => setForm({ ...form, format: opt.v })}
                        className="form-check-input"
                      />
                      <div style={{ fontSize: '1.35rem' }}>{opt.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>{opt.v}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-gold btn-lg w-100"
                onClick={generate}
                disabled={generating || !form.jobId || filteredCandidatesList.length === 0}
              >
                {generating ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Building report…</>
                ) : (
                  <><FontAwesomeIcon icon="chart-line" style={{ marginRight: 6 }} />Generate & Export Report ({filteredCandidatesList.length} Candidates)</>
                )}
              </button>

              {!form.jobId && (
                <div className="alert alert-info mt-3" style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                  Please select a job to generate a report.
                </div>
              )}
              {form.jobId && filteredCandidatesList.length === 0 && (
                <div className="alert alert-warning mt-3" style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                  No candidates match the selected filters. Please adjust your batch, qualification, or score range settings.
                </div>
              )}

              {justCreated && (
                <div className="alert alert-success mt-3" style={{ marginBottom: 0, fontSize: '0.85rem' }}>
                  <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />
                  {justCreated.format} report generated successfully ({justCreated.size}) for {justCreated.count} candidates.
                  {justCreated.url ? (
                    <a href={justCreated.url} download target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontWeight: 700, color: 'inherit' }}>
                      Download now →
                    </a>
                  ) : (
                    <span style={{ marginLeft: 8 }}>Download link ready in recent reports.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="card mt-4">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span><FontAwesomeIcon icon="eye" style={{ marginRight: 6 }} />Report Live Preview — {selectedJobTitle}</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span className="badge badge-info">{form.format}</span>
                <span className="badge badge-primary">{selectedBatchName}</span>
                <span className="badge badge-gold">{ranges.find(r => r.v === form.range)?.label || form.range}</span>
              </div>
            </div>
            <div style={{ padding: '1.5rem', background: 'linear-gradient(180deg, #fff 0%, #f8f9ff 100%)' }}>
              <div style={{ textAlign: 'center', borderBottom: '3px double var(--primary-dark)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                  QUICK HIRE · Candidate Evaluation & Pipeline Report
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                  {user?.company?.name || 'QuickHire AI Recruitment Hub'} · Live Filtered Stakeholder Evaluation
                </div>
              </div>

              {/* Active Filter Configuration Banner */}
              <div style={{
                background: '#eef2ff', borderLeft: '4px solid var(--primary-mid)',
                padding: '0.65rem 0.9rem', borderRadius: 8, fontSize: '0.8rem', marginBottom: '1rem',
                color: 'var(--primary-dark)'
              }}>
                <div style={{ fontWeight: 800, marginBottom: '0.2rem' }}>
                  <FontAwesomeIcon icon="filter" style={{ marginRight: 5 }} />
                  Active Filter: Position: "{selectedJobTitle}" | Batch: "{selectedBatchName}" | Scope: "{qualificationOptions.find(q => q.v === form.qualification)?.label}"
                  {form.minScore > 0 || form.maxScore < 100 ? ` | Score: ${form.minScore}% - ${form.maxScore}%` : ''}
                  {form.search ? ` | Search: "${form.search}"` : ''}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)' }}>
                  Showing <strong>{filteredCandidatesList.length}</strong> evaluated candidate{filteredCandidatesList.length === 1 ? '' : 's'} (<strong>{qualifyingCandidates.length}</strong> Qualifying, <strong>{failedCandidates.length}</strong> Deficit / Disqualified)
                </div>
              </div>

              {filteredCandidatesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-gray)' }}>
                  No candidate evaluations match your selected filter criteria.
                </div>
              ) : (
                <>
                  {/* SECTION 1: QUALIFYING CANDIDATES */}
                  {(form.qualification === 'all' || form.qualification === 'qualifying') && (
                    <>
                      <div style={{
                        background: '#ecfdf5', borderLeft: '4px solid #10b981', borderRadius: '8px 8px 0 0',
                        padding: '0.65rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginTop: '1.2rem', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem'
                      }}>
                        <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.88rem' }}>
                          <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6, color: '#10b981' }} />
                          QUALIFYING CANDIDATES ({qualifyingCandidates.length}) — Match Score ≥ 60%
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                          RECOMMENDED FOR SHORTLIST & INTERVIEWS
                        </span>
                      </div>

                      {qualifyingCandidates.length === 0 ? (
                        <div style={{ padding: '0.85rem', background: '#f8fafc', color: 'var(--text-gray)', fontSize: '0.8rem', borderRadius: 8, marginBottom: '1.5rem' }}>
                          No candidates in the active filter met the qualification threshold (≥ 60% match score).
                        </div>
                      ) : (
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', marginBottom: '1.8rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--primary-50)' }}>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Rank</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Candidate</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Batch</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Real Match</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Semantic</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Skills</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Status</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Exp</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid var(--primary-mid)' }}>Decision & Rationale</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qualifyingCandidates.map(c => (
                              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.35rem 0.6rem', color: 'var(--gold-dark)', fontWeight: 800 }}>#{c.rank}</td>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700 }}>
                                  <div>{c.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)' }}>{c.code} · {c.email}</div>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: 700 }}>
                                    {c.batch_name}
                                  </span>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{c.score}%</td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>{c.sem}%</td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>{c.sk}%</td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className={`badge ${statusBadgeColor(c.stage)}`} style={{ fontSize: '0.68rem' }}>{c.stage}</span>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>{c.experience} yrs</td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className="badge badge-success" style={{ fontSize: '0.7rem', fontWeight: 800 }}>QUALIFIED</span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>{c.reason}</div>
                                  {c.matched_reqs && c.matched_reqs.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                                      {c.matched_reqs.slice(0, 3).map(m => (
                                        <span key={m} style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: 4, fontWeight: 700 }}>
                                          ✓ {m}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* SECTION 2: FAILED / DEFICIT CANDIDATES */}
                  {(form.qualification === 'all' || form.qualification === 'non_qualifying') && (
                    <>
                      <div style={{
                        background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '8px 8px 0 0',
                        padding: '0.65rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginTop: '1.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem'
                      }}>
                        <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.88rem' }}>
                          <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 6, color: '#ef4444' }} />
                          FAILED / DEFICIT CANDIDATES ({failedCandidates.length}) — Below 60% Threshold or Rejected
                        </div>
                        <span className="badge badge-error" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                          DOES NOT MEET ROLE REQUIREMENTS
                        </span>
                      </div>

                      {failedCandidates.length === 0 ? (
                        <div style={{ padding: '0.85rem', background: '#f8fafc', color: 'var(--text-gray)', fontSize: '0.8rem', borderRadius: 8, marginBottom: '1.5rem' }}>
                          All evaluated candidates in this filtered scope qualified for this role!
                        </div>
                      ) : (
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#fff5f5' }}>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Candidate</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Batch</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Real Match</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Primary Deficiency / Reason</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Status</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Exp</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1.5px solid #fecaca' }}>Decision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {failedCandidates.map(c => (
                              <tr key={c.id} style={{ borderBottom: '1px solid #fee2e2' }}>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700 }}>
                                  <div>{c.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)' }}>{c.code} · {c.email}</div>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: 700 }}>
                                    {c.batch_name}
                                  </span>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 800, color: 'var(--error)' }}>{c.score}%</td>
                                <td style={{ padding: '0.35rem 0.6rem', fontSize: '0.74rem', color: 'var(--text-gray)' }}>
                                  <div>{c.reason}</div>
                                  {c.missing_reqs && c.missing_reqs.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                                      {c.missing_reqs.slice(0, 3).map(m => (
                                        <span key={m} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: 4, fontWeight: 700 }}>
                                          Missing: {m}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className={`badge ${statusBadgeColor(c.stage)}`} style={{ fontSize: '0.68rem' }}>{c.stage}</span>
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>{c.experience} yrs</td>
                                <td style={{ padding: '0.35rem 0.6rem' }}>
                                  <span className="badge badge-error" style={{ fontSize: '0.7rem', fontWeight: 800 }}>FAILED</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </>
              )}

              <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '1.2rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                <em>CONFIDENTIAL — For internal recruitment use only. Generated by QUICK HIRE AI Semantic Pipeline using canonical evaluation scores.</em>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Recent Generated Reports */}
        <div>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><FontAwesomeIcon icon="book-open" style={{ marginRight: 6 }} />Recent Generated Reports</span>
              <span className="badge badge-primary">{reports.length}</span>
            </div>
            <div className="card-body" style={{ padding: '0.5rem' }}>
              {reports.length === 0 ? (
                <div style={{ padding: '1.25rem 1rem', color: 'var(--text-light)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No reports generated yet. Configure filters above and click "Generate & Export Report".
                </div>
              ) : (
                reports.map(r => (
                  <div
                    key={r.id}
                    style={{
                      padding: '0.75rem 0.85rem', borderRadius: 10,
                      border: '1px solid var(--border-color)', marginBottom: '0.45rem',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.cssText += ';border-color:var(--primary-light);background:var(--primary-50);'}
                    onMouseLeave={e => e.currentTarget.style.cssText += ';border-color:var(--border-color);background:#fff;'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary-dark)', marginBottom: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.job_title}
                        </div>
                        {r.batch_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--gold-dark)', fontWeight: 600 }}>
                            <FontAwesomeIcon icon="layer-group" style={{ marginRight: 4 }} />{r.batch_name}
                          </div>
                        )}
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', marginTop: '0.25rem' }}>
                          <span><FontAwesomeIcon icon="calendar-days" style={{ marginRight: 5 }} />{r.date}</span>
                          <span><FontAwesomeIcon icon="bullseye" style={{ marginRight: 5 }} />{r.range}</span>
                          <span><FontAwesomeIcon icon="box" style={{ marginRight: 5 }} />{r.size}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                        <span className={`badge ${r.format === 'PDF' ? 'badge-error' : 'badge-success'}`}>{r.format}</span>
                        {r.url ? (
                          <a
                            href={r.url}
                            download={`report-${r.job_title?.replace(/[^a-zA-Z0-9]/g, '_') || 'ranking'}.${r.format === 'PDF' ? 'html' : 'csv'}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-primary"
                            style={{ padding: '0.22rem 0.55rem', fontSize: '0.7rem', textDecoration: 'none' }}
                          >
                            <FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />Download
                          </a>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            style={{ padding: '0.22rem 0.55rem', fontSize: '0.7rem' }}
                            disabled
                          >
                            <FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />Download
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
};

export default RecruiterReports;