import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import RecruiterLayout from '../components/RecruiterLayout';
import FormattedMessage from '../components/FormattedMessage';
import { chatbotService, candidateService, jobService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const DEFAULT_SUGGESTED = [
  'What is the QUICK HIRE processing pipeline and tech stack?',
  'Explain business rule BR-009 (bias prevention) and POPIA compliance',
  'Show top candidates with ranking scores',
  'Tell me about system navigation and export reports',
];

const WELCOME_MSG = {
  id: 'm-0',
  from: 'bot',
  text: "Hello! I'm QUICK HIRE's AI Recruitment Assistant. I have full knowledge of the QUICK HIRE platform, architecture, and business rules, and can pull deep dossiers on any of your candidates. Try one of the questions below, or ask anything!",
  time: 0,
};

const RecruiterChatbot = () => {
  const { user } = useUser();
  const sessionId = useMemo(() => `session-${user?.id || 'anon'}`, [user?.id]);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_SUGGESTED);
  const scroller = useRef(null);

  // Load conversation history from Supabase on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id) return;
      try {
        const history = await chatbotService.getConversationHistory(user.id, sessionId);
        if (Array.isArray(history) && history.length > 0) {
          // Combine welcome message with history; avoid duplicate welcome if it's already in history
          setMessages([WELCOME_MSG, ...history]);
        } else {
          setMessages([WELCOME_MSG]);
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      }
    };
    loadHistory();
  }, [user, sessionId]);

  // Load live candidates and jobs to create dynamic suggestions
  useEffect(() => {
    const loadRecentAndSuggestions = async () => {
      try {
        const isCompanyManager = user?.role === 'company';
        const scopedUserId = isCompanyManager ? null : user?.id;
        const [cands, jobs] = await Promise.all([
          candidateService.getCandidates(user.company_id, scopedUserId).catch(() => []),
          jobService.getJobs(user.company_id, scopedUserId).catch(() => []),
        ]);
        const queries = [
          jobs.length ? `Top candidates for ${jobs[0].title}` : 'Top candidates overall',
          cands.length >= 1 ? `Tell me everything about ${cands[0].name}` : 'What is the processing pipeline?',
          'What are the business rules for bias prevention and ranking?',
          'Show recent activity summary',
        ];
        setRecent(queries);

        const dynamicSug = [
          jobs.length ? `Show top candidates for ${jobs[0].title}` : 'Show top candidates',
          cands.length >= 2 ? `Compare ${cands[0].name} and ${cands[1].name}` : (cands.length === 1 ? `Tell me about ${cands[0].name}` : 'What is the processing pipeline and tech stack?'),
          cands.length >= 1 ? `Explain the ranking score for ${cands[0].name}` : 'Explain business rule BR-009',
          'What is the QUICK HIRE processing pipeline and tech stack?',
        ];
        setSuggestedQuestions(dynamicSug);
      } catch {}
    };
    loadRecentAndSuggestions();
  }, [user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text || '').trim();
    if (!msg || loading) return;
    const userMsg = { id: 'u-' + Date.now(), from: 'user', text: msg, time: Date.now() };
    setMessages(ms => [...ms, userMsg]);
    setInput('');
    setLoading(true);

    // Store user message in DB
    if (user?.id) {
      await chatbotService.storeUserMessage({ userId: user.id, sessionId, message: msg });
    }

    try {
      const res = await chatbotService.sendMessage(msg, sessionId, user?.id, user?.company_id);
      const parts = [];
      let reply = res?.text || 'Here is what I found.';
      if (res?.candidates && Array.isArray(res.candidates) && res.candidates.length > 0) {
        parts.push({
          type: 'cards',
          value: res.candidates.map(c => ({
            name: c.name || c.title,
            score: c.relevance_score ?? (c.similarity_score || 0.75),
            yoe: c.years_experience ?? 0,
            skills: c.all_skills?.slice(0, 4) || c.skills?.slice(0, 4) || [],
          })),
        });
      }
      if (res?.table) parts.push({ type: 'table', value: res.table });
      const suggestions = msg.toLowerCase().includes('compare') ? [] : suggestedQuestions.slice(0, 2);
      const botMsg = {
        id: 'b-' + Date.now(),
        from: 'bot',
        text: reply,
        parts,
        suggestions,
        time: Date.now(),
      };
      setMessages(ms => [...ms, botMsg]);

      // Store bot reply in DB
      if (user?.id) {
        await chatbotService.storeBotReply({
          userId: user.id,
          sessionId,
          message: reply,
          responseParts: parts,
          suggestions,
        });
      }
    } catch (e) {
      console.error('Chatbot error:', e);
      const errMsg = {
        id: 'e-' + Date.now(),
        from: 'bot',
        text: 'Oops, something went wrong. Please try again.',
        time: Date.now(),
      };
      setMessages(ms => [...ms, errMsg]);
      if (user?.id) {
        await chatbotService.storeBotReply({
          userId: user.id,
          sessionId,
          message: errMsg.text,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (t) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <RecruiterLayout
      user={user}
      title="Chatbot Assistant"
      subtitle="AI-powered assistant for all your recruitment queries"
      actions={
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setMessages([WELCOME_MSG])}
        >
          <FontAwesomeIcon icon="arrows-rotate" style={{ marginRight: 6 }} />New Chat
        </button>
      }
    >
      <div className="grid-2-1" style={{ alignItems: 'flex-start' }}>
        <div className="chat-window">
          <div className="chat-messages" ref={scroller}>
            {messages.map(m => (
              <div key={m.id} className={`chat-message ${m.from === 'user' ? 'user' : 'bot'}`}>
                <div className="chat-avatar">
                  {m.from === 'user' ? (user ? `${(user.first_name || 'U')[0]}${(user.last_name || '')[0] || ''}` : 'ME') : 'AI'}
                </div>
                <div>
                  <div className="chat-bubble">
                    {m.from === 'bot' ? (
                      <FormattedMessage text={m.text} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.text}</div>
                    )}

                    {m.parts?.map((p, i) => {
                      if (p.type === 'cards' && Array.isArray(p.value)) {
                        return (
                          <div key={i} style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                            {p.value.map((c, idx) => (
                              <div key={idx} style={{
                                padding: '0.65rem 0.8rem', borderRadius: 10,
                                background: 'rgba(26,35,126,0.04)', border: '1px solid rgba(92,107,192,0.15)',
                                color: 'var(--text-dark)',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{c.name}</div>
                                  <span className={`badge ${c.score >= 0.9 ? 'badge-success' : c.score >= 0.85 ? 'badge-gold' : 'badge-warning'}`}>
                                    {Math.round(c.score * 100)}% · {c.yoe} yrs
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
                                  {c.skills.map(s => <span key={s} className="tag tag-gold" style={{ fontSize: '0.7rem', padding: '0.08rem 0.45rem' }}>{s}</span>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      if (p.type === 'table') {
                        const t = p.value;
                        return (
                          <div key={i} style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                            <table style={{ fontSize: '0.8rem', width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(92,107,192,0.2)' }}>
                              <thead style={{ background: 'rgba(26,35,126,0.07)' }}>
                                <tr>
                                  {t.headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', borderBottom: '1px solid rgba(92,107,192,0.25)', color: '#1a237e', fontWeight: 650 }}>{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {t.rows.map((r, ri) => (
                                  <tr key={ri} style={{ background: ri % 2 === 1 ? 'rgba(26,35,126,0.02)' : '#fff' }}>
                                    {r.map((cell, ci) => <td key={ci} style={{ padding: '0.5rem 0.7rem', borderBottom: '1px solid rgba(92,107,192,0.1)' }}>{cell}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {m.suggestions?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                      {m.suggestions.map(s => (
                        <button key={s} className="suggestion-chip" onClick={() => send(s)}>
                          {s.length > 48 ? s.slice(0, 48) + '…' : s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.35)', marginTop: '0.2rem', padding: '0 0.25rem' }}>{fmtTime(m.time)}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message bot">
                <div className="chat-avatar">AI</div>
                <div>
                  <div className="chat-bubble">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="suggestions">
            {suggestedQuestions.map(s => (
              <button key={s} className="suggestion-chip" onClick={() => send(s)}>
                <FontAwesomeIcon icon="lightbulb" style={{ marginRight: 6 }} />{s.length > 42 ? s.slice(0, 42) + '…' : s}
              </button>
            ))}
          </div>

          <form
            className="chat-input"
            onSubmit={e => { e.preventDefault(); send(input); }}
          >
            <input
              type="text"
              placeholder="Ask about candidates, rankings, jobs, reports…"
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{
                flex: 1, padding: '0.6rem 0.85rem', borderRadius: 12,
                border: '1.5px solid var(--border-color)', fontSize: '0.9rem', outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={e => e.target.style.cssText += ';border-color:var(--primary-light);box-shadow:0 0 0 3px rgba(92,107,192,0.1);'}
              onBlur={e => e.target.style.cssText += ';border-color:var(--border-color);box-shadow:none;'}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !input.trim()}
              style={{ padding: '0.55rem 1.2rem', borderRadius: 12 }}
            >
              {loading ? <span className="spinner spinner-sm spinner-gold"></span> : <><FontAwesomeIcon icon="paper-plane" style={{ marginRight: 6 }} />Send</>}
            </button>
          </form>
        </div>

        <div>
          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="lightbulb" style={{ marginRight: 6 }} />What I can help with</div>
            <div className="card-body" style={{ padding: '1rem 1.25rem', fontSize: '0.84rem', color: 'var(--text-gray)', lineHeight: 1.7 }}>
              <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                <li>Find top candidates for any role with filters</li>
                <li>Compare two or three candidates side-by-side</li>
                <li>Search by specific skills, experience, or degree</li>
                <li>Explain why a candidate was ranked where they are</li>
                <li>Summarize a batch of CVs in a few bullets</li>
                <li>Generate shortlists by criteria</li>
              </ul>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header"><FontAwesomeIcon icon="chart-bar" style={{ marginRight: 6 }} />Recent Searches</div>
            <div className="card-body" style={{ padding: '0.5rem 0.75rem' }}>
              {recent.length === 0 ? (
                <div style={{ padding: '0.6rem', color: 'var(--text-light)', fontSize: '0.82rem' }}>No searches yet. Start by trying a suggestion!</div>
              ) : recent.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.55rem 0.6rem', fontSize: '0.82rem',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: 'var(--primary-dark)',
                    borderRadius: 8, fontWeight: 500,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <FontAwesomeIcon icon="clock" style={{ marginRight: 6 }} /> {q}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><FontAwesomeIcon icon="tags" style={{ marginRight: 6 }} />Popular Topics</div>
            <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {['Ranking Methodology','Score Breakdown','Shortlists','OCR Accuracy','Skill Matching','Semantic Similarity','Data Privacy','Bias Mitigation'].map(t => (
                  <span key={t} className="tag tag-gold" style={{ cursor: 'pointer' }} onClick={() => send(`Tell me about ${t.toLowerCase()}`)}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
};

export default RecruiterChatbot;