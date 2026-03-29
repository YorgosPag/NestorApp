# SPEC-002: Filter Engine

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29

---

## Filter Types ανά Τύπο Πεδίου

| Τύπος Πεδίου | Operators |
|--------------|----------|
| **text** | contains, equals, starts with, is empty |
| **enum** | is (multi-select dropdown) |
| **number / currency** | =, >, <, ≥, ≤, between |
| **percentage** | =, >, <, ≥, ≤, between |
| **date** | before, after, between, presets (week/month/quarter/year/ytd/custom) |
| **boolean** | is true / is false |

## Cross-Domain Filters (πάντα διαθέσιμα)

- Εταιρεία (companyId) — tenant isolation
- Έργο (projectId) — σε domains που έχουν project reference
- Κτίριο (buildingId) — σε domains κάτω από building

## Date Presets

| Preset | Περιγραφή |
|--------|-----------|
| `week` | Τελευταίες 7 ημέρες |
| `month` | Τρέχων μήνας |
| `quarter` | Τρέχον τρίμηνο |
| `year` | Τρέχον έτος |
| `ytd` | Year to date |
| `custom` | Ελεύθερο range (from — to) |

## Max Filters

- Maximum **10 φίλτρα** ταυτόχρονα (Procore pattern)
- Λογική: **AND** (όλα πρέπει να ισχύουν)
- Μελλοντικό: AND/OR groups (Phase 2+)

## Firestore Limitations

- `IN` query: max 10 items
- Composite filters: max 30
- Αν χρειαστούν >10 IN items → chunk σε batches
