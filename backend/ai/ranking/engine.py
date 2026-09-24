import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from .config import SEMANTIC_WEIGHT, SKILL_WEIGHT, REQUIRED_SKILL_PORTION, PREFERRED_SKILL_PORTION

class RankingEngine:
    """
    Ranking engine for candidate ranking based on:
    1. Semantic similarity (embedding-based)
    2. Skill match (keyword-based)
    """
    def __init__(self, semantic_weight=SEMANTIC_WEIGHT, skill_weight=SKILL_WEIGHT):
        self.semantic_weight = semantic_weight
        self.skill_weight = skill_weight

    def calculate_skill_match_score(self, candidate_skills, job_required_skills, job_preferred_skills):
        """
        Skill match score = (matched_required/total_required)*0.7 + (matched_preferred/total_preferred)*0.3.
        """
        candidate_skills_set = set(candidate_skills)
        
        # Calculate required match
        required_match_count = sum(1 for skill in job_required_skills if skill in candidate_skills_set)
        required_score = required_match_count / len(job_required_skills) if job_required_skills else 1.0
        
        # Calculate preferred match
        preferred_match_count = sum(1 for skill in job_preferred_skills if skill in candidate_skills_set)
        preferred_score = preferred_match_count / len(job_preferred_skills) if job_preferred_skills else 1.0
        
        # Composite skill score
        skill_score = (required_score * REQUIRED_SKILL_PORTION) + (preferred_score * PREFERRED_SKILL_PORTION)
        return skill_score, required_match_count, preferred_match_count

    def calculate_overall_score(self, semantic_score, skill_score):
        """
        Overall = 0.6×semantic + 0.4×skill.
        """
        return (self.semantic_weight * semantic_score) + (self.skill_weight * skill_score)

    def rank_candidates(self, candidates, job_description):
        """
        Rank a list of candidates against a job description.
        candidates: List of candidate dicts with 'embedding' and 'skills'
        job_description: Dict with 'embedding', 'required_skills', 'preferred_skills'
        """
        job_embedding = np.array(job_description['embedding']).reshape(1, -1)
        ranked_results = []
        
        for candidate in candidates:
            candidate_embedding = np.array(candidate['embedding']).reshape(1, -1)
            
            # 1. Semantic similarity
            semantic_score = float(cosine_similarity(job_embedding, candidate_embedding)[0][0])
            
            # 2. Skill match score
            skill_score, req_count, pref_count = self.calculate_skill_match_score(
                candidate['skills'], 
                job_description['required_skills'], 
                job_description['preferred_skills']
            )
            
            # 3. Overall composite score
            overall_score = self.calculate_overall_score(semantic_score, skill_score)
            
            # Generate explanation
            explanation = (
                f"Candidate matches {req_count} required skills and {pref_count} preferred skills. "
                f"Semantic similarity is {semantic_score:.2f}."
            )
            
            ranked_results.append({
                'candidate_id': candidate['id'],
                'semantic_score': semantic_score,
                'skill_match_score': skill_score,
                'overall_score': overall_score,
                'explanation': explanation
            })
            
        # Sort by overall score in descending order
        ranked_results.sort(key=lambda x: x['overall_score'], reverse=True)
        
        # Assign rank positions
        for i, res in enumerate(ranked_results):
            res['rank_position'] = i + 1
            
        return ranked_results
