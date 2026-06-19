"""
Multi-Query Retrieval module.

Generates multiple semantically different variations of the user's query,
searches for each independently, then merges the unique results.

This helps find documents that might be missed by a single query due to:
- Different phrasings of the same concept
- Different levels of specificity
- Different perspectives on the same topic

Example:
  Query: "Tell me about machine learning"
  Variants:
    - "What are the fundamental concepts and algorithms in machine learning?"
    - "How does supervised learning differ from unsupervised learning?"
    - "What are practical applications of machine learning in industry?"
"""

from typing import Optional, List, Dict, Any, Set
import json

from app.ai.providers import get_provider


MULTI_QUERY_SYSTEM_PROMPT = """You are a search query generation assistant. Given a user's question,
generate {num_queries} different versions of the question that would help find
relevant documents from different angles.

Rules:
1. Each query should be self-contained and specific
2. Cover different aspects, phrasings, or perspectives
3. Vary in specificity (some broad, some narrow)
4. Each query should be 5-20 words
5. Output as a JSON array of strings ONLY
6. No markdown, no numbering, no explanation

Example:
Input: "What is the impact of climate change on agriculture?"
Output: ["How does climate change affect crop yields and farming practices?", "What are the economic consequences of climate change for agriculture?", "Which agricultural regions are most vulnerable to climate change?", "How are farmers adapting to changing weather patterns and temperatures?"]"""


class MultiQueryGenerator:
    """Generates multiple query variations for comprehensive retrieval.
    
    Each variant covers a different facet of the query, and results from
    all variants are merged with deduplication.
    """
    
    def __init__(
        self,
        provider_name: Optional[str] = None,
        num_queries: int = 3,
        enabled: bool = True,
    ):
        self.provider_name = provider_name
        self.num_queries = num_queries
        self.enabled = enabled
    
    def generate_variants(self, query: str) -> List[str]:
        """Generate multiple query variants.
        
        Args:
            query: The original user query.
            
        Returns:
            List of query strings including the original + variants.
        """
        if not self.enabled:
            return [query]
        
        # Always include the original query
        variants = [query]
        
        try:
            provider = get_provider(self.provider_name)
            
            prompt = f"Input: {query}\nOutput:"
            response = provider.generate(
                prompt,
                system_prompt=MULTI_QUERY_SYSTEM_PROMPT.format(
                    num_queries=self.num_queries
                ),
                temperature=0.5,
                max_tokens=300,
            )
            
            # Parse JSON array from response
            response = response.strip()
            # Handle possible markdown code blocks
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                response = response.split("```")[1].split("```")[0].strip()
            
            generated = json.loads(response)
            if isinstance(generated, list):
                for g in generated:
                    if isinstance(g, str) and g.strip() and g != query:
                        variants.append(g.strip())
            
            # Limit total variants
            return variants[:self.num_queries + 1]
            
        except Exception as e:
            print(f"Multi-query generation failed (using single query): {e}")
            return [query]
    
    def merge_results(
        self,
        all_results: List[List[Dict[str, Any]]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Merge results from multiple query searches with deduplication.
        
        Uses a simple round-robin merge to ensure diverse results.
        Duplicate chunks (same ID) are skipped.
        
        Args:
            all_results: List of result lists, one per query variant.
            top_k: Number of final results to return.
            
        Returns:
            Merged and deduplicated result list.
        """
        seen_ids: Set[str] = set()
        merged = []
        
        # Round-robin through each query's results
        max_len = max(len(r) for r in all_results) if all_results else 0
        
        for i in range(max_len):
            for result_list in all_results:
                if i < len(result_list):
                    result = result_list[i]
                    chunk_id = result.get("id", "")
                    if chunk_id and chunk_id not in seen_ids:
                        seen_ids.add(chunk_id)
                        result["multi_query_rank"] = len(merged) + 1
                        merged.append(result)
                        
                        if len(merged) >= top_k:
                            return merged
        
        return merged[:top_k]