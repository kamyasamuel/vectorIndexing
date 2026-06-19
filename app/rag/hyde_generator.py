"""
Hypothetical Document Embeddings (HyDE) module.

HyDE improves retrieval for abstract or conceptual queries by:
1. Using an LLM to generate a "hypothetical document" that would perfectly answer the query
2. Embedding that hypothetical document instead of the original query
3. Searching using the HyDE embedding

This helps overcome the vocabulary mismatch problem where short query embeddings
may not be close to the relevant document embeddings in vector space.

Example:
  Query: "What are the environmental impacts of industrial agriculture?"
  HyDE: "A comprehensive analysis of industrial agriculture's environmental impacts
         reveals significant concerns including greenhouse gas emissions from livestock,
         soil degradation from monocropping practices, water pollution from fertilizer
         runoff, biodiversity loss due to habitat destruction, and pesticide-related
         ecosystem damage. Studies show that..."
"""

from typing import Optional, List, Dict, Any

from app.ai.providers import get_provider, get_embedding_provider


HYDE_SYSTEM_PROMPT = """You are a document generation assistant. Given a question, generate a
hypothetical document that would perfectly answer that question. The document should:

1. Be 100-200 words long
2. Be written in a factual, informative style
3. Directly address the question with specific details
4. Use relevant technical terminology and keywords
5. Read like an actual document excerpt from a knowledge base
6. NOT include any meta-commentary (like "here is a document about...")
7. Just output the document content directly

The goal is to create a text that, when embedded, will be semantically close to
the actual relevant documents in the vector store."""


class HyDEGenerator:
    """Generates hypothetical document embeddings for improved retrieval.
    
    Uses an LLM to synthesize a "perfect" document for the query,
    then embeds that document for search instead of the query itself.
    """
    
    def __init__(
        self,
        llm_provider_name: Optional[str] = None,
        embedding_provider_name: Optional[str] = None,
        enabled: bool = True,
    ):
        self.llm_provider_name = llm_provider_name
        self.embedding_provider_name = embedding_provider_name
        self.enabled = enabled
    
    def generate_hypothetical_document(self, query: str) -> str:
        """Generate a hypothetical document that would answer the query.
        
        Args:
            query: The user's query.
            
        Returns:
            A hypothetical document string.
        """
        if not self.enabled:
            return query
        
        try:
            provider = get_provider(self.llm_provider_name)
            
            hypo_doc = provider.generate(
                query,
                system_prompt=HYDE_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=500,
            )
            
            # Clean up
            hypo_doc = hypo_doc.strip()
            if not hypo_doc:
                return query
            
            return hypo_doc
            
        except Exception as e:
            print(f"HyDE generation failed (falling back to original query): {e}")
            return query
    
    def embed_for_search(self, query: str) -> List[float]:
        """Generate a HyDE embedding for search.
        
        Creates a hypothetical document, embeds it, and returns the embedding.
        
        Args:
            query: The user's query.
            
        Returns:
            Embedding vector as list of floats.
        """
        hypo_doc = self.generate_hypothetical_document(query)
        
        embedder = get_embedding_provider(self.embedding_provider_name)
        return embedder.embed(hypo_doc)