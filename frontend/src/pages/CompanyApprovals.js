import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CompanyLayout from '../components/CompanyLayout';
import { useUser } from '../context/UserContext';
import { companyService, ensureCompanyForUser } from '../services/supabaseService';

const CompanyApprovals = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        let cid = user?.company_id || user?.companies?.id;
        if (!cid && user) {
          cid = await ensureCompanyForUser(user);
        }
        if (!cid) {
          setItems([]);
          return;
        }
        const raw = await companyService.getShortlistApprovals(cid);
        const filtered = (raw || []).filter(
          (item) => item.status === 'pending' && !(item.details && item.details.approved !== undefined)
        );
        setItems(filtered);
      } catch (err) {
        console.error('Failed to load approvals', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 2500);
  };

  const handleApprove = async (id) => {
    try {
      await companyService.approveAction(id, true);
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast('Approval submitted successfully', 'success');
    } catch (err) {
      console.error('Approve failed', err);
    }
  };

  const handleReject = async (id) => {
    try {
      await companyService.approveAction(id, false);
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast('Rejection submitted successfully', 'secondary');
    } catch (err) {
      console.error('Reject failed', err);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="spinner spinner-lg"></div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div
            style={{
              margin: '0 auto 1rem auto',
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(46,125,50,0.12)',
              display: 'grid',
              placeItems: 'center',
              color: '#2e7d32',
            }}
          >
            <FontAwesomeIcon icon="clipboard-check" style={{ fontSize: '1.5rem' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0' }}>All caught up</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>
            No recruiter decisions are waiting on your approval.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4" style={{ display: 'grid', gap: '1rem' }}>
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.action}</div>
                  <div style={{ marginTop: '0.25rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    {item.target}
                  </div>
                  <div style={{ marginTop: '0.5rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                    <FontAwesomeIcon icon="clock" style={{ marginRight: 4 }} />
                    Requested by <strong style={{ color: 'var(--text-dark)' }}>{item.recruiter}</strong> · {item.time}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => handleReject(item.id)}
                  >
                    <FontAwesomeIcon icon="xmark" style={{ marginRight: 4 }} />
                    Reject
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApprove(item.id)}
                  >
                    <FontAwesomeIcon icon="check" style={{ marginRight: 4 }} />
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <CompanyLayout user={user} title="Approvals">
      {toast && (
        <div
          className={`alert alert-${toast.variant}`}
          style={{
            marginBottom: '1rem',
            padding: '0.6rem 1rem',
            fontSize: '0.85rem',
          }}
          role="alert"
        >
          <FontAwesomeIcon icon="check" style={{ marginRight: 6 }} />
          {toast.message}
        </div>
      )}
      {renderContent()}
    </CompanyLayout>
  );
};

export default CompanyApprovals;
