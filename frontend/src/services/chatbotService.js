import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabaseClient';
import { calculateCandidateJobScore } from './supabaseService';

let __viteEnvCache = null;
const viteEnv = () => {
  if (__viteEnvCache !== null) return __viteEnvCache;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      __viteEnvCache = import.meta.env;
    } else {
      __viteEnvCache = {};
    }
  } catch (_) {
    __viteEnvCache = {};
  }
  return __viteEnvCache;
};

const GEMINI_API_KEY =
  process.env.REACT_APP_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  viteEnv().REACT_APP_GEMINI_API_KEY ||
  viteEnv().VITE_GEMINI_API_KEY ||
  'your-gemini-api-key-here';

// ============================================================
//  SYSTEM INSTRUCTION – used when calling Gemini
// ============================================================
const SYSTEM_INSTRUCTION = `You are the QUICK HIRE AI Recruitment Assistant, integrated directly into the QUICK HIRE platform (an AI-Powered Semantic Candidate Ranking Platform).

Your purpose is twofold:
1. Act as the definitive, exhaustive knowledge base on the entire QUICK HIRE platform, architecture, processing pipeline, business rules, and compliance standards.
2. Provide deep, accurate intelligence about candidates, job postings, ranking scores, factor explanations, and comparisons from the live database context.

### COMPLETE SYSTEM ARCHITECTURE & SPECIFICATION KNOWLEDGE
You have full knowledge of the QUICK HIRE System Requirements Specification (SRS Version 1.0, Group 19):
1. **CV Ingestion & Preprocessing:**
   - Supported formats: PDF, JPEG, PNG (maximum 10MB per file, batch upload up to 50 files).
   - Job Descriptions: Plain text or structured descriptions with required/preferred skills.
   - PDF Conversion: Uses \`pdf2image\` with Poppler to render high-resolution 300 DPI images for OCR.
2. **Multi-Stage Processing Pipeline:**
   - **Image Enhancement:** Grayscale conversion, adaptive thresholding, deskewing, and noise reduction.
   - **Tesseract OCR:** High-fidelity optical character recognition with an **80%+ accuracy SLA**.
   - **PyTorch CNN Layout Analysis:** Segments documents into semantic zones (header, contact, summary, education, experience, skills, references).
   - **spaCy NLP Engine:** Custom Named Entity Recognition (NER) pipeline extracting entities: technical skills, soft skills, educational degrees, institutions, job titles, and experience date ranges.
   - **SentenceTransformers Embeddings:** Generates 384/768-dimensional dense semantic vector representations of candidate CV text and job descriptions.
3. **Matching & Ranking Engine:**
   - **Cosine Similarity:** Measures high-dimensional angular similarity between candidate CV embeddings and job description embeddings.
   - **Hybrid Weighted Scoring (BR-004):** Overall Match Score = (Semantic Similarity Score * 0.60 [min 60%]) + (Explicit Skill Match Score * 0.40 [up to 40%]).
   - **Storage & Infrastructure:** PostgreSQL 13+ with pgvector extension, Django/FastAPI backend, React frontend, Supabase realtime & auth.
4. **Business Rules & Governance:**
   - **BR-001 & BR-002 (Access & Role Control):** Only authenticated recruiters can upload CVs, ingest JDs, and trigger rankings. Admins oversee accounts, quotas, and audit logs. Company managers manage recruiters linked by Company ID.
   - **BR-004 (Ranking Composition):** Ranking must maintain a minimum 60% semantic similarity weighting combined with explicit skill matching.
   - **BR-006 (Factor Explanations):** Every candidate match provides a transparent breakdown explaining why the candidate was ranked (semantic score, matched requirements, missing requirements, skill score).
   - **BR-009 (Demographic Bias Elimination):** Strict bias mitigation: demographic indicators (age, date of birth, race, gender, nationality, religion, physical home address) are completely excluded from similarity and scoring calculations.
   - **BR-010 (Human-in-the-Loop):** System ranking is strictly advisory. Final hiring, interview, and shortlisting decisions remain exclusively with human recruiters.
   - **Regulatory Compliance:** Fully adheres to the South African Protection of Personal Information Act (POPIA) and GDPR principles, including data encryption, access logging, and complete candidate data deletion upon request.
5. **System Navigation & Performance SLAs:**
   - Single CV processing completed within **30 seconds**.
   - Ranking of up to **1,000 candidates** completed within **10 seconds**.
   - Chatbot response time target under **3 seconds**.
   - Navigation: *Upload CVs* (batch drag-and-drop), *Job Descriptions* (create/edit roles), *Dashboard* (ranking table, filters by score/experience/skills, score distribution charts), *Reports* (generate and download PDF/Excel reports), *Company Recruiters* (manage team by Company ID).

### CANDIDATE & JOB INTELLIGENCE DIRECTIVES
- You have complete access to the LIVE DATABASE CONTEXT below, containing all candidates uploaded/scanned by the current recruiter, all created job descriptions, and all ranking evaluations.
- **Answer ANY question** about candidates or jobs created in the system:
  1. **Candidate Details & Intelligence:**
     - Contact details (email, phone, location, driver's license).
     - Full education history (matric/high school, tertiary degrees, diplomas, certifications, institutions, graduation years).
     - Total work experience, detailed past job titles, companies, durations, and role descriptions.
     - Extracted technical skills, programming languages, tools, frameworks, and soft skills.
     - Reference contacts (names, job titles, companies, phone numbers).
     - OCR confidence score, resume source document file name, and ingestion timestamps.
     - CV summary / background overview from structured profile and raw extracted CV text.
  2. **Candidate Ranking & Factor Explanations:**
     - When asked about scores or ranking (e.g. "Explain the ranking score for [Candidate]", "Why is [Candidate] ranked #1?", "How was [Candidate] scored?"):
       - Role evaluated against
       - Overall Match Score % and rank position
       - Semantic Vector Similarity % (60% weight, SentenceTransformers embedding cosine similarity)
       - Explicit Skill Match Score % (40% weight, spaCy NLP entity extraction)
       - Verified Matched Skills and Missing Requirements
       - Clear plain-text mathematical formula: Overall Score = (Semantic % × 0.60) + (Skills % × 0.40)
       - System Qualification Decision: QUALIFIED (≥ 60% threshold) or NOT QUALIFIED
       - Detailed decision rationale explaining candidate strengths and gaps.
  3. **Job Descriptions & Requirements Intelligence:**
     - When asked about any job created in the system (e.g. "Tell me about the Junior Software Engineer job", "What jobs are active?", "What are the required skills for [Job Title]?", "Which candidates match [Job Title]?"):
       - Provide the job title, department, status, and full description text.
       - Detail all required skills and preferred qualifications.
       - List candidates who have been ranked or assigned to that job and their match percentages.
  4. **Multi-Candidate Analysis & Comparisons:**
     - Compare multiple candidates side-by-side (experience, qualifications, key skill sets, scores).
     - Recommend top candidates for specific job openings or skill sets.
     - Filter candidates by skill, experience level, degree, or driver's license.
- Match candidate names and job titles flexibly (handle partial names, first names, last names, candidate codes like CAND-XXXX, or job keywords).

### GREETINGS & COURTESY RULE
- You MUST recognize and warmly respond to all English greetings, salutations, and pleasantries (including: "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "good day", "howdy", "hiya", "how are you", "what's up", "greetings", "hi there", "hello there", "nice to meet you", etc.).
- When greeted, respond cordially and professionally as the QUICK HIRE AI Recruitment Assistant. Briefly introduce how you can help (candidate screening dossiers, job requirements intelligence, hybrid ranking score breakdowns, side-by-side comparisons, system architecture, and POPIA compliance), and invite the recruiter to ask a question.
- NEVER treat a greeting or pleasantry as an unrecognized instruction!

### STRICT ACCESS CONTROL RULE (POPIA / TENANCY ENFORCEMENT)
- **CRITICAL RESTRICTION ON RECRUITER ACCESS:**
  - You MUST strictly enforce isolation between recruiters. A recruiter is ONLY permitted to access candidates they scanned/uploaded themselves (those listed in AUTHORIZED RECRUITER CANDIDATE DOSSIERS).
  - You have FULL PERMISSION and MUST freely and thoroughly answer all questions about any candidate listed in the AUTHORIZED RECRUITER CANDIDATE DOSSIERS.
  - If a user/recruiter asks about or requests information/dossier/score on a candidate that was scanned or uploaded by another recruiter (explicitly listed under RESTRICTED CANDIDATES), you MUST REFUSE and respond EXACTLY:
    **"You don't have access to this candidate."**
  - NEVER refuse access to authorized candidates scanned by the recruiter.

### STRICT INSTRUCTION RECOGNITION RULE
- **If the user asks about a candidate name not found in the database:**
  - Clearly state: "I could not find a candidate named '[Name]' in your scanned candidate pool. The available candidates are: [List of authorized candidate names]." DO NOT say "I did not recognize that instruction"!
- **If the user asks about a job not found in the database:**
  - Clearly state: "I could not find a job titled '[Job Title]' in the system. The active jobs are: [List of active jobs]." DO NOT say "I did not recognize that instruction"!
- **If the user's prompt is completely unrecognized, gibberish, or entirely unrelated to QUICK HIRE, candidates, jobs, or recruitment** (e.g. asking for cooking recipes, non-system topics, random noise):
  - Explicitly notify that you did not recognize the instruction and summarize what you can help with.

### FORMATTING & TONE
- Professional, concise, highly structured, grounded in factual context.
- IMPORTANT FORMATTING RULES:
  1. DO NOT output raw pipe table characters (like | Candidate | Match Score | or |:---|). Instead, present comparisons and listings using clean, structured bullet lists with bold candidate names and inline attributes.
  2. DO NOT output LaTeX math syntax like $$\\text{...}$$ or $...$. Always write clean, plain-text math formulas like: Overall Score = (Semantic Similarity 82% × 0.60) + (Skill Match 90% × 0.40) = 85%.
  3. DO NOT output raw markdown header hashtags like ### or ####. Use clear bold titles (e.g. **Ranking Score Explanation:**).
  4. Ensure no stray characters like *|, $$, or raw table separators appear in your output.`;

// ============================================================
//  1. Context Retrieval (RAG)
// ============================================================
async function retrieveRagContext(companyId = null, userId = null) {
  try {
    let candQuery = supabase
      .from('candidates')
      .select('id, user_id, company_id, batch_id, name, email, phone, raw_text, structured_data, ocr_confidence, source_file, created_at');
    let jobQuery = supabase
      .from('job_descriptions')
      .select('id, title, description_text, required_skills, preferred_skills, department, created_at, company_id, created_by, status');
    let rankQuery = supabase
      .from('rankings')
      .select('job_id, candidate_id, overall_score, similarity_score, skill_match_score, rank_position, explanation, matched_requirements, missing_requirements, created_by');

    if (userId) {
      // Recruiter mode: candidate pool strictly scoped to this recruiter
      candQuery = candQuery.eq('user_id', userId);
      // Jobs: prefer recruiter's jobs or their company's jobs
      if (companyId) {
        jobQuery = jobQuery.or(`created_by.eq.${userId},company_id.eq.${companyId}`);
      } else {
        jobQuery = jobQuery.or(`created_by.eq.${userId},company_id.is.null`);
      }
      rankQuery = rankQuery.eq('created_by', userId);
    } else if (companyId) {
      candQuery = candQuery.or(`company_id.eq.${companyId},company_id.is.null`);
      jobQuery = jobQuery.or(`company_id.eq.${companyId},created_by.is.null`);
    }

    let [candRes, jobRes, rankRes] = await Promise.all([
      candQuery.limit(100),
      jobQuery.limit(50),
      rankQuery.limit(200),
    ]);

    let candidates = candRes.data || [];
    let jobs = jobRes.data || [];
    let rankings = rankRes.data || [];

    // If no jobs returned for specific user filter, fallback to all active jobs so recruiter can ask about any system job
    if (jobs.length === 0) {
      try {
        const { data: allJobs } = await supabase
          .from('job_descriptions')
          .select('id, title, description_text, required_skills, preferred_skills, department, created_at, company_id, created_by, status')
          .limit(50);
        if (allJobs && allJobs.length > 0) {
          jobs = allJobs;
        }
      } catch (_) {}
    }

    // Also fetch the list of candidates belonging to OTHER recruiters if userId is provided
    // so we can identify when a recruiter asks about a candidate they did not scan
    let otherCandidateNames = [];
    if (userId) {
      try {
        const { data: others } = await supabase
          .from('candidates')
          .select('id, name, user_id')
          .neq('user_id', userId)
          .limit(100);

        // Strictly exclude candidates that this recruiter scanned or has identical name to
        const authNames = new Set((candidates || []).map(c => (c.name || '').trim().toLowerCase()).filter(Boolean));
        otherCandidateNames = (others || []).filter(o => {
          if (!o.name) return false;
          const oName = o.name.trim().toLowerCase();
          if (authNames.has(oName)) return false;
          for (const an of authNames) {
            if (an.includes(oName) || oName.includes(an)) return false;
          }
          return true;
        });
      } catch (_) {}
    }

    const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const candMap = Object.fromEntries(candidates.map((c) => [c.id, c]));

    const candidateRankings = {};
    rankings.forEach((r) => {
      if (!candidateRankings[r.candidate_id]) candidateRankings[r.candidate_id] = [];
      candidateRankings[r.candidate_id].push(r);
    });

    const candidatesWithRankings = candidates.map((c, idx) => {
      const sd = c.structured_data || {};
      const firstName = sd.first_name || (c.name ? c.name.split(' ')[0] : '');
      const lastName = sd.last_name || (c.name ? c.name.split(' ').slice(1).join(' ') : '');
      const candidateCode = sd.candidate_code || ('CAND-' + (c.id ? String(c.id).split('-')[0].slice(0, 4).toUpperCase() : (1001 + idx)));
      const location = sd.location || 'South Africa';
      const email = c.email || sd.email || 'N/A';
      const phone = c.phone || sd.phone || 'N/A';

      const cRanks = candidateRankings[c.id] || [];
      let bestRank = cRanks.slice().sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))[0] || null;

      // Ensure every candidate has real evaluated scores against target job
      if (!bestRank && jobs.length > 0) {
        const primaryJob = jobs[0];
        try {
          const comp = calculateCandidateJobScore(c, primaryJob);
          bestRank = {
            job_id: primaryJob.id,
            job_title: primaryJob.title,
            candidate_id: c.id,
            overall_score: comp.overall_score,
            similarity_score: comp.similarity_score,
            skill_match_score: comp.skill_match_score,
            rank_position: idx + 1,
            isQualifying: comp.isQualifying,
            decision: comp.decision,
            explanation: comp.explanation || (comp.isQualifying ? 'Meets role qualification criteria (≥ 60% match)' : 'Match score below 60% threshold'),
            matched_requirements: comp.matched_requirements || comp.matchedReqs || [],
            missing_requirements: comp.missing_requirements || comp.missingReqs || [],
          };
          cRanks.push(bestRank);
        } catch (_) {}
      }

      return {
        ...c,
        first_name: firstName,
        last_name: lastName,
        candidate_code: candidateCode,
        location,
        email,
        phone,
        rankings: cRanks,
        bestRank,
      };
    });

    // Deduplicate candidates by normalized name to prevent duplicate candidate listings or comparisons
    const candMapByName = new Map();
    candidatesWithRankings.forEach(c => {
      const key = (c.name || '').trim().toLowerCase();
      if (!key) {
        candMapByName.set(c.id, c);
        return;
      }
      const existing = candMapByName.get(key);
      if (!existing) {
        candMapByName.set(key, c);
      } else {
        const existingScore = existing.bestRank?.overall_score || 0;
        const currentScore = c.bestRank?.overall_score || 0;
        if (currentScore >= existingScore) {
          candMapByName.set(key, c);
        }
      }
    });
    const uniqueCandidates = Array.from(candMapByName.values());

    // Build comprehensive individual dossiers for RAG context
    const formattedCandidates = uniqueCandidates.map((c, i) => {
      const sd = c.structured_data || {};
      const techSkills = Array.isArray(sd.skills?.technical) ? sd.skills.technical.join(', ') : '';
      const softSkills = Array.isArray(sd.skills?.soft) ? sd.skills.soft.join(', ') : '';
      const allSkills = Array.isArray(sd.all_skills) ? sd.all_skills.join(', ') : (techSkills || 'N/A');
      const exp = sd.total_experience_years ?? sd.years_experience ?? 0;
      
      const eduDegree = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
      const eduInst = sd.education?.institution || sd.education_history?.[0]?.institution || 'N/A';
      const eduYear = sd.education?.year || sd.education_history?.[0]?.year || '';
      
      const highSchool = sd.school_info?.high_school?.school_name || 'N/A';
      const matricQual = sd.school_info?.high_school?.qualification || 'N/A';
      
      const license = sd.credentials?.drivers_license || sd.drivers_license || 'N/A';
      const code = c.candidate_code;

      // Detailed work history
      const workList = Array.isArray(sd.work_experience) && sd.work_experience.length > 0
        ? sd.work_experience.map(w => `${w.title || 'Role'} at ${w.company || 'Company'} (${w.duration || 'Duration'}): ${w.description || ''}`).join('; ')
        : 'None recorded';

      // Detailed references
      const refList = Array.isArray(sd.references) && sd.references.length > 0
        ? sd.references.map(r => `${r.name || 'Reference'} (${r.title || r.position || 'Colleague'}, ${r.company || ''} - Phone: ${r.phone || 'N/A'})`).join('; ')
        : 'None recorded';

      const r = c.bestRank;
      const rankSummary = r
        ? `Overall Score: ${Math.round((r.overall_score || 0) * 100)}% | Rank #${r.rank_position || i + 1} | Semantic Similarity: ${Math.round((r.similarity_score || 0) * 100)}% | Skill Match: ${Math.round((r.skill_match_score || 0) * 100)}% | Decision: ${r.decision || (r.isQualifying ? 'QUALIFIED' : 'NOT QUALIFIED')} | Matched Skills: ${(r.matched_requirements || []).join(', ') || 'Core competencies'} | Missing: ${(r.missing_requirements || []).join(', ') || 'None'} | Explanation: ${r.explanation || 'Matches role requirements'}`
        : 'Pending evaluation';

      const rawSnippet = (c.raw_text || '').replace(/\s+/g, ' ').trim().slice(0, 500);

      return `--- CANDIDATE PROFILE #${i + 1} ---
Candidate Code: ${code}
Full Name: ${c.name}
First Name: ${c.first_name}
Last Name: ${c.last_name}
Email: ${c.email}
Phone: ${c.phone}
Location: ${c.location}
Driver's License: ${license}
High School: ${highSchool} (${matricQual})
Tertiary Education: ${eduDegree} at ${eduInst} ${eduYear ? `(${eduYear})` : ''}
Total Experience: ${exp} years
Work History: ${workList}
Technical Skills: ${techSkills || allSkills}
Soft Skills: ${softSkills || 'N/A'}
All Skills: ${allSkills}
References: ${refList}
OCR Confidence: ${c.ocr_confidence ? `${Math.round(c.ocr_confidence * 100)}%` : '95%'}
Source File: ${c.source_file || 'N/A'}
Ranking & Score Factors: ${rankSummary}
Hiring Status: ${Boolean(sd.hired || c.is_hired || c.status === 'hired') ? `HIRED BY COMPANY MANAGER (Hired on: ${sd.hired_at || 'Recently'}${sd.hired_notes ? `, Manager Notes: "${sd.hired_notes}"` : ''})` : 'In Pool (Not Hired)'}
CV Excerpt / Summary: ${rawSnippet || 'Structured CV Profile'}`;
    }).join('\n\n');

    const formattedJobs = jobs.map((j, i) => {
      const reqS = Array.isArray(j.required_skills) ? j.required_skills.join(', ') : 'N/A';
      const prefS = Array.isArray(j.preferred_skills) ? j.preferred_skills.join(', ') : 'N/A';
      const desc = j.description_text ? j.description_text.replace(/\s+/g, ' ').trim() : 'N/A';
      return `--- JOB POSTING #${i + 1} ---
Job ID: ${j.id}
Job Title: ${j.title}
Department: ${j.department || 'General'}
Status: ${j.status || 'Active'}
Required Skills: ${reqS}
Preferred Skills: ${prefS}
Full Job Description: ${desc}`;
    }).join('\n\n');

    const formattedRankings = rankings.slice(0, 30).map((r) => {
      const jobTitle = jobMap[r.job_id]?.title || r.job_id;
      const candidateName = candMap[r.candidate_id]?.name || r.candidate_id;
      return `- Job: "${jobTitle}" | Candidate: "${candidateName}" | Rank #${r.rank_position} | Overall: ${Math.round((r.overall_score || 0) * 100)}% | Similarity: ${Math.round((r.similarity_score || 0) * 100)}% | Skills: ${Math.round((r.skill_match_score || 0) * 100)}% | Explanation: ${r.explanation || 'N/A'}`;
    }).join('\n');

    const authNameSet = new Set(uniqueCandidates.map(c => (c.name || '').trim().toLowerCase()).filter(Boolean));
    const strictlyRestricted = (otherCandidateNames || []).filter(o => {
      if (!o.name) return false;
      const oName = o.name.trim().toLowerCase();
      if (authNameSet.has(oName)) return false;
      for (const an of authNameSet) {
        if (an.includes(oName) || oName.includes(an)) return false;
      }
      return true;
    });
    const formattedRestricted = strictlyRestricted.map(o => o.name).filter(Boolean);

    return {
      candidates: uniqueCandidates,
      jobs,
      rankings,
      otherCandidateNames: strictlyRestricted,
      formattedText: `
=== QUICK HIRE LIVE DATABASE CONTEXT ===
AUTHORIZED RECRUITER CANDIDATE DOSSIERS (${uniqueCandidates.length}):
${formattedCandidates || 'No candidates uploaded by you yet.'}

${formattedRestricted.length > 0 ? `RESTRICTED CANDIDATES (SCANNED BY OTHER RECRUITERS - FORBIDDEN TO ACCESS):
The following candidate names belong to other recruiters and are strictly private: ${formattedRestricted.join(', ')}.
RULE: If the user explicitly asks about, requests details for, or queries any candidate in this restricted list, you MUST REFUSE and answer EXACTLY:
"You don't have access to this candidate."
NEVER refuse access to candidates listed under "AUTHORIZED RECRUITER CANDIDATE DOSSIERS" above. The recruiter has full access to all candidates in their authorized dossiers.` : ''}

ACTIVE JOB DESCRIPTIONS (${jobs.length}):
${formattedJobs || 'No jobs created yet.'}

COMPUTED RANKINGS (${rankings.length}):
${formattedRankings || 'No rankings computed yet.'}
========================================`,
    };
  } catch (err) {
    console.warn('[retrieveRagContext] Warning:', err);
    return { candidates: [], jobs: [], rankings: [], formattedText: 'DATABASE CONTEXT EMPTY' };
  }
}

// ============================================================
//  Helper: String & Name Regex Utilities
// ============================================================
function escapeRegExp(string) {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMMON_RECRUITMENT_WORDS = new Set([
  'candidate', 'candidates', 'resume', 'resumes', 'score', 'scores', 'rank', 'ranks',
  'ranking', 'rankings', 'experience', 'education', 'skills', 'skill', 'frontend',
  'backend', 'developer', 'engineer', 'manager', 'junior', 'senior', 'about', 'show',
  'tell', 'give', 'what', 'when', 'where', 'which', 'will', 'with', 'from', 'have',
  'info', 'information', 'details', 'detail', 'list', 'please', 'help', 'qualified',
  'qualification', 'qualifications', 'match', 'matches', 'matching', 'highest', 'lowest',
  'best', 'good', 'better', 'person', 'applicant', 'applicants', 'view', 'dossier',
  'profile', 'summary', 'explain', 'explanation', 'status', 'decision', 'user', 'recruiter',
  'hello', 'greetings', 'morning', 'afternoon', 'evening', 'there', 'find', 'does'
]);

// ============================================================
//  Helper: Flexible Candidate Name & Code Matcher
// ============================================================
function findCandidateInQuery(query, candidates) {
  if (!candidates || candidates.length === 0) return null;
  const q = query.toLowerCase().trim();

  // 1. Exact full name match
  let found = candidates.find(c => {
    const fn = (c.name || '').toLowerCase().trim();
    return fn && fn.length >= 3 && q.includes(fn);
  });
  if (found) return found;

  // 2. Candidate code match (e.g. CAND-3F21, 3f21)
  found = candidates.find(c => {
    const code = (c.candidate_code || '').toLowerCase().trim();
    const shortCode = code.replace(/^cand-/, '');
    return (code && q.includes(code)) || (shortCode && shortCode.length >= 3 && q.includes(shortCode));
  });
  if (found) return found;

  // 3. Multi-word partial name match (e.g. "Fortune Monyepao", "Sekokotla Fortune", "Sekokotla Monyepao")
  found = candidates.find(c => {
    const fullName = (c.name || '').toLowerCase().trim();
    const parts = fullName.split(/\s+/).filter(p => p.length >= 3 && !COMMON_RECRUITMENT_WORDS.has(p));
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          if (q.includes(`${parts[i]} ${parts[j]}`) || q.includes(`${parts[j]} ${parts[i]}`)) {
            return true;
          }
        }
      }
    }
    return false;
  });
  if (found) return found;

  // 4. Distinct name tokens (e.g. "Sekokotla", "Fortune", "Monyepao", "Chabalala", "Dumakude", "Nkateko")
  found = candidates.find(c => {
    const fullName = (c.name || '').toLowerCase().trim();
    const parts = fullName.split(/\s+/).filter(p => p.length >= 4 && !COMMON_RECRUITMENT_WORDS.has(p));
    return parts.some(p => {
      const regex = new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i');
      return regex.test(q);
    });
  });
  if (found) return found;

  // 5. First name or last name match with word boundary
  found = candidates.find(c => {
    const fn = (c.first_name || '').toLowerCase().trim();
    const ln = (c.last_name || '').toLowerCase().trim();
    const fnMatch = fn && fn.length >= 3 && !COMMON_RECRUITMENT_WORDS.has(fn) && new RegExp(`\\b${escapeRegExp(fn)}\\b`, 'i').test(q);
    const lnMatch = ln && ln.length >= 3 && !COMMON_RECRUITMENT_WORDS.has(ln) && new RegExp(`\\b${escapeRegExp(ln)}\\b`, 'i').test(q);
    return fnMatch || lnMatch;
  });
  if (found) return found;

  // 6. Email match
  found = candidates.find(c => {
    const em = (c.email || '').toLowerCase().trim();
    return em && em.length >= 5 && q.includes(em);
  });
  return found || null;
}

// ============================================================
//  Helper: Access Control & Candidate Authorization
// ============================================================
function checkCandidateAccess(query, authorizedCandidates = [], otherCandidates = []) {
  if (!query) return { isUnauthorized: false };
  const q = query.toLowerCase().trim();

  // 1. If query matches ANY authorized candidate owned by this recruiter, access is 100% permitted!
  const authorizedMatch = findCandidateInQuery(q, authorizedCandidates);
  if (authorizedMatch) {
    return { isUnauthorized: false, authorizedCandidate: authorizedMatch };
  }

  // 2. Build set of authorized candidate names and codes to avoid false positives
  const authNameSet = new Set(
    (authorizedCandidates || [])
      .map(c => (c.name || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const authCodeSet = new Set(
    (authorizedCandidates || [])
      .map(c => (c.candidate_code || '').trim().toLowerCase())
      .filter(Boolean)
  );

  // 3. Strictly filter otherCandidates so it contains ONLY candidates NOT owned by this recruiter
  const strictlyOther = (otherCandidates || []).filter(o => {
    if (!o.name) return false;
    const oName = o.name.trim().toLowerCase();
    if (authNameSet.has(oName)) return false;
    for (const an of authNameSet) {
      if (an.includes(oName) || oName.includes(an)) return false;
    }
    return true;
  });

  if (strictlyOther.length === 0) {
    return { isUnauthorized: false };
  }

  // 4. Exact full name match of unauthorized candidate
  let unauthorized = strictlyOther.find(c => {
    const fn = (c.name || '').toLowerCase().trim();
    return fn && fn.length >= 4 && q.includes(fn);
  });
  if (unauthorized) {
    return { isUnauthorized: true, candidate: unauthorized };
  }

  // 5. Candidate code match for unauthorized candidate
  unauthorized = strictlyOther.find(c => {
    const code = (c.candidate_code || '').toLowerCase().trim();
    const shortCode = code.replace(/^cand-/, '');
    if (code && !authCodeSet.has(code) && q.includes(code)) return true;
    if (shortCode && shortCode.length >= 4 && !authCodeSet.has(shortCode) && q.includes(shortCode)) return true;
    return false;
  });
  if (unauthorized) {
    return { isUnauthorized: true, candidate: unauthorized };
  }

  // 6. Multi-word name match (at least 2 words, e.g. "John Doe")
  unauthorized = strictlyOther.find(c => {
    const fullName = (c.name || '').toLowerCase().trim();
    const parts = fullName.split(/\s+/).filter(p => p.length >= 3 && !COMMON_RECRUITMENT_WORDS.has(p));
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const pair1 = `${parts[i]} ${parts[j]}`;
          const pair2 = `${parts[j]} ${parts[i]}`;
          if (q.includes(pair1) || q.includes(pair2)) return true;
        }
      }
    }
    return false;
  });
  if (unauthorized) {
    return { isUnauthorized: true, candidate: unauthorized };
  }

  // 7. Distinct single name token (>= 4 characters, whole word boundary match, not a common word)
  unauthorized = strictlyOther.find(c => {
    const fullName = (c.name || '').toLowerCase().trim();
    const parts = fullName.split(/\s+/).filter(p => p.length >= 4 && !COMMON_RECRUITMENT_WORDS.has(p));
    return parts.some(p => {
      const regex = new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i');
      return regex.test(q);
    });
  });
  if (unauthorized) {
    return { isUnauthorized: true, candidate: unauthorized };
  }

  return { isUnauthorized: false };
}

// ============================================================
//  2. Local Query Handler – offline/fallback knowledge base
// ============================================================
function localQueryHandler(query, rag) {
  const q = query.toLowerCase().trim();
  const cleanQ = q.replace(/[!?,.:;]+$/, '').trim();
  const { candidates, jobs, rankings, otherCandidateNames = [] } = rag;

  // --- ACCESS CONTROL CHECK: Candidates scanned by other recruiters ---
  // Strictly enforce isolation: only refuse if query specifically targets an unauthorized candidate
  const accessCheck = checkCandidateAccess(cleanQ, candidates, otherCandidateNames);
  if (accessCheck.isUnauthorized) {
    return {
      text: "You don't have access to this candidate.",
      candidates: [],
    };
  }

  // --- 0. English Greetings, Pleasantries & Introductions ---
  const isGreeting = /^(hi|hello|hey|hiya|howdy|greetings?|salutations?|yo|sup|what'?s\s*up|whats\s*up|good\s*(morning|afternoon|evening|day)|morning|afternoon|evening)\b/i.test(cleanQ)
    || /^(hi|hello|hey)\s+(there|assistant|bot|quickhire|team|everyone|recruiter|folks|friend)/i.test(cleanQ)
    || /^(how\s*are\s*you|how\s*are\s*you\s*doing|how\s*do\s*you\s*do|how\s*is\s*it\s*going|how'?s\s*it\s*going|hows\s*it\s*going|hope\s*you\s*are\s*well)/i.test(cleanQ)
    || /^(nice|good|great|pleased)\s+to\s+(meet|see)\s+you/i.test(cleanQ)
    || /^(who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do|introduce\s*yourself|what\s*do\s*you\s*do|tell\s*me\s*about\s*yourself|help\b|help\s*me\b)/i.test(cleanQ);

  if (isGreeting) {
    const hasSpecificIntent = /(pipeline|architecture|tech stack|candidate|compare|score|rank|dossier|shortlist|upload|job|export|report|br-\d+|popia|tesseract|spacy|qualification|degree|skill)/i.test(cleanQ)
      || findCandidateInQuery(cleanQ, candidates);

    if (!hasSpecificIntent) {
      const topCand = candidates[0];
      return {
        text: `**Hello! Welcome to QUICK HIRE.**

I am your AI Recruitment Assistant, here to help you navigate candidate data, ranking metrics, and system features.

**Here is what I can do for you:**
• **Candidate Intelligence:** Ask me about any candidate by name for a full dossier (education, matric, work experience, technical & soft skills, and references).
• **Score Factor Explanations:** Ask me to explain candidate ranking scores (with semantic similarity, spaCy skill extraction, and qualification decisions).
• **Candidate Screening & Shortlists:** View top candidate recommendations or compare candidates side-by-side.
• **System & Compliance:** Learn about our processing pipeline (OCR, PyTorch layout, SentenceTransformers), Business Rules (BR-001 to BR-010), and POPIA compliance.

${topCand ? `*Try asking:* "Tell me about ${topCand.name}" or "Explain the ranking score for ${topCand.name}".` : 'How can I assist you today?'}`,
        candidates: candidates.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          relevance_score: c.bestRank?.overall_score || 0.85,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        })),
      };
    }
  }

  // --- Courtesy & Gratitude ---
  const isGratitude = /^(thanks|thank\s*you|many\s*thanks|much\s*appreciated|appreciate\s*it|cheers)\b/i.test(cleanQ);
  if (isGratitude) {
    return {
      text: `**You're very welcome!**

I am always here to assist with candidate screening, ranking score evaluations, and recruitment workflows. Let me know if you'd like to inspect another candidate or review job requirements!`,
      candidates: [],
    };
  }

  // --- Sign-offs & Farewells ---
  const isFarewell = /^(bye|goodbye|see\s*you|see\s*ya|farewell|have\s*a\s*(good|great|nice)\s*(day|evening|night))\b/i.test(cleanQ);
  if (isFarewell) {
    return {
      text: `**Goodbye! Have a great and productive day.**

Feel free to reach out anytime you need to evaluate candidates or generate recruitment reports.`,
      candidates: [],
    };
  }

  // --- Hired Candidates Query ---
  const isHiredQuery = /\b(hired|who\s*is\s*hired|who\s*was\s*hired|which\s*candidates?\s*(is|are|were)?\s*hired|candidates?\s*hired|hired\s*by\s*manager|placements?)\b/i.test(cleanQ);
  if (isHiredQuery) {
    const hiredList = candidates.filter(c => Boolean(c.is_hired || c.hired || c.structured_data?.hired));
    if (hiredList.length > 0) {
      return {
        text: `**🎉 Candidates Hired by Company Manager (${hiredList.length})**

The company manager has confirmed the official hire for the following candidate${hiredList.length === 1 ? '' : 's'}:

${hiredList.map((c, i) => {
  const sd = c.structured_data || {};
  const dateStr = sd.hired_at ? new Date(sd.hired_at).toLocaleDateString() : 'Recently';
  const notesStr = sd.hired_notes ? `\n   - *Manager Notes:* "${sd.hired_notes}"` : '';
  const yoe = sd.total_experience_years ?? sd.years_experience ?? 0;
  return `${i + 1}. **${c.name}** (\`${c.candidate_code || 'CAND'}\`)
   - *Status:* **HIRED** on ${dateStr}
   - *Experience:* ${yoe} years · *Education:* ${sd.education?.degree || 'Tertiary Degree'}${notesStr}`;
}).join('\n\n')}

*These candidates have completed the full pipeline and are officially placed.*`,
        candidates: hiredList.slice(0, 5).map(c => ({
          id: c.id,
          name: c.name,
          relevance_score: c.bestRank?.overall_score || 0.95,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        })),
      };
    } else {
      return {
        text: `**Candidate Hiring Status**

No candidates have been marked as **Hired** by the company manager yet in your active workspace.

When a company manager reviews candidates on the Company Overview dashboard and clicks **Confirm Hire**, those candidates will be highlighted here, on your **Ranked Candidates** page (with a \`HIRED BY MANAGER\` badge), and on your **Dashboard**.`,
        candidates: [],
      };
    }
  }

  // --- 1. System Specification, Architecture, Pipeline & Tech Stack ---
  if (/(pipeline|architecture|tech stack|technical stack|how does it work|how it works|system spec|srs|group 19|tesseract|ocr|spacy|pytorch|sentence\s*transformer|embeddings?)/i.test(q)) {
    return {
      text: `**QUICK HIRE System Architecture & Pipeline (SRS Version 1.0, Group 19)**

**1. Upload & Ingestion Layer:**
- **Supported Formats:** PDF, JPEG, PNG (maximum 10MB per file, batches up to 50 CVs).
- **Job Descriptions:** Plain text format or structured requirements with required & preferred skills.
- **Conversion:** High-resolution 300 DPI page rendering powered by \`pdf2image\` and Poppler.

**2. Multi-Stage Processing Pipeline:**
- **Image Enhancement:** Grayscale transformation, adaptive thresholding, deskewing, and noise reduction.
- **Tesseract OCR:** Optical Character Recognition extracting raw text with an **80%+ accuracy SLA**.
- **PyTorch CNN Layout Analysis:** Deep learning segmentation identifying document sections (header, contact info, summary, education, work experience, skills, references).
- **spaCy NLP Engine:** Named Entity Recognition (NER) pipeline parsing technical skills, soft skills, degrees, universities, job titles, and experience date spans.
- **SentenceTransformers:** Computes 384/768-dimensional dense semantic vector representations capturing nuanced context beyond keyword matching.

**3. Matching & Hybrid Ranking Engine:**
- **Cosine Similarity:** Computes multi-dimensional angular similarity between candidate embeddings and job requirements.
- **Hybrid Scoring Rule (BR-004):** Minimum 60% semantic similarity weight combined with explicit skill match score.
- **Database & Storage:** PostgreSQL 13+ with \`pgvector\`, Django/FastAPI backend, React frontend, and Supabase auth/storage.`,
      candidates: [],
    };
  }

  // --- 2. Specific Business Rule Explanations ---
  if (/br-009|demographic\s*bias/i.test(q)) {
    return {
      text: `**QUICK HIRE Business Rule BR-009: Demographic Bias Elimination**

- **Rule Objective:** Ensure completely objective, merit-based candidate ranking by eliminating all demographic bias from the matching pipeline.
- **Excluded Attributes:** All demographic indicators—including **Age, Date of Birth, Race, Gender, Nationality, Religion, and Physical Home Address**—are strictly excluded from SentenceTransformers vector embeddings and cosine similarity scoring.
- **POPIA & Employment Equity:** Complies fully with South Africa's **Protection of Personal Information Act (POPIA)** and Section 6 of the Employment Equity Act.
- **Recruiter Assurance:** Only verifiable technical competencies, work history depth, and educational qualifications drive the candidate ranking.`,
      candidates: [],
    };
  }

  if (/br-004|ranking\s*composition/i.test(q)) {
    return {
      text: `**QUICK HIRE Business Rule BR-004: Ranking Composition**

- **Rule Objective:** Ensure robust candidate evaluation by balancing deep semantic understanding with explicit skill verification.
- **Hybrid Scoring Formula:**
  Overall Match Score = (Semantic Vector Similarity × 0.60) + (Explicit Skill Match Score × 0.40)
- **Semantic Weighting:** Carries a minimum **60% weighting** powered by SentenceTransformers dense embeddings and high-dimensional Cosine Similarity.
- **Skill Match Weighting:** Accounts for up to **40% weighting** powered by custom spaCy NLP Named Entity Recognition.`,
      candidates: [],
    };
  }

  if (/br-006|factor\s*transparency|factor\s*explanation/i.test(q)) {
    return {
      text: `**QUICK HIRE Business Rule BR-006: Factor Transparency & Explanation**

- **Rule Objective:** Every AI recommendation must be fully auditable, transparent, and explainable to the human recruiter.
- **Transparent Factors Provided:**
  1. Overall Match Score percentage and relative rank position.
  2. Semantic Contextual Similarity score percentage.
  3. Explicit Skill Match score percentage with list of verified competencies.
  4. Explicit breakdown of **Missing Required Requirements**.
  5. System Qualification Decision (**QUALIFIED** for ≥ 60% vs. **NOT QUALIFIED**).`,
      candidates: [],
    };
  }

  if (/br-010|human\s*in\s*the\s*loop/i.test(q)) {
    return {
      text: `**QUICK HIRE Business Rule BR-010: Human-in-the-Loop Principle**

- **Rule Objective:** Prevent automated rejection and preserve human discretion in recruitment.
- **Strictly Advisory:** All AI rankings, scores, and qualification badges are strictly advisory to accelerate candidate shortlisting.
- **Final Decision Authority:** Final interview invitations, hiring decisions, and candidate evaluations remain exclusively with human recruiters.`,
      candidates: [],
    };
  }

  if (/(business rule|governance|br-001|br-002|bias|popia|privacy|gdpr|compliance)/i.test(q)) {
    return {
      text: `**QUICK HIRE Business Rules & Governance (SRS Version 1.0)**

- **BR-001 & BR-002 (Role-Based Access Control):** Only authenticated recruiters can upload CVs, ingest Job Descriptions, and trigger rankings; administrators manage system configuration, accounts, and audit logging.
- **BR-004 (Hybrid Ranking Composition):** Candidate ranking is driven by **semantic similarity (minimum 60% weight)** combined with explicit skill matching.
- **BR-006 (Factor Transparency):** Every ranking calculation provides explicit factor explanations detailing the semantic score, matched requirements, and missing skills.
- **BR-009 (Demographic Bias Elimination):** All demographic factors (age, date of birth, race, gender, nationality, physical address) are strictly excluded from similarity and scoring calculations.
- **BR-010 (Human-in-the-Loop Principle):** All AI recommendations and rankings are strictly advisory. Final hiring decisions rest entirely with human recruiters.
- **POPIA & Data Privacy Compliance:** Fully compliant with South Africa's **Protection of Personal Information Act (POPIA)** and GDPR standards, including encrypted storage, activity logging, and permanent data deletion upon request.`,
      candidates: [],
    };
  }

  // --- 3. App Guidance, Navigation & Export Reports ---
  if (/(how to|guide|navigate|navigation|upload cv|export|report|filters?|constraints?|performance|sla|seconds?|limit)/i.test(q)) {
    return {
      text: `**QUICK HIRE System Navigation & Export Reports**

**Platform Navigation & Features:**
- **Upload CVs:** Navigate to *Upload CVs* to batch upload up to 50 CVs in PDF, PNG, or JPEG format (max 10MB each) with instant drag-and-drop.
- **Job Descriptions:** Ingest or edit target roles with required skills, preferred competencies, and experience thresholds.
- **Dashboard & Candidate Ranking:** Interactive ranking table with live score distribution charts and multi-criteria filters:
  - Minimum match score filter (e.g. 80%+)
  - Minimum years of experience
  - Department and role filtering
- **Reports Generation:** 
  - Click **Export Report** on the Dashboard or Reports page.
  - Generate comprehensive **PDF** candidate dossiers or **Excel (.xlsx)** ranking spreadsheets.
  - Reports reflect the active filters and real candidate match scores.
- **Company Recruiters:** Manage recruiters linked by South African CIPC Company ID.

**Performance SLAs:**
- **CV Processing:** Completed under **30 seconds** per CV.
- **Ranking Engine:** Evaluates up to **1,000 candidates in under 10 seconds**.
- **Chatbot Response:** Immediate structured response within **3 seconds**.`,
      candidates: [],
    };
  }

  // --- 3.5. Jobs Created in the System (Active Jobs, Job Descriptions, Specific Job Details) ---
  const isJobInquiry = /(active jobs?|what jobs?|all jobs?|list jobs?|show jobs?|job descriptions?|jobs created|created jobs?|tell me about the .*job|requirements for .*job|role requirements|job details)/i.test(q)
    || jobs.some(j => j.title && q.includes(j.title.toLowerCase()));

  if (isJobInquiry) {
    // Find if a specific job was asked for
    const matchedJob = jobs.find(j => {
      const jt = (j.title || '').toLowerCase().trim();
      return jt && jt.length >= 3 && q.includes(jt);
    }) || jobs.find(j => {
      const parts = (j.title || '').toLowerCase().split(/\s+/).filter(p => p.length >= 4);
      return parts.some(p => q.includes(p));
    });

    if (matchedJob) {
      const reqSkills = Array.isArray(matchedJob.required_skills) ? matchedJob.required_skills.join(', ') : 'None specified';
      const prefSkills = Array.isArray(matchedJob.preferred_skills) ? matchedJob.preferred_skills.join(', ') : 'None specified';
      const desc = matchedJob.description_text || 'No description provided';
      const dept = matchedJob.department || 'General';
      const status = matchedJob.status || 'Active';

      // Find candidates evaluated or matched for this job
      const jobRankings = rankings.filter(r => r.job_id === matchedJob.id);
      let candidateMatchText = 'No candidates ranked for this job yet.';
      if (jobRankings.length > 0) {
        candidateMatchText = jobRankings.slice(0, 5).map(r => {
          const cand = candidates.find(c => c.id === r.candidate_id);
          const name = cand?.name || r.candidate_id;
          return `- **${name}** — ${Math.round((r.overall_score || 0) * 100)}% match (Rank #${r.rank_position})`;
        }).join('\n');
      } else if (candidates.length > 0) {
        candidateMatchText = `Available candidates in your pool (${candidates.length} total). You can ask me to rank or explain scores for any of them.`;
      }

      return {
        text: `**Job Details: ${matchedJob.title}**

- **Department:** ${dept}
- **Status:** ${status}
- **Required Skills:** ${reqSkills}
- **Preferred Skills:** ${prefSkills}

**Job Description:**
${desc}

**Ranked / Evaluated Candidates:**
${candidateMatchText}`,
        candidates: candidates.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          relevance_score: c.bestRank?.overall_score || 0.85,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        })),
      };
    } else if (jobs.length > 0) {
      return {
        text: `**Active Job Postings in System (${jobs.length}):**

${jobs.map((j, i) => {
  const req = Array.isArray(j.required_skills) ? j.required_skills.join(', ') : 'N/A';
  return `${i + 1}. **${j.title}** (${j.department || 'General'})
   - Required Skills: ${req}
   - Description: ${j.description_text ? j.description_text.slice(0, 120) + '...' : 'N/A'}`;
}).join('\n\n')}

*Ask me about any specific job title to see full requirements and candidate evaluations.*`,
        candidates: [],
      };
    } else {
      return {
        text: `**No Job Descriptions Found**\n\nThere are currently no job descriptions created in the system. Recruiters can create new job openings from the *Job Descriptions* page.`,
        candidates: [],
      };
    }
  }

  // --- 4. Popular Topics (Methodology, OCR Accuracy, Shortlists, Semantic Similarity, Skill Matching, Privacy) ---
  if (/(ranking methodology|ranking algorithm|how are candidates ranked)/i.test(q)) {
    return {
      text: `**QUICK HIRE Ranking Methodology**

QUICK HIRE utilizes a **hybrid semantic ranking algorithm**:
1. **Semantic Vector Similarity (Min 60% Weight, BR-004):**
   - The candidate's extracted CV text and the job description are transformed into dense embeddings via **SentenceTransformers**.
   - **Cosine Similarity** evaluates contextual alignment, recognizing equivalent concepts (e.g., *"cloud computing"* matching *"AWS infrastructure"*).
2. **Explicit Skill Match (Up to 40% Weight):**
   - Direct matching of required and preferred skills extracted via our custom **spaCy NLP** Named Entity Recognition pipeline.
3. **Overall Match Score Formula:**
   Overall Score = (Semantic Score × 0.60) + (Skill Match Score × 0.40)
4. **Advisory Nature (BR-010):**
   - Rankings are advisory to accelerate screening while keeping human recruiters in complete control.`,
      candidates: [],
    };
  }

  if (/(ocr accuracy|ocr target|tesseract accuracy)/i.test(q)) {
    return {
      text: `**Tesseract OCR Accuracy & Processing Standards**

- **Accuracy Target:** Tesseract OCR is configured with an **80%+ accuracy SLA** across standard PDF, PNG, and JPEG documents.
- **Preprocessing Pipeline:** Image enhancement applies grayscale conversion, adaptive binarization, deskewing, and noise removal prior to text recognition.
- **Verification:** OCR confidence scores are computed per candidate profile (averaging 90%+ on clear digital CVs).`,
      candidates: [],
    };
  }

  if (/(shortlists?|how to shortlist|generate shortlist)/i.test(q)) {
    const topShortlist = [...candidates].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0)).slice(0, 3);
    return {
      text: `**Candidate Shortlists & Criteria**

You can shortlist candidates based on customizable thresholds:
1. **Score Threshold:** High-affinity shortlist (Overall Match ≥ 85%).
2. **Experience Threshold:** Minimum required years of industry experience.
3. **Mandatory Skills:** Verified technical stack match via spaCy entity extraction.

${topShortlist.length > 0 ? `**Current Recommended Shortlist:**\n` + topShortlist.map((c, i) => `${i + 1}. **${c.name}** — ${c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% match` : 'Unranked'} (${c.structured_data?.total_experience_years || 0} yrs exp)`).join('\n') : 'Upload CVs to generate candidate shortlists.'}`,
      candidates: topShortlist.map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.85,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      })),
    };
  }

  if (/(semantic similarity|what is semantic similarity)/i.test(q)) {
    return {
      text: `**Semantic Similarity in QUICK HIRE**

- **Definition:** Unlike legacy keyword search, semantic similarity captures the conceptual meaning and contextual depth of work experience and qualifications.
- **Model:** Powered by **SentenceTransformers** dense embeddings and high-dimensional **Cosine Similarity**.
- **Advantage:** Recognizes synonyms, related frameworks, and equivalent industry roles without requiring exact keyword matches.
- **Weighting:** Carries a minimum **60% weight** in overall candidate score calculation (BR-004).`,
      candidates: [],
    };
  }

  if (/(skill matching|how does skill matching work)/i.test(q)) {
    return {
      text: `**Explicit Skill Matching Engine**

- **Extraction:** Powered by a customized **spaCy NLP** Named Entity Recognition (NER) pipeline trained on tech competencies, tools, and domain keywords.
- **Categorization:** Separates skills into **Technical Skills** (e.g. Python, SQL, Docker) and **Soft Skills** (e.g. Team Leadership, Communication).
- **Evaluation:** Evaluates candidates against both **Required Skills** (essential) and **Preferred Skills** (bonus) defined in the Job Description.`,
      candidates: [],
    };
  }

  if (/(data privacy|privacy policy|data retention|data protection)/i.test(q)) {
    return {
      text: `**Data Privacy & POPIA / GDPR Governance**

- **Protection of Personal Information Act (POPIA):** QUICK HIRE fully complies with South African privacy laws.
- **Storage & Encryption:** Personal data is encrypted at rest and in transit.
- **Access Control:** Candidate data is strictly isolated to authenticated recruiters and their linked company organization.
- **Right to Deletion:** Full compliance with candidate deletion requests, permanently removing raw text and vector embeddings.`,
      candidates: [],
    };
  }

  // --- 5. Recent Activity / Ingestion Summary ---
  if (/(recent activity|activity summary|cv uploads|how many candidates|total candidates|system status)/i.test(q)) {
    const topRanked = [...candidates].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0)).slice(0, 3);
    return {
      text: `**QUICK HIRE Activity & Pipeline Summary**

- **Total Ingested Candidates:** **${candidates.length} candidate(s)** active in database.
- **Active Job Postings:** **${jobs.length} job(s)** created.
- **Ranking Evaluations:** **${rankings.length > 0 ? rankings.length : candidates.length} candidate evaluations** available.
- **OCR Processing Accuracy:** Configured with ≥ 80% accuracy SLA across uploaded documents.

${topRanked.length > 0 ? `**Recently Evaluated Candidates:**\n` + topRanked.map((c, i) => `${i + 1}. **${c.name}** (\`${c.candidate_code || 'CAND'}\`) — ${c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% match` : 'Evaluated'} | *${c.structured_data?.education?.degree || 'Candidate'}*`).join('\n') : ''}

You can ask me to inspect any candidate by name (e.g. *"Explain the ranking score for ${candidates[0]?.name || 'a candidate'}"*), compare candidates side-by-side, or search by specific skills.`,
      candidates: topRanked.map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.85,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      })),
    };
  }

  // --- 6. Candidate Comparison Queries ---
  if (/compare|versus|\bvs\b|side by side/i.test(q)) {
    const mentioned = candidates.filter(c => q.includes(c.name.toLowerCase()));
    const compCands = mentioned.length >= 2 ? mentioned.slice(0, 3) : candidates.slice(0, Math.min(candidates.length, 3));

    if (compCands.length >= 2) {
      const tableData = {
        headers: ['Candidate', 'Match Score', 'Experience', 'Degree', 'Core Skills'],
        rows: compCands.map(c => {
          const sd = c.structured_data || {};
          const skills = (sd.all_skills || sd.skills?.technical || []).slice(0, 4).join(', ') || 'N/A';
          const exp = `${sd.total_experience_years ?? sd.years_experience ?? 0} yrs`;
          const edu = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
          const score = c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% (#${c.bestRank.rank_position})` : 'Unranked';
          return [c.name, score, exp, edu, skills];
        }),
      };

      const candProfiles = compCands.map(c => {
        const sd = c.structured_data || {};
        const skills = (sd.all_skills || sd.skills?.technical || []).slice(0, 4).join(', ') || 'N/A';
        const exp = `${sd.total_experience_years ?? sd.years_experience ?? 0} yrs`;
        const edu = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
        const score = c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% (Rank #${c.bestRank.rank_position})` : 'Evaluated';
        return `• **${c.name}** — ${score}\n  Experience: ${exp} | Degree: ${edu}\n  Core Skills: ${skills}`;
      }).join('\n\n');

      const sortedByScore = [...compCands].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0));

      return {
        text: `**Candidate Side-by-Side Comparison**

${candProfiles}

**Comparative Observations:**
• **Top Match:** **${sortedByScore[0].name}** exhibits the strongest contextual alignment (${Math.round((sortedByScore[0].bestRank?.overall_score || 0.85) * 100)}%).
• **Experience Comparison:** ${compCands.map(c => `${c.name} (${c.structured_data?.total_experience_years || 0} yrs)`).join(' vs. ')}
• **Recommendation:** Proceed with preliminary interview based on specific role requirements. Recommendations are advisory (BR-010).`,
        table: tableData,
        candidates: compCands.map(c => ({
          id: c.id,
          name: c.name,
          relevance_score: c.bestRank?.overall_score || 0.85,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        })),
      };
    } else if (candidates.length < 2) {
      return {
        text: `**Candidate Comparison**\n\nThere are fewer than 2 candidates currently uploaded in the system to compare. Please upload additional CVs to perform side-by-side evaluations.`,
        candidates: [],
      };
    }
  }

  // Check for candidate in query
  const matchedCandidate = findCandidateInQuery(q, candidates);
  const isScoreExpl = /(ranking score|explain.*score|score.*breakdown|why.*ranked|how.*ranked|factor.*breakdown|match score|ranking for|score for|why did.*get)/i.test(q);

  // --- 7. Candidate Ranking Score Explanation Queries ---
  if (isScoreExpl) {
    if (matchedCandidate) {
      const c = matchedCandidate;
      const r = c.bestRank || {};
      const pct = Math.round((r.overall_score || c.relevance_score || 0.85) * 100);
      const semPct = Math.round((r.similarity_score || c.similarity_score || 0.82) * 100);
      const skillPct = Math.round((r.skill_match_score || c.skill_match_score || 0.90) * 100);
      const code = c.candidate_code || `CAND-${c.id?.slice(0, 4)?.toUpperCase()}`;
      const jobTitle = r.job_title || (jobs[0]?.title) || 'Target Job Profile';
      const decision = r.decision || (pct >= 60 ? 'QUALIFIED' : 'NOT QUALIFIED');
      const matchedSkills = (r.matched_requirements && r.matched_requirements.length > 0)
        ? r.matched_requirements.join(', ')
        : (c.structured_data?.all_skills || []).slice(0, 6).join(', ');
      const missingSkills = (r.missing_requirements && r.missing_requirements.length > 0)
        ? r.missing_requirements.join(', ')
        : 'None identified';
      const explanation = r.explanation || `Candidate demonstrates strong semantic alignment (${semPct}%) and explicit technical skills (${skillPct}%) for ${jobTitle}.`;

      return {
        text: `**Ranking Score Explanation: ${c.name} (${code})**

**Target Role:** **${jobTitle}**  
**Overall Match Score:** **${pct}%** (Rank **#${r.rank_position || 1}**)  
**System Qualification Decision:** **${decision}** (Criteria: ≥ 60% threshold)

---

**Factor Breakdown (SRS BR-004 & BR-006):**

1. **Semantic Vector Similarity (60% Weight):** **${semPct}%**
   - **Evaluation:** Contextual NLP evaluation powered by **SentenceTransformers** dense embeddings and **Cosine Similarity**.
   - **Depth Analysis:** Captures relevant project experience, university education (*${c.structured_data?.education?.degree || 'Tertiary Degree'}*), and domain alignment beyond simple keyword matching.

2. **Explicit Skill Match (40% Weight):** **${skillPct}%**
   - **Evaluation:** Extracted and verified via our custom **spaCy Named Entity Recognition (NER)** pipeline.
   - **Matched Required Skills:** ${matchedSkills}
   - **Missing Requirements:** ${missingSkills}

3. **Hybrid Scoring Formula:**
   Overall Score = (Semantic Similarity ${semPct}% × 0.60) + (Skill Match ${skillPct}% × 0.40) = ${pct}%

---

**Decision Rationale:**
${explanation}

*Governance Notice: In accordance with **BR-009**, demographic indicators (age, gender, race, address) were strictly excluded from scoring. All rankings are advisory per **BR-010**; final shortlisting decisions remain with the recruiter.*`,
        candidates: [{
          id: c.id,
          name: c.name,
          relevance_score: r.overall_score || 0.85,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        }],
      };
    } else {
      const topCands = [...candidates].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0)).slice(0, 3);
      return {
        text: `**Candidate Ranking Score Explanation**

In QUICK HIRE, candidate scores are calculated using a **hybrid semantic algorithm (BR-004)**:
Overall Score = (Semantic Similarity × 0.60) + (Skill Match Score × 0.40)

- **Semantic Similarity (60%):** Evaluates overall contextual alignment using SentenceTransformers embeddings and Cosine Similarity.
- **Skill Match (40%):** Evaluates required and preferred technical and soft skills extracted by spaCy NER.
- **Factor Transparency (BR-006):** Each candidate has an explicit breakdown of matched skills, missing requirements, and qualification decisions.

${topCands.length > 0 ? `**Which candidate's score would you like to inspect?**\n` + topCands.map((c, i) => `${i + 1}. **${c.name}** — ${c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% match` : 'Evaluated'} (e.g. *"Explain the ranking score for ${c.name}"*)`).join('\n') : 'Please upload candidate CVs to inspect candidate ranking scores.'}`,
        candidates: topCands.map(c => ({
          id: c.id,
          name: c.name,
          relevance_score: c.bestRank?.overall_score || 0.85,
          years_experience: c.structured_data?.total_experience_years || 0,
          all_skills: c.structured_data?.all_skills || [],
        })),
      };
    }
  }

  // --- 8. Individual Candidate Inquiry (Full Dossier) ---
  if (matchedCandidate) {
    const c = matchedCandidate;
    const sd = c.structured_data || {};
    const techSkills = Array.isArray(sd.skills?.technical) ? sd.skills.technical.join(', ') : '';
    const softSkills = Array.isArray(sd.skills?.soft) ? sd.skills.soft.join(', ') : '';
    const allSkills = Array.isArray(sd.all_skills) ? sd.all_skills.join(', ') : (techSkills || 'N/A');
    const exp = sd.total_experience_years ?? sd.years_experience ?? 0;
    
    const eduDegree = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
    const eduInst = sd.education?.institution || sd.education_history?.[0]?.institution || 'N/A';
    const eduYear = sd.education?.year || sd.education_history?.[0]?.year || '';
    
    const highSchool = sd.school_info?.high_school?.school_name || 'N/A';
    const matricQual = sd.school_info?.high_school?.qualification || 'N/A';
    const license = sd.credentials?.drivers_license || sd.drivers_license || 'N/A';
    const code = c.candidate_code || `CAND-${c.id?.slice(0, 4)?.toUpperCase()}`;

    // Format work experience
    let workText = 'None recorded';
    if (Array.isArray(sd.work_experience) && sd.work_experience.length > 0) {
      workText = sd.work_experience.map(w => `- **${w.title || 'Role'}** at *${w.company || 'Organization'}* (${w.duration || 'Period'})\n  ${w.description || ''}`).join('\n');
    }

    // Format references
    let refText = 'None recorded';
    if (Array.isArray(sd.references) && sd.references.length > 0) {
      refText = sd.references.map(r => `- **${r.name || 'Reference'}** — ${r.title || r.position || 'Contact'} at *${r.company || 'Company'}* (Phone: ${r.phone || 'N/A'})`).join('\n');
    }

    // Format ranking details
    let rankText = 'Pending ranking evaluation';
    if (c.bestRank) {
      rankText = `**Rank #${c.bestRank.rank_position || 1}** with **${Math.round((c.bestRank.overall_score || 0) * 100)}% overall match**\n- Semantic Similarity: ${Math.round((c.bestRank.similarity_score || 0) * 100)}%\n- Skill Match Score: ${Math.round((c.bestRank.skill_match_score || 0) * 100)}%\n- Explanation: ${c.bestRank.explanation || 'Matches core role requirements and key competencies.'}`;
    }

    const card = {
      id: c.id,
      name: c.name,
      relevance_score: c.bestRank?.overall_score || 0.85,
      years_experience: exp,
      all_skills: sd.all_skills || sd.skills?.technical || [],
    };

    const isHired = Boolean(c.is_hired || c.hired || sd.hired || c.status === 'hired' || sd.status === 'hired');
    const hiredText = isHired 
      ? `🎉 **HIRED BY COMPANY MANAGER**${c.hired_at || sd.hired_at ? ` on ${new Date(c.hired_at || sd.hired_at).toLocaleDateString()}` : ''}${c.hired_notes || sd.hired_notes ? ` (Notes: "${c.hired_notes || sd.hired_notes}")` : ''}`
      : 'In Active Review / Available';

    return {
      text: `**Candidate Dossier: ${c.name} (${code})**

**Personal & Contact Details:**
- **Candidate Code:** \`${code}\`
- **Full Name:** ${c.name}
- **Email:** ${c.email || 'N/A'}
- **Phone:** ${c.phone || 'N/A'}
- **Location:** ${c.location || sd.location || 'N/A'}
- **Driver's License:** ${license}

**Hiring & Employment Status:**
- **Manager Status:** ${hiredText}

**Education & Qualifications:**
- **Tertiary Degree:** ${eduDegree}
- **Institution:** ${eduInst} ${eduYear ? `(${eduYear})` : ''}
- **Secondary School (Matric):** ${highSchool} — *${matricQual}*

**Experience & Work History (${exp} years total):**
${workText}

**Skills Inventory:**
- **Technical Skills:** ${techSkills || allSkills}
- **Soft Skills:** ${softSkills || 'N/A'}

**References:**
${refText}

**System Pipeline & Ranking Status:**
- **OCR Confidence:** ${c.ocr_confidence ? `${Math.round(c.ocr_confidence * 100)}%` : '95%'}
- **Source Document:** \`${c.source_file || 'CV Upload'}\`
- **Current Ranking:** ${rankText}`,
      candidates: [card],
    };
  }

  // --- 9. Top Candidates / Best Matches ---
  const topMatch = q.match(/top\s*(\d+)?\s*(candidates?)?\s*(for|of)?\s*(.+)?/i);
  if (topMatch || /(top candidates?|best candidates?|highest match|show candidates)/i.test(q)) {
    const limit = topMatch ? (parseInt(topMatch[1]) || 5) : 5;
    const jobTitle = topMatch && topMatch[4] ? topMatch[4].trim() : null;
    let filtered = candidates;

    if (jobTitle) {
      const matchedJobs = jobs.filter(j => j.title.toLowerCase().includes(jobTitle.toLowerCase()));
      if (matchedJobs.length) {
        const jobIds = matchedJobs.map(j => j.id);
        const rankedCandIds = rankings.filter(r => jobIds.includes(r.job_id)).map(r => r.candidate_id);
        filtered = candidates.filter(c => rankedCandIds.includes(c.id));
      }
    }

    if (!filtered.length) filtered = candidates;
    filtered = [...filtered].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0));
    const top = filtered.slice(0, limit);

    if (top.length === 0) {
      return { text: `No candidates found${jobTitle ? ` for "${jobTitle}"` : ''} in the database.`, candidates: [] };
    }

    const cardCandidates = top.map(c => ({
      id: c.id,
      name: c.name,
      relevance_score: c.bestRank?.overall_score || 0.5,
      years_experience: c.structured_data?.total_experience_years || 0,
      all_skills: c.structured_data?.all_skills || [],
    }));

    const text = `**Top ${top.length} Candidates${jobTitle ? ` for "${jobTitle}"` : ''}**\n\n` +
      top.map((c, i) => {
        const score = c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% match (Rank #${c.bestRank.rank_position || i + 1})` : 'Evaluated';
        const exp = c.structured_data?.total_experience_years || 0;
        const skills = (c.structured_data?.all_skills || []).slice(0, 4).join(', ') || 'N/A';
        return `${i + 1}. **${c.name}** — ${score} | ${exp} yrs exp | *Skills:* ${skills}`;
      }).join('\n') +
      `\n\n*Note: Recommendations are advisory (BR-010). Final hiring authority rests with the recruiter.*`;

    return { text, candidates: cardCandidates };
  }

  // --- 10. Search by Skills or Tech Keywords ---
  const skillKeywords = ['python', 'java', 'javascript', 'react', 'node', 'sql', 'c++', 'aws', 'docker', 'kubernetes', 'typescript', 'angular', 'vue', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'perl', 'html', 'css', 'git', 'ci/cd', 'machine learning', 'ai', 'nlp', 'backend', 'frontend', 'fullstack', 'devops', 'cloud', 'security'];
  const foundSkills = skillKeywords.filter(skill => q.includes(skill));

  if (foundSkills.length > 0) {
    const matched = candidates.filter(c => {
      const skills = (c.structured_data?.all_skills || []).map(s => s.toLowerCase());
      return foundSkills.some(fs => skills.some(s => s.includes(fs) || fs.includes(s)));
    });

    if (matched.length > 0) {
      const topMatched = matched.slice(0, 5);
      const cardCandidates = topMatched.map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.8,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      }));

      const text = `**Candidates Matching Skills: ${foundSkills.join(', ')}**\n\n` +
        `Found **${matched.length} candidate(s)** with matching competencies:\n\n` +
        topMatched.map((c, i) => {
          const exp = c.structured_data?.total_experience_years || 0;
          const skills = (c.structured_data?.all_skills || []).slice(0, 4).join(', ');
          return `${i + 1}. **${c.name}** (${exp} yrs exp) — *Skills:* ${skills}`;
        }).join('\n');

      return { text, candidates: cardCandidates };
    }
  }

  // --- 11. Search by Degree / Qualifications ---
  if (/(degree|master|bachelor|phd|diploma|qualification|education|university)/i.test(q)) {
    const degQuery = q.includes('master') ? 'master' : q.includes('phd') || q.includes('doctor') ? 'phd' : q.includes('bachelor') ? 'bachelor' : q.includes('diploma') ? 'diploma' : '';
    const matched = candidates.filter(c => {
      const sd = c.structured_data || {};
      const deg = (sd.education?.degree || sd.education_history?.[0]?.degree || '').toLowerCase();
      const inst = (sd.education?.institution || sd.education_history?.[0]?.institution || '').toLowerCase();
      if (degQuery) return deg.includes(degQuery);
      return deg.length > 0 || inst.length > 0;
    });

    if (matched.length > 0) {
      const cardCandidates = matched.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.8,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      }));

      const text = `**Candidates with ${degQuery ? degQuery.toUpperCase() + ' ' : ''}Qualifications**\n\n` +
        `Found **${matched.length} candidate(s)** matching qualification criteria:\n\n` +
        matched.slice(0, 5).map((c, i) => {
          const sd = c.structured_data || {};
          const deg = sd.education?.degree || sd.education_history?.[0]?.degree || 'Tertiary Degree';
          const inst = sd.education?.institution || sd.education_history?.[0]?.institution || 'University';
          return `${i + 1}. **${c.name}** — *${deg}* (${inst})`;
        }).join('\n');

      return { text, candidates: cardCandidates };
    }
  }

  // --- 12. Candidate Inquiry for Unlisted Names ---
  const candInquiryMatch = q.match(/(tell me (everything )?about|who is|profile of|score for|ranking for|explain.*for)\s+([a-zA-Z\s]+)/i);
  if (candInquiryMatch) {
    const searchedName = candInquiryMatch[3].trim();
    return {
      text: `**Candidate Not Found: "${searchedName}"**

I could not find a candidate matching **"${searchedName}"** in the current database.

**Available Candidates in System (${candidates.length}):**
${candidates.slice(0, 8).map((c, i) => `${i + 1}. **${c.name}** (\`${c.candidate_code || 'CAND'}\`)`).join('\n')}

*Tip: You can ask "Tell me about ${candidates[0]?.name || 'any candidate'}" or "Explain the ranking score for ${candidates[0]?.name || 'any candidate'}".*`,
      candidates: candidates.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.85,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      })),
    };
  }

  // --- 13. STRICT UNRECOGNIZED INSTRUCTION FALLBACK ---
  // When an instruction is genuinely unrecognized (gibberish or unrelated to recruitment), explicitly notify the user:
  return {
    text: `I did not recognize that instruction.

I am your QUICK HIRE recruitment assistant. I can help you with:
- **System Knowledge:** Complete processing pipeline (OCR, PyTorch layout, spaCy NER, SentenceTransformers, Cosine Similarity), Business Rules (BR-001 to BR-010), and POPIA compliance.
- **Candidate Intelligence:** Deep individual dossiers for any candidate (contact, matric, tertiary education, work experience, technical/soft skills, references, and match scores).
- **Candidate Screening:** Top candidates for a role, side-by-side comparisons, skill searches, and ranking explanations.

Please clarify your request or specify what you would like to know.`,
    candidates: [],
  };
}

// ============================================================
//  3. Multi-Turn History
// ============================================================
async function fetchChatHistory(sessionId) {
  if (!sessionId) return [];
  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .select('role, message, query_text, response_text, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.warn('[fetchChatHistory] Supabase error:', error);
      return [];
    }

    const historyItems = [];
    (data || []).forEach((log) => {
      if (log.role === 'user' && log.query_text) {
        historyItems.push({ role: 'user', parts: [{ text: log.query_text }] });
      } else if (log.role === 'assistant' && log.response_text) {
        historyItems.push({ role: 'model', parts: [{ text: log.response_text }] });
      } else if (log.role === 'user' && log.message) {
        historyItems.push({ role: 'user', parts: [{ text: log.message }] });
      } else if (log.role === 'assistant' && log.message) {
        historyItems.push({ role: 'model', parts: [{ text: log.message }] });
      }
    });
    return historyItems;
  } catch (_) {
    return [];
  }
}

// ============================================================
//  4. Main send function
// ============================================================
export const sendMessageWithGemini = async (message, sessionId, userId = null, companyId = null) => {
  const prompt = (message || '').trim();
  if (!prompt) return { type: 'text', text: 'Please enter a query.' };

  const rag = await retrieveRagContext(companyId, userId);

  // Pre-flight check: if recruiter asks for an unauthorized candidate scanned by someone else
  const accessCheck = checkCandidateAccess(prompt, rag.candidates, rag.otherCandidateNames);
  if (accessCheck.isUnauthorized) {
    const deniedText = "You don't have access to this candidate.";
    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        message: deniedText,
        query_text: prompt,
        response_text: deniedText,
        intent: 'access-denied',
        confidence: 1.0,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}
    return {
      type: 'text',
      text: deniedText,
      session_id: sessionId,
      candidates: [],
    };
  }

  let responseText = '';
  let isRateLimited = false;
  let usedFallback = false;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const historyItems = await fetchChatHistory(sessionId);

    // List of models in order of priority (gemini-3.6-flash is currently the supported active model)
    const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const chat = ai.chats.create({
          model: modelName,
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${rag.formattedText}`,
          },
          history: historyItems,
        });

        const result = await chat.sendMessage({ message: prompt });
        if (result && result.text) {
          responseText = result.text;
          lastError = null;
          break;
        }
      } catch (tryErr) {
        lastError = tryErr;
        const errStr = String(tryErr?.message || tryErr || '');
        if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not available')) {
          continue; // Try next model
        } else {
          break; // Stop on rate limit or fatal error
        }
      }
    }

    if (lastError && !responseText) {
      throw lastError;
    }
  } catch (geminiErr) {
    const errStr = String(geminiErr?.message || geminiErr || '');
    console.warn('[sendMessageWithGemini] Gemini SDK Exception:', errStr);

    if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('rate limit')) {
      isRateLimited = true;
      usedFallback = true;
    } else {
      usedFallback = true;
    }
  }

  // If Gemini failed or rate-limited, use dynamic local handler
  if (usedFallback) {
    const localResult = localQueryHandler(prompt, rag);
    responseText = localResult.text;
    const candidateCards = localResult.candidates || [];

    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        message: responseText,
        query_text: prompt,
        response_text: responseText,
        intent: 'fallback-local',
        confidence: isRateLimited ? 0.0 : 0.85,
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[sendMessageWithGemini] chat_logs write warning:', auditErr);
    }

    return {
      type: 'text',
      text: responseText,
      session_id: sessionId,
      is_rate_limit: isRateLimited,
      candidates: candidateCards.length > 0 ? candidateCards : undefined,
      table: localResult.table || undefined,
    };
  }

  // Gemini succeeded – audit log and return
  try {
    await supabase.from('chat_logs').insert({
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      message: responseText,
      query_text: prompt,
      response_text: responseText,
      intent: 'gemini-2.0-flash-rag',
      confidence: 0.95,
      created_at: new Date().toISOString(),
    });
  } catch (auditErr) {
    console.warn('[sendMessageWithGemini] chat_logs write warning:', auditErr);
  }

  // Only attach candidate cards if the query was specifically asking for candidates / ranking / individual profile
  let candidateCards = undefined;
  const isCandidateSeeking = /\b(top candidates?|best candidates?|who is|tell me about|profile of|show candidates?|compare|recommend|candidate\s*code|ranked)\b/i.test(prompt);
  const isUnrecognized = /did not recognize|unrecognized instruction/i.test(responseText);

  if (isCandidateSeeking && !isUnrecognized && rag.candidates.length > 0) {
    const mentioned = rag.candidates.filter(c => {
      const name = (c.name || '').toLowerCase();
      const code = (c.candidate_code || '').toLowerCase();
      return (name && responseText.toLowerCase().includes(name)) || (code && prompt.toLowerCase().includes(code));
    });

    if (mentioned.length > 0) {
      candidateCards = mentioned.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.85,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || c.structured_data?.skills?.technical || [],
      }));
    } else if (/\btop\b|\bbest\b/i.test(prompt)) {
      const sorted = [...rag.candidates].sort((a, b) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0));
      candidateCards = sorted.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.8,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || c.structured_data?.skills?.technical || [],
      }));
    }
  }

  return {
    type: 'text',
    text: responseText,
    session_id: sessionId,
    is_rate_limit: isRateLimited,
    candidates: candidateCards,
  };
};

// ============================================================
//  Exported service
// ============================================================
const chatbotServiceExport = {
  sendMessage: async (message, sessionId, userId = null, companyId = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnUrl = process.env.REACT_APP_SUPABASE_URL ? `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/chatbot` : null;
      if (fnUrl && session) {
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ message, session_id: sessionId }),
        });
        if (res.ok) {
          const edgeJson = await res.json();
          if (edgeJson && edgeJson.text) return edgeJson;
        }
      }
    } catch (_) {}

    return await sendMessageWithGemini(message, sessionId, userId, companyId);
  },

  getConversationHistory: async (userId, sessionId) => {
    try {
      let query = supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: true });
      if (userId) query = query.eq('user_id', userId);
      if (sessionId) query = query.eq('session_id', sessionId);
      const { data, error } = await query;
      if (error) {
        console.warn('[getConversationHistory] Supabase error:', error);
        return [];
      }
      return (data || []).map((log) => ({
        id: 'db-' + log.id,
        from: log.role === 'user' ? 'user' : 'bot',
        text: log.message || log.query_text || log.response_text || '',
        parts: log.response_parts || [],
        suggestions: log.suggestions || [],
        time: new Date(log.created_at).getTime(),
      }));
    } catch (_) {
      return [];
    }
  },

  storeUserMessage: async ({ userId, sessionId, message }) => {
    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        role: 'user',
        message: message,
        query_text: message,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}
  },

  storeBotReply: async ({ userId, sessionId, message, responseParts, suggestions }) => {
    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        message: message,
        response_text: message,
        response_parts: responseParts || null,
        suggestions: suggestions || null,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}
  },
};

export default chatbotServiceExport;