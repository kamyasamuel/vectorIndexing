"""Agentic Q&A engine that performs multi-turn retrieval and synthesis.

The AgenticQATuner uses an LLM (DeepSeek) to:
1. Critically assess whether retrieved context is sufficient to answer the user's question
2. Generate refined search queries when information is missing
3. Track already-retrieved content to avoid duplication
4. Iterate until confidence threshold is met or max iterations reached
5. Maintain conversation history with automatic context compression
"""
from typing import List, Dict, Any, Optional
import json
import re
import math

from app.ai.deepseek_client import DeepSeekClient
from app.storage.vector_store import VectorStore
from app.storage.metadata_store import MetadataStore


# Approximate token count: 1 token ≈ 4 characters for English text
TOKEN_ESTIMATE_RATIO = 4

# Max total tokens before we trigger compression
MAX_PROMPT_TOKENS = 25_000

# Number of recent conversation turns to always keep verbatim
KEEP_RECENT_TURNS = 2

# System prompt that instructs the LLM how to behave in the agentic loop
AGENT_SYSTEM_PROMPT = """You are an expert research assistant tasked with answering questions based on retrieved document chunks. You operate in an iterative, agentic loop.

YOUR ROLE:
- You will receive a user question and a set of retrieved document chunks (context).
- You must CRITICALLY ASSESS whether the provided context is sufficient to fully answer the question.
- If the context is sufficient, provide a thorough answer and set confidence to a high value (0.85-1.0).
- If the context is INSUFFICIENT, identify specifically what information is missing and generate a SINGLE refined search query (as a short phrase, 5-12 words) that would find the missing information.

RESPONSE FORMAT — You MUST respond in valid JSON with exactly these keys:
{
  "answer": "Your synthesized answer based on what you know so far. Be honest about gaps.",
  "sufficient": true or false,
  "confidence": 0.0-1.0,
  "missing_info": "What specific information is still needed (empty string if sufficient)",
  "refined_query": "A focused search query to find missing info (empty string if sufficient)"
}

GUIDELINES:
- Be honest. If you don't have enough context, say so and generate a good search query.
- The refined_query should be a targeted, concise search phrase — not a full question.
- Confidence should reflect how well the context answers ALL aspects of the user's question.
- If you have partial information, include what you know in "answer" and still flag what's missing.
- Do NOT fabricate information not present in the provided context.
- When confidence >= 0.85, set sufficient to true.
- Pay attention to the conversation history — you may already have covered relevant ground.
"""


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: 1 token ≈ 4 characters."""
    return math.ceil(len(text) / TOKEN_ESTIMATE_RATIO)


class AgenticQATuner:
    """Multi-turn agentic Q&A engine that iteratively retrieves and synthesizes."""

    def __init__(self):
        self.vector_store = VectorStore()
        self.metadata_store = MetadataStore()
        self.deepseek = DeepSeekClient()
        self.confidence_threshold = 0.85

    def agentic_answer(
        self,
        query: str,
        max_iterations: int = 3,
        top_k_per_round: int = 5,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Run the agentic multi-turn Q&A loop.

        Args:
            query: The user's question.
            max_iterations: Maximum number of retrieval+critique rounds.
            top_k_per_round: Number of top chunks to retrieve per round.
            history: List of previous conversation turns, each with
                     {"role": "user"|"assistant", "content": "..."}

        Returns:
            Dict with keys: answer, sources, iterations, confidence, total_iterations,
                            compressed_history
        """
        accumulated_sources: Dict[str, Dict[str, Any]] = {}  # dedup by chunk ID
        all_iterations: List[Dict[str, Any]] = []
        current_query = query
        final_answer = ""
        final_confidence = 0.0

        # --- Compress history if needed ---
        processed_history = self._compress_history(history or [])

        for iteration in range(1, max_iterations + 1):
            # 1. Retrieve relevant chunks for the current query
            chunks = self.vector_store.similarity_search(current_query, top_k=top_k_per_round)

            # 2. Deduplicate against already-seen chunks
            new_chunks = []
            for chunk in chunks:
                chunk_id = chunk.get("id", "")
                if chunk_id not in accumulated_sources:
                    accumulated_sources[chunk_id] = chunk
                    new_chunks.append(chunk)

            # 3. If no new chunks found and we already have some, try to break early
            if not new_chunks and accumulated_sources:
                all_context = self._format_context(list(accumulated_sources.values()))
                final_prompt = self._build_final_prompt(
                    query=query,
                    context=all_context,
                    history=processed_history,
                )
                final_answer = self.deepseek.get_completion(final_prompt, temperature=0.3)
                final_confidence = 0.5
                break

            # 4. Format context from all chunks (new + accumulated)
            all_sources = list(accumulated_sources.values())
            context_text = self._format_context(all_sources)

            # 5. Build the critique prompt with history
            user_prompt = self._build_critique_prompt(
                original_query=query,
                current_query=current_query,
                context=context_text,
                iteration=iteration,
                max_iterations=max_iterations,
                history=processed_history,
            )

            # 6. Get LLM critique
            response_text = self.deepseek.get_completion(
                user_prompt,
                system_prompt=AGENT_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=1500,
            )

            # 7. Parse the JSON response
            critique = self._parse_critique(response_text)

            # Record sources relevant to this iteration
            iteration_sources = new_chunks if new_chunks else (all_sources if not accumulated_sources else [])
            all_iterations.append({
                "query": current_query,
                "sources": self._format_sources(iteration_sources),
                "new_sources_count": len(new_chunks),
                "total_sources": len(accumulated_sources),
                "confidence": critique.get("confidence", 0.0),
            })

            # 8. Check if we're done
            if critique.get("sufficient", False) or critique.get("confidence", 0) >= self.confidence_threshold:
                final_answer = critique.get("answer", "")
                final_confidence = critique.get("confidence", 0.85)
                break

            # 9. Use the refined query for the next round
            refined = critique.get("refined_query", "").strip()
            if refined and refined.lower() != current_query.lower():
                current_query = refined
            else:
                current_query = self._fallback_refined_query(query, iteration)

            # 10. If this was the last iteration, synthesize final answer with all context
            if iteration == max_iterations:
                all_context = self._format_context(list(accumulated_sources.values()))
                final_prompt = self._build_final_prompt(
                    query=query,
                    context=all_context,
                    history=processed_history,
                )
                final_answer = self.deepseek.get_completion(final_prompt, temperature=0.3)
                final_confidence = critique.get("confidence", 0.3)

        # Safety check: if we never set a final answer
        if not final_answer:
            all_context = self._format_context(list(accumulated_sources.values()))
            final_prompt = self._build_final_prompt(
                query=query,
                context=all_context,
                history=processed_history,
            )
            final_answer = self.deepseek.get_completion(final_prompt, temperature=0.3)
            final_confidence = 0.3

        return {
            "answer": final_answer,
            "sources": self._format_sources(list(accumulated_sources.values())),
            "iterations": all_iterations,
            "confidence": round(final_confidence, 2),
            "total_iterations": len(all_iterations),
            "compressed_history": processed_history,
        }

    # ──────────────────────────────────────────────
    #  History Management & Context Compression
    # ──────────────────────────────────────────────

    def _format_history_text(self, history: List[Dict[str, str]]) -> str:
        """Format conversation history into a readable string."""
        if not history:
            return ""

        parts = ["## Conversation History (previous turns)"]
        for turn in history:
            role = turn.get("role", "unknown")
            content = turn.get("content", "")
            if role == "user":
                parts.append(f"User asked: {content}")
            elif role == "assistant":
                parts.append(f"Assistant answered: {content[:300]}{'...' if len(content) > 300 else ''}")
        return "\n\n".join(parts)

    def _compress_history(self, history: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Compress conversation history if it would exceed the token budget.

        Strategy:
        1. Estimate total tokens for system_prompt + history + context
        2. If history alone is close to the budget, compress older turns
        3. Always keep the most recent KEEP_RECENT_TURNS turns verbatim
        4. Summarize everything older into a condensed paragraph
        """
        if not history or len(history) <= KEEP_RECENT_TURNS * 2:
            return history

        # Estimate history token count
        history_text = self._format_history_text(history)
        history_tokens = _estimate_tokens(history_text)
        system_tokens = _estimate_tokens(AGENT_SYSTEM_PROMPT)
        # Reserve ~2000 tokens for context and prompts
        overhead_tokens = 2000

        total_estimated = system_tokens + history_tokens + overhead_tokens

        if total_estimated <= MAX_PROMPT_TOKENS:
            return history  # No compression needed

        # Need to compress: keep recent turns, summarize the rest
        recent_turns = history[-KEEP_RECENT_TURNS * 2:]  # keep N user+assistant pairs
        older_turns = history[:-KEEP_RECENT_TURNS * 2]

        # Build a summary prompt for the older turns
        older_text = self._format_history_text(older_turns)
        summary_prompt = (
            "Summarize the following conversation history concisely, "
            "preserving key facts, questions asked, and answers given. "
            "Focus on information that would be relevant for continuing the conversation.\n\n"
            f"{older_text}"
        )

        try:
            summary = self.deepseek.get_completion(summary_prompt, temperature=0.3, max_tokens=500)
        except Exception:
            # Fallback: just take the last few turns' queries
            summary = "Previous context: " + "; ".join(
                t.get("content", "")[:80]
                for t in older_turns
                if t.get("role") == "user"
            )[:500]

        # Build compressed history: summary as a "system" entry + recent verbatim turns
        compressed: List[Dict[str, str]] = [
            {"role": "system", "content": f"Summary of earlier conversation: {summary}"}
        ]
        compressed.extend(recent_turns)

        return compressed

    # ──────────────────────────────────────────────
    #  Prompt Building
    # ──────────────────────────────────────────────

    def _build_critique_prompt(
        self,
        original_query: str,
        current_query: str,
        context: str,
        iteration: int,
        max_iterations: int,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Build the prompt for the critique step, including history."""
        parts = []

        # Add conversation history if available
        history_text = self._format_history_text(history or [])
        if history_text:
            parts.append(history_text)
            parts.append("---")

        parts.append(f"Original Question: {original_query}")
        parts.append(f"Current Search Query (Round {iteration}/{max_iterations}): {current_query}")
        parts.append("")
        parts.append("Retrieved Context:")
        parts.append(context)
        parts.append("")
        parts.append("Instructions:")
        parts.append("1. Analyze whether the retrieved context is SUFFICIENT to fully answer the original question.")
        parts.append("2. If sufficient, provide a complete answer and set 'sufficient' to true.")
        parts.append("3. If insufficient, identify EXACTLY what information is missing and generate a refined search query (5-12 words) that would find it.")
        parts.append("4. Rate your confidence from 0.0 (no relevant info) to 1.0 (completely answered).")
        parts.append("")
        parts.append("Respond in JSON format as specified.")

        return "\n".join(parts)

    def _build_final_prompt(
        self,
        query: str,
        context: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Build the final synthesis prompt, including history."""
        parts = []

        history_text = self._format_history_text(history or [])
        if history_text:
            parts.append(history_text)
            parts.append("---")

        parts.append("Based on the following context, provide a complete answer to the user's question.")
        parts.append("")
        parts.append("Context:")
        parts.append(context)
        parts.append("")
        parts.append(f"Question: {query}")
        parts.append("")
        parts.append("Answer thoroughly using ONLY the provided context. If the context is insufficient, clearly state what is missing.")

        return "\n".join(parts)

    # ──────────────────────────────────────────────
    #  Formatting Helpers
    # ──────────────────────────────────────────────

    def _format_context(self, sources: List[Dict[str, Any]]) -> str:
        """Format a list of source chunks into a single context string."""
        parts = []
        seen_content = set()
        for i, src in enumerate(sources, 1):
            content = src.get("content", "").strip()
            if content and content not in seen_content:
                seen_content.add(content)
                # Try top-level filename, then metadata filename, then fallback
                metadata = src.get("metadata", {})
                if isinstance(metadata, dict):
                    filename = metadata.get("filename", src.get("filename", "Unknown"))
                else:
                    filename = src.get("filename", "Unknown")
                parts.append(f"[Source {i} — {filename}]\n{content}")
        return "\n\n".join(parts)

    def _format_sources(self, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format sources for the API response, enriching with metadata."""
        formatted = []
        seen = set()
        for src in sources:
            chunk_id = src.get("id", "")
            if chunk_id in seen:
                continue
            seen.add(chunk_id)

            metadata = src.get("metadata", {})
            filename = metadata.get("filename", src.get("filename", "Unknown"))
            doc_id = src.get("document_id", "")

            doc = None
            if doc_id:
                try:
                    doc = self.metadata_store.get_document(doc_id)
                except Exception:
                    pass

            if doc:
                doc_metadata = doc.get("metadata", {})
                if isinstance(doc_metadata, dict):
                    filename = doc_metadata.get("filename", filename)

            formatted.append({
                "id": chunk_id,
                "document_id": doc_id,
                "content": src.get("content", ""),
                "filename": filename,
                "source": metadata.get("source", src.get("source", "")),
                "similarity": src.get("similarity", 0.0),
                "metadata": {
                    "filename": filename,
                    "source": metadata.get("source", src.get("source", "")),
                },
            })
        return formatted

    def _parse_critique(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM's JSON response, with robust error handling."""
        json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', response_text)
        if json_match:
            try:
                result = json.loads(json_match.group(0))
                return {
                    "answer": result.get("answer", ""),
                    "sufficient": result.get("sufficient", False),
                    "confidence": float(result.get("confidence", 0.0)),
                    "missing_info": result.get("missing_info", ""),
                    "refined_query": result.get("refined_query", ""),
                }
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        # Fallback: try to extract JSON from markdown code blocks
        code_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response_text)
        if code_match:
            try:
                result = json.loads(code_match.group(1))
                return {
                    "answer": result.get("answer", ""),
                    "sufficient": result.get("sufficient", False),
                    "confidence": float(result.get("confidence", 0.0)),
                    "missing_info": result.get("missing_info", ""),
                    "refined_query": result.get("refined_query", ""),
                }
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        return {
            "answer": response_text,
            "sufficient": False,
            "confidence": 0.3,
            "missing_info": "Could not parse LLM response",
            "refined_query": "",
        }

    def _fallback_refined_query(self, original_query: str, iteration: int) -> str:
        """Generate a fallback refined query when the LLM doesn't produce one."""
        diversification_terms = [
            "details explanation overview",
            "specifics examples context",
            "additional information related aspects",
            "further details broader context",
        ]
        idx = min(iteration - 1, len(diversification_terms) - 1)
        return f"{original_query} {diversification_terms[idx]}"