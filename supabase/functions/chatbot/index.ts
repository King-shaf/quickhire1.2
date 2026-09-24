// Supabase Edge Function: Quick Hire AI Recruitment Chatbot
// Refactored to use official @google/genai SDK with gemini-2.0-flash, Supabase RAG context retrieval,
// multi-turn chat history from chat_logs, audit logging, and 429 rate limit handling.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    let userId: string | null = null;
    if (authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      } catch (_) {}
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message || body.query || '';
    const sessionId = body.session_id || body.sessionId || crypto.randomUUID();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'message parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Context Retrieval (RAG): Query Supabase tables
    const companyId = body.company_id || null;
    let candQuery = supabase
      .from('candidates')
      .select('id, name, first_name, last_name, email, phone, location, candidate_code, source_file, ocr_confidence, structured_data, created_at, company_id');
    let jobQuery = supabase
      .from('job_descriptions')
      .select('id, title, description_text, required_skills, preferred_skills, department, created_at');
    let rankQuery = supabase
      .from('rankings')
      .select('job_id, candidate_id, overall_score, similarity_score, skill_match_score, rank_position, explanation, matched_requirements, missing_requirements');

    if (companyId) {
      candQuery = candQuery.or(`company_id.eq.${companyId},company_id.is.null`);
      jobQuery = jobQuery.or(`company_id.eq.${companyId},created_by.is.null`);
    }

    const [candRes, jobRes, rankRes] = await Promise.all([
      candQuery.limit(60),
      jobQuery.limit(30),
      rankQuery.limit(100),
    ]);

    const candidates = candRes.data || [];
    const jobs = jobRes.data || [];
    const rankings = rankRes.data || [];

    const jobMap = Object.fromEntries(jobs.map((j: { id: string; title: string }) => [j.id, j]));
    const candMap = Object.fromEntries(candidates.map((c: { id: string; name: string }) => [c.id, c]));

    const candidateRankings: Record<string, any[]> = {};
    rankings.forEach((r: any) => {
      if (!candidateRankings[r.candidate_id]) candidateRankings[r.candidate_id] = [];
      candidateRankings[r.candidate_id].push(r);
    });

    const candidatesWithRankings = candidates.map((c: any) => {
      const cRanks = candidateRankings[c.id] || [];
      const bestRank = cRanks.slice().sort((a: any, b: any) => (b.overall_score || 0) - (a.overall_score || 0))[0] || null;
      return { ...c, rankings: cRanks, bestRank };
    });

    const candidateContext = candidatesWithRankings.map((c: any, i: number) => {
      const sd = c.structured_data || {};
      const techSkills = Array.isArray(sd.skills?.technical) ? sd.skills.technical.join(', ') : '';
      const softSkills = Array.isArray(sd.skills?.soft) ? sd.skills.soft.join(', ') : '';
      const allSkills = Array.isArray(sd.all_skills) ? sd.all_skills.join(', ') : (techSkills || 'N/A');
      const exp = sd.total_experience_years ?? sd.years_experience ?? 0;
      const eduDegree = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
      const eduInst = sd.education?.institution || sd.education_history?.[0]?.institution || 'N/A';
      const highSchool = sd.school_info?.high_school?.school_name || 'N/A';
      const license = sd.credentials?.drivers_license || sd.drivers_license || 'N/A';
      const code = c.candidate_code || `CAND-${c.id?.slice(0, 6)?.toUpperCase() || i + 1}`;

      const workList = Array.isArray(sd.work_experience) && sd.work_experience.length > 0
        ? sd.work_experience.map((w: any) => `${w.title || 'Role'} at ${w.company || 'Company'} (${w.duration || 'Period'}): ${w.description || ''}`).join('; ')
        : 'None recorded';

      const refList = Array.isArray(sd.references) && sd.references.length > 0
        ? sd.references.map((r: any) => `${r.name || 'Ref'} (${r.title || r.position || 'Colleague'}, ${r.company || ''} - ${r.phone || 'N/A'})`).join('; ')
        : 'None recorded';

      const rankSummary = c.rankings.length > 0
        ? c.rankings.map((r: any) => `[${jobMap[r.job_id]?.title || 'Job'}: ${Math.round((r.overall_score || 0) * 100)}% match, #${r.rank_position}]`).join(', ')
        : 'Not ranked yet';

      return `--- CANDIDATE #${i + 1} ---
Code: ${code} | Name: ${c.name || 'Candidate'} | Email: ${c.email || 'N/A'} | Phone: ${c.phone || 'N/A'}
Location: ${c.location || sd.location || 'N/A'} | License: ${license}
Secondary: ${highSchool} | Tertiary: ${eduDegree} at ${eduInst}
Total Experience: ${exp} yrs | Work: ${workList}
Skills: ${allSkills} (Tech: ${techSkills || 'N/A'}, Soft: ${softSkills || 'N/A'})
References: ${refList} | OCR: ${c.ocr_confidence ? `${Math.round(c.ocr_confidence * 100)}%` : 'N/A'}
Rankings: ${rankSummary}`;
    }).join('\n\n');

    const jobContext = jobs.map((j: any, i: number) => {
      const reqS = Array.isArray(j.required_skills) ? j.required_skills.join(', ') : 'N/A';
      const prefS = Array.isArray(j.preferred_skills) ? j.preferred_skills.join(', ') : 'N/A';
      return `${i + 1}. Job Title: ${j.title} | Department: ${j.department || 'N/A'} | Required Skills: ${reqS} | Preferred Skills: ${prefS}`;
    }).join('\n');

    const rankingContext = rankings.slice(0, 30).map((r: any) => {
      const jTitle = jobMap[r.job_id]?.title || r.job_id;
      const cName = candMap[r.candidate_id]?.name || r.candidate_id;
      return `- Job: "${jTitle}" | Candidate: "${cName}" | Rank #${r.rank_position} | Overall Score: ${Math.round((r.overall_score || 0) * 100)}% | Skill Score: ${Math.round((r.skill_match_score || 0) * 100)}% | Explanation: ${r.explanation || 'N/A'}`;
    }).join('\n');

    const fullRagContext = `
=== QUICK HIRE LIVE DATABASE CONTEXT ===
ACTIVE JOBS (${jobs.length}):
${jobContext || 'No jobs uploaded yet.'}

DETAILED CANDIDATE DOSSIERS (${candidates.length}):
${candidateContext || 'No candidate CVs uploaded yet.'}

COMPUTED RANKINGS (${rankings.length}):
${rankingContext || 'No rankings computed yet.'}
========================================`;

    // 2. Gemini Client & System Instruction Setup
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('API_KEY') || '';

    const systemInstruction = `You are the QUICK HIRE AI Recruitment Assistant, integrated directly into the QUICK HIRE platform (an AI-Powered Semantic Candidate Ranking Platform).

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
   - **Hybrid Weighted Scoring:** Overall Match Score = (Semantic Similarity Score * semantic_weight [min 60%]) + (Explicit Skill Match Score * skill_weight [up to 40%]).
   - **Storage & Infrastructure:** PostgreSQL 13+ with pgvector extension, Django/FastAPI backend, React frontend, Supabase realtime & auth.
4. **Business Rules & Governance:**
   - **BR-001 & BR-002 (Access & Role Control):** Authenticated recruiters upload/rank; admins manage system & quotas; company managers oversee recruiters linked by Company ID.
   - **BR-004 (Ranking Composition):** Ranking maintains minimum 60% semantic similarity weighting combined with explicit skill matching.
   - **BR-006 (Factor Explanations):** Clear breakdown provided for every candidate ranking.
   - **BR-009 (Demographic Bias Elimination):** Strict bias mitigation: demographic indicators (age, date of birth, race, gender, nationality, religion, physical address) are completely excluded from scoring.
   - **BR-010 (Human-in-the-Loop):** System ranking is strictly advisory. Final hiring decisions remain exclusively with human recruiters.
   - **Regulatory Compliance:** Adheres to South African POPIA and GDPR principles.
5. **System Navigation & Performance SLAs:**
   - CV processing within 30 seconds; ranking up to 1,000 candidates within 10 seconds; chatbot response within 3 seconds.

### CANDIDATE INTELLIGENCE & INDIVIDUAL DOSSIERS
- When asked about any individual candidate (by name, candidate code, or email), provide their complete dossier: Code, Full Name, Contact info, Location, Driver's License, High School/Matric, Tertiary Degree & Institution, Experience, Detailed Work History, Technical & Soft Skills, References, OCR Confidence, and Ranking status.

### STRICT INSTRUCTION RECOGNITION RULE (CRITICAL)
- If the user's prompt is unrecognized, ambiguous, gibberish, or completely unrelated to QUICK HIRE or candidates/jobs:
  - Explicitly state that you did not recognize the instruction.
  - State what you can help with (system architecture, candidate profiles, ranking explanations, comparisons).
  - Do NOT dump unsolicited candidate cards or random data.`;

    // 3. Multi-Turn History formatting from chat_logs Supabase table
    let historyItems: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    try {
      const { data: pastLogs } = await supabase
        .from('chat_logs')
        .select('role, message, query_text, response_text, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(16);

      if (pastLogs && pastLogs.length > 0) {
        pastLogs.forEach((log: any) => {
          const qText = log.query_text || (log.role === 'user' ? log.message : null);
          const rText = log.response_text || (log.role === 'assistant' ? log.message : null);
          if (qText) {
            historyItems.push({ role: 'user', parts: [{ text: qText }] });
          }
          if (rText) {
            historyItems.push({ role: 'model', parts: [{ text: rText }] });
          }
        });
      }
    } catch (_) {}

    let responseText = '';
    let isRateLimited = false;

    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        const chat = ai.chats.create({
          model: 'gemini-2.0-flash',
          config: {
            systemInstruction: `${systemInstruction}\n\n${fullRagContext}`,
          },
          history: historyItems,
        });

        const result = await chat.sendMessage({ message });
        responseText = result.text || 'I analyzed the database context, but no textual output was returned.';
      } catch (geminiErr: any) {
        const errStr = String(geminiErr?.message || geminiErr || '');
        console.error('[Chatbot Edge Function] Gemini API Error:', errStr);

        if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('rate limit')) {
          isRateLimited = true;
          responseText = 'The AI assistant is receiving a high volume of requests right now (rate limit reached). Please try again in a few seconds.';
        } else {
          // Dynamic Fallback RAG response generator
          const qLower = message.toLowerCase().trim();

          if (/(pipeline|architecture|tech stack|technical stack|srs|group 19|tesseract|spacy|pytorch|sentence\s*transformer)/i.test(qLower)) {
            responseText = `### **QUICK HIRE System Architecture & Pipeline (SRS v1.0, Group 19)**\n\n` +
              `- **Upload & Ingestion:** PDF, JPEG, PNG (max 10MB per file, up to 50 files per batch) via pdf2image & Poppler.\n` +
              `- **Processing Pipeline:** Image enhancement -> Tesseract OCR (80%+ accuracy target) -> PyTorch CNN (layout/section analysis) -> spaCy NLP (entity extraction) -> SentenceTransformers (semantic vector embeddings).\n` +
              `- **Ranking Engine:** Cosine Similarity with min 60% semantic similarity weight + explicit skill matching stored in PostgreSQL 13+.`;
          } else if (/(business rule|br-001|br-002|br-004|br-006|br-009|br-010|bias|popia|compliance)/i.test(qLower)) {
            responseText = `### **QUICK HIRE Business Rules & Compliance**\n\n` +
              `- **BR-001/BR-002:** Authenticated recruiters upload/rank; administrators manage system.\n` +
              `- **BR-004:** Ranking driven by semantic similarity (min 60% weight) + skill matching.\n` +
              `- **BR-006:** Factor explanations provided for transparent ranking breakdown.\n` +
              `- **BR-009:** Bias prevention: No demographic details (age, race, gender, address) are used.\n` +
              `- **BR-010:** Recommendations are advisory; human recruiters retain final decision authority.\n` +
              `- **POPIA Compliance:** Adheres to South African data protection and deletion mandates.`;
          } else if (/(how to|guide|navigate|navigation|upload cv|export|report|filters?|constraints?|performance|sla)/i.test(qLower)) {
            responseText = `### **QUICK HIRE System Navigation & Export Reports**\n\n` +
              `- **Upload CVs:** Batch upload up to 50 CVs in PDF, PNG, or JPEG format (max 10MB each).\n` +
              `- **Job Descriptions:** Ingest target roles with required & preferred skills.\n` +
              `- **Dashboard:** Interactive candidate ranking table, score distribution charts, and filters by score/experience/department.\n` +
              `- **Export Reports:** Generate and download PDF candidate dossiers or Excel (.xlsx) ranking summary reports.\n` +
              `- **Performance SLAs:** CV processing < 30 seconds; ranking 1,000 candidates < 10 seconds; chatbot response < 3 seconds.`;
          } else if (/(ranking methodology|score breakdown|ranking algorithm|how.*ranked)/i.test(qLower)) {
            responseText = `### **QUICK HIRE Ranking Methodology**\n\n` +
              `- **Semantic Similarity (min 60% weight, BR-004):** Contextual alignment computed via SentenceTransformers dense embeddings and Cosine Similarity.\n` +
              `- **Explicit Skill Match (up to 40% weight):** Exact keyword & spaCy NLP entity extraction against required and preferred skills.\n` +
              `- **Formula:** Overall Score = (Semantic Score * 0.60) + (Skill Score * 0.40)\n` +
              `- **Human-in-the-loop (BR-010):** Rankings are advisory; human recruiters retain final decision authority.`;
          } else if (/(shortlists?|how to shortlist)/i.test(qLower)) {
            responseText = `### **Shortlisting Candidates**\n\n` +
              `- You can filter candidates on the Dashboard by match score (e.g. 85%+), minimum years of experience, or required skills.\n` +
              `- Export shortlisted candidates to PDF or Excel directly from the Reports view.`;
          } else if (/(ocr accuracy|ocr target|tesseract)/i.test(qLower)) {
            responseText = `### **OCR Processing Standards**\n\n` +
              `- Tesseract OCR operates with an **80%+ accuracy SLA**.\n` +
              `- Supported formats: PDF, PNG, JPEG with automated grayscale, adaptive binarization, and deskewing image enhancement.`;
          } else if (/(semantic similarity)/i.test(qLower)) {
            responseText = `### **Semantic Similarity**\n\n` +
              `- Measures contextual meaning beyond exact keywords using SentenceTransformers embeddings.\n` +
              `- Carries a minimum 60% weight in candidate rankings (BR-004).`;
          } else if (/(skill matching)/i.test(qLower)) {
            responseText = `### **Skill Matching Engine**\n\n` +
              `- Custom spaCy NLP Named Entity Recognition parses technical and soft skills from CVs.\n` +
              `- Matches extracted skills against required and preferred competencies in the Job Description.`;
          } else if (/(data privacy|privacy policy|popia)/i.test(qLower)) {
            responseText = `### **Data Privacy & Compliance**\n\n` +
              `- Fully compliant with South African POPIA and GDPR standards.\n` +
              `- Data is encrypted at rest and in transit, with full candidate deletion rights supported.`;
          } else {
            // Check for specific candidate
            const candMatch = candidatesWithRankings.find((c: any) => {
              const name = (c.name || '').toLowerCase();
              const code = (c.candidate_code || '').toLowerCase();
              return (name && qLower.includes(name)) || (code && qLower.includes(code));
            });

            if (candMatch) {
              const sd = candMatch.structured_data || {};
              const skills = sd.all_skills?.join(', ') || 'N/A';
              const exp = sd.total_experience_years || 0;
              const edu = sd.education?.degree || sd.education_history?.[0]?.degree || 'N/A';
              const rank = candMatch.bestRank ? `#${candMatch.bestRank.rank_position} (${Math.round(candMatch.bestRank.overall_score * 100)}% match)` : 'Unranked';

              responseText = `### **Candidate Dossier: ${candMatch.name} (${candMatch.candidate_code || 'CAND'})**\n\n` +
                `- **Email:** ${candMatch.email || 'N/A'} | **Phone:** ${candMatch.phone || 'N/A'}\n` +
                `- **Education:** ${edu} at ${sd.education?.institution || 'N/A'}\n` +
                `- **Experience:** ${exp} years\n` +
                `- **Skills:** ${skills}\n` +
                `- **Ranking Status:** ${rank}`;
            } else if (/(top candidates?|best candidates?|compare|recommend|show.*candidates?)/i.test(qLower) && candidatesWithRankings.length > 0) {
              const sorted = [...candidatesWithRankings].sort((a: any, b: any) => (b.bestRank?.overall_score || 0) - (a.bestRank?.overall_score || 0));
              responseText = `### **Top Candidates Overview**\n\n` +
                sorted.slice(0, 5).map((c: any, i: number) => {
                  const score = c.bestRank ? `${Math.round(c.bestRank.overall_score * 100)}% match` : 'Unranked';
                  return `${i + 1}. **${c.name}** — ${score} | ${c.structured_data?.total_experience_years || 0} yrs exp`;
                }).join('\n');
            } else {
              // Strict Unrecognized Instruction Fallback
              responseText = `I did not recognize that instruction.\n\nI am your QUICK HIRE recruitment assistant. I can help you with:\n- System architecture and processing pipeline details\n- Business rules (BR-001 to BR-010) and POPIA compliance\n- Deep candidate dossiers and ranking evaluations\n\nPlease clarify your request or specify what you would like to know.`;
            }
          }
        }
      }
    } else {
      responseText = `I did not recognize that instruction or the AI service is offline. Please specify a system query or candidate name.`;
    }

    // 4. Response Audit Logging to chat_logs
    try {
      await supabase.from('chat_logs').insert({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        message: responseText,
        query_text: message,
        response_text: responseText,
        intent: 'gemini-2.0-flash-rag',
        confidence: isRateLimited ? 0.0 : 0.95,
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[Chatbot Edge Function] chat_logs insert warning:', auditErr);
    }

    // Return candidate attachments ONLY if the user specifically asked for candidate recommendations or profiles
    let candidateCards: any[] | undefined = undefined;
    const isSeekingCandidates = /\b(top candidates?|best candidates?|who is|tell me about|profile of|show candidates?|compare|recommend)\b/i.test(message);
    const isUnrecognized = /did not recognize/i.test(responseText);

    if (isSeekingCandidates && !isUnrecognized && candidatesWithRankings.length > 0) {
      candidateCards = candidatesWithRankings.slice(0, 3).map((c: any) => ({
        id: c.id,
        name: c.name,
        relevance_score: c.bestRank?.overall_score || 0.85,
        years_experience: c.structured_data?.total_experience_years || 0,
        all_skills: c.structured_data?.all_skills || [],
      }));
    }

    return new Response(
      JSON.stringify({
        type: 'text',
        text: responseText,
        session_id: sessionId,
        is_rate_limit: isRateLimited,
        candidates: candidateCards,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Chatbot Edge Function Exception]:', err);
    return new Response(
      JSON.stringify({
        error: String(err?.message || err),
        text: 'An unexpected error occurred while processing your request. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
