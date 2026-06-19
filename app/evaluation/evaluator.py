"""
Main RAG Evaluation Harness that orchestrates all individual metrics.

Provides a unified interface for running the full evaluation suite
on any RAG pipeline output:
1. Faithfulness — Are claims in the answer supported by context?
2. Answer Relevance — Does the answer address the query?
3. Context Precision — Are retrieved chunks relevant?
4. Context Recall — Were all relevant chunks retrieved?
"""

from typing import List, Dict, Any, Optional
import time

from app.evaluation.faithfulness import FaithfulnessEvaluator
from app.evaluation.relevance import RelevanceEvaluator
from app.evaluation.precision_recall import PrecisionRecallEvaluator


class RAGEvaluator:
    """Unified RAG evaluation harness.

    Runs all metrics on a single query-answer-context tuple and returns
    a comprehensive evaluation report.
    """

    def __init__(
        self,
        provider_name: Optional[str] = None,
    ):
        self.faithfulness = FaithfulnessEvaluator(provider_name=provider_name)
        self.relevance = RelevanceEvaluator(provider_name=provider_name)
        self.precision_recall = PrecisionRecallEvaluator(provider_name=provider_name)

    def evaluate(
        self,
        query: str,
        answer: str,
        contexts: List[Dict[str, Any]],
        relevant_chunk_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Run the full evaluation suite.

        Args:
            query: The original user query.
            answer: The generated answer.
            contexts: List of context chunks (dicts with at least "content").
            relevant_chunk_ids: Optional ground truth relevant chunk IDs for exact recall.

        Returns:
            Dict with all metrics, overall score, and timing information.
        """
        context_texts = [c.get("content", "") for c in contexts]
        timings = {}

        # 1. Faithfulness
        t0 = time.time()
        faithfulness_result = self.faithfulness.evaluate(query, answer, context_texts)
        timings["faithfulness"] = time.time() - t0

        # 2. Relevance
        t0 = time.time()
        relevance_result = self.relevance.evaluate(query, answer)
        timings["relevance"] = time.time() - t0

        # 3. Context Precision
        t0 = time.time()
        precision_result = self.precision_recall.evaluate_precision(query, contexts)
        timings["precision"] = time.time() - t0

        # 4. Context Recall
        t0 = time.time()
        recall_result = self.precision_recall.evaluate_recall(
            query,
            contexts,
            relevant_chunk_ids=relevant_chunk_ids,
        )
        timings["recall"] = time.time() - t0

        # Calculate overall score (weighted average)
        scores = []
        weights = []

        if faithfulness_result.get("score", 0) > 0 or faithfulness_result.get("total_claims", 0) > 0:
            scores.append(faithfulness_result.get("score", 0.5))
            weights.append(0.35)  # Faithfulness is most important

        if relevance_result.get("score", 0) > 0:
            scores.append(relevance_result.get("score", 0.5))
            weights.append(0.35)  # Relevance is equally important

        if precision_result.get("precision", 0) > 0:
            scores.append(precision_result.get("precision", 0.5))
            weights.append(0.15)

        if recall_result.get("recall", 0) > 0:
            scores.append(recall_result.get("recall", 0.5))
            weights.append(0.15)

        overall = (
            sum(s * w for s, w in zip(scores, weights)) / sum(weights)
            if weights else 0.0
        )

        return {
            "overall_score": overall,
            "metrics": {
                "faithfulness": faithfulness_result,
                "relevance": relevance_result,
                "context_precision": precision_result,
                "context_recall": recall_result,
            },
            "weights": {
                "faithfulness": 0.35,
                "relevance": 0.35,
                "context_precision": 0.15,
                "context_recall": 0.15,
            },
            "timings": timings,
            "total_time": sum(timings.values()),
            "summary": {
                "faithfulness": f"{faithfulness_result.get('score', 0):.2f}",
                "relevance": f"{relevance_result.get('score', 0):.2f}",
                "precision": f"{precision_result.get('precision', 0):.2f}",
                "recall": f"{recall_result.get('recall', 0):.2f}",
                "overall": f"{overall:.2f}",
            },
        }

    def evaluate_batch(
        self,
        examples: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Evaluate multiple examples.

        Each example should have keys: query, answer, contexts.
        Optional key: relevant_chunk_ids.

        Args:
            examples: List of evaluation examples.

        Returns:
            List of evaluation results, one per example.
        """
        results = []
        for example in examples:
            result = self.evaluate(
                query=example["query"],
                answer=example["answer"],
                contexts=example["contexts"],
                relevant_chunk_ids=example.get("relevant_chunk_ids"),
            )
            results.append(result)
        return results

    def summarize_batch(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute summary statistics over a batch of evaluations.

        Args:
            results: List of evaluation result dicts.

        Returns:
            Dict with mean, min, max, std for each metric.
        """
        import numpy as np

        metrics = ["faithfulness", "relevance", "context_precision", "context_recall"]
        score_keys = {
            "faithfulness": "score",
            "relevance": "score",
            "context_precision": "precision",
            "context_recall": "recall",
        }

        summary = {"num_examples": len(results)}
        for metric in metrics:
            scores = []
            for r in results:
                val = r.get("metrics", {}).get(metric, {}).get(score_keys[metric])
                try:
                    scores.append(float(val) if val is not None else 0.0)
                except (TypeError, ValueError):
                    scores.append(0.0)

            if scores:
                summary[f"{metric}_mean"] = float(np.mean(scores))
                summary[f"{metric}_min"] = float(np.min(scores))
                summary[f"{metric}_max"] = float(np.max(scores))
                summary[f"{metric}_std"] = float(np.std(scores))
            else:
                summary[f"{metric}_mean"] = 0.0
                summary[f"{metric}_min"] = 0.0
                summary[f"{metric}_max"] = 0.0
                summary[f"{metric}_std"] = 0.0

        # Overall across all examples
        overalls = [r.get("overall_score", 0.0) for r in results]
        if overalls:
            summary["overall_mean"] = float(np.mean(overalls))
            summary["overall_min"] = float(np.min(overalls))
            summary["overall_max"] = float(np.max(overalls))
            summary["overall_std"] = float(np.std(overalls))

        return summary