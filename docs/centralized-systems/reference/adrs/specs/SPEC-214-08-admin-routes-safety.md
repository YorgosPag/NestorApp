# SPEC-214-08: Admin Routes Safety — Batch Processing

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 8 |
| **Status** | ✅ COMPLETED |
| **Completed** | 2026-03-13 |
| **Risk** | LOW |
| **Αρχεία** | 11 modified (1 new + 10 routes) |
| **Depends On** | Ανεξάρτητο (καμία dependency σε Phase 1-7) |

---

## Στόχος

Προσθήκη safety mechanisms σε 10 admin routes που κάνουν **unbounded Firestore collection reads** — `getDocs()` / `.get()` χωρίς `limit()`. Ρίσκο: timeout / memory exhaustion σε μεγάλα datasets.

---

## Υλοποίηση

### Shared Batch Utility

Δημιουργήθηκε `src/lib/admin-batch-utils.ts` με:
- `processClientBatch()` — Client SDK (`firebase/firestore`)
- `processAdminBatch()` — Admin SDK (`firebase-admin/firestore`)
- `BATCH_SIZE_READ = 500` — Read-only analysis (GET)
- `BATCH_SIZE_WRITE = 200` — Read + writes (POST migrate/fix)

### Routes Αλλαγμένα

| # | Route | SDK | Fix |
|---|-------|-----|-----|
| 1 | `migrate-units` | Client | `processClientBatch()` GET+POST |
| 2 | `migrate-dxf` | Client | `processClientBatch()` + **N+1 bug fix** |
| 3 | `cleanup-duplicates` | Client | `processClientBatch()` GET+DELETE |
| 4 | `migrate-building-features` | Client | `processClientBatch()` GET+POST |
| 5 | `create-clean-projects` | Admin | Verification `.get()` → `.count().get()` |
| 6 | `fix-projects-direct` | Admin | `processAdminBatch()` + verification batched |
| 7 | `seed-floors` | Admin | `processAdminBatch()` GET+POST+DELETE |
| 8 | `seed-parking` | Admin | `processAdminBatch()` GET+POST+DELETE+PATCH |
| 9 | `search-backfill` | Admin | Default `limit(500)` on POST + PATCH |
| 10 | `force-update` | Admin | `processAdminBatch()` |

### N+1 Bug Fix (migrate-dxf)

**Πριν**: Μέσα στο loop, για κάθε legacy file → `getDocs(collection(db, COLLECTIONS.CAD_FILES))` full scan + `.find(id)`
**Μετά**: `getDoc(doc(db, COLLECTIONS.CAD_FILES, fileInfo.id))` — O(1) αντί O(N)

---

## Τι ΔΕΝ Αλλάζει

- Auth/permission checks (ήδη `withAuth` + super_admin)
- Rate limiting (ήδη `withSensitiveRateLimit`)
- Audit logging (`logDataFix()`, `logMigrationExecuted()`)
- Business logic μετά το fetch
- HTTP response format

---

## Verification Checklist

- [x] Κάθε route έχει `limit()` σε κάθε query
- [x] Pagination/batch pattern εφαρμόστηκε σωστά
- [x] Shared utility `admin-batch-utils.ts` for DRY
- [x] N+1 bug fix σε migrate-dxf
- [x] Verification queries → `.count().get()` where applicable
- [x] `npx tsc --noEmit` clean (background check)
