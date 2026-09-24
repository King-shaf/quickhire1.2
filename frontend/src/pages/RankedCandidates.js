import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { candidateService, jobService, rankingService, assignmentService, ensureCompanyForUser, calculateCandidateJobScore, reportService } from '../services/supabaseService';
import { downloadCandidateCV } from '../utils/cvDownloader';
import { useUser } from '../context/UserContext';
import { Link, useSearchParams } from 'react-router-dom';

const pageSize = 20;

const scoreColorClass = (pct) => pct >= 85 ? 'score-high' : pct >= 70 ? 'score-mid' : 'score-low';
const scoreTextColor = (pct) => pct >= 85 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--error)';

// ---- CandidateModal component (full definition) ----
function CandidateModal({ candidate, onClose, onAssign, shortlisted, onToggleShortlist, isCompared, onToggleCompare, onOpenAssignModal, onDownloadCV, batches = [] }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!candidate) return null;
  const pct = Math.round(candidate.relevance_score * 100);
  const sc = scoreColorClass(pct);

  const candCode = candidate.candidate_code || candidate.simple_id || ('CAND-' + (candidate.id ? String(candidate.id).split('-')[0].slice(0, 4).toUpperCase() : '1001'));
  const docName = candidate.source_file_name || (candidate.source_file ? String(candidate.source_file).split('/').pop() : 'CV_Document.pdf');
  const hsInfo = candidate.school_info?.high_school || {};
  const candBatchName = candidate.batch_name || (candidate.batch_id && batches.find(b => b.id === candidate.batch_id)?.batch_name) || candidate.structured_data?.batch_name || (candidate.structured_data?.batch_id && batches.find(b => b.id === candidate.structured_data.batch_id)?.batch_name) || null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        <div className="modal-header" style={{ background: 'var(--primary-dark)', color: '#fff', padding: '1.2rem 1.5rem' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="avatar avatar-lg avatar-gold">
              {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                <span className="badge badge-gold" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '0.78rem' }}>
                  {candCode}
                </span>
                {candBatchName && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: '0.74rem', fontWeight: 700 }}>
                    <FontAwesomeIcon icon="layer-group" style={{ marginRight: 5, color: 'var(--gold-light)' }} />
                    Batch: {candBatchName}
                  </span>
                )}
                <span className="badge badge-primary" style={{ fontSize: '0.74rem' }}>
                  {candidate.status?.toUpperCase() || 'COMPLETE'}
                </span>
              </div>
              <h3 className="modal-title" style={{ color: '#fff', fontSize: '1.4rem' }}>{candidate.name}</h3>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>
                {candidate.education?.degree || 'Candidate'} · {candidate.education?.institution || ''} {docName ? `(${docName})` : ''}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close" style={{ color: '#fff' }}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem' }}>
          {/* Manager Hired Confirmed Banner */}
          {Boolean(candidate.is_hired || candidate.hired || candidate.structured_data?.hired) && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))',
              border: '2px solid #10b981',
              borderRadius: 12,
              padding: '1rem 1.25rem',
              marginBottom: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  boxShadow: '0 4px 10px rgba(16,185,129,0.3)',
                }}>
                  <FontAwesomeIcon icon="award" />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#047857', fontWeight: 800 }}>
                    Official Recruitment Placement Confirmed
                  </div>
                  <div style={{ fontWeight: 800, color: '#065f46', fontSize: '1.1rem', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Candidate Hired by Company Manager
                    <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', fontWeight: 800 }}>
                      HIRED
                    </span>
                  </div>
                  {(candidate.hired_notes || candidate.structured_data?.hired_notes) && (
                    <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: 3 }}>
                      <strong>Manager Notes:</strong> "{candidate.hired_notes || candidate.structured_data?.hired_notes}"
                    </div>
                  )}
                </div>
              </div>
              {(candidate.hired_at || candidate.structured_data?.hired_at) && (
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, background: '#059669', color: '#fff' }}>
                    <FontAwesomeIcon icon="calendar-check" style={{ marginRight: 5 }} />
                    Hired on {new Date(candidate.hired_at || candidate.structured_data?.hired_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Matched Job Profile Header */}
          <div style={{ background: 'rgba(26,35,126,0.04)', border: '1px solid rgba(92,107,192,0.2)', borderRadius: 12, padding: '0.85rem 1.1rem', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700, marginBottom: '0.15rem' }}>
                Job Created With Candidate
              </div>
              <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1.05rem' }}>
                <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', marginRight: 6 }} />
                {candidate.matched_job_title || 'Assigned Job Profile'}
              </div>
              {candidate.matched_job_created_at && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
                  <FontAwesomeIcon icon="clock" style={{ marginRight: 4 }} />
                  Job Created: <strong>{new Date(candidate.matched_job_created_at).toLocaleString()}</strong>
                </div>
              )}
            </div>
            {onOpenAssignModal ? (
              <button
                className="btn btn-outline-gold btn-sm"
                onClick={() => { onClose(); onOpenAssignModal(candidate); }}
                style={{ fontWeight: 700 }}
              >
                <FontAwesomeIcon icon="user-plus" style={{ marginRight: 5 }} /> Assign / Select for Another Job
              </button>
            ) : (
              <span className="badge badge-gold" style={{ padding: '0.4rem 0.75rem', fontWeight: 700, fontSize: '0.78rem' }}>
                <FontAwesomeIcon icon="briefcase" style={{ marginRight: 5 }} /> Single Matched Job
              </span>
            )}
          </div>

          {/* System Decision & Qualification Rationale Banner */}
          {candidate.decision && (
            <div style={{
              background: candidate.isQualifying ? 'rgba(46,125,50,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1.5px solid ${candidate.isQualifying ? 'rgba(46,125,50,0.35)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: 12, padding: '0.9rem 1.15rem', marginBottom: '1.2rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span className={`badge ${candidate.isQualifying ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 800, fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}>
                  <FontAwesomeIcon icon={candidate.isQualifying ? "circle-check" : "circle-xmark"} style={{ marginRight: 6 }} />
                  SYSTEM DECISION: {candidate.decision}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                  Evaluation Criteria: <strong>≥ 60% Match & Critical Skills</strong>
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-dark)', lineHeight: 1.5, fontWeight: 500 }}>
                <strong>Decision Rationale (Why):</strong> {candidate.decision_explanation || (candidate.isQualifying ? 'Candidate meets role qualification threshold with demonstrated matching skills.' : 'Candidate scored below role qualification threshold or is missing required competencies.')}
              </div>
              {candidate.missing_reqs && candidate.missing_reqs.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--error)', fontWeight: 700 }}>Missing Skills:</span>
                  {candidate.missing_reqs.map(s => (
                    <span key={s} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', padding: '0.12rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Score + quick stats */}
          <div className="grid-4 mb-4" style={{ gap: '0.8rem' }}>
            <div style={{
              padding: '1rem 1.1rem', borderRadius: 14, background: 'linear-gradient(135deg, rgba(92,107,192,0.06), transparent)',
              border: '1px solid rgba(92,107,192,0.15)',
            }}>
              <div className="d-flex align-items-center gap-3">
                <div className={`score-ring ${sc}`} style={{ '--score': pct }}>
                  <div style={{ width: 64, height: 64, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                  <div className="score-ring-value" style={{ color: scoreTextColor(pct) }}>{pct}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.04em' }}>RELEVANCE</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary-dark)' }}>Match Score</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#fafbff' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 700 }}>EXPERIENCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: 4 }}>
                {candidate.years_experience} yrs
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>{candidate.experience?.length || 0} role(s) logged</div>
            </div>
            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#fafbff' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 700 }}>SKILLS EXTRACTED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: 4 }}>
                {candidate.all_skills?.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>Technical + Soft</div>
            </div>
            <div className="card" style={{ padding: '0.9rem 1.1rem', background: '#fafbff' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 700 }}>OCR CONFIDENCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: 4 }}>
                {Math.round((candidate.ocr_confidence || 0) * 100)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>Target: ≥ 80%</div>
            </div>
          </div>

          <div className="grid-2">
            {/* Personal & Contact details */}
            <div className="card">
              <div className="card-header"><FontAwesomeIcon icon="user" style={{ marginRight: 6 }} />Candidate Contact & Particulars</div>
              <div className="card-body" style={{ padding: '1rem 1.25rem', fontSize: '0.85rem' }}>
                <div className="grid-2" style={{ gap: '0.75rem 1rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>First Name</div>
                    <div style={{ fontWeight: 600 }}>{candidate.first_name || candidate.name.split(' ')[0]}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Surname / Last Name</div>
                    <div style={{ fontWeight: 600 }}>{candidate.last_name || candidate.name.split(' ').slice(1).join(' ') || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Email Address</div>
                    <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{candidate.email}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Contact Phone (SA)</div>
                    <div style={{ fontWeight: 600 }}>{candidate.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Simple Candidate ID</div>
                    <div style={{ fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: 'var(--primary-dark)' }}>{candCode}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>SA National ID / Passport</div>
                    <div style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{candidate.id_number || '—'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Location / Address</div>
                    <div style={{ fontWeight: 600 }}>{candidate.location || 'South Africa'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Skills & Expertise */}
            <div className="card">
              <div className="card-header"><FontAwesomeIcon icon="tags" style={{ marginRight: 6 }} />Skills & Competencies</div>
              <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>Technical Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {candidate.skills?.technical?.length ? candidate.skills.technical.map(s => <span key={s} className="tag tag-gold" style={{ fontSize: '0.74rem' }}>{s}</span>)
                      : candidate.all_skills?.slice(0, 12).map(s => <span key={s} className="tag tag-gold" style={{ fontSize: '0.74rem' }}>{s}</span>)
                    }
                  </div>
                </div>
                {candidate.credentials && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>Driver's License & Credentials</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-dark)' }}>
                      {candidate.credentials.drivers_license || "Driver's License: Standard Code 8 / EB"}
                    </div>
                    {candidate.credentials.professional_registrations?.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                        {candidate.credentials.professional_registrations.map(r => <span key={r} className="badge badge-gold">{r}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid-2 mt-4">
            {/* Work Experience Timeline with Start and End Dates */}
            <div className="card">
              <div className="card-header"><FontAwesomeIcon icon="briefcase" style={{ marginRight: 6 }} />Work Experience (Companies & Dates)</div>
              <div className="card-body" style={{ padding: '0.8rem 1.25rem 1.25rem' }}>
                {candidate.work_experience && candidate.work_experience.length > 0 ? (
                  <div className="timeline">
                    {candidate.work_experience.map((w, i) => (
                      <div key={i} className="timeline-item success" style={{ paddingBottom: i === candidate.work_experience.length - 1 ? 0 : '1.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="timeline-title" style={{ fontWeight: 800 }}>{w.title}</div>
                          {w.type_of_experience && <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>{w.type_of_experience}</span>}
                        </div>
                        <div style={{ color: 'var(--primary-mid)', fontWeight: 700, fontSize: '0.85rem' }}>
                          <FontAwesomeIcon icon="building" style={{ marginRight: 4 }} /> {w.company}
                        </div>
                        <div className="timeline-time" style={{ fontWeight: 600, color: 'var(--primary-dark)', fontSize: '0.8rem', margin: '0.2rem 0' }}>
                          <FontAwesomeIcon icon="calendar-days" style={{ marginRight: 4 }} />
                          Start: <strong>{w.start_date || 'N/A'}</strong> — End: <strong>{w.end_date || 'Present'}</strong> {w.duration_years ? `(${w.duration_years} yrs)` : ''}
                        </div>
                        <div className="timeline-desc" style={{ fontSize: '0.82rem', marginTop: '0.3rem', color: 'var(--text-gray)' }}>{w.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>No detailed work history entries parsed.</div>
                )}
              </div>
            </div>

            {/* School Info & Education */}
            <div className="card">
              <div className="card-header"><FontAwesomeIcon icon="graduation-cap" style={{ marginRight: 6 }} />School & Tertiary Education</div>
              <div className="card-body" style={{ padding: '0.8rem 1.25rem 1.25rem' }}>
                {/* High School / Matric */}
                <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary-dark)', fontWeight: 800, marginBottom: '0.2rem' }}>
                    <FontAwesomeIcon icon="school" style={{ marginRight: 4 }} /> High School / Matric Info
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.88rem' }}>
                    {hsInfo.school_name || 'South African Secondary School'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>
                    Qualification: <strong>{hsInfo.qualification || 'Matric / Grade 12 (NSC)'}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                    Completed: <strong>{hsInfo.year_completed || 'Passed'}</strong>
                  </div>
                </div>

                {/* Tertiary Qualifications */}
                <div className="timeline">
                  {candidate.education_history?.map((e, i) => (
                    <div key={i} className="timeline-item success" style={{ paddingBottom: i === candidate.education_history.length - 1 ? 0 : '1rem' }}>
                      <div className="timeline-title">{e.degree}</div>
                      <div style={{ color: 'var(--primary-mid)', fontWeight: 600, fontSize: '0.82rem' }}>{e.institution}</div>
                      <div className="timeline-time">Graduated / Year: {e.year || 'N/A'}</div>
                      {e.details && <div className="timeline-desc">{e.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* References */}
          {candidate.references && candidate.references.length > 0 && (
            <div className="card mt-4">
              <div className="card-header"><FontAwesomeIcon icon="address-book" style={{ marginRight: 6 }} />References / Referees</div>
              <div className="card-body" style={{ padding: '0.8rem 1.25rem' }}>
                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  {candidate.references.map((ref, i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.83rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{ref.name}</div>
                      <div style={{ color: 'var(--primary-mid)', fontWeight: 600 }}>{ref.title} — {ref.company}</div>
                      <div style={{ color: 'var(--text-gray)', marginTop: '0.2rem' }}>Contact: {ref.phone || ref.contact || ref.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Raw text */}
          <div className="card mt-4">
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowRaw(s => !s)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span><FontAwesomeIcon icon="clipboard-list" style={{ marginRight: 6 }} />Extracted CV Text {candidate.ocr_confidence && <span className="badge badge-info ml-2" style={{ marginLeft: 8 }}>OCR {(candidate.ocr_confidence * 100).toFixed(1)}%</span>}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-mid)', fontWeight: 600 }}>{showRaw ? 'Collapse ▲' : 'Expand ▼'}</span>
              </div>
            </div>
            {showRaw && (
              <div style={{
                padding: '1rem 1.25rem', fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 320,
                overflowY: 'auto', background: '#0d1442', color: '#e6e9ff', borderRadius: 0,
              }}>
                {candidate.raw_text}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
          <button
            className="btn btn-outline-primary"
            onClick={() => {
              if (candidate.email && candidate.email !== 'N/A') {
                window.location.href = `mailto:${candidate.email}?subject=${encodeURIComponent('QUICK HIRE Opportunity: ' + (candidate.matched_job_title || 'Application Review'))}`;
              } else {
                alert('No email address on file for this candidate.');
              }
            }}
            title={candidate.email ? `Email ${candidate.email}` : 'No email available'}
          >
            <FontAwesomeIcon icon="envelope" style={{ marginRight: 6 }} />Contact Candidate
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={() => onDownloadCV && onDownloadCV(candidate)}
            title="Download Candidate CV (Original file or verified dossier)"
          >
            <FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />Download CV
          </button>
          {onToggleCompare && (
            <button
              className={isCompared ? 'btn btn-gold' : 'btn btn-outline-primary'}
              onClick={() => onToggleCompare(candidate.id)}
              title={isCompared ? 'Remove from comparison' : 'Add to candidate comparison'}
            >
              <FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} />
              {isCompared ? 'In Comparison' : 'Add to Compare'}
            </button>
          )}
          <button className={shortlisted ? 'btn btn-gold' : 'btn btn-primary'} onClick={() => onToggleShortlist(candidate.id)}>
            {shortlisted ? <><FontAwesomeIcon icon="star" style={{ marginRight: 6 }} />Shortlisted</> : <><FontAwesomeIcon icon="star" style={{ marginRight: 6, opacity: 0.4 }} />Add to Shortlist</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- CompareModal component ----
function CompareModal({
  compareIds,
  candidates,
  onClose,
  onRemove,
  onClear,
  shortlist,
  onToggleShortlist,
  onSelectCandidate,
  onDownloadCV,
  targetJob,
  batchMap = {}
}) {
  const selectedCands = useMemo(() => {
    return candidates.filter(c => compareIds.has(c.id));
  }, [candidates, compareIds]);

  if (!compareIds || compareIds.size === 0) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10500 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '1280px',
          width: '95vw',
          maxHeight: '92vh',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, #0d1442 0%, #1a237e 100%)',
            color: '#fff',
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--gold-mid)', fontWeight: 800 }}>
              Side-by-Side Candidate Evaluation
            </div>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon="chart-bar" style={{ color: 'var(--gold-mid)' }} />
              Candidate Comparison ({selectedCands.length} selected)
            </h3>
            {targetJob && (
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                Evaluated against: <strong>{targetJob.title}</strong> {targetJob.department ? `(${targetJob.department})` : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={onClear}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
              title="Clear all candidates from comparison"
            >
              Clear All
            </button>
            <button
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
              style={{ color: '#fff', fontSize: '1.5rem', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body - Grid of candidate columns */}
        <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto', background: '#f8fafc' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(selectedCands.length, 2)}, minmax(280px, 1fr))`,
              gap: '1rem',
              alignItems: 'stretch',
            }}
          >
            {selectedCands.map(c => {
              const pct = Math.round((c.relevance_score || 0) * 100);
              const sl = shortlist.has(c.id);
              const candCode = c.candidate_code || c.simple_id || ('CAND-' + (c.id ? String(c.id).split('-')[0].slice(0, 4).toUpperCase() : '1001'));
              const candBatchName = c.batch_name || (c.batch_id && batchMap[c.batch_id]) || c.structured_data?.batch_name || null;
              const hsInfo = c.school_info?.high_school || {};
              const topSkills = c.skills?.technical?.length ? c.skills.technical : (c.all_skills || []).slice(0, 8);

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1.5px solid var(--border-color)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Candidate Card Header */}
                  <div style={{ padding: '1.1rem', borderBottom: '1px solid var(--border-color)', background: '#fafbff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <div className="avatar avatar-md avatar-gold" style={{ fontWeight: 800 }}>
                        {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => onToggleShortlist(c.id)}
                          title={sl ? 'Remove from shortlist' : 'Add to shortlist'}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.78rem',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: sl ? '#ffd700' : '#fff',
                            color: sl ? '#0d1442' : 'var(--text-light)',
                          }}
                        >
                          <FontAwesomeIcon icon="star" />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemove(c.id)}
                          title="Remove from comparison"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', borderRadius: 6 }}
                        >
                          <FontAwesomeIcon icon="xmark" />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-dark)', lineHeight: 1.2 }}>
                      {c.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-gold" style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 800 }}>
                        {candCode}
                      </span>
                      {candBatchName && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                          {candBatchName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.3rem', wordBreak: 'break-all' }}>
                      {c.email}
                    </div>
                  </div>

                  {/* Candidate Content Body */}
                  <div style={{ padding: '1.1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Overall Score */}
                    <div style={{ background: 'rgba(26,35,126,0.03)', border: '1px solid rgba(92,107,192,0.15)', borderRadius: 10, padding: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase' }}>
                          Relevance Match
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: scoreTextColor(pct) }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="progress" style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            background: pct >= 85 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--error)',
                            height: '100%',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-gray)', marginTop: '0.4rem' }}>
                        <span>Semantic: <strong>{Math.round((c.similarity_score || c.semantic_score || c.relevance_score || 0) * 100)}%</strong></span>
                        <span>Skills: <strong>{Math.round((c.skill_match_score || c.relevance_score || 0) * 100)}%</strong></span>
                      </div>
                      {c.decision && (
                        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                          <span className={`badge ${c.isQualifying ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem' }}>
                            <FontAwesomeIcon icon={c.isQualifying ? "circle-check" : "circle-xmark"} style={{ marginRight: 4 }} />
                            {c.decision}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Experience */}
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 800, marginBottom: '0.3rem' }}>
                        <FontAwesomeIcon icon="briefcase" style={{ marginRight: 5, color: 'var(--gold-mid)' }} />
                        Experience ({c.years_experience || 0} Years)
                      </div>
                      {c.work_experience && c.work_experience.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {c.work_experience.slice(0, 2).map((w, idx) => (
                            <div key={idx} style={{ fontSize: '0.78rem', background: '#f8fafc', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                              <strong style={{ color: 'var(--primary-dark)' }}>{w.title}</strong>
                              <div style={{ color: 'var(--primary-mid)', fontSize: '0.74rem' }}>{w.company}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)' }}>
                                {w.start_date || 'N/A'} – {w.end_date || 'Present'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                          {c.years_experience || 0} years recorded (no company history parsed)
                        </div>
                      )}
                    </div>

                    {/* Education */}
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 800, marginBottom: '0.3rem' }}>
                        <FontAwesomeIcon icon="graduation-cap" style={{ marginRight: 5, color: 'var(--gold-mid)' }} />
                        Education & Qualifications
                      </div>
                      <div style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                          {c.education?.degree || c.education_history?.[0]?.degree || 'Standard Education'}
                        </div>
                        <div style={{ color: 'var(--text-gray)', fontSize: '0.74rem' }}>
                          {c.education?.institution || c.education_history?.[0]?.institution || 'Institution N/A'}
                        </div>
                        {hsInfo.school_name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--primary-mid)', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed var(--border-color)' }}>
                            Matric: {hsInfo.school_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical Skills */}
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 800, marginBottom: '0.35rem' }}>
                        <FontAwesomeIcon icon="tags" style={{ marginRight: 5, color: 'var(--gold-mid)' }} />
                        Top Skills ({topSkills.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {topSkills.map(s => (
                          <span key={s} className="tag tag-gold" style={{ fontSize: '0.68rem', padding: '0.12rem 0.45rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Skills if evaluated */}
                    {c.missing_reqs && c.missing_reqs.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--error)', fontWeight: 800, marginBottom: '0.25rem' }}>
                          Missing Requirements ({c.missing_reqs.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {c.missing_reqs.map(s => (
                            <span key={s} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => { onClose(); onSelectCandidate(c); }}
                      style={{ width: '100%', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      <FontAwesomeIcon icon="user" style={{ marginRight: 6 }} />
                      View Complete Profile
                    </button>
                    {onDownloadCV && (
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => onDownloadCV(c)}
                        style={{ width: '100%', fontSize: '0.78rem' }}
                      >
                        <FontAwesomeIcon icon="download" style={{ marginRight: 6 }} />
                        Download CV
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Placeholder card if only 1 candidate selected */}
            {selectedCands.length === 1 && (
              <div
                className="card"
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: 14,
                  border: '2px dashed var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  minHeight: 350,
                }}
              >
                <div style={{ fontSize: '2.5rem', color: 'var(--text-light)', marginBottom: '0.85rem' }}>
                  <FontAwesomeIcon icon="user-plus" />
                </div>
                <h4 style={{ color: 'var(--primary-dark)', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                  Select Another Candidate
                </h4>
                <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem', maxWidth: 260, marginBottom: '1.2rem' }}>
                  Close this modal and check the checkbox on any other candidate card to compare them side-by-side (up to 4 candidates).
                </p>
                <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                  Back to Candidates List
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            background: '#fff',
            borderTop: '1px solid var(--border-color)',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
            Tip: You can compare up to 4 candidates at the same time.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => window.print()}
              title="Print or save candidate comparison"
            >
              <FontAwesomeIcon icon="print" style={{ marginRight: 6 }} /> Print Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ----
const RankedCandidates = () => {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetJobId = searchParams.get('jobId') || searchParams.get('job_id');
  const rawBatchParam = searchParams.get('batchId') || searchParams.get('batch_id');
  const targetBatchId = (!rawBatchParam || rawBatchParam === 'null' || rawBatchParam === 'undefined' || rawBatchParam === 'all') ? null : rawBatchParam;
  const matchedOnly = searchParams.get('matchedOnly') === 'true';

  const [all, setAll] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [batches, setBatches] = useState([]);
  const urlTab = searchParams.get('tab');
  const [selectedBatchId, setSelectedBatchId] = useState(targetBatchId || 'all');
  const [qualificationTab, setQualificationTab] = useState(urlTab || 'split');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [sortBy, setSortBy] = useState('score');
  const [deptFilter, setDeptFilter] = useState('all');
  const [view, setView] = useState('cards');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [shortlist, setShortlist] = useState(new Set());
  const [compare, setCompare] = useState(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Sync tab from URL if changes
  useEffect(() => {
    if (urlTab) setQualificationTab(urlTab);
  }, [urlTab]);

  // Keep selectedBatchId in sync when targetBatchId changes in URL
  useEffect(() => {
    setSelectedBatchId(targetBatchId || 'all');
    if (targetBatchId) {
      setQualificationTab('split');
    }
  }, [targetBatchId]);

  // Load and apply preference threshold
  useEffect(() => {
    try {
      const overrides = JSON.parse(localStorage.getItem('qh_system_config_overrides') || '{}');
      const prefMin = overrides.ai?.min_score;
      if (prefMin !== undefined && prefMin !== null) {
        setMinScore(Number(prefMin));
      }
    } catch (_) {}

    const handleCfgUpdate = () => {
      try {
        const overrides = JSON.parse(localStorage.getItem('qh_system_config_overrides') || '{}');
        const prefMin = overrides.ai?.min_score;
        if (prefMin !== undefined && prefMin !== null) {
          setMinScore(Number(prefMin));
        }
      } catch (_) {}
    };

    window.addEventListener('qh_config_updated', handleCfgUpdate);
    return () => window.removeEventListener('qh_config_updated', handleCfgUpdate);
  }, []);

  // Manual candidate assignment modal states
  const [assignCandidateModal, setAssignCandidateModal] = useState(null);
  const [selectedAssignJobId, setSelectedAssignJobId] = useState('');
  const [assigningToJob, setAssigningToJob] = useState(false);

  // Manage candidates for specific job modal
  const [manageJobModal, setManageJobModal] = useState(null);
  const [jobModalSelectedCandidateIds, setJobModalSelectedCandidateIds] = useState(new Set());
  const [savingJobCandidates, setSavingJobCandidates] = useState(false);
  const [jobModalSearch, setJobModalSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownloadCV = async (cand) => {
    if (!cand) return;
    try {
      showToast(`Preparing download for ${cand.name}...`, 'info');
      const res = await downloadCandidateCV(cand);
      showToast(`Downloaded CV: ${res.filename} (${res.method === 'original_file' ? 'Original document' : 'Verified dossier'})`);
    } catch (err) {
      console.error('Failed to download CV:', err);
      showToast(`Failed to download CV: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const companyId = user?.company_id || user?.companies?.id || (await ensureCompanyForUser(user)) || null;
    const isCompanyManager = user?.role === 'company';
    const userId = isCompanyManager ? null : user?.id;
    let [j, list, bList] = await Promise.all([
      jobService.getJobs(companyId, userId).catch(() => []),
      candidateService.getRankedCandidates(companyId, userId).catch(() => []),
      candidateService.getUploadBatches(companyId, userId).catch(() => []),
    ]);

    // Safety fallback: if targetJobId in URL is specified, ensure it belongs to this company (or recruiter/admin)
    if (targetJobId && (!j || !j.some(job => job.id === targetJobId))) {
      const jobRow = await jobService.getJobById(targetJobId).catch(() => null);
      if (jobRow && (userId ? (jobRow.created_by === userId || jobRow.company_id === companyId) : (!companyId || jobRow.company_id === companyId))) {
        j = [jobRow, ...(j || [])];
      }
    }

    // Safety fallback: if targetBatchId in URL is specified, ensure candidates from this batch are present and match company (or recruiter/admin)
    if (targetBatchId) {
      const targetLower = String(targetBatchId).toLowerCase();
      const hasBatchCands = (list || []).some(c => String(c.batch_id || c.structured_data?.batch_id || '').toLowerCase() === targetLower);
      if (!hasBatchCands) {
        const batchCands = await candidateService.getCandidatesByBatch(targetBatchId).catch(() => []);
        if (batchCands && batchCands.length) {
          const validBatchCands = batchCands.filter(c => (userId ? (c.user_id === userId || c.company_id === companyId) : (!companyId || c.company_id === companyId)));
          const existingIds = new Set((list || []).map(c => c.id));
          list = [...(list || []), ...validBatchCands.filter(c => !existingIds.has(c.id))];
        }
      }
    }

    // Dynamic batch list merging:
    // Ensure all batches from bList, plus any batch_id referenced by loaded candidates, are present so batch filter is never empty
    const finalBatches = [...(bList || [])];
    const knownBatchIds = new Set(finalBatches.map(b => String(b.id)));
    (list || []).forEach(c => {
      const bId = c.batch_id || c.structured_data?.batch_id;
      if (bId && !knownBatchIds.has(String(bId))) {
        knownBatchIds.add(String(bId));
        finalBatches.push({
          id: bId,
          name: c.batch_name || c.structured_data?.batch_name || `Batch ${String(bId).slice(0, 8)}`,
          batch_name: c.batch_name || c.structured_data?.batch_name || `Batch ${String(bId).slice(0, 8)}`,
          created_at: c.created_at,
          total_resumes: 1,
        });
      }
    });

    setJobs(j || []);
    setAll(list || []);
    setBatches(finalBatches);
    setShortlist(new Set((list || []).filter(c => c.shortlisted).map(c => c.id)));
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadData();
      } catch (err) {
        console.warn('RankedCandidates load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- FIXED: use targetJobId instead of undefined selectedJobId ---
  const openAssignModal = (cand) => {
    if (!cand) return;
    setAssignCandidateModal(cand);
    const defaultJobId = (targetJobId && targetJobId !== 'all') ? targetJobId : (jobs[0]?.id || '');
    setSelectedAssignJobId(defaultJobId);
  };

  const handleAssignCandidateToJob = async () => {
    if (!assignCandidateModal || !selectedAssignJobId) {
      showToast('Please select a target job description.', 'warn');
      return;
    }
    setAssigningToJob(true);
    try {
      const targetJob = jobs.find(j => j.id === selectedAssignJobId);
      const companyId = targetJob?.company_id || user?.company_id || (await ensureCompanyForUser(user)) || null;
      await assignmentService.assignCandidate(
        selectedAssignJobId,
        assignCandidateModal.id,
        companyId,
        user.id,
        'assigned',
        'Direct recruiter assignment'
      );
      showToast(`Successfully assigned "${assignCandidateModal.name}" to "${targetJob?.title || 'Selected Job'}"!`);
      setAssignCandidateModal(null);
      setSelectedAssignJobId('');
      await loadData();
    } catch (err) {
      console.error('Failed to assign candidate to job:', err);
      showToast(err.message || 'Failed to assign candidate to job.', 'error');
    } finally {
      setAssigningToJob(false);
    }
  };


  const openManageCandidatesModalForJob = async (jobId) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;
    setManageJobModal(targetJob);
    setJobModalSearch('');
    try {
      const currentRankings = await rankingService.getRankings(jobId).catch(() => []);
      const candIds = new Set((currentRankings || []).map(r => r.candidate_id || r.id));
      setJobModalSelectedCandidateIds(candIds);
    } catch (_) {
      setJobModalSelectedCandidateIds(new Set());
    }
  };

  const handleSaveJobCandidates = async () => {
    if (!manageJobModal) return;
    setSavingJobCandidates(true);
    try {
      const companyId = user?.company_id || (await ensureCompanyForUser(user)) || user.id;
      const selectedIds = Array.from(jobModalSelectedCandidateIds);
      await rankingService.manuallyAssignCandidates(manageJobModal.id, selectedIds, companyId, user.id);
      showToast(`Updated candidate selection for "${manageJobModal.title}" (${selectedIds.length} candidate(s) selected).`);
      setManageJobModal(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save job candidates:', err);
      showToast(err.message || 'Failed to update job candidates.', 'warn');
    } finally {
      setSavingJobCandidates(false);
    }
  };

  const departments = useMemo(() => {
    const set = new Set(['all']);
    jobs.forEach(j => { if (j.department) set.add(j.department); });
    all.forEach(c => {
      if (c.job_department) set.add(c.job_department);
      if (c.matched_job_department) set.add(c.matched_job_department);
      if (c.department) set.add(c.department);
      if (c.industry) set.add(c.industry);
    });
    return Array.from(set);
  }, [jobs, all]);

  const targetJob = useMemo(() => {
    return (targetJobId && jobs.find(j => j.id === targetJobId)) || null;
  }, [targetJobId, jobs]);

  const batchMap = useMemo(() => {
    const map = {};
    (batches || []).forEach(b => {
      const bName = b.name || b.batch_name || `Batch ${String(b.id).slice(0, 6)}`;
      if (b.id) map[b.id] = bName;
    });
    (all || []).forEach(c => {
      const bId = c.batch_id || c.structured_data?.batch_id;
      const bName = c.batch_name || c.structured_data?.batch_name;
      if (bId && bName && !map[bId]) {
        map[bId] = bName;
      }
    });
    return map;
  }, [batches, all]);

  const effectiveBatchId = (!selectedBatchId || selectedBatchId === 'null' || selectedBatchId === 'undefined') ? 'all' : selectedBatchId;

  const evaluatedList = useMemo(() => {
    return all.map(c => {
      const bId = c.batch_id || c.structured_data?.batch_id || null;
      const bName = c.batch_name || (bId && batchMap[bId]) || c.structured_data?.batch_name || (c.structured_data?.batch_id && batchMap[c.structured_data.batch_id]) || null;

      // If a targetJob is selected, evaluate candidate against targetJob using canonical engine
      if (targetJob) {
        const scoreResult = calculateCandidateJobScore(c, targetJob);
        return {
          ...c,
          batch_id: bId,
          batch_name: bName,
          matched_job_id: targetJob.id,
          matched_job_title: targetJob.title,
          matched_job_department: targetJob.department,
          matched_job_created_at: targetJob.created_at,
          relevance_score: scoreResult.overall_score,
          similarity_score: scoreResult.similarity_score,
          skill_match_score: scoreResult.skill_match_score,
          isQualifying: scoreResult.isQualifying,
          decision: scoreResult.decision,
          system_decision: scoreResult.decision,
          decision_explanation: scoreResult.explanation,
          matched_reqs: scoreResult.matchedReqs,
          missing_reqs: scoreResult.missingReqs,
          matched_requirements: scoreResult.matched_requirements,
        };
      }
      const isQualifying = c.isQualifying !== undefined ? c.isQualifying : ((c.relevance_score || 0) >= 0.60);
      return {
        ...c,
        batch_id: bId,
        batch_name: bName,
        isQualifying,
        decision: c.decision || (isQualifying ? 'QUALIFIED' : 'NOT QUALIFIED'),
        system_decision: c.system_decision || (isQualifying ? 'QUALIFIED' : 'NOT QUALIFIED'),
        decision_explanation: c.decision_explanation || (isQualifying ? 'Meets qualification criteria (≥ 60% match)' : 'Match score below 60% threshold'),
      };
    });
  }, [all, targetJob, batchMap]);

  const filtered = useMemo(() => {
    let list = evaluatedList.filter(c => {
      const pct = c.relevance_score * 100;
      if (pct < minScore || pct > maxScore) return false;

      // Filter by Batch
      if (effectiveBatchId && effectiveBatchId !== 'all') {
        const effLower = String(effectiveBatchId).toLowerCase();
        const candBatchId = String(c.batch_id || c.structured_data?.batch_id || '').toLowerCase();
        const candBatchName = String(c.batch_name || c.structured_data?.batch_name || '').toLowerCase();
        const mappedName = String(batchMap[c.batch_id] || '').toLowerCase();
        const mappedEffName = String(batchMap[effectiveBatchId] || '').toLowerCase();
        const matchByBatch = candBatchId === effLower ||
                             candBatchName === effLower ||
                             mappedName === effLower ||
                             (mappedEffName && candBatchName === mappedEffName);
        // If a targetJobId is specified, also allow candidates specifically evaluated/assigned to targetJobId
        const matchByJob = targetJobId && (c.matched_job_id === targetJobId || c.job_id === targetJobId || (c.assigned_job_ids && c.assigned_job_ids.includes(targetJobId)));
        if (!matchByBatch && !matchByJob) return false;
      }

      // Filter by Job: If no batch filter is active, only show candidates assigned/matched to targetJobId
      if (targetJobId && (!effectiveBatchId || effectiveBatchId === 'all')) {
        const matchByJobId = c.matched_job_id === targetJobId || c.job_id === targetJobId || (c.assigned_job_ids && c.assigned_job_ids.includes(targetJobId));
        const matchByJobTitle = targetJob && c.matched_job_title && c.matched_job_title.toLowerCase() === targetJob.title?.toLowerCase();
        if (targetJob) {
          // Candidates are evaluated against targetJob in evaluatedList
        } else if (!matchByJobId && !matchByJobTitle) {
          return false;
        }
      }

      if (matchedOnly) {
        const hasScore = (c.relevance_score || 0) > 0 || (c.skill_match_score || 0) > 0;
        const hasSkills = (c.all_skills || []).length > 0;
        if (!hasScore && !hasSkills) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${c.name} ${c.candidate_code || ''} ${c.simple_id || ''} ${c.source_file_name || ''} ${c.matched_job_title || ''} ${c.email} ${c.all_skills?.join(' ')} ${c.education?.degree || ''} ${c.education?.institution || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (deptFilter !== 'all') {
        const targetDept = deptFilter.toLowerCase();
        const cDept = (c.job_department || c.matched_job_department || c.department || c.industry || c.matched_job_title || '').toLowerCase();
        if (!cDept.includes(targetDept)) return false;
      }

      return true;
    });

    if (sortBy === 'score') {
      list = [...list].sort((a, b) => b.relevance_score - a.relevance_score);
    } else if (sortBy === 'job_created_desc') {
      list = [...list].sort((a, b) => new Date(b.matched_job_created_at || b.created_at || 0) - new Date(a.matched_job_created_at || a.created_at || 0));
    } else if (sortBy === 'job_created_asc') {
      list = [...list].sort((a, b) => new Date(a.matched_job_created_at || a.created_at || 0) - new Date(b.matched_job_created_at || b.created_at || 0));
    } else if (sortBy === 'experience') {
      list = [...list].sort((a, b) => b.years_experience - a.years_experience);
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [evaluatedList, targetJob, targetJobId, effectiveBatchId, matchedOnly, search, minScore, maxScore, sortBy, deptFilter, batchMap]);

  const qualifyingCandidates = useMemo(() => {
    return filtered.filter(c => c.isQualifying && c.status !== 'rejected');
  }, [filtered]);

  const nonQualifyingCandidates = useMemo(() => {
    return filtered.filter(c => !c.isQualifying || c.status === 'rejected');
  }, [filtered]);

  const hiredCandidates = useMemo(() => {
    return filtered.filter(c => Boolean(c.is_hired || c.hired || c.structured_data?.hired));
  }, [filtered]);

  const displayedCandidates = useMemo(() => {
    if (qualificationTab === 'hired') return hiredCandidates;
    if (qualificationTab === 'qualifying') return qualifyingCandidates;
    if (qualificationTab === 'non_qualifying') return nonQualifyingCandidates;
    return filtered;
  }, [qualificationTab, hiredCandidates, qualifyingCandidates, nonQualifyingCandidates, filtered]);

  const totalPages = Math.max(1, Math.ceil(displayedCandidates.length / pageSize));
  const current = displayedCandidates.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = async (format = 'Excel') => {
    if (!filtered || filtered.length === 0) {
      showToast('No candidates available to export under active filters.', 'warn');
      return;
    }
    setExporting(true);
    try {
      const curJobTitle = targetJob?.title || (targetJobId ? (jobs.find(j => j.id === targetJobId)?.title || 'Target Job') : 'Candidate Rankings');
      const curBatchName = (effectiveBatchId !== 'all' && batchMap[effectiveBatchId]) ? batchMap[effectiveBatchId] : 'All Batches';
      const qualScope = qualificationTab === 'qualifying' ? 'qualifying' : qualificationTab === 'non_qualifying' ? 'non_qualifying' : 'all';

      const r = await reportService.generateReport({
        jobId: targetJobId || 'all',
        batchId: effectiveBatchId || 'all',
        batchName: curBatchName,
        qualification: qualScope,
        minScore,
        maxScore,
        search,
        format,
        jobTitle: curJobTitle,
        candidates: filtered,
        companyId: user?.company_id || user?.id,
        userId: user?.id,
      });

      if (r?.url) {
        const link = document.createElement('a');
        link.href = r.url;
        link.download = `report-${curJobTitle.replace(/[^a-zA-Z0-9]/g, '_')}.${format === 'PDF' ? 'html' : 'csv'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      showToast(`${format} report exported successfully for ${filtered.length} candidate(s)!`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export report: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const toggleShortlist = (id) => setShortlist(s => {
    const ns = new Set(s);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    return ns;
  });

  const toggleCompare = (id) => setCompare(s => {
    const ns = new Set(s);
    if (ns.has(id)) {
      ns.delete(id);
    } else {
      if (ns.size >= 4) {
        showToast('You can compare up to 4 candidates at once.', 'info');
        return ns;
      }
      ns.add(id);
    }
    return ns;
  });

  const renderCandidateCard = (c) => {
    const pct = Math.round((c.relevance_score || 0) * 100);
    const sc = scoreColorClass(pct);
    const sl = shortlist.has(c.id);
    const cmp = compare.has(c.id);
    const candCode = c.candidate_code || c.simple_id || ('CAND-' + (c.id ? String(c.id).split('-')[0].slice(0, 4).toUpperCase() : '1001'));
    const docName = c.source_file_name || (c.source_file ? String(c.source_file).split('/').pop() : 'CV_Document.pdf');
    const candBatchName = c.batch_name || (c.batch_id && batchMap[c.batch_id]) || (c.structured_data?.batch_name) || (c.structured_data?.batch_id && batchMap[c.structured_data.batch_id]) || null;

    const hasMatchingJob = c.matched_job_title && c.matched_job_title !== 'No matching job';
    const jobTitle = hasMatchingJob ? c.matched_job_title : 'No job assigned yet';
    const jobDept = c.matched_job_department || (hasMatchingJob ? 'General' : '—');
    const jobDate = c.matched_job_created_at ? new Date(c.matched_job_created_at).toLocaleDateString() : '—';

    return (
      <div key={c.id} className="candidate-card" style={{
        position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        border: c.isQualifying ? '1.5px solid rgba(46,125,50,0.35)' : '1.5px solid rgba(239,68,68,0.25)',
        boxShadow: c.isQualifying ? '0 4px 12px rgba(46,125,50,0.06)' : '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          position: 'absolute', top: '0.8rem', right: '0.8rem',
          display: 'flex', flexDirection: 'column', gap: '0.3rem', zIndex: 2
        }}>
          <button
            title={sl ? 'Remove from shortlist' : 'Shortlist candidate'}
            onClick={(e) => { e.stopPropagation(); toggleShortlist(c.id); }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              cursor: 'pointer', fontSize: '1rem',
              background: sl ? 'linear-gradient(135deg, #ffd700, #c9a84c)' : '#fff',
              color: sl ? '#1a237e' : 'var(--text-light)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            <FontAwesomeIcon icon="star" style={{ opacity: sl ? 1 : 0.35 }} />
          </button>
          <button
            title={cmp ? 'Remove from compare' : 'Add to compare (max 3)'}
            onClick={(e) => { e.stopPropagation(); toggleCompare(c.id); }}
            style={{
              width: 30, height: 30, borderRadius: 8, border: cmp ? '2px solid var(--primary-mid)' : '1px solid var(--border-color)',
              cursor: 'pointer', fontSize: '0.85rem',
              background: cmp ? 'var(--primary-50)' : '#fff',
              color: cmp ? 'var(--primary-dark)' : 'var(--text-light)',
            }}
          >
            {cmp ? <FontAwesomeIcon icon="square-check" /> : <FontAwesomeIcon icon="square" style={{ opacity: 0.4 }} />}
          </button>
        </div>

        <div>
          {/* Header Bar: Code + Batch + File & System Decision Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem', paddingRight: '2.5rem', gap: '0.4rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span className="badge badge-gold" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '0.72rem' }}>
                {candCode}
              </span>
              {candBatchName && (
                <span
                  className="badge"
                  title={`Batch: ${candBatchName}`}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'rgba(92,107,192,0.1)',
                    color: 'var(--primary-dark)',
                    border: '1px solid rgba(92,107,192,0.25)',
                    padding: '0.12rem 0.45rem',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FontAwesomeIcon icon="layer-group" style={{ color: 'var(--gold-mid)', fontSize: '0.66rem' }} />
                  {candBatchName}
                </span>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={docName}>
                <FontAwesomeIcon icon="file" style={{ marginRight: 4, color: 'var(--primary-light)' }} /> {docName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem', fontWeight: 800,
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#fff',
                    padding: '0.22rem 0.6rem',
                    borderRadius: 20,
                    boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title="Candidate was officially hired by Company Manager"
                >
                  <FontAwesomeIcon icon="trophy" style={{ color: '#ffd700', fontSize: '0.68rem' }} />
                  HIRED BY MANAGER
                </span>
              )}
              <span
                className={`badge ${c.isQualifying ? 'badge-success' : 'badge-danger'}`}
                style={{
                  fontSize: '0.68rem', fontWeight: 800,
                  background: c.isQualifying ? 'var(--success)' : '#fee2e2',
                  color: c.isQualifying ? '#fff' : '#b91c1c',
                  border: c.isQualifying ? 'none' : '1px solid #f87171',
                  padding: '0.2rem 0.5rem'
                }}
              >
                <FontAwesomeIcon icon={c.isQualifying ? "circle-check" : "circle-xmark"} style={{ marginRight: 4 }} />
                {c.isQualifying ? 'QUALIFIED / SELECTED' : 'NOT QUALIFIED'}
              </span>
            </div>
          </div>

          <div className="candidate-header" style={{ paddingRight: '2.5rem' }} onClick={() => setSelected(c)}>
            <div className="avatar avatar-lg avatar-gold">
              {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="candidate-info">
              <div className="candidate-name">{c.name}</div>
              <div className="candidate-title">{c.education?.degree || 'Candidate'}</div>
              <div className="candidate-meta" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <span><FontAwesomeIcon icon="graduation-cap" style={{ marginRight: 4 }} />{c.education?.institution || 'University'}</span>
                <span><FontAwesomeIcon icon="briefcase" style={{ marginRight: 4 }} />{c.years_experience} yrs</span>
                {candBatchName && (
                  <span title={`Batch: ${candBatchName}`} style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>
                    <FontAwesomeIcon icon="layer-group" style={{ marginRight: 4, color: 'var(--gold-mid)' }} />
                    {candBatchName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Manager Hired Notification Box on Card */}
          {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(5,150,105,0.06))',
              border: '1.5px solid rgba(16,185,129,0.4)',
              borderRadius: 10,
              padding: '0.55rem 0.8rem',
              margin: '0.55rem 0',
              fontSize: '0.76rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FontAwesomeIcon icon="circle-check" style={{ color: '#059669' }} />
                  Hired by Company Manager
                </span>
                {(c.hired_at || c.structured_data?.hired_at) && (
                  <span style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 600 }}>
                    {new Date(c.hired_at || c.structured_data?.hired_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {(c.hired_notes || c.structured_data?.hired_notes) && (
                <div style={{ color: '#065f46', marginTop: '0.2rem', fontSize: '0.72rem', fontStyle: 'italic' }}>
                  "{c.hired_notes || c.structured_data?.hired_notes}"
                </div>
              )}
            </div>
          )}

          {/* Single Matched Job Box */}
          {hasMatchingJob ? (
            <div style={{ background: 'linear-gradient(135deg, rgba(26,35,126,0.04), rgba(201,168,76,0.06))', border: '1.5px solid rgba(92,107,192,0.25)', borderRadius: 10, padding: '0.65rem 0.85rem', margin: '0.65rem 0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--gold-mid)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Single Matched Job
                </span>
                <span className="badge badge-gold" style={{ fontSize: '0.66rem', padding: '0.1rem 0.4rem' }}>
                  {c.matched_job_id ? '1-to-1 Match' : 'General Pool'}
                </span>
              </div>
              <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <FontAwesomeIcon icon="briefcase" style={{ color: 'var(--gold-mid)', marginRight: 5 }} />
                {jobTitle}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-gray)' }}>
                <span>Dept: <strong>{jobDept}</strong></span>
                <span>Created: <strong>{jobDate}</strong></span>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(200,200,200,0.1)',
              border: '1px dashed var(--border-color)',
              borderRadius: 10,
              padding: '0.65rem 0.85rem',
              margin: '0.65rem 0',
              fontSize: '0.8rem',
              color: 'var(--text-gray)',
              textAlign: 'center',
            }}>
              <FontAwesomeIcon icon="briefcase" style={{ marginRight: 6, opacity: 0.5 }} />
              No job assigned yet — select a job to rank this candidate.
            </div>
          )}

          {hasMatchingJob ? (
            <div className="candidate-score-section" onClick={() => setSelected(c)}>
              <div className={`score-ring ${sc}`} style={{ '--score': pct, width: 52, height: 52 }}>
                <div style={{ width: 40, height: 40, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                <div style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: '0.76rem', color: scoreTextColor(pct) }}>{pct}%</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.03em' }}>RELEVANCE SCORE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem', fontSize: '0.72rem', color: 'var(--text-gray)' }}>
                  <span>Semantic: <strong>{Math.round(c.similarity_score * 100)}%</strong></span>
                  <span>·</span>
                  <span>Skills: <strong>{Math.round(c.skill_match_score * 100)}%</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="candidate-score-section" onClick={() => setSelected(c)} style={{ opacity: 0.75 }}>
              <div className="score-ring score-low" style={{ '--score': 0, width: 52, height: 52 }}>
                <div style={{ width: 40, height: 40, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                <div style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: '0.74rem', color: 'var(--text-light)' }}>—</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.03em' }}>RELEVANCE SCORE</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)', marginTop: '0.15rem' }}>
                  Not Evaluated (Select a job to rank)
                </div>
              </div>
            </div>
          )}

          {/* System Decision Rationale / "Why" Block */}
          <div style={{
            background: c.isQualifying ? 'rgba(46,125,50,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1.5px solid ${c.isQualifying ? 'rgba(46,125,50,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: 9, padding: '0.6rem 0.75rem', margin: '0.6rem 0', fontSize: '0.76rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 800, color: c.isQualifying ? 'var(--success)' : 'var(--error)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.3px' }}>
                <FontAwesomeIcon icon={c.isQualifying ? "circle-check" : "circle-exclamation"} style={{ marginRight: 4 }} />
                System Decision: {c.isQualifying ? 'Criteria Satisfied' : 'Deficit / Disqualified'}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-gray)', fontWeight: 600 }}>
                Threshold: ≥ 60%
              </span>
            </div>
            <div style={{ color: 'var(--text-dark)', lineHeight: 1.45, fontWeight: 500 }}>
              <strong>Why:</strong> {c.decision_explanation || (c.isQualifying ? 'Candidate meets role qualification criteria with matching competencies.' : 'Candidate scored below the 60% qualification threshold or is missing required competencies.')}
            </div>
            {c.missing_reqs && c.missing_reqs.length > 0 && (
              <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--error)', fontWeight: 700 }}>Missing:</span>
                {c.missing_reqs.map(ms => (
                  <span key={ms} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.66rem', padding: '0.08rem 0.35rem', borderRadius: 4, fontWeight: 700 }}>
                    {ms}
                  </span>
                ))}
              </div>
            )}
            {c.matched_reqs && c.matched_reqs.length > 0 && (
              <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 700 }}>Matched:</span>
                {c.matched_reqs.map(ms => (
                  <span key={ms} style={{ background: 'rgba(46,125,50,0.12)', color: 'var(--success)', fontSize: '0.66rem', padding: '0.08rem 0.35rem', borderRadius: 4, fontWeight: 700 }}>
                    ✓ {ms}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="candidate-skills" style={{ marginTop: '0.5rem' }}>
            {c.all_skills?.slice(0, 4).map(s => <span key={s} className="tag" style={{ fontSize: '0.7rem' }}>{s}</span>)}
            {c.all_skills?.length > 4 && <span className="tag" style={{ fontSize: '0.7rem' }}>+{c.all_skills.length - 4}</span>}
          </div>
        </div>

        <div className="candidate-actions" style={{ marginTop: '0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-primary flex-1" onClick={() => setSelected(c)}>
            <FontAwesomeIcon icon="eye" style={{ marginRight: 6 }} />Details
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={(e) => { e.stopPropagation(); handleDownloadCV(c); }}
            title="Download Candidate CV"
          >
            <FontAwesomeIcon icon="download" />
          </button>
          <button
            className="btn btn-sm btn-outline-gold"
            onClick={(e) => { e.stopPropagation(); openAssignModal(c); }}
            title="Select / Assign this candidate to a created job"
          >
            <FontAwesomeIcon icon="user-plus" style={{ marginRight: 4 }} /> Assign
          </button>
          <button
            className={`btn btn-sm ${sl ? 'btn-gold' : 'btn-outline-primary'}`}
            onClick={() => toggleShortlist(c.id)}
            title={sl ? 'Shortlisted' : 'Add to Shortlist'}
          >
            <FontAwesomeIcon icon="star" style={{ opacity: sl ? 1 : 0.35 }} />
          </button>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner spinner-lg"></div>
    </div>
  );

  return (
    <RecruiterLayout
      user={user}
      title="Ranked Candidates"
      subtitle="Step 3: Comprehensive candidate match rankings and AI evaluation reports."
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/recruiter/upload-cvs" className="btn btn-outline-secondary btn-sm">
            <FontAwesomeIcon icon="arrow-left" style={{ marginRight: 4 }} /> Step 1: Upload CVs
          </Link>
          <Link to="/recruiter/upload-job" className="btn btn-outline-primary btn-sm">
            Step 2: Create Job
          </Link>
          <button
            className={compare.size > 0 ? "btn btn-gold btn-sm" : "btn btn-outline-secondary btn-sm"}
            onClick={() => {
              if (compare.size === 0) {
                showToast('Select candidates using the compare checkbox on their cards to compare them.', 'info');
              } else {
                setShowCompareModal(true);
              }
            }}
            style={{ fontWeight: compare.size > 0 ? 700 : 500 }}
            title={compare.size > 0 ? `Compare ${compare.size} selected candidate(s) side-by-side` : "Select candidate cards to compare"}
          >
            <FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} />
            Compare {compare.size > 0 ? `(${compare.size})` : ''}
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleExport('Excel')}
            disabled={exporting || filtered.length === 0}
            title="Export real-score CSV report matching current filters"
          >
            {exporting ? <span className="spinner spinner-sm" style={{ marginRight: 4 }}></span> : <FontAwesomeIcon icon="arrow-up-from-bracket" style={{ marginRight: 6 }} />}
            Export CSV
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleExport('PDF')}
            disabled={exporting || filtered.length === 0}
            title="Download printable branded PDF/HTML report"
          >
            {exporting ? <span className="spinner spinner-sm" style={{ marginRight: 4 }}></span> : <FontAwesomeIcon icon="file-pdf" style={{ marginRight: 6 }} />}
            Export PDF
          </button>
          <Link
            to={`/recruiter/reports?jobId=${targetJobId || ''}&batchId=${effectiveBatchId || 'all'}&qualification=${qualificationTab}&minScore=${minScore}&maxScore=${maxScore}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className="btn btn-gold btn-sm"
            title="Open comprehensive Reports Generator with these active filters"
          >
            <FontAwesomeIcon icon="chart-line" style={{ marginRight: 6 }} /> Full Reports Hub
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
              Step 3 of 3: Candidate Relevance Rankings & Evaluations
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              1. Upload CVs
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              2. Create Job Description
            </span>
            <FontAwesomeIcon icon="chevron-right" style={{ fontSize: '0.75rem', opacity: 0.5 }} />
            <span className="badge badge-gold" style={{ padding: '0.35rem 0.75rem', fontWeight: 800 }}>
              3. Rank Candidates (Active)
            </span>
          </div>
        </div>
      </div>
      {/* Active Filter Banner */}
      {(targetJobId || targetBatchId || matchedOnly) && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(26,35,126,0.08), rgba(92,107,192,0.04))',
          border: '1.5px solid rgba(92,107,192,0.25)', borderRadius: 12, padding: '0.85rem 1.2rem',
          marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FontAwesomeIcon icon="filter" style={{ color: 'var(--gold-mid)', fontSize: '1.1rem' }} />
            <div>
              <strong style={{ color: 'var(--primary-dark)', fontSize: '0.92rem' }}>
                Filtered Candidate View Active:
              </strong>{' '}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                {targetJobId && `Job: "${jobs.find(j => j.id === targetJobId)?.title || targetJobId}" `}
                {targetBatchId && `| Target Batch: "${batchMap[targetBatchId] || targetBatchId}" `}
                {matchedOnly && `| Matched Candidates Only `}
                ({filtered.length} candidate{filtered.length === 1 ? '' : 's'})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {targetJobId && (
              <button
                className="btn btn-gold btn-sm"
                onClick={() => openManageCandidatesModalForJob(targetJobId)}
                style={{ fontWeight: 700 }}
              >
                <FontAwesomeIcon icon="user-gear" style={{ marginRight: 6 }} /> Manage / Select Candidates for this Job
              </button>
            )}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSearchParams({})}
            >
              <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Clear Filter / Show All
            </button>
          </div>
        </div>
      )}

      {/* AI Decision & Qualification Breakdown Banner */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, rgba(26,35,126,0.06), rgba(201,168,76,0.06))',
        border: '1.5px solid rgba(92,107,192,0.25)', borderRadius: 14, padding: '1rem 1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary-mid)', fontWeight: 800 }}>
              AI Recruitment Evaluation & Decision System
            </div>
            <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1.1rem', marginTop: '0.15rem' }}>
              Candidate Batch Qualification & Selection Decisions
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-gray)', marginTop: '0.2rem' }}>
              Evaluation threshold: <strong>≥ 60% relevance match & required skill fulfillment</strong>. Candidates are automatically categorized with system rationale on why they qualified or did not qualify.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              onClick={() => { setQualificationTab('hired'); setPage(1); }}
              style={{
                background: qualificationTab === 'hired' ? '#ecfdf5' : '#fff',
                border: '1.5px solid #10b981',
                borderRadius: 10,
                padding: '0.5rem 0.85rem',
                textAlign: 'center',
                minWidth: 105,
                cursor: 'pointer',
                boxShadow: qualificationTab === 'hired' ? '0 0 0 2px #059669' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Click to view candidates hired by the company manager"
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>🎉 HIRED</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>{hiredCandidates.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>By Manager</div>
            </div>
            <div
              onClick={() => { setQualificationTab('qualifying'); setPage(1); }}
              style={{
                background: qualificationTab === 'qualifying' ? 'rgba(46,125,50,0.08)' : '#fff',
                border: '1.5px solid rgba(46,125,50,0.3)',
                borderRadius: 10,
                padding: '0.5rem 0.85rem',
                textAlign: 'center',
                minWidth: 105,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase' }}>QUALIFYING</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)' }}>{qualifyingCandidates.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>Selected / Passed</div>
            </div>
            <div
              onClick={() => { setQualificationTab('non_qualifying'); setPage(1); }}
              style={{
                background: qualificationTab === 'non_qualifying' ? 'rgba(239,68,68,0.08)' : '#fff',
                border: '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                padding: '0.5rem 0.85rem',
                textAlign: 'center',
                minWidth: 115,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--error)', textTransform: 'uppercase' }}>NON-QUALIFYING</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--error)' }}>{nonQualifyingCandidates.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>Deficit / Disqualified</div>
            </div>
            <div
              onClick={() => { setQualificationTab('split'); setPage(1); }}
              style={{
                background: qualificationTab === 'split' ? 'rgba(26,35,126,0.06)' : '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '0.5rem 0.85rem',
                textAlign: 'center',
                minWidth: 95,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase' }}>TOTAL POOL</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{filtered.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-gray)' }}>In Active Filter</div>
            </div>
          </div>
        </div>

        {/* Qualification Group Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px dashed rgba(92,107,192,0.2)', paddingTop: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-light)', marginRight: 4 }}>Group View:</span>
          <button
            className={`btn btn-xs ${qualificationTab === 'split' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => { setQualificationTab('split'); setPage(1); }}
            style={{ fontWeight: 700, padding: '0.35rem 0.75rem' }}
          >
            <FontAwesomeIcon icon="table-columns" style={{ marginRight: 5 }} /> Separated Groups (Qualifying vs Non-Qualifying)
          </button>
          <button
            className={`btn btn-xs ${qualificationTab === 'hired' ? 'btn-success' : 'btn-outline-secondary'}`}
            onClick={() => { setQualificationTab('hired'); setPage(1); }}
            style={{ fontWeight: 700, padding: '0.35rem 0.75rem', ...(qualificationTab === 'hired' ? { background: '#059669', borderColor: '#059669', color: '#fff' } : {}) }}
          >
            <FontAwesomeIcon icon="trophy" style={{ marginRight: 5, color: qualificationTab === 'hired' ? '#ffd700' : '#059669' }} /> Hired by Manager ({hiredCandidates.length})
          </button>
          <button
            className={`btn btn-xs ${qualificationTab === 'qualifying' ? 'btn-gold' : 'btn-outline-secondary'}`}
            onClick={() => { setQualificationTab('qualifying'); setPage(1); }}
            style={{ fontWeight: 700, padding: '0.35rem 0.75rem' }}
          >
            <FontAwesomeIcon icon="circle-check" style={{ marginRight: 5, color: 'var(--success)' }} /> Qualifying Only ({qualifyingCandidates.length})
          </button>
          <button
            className={`btn btn-xs ${qualificationTab === 'non_qualifying' ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={() => { setQualificationTab('non_qualifying'); setPage(1); }}
            style={{ fontWeight: 700, padding: '0.35rem 0.75rem' }}
          >
            <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 5 }} /> Non-Qualifying Only ({nonQualifyingCandidates.length})
          </button>
          <button
            className={`btn btn-xs ${qualificationTab === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`}
            onClick={() => { setQualificationTab('all'); setPage(1); }}
            style={{ fontWeight: 700, padding: '0.35rem 0.75rem' }}
          >
            <FontAwesomeIcon icon="list" style={{ marginRight: 5 }} /> All Candidates ({filtered.length})
          </button>
        </div>
      </div>

      {/* Filter Bar with Batch Filter */}
      <div className="filter-bar">
        <div className="grid-4" style={{ gridTemplateColumns: '1.8fr 1.2fr 1.1fr 1.1fr 1fr auto', gap: '0.8rem', alignItems: 'end' }}>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 6 }} />Search</div>
            <input
              type="search"
              placeholder="Search candidate code, name, skills..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="layer-group" style={{ marginRight: 6 }} />Batch Filter</div>
            <select
              value={effectiveBatchId}
              onChange={e => {
                const val = e.target.value;
                setSelectedBatchId(val);
                setPage(1);
                const nextParams = new URLSearchParams(searchParams);
                if (val !== 'all') nextParams.set('batchId', val);
                else nextParams.delete('batchId');
                setSearchParams(nextParams);
              }}
              style={{ fontWeight: 600, color: 'var(--primary-dark)' }}
            >
              <option value="all">All Batches (Candidate Pool)</option>
              {batches.map(b => {
                const count = (all || []).filter(c => String(c.batch_id || c.structured_data?.batch_id || '') === String(b.id)).length;
                return (
                  <option key={b.id} value={b.id}>
                    {b.name || b.batch_name || `Batch ${String(b.id).slice(0, 8)}`} ({count || b.file_count || b.count || b.total_resumes || 0} CVs)
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <div className="filter-label"><FontAwesomeIcon icon="building" style={{ marginRight: 6 }} />Department</div>
            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
              {departments.map(d => (
                <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="filter-label">Sort By</div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="score">Relevance Score</option>
              <option value="job_created_desc">Job Created Date (Newest)</option>
              <option value="job_created_asc">Job Created Date (Oldest)</option>
              <option value="experience">Years Experience</option>
              <option value="name">Candidate Name</option>
            </select>
          </div>
          <div>
            <div className="filter-label">Score Range</div>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="number" min="0" max="100" value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ width: '100%' }} />
              <span style={{ fontSize: '0.8rem' }}>-</span>
              <input type="number" min="0" max="100" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button className={`btn btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('cards')} title="Card Grid View">
                <FontAwesomeIcon icon="table-cells-large" />
              </button>
              <button className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('table')} title="Detailed Table View">
                <FontAwesomeIcon icon="list" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', fontSize: '0.85rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div>
          Showing <strong style={{ color: 'var(--primary-dark)' }}>{current.length}</strong> of{' '}
          <strong style={{ color: 'var(--primary-dark)' }}>{filtered.length}</strong> candidates
          {shortlist.size > 0 && <span className="badge badge-gold ml-2" style={{ marginLeft: 8 }}><FontAwesomeIcon icon="star" style={{ marginRight: 6 }} />{shortlist.size} shortlisted</span>}
          {compare.size > 0 && (
            <button
              className="badge badge-primary ml-2"
              style={{
                marginLeft: 8,
                cursor: 'pointer',
                border: 'none',
                padding: '0.35rem 0.65rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 700,
                background: 'var(--primary-mid)',
                color: '#fff',
                fontSize: '0.78rem',
              }}
              onClick={() => setShowCompareModal(true)}
              title="Click to view candidate comparison side-by-side"
            >
              <FontAwesomeIcon icon="chart-bar" />
              <span>Compare ({compare.size})</span>
            </button>
          )}
        </div>
        <div>
          {search && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setSearch('')}>Clear Search</button>
          )}
        </div>
      </div>

      {/* Candidate list */}
      {current.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 1rem' }}>
          <div style={{ fontSize: 48, color: 'var(--text-light)', marginBottom: '0.5rem' }}>
            <FontAwesomeIcon icon={all.length === 0 ? "user-plus" : "magnifying-glass"} />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', color: 'var(--primary-dark)' }}>
            {all.length === 0 ? 'No Candidates Found Yet' : 'No candidates match your filters'}
          </h3>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-gray)', maxWidth: 500, margin: '0 auto 1.25rem' }}>
            {all.length === 0
              ? 'Upload candidate CVs and create a job description to rank candidate relevance automatically.'
              : 'Try widening the score range, removing the search term, or adjusting the department.'}
          </p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            {all.length === 0 ? (
              <>
                <Link to="/recruiter/upload-cvs" className="btn btn-primary">
                  <FontAwesomeIcon icon="file-arrow-up" style={{ marginRight: 6 }} /> Upload CVs First
                </Link>
                <Link to="/recruiter/upload-job" className="btn btn-gold">
                  <FontAwesomeIcon icon="file-lines" style={{ marginRight: 6 }} /> Create Job Description
                </Link>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => { setSearch(''); setMinScore(0); setMaxScore(100); setDeptFilter('all'); setPage(1); }}>
                <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} /> Reset All Filters
              </button>
            )}
          </div>
        </div>
      ) : view === 'cards' ? (
        qualificationTab === 'split' ? (
          <div>
            {/* 1. Qualifying Candidates Section */}
            {qualifyingCandidates.length > 0 && (
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, rgba(46,125,50,0.1), rgba(46,125,50,0.02))',
                  border: '1.5px solid rgba(46,125,50,0.3)', borderRadius: 12, padding: '0.75rem 1.15rem',
                  marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', fontWeight: 800 }}>
                      <FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Qualifying Candidates ({qualifyingCandidates.length})
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
                      System Decision: <strong style={{ color: 'var(--success)' }}>SELECTED / PASSED (Relevance ≥ 60%)</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Selected candidates meet or exceed all core role requirements
                  </span>
                </div>
                <div className="grid-3" style={{ gap: '1rem' }}>
                  {qualifyingCandidates.map(c => renderCandidateCard(c))}
                </div>
              </div>
            )}

            {/* 2. Non-Qualifying Candidates Section */}
            {nonQualifyingCandidates.length > 0 && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
                  border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '0.75rem 1.15rem',
                  marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }}>
                      <FontAwesomeIcon icon="circle-xmark" style={{ marginRight: 6 }} /> Non-Qualifying Candidates ({nonQualifyingCandidates.length})
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
                      System Decision: <strong style={{ color: 'var(--error)' }}>NOT QUALIFIED / DEFICIT (Under 60% Threshold or Missing Skills)</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Disqualification explanations and missing requirements are detailed on each card
                  </span>
                </div>
                <div className="grid-3" style={{ gap: '1rem' }}>
                  {nonQualifyingCandidates.map(c => renderCandidateCard(c))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid-3" style={{ gap: '1rem' }}>
            {current.map(c => renderCandidateCard(c))}
          </div>
        )
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Candidate</th>
                <th>Matched Job</th>
                <th>Score</th>
                <th>System Decision</th>
                <th>Decision Rationale (Why)</th>
                <th>Experience</th>
                <th>Top Skills</th>
                <th>OCR</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {current.map(c => {
                const hasMatchingJob = c.matched_job_title && c.matched_job_title !== 'No matching job';
                const pct = hasMatchingJob ? Math.round(c.relevance_score * 100) : 0;
                const sc = scoreColorClass(pct);
                const jobTitle = hasMatchingJob ? c.matched_job_title : 'No job assigned yet';
                const jobDate = c.matched_job_created_at ? new Date(c.matched_job_created_at).toLocaleDateString() : '—';
                const candBatchName = c.batch_name || (c.batch_id && batchMap[c.batch_id]) || (c.structured_data?.batch_name) || (c.structured_data?.batch_id && batchMap[c.structured_data.batch_id]) || null;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={compare.has(c.id)}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleCompare(c.id)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div className="avatar avatar-sm avatar-gold">
                          {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{c.name}</span>
                            {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                  color: '#fff',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: 12,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                                title="Candidate hired by Company Manager"
                              >
                                <FontAwesomeIcon icon="trophy" style={{ color: '#ffd700', fontSize: '0.62rem' }} />
                                HIRED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>{c.email}</div>
                          {candBatchName && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--primary-mid)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <FontAwesomeIcon icon="layer-group" style={{ color: 'var(--gold-mid)', fontSize: '0.65rem' }} />
                              {candBatchName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: hasMatchingJob ? 'var(--primary-dark)' : 'var(--text-gray)', fontSize: '0.86rem' }}>
                        <FontAwesomeIcon icon="briefcase" style={{ color: hasMatchingJob ? 'var(--gold-mid)' : 'var(--text-light)', marginRight: 5 }} />
                        {jobTitle}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)' }}>
                        {hasMatchingJob ? (c.job_department || c.matched_job_department || 'General') : '—'} · {jobDate}
                      </div>
                    </td>
                    <td>
                      {hasMatchingJob ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className={`score-ring ${sc}`} style={{ '--score': pct, width: 36, height: 36 }}>
                            <div style={{ width: 28, height: 28, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                            <div style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: '0.6rem', color: scoreTextColor(pct) }}>{pct}%</div>
                          </div>
                        </div>
                      ) : (
                        <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                          Unranked
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
                          <span className="badge" style={{
                            fontSize: '0.65rem', fontWeight: 800,
                            background: '#059669', color: '#fff',
                            padding: '0.15rem 0.45rem', borderRadius: 12,
                            display: 'inline-flex', alignItems: 'center', gap: 3
                          }}>
                            🎉 HIRED BY MANAGER
                          </span>
                        )}
                        <span className={`badge ${c.isQualifying ? 'badge-success' : 'badge-danger'}`} style={{
                          fontSize: '0.72rem', fontWeight: 800,
                          background: c.isQualifying ? 'var(--success)' : '#fee2e2',
                          color: c.isQualifying ? '#fff' : '#b91c1c',
                          border: c.isQualifying ? 'none' : '1px solid #f87171'
                        }}>
                          {c.isQualifying ? 'QUALIFIED' : 'NOT QUALIFIED'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', maxWidth: 280, lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 700, color: c.isQualifying ? 'var(--success)' : 'var(--error)' }}>
                        {c.isQualifying ? 'Criteria Met' : 'Deficit / Disqualified'}
                      </div>
                      <div style={{ color: 'var(--text-gray)' }}>{c.decision_explanation}</div>
                    </td>

                    <td style={{ fontSize: '0.85rem' }}>{c.years_experience} yrs</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {c.all_skills?.slice(0, 3).map(s => <span key={s} className="tag tag-gold" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>{s}</span>)}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${(c.ocr_confidence || 0) >= 0.9 ? 'badge-success' : 'badge-warning'}`}>
                        {Math.round((c.ocr_confidence || 0) * 100)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm btn-outline-primary" style={{ marginRight: 4 }} onClick={e => { e.stopPropagation(); setSelected(c); }}>View</button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        style={{ marginRight: 4 }}
                        onClick={e => { e.stopPropagation(); handleDownloadCV(c); }}
                        title="Download Candidate CV"
                      >
                        <FontAwesomeIcon icon="download" />
                      </button>
                      <button className="btn btn-sm btn-outline-gold" onClick={e => { e.stopPropagation(); openAssignModal(c); }}>
                        <FontAwesomeIcon icon="user-plus" style={{ marginRight: 4 }} /> Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {filtered.length} candidates
            </div>
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >‹ Prev</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                );
              })}
              <button
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next ›</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CandidateModal
          candidate={selected}
          onClose={() => setSelected(null)}
          shortlisted={shortlist.has(selected.id)}
          onToggleShortlist={toggleShortlist}
          isCompared={compare.has(selected.id)}
          onToggleCompare={toggleCompare}
          onOpenCompare={() => { setSelected(null); setShowCompareModal(true); }}
          batches={batches}
          onOpenAssignModal={(cand) => { setAssignCandidateModal(cand); setSelectedAssignJobId(jobs[0]?.id || ''); }}
          onDownloadCV={handleDownloadCV}
        />
      )}

      {/* Side-by-Side Candidate Comparison Modal */}
      {showCompareModal && compare.size > 0 && (
        <CompareModal
          compareIds={compare}
          candidates={evaluatedList}
          onClose={() => setShowCompareModal(false)}
          onRemove={(id) => {
            setCompare(prev => {
              const next = new Set(prev);
              next.delete(id);
              if (next.size === 0) setShowCompareModal(false);
              return next;
            });
          }}
          onClear={() => {
            setCompare(new Set());
            setShowCompareModal(false);
          }}
          shortlist={shortlist}
          onToggleShortlist={toggleShortlist}
          onSelectCandidate={(cand) => setSelected(cand)}
          onDownloadCV={handleDownloadCV}
          targetJob={targetJob}
          batchMap={batchMap}
        />
      )}

      {/* ASSIGN CANDIDATE TO JOB MODAL */}
      {assignCandidateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,18,42,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1.5rem'
        }}>
          <div className="card" style={{ maxWidth: 520, width: '100%', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div className="card-header" style={{ background: 'var(--primary-dark)', color: '#fff', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gold-mid)', fontWeight: 800 }}>
                  Manual Candidate Selection
                </div>
                <h3 style={{ fontSize: '1.15rem', margin: '0.2rem 0 0', color: '#fff' }}>
                  Select Candidate for Created Job
                </h3>
              </div>
              <button
                onClick={() => setAssignCandidateModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
                disabled={assigningToJob}
              >
                &times;
              </button>
            </div>

            <div className="card-body" style={{ padding: '1.5rem' }}>
              <div style={{ background: 'rgba(26,35,126,0.04)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.2rem', border: '1px solid rgba(92,107,192,0.15)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 700 }}>Candidate:</div>
                <div style={{ fontWeight: 800, color: 'var(--primary-dark)', fontSize: '1rem' }}>{assignCandidateModal.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>{assignCandidateModal.email} · {assignCandidateModal.years_experience} yrs exp</div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>
                  Target Created Job Description:
                </label>
                {jobs.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                    No jobs created yet. Please create a job description first.
                  </div>
                ) : (
                  <select
                    value={selectedAssignJobId}
                    onChange={e => setSelectedAssignJobId(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid var(--border-color)', fontWeight: 600 }}
                  >
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.department || 'General'})
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.5rem' }}>
                  Assigning this candidate will compute semantic match & skill overlap for this job profile.
                </div>
              </div>
            </div>

            <div style={{ background: '#f5f7fa', borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px' }}>
              <button className="btn btn-outline-secondary" onClick={() => setAssignCandidateModal(null)} disabled={assigningToJob}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleAssignCandidateToJob}
                disabled={assigningToJob || jobs.length === 0 || !selectedAssignJobId}
                style={{ fontWeight: 800 }}
              >
                {assigningToJob ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Assigning & Ranking...</>
                ) : (
                  <><FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Confirm Selection & Rank</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE JOB CANDIDATES MODAL (FOR FILTERED JOB VIEW) */}
      {manageJobModal && (
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
                  Candidate Management for Job
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', margin: '0.2rem 0 0', color: '#fff' }}>
                  Select Candidates for "{manageJobModal.title}"
                </h3>
              </div>
              <button
                onClick={() => setManageJobModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
                disabled={savingJobCandidates}
              >
                &times;
              </button>
            </div>

            <div className="card-body" style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                  Check candidate CVs to include in this job created.
                </div>
                <span className="badge badge-gold" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem', fontWeight: 800 }}>
                  {jobModalSelectedCandidateIds.size} of {all.length} Selected
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search candidates by name, email, skills..."
                  value={jobModalSearch}
                  onChange={e => setJobModalSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 220, fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    const filteredList = all.filter(c => {
                      if (!jobModalSearch.trim()) return true;
                      const q = jobModalSearch.toLowerCase();
                      return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.all_skills || []).join(' ').toLowerCase().includes(q);
                    });
                    setJobModalSelectedCandidateIds(prev => {
                      const next = new Set(prev);
                      filteredList.forEach(c => next.add(c.id));
                      return next;
                    });
                  }}
                >
                  <FontAwesomeIcon icon="check-double" style={{ marginRight: 4 }} /> Select Filtered
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setJobModalSelectedCandidateIds(new Set())}
                  disabled={jobModalSelectedCandidateIds.size === 0}
                >
                  <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} /> Clear All
                </button>
              </div>

              <div style={{
                maxHeight: 320, overflowY: 'auto', border: '1.5px solid var(--border-color)',
                borderRadius: 12, background: '#fff', padding: '0.4rem'
              }}>
                {all.filter(c => {
                  if (!jobModalSearch.trim()) return true;
                  const q = jobModalSearch.toLowerCase();
                  return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.all_skills || []).join(' ').toLowerCase().includes(q);
                }).map(cand => {
                  const isSelected = jobModalSelectedCandidateIds.has(cand.id);
                  const candCode = cand.candidate_code || cand.simple_id || ('CAND-' + String(cand.id).slice(0, 4).toUpperCase());
                  const skills = (cand.all_skills || []).slice(0, 4);
                  return (
                    <div
                      key={cand.id}
                      onClick={() => {
                        setJobModalSelectedCandidateIds(prev => {
                          const next = new Set(prev);
                          if (next.has(cand.id)) next.delete(cand.id);
                          else next.add(cand.id);
                          return next;
                        });
                      }}
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
                          onChange={() => {}}
                          style={{ width: 18, height: 18, accentColor: 'var(--primary-dark)', cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <strong style={{ color: 'var(--primary-dark)', fontSize: '0.9rem' }}>{cand.name}</strong>
                            <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '0.08rem 0.4rem' }}>{candCode}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginTop: '0.15rem' }}>
                            {cand.email} · {cand.years_experience || 0} yrs experience
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
                })}
              </div>
            </div>

            <div style={{ background: '#f5f7fa', borderTop: '1px solid var(--border-color)', padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px' }}>
              <button className="btn btn-outline-secondary" onClick={() => setManageJobModal(null)} disabled={savingJobCandidates}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleSaveJobCandidates}
                disabled={savingJobCandidates}
                style={{ fontWeight: 800, minWidth: 200 }}
              >
                {savingJobCandidates ? (
                  <><span className="spinner spinner-sm spinner-gold"></span> Saving & Ranking...</>
                ) : (
                  <><FontAwesomeIcon icon="circle-check" style={{ marginRight: 6 }} /> Save & Rank {jobModalSelectedCandidateIds.size} Candidates</>
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

export default RankedCandidates;