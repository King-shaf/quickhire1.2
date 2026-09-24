from sentence_transformers import SentenceTransformer
import numpy as np
from .config import EMBEDDING_MODEL_NAME

class EmbeddingGenerator:
    """
    SentenceTransformer generator using configuration-defined model.
    Produces embeddings with fallback mechanism.
    """
    def __init__(self, model_name=EMBEDDING_MODEL_NAME):
        try:
            self.model = SentenceTransformer(model_name)
            self.fallback = False
            print(f"Successfully loaded SentenceTransformer model: {model_name}")
        except Exception as e:
            print(f"Warning: Failed to load SentenceTransformer model ({e}). Using fallback mock embeddings.")
            self.model = None
            self.fallback = True

    def generate_embedding(self, text):
        """
        Generate embedding for text with normalization.
        """
        if self.fallback or not self.model:
            # Simple deterministic fallback: use a fixed-size vector based on text hash
            import hashlib
            h = hashlib.sha256(text.encode('utf-8')).digest()
            # Convert hash to 384-dim vector (repeat hash bits to fill)
            vec = []
            for i in range(384):
                val = h[i % len(h)]
                # Normalize to range [-1, 1]
                vec.append((val / 127.5) - 1.0)
            
            # Normalize vector
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = [v / norm for v in vec]
            return vec

        # Encode text and normalize for cosine similarity
        embedding = self.model.encode(text, normalize_embeddings=True)
        # Convert to list for JSON storage
        return embedding.tolist()

    def batch_generate(self, texts):
        """
        Generate embeddings for a list of texts.
        """
        if self.fallback or not self.model:
            return [self.generate_embedding(t) for t in texts]

        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    @staticmethod
    def cosine_similarity(embedding1, embedding2):
        """
        Compute cosine similarity between two embeddings.
        """
        # Since we use normalize_embeddings=True, 
        # cosine similarity is just the dot product.
        return np.dot(embedding1, embedding2)
