import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FormattedMessage from './FormattedMessage';
import { chatbotService } from '../services/supabaseService';
import { useUser } from '../context/UserContext';

const ChatbotWidget = () => {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your AI Recruitment Assistant. I can tell you about any candidate in detail, explain ranking scores, or answer questions about the system. How can I help you?", isBot: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMessage = { text: prompt, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const sessionId = `widget-${user?.id || 'anon'}`;
      const res = await chatbotService.sendMessage(prompt, sessionId, user?.id, user?.company_id);
      
      const botResponse = {
        text: res?.text || "I analyzed the database, but no textual output was returned.",
        isBot: true,
        candidates: res?.candidates || [],
        table: res?.table || null,
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (err) {
      console.error("Chatbot widget error", err);
      const errorMsg = { text: "Sorry, I'm having trouble connecting right now. Please try again later.", isBot: true };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        className="btn btn-primary rounded-circle position-fixed bottom-0 end-0 m-4 shadow-lg" 
        style={{ width: '60px', height: '60px', zIndex: 1000 }}
        onClick={() => setIsOpen(true)}
      >
        <FontAwesomeIcon icon="comment" size="2x" />
      </button>
    );
  }

  return (
    <div className="card position-fixed bottom-0 end-0 m-4 shadow-lg" style={{ width: '350px', height: '500px', zIndex: 1000 }}>
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">QuickHire Assistant</h5>
        <button className="btn-close btn-close-white" onClick={() => setIsOpen(false)}></button>
      </div>
      <div className="card-body overflow-auto" style={{ height: '350px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`d-flex flex-column mb-3 ${msg.isBot ? 'align-items-start' : 'align-items-end'}`}>
            <div className={`p-2 rounded-3 ${msg.isBot ? 'bg-light text-dark' : 'bg-primary text-white'}`} style={{ maxWidth: '88%', fontSize: '0.84rem' }}>
              {msg.isBot ? (
                <FormattedMessage text={msg.text} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              )}
            </div>
            {msg.table && (
              <div className="mt-2 w-100 overflow-auto" style={{ maxWidth: '95%' }}>
                <table className="table table-sm table-bordered bg-white shadow-sm mb-1" style={{ fontSize: '0.72rem', borderRadius: 6, overflow: 'hidden' }}>
                  <thead className="table-light">
                    <tr>
                      {msg.table.headers.map((h, hi) => <th key={hi} style={{ padding: '4px 6px', color: '#1a237e' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {msg.table.rows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 1 ? 'rgba(26,35,126,0.02)' : '#fff' }}>
                        {row.map((cell, ci) => <td key={ci} style={{ padding: '4px 6px' }}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {msg.candidates && msg.candidates.length > 0 && (
              <div className="mt-2 w-100" style={{ maxWidth: '88%' }}>
                {msg.candidates.map((c, ci) => (
                  <div key={ci} className="p-2 mb-1 rounded bg-white border shadow-sm" style={{ fontSize: '0.78rem' }}>
                    <div className="d-flex justify-content-between font-weight-bold">
                      <strong className="text-primary">{c.name}</strong>
                      <span className="badge bg-success">{Math.round((c.relevance_score || 0.8) * 100)}%</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Exp: {c.years_experience || 0} yrs | Skills: {(c.all_skills || []).slice(0, 3).join(', ') || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-center"><div className="spinner-border spinner-border-sm text-primary" role="status"></div></div>}
      </div>
      <div className="card-footer">
        <form onSubmit={handleSend} className="input-group">
          <input 
            type="text" 
            className="form-control" 
            placeholder="Type a message..." 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
          />
          <button className="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotWidget;
