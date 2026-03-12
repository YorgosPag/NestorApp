# SPEC-214-03: File Services Migration

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 3 |
| **Status** | PENDING |
| **Risk** | MEDIUM |
| **Αρχεία** | 3 modified |
| **Depends On** | SPEC-214-01 |

---

## Στόχος

Migration file-related services. Αυτά έχουν τα ΠΕΡΙΣΣΟΤΕΡΑ inline queries (12+ στο file-record.service.ts).

---

## Αρχεία προς Αλλαγή

### 1. `src/services/file-record.service.ts`

**Τρέχουσα κατάσταση**: 12+ getDocs calls, dynamic constraint building, ⚠️ partial companyId filter

**Ιδιαιτερότητα**: Χρησιμοποιεί ήδη `QueryConstraint[]` pattern — εύκολη migration.

```typescript
// ΠΡΙΝ
const constraints: QueryConstraint[] = [];
if (entityType) constraints.push(where('entityType', '==', entityType));
if (isActive) constraints.push(where('isDeleted', '==', false));
if (companyId) constraints.push(where('companyId', '==', companyId));
const q = query(collection(db, COLLECTIONS.FILES), ...constraints);

// ΜΕΤΑ
const result = await queryService.read<FileRecord>({
  collection: 'FILES',
  constraints: [
    ...(entityType ? [where('entityType', '==', entityType)] : []),
    ...(isActive ? [where('isDeleted', '==', false)] : [])
  ]
  // companyId auto-injected by queryService
});
```

### 2. `src/services/file-approval.service.ts`

**Τρέχουσα κατάσταση**: 6 where clauses

### 3. `src/services/file-folder.service.ts`

**Τρέχουσα κατάσταση**: 3 where clauses

---

## Κρίσιμα Σημεία

- `file-record.service.ts` είναι ένα από τα πιο χρησιμοποιημένα services
- Πρέπει να δοκιμαστεί: upload, download, classification, search
- Τα optional companyId filters πρέπει να γίνουν automatic

---

## Verification Checklist

- [ ] File listing works correctly
- [ ] File upload flow unaffected
- [ ] File classification (updateDoc) works
- [ ] Search by entityType works
- [ ] companyId filtering is now automatic
- [ ] `npx tsc --noEmit` clean
