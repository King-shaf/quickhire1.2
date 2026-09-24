import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminLayout from '../components/AdminLayout';
import { adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const ConfigCard = ({ icon, title, subtitle, children }) => (
  <div className="card mb-4">
    <div className="card-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.15rem' }}><FontAwesomeIcon icon={icon} /></span>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</div>
          {subtitle && <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', fontWeight: 400 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
    <div className="card-body" style={{ padding: '1.25rem 1.4rem' }}>{children}</div>
  </div>
);

const SettingRow = ({ label, hint, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1rem', alignItems: 'flex-start', padding: '0.8rem 0', borderBottom: '1px solid var(--border-color)' }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{label}</div>
      {hint && <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '0.2rem', lineHeight: 1.5 }}>{hint}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const AdminConfig = () => {
  const { user: me } = useUser();
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState(() => adminService.defaultConfig());
  const [, setDirty] = useState(new Set());

  useEffect(() => {
    adminService.getSystemConfig().then(setConfig).catch(() => {});
  }, []);

  const markDirty = (k) => setDirty(d => { const nd = new Set(d); nd.add(k); return nd; });
  const update = (section, key, value) => {
    setConfig(c => ({ ...c, [section]: { ...c[section], [key]: value } }));
    markDirty(`${section}.${key}`);
  };

  const save = async (section) => {
    setSaving(s => ({ ...s, [section]: true }));
    await adminService.updateConfig({ section, data: config[section] });
    setSaving(s => ({ ...s, [section]: false }));
    setToast({ msg: `${section.charAt(0).toUpperCase() + section.slice(1)} settings saved.` });
    setTimeout(() => setToast(null), 2200);
  };

  const SaveBtn = ({ sec }) => (
    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
      <button className="btn btn-primary btn-sm" onClick={() => save(sec)} disabled={saving[sec]}>
        {saving[sec] ? <span className="spinner spinner-sm spinner-gold"></span> : <><FontAwesomeIcon icon="floppy-disk" style={{ marginRight: 6 }} />Save Changes</>}
      </button>
    </div>
  );

  return (
    <AdminLayout user={me} title="System Configuration" subtitle="General, AI, performance and security settings">
      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        <div>
          <ConfigCard icon="building-columns" title="General Settings" subtitle="Platform identity, timezone and language">
            <SettingRow label="System Name" hint="Brand name shown on login and emails.">
              <input value={config.general.system_name} onChange={e => update('general', 'system_name', e.target.value)} />
            </SettingRow>
            <SettingRow label="Default Language" hint="Fallback for new users before they pick one.">
              <select value={config.general.language} onChange={e => update('general', 'language', e.target.value)}>
                {['English (US)', 'English (UK)', 'Spanish', 'French', 'German', 'Arabic'].map(l => <option key={l}>{l}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="Timezone" hint="Used for reports, audit logs and scheduled jobs.">
              <select value={config.general.timezone} onChange={e => update('general', 'timezone', e.target.value)}>
                {['UTC', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore'].map(t => <option key={t}>{t}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="Enable Public Sign-up" hint="Allow new recruiters to sign up without an invite.">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem' }}>
                <input type="checkbox" className="form-check-input" checked={config.general.allow_signup} onChange={e => update('general', 'allow_signup', e.target.checked)} />
                {config.general.allow_signup ? 'Enabled' : 'Disabled (invite-only)'}
              </label>
            </SettingRow>
            <SaveBtn sec="general" />
          </ConfigCard>

          <ConfigCard icon="brain" title="AI Configuration" subtitle="Models, embeddings, OCR and NLP pipeline">
            <SettingRow label="Ranking Model" hint="Semantic candidate ranking model. Switching re-ranks active jobs.">
              <select value={config.ai.ranking_model} onChange={e => update('ai', 'ranking_model', e.target.value)}>
                <option value="semantic-v3.2">semantic-v3.2 · Stable (default)</option>
                <option value="semantic-v3.3">semantic-v3.3 · New (+3.2% accuracy)</option>
                <option value="semantic-v3.1">semantic-v3.1 · Legacy</option>
              </select>
            </SettingRow>
            <SettingRow label="Embedding Model" hint="Sentence encoder for CV / JD vectorization.">
              <select value={config.ai.embedding_model} onChange={e => update('ai', 'embedding_model', e.target.value)}>
                <option value="bge-large-en-v1.5">BAAI/bge-large-en-v1.5 (1024d)</option>
                <option value="bge-m3">BAAI/bge-m3 · Multilingual (1024d)</option>
                <option value="text-embedding-3-large">text-embedding-3-large (3072d)</option>
                <option value="minilm-l12-v2">all-MiniLM-L12-v2 (384d) · Fast</option>
              </select>
            </SettingRow>
            <SettingRow label="OCR Language" hint="Primary language passed to the OCR engine.">
              <select value={config.ai.ocr_language} onChange={e => update('ai', 'ocr_language', e.target.value)}>
                {['English', 'English + Arabic', 'English + Spanish', 'Arabic', 'French', 'German'].map(l => <option key={l}>{l}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="OCR Confidence Threshold" hint={`Currently ${config.ai.ocr_min_confidence}. Below this text is flagged for review.`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input type="range" min={0.5} max={0.99} step={0.01} value={config.ai.ocr_min_confidence}
                  onChange={e => update('ai', 'ocr_min_confidence', +e.target.value)} style={{ flex: 1, accentColor: 'var(--primary-mid)' }} />
                <strong style={{ minWidth: 38 }}>{(config.ai.ocr_min_confidence * 100).toFixed(0)}%</strong>
              </div>
            </SettingRow>
            <SettingRow label="NLP Pipeline" hint="Processing stages applied to extracted text before embedding.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {[
                  { k: 'clean', t: 'Clean / Normalize' },
                  { k: 'ner', t: 'NER (Name/Org)' },
                  { k: 'skills', t: 'Skill Extraction' },
                  { k: 'dates', t: 'Date Parsing' },
                  { k: 'deid', t: 'De-identification' },
                ].map(s => {
                  const on = (config.ai.pipeline || []).includes(s.k);
                  return (
                    <span key={s.k} className={`tag ${on ? 'tag-gold' : ''}`}
                      onClick={() => {
                        const cur = config.ai.pipeline || [];
                        const next = on ? cur.filter(x => x !== s.k) : [...cur, s.k];
                        update('ai', 'pipeline', next);
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none', opacity: on ? 1 : 0.5 }}
                    >
                      {on ? <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> : <FontAwesomeIcon icon="circle" style={{ marginRight: 4, opacity: 0.5 }} />}{s.t}
                    </span>
                  );
                })}
              </div>
            </SettingRow>
            <SaveBtn sec="ai" />
          </ConfigCard>
        </div>

        <div>
          <ConfigCard icon="bolt" title="Performance Settings" subtitle="Throughput, caching and rate limits">
            <SettingRow label="Max Concurrent Processing" hint="CV / JD OCR and NLP jobs running in parallel.">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input type="range" min={1} max={32} value={config.perf.max_concurrent}
                  onChange={e => update('perf', 'max_concurrent', +e.target.value)} style={{ flex: 1, accentColor: 'var(--primary-mid)' }} />
                <strong style={{ minWidth: 28 }}>{config.perf.max_concurrent}</strong>
              </div>
            </SettingRow>
            <SettingRow label="Enable Result Caching" hint="Cache ranking results per job ID for 24 hours.">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem' }}>
                <input type="checkbox" className="form-check-input" checked={config.perf.cache_enabled} onChange={e => update('perf', 'cache_enabled', e.target.checked)} />
                {config.perf.cache_enabled ? 'On (recommended)' : 'Off'}
              </label>
            </SettingRow>
            <SettingRow label="Cache TTL (seconds)" hint="How long ranking results are cached.">
              <input type="number" min={60} step={60} value={config.perf.cache_ttl} onChange={e => update('perf', 'cache_ttl', +e.target.value)} />
            </SettingRow>
            <SettingRow label="API Rate Limit" hint="Requests per minute per authenticated user.">
              <input type="number" min={10} step={10} value={config.perf.rate_limit_per_min} onChange={e => update('perf', 'rate_limit_per_min', +e.target.value)} />
            </SettingRow>
            <SettingRow label="Batch Upload Limit" hint="Max CV files a recruiter can upload at once.">
              <input type="number" min={1} step={5} value={config.perf.max_batch_upload} onChange={e => update('perf', 'max_batch_upload', +e.target.value)} />
            </SettingRow>
            <SaveBtn sec="perf" />
          </ConfigCard>

          <ConfigCard icon="lock" title="Security Settings" subtitle="Sessions, login attempts and password policy">
            <SettingRow label="Session Timeout (minutes)" hint="Inactivity timeout for all web sessions.">
              <input type="number" min={5} step={5} value={config.security.session_timeout_min} onChange={e => update('security', 'session_timeout_min', +e.target.value)} />
            </SettingRow>
            <SettingRow label="Max Failed Login Attempts" hint={`Currently ${config.security.max_login_attempts}. Account locked for 5 minutes after this.`}>
              <input type="number" min={1} value={config.security.max_login_attempts} onChange={e => update('security', 'max_login_attempts', +e.target.value)} />
            </SettingRow>
            <SettingRow label="Minimum Password Length">
              <input type="number" min={6} max={32} value={config.security.pwd_min_length} onChange={e => update('security', 'pwd_min_length', +e.target.value)} />
            </SettingRow>
            <SettingRow label="Password Complexity" hint="Required character classes in new passwords.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {[
                  { k: 'upper', t: 'Uppercase A-Z' },
                  { k: 'lower', t: 'Lowercase a-z' },
                  { k: 'number', t: 'Numbers 0-9' },
                  { k: 'symbol', t: 'Symbols !@#$…' },
                  { k: 'no_common', t: 'Block common passwords' },
                ].map(s => {
                  const on = (config.security.pwd_rules || []).includes(s.k);
                  return (
                    <span key={s.k} className={`tag ${on ? 'tag-gold' : ''}`}
                      onClick={() => {
                        const cur = config.security.pwd_rules || [];
                        const next = on ? cur.filter(x => x !== s.k) : [...cur, s.k];
                        update('security', 'pwd_rules', next);
                      }}
                      style={{ cursor: 'pointer', userSelect: 'none', opacity: on ? 1 : 0.5 }}
                    >
                      {on ? <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> : <FontAwesomeIcon icon="circle" style={{ marginRight: 4, opacity: 0.5 }} />}{s.t}
                    </span>
                  );
                })}
              </div>
            </SettingRow>
            <SettingRow label="Force Password Rotation" hint="Require users to change password periodically.">
              <select value={config.security.pwd_rotate_days} onChange={e => update('security', 'pwd_rotate_days', +e.target.value)}>
                <option value={0}>Never (not recommended)</option>
                <option value={90}>Every 90 days</option>
                <option value={180}>Every 180 days</option>
                <option value={365}>Every 12 months</option>
              </select>
            </SettingRow>
            <SaveBtn sec="security" />
          </ConfigCard>
        </div>
      </div>

      {toast && (
        <div className="alert alert-success" style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />{toast.msg}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminConfig;
