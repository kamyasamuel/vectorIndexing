# Vector DB Agentic Q&A Skill

## When to Use
Use this skill when the user asks a question that requires searching indexed documents. This is an **agentic** Q&A system that can perform multi-turn retrieval to gather comprehensive information.

## Endpoint
```
POST /api/agentic-answer
Content-Type: application/json

{
  "query": "string (required) - The user's question",
  "max_iterations": 3 (optional, default 3)
}
```

**Response:**
```json
{
  "answer": "string - The synthesized final answer",
  "sources": [
    {
      "id": "string - chunk ID",
      "document_id": "string",
      "content": "string - chunk text",
      "filename": "string",
      "source": "string - file path",
      "similarity": 0.95,
      "metadata": {}
    }
  ],
  "iterations": [
    {
      "query": "string - the sub-query used in this round",
      "sources": [...],
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0,
  "total_iterations": 3
}
```

## Agent Protocol

Follow this multi-turn process:

### Step 1: Initial Query
Send the user's question to `/api/agentic-answer` with `max_iterations: 3`.

### Step 2: Examine the Response
- Check `confidence` — values above 0.85 mean the system is highly confident
- Check `sources` — ensure the sources actually contain the information the user asked for
- Check `iterations` — each round shows what the system searched for

### Step 3: Decide If Follow-Up Is Needed
If the answer is incomplete or the user asks for something more specific:

1. **Formulate a targeted sub-query** based on what's still missing
2. **Call `/api/agentic-answer` again** with the refined query
3. **Synthesize** the new answer with previously gathered context

### Step 4: Chain Multiple Rounds (if needed)
Repeat Step 3 until the user is satisfied. Each call can build on the previous one.

## Example Flow

**User:** "What are the privacy implications of GDPR Article 17?"

```
→ POST /api/agentic-answer { "query": "GDPR Article 17 privacy implications", "max_iterations": 3 }
→ Response: answer about right to erasure, confidence: 0.72
→ User asks: "What about the exceptions?"
→ POST /api/agentic-answer { "query": "GDPR Article 17 exceptions limitations", "max_iterations": 3 }
→ Combine both answers for the user
```

## Important Notes
- The backend uses **DeepSeek** for LLM reasoning in the agentic loop
- The system can automatically refine its own search up to 3 times per call
- Each iteration generates a more specific query based on what's still missing
- Sources are deduplicated across iterations