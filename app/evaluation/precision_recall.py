"""
Context Precision and Recall Evaluation for RAG.

- Context Precision: What fraction of the retrieved chunks are actually
  relevant to the query? (Higher = less noise in retrieval)
- Context Recall: What fraction of all relevant chunks in the corpus were
  retrieved? (Higher = less missing information)

Uses an LLM to judge chunk relevance when ground truth is not available.
When manual relevance labels are provided, uses those for exact metrics.
"""

from typing import List, Dict, Any, Optional
import re

from app.ai.providers import get_provider


PRECISION_SYSTEM_PROMPT = """You are an expert evaluator of document retrieval quality.
Your task is to determine whether each retrieved chunk/document is relevant
to the user's query.

For each chunk, determine if it is:
- RELEVANT: The chunk contains information that helps answer the query.
- NOT_RELEVANT: The chunk does not contain useful information for the query.

Output as a JSON object:
{
    "judgments": [
        {"chunk_index": 0, "relevant": true, "reasoning": "Brief explanation"},
        {"chunk_index": 1, "relevant": false, "reasoning": "Explanation..."}
    ],
    "summary": {
        "total": 5,
        "relevant": 4,
        "not_relevant": 1
    },
    "precision": 0.8
}

Be strict: a chunk is only relevant if it meaningfully addresses the query."""


class PrecisionRecallEvaluator:
    """Evaluates context precision and recall for RAG retrieval.

    Precision: fraction of retrieved chunks that are relevant.
    Recall: fraction of all relevant chunks that were retrieved.
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.provider_name = provider_name

    def evaluate_precision(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate precision of retrieved chunks.

        Args:
            query: The search query.
            retrieved_chunks: List of chunk dicts with at least "content" key.

        Returns:
            Dict with keys: precision (0-1), relevant_count, total_count,
                            judgments (per-chunk relevance decisions).
        """
        if not retrieved_chunks:
            return {
                "precision": 1.0,
                "relevant_count": 0,
                "total_count": 0,
                "judgments": [],
            }

        try:
            provider = get_provider(self.provider_name)

            # Build chunk text with indices
            chunk_lines = []
            for i, chunk in enumerate(retrieved_chunks):
                content = chunk.get("content", "")[:300]  # Limit per chunk
                chunk_lines.append(f"[Chunk {i}] {content}")

            chunks_text = "\n\n".join(chunk_lines)

            prompt = f"""Query: {query}

Retrieved chunks:
{chunks_text}

Judge the relevance of each chunk to the query."""

            response = provider.generate(
                prompt,
                system_prompt=PRECISION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=2048,
            )

            result = self._parse_response(response)
            judgments = result.get("judgments", [])

            relevant_count = sum(
                1 for j in judgments if j.get("relevant", False)
            )
            total_count = len(judgments)

            return {
                "precision": result.get("precision", relevant_count / max(total_count, 1)),
                "relevant_count": relevant_count,
                "total_count": total_count,
                "judgments": judgments,
            }

        except Exception as e:
            print(f"Precision evaluation failed: {e}")
            # Fallback: treat all chunks as unverifiable
            return {
                "precision": 0.0,
                "relevant_count": 0,
                "total_count": len(retrieved_chunks),
                "judgments": [],
                "error": str(e),
            }

    def evaluate_recall(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        all_corpus_chunks: Optional[List[Dict[str, Any]]] = None,
        relevant_chunk_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Evaluate recall of retrieved chunks.

        Two modes:
        1. If relevant_chunk_ids is provided, uses exact ground truth.
        2. Otherwise, estimates recall by asking the LLM to identify
           what's missing from the retrieval.

        Args:
            query: The search query.
            retrieved_chunks: Chunks that were retrieved.
            all_corpus_chunks: All chunks in the corpus (for exact recall).
            relevant_chunk_ids: Ground truth IDs of all relevant chunks.

        Returns:
            Dict with keys: recall (0-1), retrieved_relevant, total_relevant.
        """
        if relevant_chunk_ids:
            # Exact recall with ground truth
            retrieved_ids = {c.get("id", "") for c in retrieved_chunks}
            retrieved_relevant = len(retrieved_ids & set(relevant_chunk_ids))
            total_relevant = len(relevant_chunk_ids)

            return {
                "recall": retrieved_relevant / max(total_relevant, 1),
                "retrieved_relevant": retrieved_relevant,
                "total_relevant": total_relevant,
                "method": "exact",
            }

        if not retrieved_chunks:
            return {
                "recall": 1.0,
                "retrieved_relevant": 0,
                "total_relevant": 0,
                "method": "estimated",
            }

        # Estimate recall via LLM judgment
        try:
            provider = get_provider(self.provider_name)

            recall_prompt = f"""Query: {query}

The following chunks were retrieved:
{[c.get('content', '')[:200] for c in retrieved_chunks]}

Based on the query, do you think there are likely relevant chunks that
were MISSED by the retrieval? Estimate what fraction of all relevant
content was captured.

Output as JSON:
{{
    "estimated_recall": 0.75,
    "reasoning": "Explanation of the estimate",
    "likely_missing_topics": ["topic1", "topic2"]
}}"""

            response = provider.generate(
                recall_prompt,
                system_prompt="You are a retrieval quality analyst. Estimate recall based on the query and what was retrieved.",
                temperature=0.1,
                max_tokens=512,
            )

            result = self._parse_response(response)

            return {
                "recall": result.get("estimated_recall", 0.5),
                "retrieved_relevant": len(retrieved_chunks),
                "total_relevant": "estimated",
                "reasoning": result.get("reasoning", ""),
                "likely_missing_topics": result.get("likely_missing_topics", []),
                "method": "estimated",
            }

        except Exception as e:
            print(f"Recall estimation failed: {e}")
            return {
                "recall": 0.0,
                "retrieved_relevant": 0,
                "total_relevant": "unknown",
                "error": str(e),
                "method": "failed",
            }

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM JSON response."""
        response = response.strip()
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()

        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            return {"judgments": [], "precision": 0.0, "summary": {}}