import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { rankingService, reportService } from '../services/supabaseService';

const RankingList = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const fetchRankings = async () => {
    try {
      const res = await rankingService.getRankings(jobId);
      setRankings(res);
    } catch (err) {
      console.error("Failed to fetch rankings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [jobId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await reportService.generateReport({
        jobId,
        format: 'PDF',
        jobTitle: 'Candidate Rankings',
      });
      if (r?.url) {
        const link = document.createElement('a');
        link.href = r.url;
        link.download = `report-rankings-${jobId}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to generate report: " + (err.message || 'Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRankings();
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleCandidateSelection = (candidateId) => {
    setSelectedCandidates(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      }
      return [...prev, candidateId];
    });
  };

  if (loading) return (
    <div className="text-center mt-5 p-5">
      <div className="spinner-border text-primary" role="status"></div>
      <p className="mt-3 text-muted">Loading candidate rankings...</p>
    </div>
  );

  return (
    <div className="container py-4">
      <button onClick={() => navigate(-1)} className="btn btn-outline-secondary mb-3">&larr; Back</button>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold mb-0">Candidate Rankings</h1>
          <p className="text-muted">Top matches for this job description</p>
        </div>
        <div className="d-flex gap-2">
          {selectedCandidates.length >= 2 && (
            <button 
              className="btn btn-info fw-bold" 
              onClick={() => setShowComparison(true)}
            >
              <FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} /> Compare ({selectedCandidates.length})
            </button>
          )}
          <button 
            className="btn btn-outline-primary fw-bold" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? <span className="spinner-border spinner-border-sm me-2"></span> : <><FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} /></>} Refresh
          </button>
          <button 
            className="btn btn-success fw-bold" 
            onClick={handleExport}
            disabled={exporting || rankings.length === 0}
          >
            {exporting ? <span className="spinner-border spinner-border-sm me-2"></span> : <FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} />} Export Report
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th className="px-4 py-3">Select</th>
                <th className="px-4 py-3">Rank</th>
                <th>Candidate & CV Summary</th>
                <th>Overall Score</th>
                <th>Match Details</th>
                <th className="text-end px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((res) => (
                <tr key={res.id}>
                  <td className="px-4">
                    <input 
                      type="checkbox" 
                      checked={selectedCandidates.includes(res.candidate_id || res.id)} 
                      onChange={() => toggleCandidateSelection(res.candidate_id || res.id)} 
                      className="form-check-input"
                    />
                  </td>
                  <td className="px-4">
                    <div className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${res.rank_position <= 3 ? 'bg-warning text-dark' : 'bg-light text-muted'}`} style={{ width: '32px', height: '32px' }}>
                      {res.rank_position}
                    </div>
                  </td>
                  <td style={{ maxWidth: '400px' }}>
                    <div className="fw-bold fs-5 text-primary">{res.candidate?.name || 'Candidate'}</div>
                    <div className="small text-muted mb-2">{res.candidate?.email || 'No email'}</div>
                  </td>
                  <td>
                    <div className="progress mb-1" style={{ height: '10px', width: '120px' }}>
                      <div className="progress-bar bg-success" style={{ width: `${(res.overall_score || 0) * 100}%` }}></div>
                    </div>
                    <span className="h5 fw-bold text-success">{((res.overall_score || 0) * 100).toFixed(1)}%</span>
                  </td>
                  <td>
                    <div className="small"><strong>Semantic:</strong> {((res.similarity_score || 0) * 100).toFixed(1)}%</div>
                    <div className="small"><strong>Skills:</strong> {((res.skill_match_score || 0) * 100).toFixed(1)}%</div>
                  </td>
                  <td className="text-end px-4">
                    <Link to={`/candidate/${res.candidate_id || res.id}`} className="btn btn-primary px-4 fw-bold shadow-sm">View Full CV Profile</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {rankings.length === 0 && (
        <div className="text-center py-5 bg-white rounded shadow-sm mt-4">
          <div className="display-1 mb-3"><FontAwesomeIcon icon="magnifying-glass" /></div>
          <h5>No candidates ranked yet</h5>
          <p className="text-muted">The analysis might still be in progress. Try refreshing in a few seconds.</p>
          <button className="btn btn-primary px-4 mt-2" onClick={fetchRankings}>Check Status</button>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Candidate Comparison</h5>
                <button type="button" className="btn-close" onClick={() => setShowComparison(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  {rankings.filter(r => selectedCandidates.includes(r.candidate_id || r.id)).map((r, idx) => (
                    <div key={idx} className="col-md-4 mb-3">
                      <div className="card h-100">
                        <div className="card-body">
                          <h5 className="card-title text-primary">{r.candidate?.name || `Candidate ${idx + 1}`}</h5>
                          <p className="card-text text-muted">{r.candidate?.email || 'No email'}</p>
                          <div className="mb-2">
                            <strong>Overall Score:</strong>
                            <div className="progress" style={{ height: '10px' }}>
                              <div className="progress-bar bg-success" style={{ width: `${(r.overall_score || 0) * 100}%` }}></div>
                            </div>
                            <span className="fw-bold text-success">{((r.overall_score || 0) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="mb-2">
                            <strong>Semantic Score:</strong> {((r.similarity_score || 0) * 100).toFixed(1)}%
                          </div>
                          <div>
                            <strong>Skills Score:</strong> {((r.skill_match_score || 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowComparison(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingList;
