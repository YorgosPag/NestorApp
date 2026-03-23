# SPEC-258A: StatusPalette Removal & Canvas Color Refactor

| Field | Value |
|-------|-------|
| **ADR** | ADR-258 (Twin Architecture — Dynamic Overlay Coloring) |
| **Phase** | 1 of 4 |
| **Priority** | CRITICAL — all other phases depend on this |
| **Status** | IMPLEMENTED (2026-03-23) |
| **Depends On** | — (no dependencies) |

---

## Objective

Αφαίρεση του χειροκίνητου χρωματισμού (StatusPalette) από το DXF Viewer, deprecation του `overlay.status`, και δημιουργία της υποδομής χρωμάτων (constants, mapping function) που χρειάζονται οι επόμενες φάσεις.

## Current State

- `StatusPalette.tsx` εμφανίζει 8 χρωματιστά κουμπιά στο toolbar (for-sale, for-rent, reserved, sold, landowner)
- `OverlayToolbarSection.tsx` περιλαμβάνει `<StatusPalette>` component
- `overlay.status` αποθηκεύεται στο Firestore κατά τη σχεδίαση (`overlay-store.tsx:136`)
- Default status: `'for-sale'` (hardcoded κατά τη δημιουργία overlay)
- `PropertyStatus` type δεν περιλαμβάνει `'for-sale-and-rent'`
- `STATUS_COLORS_MAPPING` δεν έχει entry για `'for-sale-and-rent'`
- Opacity τιμές hardcoded (0.5, 0.375) — δεν υπάρχει `OVERLAY_OPACITY` constant
- Δεν υπάρχει `commercialToPropertyStatus()` mapping function

## Target State

- `StatusPalette` αφαιρημένο από toolbar, component marked `@deprecated`
- `overlay.status` marked `@deprecated` στο types — δεν αποθηκεύεται σε νέα overlays
- Overlay creation χωρίς default status
- Canvas rendering: unlinked polygons=λευκό, linked=χρώμα βάσει entity status (20% fill opacity)
- `PropertyStatus` περιλαμβάνει `'for-sale-and-rent'` (Teal #14b8a6)
- `OVERLAY_OPACITY` SSoT constants (DXF_FILL=0.2, GALLERY_FILL=0.5, GALLERY_HOVER=0.7, MUTED=0.375)
- `commercialToPropertyStatus()` κεντρική mapping function

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/subapps/dxf-viewer/ui/toolbar/overlay-section/OverlayToolbarSection.tsx` | MODIFY | Αφαίρεση `<StatusPalette>` component |
| `src/subapps/dxf-viewer/ui/toolbar/overlay-section/StatusPalette.tsx` | MODIFY | `@deprecated` comment στο component |
| `src/subapps/dxf-viewer/overlays/types.ts` | MODIFY | Mark `status` ως `@deprecated`, update `DEFAULT_STATUS` |
| `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | MODIFY | Αφαίρεση `status: overlayData.status \|\| 'for-sale'` |
| `src/constants/property-statuses-enterprise.ts` | MODIFY | Προσθήκη `'for-sale-and-rent'` στο `PropertyStatus` type |
| `src/subapps/dxf-viewer/config/color-mapping.ts` | MODIFY | Entry `for-sale-and-rent` + `commercialToPropertyStatus()` function |
| `src/subapps/dxf-viewer/config/color-config.ts` | MODIFY | Προσθήκη `OVERLAY_OPACITY` constants + TEAL color |

## Implementation Steps

### Step 1: Extend PropertyStatus type

Στο `src/constants/property-statuses-enterprise.ts`, προσθήκη `'for-sale-and-rent'`:

```typescript
export type PropertyStatus =
  | 'for-sale'
  | 'for-rent'
  | 'for-sale-and-rent'   // NEW (ADR-258) — Teal #14b8a6
  | 'reserved'
  | 'sold'
  | 'landowner'
  | 'rented'
  | 'under-negotiation'
  | 'coming-soon'
  | 'off-market'
  | 'unavailable';
```

### Step 2: Add TEAL color + OVERLAY_OPACITY constants

Στο `src/subapps/dxf-viewer/config/color-config.ts`:

```typescript
// Στο UI_COLORS_BASE:
TEAL: '#14b8a6',           // 🩵 for-sale-and-rent (ADR-258)

// Νέο export:
/** SSoT overlay opacity per rendering context (ADR-258) */
export const OVERLAY_OPACITY = {
  /** DXF Viewer: αχνό fill — δεν κρύβει αρχιτεκτονικές γραμμές */
  DXF_FILL: 0.2,
  /** FloorplanGallery: έντονο fill — εμπορική κατάσταση κυριαρχεί */
  GALLERY_FILL: 0.5,
  /** FloorplanGallery: hover state */
  GALLERY_HOVER: 0.7,
  /** Unavailable / off-market / muted */
  MUTED: 0.375,
} as const;
```

### Step 3: Extend STATUS_COLORS_MAPPING + commercialToPropertyStatus()

Στο `src/subapps/dxf-viewer/config/color-mapping.ts`:

```typescript
// Στο STATUS_COLORS_MAPPING:
'for-sale-and-rent': { stroke: UI_COLORS.TEAL, fill: withOpacity(UI_COLORS.TEAL, 0.5) },

// Νέα function:
import type { CommercialStatus } from '@/types/unit';
import type { SpaceCommercialStatus } from '@/types/sales-shared';

/**
 * Κεντρική mapping: CommercialStatus/SpaceCommercialStatus → PropertyStatus (ADR-258)
 * Parking/Storage δεν έχουν for-rent/for-sale-and-rent/rented — αυτό είναι business logic, ΟΧΙ bug.
 */
export function commercialToPropertyStatus(
  status: CommercialStatus | SpaceCommercialStatus | undefined
): PropertyStatus {
  if (!status) return 'unavailable';

  const mapping: Record<string, PropertyStatus> = {
    'for-sale': 'for-sale',
    'for-rent': 'for-rent',
    'for-sale-and-rent': 'for-sale-and-rent',
    'reserved': 'reserved',
    'sold': 'sold',
    'rented': 'rented',
    'unavailable': 'unavailable',
  };

  return mapping[status] ?? 'unavailable';
}
```

### Step 4: Αφαίρεση StatusPalette από toolbar

Στο `OverlayToolbarSection.tsx`:
- Αφαίρεση import `StatusPalette`
- Αφαίρεση `<StatusPalette currentStatus={...} onStatusChange={...} />`
- Αφαίρεση σχετικού state (`currentStatus`, `setCurrentStatus`) αν δεν χρησιμοποιείται αλλού

### Step 5: Deprecation σε StatusPalette.tsx

Προσθήκη JSDoc comment:

```typescript
/**
 * @deprecated ADR-258: StatusPalette αφαιρέθηκε — ο χρωματισμός γίνεται δυναμικά
 * βάσει entity.commercialStatus. Δεν χρησιμοποιείται πλέον στο toolbar.
 * Διατηρείται για backward compatibility reference.
 */
```

### Step 6: Mark overlay.status ως deprecated

Στο `overlays/types.ts`:

```typescript
interface Overlay {
  // ...
  /** @deprecated ADR-258: Χρησιμοποίησε linked entity → commercialStatus αντί αυτού */
  status?: Status;
  // ...
}
```

### Step 7: Αφαίρεση default status κατά τη δημιουργία

Στο `overlay-store.tsx`:
- Γραμμή `status: overlayData.status || 'for-sale'` → αφαίρεση ή `status: overlayData.status ?? undefined`
- Νέα overlays δημιουργούνται **χωρίς status** — θα χρωματίζονται δυναμικά

### Step 8: Canvas rendering — dynamic color

Στο DXF Viewer canvas rendering (LayerRenderer ή σχετικό):
- Unlinked polygon: `stroke: #FFFFFF`, `fill: rgba(255,255,255,0.05)`
- Linked polygon: `stroke: statusColor (100%)`, `fill: statusColor (OVERLAY_OPACITY.DXF_FILL = 20%)`
- Selected polygon: `stroke: #00BFFF (cyan)`

## Existing Functions to Reuse

- `getStatusColors(status)` — `color-mapping.ts` (SSoT color lookup)
- `withOpacity(color, opacity)` — `color-config.ts:257-276` (hex → hex+alpha)
- `UI_COLORS` — `color-config.ts` (base color constants)
- `STATUS_COLORS_MAPPING` — `color-mapping.ts` (extend, don't replace)
- `OVERLAY_STATUS_KEYS` — `types.ts` (deprecate alongside StatusPalette)

## Acceptance Criteria

- [ ] StatusPalette **δεν εμφανίζεται** στο DXF Viewer toolbar
- [ ] KindSelector (unit/parking/storage/footprint) λειτουργεί κανονικά
- [ ] Νέα overlays δημιουργούνται **χωρίς status** field
- [ ] Legacy overlays με `overlay.status` δεν σπάνε (backward compat)
- [ ] `PropertyStatus` type περιλαμβάνει `'for-sale-and-rent'`
- [ ] `STATUS_COLORS_MAPPING` έχει entry για `'for-sale-and-rent'` (Teal #14b8a6)
- [ ] `OVERLAY_OPACITY` constants υπάρχουν (DXF_FILL=0.2, GALLERY_FILL=0.5, GALLERY_HOVER=0.7, MUTED=0.375)
- [ ] `commercialToPropertyStatus()` function υπάρχει και χειρίζεται CommercialStatus + SpaceCommercialStatus
- [ ] Canvas: unlinked polygons εμφανίζονται λευκά
- [ ] Canvas: linked polygons εμφανίζονται με χρώμα (20% fill opacity)
- [ ] Zero TypeScript errors στα αλλαγμένα αρχεία
- [ ] Save/Cancel/Delete/Duplicate overlay λειτουργούν κανονικά

---

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-03-23 | Initial SPEC creation |
| 2026-03-23 | IMPLEMENTED: 9 files modified — StatusPalette removed, overlay.status deprecated, for-sale-and-rent added, OVERLAY_OPACITY + commercialToPropertyStatus() created, canvas rendering dynamic (linked=color 20%, unlinked=white) |
