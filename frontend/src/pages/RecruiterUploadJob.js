import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { jobService, rankingService, candidateService, ensureCompanyForUser } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const industries = ['Engineering', 'Research', 'Data Science', 'Artificial Intelligence', 'Product', 'Design', 'Marketing', 'Human Resources', 'Finance', 'Operations', 'Other'];

const DRAFT_KEY = 'qh_draft_job_description';

const RecruiterUploadJob = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlBatchId = searchParams.get('batchId') || searchParams.get('batch_id');
  const { user, refreshProfile } = useUser();

  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(urlBatchId || null); // start as null, will set after load

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        return {
          title: p.title || '',
          description: p.description || '',
          industry: p.industry || 'Engineering',
          customIndustry: p.customIndustry || '',
          department: p.department || '',
          reqSkillsText: '',
          prefSkillsText: '',
        };
      }
    } catch (_) {}
    return { title: '', description: '', industry: 'Engineering', customIndustry: '', department: '', reqSkillsText: '', prefSkillsText: '' };
  });

  const [reqSkills, setReqSkills] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.reqSkills)) return p.reqSkills;
      }
    } catch (_) {}
    return [];
  });

  const [prefSkills, setPrefSkills] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.prefSkills)) return p.prefSkills;
      }
    } catch (_) {}
    return [];
  });

  const [reqInput, setReqInput] = useState('');
  const [prefInput, setPrefInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  // Manual candidate selection states
  const [candidateSelectionMode, setCandidateSelectionMode] = useState('batch'); // 'batch' | 'manual'
  const [availableCandidates, setAvailableCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set());
  const [candidateSearch, setCandidateSearch] = useState('');

  // Load batches and set default selection
  useEffect(() => {
    let active = true;
    const loadBatchesAndCandidates = async () => {
      if (!user) return;
      setLoadingBatches(true);
      setLoadingCandidates(true);
      const companyId = user.company_id || user.id;
      try {
        const [list, cands] = await Promise.all([
          candidateService.getUploadBatches(companyId, user.id).catch(() => []),
          candidateService.getCandidates(companyId, user.id).catch(() => []),
        ]);
        if (active) {
          const loaded = list || [];
          setBatches(loaded);
          setAvailableCandidates(cands || []);
          // If URL provides a batch ID and it exists, use it; otherwise use most recent batch (first)
          if (urlBatchId && loaded.some(b => b.id === urlBatchId)) {
            setSelectedBatchId(urlBatchId);
          } else if (loaded.length > 0) {
            setSelectedBatchId(loaded[0].id);
          } else {
            setSelectedBatchId(null);
          }
        }
      } catch (_) {
      } finally {
        if (active) {
          setLoadingBatches(false);
          setLoadingCandidates(false);
        }
      }
    };
    loadBatchesAndCandidates();
    return () => { active = false; };
  }, [user, urlBatchId]);

  const toggleCandidateSelection = (candId) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(candId)) next.delete(candId);
      else next.add(candId);
      return next;
    });
  };

  const selectAllFilteredCandidates = (filteredList) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      filteredList.forEach(c => next.add(c.id));
      return next;
    });
  };

  const clearCandidateSelection = () => {
    setSelectedCandidateIds(new Set());
  };

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title: form.title,
        description: form.description,
        industry: form.industry,
        customIndustry: form.customIndustry,
        department: form.department,
        reqSkills,
        prefSkills,
      }));
    } catch (_) {}
  }, [form, reqSkills, prefSkills]);

  useEffect(() => {
    let cancelled = false;
    if (user?.id && !user?.company_id) {
      (async () => {
        try {
          const cId = await ensureCompanyForUser(user);
          if (!cancelled && cId && refreshProfile) await refreshProfile();
        } catch (_) {}
      })();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.company_id, refreshProfile]);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  const addSkill = (type, text) => {
    const clean = text.trim().replace(/[,;]$/, '').trim();
    if (!clean) return;
    const set = type === 'req' ? setReqSkills : setPrefSkills;
    const current = type === 'req' ? reqSkills : prefSkills;
    if (current.includes(clean.toLowerCase())) return;
    set([...current, clean]);
  };

  const removeSkill = (type, idx) => {
    const arr = type === 'req' ? [...reqSkills] : [...prefSkills];
    arr.splice(idx, 1);
    (type === 'req' ? setReqSkills : setPrefSkills)(arr);
  };

  const validate = () => {
    const e = {};
    if (batches.length === 0 && availableCandidates.length === 0) {
      e.batches = 'You must upload CV documents in Step 1 before creating a job description.';
      showToast('Precondition error: No uploaded CV documents found. Please upload CVs first.', 'warn');
    }
    if (form.title.trim().length < 4) e.title = 'Job title must be at least 4 characters';
    if (form.description.trim().split(/\s+/).length < 20) e.description = 'Please provide a more detailed description (20+ words)';
    if (reqSkills.length < 2) e.reqSkills = 'Add at least 2 required skills';
    if (form.industry === 'Other' && (!form.customIndustry || !form.customIndustry.trim())) {
      e.industry = 'Please enter your custom industry name';
    }
    // Check candidate sourcing mode
    if (candidateSelectionMode === 'manual') {
      if (selectedCandidateIds.size === 0) {
        e.candidates = 'Please manually select at least one candidate for this job created.';
        showToast('Please select at least 1 candidate manually.', 'warn');
      }
    } else {
      if (!selectedBatchId) {
        e.batch = 'Please select an upload batch to rank candidates from.';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const analyzeJob = async () => {
    if (!validate()) return;
    if (!user?.id) {
      showToast('Please log in to submit a job description.', 'warn');
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const companyId = user?.company_id || (await ensureCompanyForUser(user)) || user.id;
      const finalIndustry = form.industry === 'Other' ? (form.customIndustry.trim() || 'Custom Industry') : form.industry;

      const isManual = candidateSelectionMode === 'manual';
      const manualList = isManual ? Array.from(selectedCandidateIds) : null;
      const batchIdToUse = isManual ? null : selectedBatchId;

      const job = await jobService.createJob(
        {
          title: form.title,
          description_text: form.description,
          required_skills: reqSkills,
          preferred_skills: prefSkills,
          industry: finalIndustry,
          department: form.department || finalIndustry,
          batch_id: batchIdToUse || null,
        },
        companyId,
        user.id
      );

      let analysis;
      try {
        analysis = await jobService.analyzeJob(job.id);
      } catch {
        analysis = { id: job.id, status: 'complete', extracted_skills: reqSkills };
      }

      let ranked = { ranked: 0, status: 'complete' };
      try {
        ranked = await rankingService.rankNow(job.id, companyId, user.id, batchIdToUse, manualList);
      } catch (rErr) {
        console.warn('Ranking processing error:', rErr);
        ranked = { jobId: job.id, ranked: 0, status: 'complete' };
      }

      const batchNameDesc = isManual
        ? `Manually Selected Pool (${manualList.length} candidate${manualList.length === 1 ? '' : 's'})`
        : (batches.find(b => b.id === batchIdToUse)?.name || batchIdToUse || 'Selected Batch');

      setAnalysisResult({
        ...job,
        extracted: analysis?.extracted_skills || reqSkills,
        ranked: ranked || { ranked: 0, status: 'complete' },
        batchName: batchNameDesc,
        isManualSelection: isManual,
      });
      showToast(`Job description created & ${ranked.ranked || 0} candidate(s) ranked against it!`);
    } catch (err) {
      showToast(err?.message || 'Failed to create job description.', 'warn');
    } finally {
      setAnalyzing(false);
    }
  };

  const wordCount = form.description.trim() ? form.description.trim().split(/\s+/).length : 0;

  const filteredCandidatesForManual = availableCandidates.filter(c => {
    if (!candidateSearch.trim()) return true;
    const q = candidateSearch.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const skills = (c.all_skills || []).join(' ').toLowerCase();
    const code = (c.candidate_code || c.simple_id || '').toLowerCase();
    return name.includes(q) || email.includes(q) || skills.includes(q) || code.includes(q);
  });

  return (
    <RecruiterLayout
      user={user}
      title="Upload Job Description"
      subtitle="Step 2: Create a new job posting and rank candidates against it automatically or by manual candidate selection."
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/recruiter/upload-cvs" className="btn btn-outline-secondary btn-sm">
            <FontAwesomeIcon icon="arrow-left" style={{ marginRight: 6 }} /> Step 1: Upload CVs
          </Link>
          <Link to="/recruiter/candidates" className="btn btn-outline-gold btn-sm">
            Step 3: Ranked Candidates <FontAwesomeIcon icon="arrow-right" style={{ marginLeft: 6 }} />
          </Link>
        </div>
      }
    >
      {/* Workflow Progression Stepper Header */}
      <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #0d1442 0%, #1a237e 100%)', color: '#fff', border: 'none', borderRadius: 14, padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold-mid)', fontWeight: 800 }}>
              Recruitment Workflow Pipeline
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.15rem' }}>
              Step 2 of 3: Enter Job Description & Select Candidates
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              1. Upload CVs
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span className="badge badge-gold" style={{ padding: '0.35rem 0.75rem', fontWeight: 800 }}>
              2. Create Job Description (Active)
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              3. Rank Candidates
            </span>
          </div>
        </div>
      </div>

      {/* Precondition Warning: Block if No Uploaded Documents */}
      {!loadingBatches && batches.length === 0 && availableCandidates.length === 0 && (
        <div className="card mb-4" style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
          border: '2px solid rgba(239,68,68,0.35)', borderRadius: 14, padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', color: 'var(--error)' }}>
              <FontAwesomeIcon icon="triangle-exclamation" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--error)', margin: '0 0 0.4rem 0' }}>
                Precondition Required: Upload CV Documents First
              </h3>
              <p style={{ color: 'var(--text-dark)', fontSize: '0.88rem', margin: '0 0 1rem 0', lineHeight: 1.55 }}>
                A job description cannot be created without uploaded candidate CV documents. Please upload one or more CV files in <strong>Step 1</strong> before submitting a job description. Candidates and rankings will be generated once you analyze the job against your uploaded documents.
              </p>
              <Link to="/recruiter/upload-cvs" className="btn btn-gold">
                <FontAwesomeIcon icon="arrow-up-from-bracket" style={{ marginRight: 6 }} /> Go to Step 1: Upload Documents Now
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2-1">
        {/* Left: form */}
        <div>
          {/* Target Candidate Sourcing: Mode Selector (Batch vs Manual Selection) */}
          <div className="card mb-4" style={{
            background: 'linear-gradient(135deg, rgba(92,107,192,0.05), rgba(92,107,192,0.01))',
            border: '1.5px solid rgba(92,107,192,0.25)',
          }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.95rem' }}>
                <FontAwesomeIcon icon="users-gear" style={{ marginRight: 6, color: 'var(--gold-mid)' }} />
                Candidate Sourcing & Selection Mode
              </span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className={`btn btn-xs ${candidateSelectionMode === 'batch' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setCandidateSelectionMode('batch')}
                  style={{ fontWeight: 700, padding: '0.3rem 0.65rem' }}
                >
                  <FontAwesomeIcon icon="layer-group" style={{ marginRight: 4 }} /> By CV Batch
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${candidateSelectionMode === 'manual' ? 'btn-gold' : 'btn-outline-secondary'}`}
                  onClick={() => setCandidateSelectionMode('manual')}
                  style={{ fontWeight: 700, padding: '0.3rem 0.65rem' }}
                >
                  <FontAwesomeIcon icon="user-check" style={{ marginRight: 4 }} /> Select Manually ({selectedCandidateIds.size})
                </button>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: '0.75rem' }}>
              {candidateSelectionMode === 'batch' ? (
                <>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)', marginBottom: '0.75rem' }}>
                    <strong>Select which uploaded batch of CVs</strong> to match and rank candidates against this job description. By default, the most recent batch is selected – this ensures old candidates are not included in the new job's rankings.
                  </div>
                  <div className="grid-2" style={{ gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <label className="form-label">Active Batch Selection</label>
                      <select
                        value={selectedBatchId || ''}
                        onChange={e => setSelectedBatchId(e.target.value)}
                        style={{ fontWeight: 600, color: 'var(--primary-dark)' }}
                        disabled={batches.length === 0}
                      >
                        {batches.length === 0 ? (
                          <option value="">No batches available</option>
                        ) : (
                          <>
                            <option value="all">All Uploaded Batches (Entire Candidate Pool)</option>
                            {batches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.count} CVs) — {b.date} [{b.status}]
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {errors.batch && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{errors.batch}</div>}
                    </div>
                    <div style={{ fontSize: '0.78rem', background: '#fff', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <strong>Selected Target:</strong>{' '}
                      {selectedBatchId === 'all'
                        ? 'All uploaded candidates across all batches'
                        : (batches.find(b => b.id === selectedBatchId)?.name || (selectedBatchId ? selectedBatchId : 'None selected'))}
                    </div>
                  </div>

                  {batches.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', alignSelf: 'center', fontWeight: 700 }}>Quick Select Batch:</span>
                      <button
                        type="button"
                        className={`btn btn-xs ${selectedBatchId === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedBatchId('all')}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                      >
                        All Batches
                      </button>
                      {batches.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          className={`btn btn-xs ${selectedBatchId === b.id ? 'btn-gold' : 'btn-outline-secondary'}`}
                          onClick={() => setSelectedBatchId(b.id)}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        >
                          <FontAwesomeIcon icon="file" style={{ marginRight: 4 }} />
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Manual Candidate Selection UI */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
                      <strong>Manually pick specific candidates</strong> to associate and rank with this job. Only the checked candidates will be evaluated and ranked.
                    </div>
                    <span className="badge badge-gold" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>
                      {selectedCandidateIds.size} of {availableCandidates.length} Selected
                    </span>
                  </div>

                  {/* Search and Action Bar */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search candidates by name, email, skill, or ID..."
                      value={candidateSearch}
                      onChange={e => setCandidateSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 200, fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-primary"
                      onClick={() => selectAllFilteredCandidates(filteredCandidatesForManual)}
                      disabled={filteredCandidatesForManual.length === 0}
                    >
                      <FontAwesomeIcon icon="check-double" style={{ marginRight: 4 }} /> Select Filtered ({filteredCandidatesForManual.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-secondary"
                      onClick={clearCandidateSelection}
                      disabled={selectedCandidateIds.size === 0}
                    >
                      <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Clear Selection
                    </button>
                  </div>

                  {errors.candidates && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--error)', fontWeight: 700, marginBottom: '0.6rem' }}>
                      {errors.candidates}
                    </div>
                  )}

                  {/* Candidate Selection List / Table */}
                  <div style={{
                    maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-color)',
                    borderRadius: 10, background: '#fff', padding: '0.25rem'
                  }}>
                    {loadingCandidates ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-light)' }}>
                        <div className="spinner spinner-sm"></div> Loading candidates...
                      </div>
                    ) : filteredCandidatesForManual.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-gray)', fontSize: '0.82rem' }}>
                        No candidates match "{candidateSearch}".
                      </div>
                    ) : (
                      filteredCandidatesForManual.map(cand => {
                        const isSelected = selectedCandidateIds.has(cand.id);
                        const candCode = cand.candidate_code || cand.simple_id || ('CAND-' + String(cand.id).slice(0, 4).toUpperCase());
                        const skills = (cand.all_skills || []).slice(0, 4);
                        return (
                          <div
                            key={cand.id}
                            onClick={() => toggleCandidateSelection(cand.id)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.55rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                              background: isSelected ? 'rgba(26,35,126,0.06)' : 'transparent',
                              borderBottom: '1px solid rgba(0,0,0,0.04)',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by parent div
                                style={{ width: 16, height: 16, accentColor: 'var(--primary-dark)', cursor: 'pointer' }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <strong style={{ color: 'var(--primary-dark)', fontSize: '0.86rem' }}>{cand.name}</strong>
                                  <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>{candCode}</span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)' }}>
                                  {cand.email} · {cand.years_experience || cand.structured_data?.total_experience_years || 0} yrs exp
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' }}>
                              {skills.map(s => (
                                <span key={s} className="tag tag-gold" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="pen" style={{ marginRight: 6 }} /> Job Description Form</div>
            <div className="card-body">
              <div className="grid-2 mb-3" style={{ gap: '0.8rem' }}>
                <div>
                  <label className="form-label">Job Title <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Senior Software Engineer (Full Stack)"
                    style={{ borderColor: errors.title ? 'var(--error)' : undefined }}
                  />
                  {errors.title && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{errors.title}</div>}
                </div>
                <div>
                  <label className="form-label">Industry / Department</label>
                  <select
                    value={form.industry}
                    onChange={e => setForm({ ...form, industry: e.target.value, department: form.department || e.target.value })}
                  >
                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  {form.industry === 'Other' && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="Enter custom industry name..."
                        value={form.customIndustry || ''}
                        onChange={e => setForm({ ...form, customIndustry: e.target.value })}
                        style={{ borderColor: errors.industry ? 'var(--error)' : undefined }}
                      />
                      {errors.industry && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.2rem' }}>{errors.industry}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">
                  Job Description <span style={{ color: 'var(--error)' }}>*</span>
                  <span style={{ float: 'right', fontSize: '0.75rem', color: wordCount < 20 ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                    {wordCount} / 20+ words
                  </span>
                </label>
                <textarea
                  rows={10}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={`We are looking for a talented engineer to join our team...\n\nResponsibilities:\n- Build and maintain scalable web applications\n- Collaborate with product team on features\n- Mentor junior developers\n\nRequirements:\n- 5+ years production experience\n- Strong CS fundamentals`}
                  style={{
                    fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.65,
                    borderColor: errors.description ? 'var(--error)' : undefined,
                  }}
                />
                {errors.description && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>{errors.description}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Required Skills <span style={{ color: 'var(--error)' }}>*</span>
                  {errors.reqSkills && <span style={{ color: 'var(--error)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{errors.reqSkills}</span>}
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem',
                  border: `1.5px solid ${errors.reqSkills ? 'var(--error)' : 'var(--border-color)'}`,
                  borderRadius: 10, background: '#fff', minHeight: 50, marginBottom: '0.5rem',
                }}
                  onClick={(e) => { if (e.target === e.currentTarget) document.getElementById('req-skill-input')?.focus(); }}
                >
                  {reqSkills.map((s, i) => (
                    <span key={i} className="tag tag-gold">
                      {s}
                      <button type="button" className="tag-remove" onClick={() => removeSkill('req', i)} aria-label={`Remove ${s}`}>×</button>
                    </span>
                  ))}
                  <input
                    id="req-skill-input"
                    type="text"
                    value={reqInput}
                    style={{
                      flex: 1, minWidth: 140, border: 'none', outline: 'none', padding: '0.25rem',
                      fontSize: '0.85rem', background: 'transparent',
                    }}
                    placeholder={reqSkills.length ? 'Add another skill, press Enter…' : 'Type skill then press Enter or comma…'}
                    onChange={e => setReqInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                        e.preventDefault();
                        addSkill('req', reqInput); setReqInput('');
                      } else if (e.key === 'Backspace' && !reqInput && reqSkills.length) {
                        removeSkill('req', reqSkills.length - 1);
                      }
                    }}
                    onBlur={() => { if (reqInput.trim()) { addSkill('req', reqInput); setReqInput(''); } }}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Press <strong>Enter</strong> or <strong>,</strong> to add. Suggested: Python, JavaScript, AWS, SQL, React…
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Preferred Skills (optional)</label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem',
                  border: '1.5px solid var(--border-color)', borderRadius: 10, background: '#fff', minHeight: 50,
                  marginBottom: '0.5rem',
                }}
                  onClick={(e) => { if (e.target === e.currentTarget) document.getElementById('pref-skill-input')?.focus(); }}
                >
                  {prefSkills.map((s, i) => (
                    <span key={i} className="tag">
                      {s}
                      <button type="button" className="tag-remove" onClick={() => removeSkill('pref', i)}>×</button>
                    </span>
                  ))}
                  <input
                    id="pref-skill-input"
                    type="text"
                    value={prefInput}
                    style={{
                      flex: 1, minWidth: 140, border: 'none', outline: 'none', padding: '0.25rem',
                      fontSize: '0.85rem', background: 'transparent',
                    }}
                    placeholder="Nice-to-have skills…"
                    onChange={e => setPrefInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                        e.preventDefault();
                        addSkill('pref', prefInput); setPrefInput('');
                      } else if (e.key === 'Backspace' && !prefInput && prefSkills.length) {
                        removeSkill('pref', prefSkills.length - 1);
                      }
                    }}
                    onBlur={() => { if (prefInput.trim()) { addSkill('pref', prefInput); setPrefInput(''); } }}
                  />
                </div>
              </div>

              <div className="d-flex gap-3 flex-wrap">
                <button
                  className="btn btn-gold btn-lg flex-1"
                  onClick={analyzeJob}
                  disabled={
                    analyzing ||
                    (!loadingBatches && batches.length === 0 && availableCandidates.length === 0) ||
                    (candidateSelectionMode === 'batch' && !selectedBatchId) ||
                    (candidateSelectionMode === 'manual' && selectedCandidateIds.size === 0)
                  }
                >
                  {analyzing ? (
                    <><span className="spinner spinner-sm spinner-gold"></span> Analyzing & Ranking Candidates...</>
                  ) : (!loadingBatches && batches.length === 0 && availableCandidates.length === 0) ? (
                    <><FontAwesomeIcon icon="lock" style={{ marginRight: 6 }} /> Upload CV Documents First (Step 1 Required)</>
                  ) : candidateSelectionMode === 'manual' && selectedCandidateIds.size === 0 ? (
                    <><FontAwesomeIcon icon="lock" style={{ marginRight: 6 }} /> Select at Least 1 Candidate Manually</>
                  ) : candidateSelectionMode === 'batch' && !selectedBatchId ? (
                    <><FontAwesomeIcon icon="lock" style={{ marginRight: 6 }} /> Select a CV Batch</>
                  ) : candidateSelectionMode === 'manual' ? (
                    <><FontAwesomeIcon icon="bullseye" style={{ marginRight: 6 }} /> Analyze & Rank {selectedCandidateIds.size} Selected Candidate{selectedCandidateIds.size === 1 ? '' : 's'}</>
                  ) : (
                    <><FontAwesomeIcon icon="bullseye" style={{ marginRight: 6 }} /> Analyze and Rank Candidates</>
                  )}
                </button>
                <button
                  className="btn btn-outline-secondary btn-lg"
                  onClick={() => {
                    if (!window.confirm('Clear all form input?')) return;
                    setForm({ title: '', description: '', industry: 'Engineering', department: '', reqSkillsText: '', prefSkillsText: '' });
                    setReqSkills([]); setPrefSkills([]); setReqInput(''); setPrefInput(''); setErrors({}); setAnalysisResult(null);
                    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
                  }}
                  disabled={analyzing}
                >
                  <FontAwesomeIcon icon="broom" style={{ marginRight: 6 }} /> Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview / Result */}
        <div>
          {analysisResult ? (
            <div className="card mb-4" style={{
              border: '2px solid var(--success)',
              background: 'linear-gradient(135deg, rgba(46,125,50,0.06), rgba(46,125,50,0.01))',
            }}>
              <div className="card-header" style={{ color: 'var(--success)', fontWeight: 800 }}>
                <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Step 2 Complete: Job Created & Candidates Ranked!
              </div>
              <div className="card-body">
                <div style={{
                  background: 'var(--bg-white)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '1rem', marginBottom: '1rem',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '0.35rem', fontSize: '1.05rem' }}>
                    {analysisResult.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '0.7rem' }}>
                    {analysisResult.industry || form.industry} · Job ID: {analysisResult.id}
                  </div>
                  <div style={{
                    fontSize: '0.82rem', color: 'var(--text-gray)', lineHeight: 1.55,
                    maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap',
                  }}>
                    {(analysisResult.description_text || form.description).slice(0, 500)}
                    {(analysisResult.description_text || form.description).length > 500 && '…'}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-light)', marginBottom: '0.4rem', letterSpacing: '0.03em' }}>
                    <FontAwesomeIcon icon="brain" style={{ marginRight: 6 }} /> EXTRACTED SKILLS SUMMARY
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {(analysisResult.extracted || []).map(s => <span key={s} className="tag tag-gold">{s}</span>)}
                    {(!analysisResult.extracted || analysisResult.extracted.length === 0) && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Processing skills…</span>
                    )}
                  </div>
                </div>

                <div style={{
                  padding: '0.9rem 1rem', borderRadius: 10,
                  background: 'var(--success-light)', border: '1px solid rgba(46,125,50,0.2)', marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <FontAwesomeIcon icon="trophy" style={{ fontSize: '1.15rem' }} />
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                      {analysisResult.ranked?.ranked || 0} candidates {analysisResult.ranked?.status === 'queued' ? 'queued for ranking' : 'ranked successfully'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                    Target: <strong>{analysisResult.batchName || 'Selected Upload Batch'}</strong>
                  </div>
                </div>

                <button
                  className="btn btn-gold btn-lg w-100"
                  onClick={() => {
                    const isManual = candidateSelectionMode === 'manual';
                    const hasValidBatch = !isManual && selectedBatchId && selectedBatchId !== 'all' && selectedBatchId !== 'null';
                    const batchParam = hasValidBatch ? `&batchId=${selectedBatchId}` : '';
                    navigate(`/recruiter/candidates?jobId=${analysisResult.id}${batchParam}`);
                  }}
                  style={{ fontWeight: 800 }}
                >
                  <FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> Next: View Ranked Candidates →
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header"><FontAwesomeIcon icon="eye" style={{ marginRight: 6 }} /> Job Description Preview</div>
              <div className="card-body" style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                {form.title || form.description || reqSkills.length ? (
                  <>
                    {form.title && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Title</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--primary-dark)' }}>{form.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{form.industry}{form.department ? ` · ${form.department}` : ''}</div>
                      </div>
                    )}
                    {form.description && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Description preview</div>
                        <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-gray)', whiteSpace: 'pre-wrap' }}>
                          {form.description.slice(0, 420)}{form.description.length > 420 && '…'}
                        </div>
                      </div>
                    )}
                    {reqSkills.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Required ({reqSkills.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {reqSkills.map((s, i) => <span key={i} className="tag tag-gold">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {prefSkills.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Preferred ({prefSkills.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {prefSkills.map((s, i) => <span key={i} className="tag">{s}</span>)}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}><FontAwesomeIcon icon="file" /></div>
                    Start typing to see a live preview of the job description, with extracted skills and summary.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card mt-4">
            <div className="card-header"><FontAwesomeIcon icon="lightbulb" style={{ marginRight: 6 }} /> Tips</div>
            <div className="card-body" style={{ fontSize: '0.82rem', color: 'var(--text-gray)', lineHeight: 1.6 }}>
              <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                <li>List concrete, measurable outcomes in the description — the NLP pipeline uses them for semantic matching.</li>
                <li>Distinguish <em>must-have</em> (required) vs <em>nice-to-have</em> (preferred) skills; each contributes differently to ranking (0.6× vs 0.4× weight).</li>
                <li>Include minimum years of experience and education requirements in the description body — our extractor will parse them.</li>
                <li><strong>By default, only the most recent CV batch is used</strong> to avoid old candidates appearing in new job rankings. You can select "All Uploaded Batches" to include all candidates.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`alert alert-${toast.kind || 'success'}`} style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          {toast.msg}
        </div>
      )}
    </RecruiterLayout>
  );
};

export default RecruiterUploadJob;