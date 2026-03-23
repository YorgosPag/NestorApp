# SPEC-257B: Unit-Level Scoping in Tool Executor

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 2 of 7 |
| **Priority** | CRITICAL — security enforcement |
| **Status** | PENDING |
| **Depends On** | SPEC-257A (unit-level links must exist) |

---

## Objective

Ο AI tool executor φιλτράρει query results σε unit level — buyer βλέπει ΜΟΝΟ τα δικά του units.

## Current State

- `enforceRoleAccess()` φιλτράρει κατά `projectId` (project-level scoping)
- Buyer μπορεί να δει ΟΛΑ τα units του project
- `ContactMeta.projectRoles` δεν περιέχει `linkedUnitIds`

## Target State

- `ContactMeta` επεκτείνεται με `linkedUnitIds: string[]`
- `contact-linker.ts` query σε `contact_links` where `targetEntityType == "unit"` → γεμίζει `linkedUnitIds`
- `enforceRoleAccess()`: buyer → inject filter `id IN linkedUnitIds` (αντί `projectId IN`)
- Documents: filter by `unitId IN linkedUnitIds`

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/types/ai-pipeline.ts` | MODIFY | Add `linkedUnitIds: string[]` στο `ContactMeta` |
| `src/services/contact-recognition/contact-linker.ts` | MODIFY | Query contact_links for unit links, populate `linkedUnitIds` |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | `enforceRoleAccess()`: unit-level filter for buyer/owner/tenant |
| `src/config/ai-role-access-matrix.ts` | MODIFY | Add `scopeLevel: 'unit' | 'project'` στο `RoleAccessConfig` |
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | System prompt: include linked unit IDs |

## Implementation Steps

### Step 1: Extend ContactMeta
```typescript
// src/types/ai-pipeline.ts
export interface ContactMeta {
  // ...existing...
  linkedUnitIds: string[];  // NEW: unit IDs from contact_links where targetEntityType='unit'
}
```

### Step 2: Extend contact-linker.ts
Στο `resolveContactFromTelegram()`, μετά το query contact_links:

```typescript
// Extract unit IDs from roles where entityType === 'unit'
const linkedUnitIds = projectRoles
  .filter(r => r.entityType === 'unit')
  .map(r => r.entityId);
```

### Step 3: Extend enforceRoleAccess()
```
if (role is buyer/owner/tenant && linkedUnitIds.length > 0) {
  if (collection === UNITS) → inject filter: document ID must be in linkedUnitIds
  if (collection === DOCUMENTS) → inject filter: unitId IN linkedUnitIds
  if (collection === BUILDINGS) → allow (parent building of linked unit)
}
```

### Step 4: Extend system prompt
```
"Ο χρήστης είναι αγοραστής. Linked units: [unit_xxx, unit_yyy].
Μπορείς να κάνεις query ΜΟΝΟ αυτά τα units."
```

## Existing Functions to Reuse

- `getAccessConfig(ctx)` — cached per request (`agentic-tool-executor.ts:165-176`)
- `resolveAccessConfig()` — `ai-role-access-matrix.ts`
- `resolveContactFromTelegram()` — `contact-linker.ts:93-194`
- `enforceRoleAccess()` — `agentic-tool-executor.ts:159-195`

## Acceptance Criteria

- [ ] Buyer queries units → sees ONLY their own unit(s)
- [ ] Buyer queries documents → sees ONLY documents linked to their unit
- [ ] Buyer can see parent building (no unit filter on buildings)
- [ ] Admin still sees everything (bypass)
- [ ] Supervisor/architect still scoped by project (unchanged)

## Security Verification

```
Test: Buyer for unit A-1 queries: firestore_query("units", [])
Expected: Returns ONLY unit A-1
NOT: All units in project
```
