from models.models import Ranking, Candidate, JobDescription

class ChatActions:
    @staticmethod
    def get_top_candidates(job_id=None, limit=5):
        """
        Fetch top N candidates for a job.
        """
        query = Ranking.objects.all()
        if job_id:
            query = query.filter(job_id=job_id)
        
        rankings = query.select_related('candidate', 'job').order_by('rank_position')[:limit]
        if not rankings.exists():
            return "I couldn't find any ranked candidates in the system yet. Please upload CVs and trigger ranking."
        
        response = f"### **Top Ranked Candidates**\n\n"
        for r in rankings:
            c = r.candidate
            skills = ", ".join([s.name for s in c.skills.all()][:4]) or "N/A"
            exp = c.structured_data.get('total_experience_years', 0) if c.structured_data else 0
            response += f"{r.rank_position}. **{c.name}** — **{r.overall_score*100:.1f}% match** | {exp} yrs exp | *Skills:* {skills}\n"
        
        response += "\n*Note: Advisory ranking (BR-010). Recruiters maintain final decision authority.*"
        return response

    @staticmethod
    def get_candidate_details(candidate_name):
        """
        Fetch details and explanation for a specific candidate.
        """
        candidates = Candidate.objects.filter(name__icontains=candidate_name)
        if not candidates.exists():
            return f"I couldn't find a candidate named '{candidate_name}' in the QUICK HIRE database."
        
        c = candidates.first()
        skills = ", ".join([s.name for s in c.skills.all()]) or "N/A"
        sd = c.structured_data or {}
        exp = sd.get('total_experience_years', 0)
        degree = sd.get('education', {}).get('degree') or 'N/A'
        
        # Check ranking
        ranking = Ranking.objects.filter(candidate=c).first()
        score_info = f"Rank #{ranking.rank_position} ({ranking.overall_score*100:.1f}% overall match)" if ranking else "Not ranked yet"
        explanation = ranking.explanation if ranking and ranking.explanation else "Candidate profile analyzed via Tesseract OCR and spaCy NLP pipeline."

        return f"### **Candidate Profile: {c.name}**\n\n" \
               f"- **Email:** {c.email or 'N/A'}\n" \
               f"- **Status:** {score_info}\n" \
               f"- **Total Experience:** {exp} years\n" \
               f"- **Highest Degree:** {degree}\n" \
               f"- **Extracted Skills:** {skills}\n" \
               f"- **Factor Explanation:** {explanation}"

    @staticmethod
    def compare_candidates(names):
        """
        Compare candidates side-by-side with a markdown table.
        """
        cands = []
        for name in names:
            c = Candidate.objects.filter(name__icontains=name.strip()).first()
            if c:
                cands.append(c)
        
        if len(cands) < 2:
            cands = list(Candidate.objects.all()[:2])
            
        if len(cands) < 2:
            return "At least two candidates are required for a side-by-side comparison."

        table = "### **Candidate Comparison**\n\n"
        table += "| Candidate | Experience | Degree | Core Skills | Match Score |\n"
        table += "| :--- | :--- | :--- | :--- | :--- |\n"
        for c in cands:
            sd = c.structured_data or {}
            skills = ", ".join([s.name for s in c.skills.all()][:3]) or "N/A"
            exp = f"{sd.get('total_experience_years', 0)} yrs"
            degree = sd.get('education', {}).get('degree') or 'N/A'
            r = Ranking.objects.filter(candidate=c).first()
            score = f"{r.overall_score*100:.1f}%" if r else "N/A"
            table += f"| **{c.name}** | {exp} | {degree} | {skills} | {score} |\n"
        
        return table

    @staticmethod
    def get_system_architecture():
        return """### **QUICK HIRE System Architecture & Pipeline (SRS v1.0, Group 19)**

**1. Upload & Ingestion Layer:**
- **Formats:** PDF, JPEG, PNG (max 10MB/file, up to 50 files per batch) via `pdf2image` and Poppler. Plain text for Job Descriptions.

**2. Processing Pipeline:**
- **Image Enhancement:** Optimizes scan clarity.
- **Tesseract OCR:** High accuracy text extraction (80%+ target).
- **PyTorch CNN:** Layout & document structure analysis.
- **spaCy NLP Engine:** Entity extraction (skills, education, job titles, experience duration).
- **SentenceTransformers:** Computes semantic vector embeddings for contextual matching.

**3. Matching & Ranking:**
- **Cosine Similarity:** Semantic vector similarity (min 60% weight).
- **Explicit Skill Matching:** Keyword and entity requirement validation.
- **Backend & Storage:** PostgreSQL 13+, Django/FastAPI backend, React frontend, and LLM chatbot."""

    @staticmethod
    def get_business_rules():
        return """### **QUICK HIRE Business Rules & Governance**

- **BR-001/BR-002:** Role-based access (Recruiters upload/rank; Admins manage system).
- **BR-004:** Ranking driven by semantic similarity (minimum 60% weight) + explicit skill match.
- **BR-006:** Transparent factor explanations for all computed scores.
- **BR-009 (Bias Prevention):** Demographic details (age, race, gender, address) are excluded from scoring.
- **BR-010 (Human-in-the-Loop):** System ranking is advisory; recruiters retain final hiring authority.
- **POPIA Compliance:** Full compliance with South African data privacy & deletion mandates."""

    @staticmethod
    def get_help():
        return """### **QUICK HIRE AI Recruitment Assistant Help**

You can ask me questions such as:
- *"Show me top candidates for Job X"*
- *"Explain the ranking score for John Doe"*
- *"Compare Candidate A and Candidate B"*
- *"What is the QUICK HIRE processing pipeline and tech stack?"*
- *"What are the business rules for bias mitigation and ranking (BR-004, BR-009, BR-010)?"*
- *"How do I upload CVs or export ranking reports?"*"""

