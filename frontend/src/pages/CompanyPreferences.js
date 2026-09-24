import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CompanyLayout from '../components/CompanyLayout';
import { useUser } from '../context/UserContext';
import { companyService, adminService, DEFAULT_SYSTEM_CONFIG, ensureCompanyForUser } from '../services/supabaseService';

const industries = ['Engineering', 'Research', 'Data Science', 'Artificial Intelligence', 'Product', 'Design', 'Marketing', 'Human Resources', 'Finance', 'Operations'];
const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

const CompanyPreferences = () => {
  const { user } = useUser();
  const [activeCompanyId, setActiveCompanyId] = useState(user?.company_id || null);

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [defaultRole, setDefaultRole] = useState('recruiter');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [semanticRanking, setSemanticRanking] = useState(true);
  const [minScore, setMinScore] = useState(70);
  const [skillsWeight, setSkillsWeight] = useState(40);
  const [experienceWeight, setExperienceWeight] = useState(30);
  const [selectedIndustry, setSelectedIndustry] = useState('Engineering');
  const [companySize, setCompanySize] = useState('1-10');
  const [saveSaving, setSaveSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        let cid = user?.company_id || user?.companies?.id;
        if (!cid && user) {
          cid = await ensureCompanyForUser(user);
        }
        if (!cid) {
          if (mounted) setLoading(false);
          return;
        }
        if (mounted) setActiveCompanyId(cid);

        const [profile, config] = await Promise.all([
          companyService.getCompanyProfile(cid),
          adminService.getSystemConfig(),
        ]);
        if (!mounted) return;
        if (profile) {
          setCompanyName(profile.name || '');
          setCompanySize(profile.size || '1-10');
          setSelectedIndustry(profile.industry || 'Engineering');
        }
        const aiCfg = config?.ai || DEFAULT_SYSTEM_CONFIG.ai;
        const genCfg = config?.general || DEFAULT_SYSTEM_CONFIG.general;
        const perfCfg = config?.perf || DEFAULT_SYSTEM_CONFIG.perf;
        const appReq = genCfg.approval_required !== undefined ? genCfg.approval_required : true;
        const semRank = !!aiCfg.ranking_model || !!aiCfg.ranking;
        const mScore = aiCfg.min_score ?? perfCfg.min_score ?? 70;
        const sWeight = aiCfg.skills_weight ?? perfCfg.skills_weight ?? 40;
        const eWeight = aiCfg.experience_weight ?? perfCfg.experience_weight ?? 30;
        const dRole = genCfg.default_role || 'recruiter';
        setApprovalRequired(appReq);
        setSemanticRanking(semRank);
        setMinScore(Number(mScore));
        setSkillsWeight(Number(sWeight));
        setExperienceWeight(Number(eWeight));
        setDefaultRole(dRole);
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load preferences.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(''), 3200);
    return () => clearTimeout(t);
  }, [savedMessage]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4500);
    return () => clearTimeout(t);
  }, [error]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const targetCid = activeCompanyId || user?.company_id || user?.companies?.id;
    if (!targetCid || saveSaving) return;
    setSaveSaving(true);
    setSavedMessage('');
    setError('');
    try {
      await companyService.updateCompanyProfile(targetCid, {
        name: companyName,
        size: companySize,
        industry: selectedIndustry,
      });
      const aiData = {
        min_score: Number(minScore),
        skills_weight: Number(skillsWeight),
        experience_weight: Number(experienceWeight),
        ranking: semanticRanking,
        semantic_ranking: semanticRanking,
      };
      const generalData = {
        approval_required: approvalRequired,
        default_role: defaultRole,
      };
      await Promise.all([
        adminService.updateConfig({ section: 'ai', data: aiData }),
        adminService.updateConfig({ section: 'general', data: generalData }),
      ]);
      setSavedMessage('Preferences saved successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to save preferences.');
    } finally {
      setSaveSaving(false);
    }
  };

  const toggleBtn = (active, onClick, label, icon) => (
    <button
      type="button"
      onClick={onClick}
      className={`d-flex align-items-center justify-content-between w-100 p-3 text-start rounded-3 border-2 ${active ? 'border-primary bg-primary-soft' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      style={{
        borderStyle: 'solid',
        borderColor: active ? 'rgba(13, 110, 253, 0.4)' : 'var(--border-color)',
        background: active ? 'rgba(13, 110, 253, 0.06)' : 'transparent',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      <div className="d-flex align-items-center gap-3">
        <div
          className="rounded-2 d-flex align-items-center justify-content-center"
          style={{
            width: 40,
            height: 40,
            background: active ? 'var(--primary)' : 'var(--gray-100)',
            color: active ? '#fff' : 'var(--text-light)',
          }}
        >
          <FontAwesomeIcon icon={icon} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{label}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
            {active ? 'Enabled — active in this workspace' : 'Disabled — not applied'}
          </div>
        </div>
      </div>
      <div
        className="rounded-pill d-flex align-items-center justify-content-center"
        style={{
          width: 52,
          height: 30,
          background: active ? 'var(--primary)' : 'var(--gray-200)',
          position: 'relative',
          transition: 'background 0.2s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            left: active ? '26px' : '3px',
            transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesomeIcon icon={active ? 'check' : 'bolt'} style={{ fontSize: '0.65rem', color: active ? 'var(--primary)' : 'var(--text-light)' }} />
        </div>
      </div>
    </button>
  );

  const progressBar = (value, suffix = '', colorClass = 'bg-primary') => (
    <div className="progress mt-2" style={{ height: 6, borderRadius: 99, background: 'var(--gray-100)' }}>
      <div
        className={`progress-bar ${colorClass}`}
        role="progressbar"
        style={{
          width: `${Math.max(0, Math.min(100, Number(value)))}%`,
          borderRadius: 99,
          transition: 'width 0.3s ease',
        }}
        aria-valuenow={Number(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );

  if (loading) {
    return (
      <CompanyLayout
        user={user}
        title="Company Preferences"
        subtitle="Organisation settings and ranking defaults for your workspace."
      >
        <div className="d-flex align-items-center justify-content-center py-5">
          <span className="spinner" style={{ marginRight: 12 }}></span>
          <span style={{ color: 'var(--text-light)' }}>Loading preferences…</span>
        </div>
      </CompanyLayout>
    );
  }

  return (
    <CompanyLayout
      user={user}
      title="Company Preferences"
      subtitle="Organisation settings and ranking defaults for your workspace."
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            <div className="card h-100 shadow-sm">
              <div className="card-header d-flex align-items-center gap-2">
                <FontAwesomeIcon icon="building-columns" style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700 }}>Organisation</span>
                <small className="ms-auto" style={{ color: 'var(--text-light)', fontWeight: 400 }}>
                  <FontAwesomeIcon icon="gear" /> Workspace identity
                </small>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon="chart-bar" style={{ fontSize: '0.8rem', color: 'var(--text-light)' }} />
                    Company name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                    required
                  />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-2">
                      <FontAwesomeIcon icon="users" style={{ fontSize: '0.8rem', color: 'var(--text-light)' }} />
                      Company size
                    </label>
                    <select
                      className="form-select"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                    >
                      {companySizes.map((s) => (
                        <option key={s} value={s}>{s} employees</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-2">
                      <FontAwesomeIcon icon="star" style={{ fontSize: '0.8rem', color: 'var(--text-light)' }} />
                      Default role for new members
                    </label>
                    <select
                      className="form-select"
                      value={defaultRole}
                      onChange={(e) => setDefaultRole(e.target.value)}
                    >
                      <option value="recruiter">Recruiter</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon="sliders" style={{ fontSize: '0.8rem', color: 'var(--text-light)' }} />
                    Industry
                  </label>
                  <select
                    className="form-select"
                    value={selectedIndustry}
                    onChange={(e) => setSelectedIndustry(e.target.value)}
                  >
                    {industries.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100 shadow-sm">
              <div className="card-header d-flex align-items-center gap-2">
                <FontAwesomeIcon icon="shield-halved" style={{ color: 'var(--warning-dark)' }} />
                <span style={{ fontWeight: 700 }}>Approval workflow</span>
                <small className="ms-auto" style={{ color: 'var(--text-light)', fontWeight: 400 }}>
                  <FontAwesomeIcon icon="bolt" /> Governance & AI
                </small>
              </div>
              <div className="card-body d-flex flex-column gap-3">
                {toggleBtn(
                  approvalRequired,
                  () => setApprovalRequired(!approvalRequired),
                  'Recruiters must request approval to finalise shortlists',
                  'shield-halved'
                )}
                {toggleBtn(
                  semanticRanking,
                  () => setSemanticRanking(!semanticRanking),
                  'Enable semantic ranking (NLP)',
                  'brain'
                )}
                <div
                  className="mt-auto p-3 rounded-3"
                  style={{
                    background: 'var(--gray-50)',
                    border: '1px dashed var(--border-color)',
                    fontSize: '0.8rem',
                    color: 'var(--text-gray)',
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>
                    <FontAwesomeIcon icon="brain" style={{ marginRight: 6, color: 'var(--primary)' }} />
                    Tip
                  </div>
                  With semantic ranking disabled, candidates are scored only on keyword &amp; regex matches. Enable NLP for nuanced contextual matching.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm mb-4">
          <div className="card-header d-flex align-items-center gap-2 flex-wrap">
            <FontAwesomeIcon icon="sliders" style={{ color: 'var(--success)' }} />
            <span style={{ fontWeight: 700 }}>Default ranking criteria</span>
            <small className="ms-auto" style={{ color: 'var(--text-light)', fontWeight: 400 }}>
              Applied to every new job — adjust per-job in the ranking panel
            </small>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-md-4">
                <label className="form-label d-flex align-items-center justify-content-between mb-2">
                  <span className="d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon="star" style={{ color: 'var(--success)' }} />
                    Minimum match score
                  </span>
                  <span
                    className="fw-bold rounded-2 px-2 py-1"
                    style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.82rem' }}
                  >
                    {minScore}%
                  </span>
                </label>
                <div className="input-group">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="form-control"
                    value={minScore}
                    onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  />
                  <span className="input-group-text" style={{ fontWeight: 600 }}>%</span>
                </div>
                {progressBar(minScore, '%', 'bg-success')}
                <div className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Candidates below this threshold are hidden by default in ranking views.
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label d-flex align-items-center justify-content-between mb-2">
                  <span className="d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon="bolt" style={{ color: 'var(--info)' }} />
                    Skills match weight
                  </span>
                  <span
                    className="fw-bold rounded-2 px-2 py-1"
                    style={{ background: 'rgba(13,202,240,0.12)', color: 'var(--info)', fontSize: '0.82rem' }}
                  >
                    {skillsWeight}
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="form-control"
                  value={skillsWeight}
                  onChange={(e) => setSkillsWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
                {progressBar(skillsWeight, '', 'bg-info')}
                <div className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Relative weight of matched technical &amp; soft skills in the composite score.
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label d-flex align-items-center justify-content-between mb-2">
                  <span className="d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon="chart-bar" style={{ color: 'var(--warning)' }} />
                    Experience weight
                  </span>
                  <span
                    className="fw-bold rounded-2 px-2 py-1"
                    style={{ background: 'rgba(255,193,7,0.18)', color: 'var(--warning-dark)', fontSize: '0.82rem' }}
                  >
                    {experienceWeight}
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="form-control"
                  value={experienceWeight}
                  onChange={(e) => setExperienceWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
                {progressBar(experienceWeight, '', 'bg-warning')}
                <div className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Relative weight of years of experience &amp; role seniority signals.
                </div>
              </div>
            </div>

            <div className="row g-3 mt-4">
              <div className="col-md-8">
                <div
                  className="rounded-3 p-3 d-flex align-items-center gap-3"
                  style={{ background: 'var(--primary-soft)', border: '1px solid rgba(13,110,253,0.15)' }}
                >
                  <div
                    className="rounded-2 d-flex align-items-center justify-content-center"
                    style={{
                      width: 42,
                      height: 42,
                      background: 'var(--primary)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <FontAwesomeIcon icon="brain" />
                  </div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--primary-dark)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Composite score composition</div>
                    The remaining {Math.max(0, 100 - (Number(skillsWeight) + Number(experienceWeight)))} weight is allocated to semantic similarity (job description vs CV text) and education signals.
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div
                  className="rounded-3 p-3 h-100 d-flex flex-column justify-content-center"
                  style={{ background: 'var(--gray-50)', border: '1px solid var(--border-color)' }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Weights total
                  </div>
                  <div className="d-flex align-items-baseline gap-2">
                    <span style={{ fontWeight: 800, fontSize: '1.6rem', color: 'var(--text-dark)', fontFamily: 'var(--font-display)' }}>
                      {Number(skillsWeight) + Number(experienceWeight)}
                    </span>
                    <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                      / 100 allocated
                    </span>
                  </div>
                  {progressBar(Number(skillsWeight) + Number(experienceWeight), '',
                    (Number(skillsWeight) + Number(experienceWeight)) > 80 ? 'bg-warning' : 'bg-success'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div style={{ minHeight: 24 }}>
            {savedMessage && (
              <div className="alert alert-success d-inline-flex align-items-center gap-2 mb-0 py-2 px-3" style={{ fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="check" />
                {savedMessage}
              </div>
            )}
            {error && (
              <div className="alert alert-danger d-inline-flex align-items-center gap-2 mb-0 py-2 px-3" style={{ fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon="shield-halved" />
                {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary d-flex align-items-center gap-2"
            disabled={saveSaving}
            style={{ minWidth: 200, justifyContent: 'center' }}
          >
            {saveSaving ? (
              <>
                <span className="spinner spinner-sm spinner-white"></span>
                Saving preferences…
              </>
            ) : savedMessage ? (
              <>
                <FontAwesomeIcon icon="check" />
                Saved
              </>
            ) : (
              <>
                <FontAwesomeIcon icon="floppy-disk" />
                Save preferences
              </>
            )}
          </button>
        </div>
      </form>
    </CompanyLayout>
  );
};

export default CompanyPreferences;
