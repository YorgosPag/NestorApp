# Strategy Document: AI Layer Architecture

**Document ID**: STRATEGY-003
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document defines the strategy for expanding AI capabilities in the Nestor Construct Platform. The platform currently has **basic AI** using Genkit + Gemini 2.0 Flash but lacks **RAG**, **guardrails**, and **RBAC-scoped AI access**.

### Decision

> **Option A+B: Expand Genkit + Add RAG** with pgvector for vector storage.

### Key Benefits

- **Preserve Investment** - Keep existing Genkit integration
- **Knowledge Retrieval** - RAG enables context-aware responses
- **Security by Design** - RBAC-scoped AI, no raw DB access
- **Cost Control** - Rate limiting per user/company

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**File**: `src/ai/genkit.ts`

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
```

### 2.2 Current Capabilities

| Capability | Status | Details |
|------------|--------|---------|
| **Genkit Integration** | Yes | googleAI plugin configured |
| **Gemini 2.0 Flash** | Yes | Default model |
| **Report Generation** | Yes | Basic flow exists |
| **Contact Follow-ups** | Yes | Suggestion flow exists |
| **RAG** | **NO** | No vector DB, no embeddings |
| **Guardrails** | **NO** | No prompt injection protection |
| **RBAC** | **NO** | No permission-scoped AI |

### 2.3 Critical Gaps

| Gap | Risk | Impact |
|-----|------|--------|
| **No RAG** | AI lacks company context | Generic answers |
| **No Guardrails** | Prompt injection | Security vulnerability |
| **No RBAC** | Data leakage | Cross-company exposure |
| **No Rate Limiting** | Cost explosion | Unbounded API costs |

---

## 3. Options Analysis

### Option A: Expand Genkit Only

**Verdict**: **INSUFFICIENT** - Doesn't address core gaps

### Option B: Add RAG with Vector DB (RECOMMENDED)

**Pros**:
- AI becomes context-aware
- Preserves Genkit investment
- Industry-standard pattern

**Verdict**: **RECOMMENDED** - Best balance of effort/value

### Option C: Self-Hosted LLM (Llama)

**Cons**:
- Significant infrastructure
- Lower quality than Gemini
- GPU requirements

**Verdict**: **NOT RECOMMENDED** - Overkill for current needs

---

## 4. Decision

### 4.1 Final Decision: **Genkit + RAG with pgvector**

### 4.2 Vector DB Choice

| Option | Pros | Decision |
|--------|------|----------|
| **pgvector** | OSS, Supabase-ready, SQL familiar | **SELECTED** |
| **Pinecone** | Managed, fast | Rejected (SaaS costs) |
| **Weaviate** | Feature-rich | Rejected (complexity) |

---

## 5. Implementation Architecture

### 5.1 RAG Architecture

```
User Query: "What are pending tasks for Project Alpha?"
    │
    ▼
Query Processing
    ├── 1. RBAC Check (companyId verified)
    └── 2. Query Embedding (text-embedding-3-small)
    │
    ▼
Vector Retrieval (pgvector)
    SELECT * FROM documents
    WHERE company_id = :companyId  -- RBAC filter
    ORDER BY embedding <-> :queryVector
    LIMIT 5
    │
    ▼
LLM Generation (Gemini 2.0 Flash)
    ├── Prompt with retrieved context
    └── Post-processing (citations, PII removal)
    │
    ▼
Audit & Response
```

### 5.2 Data Indexing Pipeline

```
Data Sources (Projects, Tasks, Contacts, Documents)
    │
    ▼
Chunking Strategy
    ├── Each project = 1 chunk
    ├── Each task = 1 chunk
    └── Documents = 500 token chunks
    │
    ▼
Embedding (OpenAI text-embedding-3-small)
    │
    ▼
pgvector Storage
    CREATE TABLE documents (
      id UUID PRIMARY KEY,
      company_id TEXT NOT NULL,    -- RBAC
      entity_type TEXT,
      entity_id TEXT,
      content TEXT,
      embedding vector(1536),
      metadata JSONB
    );
```

### 5.3 API Contract

```yaml
# POST /api/v1/ai/query
Request:
  Headers:
    Authorization: Bearer <token>
  Body:
    query: string
    context:
      projectId?: string
      entityTypes?: string[]
    options:
      maxTokens?: number
      stream?: boolean

Response:
  Body:
    response: string
    sources: Source[]
    usage:
      promptTokens: number
      completionTokens: number
      cost: number
```

---

## 6. RBAC Integration

### 6.1 Permission Model

```typescript
interface AIPermissions {
  'ai:query:own'        // Query own company data
  'ai:query:all'        // Query all data (admin)
  'ai:index:trigger'    // Trigger reindexing
  'ai:usage:view'       // View usage stats
}
```

### 6.2 Query Scoping

Every RAG query is **mandatory** scoped by `companyId`:

```typescript
const results = await vectorSearch(query, {
  filter: { company_id: user.companyId },  // MANDATORY
  limit: 5,
});
```

---

## 7. Guardrails

### 7.1 Input Guardrails

```typescript
const inputGuardrails = {
  injectionPatterns: [
    /ignore previous instructions/i,
    /disregard all prior/i,
    /you are now/i,
  ],
  maxQueryLength: 2000,
  queriesPerMinute: 10,
  queriesPerDay: 100,
};
```

### 7.2 Output Guardrails

```typescript
const outputGuardrails = {
  piiPatterns: {
    greekVAT: /\b\d{9}\b/,
    greekIBAN: /\bGR\d{25}\b/,
    email: /\b[\w.-]+@[\w.-]+\.\w+\b/,
  },
  redactIfPresent: ['password', 'secret', 'apikey'],
  requireSources: true,
};
```

---

## 8. Cost Controls

### 8.1 Usage Limits

```typescript
interface UsageLimits {
  perUser: {
    dailyTokens: 100_000,
    dailyCost: 1.00,  // USD
  },
  perCompany: {
    monthlyTokens: 10_000_000,
    monthlyCost: 100.00,  // USD
  },
}
```

### 8.2 Cost Projection

| Operation | Volume | Monthly Cost |
|-----------|--------|--------------|
| **Queries** | 10,000 | $10 |
| **Embeddings** | 100,000 docs | $2 |
| **Storage** | 100GB pgvector | $2.30 |
| **TOTAL** | - | **~$15/month** |

---

## 9. Provider Abstraction & OSS Fallback

> **CRITICAL**: To comply with "strongest free OSS first" policy, all AI services MUST be abstracted behind interfaces with documented OSS fallbacks.

### 9.1 Provider Abstraction Layer

```typescript
// src/ai/providers/types.ts
interface LLMProvider {
  name: string;
  type: 'paid' | 'oss';
  generateText(prompt: string, options: LLMOptions): Promise<LLMResponse>;
}

interface EmbeddingProvider {
  name: string;
  type: 'paid' | 'oss';
  dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// Factory pattern for provider switching
function createLLMProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'gemini': return new GeminiProvider(config);
    case 'openai': return new OpenAIProvider(config);
    case 'llama': return new LlamaProvider(config);  // OSS fallback
    case 'ollama': return new OllamaProvider(config); // OSS fallback
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### 9.2 OSS Fallback Plan

| Paid Service | OSS Fallback | Quality | When to Switch |
|--------------|--------------|---------|----------------|
| **Gemini 2.0 Flash** | Llama 3.1 8B (Ollama) | 80-85% | Cost ceiling exceeded |
| **OpenAI Embeddings** | Sentence-Transformers (all-MiniLM-L6-v2) | 90% | **Phase 1 default** |
| **OpenAI Embeddings** | E5-large-v2 (HuggingFace) | 95% | High-quality fallback |

### 9.3 Phased Implementation

| Phase | LLM Provider | Embedding Provider | Status |
|-------|--------------|-------------------|--------|
| **Phase 1** (Default) | Gemini 2.0 Flash | Sentence-Transformers (OSS) | **START HERE** |
| **Phase 2** (Scale) | Gemini 2.0 Flash | OpenAI (if quality insufficient) | Business justification |
| **Phase 3** (Cost-opt) | Llama 3.1 (self-hosted) | Sentence-Transformers | When cost > $50/month |

### 9.4 OSS Embedding Implementation

```typescript
// src/ai/providers/oss/sentence-transformers.ts
import { pipeline } from '@xenova/transformers';

class SentenceTransformersProvider implements EmbeddingProvider {
  name = 'sentence-transformers';
  type = 'oss' as const;
  dimensions = 384;  // all-MiniLM-L6-v2

  private model: Pipeline | null = null;

  async initialize() {
    this.model = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) await this.initialize();
    const output = await this.model(text, { pooling: 'mean' });
    return Array.from(output.data);
  }
}
```

### 9.5 Cost Ceiling Enforcement

```typescript
// Automatic provider switching when cost exceeds ceiling
const COST_CEILING = {
  dailyUSD: 5.00,
  monthlyUSD: 50.00,
};

async function enforceProviderPolicy(usage: UsageStats): Promise<ProviderConfig> {
  if (usage.monthlyUSD > COST_CEILING.monthlyUSD * 0.8) {
    console.warn('Approaching cost ceiling, switching to OSS providers');
    return {
      llm: 'ollama',      // Switch to self-hosted Llama
      embedding: 'sentence-transformers',  // Already OSS
    };
  }
  return currentConfig;
}
```

### 9.6 Acceptance Criteria for OSS Compliance

- [ ] **AC-OSS-1**: Embedding provider defaults to Sentence-Transformers (OSS)
- [ ] **AC-OSS-2**: Provider abstraction layer implemented
- [ ] **AC-OSS-3**: Automatic fallback when cost ceiling reached
- [ ] **AC-OSS-4**: Ollama/Llama fallback tested and documented
- [ ] **AC-OSS-5**: No hard dependency on paid providers

---

## 10. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | pgvector instance deployed | Pending |
| **G2** | Embedding pipeline functional | Pending |
| **G3** | RAG query returns relevant results | Pending |
| **G4** | RBAC scoping verified | Pending |
| **G5** | Guardrails block injection attempts | Pending |
| **G6** | Rate limiting enforced | Pending |
| **G7** | OSS embedding provider as default | Pending |
| **G8** | Provider abstraction layer tested | Pending |

---

## 11. Acceptance Criteria

### Functional
- [ ] **AC-1**: User can ask natural language questions
- [ ] **AC-2**: AI provides answers with source citations
- [ ] **AC-3**: AI only accesses data from user's company
- [ ] **AC-4**: Prompt injection attempts are blocked
- [ ] **AC-5**: Usage is tracked and limited

### Non-Functional
- [ ] **AC-6**: Query response time < 3 seconds
- [ ] **AC-7**: System handles 100 concurrent queries
- [ ] **AC-8**: Embedding updates within 5 minutes of data change

---

## 13. Audit Trail

```typescript
interface AIAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  companyId: string;
  query: string;
  retrievedDocIds: string[];
  response: string;
  sources: string[];
  guardrailsTriggered: string[];
  blocked: boolean;
  cost: number;
}
```

---

## 13. Related Documents

- **Current AI Implementation**: `src/ai/genkit.ts`, `src/ai/flows/`
- **Audit System**: `src/lib/auth/audit.ts`
- **Architecture Review**: `docs/architecture-review/08-ai-layer-feasibility.md`
- **Genkit Documentation**: https://firebase.google.com/docs/genkit

---

## 14. Local_Protocol Compliance

> **MANDATORY**: All implementation PRs for this strategy MUST comply with Local_Protocol (CLAUDE.md) as a **non-negotiable quality gate**.

### Required Compliance Checks

| Rule | Requirement | Enforcement |
|------|-------------|-------------|
| **ZERO `any`** | No TypeScript `any` types | PR blocked if found |
| **ZERO `as any`** | No type casting to `any` | PR blocked if found |
| **ZERO `@ts-ignore`** | No TypeScript ignores | PR blocked if found |
| **ZERO inline styles** | Use design tokens only | PR blocked if found |
| **ZERO duplicates** | Use centralized systems | PR blocked if found |
| **ZERO hardcoded values** | Use config/constants | PR blocked if found |

### Pre-PR Checklist

Before any PR implementing this strategy:

- [ ] Searched for existing code (Grep/Glob)
- [ ] No `any` types in new code
- [ ] Uses centralized systems from `centralized_systems.md`
- [ ] No inline styles (uses design tokens)
- [ ] Asked permission before creating new files
- [ ] TypeScript compiles without errors
- [ ] **OSS provider used as default** (paid only with business justification)

### Violation Consequences

**Any PR violating Local_Protocol will be REJECTED regardless of functionality.**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
