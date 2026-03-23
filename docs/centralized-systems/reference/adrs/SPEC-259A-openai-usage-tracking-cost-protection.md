# SPEC-259A: OpenAI Usage Tracking + Daily Cap + Cost Protection

| Field | Value |
|-------|-------|
| **ADR** | ADR-259 (Production Readiness Audit) |
| **Phase** | 1 of 4 |
| **Priority** | CRITICAL — cost runaway prevention before production |
| **Status** | ✅ IMPLEMENTED |
| **Depends On** | — (no dependencies, can start immediately) |

---

## Objective

Capture OpenAI token usage από κάθε API call, υπολογισμός κόστους ανά χρήστη, daily cap 50 messages/day για customers, μείωση maxIterations σε 8 για customer roles, auto-cutoff message. Στόχος: **μηδενικός κίνδυνος cost runaway** σε production.

---

## Current State

### OpenAI API Calls — 2 σημεία στο codebase

**1. Chat Completions (Agentic Loop)**
- **Αρχείο**: `src/services/ai-pipeline/agentic-loop.ts` (lines 401-468)
- **Function**: `callChatCompletions()`
- **API**: raw `fetch()` στο `/chat/completions`
- **Response handling**:
  ```typescript
  const data = await response.json();
  const message = data.choices?.[0]?.message;
  // ❌ data.usage ΑΓΝΟΕΙΤΑΙ — ποτέ δεν αποθηκεύεται
  ```

**2. Responses API (Intent Classification)**
- **Αρχείο**: `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts` (lines 87-115)
- **Response handling**: Μόνο `payload.output_text` — ❌ usage δεν καταγράφεται

### Agentic Loop Config
- **Αρχείο**: `src/services/ai-pipeline/agentic-loop.ts` (lines 107-113)
  ```typescript
  const DEFAULT_CONFIG: AgenticLoopConfig = {
    maxIterations: 15,        // ← ΙΔΙΟ για admin ΚΑΙ customer
    totalTimeoutMs: 55_000,   // production
    perCallTimeoutMs: 30_000,
    maxToolResultChars: 12_000,
  };
  ```

### Rate Limiting
- **Αρχείο**: `src/lib/middleware/rate-limit-config.ts` (line 80)
- TELEGRAM category: 15 requests/minute per user
- ❌ Δεν υπάρχει daily cap
- ❌ Δεν υπάρχει monthly cap

### Firestore AI Collections
- **Αρχείο**: `src/config/firestore-collections.ts` (lines 164-175)
- Υπάρχουν: `ai_pipeline_queue`, `ai_pipeline_audit`, `ai_chat_history`, `ai_agent_feedback`, `ai_learned_patterns`, `ai_query_strategies`
- ❌ **ΔΕΝ υπάρχει**: `ai_usage` collection

### Cost Awareness
- ❌ Κανένα pricing constant στον κώδικα
- ❌ Κανένα token counting
- ❌ Κανένα cost calculation

---

## Target State

- ✅ Κάθε OpenAI response → capture `usage.prompt_tokens`, `usage.completion_tokens`
- ✅ Κάθε agentic loop execution → aggregate total tokens across iterations
- ✅ Firestore `ai_usage/{channel}_{userId}_{YYYY-MM}` → daily counters
- ✅ Cost calculation: `(prompt × $0.15/1M) + (completion × $0.60/1M)`
- ✅ Daily cap: 50 messages/day per customer (admin: unlimited)
- ✅ maxIterations: 8 για customers, 15 για admin
- ✅ Auto-cutoff: "Ξεπεράσατε το ημερήσιο όριο μηνυμάτων σας" (Ελληνικά)
- ✅ Pipeline audit log includes token usage per execution

---

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | Capture `data.usage` από response, aggregate across iterations, return in result |
| `src/services/ai-pipeline/pipeline-orchestrator.ts` | MODIFY | Daily cap check πριν `executeAgenticPath()`, pass isAdmin to loop config |
| `src/config/firestore-collections.ts` | MODIFY | Προσθήκη `AI_USAGE: 'ai_usage'` |
| `src/config/ai-analysis-config.ts` | MODIFY | Προσθήκη pricing constants |
| `src/services/ai-pipeline/ai-usage.service.ts` | CREATE | Usage tracking service (record, check daily cap, get monthly stats) |
| `src/services/enterprise-id.service.ts` | MODIFY | Προσθήκη `generateAiUsageId()` generator |

---

## Implementation Steps

### Step 1: Pricing Constants

Στο `src/config/ai-analysis-config.ts`, προσθήκη:

```typescript
PRICING: {
  'gpt-4o-mini': {
    inputPer1MTokens: 0.15,   // $0.15 per 1M input tokens
    outputPer1MTokens: 0.60,  // $0.60 per 1M output tokens
  },
  'gpt-4o': {
    inputPer1MTokens: 2.50,
    outputPer1MTokens: 10.00,
  },
},
LIMITS: {
  CUSTOMER_MAX_ITERATIONS: 8,
  ADMIN_MAX_ITERATIONS: 15,
  CUSTOMER_DAILY_MESSAGE_CAP: 50,
},
```

### Step 2: Capture Usage in Agentic Loop

Στο `agentic-loop.ts`, function `callChatCompletions()`:

```typescript
// BEFORE (line ~445):
const message = data.choices?.[0]?.message;
return { message, finishReason };

// AFTER:
const message = data.choices?.[0]?.message;
const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
return { message, finishReason, usage };
```

Στο loop body, aggregate:
```typescript
let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

// Per iteration:
totalUsage.prompt_tokens += result.usage.prompt_tokens;
totalUsage.completion_tokens += result.usage.completion_tokens;
totalUsage.total_tokens += result.usage.total_tokens;

// Return in AgenticLoopResult:
return { answer, iterations, totalUsage };
```

### Step 3: Role-Aware maxIterations

Στο `agentic-loop.ts`, δέχεται `isAdmin` parameter:

```typescript
export async function executeAgenticLoop(
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>,
): Promise<AgenticLoopResult> {
  const effectiveConfig = {
    ...DEFAULT_CONFIG,
    maxIterations: context.isAdmin
      ? AI_ANALYSIS_DEFAULTS.LIMITS.ADMIN_MAX_ITERATIONS    // 15
      : AI_ANALYSIS_DEFAULTS.LIMITS.CUSTOMER_MAX_ITERATIONS, // 8
    ...config,
  };
  // ...
}
```

### Step 4: AI Usage Service

Νέο αρχείο `src/services/ai-pipeline/ai-usage.service.ts`:

```typescript
// Firestore document structure:
// ai_usage/{channel}_{userId}_{YYYY-MM}
// {
//   userId: string,
//   channel: 'telegram' | 'email' | 'web',
//   month: '2026-03',
//   dailyCounts: { '2026-03-23': 5, '2026-03-24': 12 },  // messages per day
//   dailyTokens: { '2026-03-23': { prompt: 3000, completion: 800 } },
//   totalTokens: { prompt: 45000, completion: 12000 },
//   estimatedCostUsd: 0.0135,
//   updatedAt: Timestamp,
// }

// Functions:
// - recordUsage(userId, channel, tokens) → increment daily counters
// - checkDailyCap(userId, channel) → { allowed: boolean, used: number, limit: number }
// - getMonthlyUsage(userId, channel) → usage summary
```

### Step 5: Daily Cap Check in Pipeline

Στο `pipeline-orchestrator.ts`, πριν `executeAgenticPath()`:

```typescript
// Check daily cap (customers only)
if (!context.isAdmin) {
  const capCheck = await checkDailyCap(userId, channel);
  if (!capCheck.allowed) {
    // Return cutoff message instead of executing pipeline
    return {
      success: true,
      response: `Ξεπεράσατε το ημερήσιο όριο μηνυμάτων (${capCheck.limit}). Δοκιμάστε ξανά αύριο.`,
      skipped: true,
      reason: 'daily_cap_exceeded',
    };
  }
}
```

### Step 6: Record Usage After Execution

Στο `pipeline-orchestrator.ts`, μετά `executeAgenticPath()`:

```typescript
// Record usage
if (result.totalUsage) {
  await recordUsage(userId, channel, result.totalUsage);
}
```

### Step 7: Enterprise ID Generator

Στο `enterprise-id.service.ts`:

```typescript
export function generateAiUsageId(
  channel: string,
  userId: string,
  month: string, // YYYY-MM
): string {
  return `aiu_${channel}_${userId}_${month}`;
}
```

### Step 8: Firestore Collection Registration

Στο `firestore-collections.ts`:

```typescript
AI_USAGE: 'ai_usage',  // ADR-259A: Per-user AI cost tracking
```

---

## Cost Projection Table

| Users | Msgs/day/user | Daily Cost | Monthly Cost |
|-------|--------------|------------|--------------|
| 10 | 5 (τυπικό) | $0.10 | $3 |
| 10 | 50 (max cap) | $4.50 | $135 |
| 50 | 5 (τυπικό) | $0.50 | $15 |
| 50 | 50 (max cap) | $22.50 | $675 |
| 100 | 5 (τυπικό) | $1.00 | $30 |

**Worst case με cap**: 100 users × 50 msg/day × $0.009 = $45/day = $1,350/month

---

## Verification

1. **Unit test**: Mock OpenAI response → verify usage captured
2. **Integration test**: Send message ως customer → verify `ai_usage` document created in Firestore
3. **Cap test**: Send 51 messages ως customer → verify 51st returns cutoff message
4. **Admin test**: Send >50 messages ως admin → verify NO cutoff
5. **Iteration test**: Customer agentic loop → verify max 8 iterations
6. **Cost test**: Verify cost calculation: 2000 prompt + 500 completion → $0.0006

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | SPEC created — pending implementation |
| 2026-03-23 | ✅ IMPLEMENTED — 7 files modified/created: ai-analysis-config.ts (pricing constants + AiModelId type), agentic-loop.ts (OpenAIUsage interface, capture data.usage, aggregate across iterations, role-aware maxIterations 8/15), firestore-collections.ts (AI_USAGE collection), enterprise-id.service.ts (AI_USAGE prefix + generateAiUsageDocId deterministic key), ai-usage.service.ts (NEW — recordUsage atomic FieldValue.increment, checkDailyCap fail-open, calculateCost, getMonthlyUsage), pipeline-orchestrator.ts (daily cap check before loop, record usage after loop), index.ts (barrel exports) |
