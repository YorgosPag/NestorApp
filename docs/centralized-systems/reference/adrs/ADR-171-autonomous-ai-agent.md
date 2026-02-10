# ADR-171: Autonomous AI Agent with Agentic Tool Calling

**Status**: Implemented (Phase 1)
**Date**: 2026-02-10
**Supersedes**: Hardcoded UC module routing for admin commands (ADR-145 admin path)

## Context

The existing AI pipeline used hardcoded UC modules (UC-010~016) for admin commands. Each new question type required a new module — e.g., "what phases does building X have?" fell to fallback because no module existed for it.

**Problem:**
- 7 admin UC modules with rigid intent routing
- Every new question type needed new code
- No conversation memory (each message was independent)
- Complex multi-step queries impossible (e.g., "find contact X, then show their projects")

## Decision

Replace the hardcoded admin UC module routing with an **autonomous AI agent** that uses **agentic tool calling** (OpenAI function calling) to query Firestore dynamically.

### Architecture: Agentic Loop

```
User Message
  ↓
AI Agent (system prompt with schema map)
  ↓
[Iteration 1] AI decides: call firestore_query(collection="buildings", filters=[...])
  → Tool executor runs query → returns results
  ↓
[Iteration 2] AI decides: call firestore_query(collection="construction_phases", filters=[...])
  → Tool executor runs query → returns results
  ↓
[Iteration 3] AI composes final answer from all results
  → "Το κτήριο 1524 έχει 3 φάσεις: Σχεδιασμός, Κατασκευή, Παράδοση"
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Schema Map | `src/config/firestore-schema-map.ts` | 25 collection schemas for AI awareness (~2000 tokens) |
| Tool Definitions | `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | 8 generic tools (query, get, count, write, email, telegram, schema, search) |
| Tool Executor | `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | Secure execution engine with whitelist, companyId injection, audit |
| Agentic Loop | `src/services/ai-pipeline/agentic-loop.ts` | Multi-step reasoning (max 5 iterations, 50s timeout) |
| Chat History | `src/services/ai-pipeline/chat-history-service.ts` | Conversation memory (Firestore, 20 messages, 24h TTL) |
| Pipeline Integration | `src/services/ai-pipeline/pipeline-orchestrator.ts` | `executeAgenticPath()` replaces UC module routing for admin |

### 8 Generic Tools

| Tool | Type | Description |
|------|------|-------------|
| `firestore_query` | READ | Query any whitelisted collection with filters, ordering, limit |
| `firestore_get_document` | READ | Fetch single document by ID |
| `firestore_count` | READ | Count documents matching criteria |
| `firestore_write` | WRITE | Create/update document (admin only) |
| `send_email_to_contact` | ACTION | Find contact by name + send email |
| `send_telegram_message` | ACTION | Send Telegram message |
| `get_collection_schema` | READ | Get field info for a collection |
| `search_text` | READ | Full-text search across multiple collections |

### Security Guardrails

1. **Collection Whitelist** — 27 read-allowed, 5 write-allowed collections. System/config/settings excluded.
2. **Automatic companyId Injection** — Every query gets `companyId == ctx.companyId` filter. Prevents cross-tenant access.
3. **Write Restrictions** — Only admin users can write. All writes are audit-logged.
4. **Result Truncation** — Max 50 results per query, max 8000 chars per tool result.
5. **Sensitive Field Redaction** — Passwords, tokens, keys are replaced with `[REDACTED]`.
6. **Iteration Limits** — Max 7 AI iterations, 50s total timeout (within Vercel 60s limit).
7. **Atomic Dedup** — Firestore Transaction prevents race condition where concurrent webhook calls could enqueue the same message twice.

### Chat History

- **Storage**: Firestore `ai_chat_history` collection
- **Key**: `${channel}_${senderId}` (e.g., `telegram_5618410820`)
- **Capacity**: 20 messages per user
- **TTL**: 24 hours (automatic cleanup)
- **No composite indexes needed** — single document read/write

## Consequences

### Positive
- **Zero new code** for new question types — AI figures it out
- **Conversation memory** — AI remembers previous messages
- **Multi-step reasoning** — Complex queries across collections
- **Simpler architecture** — 6 new files vs 7 UC modules for same functionality

### Negative
- **Higher latency** — Multiple AI calls per request (2-5 iterations typical)
- **Higher cost** — More OpenAI API calls per request
- **Less predictable** — AI may take unexpected paths (mitigated by tool whitelist)

### Migration Path
- Phase 1 (this ADR): Admin commands use agentic path
- Phase 2: Add write operations + complex actions
- Phase 3: Customer-facing agentic (limited scope, read-only)
- Phase 4: Deprecate UC modules entirely

## Firestore Collection

```
ai_chat_history (ADR-156)
├── telegram_5618410820 (document key: channel_senderId)
│   ├── channelSenderId: "telegram_5618410820"
│   ├── messages: ChatHistoryMessage[] (max 20)
│   ├── lastUpdated: ISO timestamp
│   └── createdAt: ISO timestamp
```

## Changelog

| Date | Change |
|------|--------|
| 2026-02-10 | Phase 1 implemented: 8 tools, agentic loop, chat history, pipeline integration |
| 2026-02-10 | Fix: mandatory join resolution for parent entities (phases→building→project) |
| 2026-02-10 | Fix: smart tool rules — collections without joins (contacts etc) skip unnecessary calls |
| 2026-02-10 | Fix: maxIterations 5→7 to accommodate multi-step join queries |
| 2026-02-10 | Fix: atomic dedup via Firestore Transaction (prevents duplicate processing race condition) |
