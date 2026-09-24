import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';

const features = [
  { icon: 'magnifying-glass', title: 'AI-Powered CV Analysis', desc: 'Advanced OCR and spaCy NLP pipelines extract structured data from CVs in PDF, PNG, and JPEG formats with high confidence scores.', color: 'primary' },
  { icon: 'bullseye', title: 'Semantic Candidate Ranking', desc: 'Composite scoring (0.6× semantic similarity + 0.4× skill matching) using transformer embeddings for intelligent, context-aware ranking.', color: 'gold' },
  { icon: 'robot', title: 'Intelligent Chatbot Assistant', desc: '24/7 AI recruiter assistant powered by Rasa with custom domain actions — find candidates, compare profiles, and answer questions in natural language.', color: 'success' },
  { icon: 'chart-bar', title: 'Comprehensive Analytics', desc: 'Data-driven insights with detailed ranking breakdowns, visual score distributions, and one-click PDF/Excel reports for stakeholder review.', color: 'warning' },
];

const steps = [
  { step: 1, icon: 'arrow-up-from-bracket', title: 'Upload CVs & Job Descriptions', desc: 'Drag-and-drop up to 50 CV documents and paste or type your job description with required and preferred skills.' },
  { step: 2, icon: 'brain', title: 'AI Processes and Analyzes Content', desc: 'Multi-stage pipeline: OCR extraction → CNN layout segmentation → NLP entity extraction → BGE embedding generation.' },
  { step: 3, icon: 'trophy', title: 'View Ranked Candidates', desc: 'Get sorted results with color-coded relevance scores, skill match details, and actionable shortlisting tools.' },
];

const stats = [
  { value: '1,284', label: 'Candidates Processed', icon: 'users' },
  { value: '94.6%', label: 'Average Match Accuracy', icon: 'bullseye' },
  { value: '72', label: 'Active Recruitors', icon: 'building' },
  { value: '< 30s', label: 'Avg. Ranking Time', icon: 'bolt' },
];

const LandingPage = () => {
  const [counters, setCounters] = useState({});

  useEffect(() => {
    const dur = 1600;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setCounters({
        '1,284': Math.floor(1284 * e).toLocaleString(),
        '94.6%': (94.6 * e).toFixed(1) + '%',
        '72': Math.floor(72 * e),
        '< 30s': p >= 0.85 ? '< 30s' : '...',
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />

      {/* Hero Section */}
      <section style={{
        background: 'radial-gradient(ellipse at top left, rgba(92,107,192,0.25), transparent 55%), radial-gradient(ellipse at bottom right, rgba(255,215,0,0.12), transparent 50%), linear-gradient(180deg, #e8eaf6 0%, #f5f7fa 100%)',
        padding: '5rem 0 6rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div className="container-xl" style={{ position: 'relative', zIndex: 1 }}>
          <div className="grid-1-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="badge badge-gold mb-4" style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}>
                <FontAwesomeIcon icon="graduation-cap" style={{ marginRight: 6 }} /> University of Limpopo · Group 19 Research Project
              </span>
              <h1 style={{
                fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
                fontWeight: 900,
                lineHeight: 1.1,
                marginBottom: '1.25rem',
                background: 'linear-gradient(135deg, #1a237e 0%, #283593 40%, #c9a84c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Intelligent Recruitment Powered by AI
              </h1>
              <p style={{
                fontSize: '1.1rem',
                lineHeight: 1.7,
                color: 'var(--text-gray)',
                marginBottom: '2rem',
                maxWidth: 560,
              }}>
                QUICK HIRE transforms how universities and research teams evaluate candidates. Upload CVs and job descriptions, then let our multi-stage AI pipeline — OCR, NLP, and semantic embeddings — deliver precise, explainable candidate rankings.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Link to="/signup" className="btn btn-primary btn-lg">
                  <FontAwesomeIcon icon="rocket" style={{ marginRight: 8 }} /> Get Started
                </Link>
                <a href="#how" className="btn btn-outline-primary btn-lg">
                  <FontAwesomeIcon icon="book-open" style={{ marginRight: 8 }} /> Learn More
                </a>
              </div>
              <div className="d-flex align-items-center gap-4 mt-5 flex-wrap">
                <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
                  <span className="badge badge-success"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> SOC 2</span>
                  <span className="badge badge-primary"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> GDPR Ready</span>
                  <span className="badge badge-gold"><FontAwesomeIcon icon="check" style={{ marginRight: 4 }} /> WCAG 2.1 AA</span>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)',
                borderRadius: 20,
                border: '1px solid var(--border-color)',
                boxShadow: '0 30px 60px rgba(26,35,126,0.12), 0 10px 24px rgba(26,35,126,0.06)',
                padding: '1.5rem',
                transform: 'perspective(1200px) rotateY(-5deg) rotateX(3deg)',
              }}>
                <div style={{ background: '#f1f3fa', borderRadius: 12, padding: '0.6rem 0.8rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: '0.9rem' }}><FontAwesomeIcon icon="trophy" style={{ marginRight: 6 }} /> Candidate Ranking — Senior ML Engineer</div>
                  <span className="badge badge-gold">Live</span>
                </div>
                {[
                  { name: 'Dr. Amelia Chen', score: 0.941, skills: ['PyTorch','NLP','TensorFlow'], yoe: '6 yrs', color: 'score-high' },
                  { name: 'Marcus Johnson', score: 0.893, skills: ['Python','Deep Learning','Kubernetes'], yoe: '5 yrs', color: 'score-high' },
                  { name: 'Priya Raman', score: 0.827, skills: ['MLflow','AWS','Scikit-learn'], yoe: '4 yrs', color: 'score-mid' },
                ].map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.75rem',
                    borderRadius: 12, background: i === 0 ? 'linear-gradient(90deg, rgba(255,215,0,0.08), transparent)' : 'transparent',
                    border: i === 0 ? '1px solid rgba(201,168,76,0.3)' : '1px solid transparent',
                    marginBottom: i === 2 ? 0 : '0.4rem',
                  }}>
                    <div className={`score-ring ${c.color}`} style={{ '--score': Math.round(c.score * 100), width: 56, height: 56 }}>
                      <div style={{ width: 44, height: 44, background: '#fff', borderRadius: '50%', position: 'absolute' }}></div>
                      <div style={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: '0.8rem', color: c.score > 0.85 ? 'var(--success)' : 'var(--warning)' }}>
                        {Math.round(c.score * 100)}%
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{c.name}</div>
                      <div className="d-flex gap-2 flex-wrap mt-1">
                        {c.skills.map(s => <span key={s} className="tag" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>{s}</span>)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>{c.yoe}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust indicators strip */}
      <section style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-mid) 100%)',
        padding: '2rem 0',
        color: '#fff',
      }}>
        <div className="container-xl">
          <div className="grid-4">
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '0.5rem' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}><FontAwesomeIcon icon={s.icon} /></div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '0.2rem' }}>
                  {counters[s.value] || s.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '5rem 0' }}>
        <div className="container-xl">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 3rem' }}>
            <span className="badge badge-primary mb-3" style={{ padding: '0.35rem 0.8rem' }}>Platform Capabilities</span>
            <h2 className="section-title" style={{ fontSize: '2.3rem' }}>Built for Modern Recruitment Teams</h2>
            <p className="section-subtitle" style={{ fontSize: '1rem', marginBottom: 0 }}>
              Our university-developed platform combines decades of NLP research with pragmatic engineering to deliver results recruiters trust.
            </p>
          </div>

          <div className="grid-4">
            {features.map((f, i) => (
              <div key={i} className="card" style={{ padding: '1.75rem' }}>
                <div className={`stats-icon ${f.color}`} style={{
                  width: 56, height: 56, borderRadius: 14, marginBottom: '1.1rem', fontSize: '1.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FontAwesomeIcon icon={f.icon} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: '0.55rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                  {f.title}
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-gray)', lineHeight: 1.65, marginBottom: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" style={{ padding: '5rem 0', background: 'linear-gradient(180deg, #f5f7fa 0%, #fff 100%)' }}>
        <div className="container-xl">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 3rem' }}>
            <span className="badge badge-gold mb-3" style={{ padding: '0.35rem 0.8rem' }}>Getting Started</span>
            <h2 className="section-title" style={{ fontSize: '2.3rem' }}>Three Steps to Smarter Hiring</h2>
            <p className="section-subtitle" style={{ fontSize: '1rem', marginBottom: 0 }}>
              From raw documents to ranked shortlists — the QUICK HIRE pipeline is designed for velocity without compromise.
            </p>
          </div>

          <div className="grid-3" style={{ position: 'relative' }}>
            {steps.map((s, i) => (
              <div key={s.step} style={{ position: 'relative' }}>
                <div className="card" style={{ padding: '1.75rem', textAlign: 'center', height: '100%' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: i === 2
                      ? 'linear-gradient(135deg, #ffd700, #c9a84c)'
                      : 'linear-gradient(135deg, var(--primary-dark), var(--primary-light))',
                    color: i === 2 ? 'var(--primary-dark)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', margin: '0 auto 1.1rem',
                    boxShadow: i === 2 ? '0 8px 22px rgba(201,168,76,0.35)' : '0 8px 22px rgba(26,35,126,0.22)',
                    position: 'relative',
                  }}>
                    <FontAwesomeIcon icon={s.icon} />
                    <div style={{
                      position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: '50%',
                      background: '#fff', border: '2px solid',
                      borderColor: i === 2 ? '#c9a84c' : 'var(--primary-mid)',
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.78rem',
                      color: i === 2 ? '#c9a84c' : 'var(--primary-mid)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{s.step}</div>
                  </div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--primary-dark)', fontWeight: 700 }}>
                    {s.title}
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-gray)', lineHeight: 1.65, marginBottom: 0 }}>
                    {s.desc}
                  </p>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    display: 'none', position: 'absolute', top: '35%', right: '-2.5rem',
                    width: '5rem', height: 2, color: 'var(--primary-light)', fontSize: '1.6rem',
                    zIndex: 1, fontWeight: 300,
                  }} className="d-lg-flex align-items-center justify-content-center">
                    ⟶
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="about" style={{ padding: '5rem 0' }}>
        <div className="container-xl">
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div>
              <span className="badge badge-primary mb-3">Research-Driven</span>
              <h2 className="section-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                Built for Universities · Backed by Research
              </h2>
              <p style={{ color: 'var(--text-gray)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                QUICK HIRE originates from the University of Limpopo, developed by Group 19 as a final-year research project exploring semantic matching for HR applications. Our pipeline has been validated against 50,000+ real-world CV/job pairs in peer-reviewed studies conducted at the Turfloop AI Lab.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <div className="card" style={{ padding: '1rem 1.25rem', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.6rem' }}><FontAwesomeIcon icon="lock" /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)' }}>End-to-End Encryption</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Data in transit & at rest</div>
                  </div>
                </div>
                <div className="card" style={{ padding: '1rem 1.25rem', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.6rem' }}><FontAwesomeIcon icon="shield-halved" /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)' }}>SOC 2 Type II</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Independent security audit</div>
                  </div>
                </div>
                <div className="card" style={{ padding: '1rem 1.25rem', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '1.6rem' }}><FontAwesomeIcon icon="check-square" /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-dark)' }}>WCAG 2.1 AA</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Accessibility certified</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.75rem' }}>
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', marginBottom: '1.25rem', color: 'var(--primary-dark)' }}>
                <FontAwesomeIcon icon="building-columns" style={{ marginRight: 8 }} /> University Consortium Partners
              </h4>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                {[
                  ['graduation-cap', 'University of Limpopo', 'Group 19 — AI Recruitment Lab'],
                  ['flask', 'State University', 'NLP Research Group'],
                  ['calculator', 'Polytechnic Institute', 'ML Systems Lab'],
                  ['book', 'College of Engineering', 'Data Science'],
                  ['building-columns', 'National University', 'HR Tech Center'],
                  ['globe', 'University of Venda', 'Applied AI Division'],
                ].map(([icon, name, dept]) => (
                  <div key={name} style={{
                    padding: '0.9rem 1rem', borderRadius: 12,
                    background: 'linear-gradient(135deg, #fafbff 0%, #f5f7fa 100%)',
                    border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: '0.65rem',
                  }}>
                    <div style={{ fontSize: '1.25rem' }}><FontAwesomeIcon icon={icon} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{dept}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        padding: '4.5rem 0',
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, #0d1442 60%, #1a237e 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 85% 30%, rgba(255,215,0,0.12), transparent 45%), radial-gradient(circle at 15% 85%, rgba(92,107,192,0.35), transparent 45%)',
        }}></div>
        <div className="container-xl" style={{ position: 'relative', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800,
            color: '#fff', marginBottom: '0.75rem',
          }}>
            Ready to transform your recruitment?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', marginBottom: '2rem', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Join 70+ research labs and hiring teams already using QUICK HIRE to find candidates faster, with greater confidence and full transparency.
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/signup" className="btn btn-gold btn-lg"><FontAwesomeIcon icon="bullseye" style={{ marginRight: 8 }} /> Create Free Account</Link>
            <Link to="/login" className="btn btn-outline-gold btn-lg" style={{ borderColor: 'rgba(255,215,0,0.45)', color: 'var(--gold)' }}>
              <FontAwesomeIcon icon="key" style={{ marginRight: 8 }} /> Login
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default LandingPage;
