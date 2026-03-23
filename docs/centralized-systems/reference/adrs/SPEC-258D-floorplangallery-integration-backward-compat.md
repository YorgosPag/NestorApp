# SPEC-258D: FloorplanGallery Integration & Backward Compatibility

| Field | Value |
|-------|-------|
| **ADR** | ADR-258 (Twin Architecture — Dynamic Overlay Coloring) |
| **Phase** | 4 of 4 |
| **Priority** | MEDIUM — final integration, minimal code change |
| **Status** | IMPLEMENTED (2026-03-23) |
| **Depends On** | SPEC-258A (colors), SPEC-258C (resolver + enriched overlays) |

---

## Objective

Τελική ολοκλήρωση: Η FloorplanGallery χρησιμοποιεί `overlay.resolvedStatus` (αντί `overlay.status`) για δυναμικό χρωματισμό, τα footprint overlays φιλτράρονται, και ενημερώνεται το ADR-237 changelog.

## Current State

- `FloorplanGallery.tsx` γραμμή ~367: `getStatusColors(overlay.status ?? 'unavailable')`
- Χρησιμοποιεί `overlay.status` (hardcoded κατά τη σχεδίαση) → εκτός sync αν αλλάξει entity status
- Footprint overlays εμφανίζονται (δεν φιλτράρονται)
- ADR-237 changelog δεν αναφέρει ADR-258

## Target State

- `FloorplanGallery.tsx`: `getStatusColors(overlay.resolvedStatus)` — 1 γραμμή αλλαγή
- Χρωματισμός βάσει `entity.commercialStatus` σε **real-time** (μέσω SPEC-258C enrichment)
- Footprint overlays **δεν εμφανίζονται** στο Property Viewer
- Opacity: `OVERLAY_OPACITY.GALLERY_FILL` (50%) — ήδη ίδια τιμή, αλλά τώρα από SSoT constant
- Hover opacity: `OVERLAY_OPACITY.GALLERY_HOVER` (70%)
- ADR-237 changelog ενημερωμένο

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/components/shared/files/media/FloorplanGallery.tsx` | MODIFY | `overlay.status` → `overlay.resolvedStatus` (1 γραμμή) |
| `src/hooks/useFloorOverlays.ts` | VERIFY | Footprint filter + `resolvedStatus` enrichment (done in SPEC-258C) |
| `docs/centralized-systems/reference/adrs/ADR-237-polygon-overlay-bridge.md` | MODIFY | Changelog entry |
| `docs/centralized-systems/reference/adrs/ADR-258-twin-architecture-dynamic-overlay-coloring.md` | MODIFY | Status → IMPLEMENTED |

## Implementation Steps

### Step 1: FloorplanGallery — 1 line change

Στο `FloorplanGallery.tsx`, function `drawOverlayPolygons`, γραμμή ~367:

**ΠΡΙΝ:**
```typescript
const colors = getStatusColors(overlay.status ?? 'unavailable') ?? OVERLAY_FALLBACK;
```

**ΜΕΤΑ:**
```typescript
const colors = getStatusColors(overlay.resolvedStatus) ?? OVERLAY_FALLBACK;
```

Η υπόλοιπη rendering λογική (hit-testing, hover, labels, highlighted unit) **παραμένει ακριβώς ίδια**.

### Step 2: Verify opacity usage

Verify ότι FloorplanGallery χρησιμοποιεί τα σωστά opacity values:

```typescript
// Normal fill — ήδη 0.5 (STATUS_COLORS_MAPPING), ταυτίζεται με OVERLAY_OPACITY.GALLERY_FILL
ctx.fillStyle = isHighlighted
  ? withOpacity(colors.stroke, 0.7)   // → OVERLAY_OPACITY.GALLERY_HOVER
  : colors.fill;                       // → ήδη 50% opacity από STATUS_COLORS_MAPPING
```

**Σημείωση**: Τα opacity values στο `STATUS_COLORS_MAPPING` είναι **ήδη 0.5** — ταυτίζονται με `OVERLAY_OPACITY.GALLERY_FILL`. Δεν χρειάζεται αλλαγή εδώ. Η αλλαγή opacity (0.2 vs 0.5) γίνεται στο **DXF Viewer** canvas rendering (SPEC-258A), ΟΧΙ στη FloorplanGallery.

### Step 3: Verify footprint filtering

Στο `useFloorOverlays.ts` (done in SPEC-258C), verify ότι τα footprint overlays φιλτράρονται:

```typescript
// Property Viewer: footprints δεν εμφανίζονται
const visibleOverlays = overlays.filter(o => o.kind !== 'footprint');
```

### Step 4: Verify backward compatibility

Legacy overlays (παλιά data στο Firestore, πριν το ADR-258):

| Σενάριο | Αναμενόμενο |
|---------|-------------|
| `overlay.linked.unitId` exists + entity found | → `resolvedStatus` = entity.commercialStatus → δυναμικό χρώμα |
| `overlay.linked.unitId` exists + entity NOT found | → `resolvedStatus` = `'unavailable'` → γκρι |
| No linked entity + `overlay.status` exists (legacy) | → `resolvedStatus` = overlay.status → παλιό χρώμα (backward compat) |
| No linked entity + no status | → `resolvedStatus` = `'unavailable'` → γκρι |

Αυτά χειρίζονται από τον resolver (SPEC-258C Step 4).

### Step 5: Update ADR-237 changelog

Στο `ADR-237-polygon-overlay-bridge.md`, section Changelog:

```markdown
| 2026-03-XX | ADR-258: overlay.status deprecated — χρωματισμός γίνεται δυναμικά βάσει entity.commercialStatus |
```

### Step 6: Update ADR-258 status

Στο `ADR-258-twin-architecture-dynamic-overlay-coloring.md`:
- Status: `📋 PLANNED` → `✅ IMPLEMENTED`
- Changelog: implementation date + notes

## Existing Functions to Reuse

- `getStatusColors(status)` — `color-mapping.ts` (SSoT color lookup — χρησιμοποιείται ήδη)
- `withOpacity(color, opacity)` — `color-config.ts` (χρησιμοποιείται ήδη στο highlight)
- `OVERLAY_FALLBACK` — `FloorplanGallery.tsx:333-337` (fallback colors)

## Acceptance Criteria

- [x] FloorplanGallery χρωματίζεται βάσει `overlay.resolvedStatus` (ΟΧΙ `overlay.status`)
- [x] Αλλαγή entity status → αλλαγή χρώματος **real-time χωρίς refresh** (via SPEC-258C onSnapshot)
- [x] Footprint overlays **δεν εμφανίζονται** στο Property Viewer (useFloorOverlays line 204-205)
- [x] Legacy overlays (με `overlay.status` χωρίς linked entity) λειτουργούν σωστά (resolvedStatus fallback)
- [x] Unlinked polygons εμφανίζονται γκρι (unavailable) — OVERLAY_FALLBACK + OVERLAY_OPACITY.MUTED
- [x] Hit-testing / hover / click λειτουργούν κανονικά (unchanged rendering logic)
- [x] Hover: PropertyHoverInfo panel δείχνει σωστό status badge (reads resolvedStatus)
- [x] Parking/Storage: χρωματίζονται βάσει δικού τους `commercialStatus` (SPEC-258C resolver)
- [x] ADR-237 changelog ενημερωμένο
- [x] ADR-258 status → IMPLEMENTED
- [x] Zero TypeScript errors

## Testing Checklist

### Visual Testing (browser)

1. Ανοιξε Property Viewer με κάτοψη που έχει linked overlays
2. Verify: χρώματα αντιστοιχούν στο `commercialStatus` κάθε μονάδας
3. Άλλαξε status μιας μονάδας (π.χ. for-sale → reserved) → verify χρώμα αλλάζει real-time
4. Verify: footprint overlays ΔΕΝ εμφανίζονται
5. Verify: unlinked polygons είναι γκρι
6. Hover πάνω σε polygon → verify PropertyHoverInfo δείχνει σωστό badge
7. Click σε polygon → verify navigation/action λειτουργεί

### Legacy Data Testing

1. Αν υπάρχουν παλιά overlays με `overlay.status` (πριν ADR-258) → verify εμφανίζονται με σωστό χρώμα
2. Αν υπάρχει overlay με `linked.unitId` αλλά deleted entity → verify γκρι (unavailable)

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-03-23 | Initial SPEC creation |
| 2026-03-23 | IMPLEMENTED: overlay.status→overlay.resolvedStatus (1 line), OVERLAY_OPACITY.GALLERY_HOVER + MUTED SSoT constants, footprint filter verified (useFloorOverlays:204) |
