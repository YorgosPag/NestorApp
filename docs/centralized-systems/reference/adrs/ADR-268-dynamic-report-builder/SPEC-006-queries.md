# SPEC-006: Server-Side Queries

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29

---

## API Endpoint

`POST /api/reports/builder`

## Request/Response

```typescript
interface BuilderQueryRequest {
  domain: ReportDomain;
  companyId: string;
  columns: string[];
  filters: ReportFilter[];
  groupBy?: string[];
  aggregations?: Aggregation[];
  sortBy?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;                 // default 500, max 2000
}

interface BuilderQueryResponse {
  rows: Record<string, unknown>[];
  groups?: GroupedResult[];
  aggregations: AggregationResult[];
  totalCount: number;
  executionTimeMs: number;
}
```

## Query Engine Pattern

```typescript
// 1. Primary collection query
const primarySnap = await db
  .collection(domainConfig.collection)
  .where('companyId', '==', companyId)
  // ... dynamic filters
  .limit(limit)
  .get();

// 2. Resolve references (batch)
const refIds = extractRefIds(primarySnap, domainConfig.refs);
const refDocs = await batchResolve(refIds);

// 3. Join client-side
const rows = primarySnap.docs.map(doc => ({
  ...extractColumns(doc, columns),
  ...resolveRefs(doc, refDocs, columns),
  ...computeFields(doc, columns),
}));

// 4. Server-side aggregation
const aggregations = computeAggregations(rows, request.aggregations);
const groups = request.groupBy ? groupRows(rows, request.groupBy) : undefined;
```

## Cross-Domain Joins

| Domain | Primary | Joined |
|--------|---------|--------|
| Αγοραστές | contacts (persona=client) | units, buildings, projects, payment_plans |
| Μονάδες | units | buildings, projects, contacts (buyer) |
| Προμηθευτές | contacts (persona=supplier) | purchase_orders |
| Μηχανικοί | contacts (persona=engineer) | contact_links, projects |
| Εργάτες | contacts (persona=worker) | attendance_events, employment_records |
| Δικηγόροι/Συμβ. | contacts | legal_contracts |
| Μεσίτες | contacts (persona=agent) | brokerage_agreements, commission_records |
| Πλάνα Πληρωμών | payment_plans (subcol) | units, contacts |
| Αξιόγραφα | cheques | units, projects, contacts |
| BOQ | boq_items | buildings, construction_phases |
| Τιμολόγια | accounting_invoices | contacts |
| Παραγγελίες | purchase_orders | contacts (supplier), projects |

## Performance Guards

- Default limit: 500 rows
- Max limit: 2000 rows
- Query timeout: 10 seconds
- Batch resolve: max 100 refs per batch (Firestore IN limit = 10 → chunk)
- Promise.all for parallel collection queries

## Firestore Constraints

- `IN` query: max 10 items → chunk arrays
- Composite filters: max 30
- `orderBy` requires matching index
- Subcollection queries need collectionGroup
