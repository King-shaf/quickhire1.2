import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'recruiter',
    companyName: '',
    companySize: '',
    companyIndustry: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authService.getSession();
        if (session) {
          navigate('/dashboard');
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.role === 'company' && (!formData.companyName || !formData.companySize || !formData.companyIndustry)) {
      setError('Please fill in all company details');
      return;
    }

    setLoading(true);
    try {
      await authService.register(formData.email, formData.password, formData);
      navigate('/login');
    } catch (err) {
      let msg = (err && typeof err.message === 'string' ? err.message : '') || (typeof err === 'string' ? err : '');
      if (!msg || msg.trim() === '{}' || msg.trim() === '[]' || msg.trim() === '[object Object]') {
        msg = 'An account with this email or username already exists. Please sign in instead.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6 col-lg-5">
        <button onClick={() => navigate(-1)} className="btn btn-outline-secondary mb-3">&larr; Back</button>
        <div className="card shadow-lg border-0">
          <div className="card-body p-4">
            <h2 className="text-center mb-4 fw-bold text-primary">Sign Up</h2>
            <p className="text-center text-muted mb-4">Create your QuickHire AI account</p>
            
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            
            <form onSubmit={handleRegister}>
              <div className="row">
                <div className="col-md-6 mb-3 text-start">
                  <label className="form-label small fw-bold">First Name</label>
                  <input 
                    type="text" 
                    name="firstName"
                    className="form-control form-control-lg shadow-sm" 
                    value={formData.firstName} 
                    onChange={handleChange} 
                    placeholder="First Name"
                    required 
                  />
                </div>
                <div className="col-md-6 mb-3 text-start">
                  <label className="form-label small fw-bold">Last Name</label>
                  <input 
                    type="text" 
                    name="lastName"
                    className="form-control form-control-lg shadow-sm" 
                    value={formData.lastName} 
                    onChange={handleChange} 
                    placeholder="Last Name"
                    required 
                  />
                </div>
              </div>
              <div className="mb-3 text-start">
                <label className="form-label small fw-bold">Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  className="form-control form-control-lg shadow-sm" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="Enter your email"
                  required 
                />
              </div>
              <div className="mb-3 text-start">
                <label className="form-label small fw-bold">Password</label>
                <div className="input-group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    className="form-control form-control-lg shadow-sm border-end-0" 
                    value={formData.password} 
                    onChange={handleChange} 
                    placeholder="Create a password"
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary shadow-sm border-start-0 bg-white text-muted"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="mb-4 text-start">
                <label className="form-label small fw-bold">Confirm Password</label>
                <div className="input-group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="confirmPassword"
                    className="form-control form-control-lg shadow-sm border-end-0" 
                    value={formData.confirmPassword} 
                    onChange={handleChange} 
                    placeholder="Repeat your password"
                    required 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary shadow-sm border-start-0 bg-white text-muted"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              
              <div className="mb-4 text-start">
                <label className="form-label small fw-bold">Select Role</label>
                <select 
                  name="role"
                  className="form-select form-select-lg shadow-sm" 
                  value={formData.role} 
                  onChange={handleChange}
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="company">Company</option>
                </select>
              </div>

              {formData.role === 'company' && (
                <>
                  <div className="mb-3 text-start">
                    <label className="form-label small fw-bold">Company Name</label>
                    <input 
                      type="text" 
                      name="companyName"
                      className="form-control form-control-lg shadow-sm" 
                      value={formData.companyName} 
                      onChange={handleChange} 
                      placeholder="Company Name"
                      required 
                    />
                  </div>
                  <div className="mb-3 text-start">
                    <label className="form-label small fw-bold">Company Size</label>
                    <select 
                      name="companySize"
                      className="form-select form-select-lg shadow-sm" 
                      value={formData.companySize} 
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                  <div className="mb-4 text-start">
                    <label className="form-label small fw-bold">Industry</label>
                    <input 
                      type="text" 
                      name="companyIndustry"
                      className="form-control form-control-lg shadow-sm" 
                      value={formData.companyIndustry} 
                      onChange={handleChange} 
                      placeholder="e.g., Technology, Healthcare, Finance"
                      required 
                    />
                  </div>
                </>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary btn-lg w-100 shadow-sm fw-bold mb-3"
                disabled={loading}
              >
                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : 'Sign Up'}
              </button>
            </form>
            
            <div className="text-center mt-3">
              <span className="text-muted small">Already have an account? </span>
              <Link to="/login" className="small fw-bold text-decoration-none">Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
