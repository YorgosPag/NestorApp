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
| Tool Definitions | `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | 16 tools (query, get, count, write, email, telegram, etc.) |
| Tab Filter | `src/services/ai-pipeline/tools/contact-tab-filter.ts` | Server-side field filtering by tab (reads SSoT configs) |
| Section Utils | `src/config/section-field-utils.ts` | SSoT: field extraction + array field sections |
| Tool Executor | `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | Strategy Pattern dispatcher (~160 lines) |
| Shared Infrastructure | `src/services/ai-pipeline/tools/executor-shared.ts` | Types, constants, RBAC, security, utilities |
| Firestore Handler | `src/services/ai-pipeline/tools/handlers/firestore-handler.ts` | query, get_document, count, write, search_text |
| Contact Handler | `src/services/ai-pipeline/tools/handlers/contact-handler.ts` | create_contact, append_contact_info, update_contact_field, set_contact_esco |
| Messaging Handler | `src/services/ai-pipeline/tools/handlers/messaging-handler.ts` | send_email, send_telegram, send_social |
| Customer Handler | `src/services/ai-pipeline/tools/handlers/customer-handler.ts` | complaint, deliver_file, knowledge_base |
| Utility Handler | `src/services/ai-pipeline/tools/handlers/utility-handler.ts` | get_collection_schema, lookup_doy_code, search_esco_occupations, search_esco_skills |
| Agentic Loop | `src/services/ai-pipeline/agentic-loop.ts` | Multi-step reasoning (max 7 iterations, 50s timeout) |
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
| 2026-03-24 | Fix: `buildChannelSenderId()` now includes `firebaseUid` in resolution chain (first priority) and throws instead of falling back to `'unknown'` — prevents orphan `in_app_unknown` documents in `ai_chat_history` |
| 2026-03-24 | Feat: Google-level duplicate detection in `create_contact` tool — 3 criteria (email exact, phone exact, name fuzzy). Returns structured matches to AI for user decision. New `skipDuplicateCheck` param for confirmed creates. New `findContactByPhone()` + `checkContactDuplicates()` in contact-lookup.ts |
| 2026-03-24 | Feat: Telegram Inline Keyboard buttons for duplicate contact resolution. 3 buttons (Ενημέρωσε/Δημιούργησε νέα/Ακύρωση) αντί plain text. Pending actions σε `ai_pending_actions` collection (24h TTL). New: `duplicate-contact-keyboard.ts`, callback handler in `callback-query.ts` |
| 2026-03-25 | Refactor: Strategy Pattern — Split monolithic `agentic-tool-executor.ts` (2397 lines) into 5 domain handlers + shared infrastructure. Executor is now thin dispatcher (~160 lines). Zero breaking changes to public API. |
| 2026-03-25 | Feat: Dynamic tab-to-field mapping — AI agent now reads from SSoT section configs (`individual-config`, `company-gemi`, `service-config`) to know which fields belong to which tab. New `ai-tab-mapping.ts`. Covers all entity types (contacts, buildings, projects, units). Removed `'use client'` from `service-config.ts`. |
| 2026-03-25 | Feat: Server-side tab filtering — `tabFilter` parameter on `firestore_query`, `firestore_get_document`, AND `search_text`. When AI passes `tabFilter: "basicInfo"`, handler strips all fields NOT in that tab BEFORE returning to AI. Replaces unreliable prompt-based filtering. New `contact-tab-filter.ts` + `section-field-utils.ts` (SSoT for field extraction). |
| 2026-03-25 | Feat: ESCO search tools — `search_esco_occupations` (2,942 occupations) + `search_esco_skills` (13,485 skills). Server-side Firestore search with accent normalization. AI MUST search ESCO before writing profession/skills. Updated `firestore_write` + `update_contact_field` descriptions to enforce ESCO-first workflow. |
| 2026-03-25 | Feat: `set_contact_esco` tool — Dedicated tool for writing ESCO occupation (profession+escoUri+iscoCode+escoLabel) and skills (escoSkills[] array) to contacts. Fixes: AI tried append_contact_info which only accepts phone/email/social. Full flow: search ESCO → show matches → set_contact_esco with URI+label from results. |
| 2026-03-25 | Fix: Server-side ESCO enforcement — `set_contact_esco` rejects free-text profession writes when ESCO matches exist. Returns matches in error response, forcing AI to show options and ask user. Extracted shared `esco-search-utils.ts` to eliminate duplication. Bug fix: empty skills array no longer deletes existing skills. |
