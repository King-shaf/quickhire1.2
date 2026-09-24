import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { candidateService, jobService } from '../services/supabaseService';
import { authService } from '../services/api';

const UploadCV = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const profile = await authService.getUserProfile();
      setUser(profile);
    };
    getUser();
  }, []);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one CV to upload.');
      return;
    }
    if (!user) {
      setError('Please log in first.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress(10);

    try {
      // 1. Create Job Description
      setProgress(20);
      const jobData = {
        title: jobTitle,
        description_text: jobDescription,
        required_skills: requiredSkills.trim() ? requiredSkills.split(',').map(s => s.trim()) : []
      };
      const job = await jobService.createJob(jobData, user.company_id, user.id);
      const jobId = job.id;
      setProgress(40);

      // 2. Upload CVs
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await candidateService.uploadCV(file, user.company_id, user.id);
        setProgress(40 + Math.round(((i + 1) / files.length) * 60));
      }
      
      setProgress(100);
      setSuccess(`Successfully uploaded ${files.length} CVs. Redirecting to Candidate Rankings...`);
      
      // Delay navigation to show success message
      setTimeout(() => {
        navigate(`/ranking/${jobId}`);
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to upload files and create job');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-10 col-lg-8">
        <button onClick={() => navigate(-1)} className="btn btn-outline-secondary mb-3">&larr; Back</button>
        <h1 className="mb-4 fw-bold">Upload & Rank Candidates</h1>
        
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4">
            <h5 className="card-title mb-4">Step 1: Job Details</h5>
            <div className="mb-3">
              <label className="form-label fw-bold small">Job Title</label>
              <input 
                type="text" 
                className="form-control" 
                value={jobTitle} 
                onChange={(e) => setJobTitle(e.target.value)} 
                placeholder="e.g. Senior Software Engineer"
                required 
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold small">Job Description</label>
              <textarea 
                className="form-control" 
                rows="5" 
                value={jobDescription} 
                onChange={(e) => setJobDescription(e.target.value)} 
                placeholder="Paste the full job description here..."
                required
              ></textarea>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold small">Required Skills (comma-separated)</label>
              <input 
                type="text" 
                className="form-control" 
                value={requiredSkills} 
                onChange={(e) => setRequiredSkills(e.target.value)} 
                placeholder="e.g. Python, Django, React, SQL" 
              />
            </div>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4">
            <h5 className="card-title mb-4">Step 2: Upload CVs</h5>
            
            <div 
              className={`border border-2 border-dashed rounded-4 p-5 text-center mb-3 transition-all ${isDragging ? 'bg-light border-primary' : 'border-secondary'}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              style={{ cursor: 'pointer' }}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <div className="display-4 mb-3 text-muted"><FontAwesomeIcon icon="file-lines" /></div>
              <h5 className="fw-bold">Drag and drop CVs here</h5>
              <p className="text-muted small">or click to browse files (PDF, PNG, JPG up to 10MB)</p>
              <input 
                id="fileInput"
                type="file" 
                className="d-none" 
                multiple 
                onChange={handleFileChange} 
                accept=".pdf,.png,.jpg,.jpeg" 
              />
            </div>

            {files.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-bold small mb-2">Selected Files ({files.length}):</h6>
                <ul className="list-group list-group-flush border rounded">
                  {files.map((file, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center small py-2">
                      <span className="text-truncate">{file.name}</span>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-link text-danger p-0"
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      >
                        <FontAwesomeIcon icon="xmark" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploading && (
              <div className="mb-4">
                <div className="progress" style={{ height: '10px' }}>
                  <div 
                    className="progress-bar progress-bar-striped progress-bar-animated" 
                    role="progressbar" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="text-center small text-muted mt-2">Processing candidates...</div>
              </div>
            )}

            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            {success && <div className="alert alert-success py-2 small">{success}</div>}

            <button 
              type="button"
              className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" 
              disabled={uploading || files.length === 0 || !jobTitle || !jobDescription}
              onClick={handleUpload}
            >
              {uploading ? <><span className="spinner-border spinner-border-sm me-2"></span>Starting Analysis...</> : 'Analyze & Rank Candidates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadCV;
