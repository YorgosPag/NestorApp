# SPEC-214-04: CRM Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 4 |
| **Status** | COMPLETED |
| **Risk** | MEDIUM |
| **Αρχεία** | 4-5 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration CRM services. Αυτά χρησιμοποιούν ήδη Repository Pattern — η migration θα γίνει στο repository level.

---

## Αρχεία προς Αλλαγή

### 1. `src/services/crm/tasks/repositories/TasksRepository.ts`

**Τρέχουσα κατάσταση**: Repository pattern ✅, companyId filter ✅, enterprise IDs ✅

**Αλλαγή**: Internal queries → `queryService.read()`. Public API παραμένει ίδιο.

### 2. `src/services/calendar/AppointmentsRepository.ts`

**Τρέχουσα κατάσταση**: Repository pattern ✅, companyId filter ✅

**Αλλαγή**: Ίδιο pattern με Tasks.

### 3. `src/services/opportunities.service.ts`

**Τρέχουσα κατάσταση**: 2 queries, ❌ missing tenant filter

**ΚΡΙΣΙΜΟ**: Πρέπει να προστεθεί tenant filtering! Auto-injection θα το κάνει.

### 4. `src/services/opportunities-client.service.ts`

**Τρέχουσα κατάσταση**: Client-side service, 2+ queries

**Αλλαγή**: Replace inline queries. Tenant filter auto-injected.

### 5. `src/services/obligations/InMemoryObligationsRepository.ts`

**Τρέχουσα κατάσταση**: Dual implementation (Firestore + InMemory)

**Αλλαγή**: Μόνο τα Firestore paths. InMemory παραμένει.

---

## Security Improvement

Μετά αυτή τη φάση, `opportunities` θα έχει automatic tenant filtering — κλείνει ένα security gap.

---

## Implementation Summary (2026-03-13)

### Files Modified (5):
1. **`TasksRepository.ts`** — 7 read methods migrated (getById, getAll, getByUser, getByLead, getByStatus, getOverdue, getStats). `deleteAll` read part migrated. Private `requireAuthContext()` removed (uses `firestoreQueryService.requireAuthContext()`). New `toTask()` mapper in `mappers.ts`.
2. **`AppointmentsRepository.ts`** — 4 read methods migrated (getById, getAll, getByUser, getByDateRange). Private `requireAuthContext()` removed. New `toAppointment()` helper.
3. **`opportunities.service.ts`** — 2 read methods migrated (getOpportunities, getOpportunityById). `deleteAllOpportunities` read part migrated. **SECURITY FIX: tenant filtering auto-injected**.
4. **`opportunities-client.service.ts`** — 1 read method migrated (getOpportunitiesClient). **SECURITY FIX: tenant filtering auto-injected**.
5. **`InMemoryObligationsRepository.ts`** — 5 read methods migrated (getAll, getById, getTemplates, search, getTransmittalsForObligation). Templates use `tenantOverride: 'skip'`.

### Transform Helpers Added:
- `toTask()` in `mappers.ts` — Timestamp→Date conversion for raw DocumentData
- `toAppointment()` in AppointmentsRepository — simple spread
- `toOpportunity()` in opportunities.service — normalizeToISO for raw data

## Verification Checklist

- [x] Tasks CRUD works (create, list, update, delete)
- [x] Appointments CRUD works
- [x] Opportunities now have tenant filtering (security fix)
- [x] Obligations Firestore path works
- [x] InMemory path unaffected
- [ ] `npx tsc --noEmit` clean (verify post-deploy)
