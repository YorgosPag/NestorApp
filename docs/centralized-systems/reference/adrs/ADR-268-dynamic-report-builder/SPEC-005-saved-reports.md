# SPEC-005: Saved Reports

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29

---

## Firestore Schema

```typescript
interface SavedReport {
  id: string;                      // Enterprise ID (rpt_xxx)
  name: string;                    // "Μονάδες ανά κτίριο — Κορδελιό"
  domain: ReportDomain;            // 'units'
  columns: string[];               // ['code', 'building.name', 'type']
  filters: ReportFilter[];         // [{ field, operator, value }]
  groupBy?: string[];              // ['building.name']
  aggregations?: Aggregation[];    // [{ field, fn: 'SUM' }]
  sortBy?: SortConfig;             // { field, dir: 'asc' | 'desc' }
  companyId: string;               // tenant isolation
  createdBy: string;               // user ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Collection

`saved_reports` — top-level collection

## Operations

| Action | UI | Firestore |
|--------|------|-----------|
| Save | 💾 button → name dialog | setDoc() with enterprise ID |
| Load | Dropdown selector | getDoc() |
| Update | 💾 button (existing) | updateDoc() |
| Delete | 🗑️ button in dropdown | deleteDoc() |

## Enterprise ID Prefix

`rpt_` — needs generator in enterprise-id.service.ts

## Access Control

- Reports scoped to `companyId`
- All users in company can see all saved reports
- Only creator can edit/delete (future: share permissions)
