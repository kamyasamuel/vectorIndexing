"""
Faithfulness Evaluation for RAG outputs.

Measures whether the claims in the generated answer are supported by
the retrieved context documents. Uses an LLM-as-judge approach with
claim extraction and verification.

Score range: 0.0 (completely unfaithful) to 1.0 (fully faithful).
"""

from typing import List, Dict, Any, Optional, Tuple
import re

from app.ai.providers import get_provider


FAITHFULNESS_SYSTEM_PROMPT = """You are an expert evaluator of AI-generated answers.
Your task is to determine whether each factual claim in an answer is supported by
the provided context.

For each claim in the answer, determine if it is:
- SUPPORTED: The claim is directly stated in or clearly implied by the context.
- NOT_SUPPORTED: The claim contradicts the context or has no evidence in the context.

Output your evaluation as a JSON object:
{
    "claims": [
        {"text": "The claim text", "status": "SUPPORTED|NOT_SUPPORTED"},
        ...
    ],
    "summary": {
        "total_claims": 5,
        "supported": 4,
        "not_supported": 1
    },
    "faithfulness_score": 0.8
}

Be strict but fair. Minor paraphrasing differences should not count as unsupported
if the meaning is clearly present in the context."""


class FaithfulnessEvaluator:
    """Evaluates answer faithfulness by checking claims against context.

    Uses an LLM to extract claims from the answer and verify each one
    against the retrieved context chunks.
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.provider_name = provider_name

    def evaluate(
        self,
        query: str,
        answer: str,
        contexts: List[str],
    ) -> Dict[str, Any]:
        """Evaluate faithfulness of an answer to the retrieved contexts.

        Args:
            query: The original user query.
            answer: The generated answer text.
            contexts: List of context strings (chunk contents) used.

        Returns:
            Dict with keys: score (0-1), total_claims, supported_claims,
                            unsupported_claims, details (per-claim breakdown).
        """
        if not answer.strip():
            return {
                "score": 1.0,
                "total_claims": 0,
                "supported_claims": 0,
                "unsupported_claims": 0,
                "details": [],
                "error": None,
            }

        context_text = "\n\n---\n\n".join(contexts)

        try:
            provider = get_provider(self.provider_name)

            prompt = f"""Context:
{context_text}

Answer to evaluate:
{answer}

Evaluate each claim in the answer against the context above."""

            response = provider.generate(
                prompt,
                system_prompt=FAITHFULNESS_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=1024,
            )

            result = self._parse_response(response)

            return {
                "score": result.get("faithfulness_score", 0.0),
                "total_claims": result.get("summary", {}).get("total_claims", 0),
                "supported_claims": result.get("summary", {}).get("supported", 0),
                "unsupported_claims": result.get("summary", {}).get("not_supported", 0),
                "details": result.get("claims", []),
                "error": None,
            }

        except Exception as e:
            print(f"Faithfulness evaluation failed: {e}")
            return {
                "score": 0.0,
                "total_claims": 0,
                "supported_claims": 0,
                "unsupported_claims": 0,
                "details": [],
                "error": str(e),
            }

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM JSON response, handling markdown code blocks."""
        response = response.strip()
        # Handle possible markdown code blocks
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()

        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback: try to find JSON object in the response
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            return {
                "claims": [],
                "summary": {"total_claims": 0, "supported": 0, "not_supported": 0},
                "faithfulness_score": 0.0,
            }