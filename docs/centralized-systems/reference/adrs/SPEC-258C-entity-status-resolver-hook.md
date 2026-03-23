# SPEC-258C: useEntityStatusResolver SSoT Hook

| Field | Value |
|-------|-------|
| **ADR** | ADR-258 (Twin Architecture — Dynamic Overlay Coloring) |
| **Phase** | 2 of 4 |
| **Priority** | CRITICAL — SSoT data layer for dynamic coloring |
| **Status** | IMPLEMENTED (2026-03-23) |
| **Depends On** | SPEC-258A (color infrastructure: `commercialToPropertyStatus()`, `OVERLAY_OPACITY`) |

---

## Objective

Δημιουργία **ενός SSoT hook** (`useEntityStatusResolver`) που κάνει real-time resolve overlay → linked entity → `commercialStatus` → `PropertyStatus`. Χρησιμοποιείται και στα δύο contexts (DXF Viewer + FloorplanGallery) — η μόνη διαφορά είναι opacity (rendering config).

## Current State

- ~~`useFloorOverlays` επιστρέφει overlays **ως έχουν** από Firestore (με `overlay.status`)~~ ✅ Enriched
- ~~Δεν υπάρχει enrichment~~ ✅ `useEntityStatusResolver` resolves dynamically
- ~~Δεν υπάρχει `resolvedStatus` πεδίο στο `FloorOverlayItem`~~ ✅ Added
- ~~Κανένα real-time subscription σε entities~~ ✅ onSnapshot per collection/chunk

## Target State

- `useEntityStatusResolver(overlays)` → `Map<overlayId, PropertyStatus>`
- Real-time subscriptions σε 3 collections (units, parking_spots, storage_units) — max 3 queries ανά όροφο
- Αυτόματο chunking >30 entities (Firestore `in` query limit)
- Backward compatibility: fallback σε `overlay.status` αν δεν υπάρχει linked entity
- `FloorOverlayItem` enriched με `resolvedStatus: PropertyStatus`
- `useFloorOverlays` χρησιμοποιεί τον resolver και επιστρέφει enriched overlays

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/hooks/useEntityStatusResolver.ts` | **NEW** | SSoT hook — overlay → entity → status resolution |
| `src/hooks/useFloorOverlays.ts` | MODIFY | Χρήση resolver, enrichment `resolvedStatus`, footprint filter |
| `src/config/firestore-collections.ts` | READ | Collection keys: UNITS, PARKING_SPACES, STORAGE |
| `src/subapps/dxf-viewer/config/color-mapping.ts` | READ | `commercialToPropertyStatus()` (SPEC-258A) |

## Implementation Steps

### Step 1: Δημιουργία useEntityStatusResolver hook

Νέο αρχείο `src/hooks/useEntityStatusResolver.ts`:

```typescript
/**
 * SSoT hook: Resolves overlay → linked entity → commercialStatus → PropertyStatus (ADR-258)
 *
 * Χρησιμοποιείται και στα δύο contexts:
 *   - DXF Viewer: OVERLAY_OPACITY.DXF_FILL (20%)
 *   - FloorplanGallery: OVERLAY_OPACITY.GALLERY_FILL (50%)
 *
 * @param overlays - Array of FloorOverlayItem
 * @returns Map<overlayId, PropertyStatus> — resolved status per overlay
 */
```

**Εσωτερική λογική**:

```
useEntityStatusResolver(overlays: FloorOverlayItem[])
  │
  ├─ Step A: Extract unique entity IDs ανά collection
  │    unitIds     = overlays.filter(kind='unit').map(o => o.linked?.unitId).filter(Boolean)
  │    parkingIds  = overlays.filter(kind='parking').map(o => o.linked?.parkingId).filter(Boolean)
  │    storageIds  = overlays.filter(kind='storage').map(o => o.linked?.storageId).filter(Boolean)
  │
  ├─ Step B: Chunk arrays σε batches ≤30 (Firestore `in` limit)
  │    chunkArray(unitIds, 30) → [[id1..id30], [id31..id45]]
  │
  ├─ Step C: Real-time subscriptions (onSnapshot) per chunk
  │    Χρήση useRealtimeQuery ή firestoreQueryService:
  │    - units where __name__ in [chunk] → Map<unitId, commercialStatus>
  │    - parking_spots where __name__ in [chunk] → Map<parkingId, commercialStatus>
  │    - storage_units where __name__ in [chunk] → Map<storageId, commercialStatus>
  │
  ├─ Step D: Merge into Map<overlayId, PropertyStatus>
  │    for (overlay of overlays):
  │      if kind='footprint' → SKIP
  │      if kind='unit' && linked.unitId in unitStatusMap
  │        → commercialToPropertyStatus(unitStatusMap[linked.unitId])
  │      if kind='parking' && linked.parkingId in parkingStatusMap
  │        → commercialToPropertyStatus(parkingStatusMap[linked.parkingId])
  │      if kind='storage' && linked.storageId in storageStatusMap
  │        → commercialToPropertyStatus(storageStatusMap[linked.storageId])
  │      else → fallback: overlay.status ?? 'unavailable'   (backward compat)
  │
  └─ Return: Map<overlayId, PropertyStatus>
```

### Step 2: Chunking utility

```typescript
/** Split array into chunks of maxSize (Firestore `in` query limit = 10 (FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS)) */
function chunkArray<T>(array: T[], maxSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += maxSize) {
    chunks.push(array.slice(i, i + maxSize));
  }
  return chunks;
}
```

### Step 3: Real-time subscriptions pattern

Χρήση κεντρικοποιημένου `useRealtimeQuery` ή `onSnapshot` με proper cleanup:

```typescript
// Per collection, per chunk:
const unsubscribes: Array<() => void> = [];

for (const chunk of unitChunks) {
  // onSnapshot query: where('__name__', 'in', chunk)
  // → update unitStatusMap entries
  // → store unsubscribe for cleanup
}

// Cleanup on unmount / overlay change
useEffect(() => {
  return () => unsubscribes.forEach(fn => fn());
}, [overlays]);
```

**Σημαντικό**: Χρήση `firestoreQueryService` ή `useRealtimeQuery` — ΟΧΙ raw `onSnapshot()` — για tenant-aware filtering και proper cleanup.

### Step 4: Backward compatibility

Resolution priority:
1. Αν `kind == 'footprint'` → SKIP (δεν εμφανίζεται στο Property Viewer)
2. Αν linked entity υπάρχει ΚΑΙ βρέθηκε στο Firestore → `entity.commercialStatus`
3. Αν linked entity ΔΕΝ βρέθηκε (deleted/missing) → `'unavailable'`
4. Αν **δεν υπάρχει linked entity** αλλά υπάρχει `overlay.status` (legacy) → `overlay.status`
5. Fallback: `'unavailable'`

### Step 5: Extend FloorOverlayItem

Στο `useFloorOverlays.ts`:

```typescript
export interface FloorOverlayItem {
  // ... υπάρχοντα πεδία ...

  /** @deprecated ADR-258: Χρησιμοποίησε resolvedStatus */
  status?: PropertyStatus;

  /** Dynamic status resolved from linked entity's commercialStatus (ADR-258) */
  resolvedStatus: PropertyStatus;
}
```

### Step 6: Integrate resolver στο useFloorOverlays

Στο `useFloorOverlays.ts`:

```typescript
// Μετά το fetch overlays:
const statusMap = useEntityStatusResolver(overlays);

// Enrich overlays:
const enrichedOverlays = overlays.map(overlay => ({
  ...overlay,
  resolvedStatus: statusMap.get(overlay.id) ?? 'unavailable',
}));

return { overlays: enrichedOverlays, loading, error };
```

## Existing Functions to Reuse

- `commercialToPropertyStatus()` — `color-mapping.ts` (SPEC-258A — status mapping)
- `useRealtimeQuery` — `services/realtime/hooks/useRealtimeQuery.ts` (generic subscription)
- `firestoreQueryService` — `services/firestore/firestore-query.service.ts` (singleton, tenant-aware)
- `FIRESTORE_COLLECTIONS` — `config/firestore-collections.ts` (UNITS, PARKING_SPACES, STORAGE)
- `useFloorOverlays` — `hooks/useFloorOverlays.ts` (extend, don't rewrite)

## Performance Considerations

| Metric | Τιμή |
|--------|-------|
| Max queries per floor | 3 (1 per collection: units, parking, storage) |
| Max entities per query | 10 (FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS) |
| Auto-chunking | Ναι — >10 entities split αυτόματα via chunkArray() |
| Re-subscription | Μόνο αν αλλάξουν τα overlay entity IDs |
| Loading state | `'unavailable'` μέχρι να φορτωθεί status |

## Acceptance Criteria

- [x] `useEntityStatusResolver` hook υπάρχει και εξάγεται (`src/hooks/useEntityStatusResolver.ts`)
- [x] Real-time: αλλαγή entity status → αυτόματη ενημέρωση χωρίς refresh (onSnapshot per chunk)
- [x] Batch fetch: max queries per collection via chunking (ΟΧΙ N+1)
- [x] Chunking: >10 entities αυτόματο split (FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS = 10)
- [x] Backward compat: legacy overlays (με `overlay.status`) λειτουργούν (fallback priority)
- [x] `FloorOverlayItem.resolvedStatus` populated σε όλα τα overlays (enrichment in useFloorOverlays)
- [x] Footprint overlays → SKIP (ήδη filtered στο useFloorOverlays line 196)
- [x] Parking/Storage: `SpaceCommercialStatus` χειρίζεται μέσω `commercialToPropertyStatus()`
- [x] Proper cleanup subscriptions σε unmount (useEffect return)
- [x] Zero TypeScript errors

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-03-23 | Initial SPEC creation |
| 2026-03-23 | IMPLEMENTED: useEntityStatusResolver hook (src/hooks/useEntityStatusResolver.ts), FloorOverlayItem.resolvedStatus enrichment in useFloorOverlays, real-time onSnapshot per collection/chunk, chunkArray SSoT (10 limit), commercialToPropertyStatus SSoT, backward compat with legacy overlay.status |
