"""
RAG Evaluation Harness.

Provides metrics to evaluate the quality of RAG pipeline outputs:
- Faithfulness: Are claims in the answer supported by the retrieved context?
- Answer Relevance: How well does the answer address the query?
- Context Precision: Are all retrieved chunks actually relevant?
- Context Recall: Are all relevant chunks retrieved?

Each metric returns a score between 0.0 and 1.0, along with detailed
breakdowns for debugging and improvement.
"""
from app.evaluation.faithfulness import FaithfulnessEvaluator
from app.evaluation.relevance import RelevanceEvaluator
from app.evaluation.precision_recall import PrecisionRecallEvaluator
from app.evaluation.evaluator import RAGEvaluator

__all__ = [
    "FaithfulnessEvaluator",
    "RelevanceEvaluator",
    "PrecisionRecallEvaluator",
    "RAGEvaluator",
]