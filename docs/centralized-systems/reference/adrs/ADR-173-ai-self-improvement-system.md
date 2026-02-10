# ADR-173: Enterprise AI Self-Improvement System

**Status**: ACTIVE
**Date**: 2026-02-10
**Category**: Backend Systems
**Depends on**: ADR-171 (Autonomous AI Agent), ADR-080 (AI Pipeline)

---

## Problem

The AI agent (ADR-171) provides responses to users via Telegram and Email, but has no mechanism to learn from real-world usage. Without feedback loops, the AI cannot:
- Improve response quality over time
- Detect and avoid recurring failure patterns
- Adapt to domain-specific vocabulary and user preferences

## Decision

Implement a **feedback-driven self-improvement system** with 5 enterprise-grade components:

1. **Feedback Collection** - Thumbs up/down + negative category follow-up
2. **Pattern Learning** - Extract success/failure patterns from rated feedback
3. **Prompt Enhancement** - Inject learned patterns into AI system prompt
4. **Tool Analytics** - Track tool execution success/failure rates
5. **Greek NLP** - Domain-specific keyword extraction with stemming

### Security Model (OWASP LLM Top 10)

- **Prompt Injection Protection** (LLM01:2025): All user-generated text is sanitized before storage and prompt injection via `sanitizeForPromptInjection()`
- **Data Poisoning Prevention** (LLM03:2025): Patterns require minimum 3 ratings before being used in prompts (`MIN_RATINGS_THRESHOLD = 3`)
- **Injection Detection**: `containsPromptInjection()` detects and logs suspicious patterns

## Architecture

```
User Message
    |
    v
[Agentic Loop] --> [Prompt Enhancer] --> Fetches learned patterns
    |                                        |
    v                                        v
[AI Response + [SUGGESTIONS]] --------> [Pattern DB]
    |                                        ^
    v                                        |
[1. Clean Answer]                      [Learning Cron]
[2. Suggested Actions Keyboard]             |
[3. Feedback Keyboard (👍/👎)]              v
    |              |               [Extract Patterns]
    v              v
[User sees]  [Click suggestion]
             → re-feed as new message
             → pipeline processes with chat history
              [Firestore]
              ai_agent_feedback
```

## Firestore Schema

### Collection: `ai_agent_feedback`
```typescript
{
  requestId: string;
  channelSenderId: string;
  rating: 'positive' | 'negative' | null;
  negativeCategory: 'wrong_answer' | 'wrong_data' | 'not_understood' | 'slow' | null;
  userQuery: string;        // Sanitized (OWASP LLM01)
  aiAnswer: string;         // Sanitized
  toolChain: string[];
  toolChainDetail: ToolChainDetailEntry[];
  iterations: number;
  durationMs: number;
  channel: string;          // 'telegram' | 'email'
  tokenEstimate: number;    // Rough token count
  processedForLearning: boolean;
  createdAt: string;        // ISO 8601
}
```

### Collection: `ai_learned_patterns`
```typescript
{
  patternType: 'success' | 'failure';
  keywords: string[];       // Stemmed Greek keywords
  queryTemplate: string;
  toolChain: string[];
  toolChainDetail: ToolChainDetailEntry[];
  exampleQuery: string;
  exampleAnswer: string;
  successCount: number;
  failureCount: number;
  score: number;            // 0-1, successCount/total
  lastUsedAt: string;
  lastFeedbackAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### Document: `settings/ai_tool_analytics`
```typescript
{
  tools: Record<string, {
    totalCalls: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    commonErrors: Record<string, number>;
    lastUpdated: string;
  }>;
  lastUpdated: string;
}
```

## Components

| File | Purpose |
|------|---------|
| `feedback-service.ts` | Feedback snapshot CRUD + rating/category updates |
| `feedback-keyboard.ts` | Telegram inline keyboards (rating + category) |
| `learning-service.ts` | Pattern extraction, matching, cleanup |
| `tool-analytics-service.ts` | Tool execution tracking |
| `prompt-enhancer.ts` | Dynamic prompt injection with sanitized patterns |
| `shared/greek-nlp.ts` | Keyword extraction, stemming, Greeklish, domain boosting |
| `shared/prompt-sanitizer.ts` | OWASP LLM01 prompt injection sanitization |
| `cron/ai-learning/route.ts` | Daily cron for pattern extraction + cleanup |
| `api/admin/ai-analytics/route.ts` | Analytics dashboard endpoint |

## Greek NLP Features

- **Stopword Removal**: 50+ Greek stopwords
- **Suffix Stemming**: 20 common Greek suffixes (applied to words > 4 chars)
- **Domain Vocabulary**: 30+ real estate/construction/business terms with 2x boost
- **Greeklish Transliteration**: Automatic conversion when no Greek chars detected
- **Digraph Support**: th/ph/ch/ps/ks/ou/ei/oi/ai/mp/nt/gk

## Negative Feedback Categories

When user clicks thumbs down, a follow-up keyboard appears:

| Button | Code | Category |
|--------|------|----------|
| Λάθος απάντηση | `w` | `wrong_answer` |
| Λάθος δεδομένα | `d` | `wrong_data` |
| Δεν κατάλαβε | `u` | `not_understood` |
| Αργό | `s` | `slow` |

Callback data format: `fb:c:{docId}:{code}` (fits 64-byte Telegram limit)

## API Endpoints

### GET `/api/admin/ai-analytics`
Returns aggregated analytics:
- Total feedback (positive/negative/unrated)
- Satisfaction ratio
- Top 5 patterns by score
- Tool failure rates
- P50 response latency
- Patterns learned this week
- Channel breakdown
- Negative category breakdown

### GET `/api/cron/ai-learning`
Daily cron job:
- Extract patterns from unprocessed feedback
- Cleanup stale feedback (48h without rating)
- Cleanup low-quality patterns (score < 0.3, age > 7 days)
- Recompute tool analytics rates

## Changelog

| Date | Change |
|------|--------|
| 2026-02-10 | Phase 1: Initial implementation — 6 service files, pipeline integration |
| 2026-02-10 | Phase 1A: Prompt injection sanitization (OWASP LLM01:2025) |
| 2026-02-10 | Phase 1B: Minimum rating threshold (data poisoning prevention) |
| 2026-02-10 | Phase 2: Negative feedback categories (ChatGPT/Intercom pattern) |
| 2026-02-10 | Phase 3: Greek NLP — stemming, domain boosting, Greeklish |
| 2026-02-10 | Phase 4: Enhanced analytics — channel/token tracking, admin endpoint |
| 2026-02-10 | Phase 5: ADR document, Firestore indexes |
| 2026-02-10 | Phase 6: Context-aware suggested action buttons — replaces generic "Ενημέρωσέ με" with 2-3 actionable follow-up buttons per AI response |
