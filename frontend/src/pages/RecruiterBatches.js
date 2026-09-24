import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { candidateService, ensureCompanyForUser, deleteCandidate } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const RecruiterBatches = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const [batches, setBatches] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [editingBatch, setEditingBatch] = useState(null);
  const [renameInput, setRenameInput] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customBatchName, setCustomBatchName] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);

  const [addDocBatch, setAddDocBatch] = useState(null);
  const [addSelectedCandIds, setAddSelectedCandIds] = useState([]);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const companyId = user.company_id || (await ensureCompanyForUser(user)) || user.id;
      const bList = await candidateService.getUploadBatches(companyId, user.id);
      setBatches(bList || []);

      const cList = await candidateService.getCandidates(companyId, user.id);
      setAllCandidates(cList || []);
    } catch (err) {
      console.error('Failed loading batches:', err);
      showToast(err?.message || 'Error loading batches', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Rename Batch
  const handleRename = async () => {
    if (!editingBatch || !renameInput.trim()) return;
    try {
      await candidateService.renameUploadBatch(editingBatch.id, renameInput.trim());
      showToast(`Batch renamed to "${renameInput.trim()}"`);
      setEditingBatch(null);
      setRenameInput('');
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed renaming batch', 'danger');
    }
  };

  // Remove Candidate Document from Batch
  const handleRemoveFromBatch = async (candidateId, batchName) => {
    if (!window.confirm(`Remove candidate document from batch "${batchName}"?`)) return;
    try {
      await candidateService.removeCandidateFromBatch(candidateId);
      showToast('Document removed from batch');
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed removing document', 'danger');
    }
  };

  // Add Candidate Documents to an existing Batch
  const handleAddDocsToBatch = async () => {
    if (!addDocBatch || !addSelectedCandIds.length) return;
    try {
      await candidateService.addCandidatesToBatch(addDocBatch.id, addSelectedCandIds);
      showToast(`Added ${addSelectedCandIds.length} candidate documents to batch "${addDocBatch.name}"`);
      setAddDocBatch(null);
      setAddSelectedCandIds([]);
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed adding documents to batch', 'danger');
    }
  };

  // Create Brand New Custom Batch from Existing Uploaded Candidates
  const handleCreateCustomBatch = async () => {
    if (!customBatchName.trim()) {
      showToast('Please enter a custom batch name', 'warning');
      return;
    }
    if (!selectedCandidateIds.length) {
      showToast('Please select at least 1 uploaded candidate document', 'warning');
      return;
    }
    try {
      const companyId = user.company_id || (await ensureCompanyForUser(user));
      await candidateService.createCustomBatchFromCandidates(companyId, user.id, customBatchName, selectedCandidateIds);
      showToast(`Created new batch "${customBatchName.trim()}" with ${selectedCandidateIds.length} documents!`);
      setShowCreateModal(false);
      setCustomBatchName('');
      setSelectedCandidateIds([]);
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed creating custom batch', 'danger');
    }
  };

  // Permanently Delete Candidate
  const handleDeleteCandidatePermanently = async (candidateId, candidateName) => {
    if (!window.confirm(`Permanently delete candidate "${candidateName || 'Candidate'}" from database?`)) return;
    try {
      await deleteCandidate(candidateId);
      showToast('Candidate permanently deleted from database.');
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed deleting candidate', 'danger');
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (batch) => {
    if (!window.confirm(`Delete batch "${batch.name}"? Candidate documents will remain unbatched.`)) return;
    try {
      await candidateService.deleteUploadBatch(batch.id);
      showToast(`Deleted batch "${batch.name}"`);
      loadData();
    } catch (err) {
      showToast(err?.message || 'Failed deleting batch', 'danger');
    }
  };

  const filteredBatches = batches.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (b.name || '').toLowerCase().includes(q);
    const candMatch = (b.candidates || []).some(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.source_file_name || '').toLowerCase().includes(q));
    return nameMatch || candMatch;
  });

  const totalBatchedCount = batches.reduce((acc, b) => acc + (b.count || 0), 0);
  const unbatchedCandidates = allCandidates.filter(c => !c.batch_id);

  return (
    <RecruiterLayout
      user={user}
      title="Batches Created"
      subtitle="View, rename, edit documents in upload batches, or combine uploaded candidate CVs into custom batches."
      actions={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-gold btn-sm" onClick={() => setShowCreateModal(true)}>
            <FontAwesomeIcon icon="object-group" style={{ marginRight: 6 }} /> Create Batch from Existing Uploads
          </button>
          <Link to="/recruiter/upload-cvs" className="btn btn-primary btn-sm">
            <FontAwesomeIcon icon="upload" style={{ marginRight: 6 }} /> Upload New CVs
          </Link>
        </div>
      }
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`alert alert-${toast.kind}`} style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}

      {/* Metrics Summary Header */}
      <div className="grid-4 mb-4" style={{ gap: '1rem' }}>
        <div className="stats-card">
          <div className="stats-label">TOTAL BATCHES CREATED</div>
          <div className="stats-value">{batches.length}</div>
          <div className="stats-footer">Created CV upload drives</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">TOTAL CANDIDATES BATCHED</div>
          <div className="stats-value">{totalBatchedCount}</div>
          <div className="stats-footer">Documents grouped in batches</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">UNBATCHED DOCUMENTS</div>
          <div className="stats-value">{unbatchedCandidates.length}</div>
          <div className="stats-footer">Available for custom batching</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">TOTAL CANDIDATES POOL</div>
          <div className="stats-value">{allCandidates.length}</div>
          <div className="stats-footer">Across all company uploads</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: '0.85rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <FontAwesomeIcon icon="magnifying-glass" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-light)', fontSize: '0.85rem' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search batches by batch name, document filename, candidate name, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 34, fontSize: '0.88rem' }}
            />
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
            <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} /> Refresh Batches
          </button>
        </div>
      </div>

      {/* Batches Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 1rem' }}>
          <div style={{ fontSize: 54, color: 'var(--text-light)', marginBottom: '0.75rem' }}>
            <FontAwesomeIcon icon="folder-closed" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--primary-dark)' }}>No CV Batches Found</h3>
          <p style={{ color: 'var(--text-gray)', maxWidth: 460, margin: '0.5rem auto 1.5rem' }}>
            {searchQuery ? `No batches matched "${searchQuery}".` : 'You have not created any CV upload batches yet.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-gold" onClick={() => setShowCreateModal(true)}>
              <FontAwesomeIcon icon="object-group" style={{ marginRight: 6 }} /> Create Batch from Uploads
            </button>
            <Link to="/recruiter/upload-cvs" className="btn btn-primary">
              <FontAwesomeIcon icon="upload" style={{ marginRight: 6 }} /> Upload First CV Batch
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid-2 mb-4" style={{ gap: '1.25rem' }}>
          {filteredBatches.map((b) => (
            <div key={b.id} className="card" style={{ border: '1.5px solid var(--border-color)', borderRadius: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
                        <FontAwesomeIcon icon="folder-open" style={{ marginRight: 4 }} /> Batch
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{b.date}</span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {b.name}
                      <button
                        className="btn btn-xs btn-outline-secondary"
                        title="Rename Batch Name"
                        onClick={() => { setEditingBatch(b); setRenameInput(b.name); }}
                        style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                      >
                        <FontAwesomeIcon icon="pen" /> Edit Name
                      </button>
                    </h3>
                  </div>
                  <span className={`badge ${b.status === 'success' || b.status === 'complete' ? 'badge-success' : 'badge-secondary'}`}>
                    {b.count} Documents
                  </span>
                </div>

                {/* Candidate Documents List */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.75rem', marginBottom: '1rem', maxHeight: 220, overflowY: 'auto' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Included Candidate Documents ({b.candidates?.length || 0})</span>
                    <button
                      className="btn btn-xs btn-link"
                      onClick={() => setAddDocBatch(b)}
                      style={{ fontSize: '0.72rem', padding: 0 }}
                    >
                      + Add More Documents
                    </button>
                  </div>

                  {(!b.candidates || b.candidates.length === 0) ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No documents currently attached to this batch.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {b.candidates.map(cand => (
                        <div key={cand.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '0.4rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '0.5rem' }}>
                            <strong style={{ color: 'var(--primary-dark)' }}>{cand.name}</strong>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginLeft: '0.4rem' }}>
                              ({cand.source_file_name || 'CV Document'})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              className="btn btn-xs"
                              title="Unlink document from batch"
                              onClick={() => handleRemoveFromBatch(cand.id, b.name)}
                              style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-gray)' }}
                            >
                              <FontAwesomeIcon icon="link-slash" />
                            </button>
                            <button
                              className="btn btn-xs text-danger"
                              title="Permanently delete candidate from database"
                              onClick={() => handleDeleteCandidatePermanently(cand.id, cand.name)}
                              style={{ padding: '0.1rem 0.35rem', fontSize: '0.75rem', border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                              <FontAwesomeIcon icon="trash-can" style={{ color: 'var(--error)' }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ background: '#fafbfc', borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', borderRadius: '0 0 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setAddDocBatch(b)}>
                    <FontAwesomeIcon icon="plus" style={{ marginRight: 4 }} /> Add Docs
                  </button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteBatch(b)}>
                    <FontAwesomeIcon icon="trash" style={{ marginRight: 4 }} /> Delete Batch
                  </button>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/recruiter/upload-job?batchId=${b.id}`)}
                >
                  <FontAwesomeIcon icon="bullseye" style={{ marginRight: 4 }} /> Rank Against Job →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Rename Batch */}
      {editingBatch && (
        <div className="modal-overlay" onClick={() => setEditingBatch(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title"><FontAwesomeIcon icon="pen" style={{ marginRight: 6 }} /> Rename CV Batch</h3>
              <button className="modal-close" onClick={() => setEditingBatch(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <label className="form-label">New Batch Name</label>
              <input
                type="text"
                className="form-control"
                value={renameInput}
                onChange={e => setRenameInput(e.target.value)}
                placeholder="e.g. Engineering Candidates Drive 2026"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setEditingBatch(null)}>Cancel</button>
              <button className="btn btn-gold" onClick={handleRename}>Save Name</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add Candidate Documents to Batch */}
      {addDocBatch && (
        <div className="modal-overlay" onClick={() => setAddDocBatch(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <FontAwesomeIcon icon="plus" style={{ marginRight: 6 }} /> Add Documents to "{addDocBatch.name}"
              </h3>
              <button className="modal-close" onClick={() => setAddDocBatch(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '1rem' }}>
                Select uploaded candidates from your general pool to add to this batch:
              </p>
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem' }}>
                {allCandidates.filter(c => c.batch_id !== addDocBatch.id).map(cand => {
                  const checked = addSelectedCandIds.includes(cand.id);
                  return (
                    <label key={cand.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) setAddSelectedCandIds(prev => [...prev, cand.id]);
                          else setAddSelectedCandIds(prev => prev.filter(id => id !== cand.id));
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-dark)' }}>{cand.name}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>({cand.source_file_name || 'CV Document'})</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setAddDocBatch(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDocsToBatch} disabled={!addSelectedCandIds.length}>
                Add {addSelectedCandIds.length} Selected Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Create Brand New Custom Batch from Existing Uploads */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'var(--primary-dark)', color: '#fff' }}>
              <h3 className="modal-title" style={{ color: '#fff' }}>
                <FontAwesomeIcon icon="object-group" style={{ marginRight: 8, color: 'var(--gold-mid)' }} />
                Create Custom Batch from Uploaded Documents
              </h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} style={{ color: '#fff' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div className="mb-3">
                <label className="form-label">Custom Batch Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Senior Developers Pool - Q3 2026"
                  value={customBatchName}
                  onChange={e => setCustomBatchName(e.target.value)}
                />
              </div>

              <div className="mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label mb-0">Select Already Uploaded Candidates ({selectedCandidateIds.length} Selected)</label>
                <button
                  className="btn btn-xs btn-outline-secondary"
                  onClick={() => {
                    if (selectedCandidateIds.length === allCandidates.length) setSelectedCandidateIds([]);
                    else setSelectedCandidateIds(allCandidates.map(c => c.id));
                  }}
                >
                  {selectedCandidateIds.length === allCandidates.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, background: '#fff', padding: '0.5rem' }}>
                {allCandidates.map(cand => {
                  const checked = selectedCandidateIds.includes(cand.id);
                  return (
                    <label key={cand.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: checked ? 'rgba(26,35,126,0.03)' : 'transparent' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) setSelectedCandidateIds(prev => [...prev, cand.id]);
                          else setSelectedCandidateIds(prev => prev.filter(id => id !== cand.id));
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-dark)' }}>{cand.name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-gray)' }}>
                          File: {cand.source_file_name} · Email: {cand.email}
                        </div>
                      </div>
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                        {cand.batch_id ? 'In Batch' : 'Unbatched'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={handleCreateCustomBatch} disabled={!customBatchName.trim() || !selectedCandidateIds.length}>
                <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} /> Create Custom Batch ({selectedCandidateIds.length} Docs)
              </button>
            </div>
          </div>
        </div>
      )}
    </RecruiterLayout>
  );
};

export default RecruiterBatches;
