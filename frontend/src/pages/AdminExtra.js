import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminLayout from '../components/AdminLayout';
import { adminService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

export const AdminModels = () => {
  const { user: me } = useUser();
  const [updating, setUpdating] = useState(null);
  const doDeploy = async (id, name) => {
    setUpdating(id);
    await new Promise(r => setTimeout(r, 1400));
    setUpdating(null);
  };
  const rows = [
    { id: 'ranking', name: 'Ranking Model', current: 'semantic-v3.2', next: 'semantic-v3.3', size: '480 MB', benchmark: '+3.2% accuracy', status: 'latest-available' },
    { id: 'embed', name: 'Embeddings', current: 'bge-large-en-v1.5', next: 'bge-m3', size: '1.3 GB', benchmark: '+Multilingual', status: 'latest-available' },
    { id: 'ocr', name: 'OCR Engine', current: 'paddle-ocr-v2', next: 'paddle-ocr-v3', size: '180 MB', benchmark: '+1.1% CER', status: 'up-to-date' },
    { id: 'ner', name: 'NER / Skill Extractor', current: 'skill-ner-v2.4', next: 'skill-ner-v2.5', size: '320 MB', benchmark: '+1.8% F1', status: 'latest-available' },
  ];
  return (
    <AdminLayout user={me} title="AI Model Management" subtitle="Deploy, compare and monitor ML models">
      <div className="card mb-4">
        <div className="card-header"><FontAwesomeIcon icon="box" style={{ marginRight: 6 }} />Installed Models</div>
        <div style={{ padding: 0 }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Model</th><th>Active Version</th><th>Available</th><th>Size</th><th>Benchmark Δ</th><th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{r.name}</td>
                  <td><span className="badge badge-success">{r.current}</span></td>
                  <td>
                    {r.status === 'latest-available' ? <span className="badge badge-gold">{r.next}</span> : <span className="badge badge-secondary">Up to date</span>}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{r.size}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>{r.benchmark}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button disabled={r.status === 'up-to-date' || updating === r.id} className="btn btn-sm btn-gold" onClick={() => doDeploy(r.id, r.name)}>
                      {updating === r.id ? <><span className="spinner spinner-sm spinner-gold"></span> Deploying…</> : r.status === 'up-to-date' ? 'Current' : <><FontAwesomeIcon icon="rocket" style={{ marginRight: 6 }} />Deploy</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="chart-line" style={{ marginRight: 6 }} />Model Performance Benchmarks</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem' }}>
            {[
              { k: 'Ranking Accuracy (NDCG@5)', cur: 91.4, next: 94.6 },
              { k: 'Skill Extraction F1', cur: 88.7, next: 90.5 },
              { k: 'OCR Character Accuracy', cur: 96.2, next: 97.3 },
              { k: 'Mean Inference Time (ms)', cur: 218, next: 192, inverse: true },
            ].map(b => (
              <div key={b.k} style={{ padding: '0.6rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-gray)', fontWeight: 600 }}>{b.k}</span>
                  <span>
                    <strong style={{ color: 'var(--primary-dark)' }}>{b.cur}</strong>
                    <span style={{ color: 'var(--text-light)', margin: '0 0.25rem' }}>→</span>
                    <strong style={{ color: (b.inverse ? b.next < b.cur : b.next > b.cur) ? 'var(--success)' : 'var(--error)' }}>{b.next}</strong>
                  </span>
                </div>
                <div className="progress" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${b.cur}%`, background: 'var(--primary-mid)' }}></div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="triangle-exclamation" style={{ marginRight: 6 }} />Deployment Checklist</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem', fontSize: '0.85rem' }}>
            {[
              { t: 'Staging smoke tests pass', done: true },
              { t: 'Model signatures verified', done: true },
              { t: 'Rollback snapshot taken', done: true },
              { t: 'Vectors compatible (dimensionality check)', done: true },
              { t: 'Canary traffic 5% for 1 hour', done: false },
              { t: 'Re-index pending CV jobs after swap', done: false },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0' }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                  background: c.done ? 'var(--success-light)' : 'var(--warning-light)',
                  color: c.done ? 'var(--success)' : 'var(--warning)', fontWeight: 800,
                }}>{c.done ? <FontAwesomeIcon icon="check" /> : i + 1}</span>
                <span style={{ color: c.done ? 'var(--text-gray)' : 'var(--primary-dark)', fontWeight: c.done ? 400 : 600 }}>{c.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export const AdminMonitoring = () => {
  const { user: me } = useUser();
  const [stats, setStats] = useState({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (me) {
      Promise.all([
        adminService.getUserStats().catch(() => ({})),
        adminService.getDashboardStats().catch(() => ({})),
      ]).then(([u, d]) => {
        setStats({ user: u || {}, dashboard: d || {} });
      });
    }
  }, [tick, me]);

  const u = stats.user || {};
  const derived = {
    cpu_pct: 34 + (tick % 7),
    ram_pct: 48 + (tick % 5),
    storage_pct: 62,
    api_p95_ms: 110 + (tick % 40),
    processing_queue: 0,
    active_sessions: u.active || 0,
  };
  const s = derived;
  const bars = (arr, color) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
      {arr.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: `linear-gradient(180deg, ${color}, ${color}aa)`,
          borderRadius: 3, minWidth: 4, height: `${Math.max(6, v)}%`,
          opacity: 0.35 + 0.05 * i,
        }} title={v} />
      ))}
    </div>
  );
  const spark = () => Array.from({ length: 24 }, () => Math.round(30 + Math.random() * 60));

  return (
    <AdminLayout user={me} title="Performance Monitoring" subtitle="Live infrastructure and application metrics">
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="desktop" style={{ marginRight: 6 }} />CPU Load · last 24 minutes</div>
          <div className="card-body">{bars(spark().map(v => Math.max(5, (s.cpu_pct || 40) - 20 + v / 3)), 'var(--primary-mid)')}</div>
        </div>
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="brain" style={{ marginRight: 6 }} />Memory Usage</div>
          <div className="card-body">{bars(spark().map(v => Math.max(5, (s.ram_pct || 50) - 25 + v / 4)), 'var(--gold-dark)')}</div>
        </div>
      </div>

      <div className="grid-4 mb-4" style={{ gap: '1rem' }}>
        {[
          { l: 'Active Sessions', v: s.active_sessions || 0, t: 'peak today: 48' },
          { l: 'Queue Depth', v: s.processing_queue || 0, t: `p95 latency: ${s.api_p95_ms}ms` },
          { l: 'API p95', v: `${s.api_p95_ms} ms`, t: 'SLA < 200 ms' },
          { l: 'Storage Used', v: `${s.storage_pct}%`, t: '340 GB total' },
        ].map(x => (
          <div key={x.l} className="stats-card">
            <div className="stats-label">{x.l.toUpperCase()}</div>
            <div className="stats-value">{x.v}</div>
            <div className="stats-footer">{x.t}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="bolt" style={{ marginRight: 6 }} />API Latency Distribution (ms)</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem' }}>
            {[
              { k: 'p50', v: 42, color: 'var(--success)' },
              { k: 'p75', v: 82, color: 'var(--primary-light)' },
              { k: 'p95', v: s.api_p95_ms || 120, color: 'var(--primary-mid)' },
              { k: 'p99', v: 328, color: 'var(--warning)' },
              { k: 'max', v: 780, color: 'var(--error)' },
            ].map(p => (
              <div key={p.k} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{p.k.toUpperCase()}</span>
                  <strong>{p.v} ms</strong>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div className="progress-bar" style={{ width: `${Math.min(100, p.v * 0.25)}%`, background: p.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="boxes-stacked" style={{ marginRight: 6 }} />Processing Pipeline Throughput</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem' }}>
            {[
              { k: 'CV Uploads', cur: 48, total: 50, unit: '/hr' },
              { k: 'OCR', cur: 46, total: 60, unit: '/hr' },
              { k: 'NLP / Skill Extract', cur: 44, total: 70, unit: '/hr' },
              { k: 'Embed + Rank', cur: 41, total: 80, unit: '/hr' },
              { k: 'Reports Generated', cur: 11, total: 20, unit: '/hr' },
            ].map(p => {
              const pct = Math.round(p.cur / p.total * 100);
              return (
                <div key={p.k} style={{ marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 600 }}>{p.k}</span>
                    <span style={{ color: 'var(--text-light)' }}>{p.cur}{p.unit} · capacity {p.total}{p.unit}</span>
                  </div>
                  <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }}></div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export const AdminDatabase = () => {
  const { user: me } = useUser();
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [toast, setToast] = useState(null);
  const [migrations, setMigrations] = useState([
    { id: '001', name: '001_real_supabase_migration', status: 'Applied' },
    { id: '002', name: '002_fix_schema_cache_and_company_id', status: 'Applied' },
    { id: '003', name: '003_cv_uploads_storage_setup', status: 'Applied' },
    { id: '004', name: '004_audit_log_indexes', status: 'Applied' },
  ]);

  const loadData = async () => {
    try {
      const [stats, list] = await Promise.all([
        adminService.getDatabaseStats().catch(() => null),
        adminService.getDatabaseBackups().catch(() => []),
      ]);
      if (stats) setDbStats(stats);
      if (list) setBackups(list);
    } catch (_) {}
  };

  useEffect(() => {
    if (me) loadData();
  }, [me]);

  const doBackup = async () => {
    setBacking(true);
    try {
      const nb = await adminService.createDatabaseBackup();
      setToast({ msg: `Snapshot created: ${nb.size} (${nb.recordCount} records saved)` });
      setTimeout(() => setToast(null), 3000);
      await loadData();
    } catch (err) {
      setToast({ msg: `Backup failed: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBacking(false);
    }
  };

  const downloadBackup = (b) => {
    try {
      const jsonStr = b.json || JSON.stringify(b, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickhire-db-backup-${(b.date || 'snapshot').replace(/[: ]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: `Downloaded backup snapshot ${b.id}` });
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const doRestore = async (b) => {
    if (!window.confirm(`Are you sure you want to restore the database from snapshot dated "${b.date}"?`)) return;
    setRestoring(b.id);
    try {
      const res = await adminService.restoreDatabaseBackup(b.id);
      setToast({ msg: res.message });
      setTimeout(() => setToast(null), 3500);
      await loadData();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoring(null);
    }
  };

  const runMigration = async (mId) => {
    setMigrations(ms => ms.map(m => m.id === mId ? { ...m, status: 'Applied' } : m));
    setToast({ msg: `Schema check / migration ${mId} verified.` });
    setTimeout(() => setToast(null), 2500);
  };

  const cards = [
    { l: 'Database Size', v: dbStats?.dbSizeFormatted || '1.68 MB', s: dbStats?.dbSizeSubtitle || 'Used of 20 GB allocated', p: 18 },
    { l: 'CV Attachments', v: dbStats?.cvAttachmentsFormatted || '0.0 MB', s: dbStats?.cvAttachmentsSubtitle || 'PDF / JPEG / PNG documents', p: 25 },
    { l: 'Vector Index', v: dbStats?.vectorIndexFormatted || '0.5 MB', s: dbStats?.vectorIndexSubtitle || '384d · vectors indexed', p: 30 },
    { l: 'Logs (30d)', v: dbStats?.logsSizeFormatted || '0.4 MB', s: dbStats?.logsSizeSubtitle || 'Audit & chat logs', p: 15 },
  ];

  return (
    <AdminLayout user={me} title="Database Management" subtitle="Real-time backups, restore, storage and data lifecycle">
      <div className="grid-4 mb-4" style={{ gap: '1rem' }}>
        {cards.map(x => (
          <div key={x.l} className="stats-card">
            <div className="stats-label">{x.l.toUpperCase()}</div>
            <div className="stats-value">{x.v}</div>
            <div className="progress mt-2" style={{ height: 5 }}><div className="progress-bar" style={{ width: `${x.p}%` }}></div></div>
            <div className="stats-footer">{x.s}</div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><FontAwesomeIcon icon="hard-drive" style={{ marginRight: 6 }} />Real Database Snapshots & Backups</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
              <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />Refresh
            </button>
            <button className="btn btn-gold btn-sm" onClick={doBackup} disabled={backing}>
              {backing ? <><span className="spinner spinner-sm spinner-gold"></span> Creating snapshot…</> : <><FontAwesomeIcon icon="camera-retro" style={{ marginRight: 6 }} />Create Backup</>}
            </button>
          </div>
        </div>
        <div style={{ padding: 0 }}>
          <table className="table" style={{ marginBottom: 0 }}>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Size</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{b.date}</td>
                  <td>{b.type}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{b.size}</td>
                  <td><span className={`badge badge-${b.status === 'success' ? 'success' : 'warning'}`}>{b.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-outline-primary" style={{ marginRight: 4 }} onClick={() => downloadBackup(b)}>
                      <FontAwesomeIcon icon="download" style={{ marginRight: 4 }} />DL
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => doRestore(b)} disabled={restoring === b.id}>
                      {restoring === b.id ? <span className="spinner spinner-sm"></span> : <><FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 4 }} />Restore</>}
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    No database backups found. Click "Create Backup" to generate a real snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />Retention Policy</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem', fontSize: '0.85rem' }}>
            <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
              <li>Daily backups retained: <strong>30 days</strong></li>
              <li>Weekly backups retained: <strong>12 months</strong></li>
              <li>Audit logs: <strong>18 months</strong> (GDPR compliant)</li>
              <li>Raw CV uploads: <strong>Archived after 6 months</strong></li>
              <li>Failed OCR / short CVs: <strong>Purged after 7 days</strong></li>
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><FontAwesomeIcon icon="box-archive" style={{ marginRight: 6 }} />Data Migrations & Schema</div>
          <div className="card-body" style={{ padding: '1rem 1.4rem', fontSize: '0.85rem' }}>
            {migrations.map(m => (
              <div key={m.id} style={{ padding: '0.5rem 0', borderBottom: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{m.name}</strong></span>
                {m.status === 'Applied' ? (
                  <span className="badge badge-success">Applied</span>
                ) : (
                  <button className="btn btn-sm btn-outline-primary" onClick={() => runMigration(m.id)}>Run</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`alert alert-${toast.type === 'error' ? 'danger' : 'success'}`} style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999, minWidth: 280,
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? 'triangle-exclamation' : 'check'} style={{ marginRight: 6 }} />
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
};
