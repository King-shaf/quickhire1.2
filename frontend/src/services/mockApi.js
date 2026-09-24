const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const mockUser = {
  id: 'u-demo-1',
  first_name: 'Sarah',
  last_name: 'Johnson',
  email: 'sarah.johnson@quickhire.edu',
  username: 'sarahj',
  role: 'recruiter',
  company_id: 'c-demo',
  created_at: '2026-01-15T09:00:00Z',
  last_login: '2026-07-25T08:30:00Z',
  is_active: true,
};

const mockAdmin = {
  id: 'u-admin-1',
  first_name: 'Michael',
  last_name: 'Chen',
  email: 'admin@quickhire.edu',
  username: 'admin',
  role: 'admin',
  created_at: '2025-06-01T08:00:00Z',
  last_login: '2026-07-25T07:00:00Z',
  is_active: true,
};

const SESSION_KEY = 'qh_mock_session';
const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
};
const setSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

export const authService = {
  login: async (email, password) => {
    await delay(700);
    if (!email || !password) throw new Error('Email and password are required');
    let user = mockUser;
    if (email.toLowerCase().includes('admin')) user = mockAdmin;
    const session = { token: 'mock-jwt-' + Date.now(), user, expiresAt: Date.now() + 3600 * 1000 };
    setSession(session);
    return session;
  },
  register: async (email, password, userData = {}) => {
    await delay(900);
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    if (!email.includes('@')) throw new Error('Invalid email format');
    const newUser = {
      id: 'u-' + Date.now(),
      first_name: userData.firstName || 'New',
      last_name: userData.lastName || 'User',
      email,
      username: userData.username || email.split('@')[0],
      role: userData.role || 'recruiter',
      company_id: userData.company_id || 'c-demo',
      created_at: new Date().toISOString(),
      is_active: true,
    };
    return { user: newUser, verification: true };
  },
  logout: async () => { await delay(200); clearSession(); },
  getSession: async () => {
    const s = getSession();
    if (!s) return null;
    if (s.expiresAt < Date.now()) { clearSession(); return null; }
    return s;
  },
  getUserProfile: async () => {
    const s = getSession();
    if (!s) throw new Error('Not authenticated');
    return s.user;
  },
};

export const candidateService = {
  uploadCV: async (file) => {
    await delay(800 + Math.random() * 1200);
    return {
      id: 'cv-' + Date.now(),
      name: file.name,
      size: file.size,
      upload_status: 'complete',
      processing_status: Math.random() > 0.1 ? 'complete' : 'processing',
      uploaded_at: new Date().toISOString(),
    };
  },
  processCVPipeline: async (cvId) => {
    const steps = [
      { key: 'upload', label: 'Upload Complete' },
      { key: 'ocr', label: 'OCR Processing' },
      { key: 'nlp', label: 'NLP Analysis' },
      { key: 'embedding', label: 'Embedding Generation' },
      { key: 'complete', label: 'Complete' },
    ];
    const result = [];
    for (let i = 0; i < steps.length; i++) {
      await delay(400 + Math.random() * 400);
      result.push({ ...steps[i], status: i === steps.length - 1 ? 'complete' : (i === 0 ? 'complete' : 'complete') });
    }
    return { cvId, steps: result };
  },
  getCandidates: async () => {
    await delay(400);
    const firstNames = ['David','Emma','James','Olivia','Liam','Sophia','Noah','Ava','Ethan','Isabella','Lucas','Mia','Mason','Charlotte','Elijah','Amelia','Logan','Harper','Aiden','Evelyn','Jackson','Abigail','Grayson','Emily','Carter','Ella','Sebastian','Scarlett','Jack','Grace','Owen','Chloe','Samuel','Victoria','Joseph','Riley','Henry','Aria','Alexander','Lily','Daniel','Aubrey','Matthew','Zoey','Gabriel','Hannah','Anthony','Lillian','Isaac','Addison'];
    const lastNames = ['Smith','Johnson','Brown','Taylor','Anderson','Wilson','Davis','Martinez','Garcia','Rodriguez','Lee','Walker','Hall','Allen','Young','King','Wright','Scott','Green','Baker','Adams','Nelson','Carter','Mitchell','Perez','Roberts','Turner','Phillips','Campbell','Parker','Evans','Edwards','Collins','Stewart','Sanchez','Morris','Rogers','Reed','Cook','Morgan'];
    const skills = ['Python','React','JavaScript','TypeScript','Node.js','Django','PostgreSQL','MongoDB','AWS','Docker','Kubernetes','Java','Spring Boot','SQL','Machine Learning','TensorFlow','PyTorch','NLP','Computer Vision','Leadership','Project Management','Agile','Scrum','Communication'];
    const degrees = ['B.Sc. Computer Science','M.Sc. Artificial Intelligence','B.Eng. Software Engineering','Ph.D. Machine Learning','B.Com. Information Systems','M.B.A. Technology Management','B.Tech Electronics','M.Sc. Data Science'];
    const universities = ['University of Technology','State University','Institute of Technology','Polytechnic University','College of Engineering','National University'];
    const candidates = [];
    for (let i = 0; i < 47; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const score = 0.42 + Math.random() * 0.56;
      const yoe = Math.floor(Math.random() * 14);
      const skillCount = 4 + Math.floor(Math.random() * 7);
      const selectedSkills = [];
      const used = new Set();
      while (selectedSkills.length < skillCount) {
        const s = skills[Math.floor(Math.random() * skills.length)];
        if (!used.has(s)) { used.add(s); selectedSkills.push(s); }
      }
      const degree = degrees[Math.floor(Math.random() * degrees.length)];
      candidates.push({
        id: 'cand-' + i,
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.edu`,
        phone: '+1 (555) ' + String(100 + Math.floor(Math.random()*900)) + '-' + String(1000 + Math.floor(Math.random()*9000)),
        relevance_score: score,
        similarity_score: score * 0.95 + Math.random() * 0.05,
        skill_match_score: score * 0.92 + Math.random() * 0.08,
        years_experience: yoe,
        education: {
          degree,
          institution: universities[Math.floor(Math.random() * universities.length)],
          year: 2016 + Math.floor(Math.random() * 8),
        },
        education_history: [
          { degree, institution: universities[Math.floor(Math.random() * universities.length)], year: 2016 + Math.floor(Math.random() * 8), details: 'Thesis on distributed information systems.' },
        ],
        work_experience: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, (_, idx) => ({
          title: ['Software Engineer','Senior Developer','Data Scientist','ML Engineer','Full Stack Developer','Team Lead','Backend Engineer','Research Assistant'][Math.floor(Math.random()*8)],
          company: ['TechCorp Inc.','DataFlow Systems','InnoLabs','CloudNine Solutions','Acme Digital','Northwind Analytics','BlueHarbor Tech'][Math.floor(Math.random()*7)],
          duration: `${Math.max(2016, 2024-yoe)} - ${idx === 0 ? 'Present' : 2016 + Math.floor(Math.random() * 7)}`,
          description: 'Developed and maintained scalable applications using modern frameworks. Collaborated with cross-functional teams to deliver high-quality software on schedule.',
        })),
        skills: {
          technical: selectedSkills.slice(0, Math.ceil(selectedSkills.length * 0.75)),
          soft: ['Communication','Teamwork','Problem Solving','Adaptability','Leadership','Time Management','Critical Thinking'].slice(0, 2 + Math.floor(Math.random()*3)),
        },
        all_skills: selectedSkills,
        raw_text: `${fn} ${ln} — ${degree} at ${universities[0]}. ${yoe}+ years of experience. Expertise in ${selectedSkills.join(', ')}.`,
        ocr_confidence: 0.82 + Math.random() * 0.17,
        shortlisted: Math.random() > 0.78,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000).toISOString(),
        cv_url: '#',
      });
    }
    return candidates.sort((a, b) => b.relevance_score - a.relevance_score);
  },
};

export const jobService = {
  createJob: async (jobData) => {
    await delay(700);
    return {
      id: 'job-' + Date.now(),
      title: jobData.title,
      description_text: jobData.description_text,
      required_skills: jobData.required_skills || [],
      preferred_skills: jobData.preferred_skills || [],
      industry: jobData.industry || 'Technology',
      created_at: new Date().toISOString(),
      status: 'processing',
    };
  },
  getJobs: async () => {
    await delay(300);
    return [
      { id: 'job-1', title: 'Senior Software Engineer (Full Stack)', created_at: '2026-07-20', status: 'complete', candidate_count: 47, department: 'Engineering' },
      { id: 'job-2', title: 'Machine Learning Researcher', created_at: '2026-07-18', status: 'complete', candidate_count: 31, department: 'Research' },
      { id: 'job-3', title: 'Data Platform Engineer', created_at: '2026-07-22', status: 'processing', candidate_count: 19, department: 'Data' },
      { id: 'job-4', title: 'NLP Specialist (Contract)', created_at: '2026-07-24', status: 'queued', candidate_count: 8, department: 'AI' },
    ];
  },
  analyzeJob: async (jobId) => {
    await delay(1500);
    return { id: jobId, status: 'complete', extracted_skills: ['Python','TypeScript','React','AWS','PostgreSQL'] };
  },
};

export const rankingService = {
  getRankings: async (jobId) => {
    const candidates = await candidateService.getCandidates();
    return candidates.map((c, i) => ({
      id: 'rank-' + i,
      candidate_id: c.id,
      rank_position: i + 1,
      overall_score: c.relevance_score,
      similarity_score: c.similarity_score,
      skill_match_score: c.skill_match_score,
      candidate: c,
      job_id: jobId,
      breakdown: {
        experience: 0.6 + Math.random() * 0.4,
        education: 0.5 + Math.random() * 0.5,
        skills: c.skill_match_score,
        semantics: c.similarity_score,
      },
      matched_requirements: c.all_skills.slice(0, 5).map(s => ({ skill: s, matched: Math.random() > 0.2 })),
    }));
  },
  getCandidate: async (id) => {
    const list = await candidateService.getCandidates();
    const candidate = list.find(c => c.id === id) || list[0];
    return { data: candidate };
  },
  rankNow: async (jobId) => {
    await delay(2500);
    return { jobId, ranked: 47, status: 'complete' };
  },
};

export const chatbotService = {
  sendMessage: async (message, history = []) => {
    await delay(700 + Math.random() * 900);
    const m = message.toLowerCase();
    const responses = {
      top: () => ({
        type: 'card-list',
        text: "Here are the top 5 candidates for Software Developer positions based on recent job postings. Would you like me to filter by experience or specific skills?",
        cards: [
          { name: 'James Wilson', score: 0.94, skills: ['Python','React','AWS'], yoe: 7 },
          { name: 'Sophia Martinez', score: 0.91, skills: ['TypeScript','Node.js','Docker'], yoe: 5 },
          { name: 'Ethan Brown', score: 0.89, skills: ['Java','Spring Boot','PostgreSQL'], yoe: 6 },
          { name: 'Olivia Lee', score: 0.87, skills: ['Python','Django','TensorFlow'], yoe: 4 },
          { name: 'Liam Taylor', score: 0.85, skills: ['JavaScript','React','MongoDB'], yoe: 5 },
        ],
      }),
      python: () => ({
        type: 'card-list',
        text: "Found 12 candidates with Python and 5+ years of experience. Here are the top 3 matches:",
        cards: [
          { name: 'Amelia Davis', score: 0.93, skills: ['Python','Django','PostgreSQL','AWS'], yoe: 8 },
          { name: 'Noah Garcia', score: 0.9, skills: ['Python','FastAPI','TensorFlow','Docker'], yoe: 6 },
          { name: 'Mia Robinson', score: 0.88, skills: ['Python','Flask','PyTorch','Kubernetes'], yoe: 7 },
        ],
      }),
      master: () => ({
        type: 'info',
        text: "Great question! I found 8 candidates who hold a Master's degree:\n\n• Amelia Davis — M.Sc. Artificial Intelligence\n• Noah Garcia — M.Sc. Data Science\n• Harper Clark — M.B.A. Technology Management\n• Lily Walker — M.Sc. Machine Learning\n• Henry Lewis — M.Eng. Software Systems\n• Evelyn Hall — M.Sc. Computational Linguistics\n• Jack Young — M.Sc. Computer Science\n• Charlotte King — M.B.A. Data Analytics\n\nWould you like to see their full profiles?",
      }),
      compare: () => ({
        type: 'compare',
        text: "Here's a side-by-side comparison of these candidates. You can also open the Compare view from the Ranked Candidates page for a detailed breakdown.",
        table: {
          headers: ['Metric', 'Candidate X', 'Candidate Y'],
          rows: [
            ['Relevance Score', '92.4%', '89.1%'],
            ['Years of Experience', '7 yrs', '5 yrs'],
            ['Skill Matches', '14 / 16', '11 / 16'],
            ['Highest Degree', 'M.Sc.', 'B.Sc.'],
            ['OCR Confidence', '96.2%', '94.5%'],
          ],
        },
      }),
      hello: () => ({ type: 'text', text: "Hello! 👋 I'm your AI recruitment assistant. I can help you:\n\n• Find top candidates for specific roles\n• Search by skills, experience, or education\n• Compare candidates side by side\n• Explain ranking decisions\n\nWhat would you like to explore?" }),
    };
    if (m.includes('top') && m.includes('candidate')) return responses.top();
    if (m.includes('python') || m.includes('5+ year') || m.includes('year experience')) return responses.python();
    if (m.includes('master') || m.includes("master's") || m.includes('phd') || m.includes('degree')) return responses.master();
    if (m.includes('compare')) return responses.compare();
    if (m.includes('hello') || m.includes('hi ') || m === 'hi' || m.includes('greeting')) return responses.hello();
    return {
      type: 'text',
      text: "Thanks for your question! I've noted your query about: \"" + message + "\".\n\nFor deeper results, try using the Candidate Search page with specific filters, or try one of these suggested prompts:\n\n• \"Show me top 5 candidates for Software Developer\"\n• \"Find candidates with Python and 5+ years experience\"\n• \"Which candidates have a Master's degree?\"\n• \"Compare candidate X and candidate Y\"",
    };
  },
};

export const reportService = {
  generateReport: async ({ jobId, range, format }) => {
    await delay(1800);
    return {
      id: 'rpt-' + Date.now(),
      job_id: jobId,
      range,
      format,
      url: '#',
      file_size: format === 'PDF' ? '1.8 MB' : '0.4 MB',
      created_at: new Date().toISOString(),
    };
  },
  getReports: async () => {
    await delay(300);
    return [
      { id: 'rpt-1', job_title: 'Senior Software Engineer (Full Stack)', range: 'Top 20', format: 'PDF', date: '2026-07-20', size: '1.8 MB' },
      { id: 'rpt-2', job_title: 'Machine Learning Researcher', range: 'All', format: 'Excel', date: '2026-07-19', size: '0.6 MB' },
      { id: 'rpt-3', job_title: 'Data Platform Engineer', range: 'Top 10', format: 'PDF', date: '2026-07-22', size: '1.1 MB' },
      { id: 'rpt-4', job_title: 'Senior Software Engineer (Full Stack)', range: 'All', format: 'PDF', date: '2026-07-15', size: '3.2 MB' },
      { id: 'rpt-5', job_title: 'DevOps Engineer', range: 'Top 20', format: 'Excel', date: '2026-07-10', size: '0.5 MB' },
    ];
  },
};

export const adminService = {
  getAllUsers: async () => {
    await delay(400);
    const roles = ['recruiter', 'recruiter', 'recruiter', 'recruiter', 'company', 'company', 'admin'];
    const firstNames = ['Sarah','Michael','Emily','David','Emma','James','Olivia','Liam','Sophia','Noah','Ava','Ethan','Mia','Lucas','Isabella','Amelia','Elijah','Charlotte','Logan','Harper','Aiden','Evelyn','Jackson','Abigail','Henry','Grace','Sebastian','Chloe','Jack','Victoria'];
    const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson'];
    return Array.from({ length: 28 }, (_, i) => {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const role = roles[i % roles.length];
      return {
        id: 'u-' + (i + 1),
        username: (fn[0] + ln).toLowerCase(),
        first_name: fn,
        last_name: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@quickhire.edu`,
        role,
        is_active: i !== 7 && i !== 21,
        last_login: i === 21 ? null : new Date(Date.now() - Math.random() * 14 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date(Date.now() - (30 + Math.random() * 200) * 24 * 3600 * 1000).toISOString(),
      };
    });
  },
  updateUser: async (userId, updates) => {
    await delay(400);
    return { id: userId, ...updates };
  },
  deleteUser: async (userId) => { await delay(500); return { id: userId, deleted: true }; },
  resetPassword: async (userId) => { await delay(400); return { id: userId, temp_password: 'QH-Temp-' + Math.random().toString(36).slice(2, 8) }; },
  addUser: async (data) => {
    await delay(600);
    return {
      id: 'u-' + Date.now(),
      username: data.username,
      email: data.email,
      role: data.role,
      first_name: data.first_name || data.username,
      last_name: data.last_name || '',
      is_active: true,
      created_at: new Date().toISOString(),
    };
  },
  getSystemStats: async () => {
    await delay(250);
    return {
      server: { cpu: 34 + Math.random() * 10, ram: 48 + Math.random() * 8, storage: 62 + Math.random() * 5, uptime_hours: 742 },
      sessions: { active: 31 + Math.floor(Math.random() * 12) },
      queue: { pending: 3 + Math.floor(Math.random() * 8), processing: 1 + Math.floor(Math.random() * 3) },
      api: { avg_response_ms: 118 + Math.floor(Math.random() * 60), error_rate: Math.random() * 1.2 },
      users: { total: 28, active_today: 17, recent_registrations: 5 },
      ai_models: { current: 'semantic-v3.2', embedding: 'bge-large-en-v1.5', ocr: 'paddleocr-v2.7', last_update: '2026-07-18' },
    };
  },
  getSystemConfig: async () => {
    await delay(250);
    return {
      general: { name: 'QUICK HIRE', default_language: 'English', timezone: 'UTC-5 (EST)' },
      ai: { model: 'semantic-v3.2', embedding: 'bge-large-en-v1.5', ocr_language: 'en', ocr_confidence: 0.75, nlp_pipeline: 'spacy-en + gemini-flash' },
      performance: { max_concurrent: 8, caching: 'Redis (enabled)', rate_limit: '500 requests/min' },
      security: { session_timeout: 60, max_login_attempts: 5, password_policy: 'Strong (12+ chars, mixed case, numbers, symbols)' },
    };
  },
  saveSystemConfig: async (section, data) => { await delay(500); return { section, saved: true }; },
  getAuditLogs: async (filters = {}) => {
    await delay(300);
    const actions = ['Login','Logout','Upload CV','Create Job','Rank Candidates','Generate Report','Download CV','Update User','Change Role','Deactivate User','Reset Password','Update Config','Backup Database','View Ranking','Search Candidates'];
    const users = ['sarahj','admin','emilyw','davidt','olivial','liamw','sophiam','noahg','avab','ethanr','miam','lucasp'];
    const details = [
      'Successful authentication via email.',
      'Uploaded batch of 12 CV documents (PDF).',
      'Created new job: Senior Software Engineer.',
      'Initiated ranking for job-id: job-47.',
      'Exported PDF report for Top 20 candidates.',
      'Updated user profile fields for u-12.',
      'Changed role of u-18 from recruiter to company.',
      'Reset password via admin panel.',
      'Deactivated user u-21 (policy violation).',
      'Updated AI model configuration to semantic-v3.2.',
      'Manual database backup executed successfully.',
    ];
    return Array.from({ length: 42 }, (_, i) => {
      const action = actions[Math.floor(Math.random() * actions.length)];
      return {
        id: 'log-' + (i + 1),
        timestamp: new Date(Date.now() - i * 3600 * 1000 * (0.6 + Math.random() * 4)).toISOString(),
        user: users[Math.floor(Math.random() * users.length)],
        action,
        details: details[Math.floor(Math.random() * details.length)],
        ip_address: `${10 + Math.floor(Math.random() * 230)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
      };
    });
  },
  exportAuditLogs: async () => { await delay(600); return { url: '#', filename: 'audit-log-' + Date.now() + '.csv' }; },
};

export const activityService = {
  getFeed: async () => {
    await delay(250);
    return [
      { time: '5 minutes ago', title: 'You uploaded 12 CVs', desc: 'All documents passed OCR pre-validation.', icon: '📄', type: 'success' },
      { time: '22 minutes ago', title: 'Job description processed', desc: 'Senior Software Engineer — skills extracted: 16.', icon: '📝', type: 'success' },
      { time: '1 hour ago', title: '5 candidates ranked', desc: 'Best match scored 94.1% relevance.', icon: '🏆', type: 'success' },
      { time: '3 hours ago', title: 'Report generated', desc: 'PDF report for "ML Researcher" — Top 20.', icon: '📈', type: 'success' },
      { time: 'Yesterday, 18:42', title: 'Chatbot query resolved', desc: 'Answered 7 candidate ranking questions.', icon: '🤖', type: 'info' },
      { time: '2 days ago', title: 'AI model updated', desc: 'Embedding model upgraded to bge-large-en-v1.5.', icon: '🧠', type: 'info' },
    ];
  },
};

const services = {
  authService, candidateService, jobService, rankingService, chatbotService, reportService, adminService, activityService,
};

export default services;
