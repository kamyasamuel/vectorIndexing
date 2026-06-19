"""
Query rewriting module for the advanced RAG pipeline.

An LLM rewrites the user's query to:
- Resolve ambiguous pronouns ("it", "the report") to specific nouns
- Add relevant context from conversation history
- Expand abbreviations and acronyms
- Improve specificity for better vector search results

Example:
  Input: "How does it compare to the previous version?"
  Output: "How does the Companies Regulation 2023 compare to the previous version?"
"""

from typing import Optional, List, Dict, Any

from app.ai.providers import get_provider


REWRITE_SYSTEM_PROMPT = """You are a query rewriting assistant for a document retrieval system.
Your task is to rewrite the user's query to make it more specific and searchable.

Rules:
1. Resolve ambiguous pronouns ("it", "they", "this", "that") to specific nouns
2. Expand abbreviations and acronyms where appropriate
3. Add missing context from the conversation history
4. Keep the rewritten query concise (1-3 sentences)
5. Do NOT add information not implied by the original query
6. If the query is already specific and clear, return it unchanged
7. Output ONLY the rewritten query, nothing else

Examples:
Original: "How does it compare to the previous version?"
Context: "We were discussing the Companies Regulation 2023"
Rewritten: "How does the Companies Regulation 2023 compare to the previous version?"

Original: "What are the key requirements?"
Context: "We are looking at data protection rules"
Rewritten: "What are the key requirements of the data protection rules?""""


class QueryRewriter:
    """Rewrites user queries to improve retrieval quality.
    
    Uses an LLM to add context, resolve ambiguity, and improve specificity.
    Falls back to the original query if rewriting fails.
    """
    
    def __init__(self, provider_name: Optional[str] = None):
        self.provider_name = provider_name
    
    def rewrite(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Rewrite a query to improve retrieval quality.
        
        Args:
            query: The original user query.
            history: Optional conversation history for context.
                Each entry: {"role": "user"|"assistant", "content": "..."}
                
        Returns:
            The rewritten query, or the original if rewriting fails.
        """
        # Skip rewriting for short queries (likely search terms, not questions)
        if len(query.split()) <= 2:
            return query
        
        try:
            provider = get_provider(self.provider_name)
            
            # Build context from history
            context = ""
            if history and len(history) >= 2:
                # Take the last 2-3 exchanges for context
                recent = history[-4:] if len(history) >= 4 else history
                context_lines = []
                for turn in recent:
                    role = turn.get("role", "user")
                    content = turn.get("content", "")
                    if len(content) > 200:
                        content = content[:200] + "..."
                    context_lines.append(f"{role.capitalize()}: {content}")
                context = "\n".join(context_lines)
            
            # Build the prompt
            if context:
                prompt = f"""Conversation history:
{context}

Original query: {query}

Rewritten query:"""
            else:
                prompt = f"""Original query: {query}

Rewritten query:"""
            
            rewritten = provider.generate(
                prompt,
                system_prompt=REWRITE_SYSTEM_PROMPT,
                temperature=0.1,  # Low temperature for deterministic output
                max_tokens=150,
            )
            
            # Clean up the response
            rewritten = rewritten.strip().strip('"').strip("'")
            
            # If the rewrite is empty or too long, use original
            if not rewritten or len(rewritten) > 500:
                return query
            
            return rewritten
            
        except Exception as e:
            print(f"Query rewriting failed (using original): {e}")
            return query