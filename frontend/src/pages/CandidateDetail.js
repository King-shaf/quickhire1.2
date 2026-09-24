import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rankingService } from '../services/supabaseService';
import { downloadCandidateCV } from '../utils/cvDownloader';

const CandidateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        const res = await rankingService.getCandidate(id);
        setCandidate(res.data);
      } catch (err) {
        console.error("Failed to fetch candidate", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidate();
  }, [id]);

  const handleDownload = async () => {
    if (!candidate) return;
    try {
      setDownloading(true);
      await downloadCandidateCV(candidate);
    } catch (err) {
      alert('Failed to download CV: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border" role="status"></div></div>;
  if (!candidate) return <div className="alert alert-danger mt-5">Candidate not found</div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button onClick={() => navigate(-1)} className="btn btn-outline-secondary shadow-sm">&larr; Back to Rankings</button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn btn-primary shadow-sm"
          title="Download Candidate CV (Original file or verified dossier)"
        >
          {downloading ? (
            <span>Downloading...</span>
          ) : (
            <span><i className="bi bi-download me-2"></i>Download CV</span>
          )}
        </button>
      </div>
      
      <div className="card shadow border-0 overflow-hidden">
        <div className="card-header bg-primary text-white py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0 fw-bold">{candidate.name}</h2>
            <span className="badge bg-light text-primary px-3 py-2 rounded-pill shadow-sm fs-6">
              quickhire AI Analyzed
            </span>
          </div>
        </div>
        
        <div className="card-body p-4">
          <div className="row g-4 mb-5">
            <div className="col-md-7">
              <h4 className="border-bottom pb-2 mb-3 text-primary"><i className="bi bi-person-badge me-2"></i>Contact Information</h4>
              <div className="row">
                <div className="col-sm-6 mb-3">
                  <div className="text-muted small">Email Address</div>
                  <div className="fw-bold fs-5 text-break">{candidate.email || 'N/A'}</div>
                </div>
                <div className="col-sm-6 mb-3">
                  <div className="text-muted small">Phone Number</div>
                  <div className="fw-bold fs-5">{candidate.phone || 'N/A'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Experience Level</div>
                  <div className="fw-bold fs-5 text-success">{candidate.structured_data?.total_experience_years || 0} Years</div>
                </div>
              </div>
            </div>
            
            <div className="col-md-5">
              <h4 className="border-bottom pb-2 mb-3 text-primary"><i className="bi bi-gear-fill me-2"></i>Core Skills</h4>
              <div className="d-flex flex-wrap gap-2">
                {candidate.skills?.length > 0 ? (
                  candidate.skills.map(skill => (
                    <span key={skill.id} className="badge bg-info bg-gradient text-dark px-3 py-2 fs-6 shadow-sm border border-white">
                      {skill.name}
                    </span>
                  ))
                ) : (
                  <span className="text-muted fst-italic">No skills extracted</span>
                )}
              </div>
            </div>
          </div>
          
          {candidate.structured_data?.gemini_analysis?.summary && (
            <div className="mb-5 p-4 bg-light rounded-3 border-start border-primary border-4 shadow-sm">
              <h4 className="text-primary mb-3 fw-bold">AI Professional Summary</h4>
              <p className="lead mb-0 text-dark" style={{ lineHeight: '1.6' }}>
                {candidate.structured_data.gemini_analysis.summary}
              </p>
            </div>
          )}

          <div className="row g-4">
            <div className="col-md-6">
              <div className="card h-100 border-0 shadow-sm bg-light">
                <div className="card-body">
                  <h4 className="text-primary border-bottom pb-2 mb-3"><i className="bi bi-briefcase-fill me-2"></i>Work Experience</h4>
                  <div className="list-group list-group-flush bg-transparent">
                    {(candidate.structured_data?.experience || candidate.structured_data?.gemini_analysis?.experience)?.length > 0 ? (
                      (candidate.structured_data?.experience || candidate.structured_data?.gemini_analysis?.experience).map((exp, i) => (
                        <div key={i} className="list-group-item bg-transparent px-0 py-3 border-bottom border-light">
                          <div className="fw-bold fs-5 text-dark">{exp.title}</div>
                          <div className="text-primary fw-bold mb-1">{exp.company}</div>
                          <div className="small text-muted bg-white d-inline-block px-2 py-1 rounded border mb-2">{exp.duration}</div>
                          <div className="text-muted small" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{exp.description}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted fst-italic p-3">No work experience details extracted from CV.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100 border-0 shadow-sm bg-light">
                <div className="card-body">
                  <h4 className="text-primary border-bottom pb-2 mb-3"><i className="bi bi-mortarboard-fill me-2"></i>Education</h4>
                  <div className="list-group list-group-flush bg-transparent">
                    {(candidate.structured_data?.education || candidate.structured_data?.gemini_analysis?.education)?.length > 0 ? (
                      (candidate.structured_data?.education || candidate.structured_data?.gemini_analysis?.education).map((edu, i) => (
                        <div key={i} className="list-group-item bg-transparent px-0 py-3 border-bottom border-light">
                          <div className="fw-bold fs-5 text-dark">{edu.degree}</div>
                          <div className="text-primary fw-bold mb-1">{edu.institution}</div>
                          <div className="small text-muted bg-white d-inline-block px-2 py-1 rounded border">{edu.year}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted fst-italic p-3">No education details extracted from CV.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-top">
            <h4 className="text-muted mb-3"><i className="bi bi-file-earmark-text me-2"></i>Full CV Content</h4>
            <div className="bg-dark text-light p-4 rounded-3 shadow-inner" style={{ maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.9rem', fontFamily: 'monospace' }}>
              {candidate.raw_text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetail;
