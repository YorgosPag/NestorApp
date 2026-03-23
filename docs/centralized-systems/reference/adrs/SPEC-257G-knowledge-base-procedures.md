# SPEC-257G: Knowledge Base — Διαδικασίες & Δικαιολογητικά

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 7 of 7 |
| **Priority** | HIGH — AI currently says "δεν έχω πληροφορία" |
| **Status** | IMPLEMENTED |
| **Depends On** | None (independent) |
| **Implemented** | 2026-03-23 |

---

## Objective

Δημιουργία knowledge base με τυπικές διαδικασίες (πώληση, μεταβίβαση, δάνειο) και απαιτούμενα δικαιολογητικά, ώστε ο AI να απαντά αντί να λέει "δεν έχω πληροφορία".

## Architecture Decision: Config File + Dedicated Tool

**SSoT Config**: `src/config/legal-procedures-kb.ts` — 4 procedures, typed interfaces, keyword search helper.

**Tool**: `search_knowledge_base(query)` — keyword match + document availability check.

**AI Flow**:
1. Buyer asks about documents/procedures
2. AI calls `search_knowledge_base("συμβολαιογράφος")`
3. Tool matches procedure, checks which `source:"system"` docs exist in `files` collection
4. Returns enriched result with `availableInSystem` markers
5. AI formats response with checklist + offers to send available docs (via `deliver_file_to_chat`)

## Knowledge Base Content (4 Procedures)

| ID | Title | Category | Documents |
|----|-------|----------|-----------|
| `final_contract` | Οριστικό Συμβόλαιο Αγοραπωλησίας | sale | 8 docs |
| `preliminary_contract` | Προσύμφωνο Αγοραπωλησίας | sale | 3 docs |
| `bank_loan` | Αίτηση Στεγαστικού Δανείου | finance | 7 docs |
| `property_transfer` | Μεταβίβαση Ακινήτου (μετά εξόφληση) | transfer | 4 docs |

## Document Sources

| Source | Label | Description |
|--------|-------|-------------|
| `system` | Διαθέσιμο στο σύστημα | Cross-referenced with `files` collection via `storageKey` |
| `buyer` | Από τον αγοραστή | Buyer must provide |
| `seller` | Από τον πωλητή | Developer/seller provides |
| `engineer` | Από τον μηχανικό | Engineer provides |
| `bank` | Από την τράπεζα | Bank provides |
| `municipality` | Από τον δήμο | Municipality provides |
| `cadastral_office` | Από το κτηματολόγιο | Cadastral office provides |

## Files Modified

| File | Action | Details |
|------|--------|---------|
| `src/config/legal-procedures-kb.ts` | NEW | SSoT config: 4 procedures, types, `searchProcedures()`, `DOCUMENT_SOURCE_LABELS` |
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | +`search_knowledge_base` tool definition |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | +`executeSearchKnowledgeBase()` with keyword match + availability check |
| `src/config/ai-role-access-matrix.ts` | MODIFY | +`KNOWLEDGE_BASE_PROMPT` shared const, appended to buyer/owner/tenant |
| `docs/.../ADR-257-customer-ai-access-control.md` | MODIFY | +changelog entry |

## SSoT Pattern

| SSoT | Location | Consumers |
|------|----------|-----------|
| `LEGAL_PROCEDURES` | `legal-procedures-kb.ts` | executor search |
| `DOCUMENT_SOURCE_LABELS` | `legal-procedures-kb.ts` | executor response formatting |
| `PROCEDURE_CATEGORIES` | `legal-procedures-kb.ts` | type safety |
| `searchProcedures()` | `legal-procedures-kb.ts` | executor (single search implementation) |
| `KNOWLEDGE_BASE_PROMPT` | `ai-role-access-matrix.ts` | buyer/owner/tenant prompts |

## Acceptance Criteria

- [x] Buyer ρωτάει "τι χρειάζομαι για τον συμβολαιογράφο;" → πλήρης λίστα
- [x] AI αναγνωρίζει ποια docs υπάρχουν ήδη στο σύστημα (availableInSystem)
- [x] AI προσφέρει να στείλει τα διαθέσιμα (μέσω deliver_file_to_chat)
- [x] Keywords matching: "δάνειο" → bank_loan procedure
- [x] "μεταβίβαση" → property_transfer procedure
- [x] No match → suggestion message with valid keywords
