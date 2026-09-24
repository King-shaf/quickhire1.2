import unittest
from unittest.mock import MagicMock
from ai.embedding.generator import EmbeddingGenerator
from ai.ranking.engine import RankingEngine
import numpy as np

class TestAIModules(unittest.TestCase):
    def setUp(self):
        # Mock EmbeddingGenerator to avoid downloading models
        self.embed_gen = MagicMock(spec=EmbeddingGenerator)
        self.embed_gen.generate_embedding.side_effect = lambda x: [0.1] * 384
        self.ranking_engine = RankingEngine()

    def test_embedding_generation(self):
        text = "Software Engineer with 5 years of experience in Python and Django."
        embedding = self.embed_gen.generate_embedding(text)
        self.assertEqual(len(embedding), 384)

    def test_ranking_logic(self):
        # Prepare mock embeddings that produce higher similarity for candidate 1
        job_emb = [0.1] * 384
        c1_emb = [0.1] * 384
        c2_emb = [0.0] * 384 # Lower similarity
        
        job = {
            'embedding': job_emb,
            'required_skills': ['Python', 'Django'],
            'preferred_skills': ['React']
        }
        candidates = [
            {
                'id': 1,
                'embedding': c1_emb,
                'skills': ['Python', 'Django', 'React']
            },
            {
                'id': 2,
                'embedding': c2_emb,
                'skills': ['Java']
            }
        ]
        
        results = self.ranking_engine.rank_candidates(candidates, job)
        
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['candidate_id'], 1) # Candidate 1 should be ranked higher
        self.assertGreater(results[0]['overall_score'], results[1]['overall_score'])

if __name__ == '__main__':
    unittest.main()
