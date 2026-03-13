# SPEC-214-11: AuthorizedQueryService Integration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 11 |
| **Status** | ✅ SUPERSEDED |
| **Risk** | — |
| **Αρχεία** | 2 modified |
| **Depends On** | Phases 1-10 (all complete) |

---

## Αποτέλεσμα

**SUPERSEDED** — Ο `FirestoreQueryService` (ADR-214 Phases 1-10) απορρόφησε πλήρως όλη τη λειτουργικότητα που χρειαζόταν:

| AuthorizedQueryService Feature | FirestoreQueryService Equivalent |
|-------------------------------|----------------------------------|
| `readOwnedDocuments()` | `getAll()` with automatic tenant filtering |
| `readPublicDocuments()` | `getAll()` with `tenantOverride: 'skip'` |
| Authentication context | `requireAuthContext()` (TenantContext — companyId/tenantId/userId) |
| Cache (5-min TTL) | Not needed — React Query / SWR handle client caching |
| Audit logging | Deferred to Phase 12+ if needed |
| Error types | Re-exported from `@/services/firestore` |

### Γιατί SUPERSEDED αντί για Integration

1. **Inferior auth model**: AuthorizedQueryService χρησιμοποιεί μόνο `uid` — δεν υποστηρίζει `companyId`/`tenantId` isolation
2. **Read-only**: Δεν υποστηρίζει writes, subscriptions, ή batch operations
3. **0 consumers**: Κανένα service δεν το χρησιμοποιεί σε production
4. **Redundant**: Όλα τα 85+ αρχεία μεταφέρθηκαν στον FirestoreQueryService (Phases 2-10)

### Τι Έγινε (Phase 11)

- `@deprecated` JSDoc στο `AuthorizedQueryService` class + `QueryServiceFactory`
- Διαγραφή 3 dead functions: `readProjects`, `readUserContacts`, `logQueryContext`
- Κρατήθηκαν: `AuthorizationError`, `QueryExecutionError` (re-exported), interfaces
- ADR-214 Status → **COMPLETED**

---

## Verification Checklist

- [x] `grep -r "readProjects\|readUserContacts\|logQueryContext" src/` → 0 hits
- [x] `AuthorizationError` / `QueryExecutionError` → still importable via `@/services/firestore`
- [x] `npx tsc --noEmit` → 0 new errors
- [x] ADR-214 status → COMPLETED
