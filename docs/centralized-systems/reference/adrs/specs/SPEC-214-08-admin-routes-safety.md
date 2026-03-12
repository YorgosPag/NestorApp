# SPEC-214-08: Admin Routes Safety

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-214 |
| **Phase** | 8 |
| **Status** | PENDING |
| **Risk** | LOW |
| **Αρχεία** | 10+ modified |
| **Depends On** | Ανεξάρτητο (μπορεί να γίνει οποιαδήποτε στιγμή) |

---

## Στόχος

Προσθήκη safety mechanisms σε admin/migration routes που κάνουν **unbounded collection reads**. Αυτές οι routes μπορούν να κάνουν timeout ή memory exhaustion σε μεγάλα datasets.

---

## Πρόβλημα

```typescript
// ΤΡΕΧΟΝ — ΕΠΙΚΙΝΔΥΝΟ
const snapshot = await getDocs(query(collection(db, COLLECTIONS.UNITS)));
// Αν υπάρχουν 50,000 units → Memory exhaustion → 500 error
```

---

## Routes προς Αλλαγή

| Route | Collection | Fix |
|-------|-----------|-----|
| `/api/admin/migrate-units` | UNITS | + limit(500) + pagination |
| `/api/admin/migrate-dxf` | CAD_FILES | + limit(500) + pagination |
| `/api/admin/cleanup-duplicates` | UNITS | + limit(500) + pagination |
| `/api/admin/migrate-building-features` | BUILDINGS | + limit(500) + pagination |
| `/api/admin/create-clean-projects` | PROJECTS, BUILDINGS, FLOORS | + limit(500) + pagination |
| `/api/admin/fix-projects-direct` | PROJECTS | + limit(500) + pagination |
| `/api/admin/seed-floors` | FLOORS | + limit(100) |
| `/api/admin/seed-parking` | PARKING_SPACES | + limit(100) |
| `/api/admin/search-backfill` | Multiple | + limit(500) + pagination |
| `/api/units/force-update` | UNITS | + limit(500) + pagination |

---

## Migration Pattern

```typescript
// ΠΡΙΝ
const snapshot = await getDocs(query(collection(db, COLLECTIONS.UNITS)));
const allUnits = snapshot.docs.map(d => d.data());

// ΜΕΤΑ — Batch processing pattern
const BATCH_SIZE = 500;
let lastDoc: DocumentSnapshot | undefined;
let processed = 0;

while (true) {
  const constraints = [limit(BATCH_SIZE)];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.UNITS), ...constraints)
  );

  if (snapshot.empty) break;

  for (const doc of snapshot.docs) {
    // Process document
    processed++;
  }

  lastDoc = snapshot.docs[snapshot.docs.length - 1];

  // Safety: Log progress
  console.log(`Processed ${processed} documents...`);
}
```

---

## Σημείωση

Αυτές οι routes χρησιμοποιούν **Admin SDK** (server-side). Δεν χρησιμοποιούν tenant filtering intentionally — είναι admin operations. Η αλλαγή αφορά ΜΟΝΟ safety (limits + batching), ΟΧΙ tenant isolation.

---

## Verification Checklist

- [ ] Κάθε route έχει `limit()` σε κάθε query
- [ ] Pagination pattern εφαρμόστηκε σωστά
- [ ] Progress logging added
- [ ] Timeout handling (Vercel 60s limit)
- [ ] `npx tsc --noEmit` clean
