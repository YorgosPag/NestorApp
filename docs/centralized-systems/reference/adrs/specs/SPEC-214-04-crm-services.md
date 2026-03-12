# SPEC-214-04: CRM Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 4 |
| **Status** | PENDING |
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

## Verification Checklist

- [ ] Tasks CRUD works (create, list, update, delete)
- [ ] Appointments CRUD works
- [ ] Opportunities now have tenant filtering ✅ (security fix)
- [ ] Obligations Firestore path works
- [ ] InMemory path unaffected
- [ ] `npx tsc --noEmit` clean
