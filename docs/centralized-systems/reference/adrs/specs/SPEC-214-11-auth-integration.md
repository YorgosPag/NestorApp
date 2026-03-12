# SPEC-214-11: AuthorizedQueryService Integration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 11 |
| **Status** | PENDING |
| **Risk** | MEDIUM |
| **Αρχεία** | 2-3 modified |
| **Depends On** | SPEC-214-01 + Phases 2-10 (ή αρκετές από αυτές) |

---

## Στόχος

Integration του ήδη υπάρχοντος `AuthorizedQueryService` (`src/lib/auth/query-middleware.ts`) με τον νέο `FirestoreQueryService`.

---

## Τι Υπάρχει Ήδη

Ο `AuthorizedQueryService` (v1.0.0, 2025-12-15) παρέχει:
- ✅ Authentication context extraction
- ✅ Ownership-scoped queries (`readOwnedDocuments`)
- ✅ Public document reading (`readPublicDocuments`)
- ✅ Cache (5-min TTL)
- ✅ Audit logging capabilities
- ✅ Error types (`AuthorizationError`, `QueryExecutionError`)

**Πρόβλημα**: Κανένα service δεν το χρησιμοποιεί ακόμα (υποχρησιμοποιημένο).

---

## Σχέδιο Integration

```typescript
// FirestoreQueryService θα χρησιμοποιεί AuthorizedQueryService εσωτερικά:

class FirestoreQueryService {
  private authService: AuthorizedQueryService;

  async read<T>(options: QueryOptions<T>): Promise<QueryResult<T>> {
    if (options.skipTenantFilter) {
      // System collections → use authService.readPublicDocuments()
      return this.authService.readPublicDocuments(collection, constraints);
    } else {
      // Tenant-scoped → use authService.readOwnedDocuments()
      return this.authService.readOwnedDocuments(collection, {
        ownerField: this.getTenantField(collection),
        additionalConstraints: constraints
      });
    }
  }
}
```

---

## Benefits

- **Αυτόματο auth context** — δεν χρειάζεται manual `auth.currentUser`
- **Cache** — 5-min TTL για repeated queries
- **Audit trail** — ποιος, πότε, τι
- **Error handling** — enterprise-grade errors αντί για generic Firebase errors

---

## Verification Checklist

- [ ] Auth context extracted correctly
- [ ] Cache works (repeated queries faster)
- [ ] Unauthenticated requests → proper error
- [ ] Audit metadata available
- [ ] All existing flows still work
- [ ] `npx tsc --noEmit` clean
