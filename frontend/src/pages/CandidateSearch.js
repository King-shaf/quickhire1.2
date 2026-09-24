import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import { candidateService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const CandidateSearch = () => {
  const { user } = useUser();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const doSearch = async () => {
    const r = await candidateService.searchCandidates(q);
    setResults(r); setSubmitted(true);
  };
  return (
    <RecruiterLayout user={user} title="Candidate Search" subtitle="Free-text semantic search across all candidates">
      <div className="card mb-4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem' }}>
          <input type="search" placeholder="e.g. Machine Learning engineer with PyTorch and 5 years in finance…"
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ padding: '0.8rem 1rem', fontSize: '0.96rem' }} />
          <button className="btn btn-gold" onClick={doSearch} style={{ padding: '0.8rem 1.6rem' }}><FontAwesomeIcon icon="magnifying-glass" style={{ marginRight: 6 }} />Search</button>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          <span className="filter-label" style={{ marginRight: '0.2rem' }}>Try:</span>
          {['Python backend AWS microservices', 'PhD Computer Vision TensorFlow', 'Product manager SaaS 8 years', 'DevOps Kubernetes Terraform'].map(s => (
            <span key={s} className="tag tag-gold" style={{ cursor: 'pointer' }} onClick={() => { setQ(s); }}>{s.length > 50 ? s.slice(0, 50) + '…' : s}</span>
          ))}
        </div>
      </div>

      {submitted && (
        <div className="card">
          <div className="card-header">
            {results.length ? <><FontAwesomeIcon icon="dna" style={{ marginRight: 6 }} />Semantic results — {results.length} matches (sorted by similarity)</> : <><FontAwesomeIcon icon="magnifying-glass-minus" style={{ marginRight: 6 }} />No candidates match your query.</>}
          </div>
          <div style={{ padding: '0.3rem 1.25rem 1.25rem' }}>
            {results.map(c => {
              const candCode = c.candidate_code || c.simple_id || ('CAND-' + (c.id ? String(c.id).split('-')[0].slice(0, 4).toUpperCase() : '1001'));
              const docName = c.source_file_name || (c.source_file ? String(c.source_file).split('/').pop() : 'CV_Document.pdf');
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div className="avatar avatar-sm avatar-gold">{c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-gold" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{candCode}</span>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.95rem' }}>{c.name}</div>
                        {Boolean(c.is_hired || c.hired || c.structured_data?.hired) && (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', fontWeight: 800, background: '#059669', color: '#fff' }}>
                            🎉 HIRED BY MANAGER
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>({docName})</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.15rem' }}>
                        {c.all_skills?.slice(0, 8).join(' · ') || ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-gray)', flexShrink: 0 }}>
                    {c.years_experience} yrs · <span style={{ color: 'var(--primary-mid)', fontWeight: 700 }}>{Math.round(c.relevance_score * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </RecruiterLayout>
  );
};
export default CandidateSearch;
