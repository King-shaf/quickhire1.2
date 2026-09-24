import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { candidateService, ensureCompanyForUser, deleteCandidate } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const pipelineSteps = [
  { key: 'upload', label: 'Upload Complete', icon: 'arrow-up-from-bracket' },
  { key: 'ocr', label: 'OCR Processing', icon: 'magnifying-glass' },
  { key: 'nlp', label: 'NLP Analysis', icon: 'brain' },
  { key: 'embedding', label: 'Embedding Generation', icon: 'calculator' },
  { key: 'complete', label: 'Complete', icon: 'check' },
];

const formatSize = (b) => {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
};

const RecruiterUploadCVs = () => {
  const { user } = useUser();
  const [files, setFiles] = useState(() => {
    try {
      const saved = sessionStorage.getItem('qh_uploaded_files_session');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activePipeline, setActivePipeline] = useState(null);
  const [history, setHistory] = useState([]);
  const [customBatchName, setCustomBatchName] = useState('');
  const [uploadedBatchId, setUploadedBatchId] = useState(null);
  const [toast, setToast] = useState(null);
  const inputRef = useRef(null);

  const saveFilesToSession = (filesArr) => {
    try {
      const serializable = filesArr.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        status: f.status,
        progress: f.progress,
        error: f.error,
        candidate_id: f.candidate_id,
        source_file: f.source_file,
      }));
      sessionStorage.setItem('qh_uploaded_files_session', JSON.stringify(serializable));
    } catch (_) {}
  };

  const updateFiles = (updater) => {
    setFiles(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveFilesToSession(next);
      return next;
    });
  };

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      const cId = user?.company_id || (await ensureCompanyForUser(user));
      if (cancelled) return;
      try {
        const h = await candidateService.getUploadBatches(cId, user.id).catch(() => []);
        if (cancelled) return;
        if (h && h.length) setHistory(h);
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const addFiles = (fileList) => {
    let maxBatch = 50;
    try {
      const savedMax = localStorage.getItem('qh_max_batch_upload');
      if (savedMax) maxBatch = Math.max(1, Number(savedMax));
    } catch (_) {}

    const remainingSlots = Math.max(0, maxBatch - files.length);
    const incoming = Array.from(fileList).filter(f => {
      if (f.size > 10 * 1024 * 1024) { showToast(`File ${f.name} exceeds 10MB limit and was skipped.`, 'info'); return false; }
      const name = f.name.toLowerCase();
      return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
    }).slice(0, remainingSlots);

    if (fileList.length > incoming.length) {
      showToast(`Added ${incoming.length} file(s). (Batch upload limit is ${maxBatch} CVs).`, 'info');
    }

    updateFiles(prev => [
      ...prev,
      ...incoming.map(f => ({
        id: 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        file: f, name: f.name, size: f.size, type: f.type,
        status: 'pending', progress: 0, error: null, candidate_id: null,
      })),
    ]);
  };

  const onDrag = (e, state) => {
    e.preventDefault(); e.stopPropagation();
    if (state !== null) setIsDragging(state);
  };

  const removeFile = async (id, candidateId = null) => {
    if (candidateId) {
      try {
        await deleteCandidate(candidateId);
        showToast('Candidate removed from database.');
      } catch (err) {
        console.warn('Failed to delete candidate:', err);
      }
    }
    updateFiles(fs => fs.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setFiles([]);
    try { sessionStorage.removeItem('qh_uploaded_files_session'); } catch (_) {}
  };

  const [batchNameError, setBatchNameError] = useState('');

  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (!pendingFiles.length || uploading || !user?.id) return;

    if (!customBatchName.trim()) {
      setBatchNameError('Batch name is mandatory. Please provide a batch name before uploading CVs.');
      showToast('Batch name is mandatory. Please enter a batch name before uploading.', 'danger');
      document.getElementById('custom-batch-name-input')?.focus();
      return;
    }
    setBatchNameError('');
    setUploading(true);
    setOverallProgress(0);

    const effectiveBatchName = customBatchName.trim();

    let batchId = null;
    let validCompanyId = null;
    try {
      validCompanyId = await ensureCompanyForUser(user);
      const batch = await candidateService.createUploadBatch(
        validCompanyId,
        user.id,
        effectiveBatchName,
        pendingFiles.length
      );
      batchId = batch?.id;
    } catch (bErr) {
      console.error('createUploadBatch error:', bErr);
      showToast(bErr?.message || 'Failed to create upload batch in database.', 'danger');
      setUploading(false);
      return;
    }

    if (!batchId) {
      showToast('Could not initialize batch in database. Please check your company settings.', 'danger');
      setUploading(false);
      return;
    }

    setUploadedBatchId(batchId);
    updateFiles(fs => fs.map(f => f.status === 'pending' || f.status === 'error' ? { ...f, status: 'uploading', progress: 0 } : f));
    const total = pendingFiles.length;
    let done = 0;
    const newHistoryEntry = {
      id: batchId,
      name: effectiveBatchName,
      count: pendingFiles.length,
      date: new Date().toLocaleString(),
      status: 'processing',
    };
    setHistory(h => [newHistoryEntry, ...h.filter(hh => hh.id !== batchId)]);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const item = pendingFiles[i];
      const id = item.id;
      const completedBeforeThis = i;
      updateFiles(fs => fs.map(f => f.id === id ? { ...f, status: 'uploading', progress: 10, error: null } : f));

      const onProgress = (percent) => {
        updateFiles(fs => fs.map(f => f.id === id ? { ...f, progress: percent } : f));
        setOverallProgress(Math.round(((completedBeforeThis + (percent / 100)) / total) * 100));
      };

      try {
        const c = await candidateService.uploadCV(
          item.file,
          validCompanyId,
          user.id,
          batchId,
          onProgress
        );
        updateFiles(fs => fs.map(f => f.id === id ? { ...f, status: 'complete', progress: 100, candidate_id: c?.id, error: null } : f));
        successCount++;
      } catch (err) {
        console.error(`CV upload error for ${item.name}:`, err);
        const errMsg = err?.message || 'Storage upload failed';
        updateFiles(fs => fs.map(f => f.id === id ? { ...f, status: 'error', progress: 0, error: errMsg } : f));
        failCount++;
      }
      done++;
      setOverallProgress(Math.round((done / total) * 100));
    }

    setActivePipeline({ steps: pipelineSteps.map((s, idx) => ({ ...s, status: idx === 0 ? 'complete' : (idx === 1 ? 'processing' : 'pending') })) });
    for (let si = 1; si < pipelineSteps.length; si++) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      setActivePipeline(ap => ap ? ({
        steps: ap.steps.map((s, idx) => idx === si ? { ...s, status: 'processing' } : (idx < si ? { ...s, status: 'complete' } : s)),
      }) : ap);
    }
    setActivePipeline(ap => ap ? ({ steps: ap.steps.map(s => ({ ...s, status: 'complete' })) }) : ap);

    const finalStatus = failCount === total ? 'failed' : (failCount > 0 ? 'partial' : 'success');

    try {
      await candidateService.updateUploadBatch(batchId, { status: finalStatus, file_count: successCount });
    } catch {
      // ignore
    }

    try {
      const refreshedHistory = await candidateService.getUploadBatches(validCompanyId, user.id);
      if (refreshedHistory && refreshedHistory.length) {
        setHistory(refreshedHistory);
      }
    } catch (_) {}

    setTimeout(() => setActivePipeline(null), 2500);
    setUploading(false);
    showToast(
      `Batch "${effectiveBatchName}" created in database: ${successCount} / ${total} CVs processed successfully.${failCount > 0 ? ` (${failCount} failed)` : ''}`,
      failCount > 0 ? 'warning' : 'success'
    );
  };

  const pendingCount = files.length;
  const activeBatchTarget = uploadedBatchId || (history.length > 0 ? history[0].id : null);
  const fileBadge = (s) => {
    if (s === 'pending') return <span className="badge badge-info">Pending</span>;
    if (s === 'uploading') return <span className="badge badge-warning">Uploading</span>;
    if (s === 'processing') return <span className="badge badge-warning">Processing</span>;
    if (s === 'complete') return <span className="badge badge-success"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> Complete</span>;
    if (s === 'error') return <span className="badge badge-error"><FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Failed</span>;
    return null;
  };

  const renderStepIcon = (step) => {
    return <FontAwesomeIcon icon={step.icon} />;
  };

  return (
    <RecruiterLayout
      user={user}
      title="Upload CVs"
      subtitle="Step 1: Batch upload up to 50 CV documents. Supported formats: PDF, JPEG, PNG. Max 10MB per file."
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={clearAllFiles} disabled={!pendingCount || uploading}>
            <FontAwesomeIcon icon="trash-can" style={{ marginRight: 6 }} /> Clear All
          </button>
          <button className="btn btn-primary btn-sm" onClick={startUpload} disabled={!pendingCount || uploading}>
            {uploading ? <><span className="spinner spinner-sm spinner-gold"></span> Processing...</> : <><FontAwesomeIcon icon="rocket" style={{ marginRight: 6 }} /> Start Upload</>}
          </button>
          <Link
            to={`/recruiter/upload-job${activeBatchTarget ? `?batchId=${activeBatchTarget}` : ''}`}
            className="btn btn-gold btn-sm"
          >
            Next: Create Job Description <FontAwesomeIcon icon="arrow-right" style={{ marginLeft: 6 }} />
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
              Step 1 of 3: Upload Candidate Documents
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-gold" style={{ padding: '0.35rem 0.75rem', fontWeight: 800 }}>
              1. Upload CVs (Active)
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              2. Create Job Description
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              3. Rank Candidates
            </span>
          </div>
        </div>
      </div>

      {/* Post-Upload Next Step Banner */}
      {activeBatchTarget && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(26,35,126,0.06))',
          border: '1.5px solid var(--gold-mid)', borderRadius: 12, padding: '1rem 1.35rem',
          marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
        }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FontAwesomeIcon icon="circle-check" style={{ color: 'var(--success)' }} />
              Documents Uploaded & Ready for Job Matching!
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
              Now proceed to Step 2 to enter your job requirements and trigger candidate ranking.
            </div>
          </div>
          <Link to={`/recruiter/upload-job?batchId=${activeBatchTarget}`} className="btn btn-gold">
            Next: Create Job Description <FontAwesomeIcon icon="arrow-right" style={{ marginLeft: 6 }} />
          </Link>
        </div>
      )}

      <div className="grid-2-1 mb-5">
        {/* Upload area */}
        <div>
          {/* Custom Batch Name Input - Mandatory */}
          <div className="card mb-3" style={{
            background: batchNameError ? '#fff5f5' : '#f8fafc',
            border: batchNameError ? '1.5px solid var(--error)' : '1.5px solid var(--border-color)',
            borderRadius: 12, padding: '0.85rem 1.15rem'
          }}>
            <label htmlFor="custom-batch-name-input" className="form-label" style={{ fontWeight: 700, color: batchNameError ? 'var(--error)' : 'var(--primary-dark)', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <FontAwesomeIcon icon="layer-group" style={{ color: 'var(--gold-mid)' }} />
              Batch Name / Campaign Title <span style={{ color: 'var(--error)' }}>* (Mandatory)</span>
            </label>
            <input
              id="custom-batch-name-input"
              type="text"
              className="form-control"
              placeholder="e.g. Developer Recruitment Drive 2026, Q3 Engineering Batch (Required)"
              value={customBatchName}
              onChange={e => {
                setCustomBatchName(e.target.value);
                if (e.target.value.trim()) setBatchNameError('');
              }}
              style={{ fontSize: '0.88rem', borderColor: batchNameError ? 'var(--error)' : undefined }}
              required
            />
            {batchNameError ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--error)', marginTop: '0.35rem', fontWeight: 600 }}>
                <FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 5 }} />
                {batchNameError}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                Batch name is mandatory so candidate documents can be filtered, tracked, and analyzed together.
              </div>
            )}
          </div>

          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={(e) => onDrag(e, true)}
            onDragOver={(e) => onDrag(e, true)}
            onDragLeave={(e) => onDrag(e, false)}
            onDrop={(e) => { onDrag(e, false); const dt = e.dataTransfer; if (dt && dt.files) addFiles(dt.files); }}
            onClick={() => inputRef.current?.click?.()}
            style={{ padding: '3rem 1.5rem', marginBottom: '1.25rem' }}
          >
            <div className="dropzone-icon"><FontAwesomeIcon icon="file" /></div>
            <div className="dropzone-title">Upload CVs</div>
            <div className="dropzone-sub">Drag & drop files here, or click to browse</div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span className="dropzone-hint"><FontAwesomeIcon icon="paperclip" style={{ marginRight: 4 }} /> PDF</span>
              <span className="dropzone-hint"><FontAwesomeIcon icon="image" style={{ marginRight: 4 }} /> JPEG</span>
              <span className="dropzone-hint"><FontAwesomeIcon icon="image" style={{ marginRight: 4 }} /> PNG</span>
              <span className="dropzone-hint"><FontAwesomeIcon icon="arrow-up" style={{ marginRight: 4 }} /> 10MB max</span>
              <span className="dropzone-hint"><FontAwesomeIcon icon="box" style={{ marginRight: 4 }} /> Up to 50 files</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
              className="d-none"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {(uploading || overallProgress > 0) && files.length > 0 && (
            <div className="card mb-4" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>Overall Batch Progress</span>
                <span style={{ color: 'var(--text-gray)' }}>{overallProgress}% ({files.filter(f => f.status === 'complete').length}/{files.length})</span>
              </div>
              <div className="progress" style={{ height: 10 }}>
                <div
                  className={`progress-bar ${overallProgress === 100 ? 'progress-bar-success' : ''}`}
                  style={{ width: `${overallProgress}%`, transition: 'width 0.3s ease' }}
                ></div>
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><FontAwesomeIcon icon="folder-open" style={{ marginRight: 6 }} /> Selected Files ({files.length})</span>
                {!uploading && <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Total: {formatSize(files.reduce((a, f) => a + f.size, 0))}</span>}
              </div>
              <div className="card-body" style={{ padding: '0.75rem' }}>
                {files.map(f => (
                  <div key={f.id} className="file-item">
                    <div className="file-icon">
                      {f.name.toLowerCase().endsWith('.pdf') ? <FontAwesomeIcon icon="file-pdf" /> : <FontAwesomeIcon icon="image" />}
                    </div>
                    <div className="file-info">
                      <div className="file-name">{f.name}</div>
                      <div className="file-meta">
                        {formatSize(f.size)}
                        {f.status === 'uploading' && ` · ${f.progress}%`}
                        {f.status === 'error' && <span style={{ color: 'var(--error)' }}> · {f.error || 'Upload failed'}</span>}
                      </div>
                      {(f.status === 'uploading' || f.status === 'processing') && (
                        <div className="progress mt-2" style={{ height: 4 }}>
                          <div
                            className={`progress-bar ${f.status === 'processing' ? 'progress-bar-gold progress-bar-striped progress-bar-animated' : ''}`}
                            style={{ width: `${f.status === 'processing' ? '100' : f.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div className="file-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {fileBadge(f.status)}
                      <button className="file-remove" onClick={() => removeFile(f.id, f.candidate_id)} title={f.candidate_id ? "Delete candidate from DB" : "Remove file"} style={{ color: 'var(--text-light)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        <FontAwesomeIcon icon="trash-can" style={{ fontSize: '0.88rem' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Pipeline + Tips */}
        <div>
          {activePipeline && (
            <div className="card mb-4" style={{
              border: '1.5px solid rgba(92,107,192,0.22)',
              background: 'linear-gradient(135deg, rgba(92,107,192,0.03), rgba(92,107,192,0.01))',
            }}>
              <div className="card-header" style={{ background: 'transparent', border: 'none', paddingBottom: 0 }}>
                <FontAwesomeIcon icon="brain" style={{ marginRight: 6 }} /> Processing Pipeline Status
              </div>
              <div className="card-body" style={{ paddingTop: '0.5rem' }}>
                <div className="timeline">
                  {activePipeline.steps.map((s, i) => {
                    const typeClass = s.status === 'complete' ? 'success' : s.status === 'processing' ? 'processing' : '';
                    return (
                      <div key={s.key} className={`timeline-item ${typeClass}`} style={{ paddingBottom: i === activePipeline.steps.length - 1 ? 0 : '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem' }}>
                            {s.status === 'processing' ? <FontAwesomeIcon icon="hourglass" /> : s.status === 'complete' ? renderStepIcon(s) : <FontAwesomeIcon icon="square" />}
                          </span>
                          <div className="timeline-title">{s.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="lightbulb" style={{ marginRight: 6 }} /> Upload Tips</div>
            <div className="card-body" style={{ fontSize: '0.85rem', color: 'var(--text-gray)', lineHeight: 1.6 }}>
              <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                <li><strong>Scan quality:</strong> Use 300 DPI for scanned documents for best OCR accuracy.</li>
                <li><strong>File size:</strong> Keep PDFs under 10MB — compress large image-based CVs.</li>
                <li><strong>Orientation:</strong> Ensure pages are upright; rotated text hurts extraction quality.</li>
                <li><strong>Languages:</strong> English, Spanish, and French CVs are supported out of the box.</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><FontAwesomeIcon icon="bolt" style={{ marginRight: 6 }} /> Shortcuts</div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
              <Link to="/recruiter/upload-job" className="btn btn-outline-primary btn-sm" style={{ justifyContent: 'flex-start' }}>
                <FontAwesomeIcon icon="file-lines" style={{ marginRight: 6 }} /> Next: Add Job Description
              </Link>
              <Link to="/recruiter/candidates" className="btn btn-outline-gold btn-sm" style={{ justifyContent: 'flex-start' }}>
                <FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> Browse Ranked Candidates
              </Link>
              <Link to="/recruiter/chatbot" className="btn btn-outline-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                <FontAwesomeIcon icon="robot" style={{ marginRight: 6 }} /> Ask Assistant About Uploads
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Upload History */}
      <div className="card">
        <div className="card-header"><FontAwesomeIcon icon="clipboard-list" style={{ marginRight: 6 }} /> Upload History</div>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Batch / File</th>
              <th>CVs</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-light)' }}>
                  No previous uploads yet. Your upload batches will appear here.
                </td>
              </tr>
            ) : (
              history.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{h.name}</td>
                  <td>{h.count}</td>
                  <td>{h.date}</td>
                  <td>
                    {h.status === 'success' && <span className="badge badge-success"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> Success</span>}
                    {h.status === 'processing' && <span className="badge badge-warning"><FontAwesomeIcon icon="hourglass" style={{ marginRight: 4 }} /> Processing</span>}
                    {h.status === 'partial' && <span className="badge badge-warning"><FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 4 }} /> Partial</span>}
                    {(h.status === 'failed' || h.status === 'error') && <span className="badge badge-error"><FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Failed</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/recruiter/upload-job?batchId=${h.id}`} className="btn btn-sm btn-gold" style={{ fontSize: '0.78rem' }}>
                      <FontAwesomeIcon icon="file-lines" style={{ marginRight: 4 }} /> Create Job →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

export default RecruiterUploadCVs;
