"""
Answer Relevance Evaluation for RAG outputs.

Measures how well the generated answer addresses the user's query.
Uses an LLM to judge if the answer is responsive, complete, and on-topic.

Score range: 0.0 (completely irrelevant) to 1.0 (perfectly relevant).
"""

from typing import List, Dict, Any, Optional
import re

from app.ai.providers import get_provider


RELEVANCE_SYSTEM_PROMPT = """You are an expert evaluator of AI answer quality.
Your task is to assess how relevant and complete an answer is with respect
to the user's query.

Evaluate the answer on three dimensions:
1. RESPONSIVENESS: Does the answer directly address the query?
2. COMPLETENESS: Does it cover all aspects of the query?
3. FOCUS: Is the answer on-topic without irrelevant information?

Output your evaluation as a JSON object:
{
    "responsiveness_score": 0.9,
    "completeness_score": 0.8,
    "focus_score": 1.0,
    "overall_relevance": 0.9,
    "strengths": ["Directly answers the question", "Uses relevant citations"],
    "weaknesses": ["Could provide more detail on aspect X"],
    "reasoning": "Brief explanation of the score"
}

Score each dimension from 0.0 to 1.0.
The overall_relevance is the average of the three dimension scores."""


class RelevanceEvaluator:
    """Evaluates how relevant and complete a generated answer is.

    Assesses whether the answer addresses the query directly, covers
    all aspects, and stays on-topic without irrelevant information.
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.provider_name = provider_name

    def evaluate(
        self,
        query: str,
        answer: str,
    ) -> Dict[str, Any]:
        """Evaluate relevance of an answer to the original query.

        Args:
            query: The original user query.
            answer: The generated answer.

        Returns:
            Dict with keys: score (0-1), responsiveness, completeness,
                            focus, strengths, weaknesses, reasoning.
        """
        if not answer.strip():
            return {
                "score": 0.0,
                "responsiveness": 0.0,
                "completeness": 0.0,
                "focus": 0.0,
                "strengths": [],
                "weaknesses": ["Empty answer"],
                "reasoning": "No answer was generated.",
            }

        try:
            provider = get_provider(self.provider_name)

            prompt = f"""Query: {query}

Answer: {answer}

Evaluate the relevance of this answer to the query."""

            response = provider.generate(
                prompt,
                system_prompt=RELEVANCE_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=1024,
            )

            result = self._parse_response(response)

            return {
                "score": result.get("overall_relevance", 0.0),
                "responsiveness": result.get("responsiveness_score", 0.0),
                "completeness": result.get("completeness_score", 0.0),
                "focus": result.get("focus_score", 0.0),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
                "reasoning": result.get("reasoning", ""),
            }

        except Exception as e:
            print(f"Relevance evaluation failed: {e}")
            return {
                "score": 0.0,
                "responsiveness": 0.0,
                "completeness": 0.0,
                "focus": 0.0,
                "strengths": [],
                "weaknesses": [f"Evaluation error: {str(e)}"],
                "reasoning": "Evaluation failed due to an error.",
            }

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM JSON response, handling markdown code blocks."""
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
            return {
                "overall_relevance": 0.0,
                "responsiveness_score": 0.0,
                "completeness_score": 0.0,
                "focus_score": 0.0,
                "strengths": [],
                "weaknesses": ["Failed to parse evaluation"],
                "reasoning": "Could not parse LLM response.",
            }