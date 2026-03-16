# SPEC-237C: Interactive Overlays — Hit-Testing, Hover, Click + Bidirectional Sync

| Field | Value |
|-------|-------|
| **ADR** | ADR-237 |
| **Phase** | C — Interactive Overlays (Φάση 4 + 5) |
| **Priority** | MEDIUM |
| **Status** | IMPLEMENTED |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | SPEC-237B (Overlay Bridge Core — canvas rendering) |
| **Dependencies** | None — τελευταίο SPEC στην αλυσίδα |

---

## 1. Objective

Μετατροπή των static polygon overlays σε **interactive elements** — hover preview στοιχείων ακινήτου, click για πλοήγηση, και bidirectional sync μεταξύ αριστερής λίστας ακινήτων και κάτοψης ορόφου.

**3 Interaction Layers**:
1. **Hit-Testing**: Εντοπισμός ποιο polygon βρίσκεται κάτω από τον κέρσορα
2. **Hover + Click**: Preview info + navigation σε available ακίνητα
3. **Bidirectional Sync**: Λίστα ↔ Κάτοψη αμφίδρομη σύνδεση

---

## 2. Τρέχουσα Κατάσταση Κώδικα (Source of Truth)

### 2.1 isPointInPolygon — ΥΠΑΡΧΕΙ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ

**Αρχείο**: `packages/core/polygon-system/utils/polygon-utils.ts` (γρ. 255-276)

```typescript
/**
 * Check if point is inside polygon (ray casting algorithm)
 */
export function isPointInPolygon(point: PolygonPoint, polygon: UniversalPolygon): boolean {
  if (!polygon.isClosed || polygon.points.length < 3) {
    return false;
  }

  const { x, y } = point;
  const points = polygon.points;
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}
```

**REUSE `isPointInPolygon()`** — enterprise ray-casting, O(n) per vertex count. **ΜΗΝ** δημιουργήσεις νέο point-in-polygon algorithm.

**Interface Requirements**:
```typescript
// polygon-utils.ts expects:
interface PolygonPoint { x: number; y: number; }
interface UniversalPolygon { points: PolygonPoint[]; isClosed: boolean; }
```

Τα overlay polygons (`Array<{x, y}>`) χρειάζονται wrapping σε `UniversalPolygon`:
```typescript
const universalPolygon: UniversalPolygon = {
  points: overlay.polygon,  // Already {x, y}[] from SPEC-237B
  isClosed: true,           // Overlays are always closed
};
```

### 2.2 useHoveredProperty Hook

**Αρχείο**: `src/features/property-hover/hooks/useHoveredProperty.ts` (10 γραμμές)

```typescript
export function useHoveredProperty(propertyId: string | null, properties: Property[]) {
  return React.useMemo(() => {
    if (!propertyId) return null;
    return properties.find(p => p.id === propertyId) || null;
  }, [propertyId, properties]);
}
```

**REUSE** — shared `hoveredUnitId` state μεταξύ canvas + list.

### 2.3 PropertyHoverInfo Component

**Αρχείο**: `src/components/property-viewer/PropertyHoverInfo.tsx` (118 γραμμές)

Ήδη ένα **πλήρες hover info panel** με:
- `PropertyHoverHeader` — όνομα + status badge
- `PropertyHoverLocation` — floor + building info
- `PropertyHoverPriceArea` — τιμή + εμβαδόν
- `PropertyHoverDescription` — σύντομη περιγραφή
- `PropertyHoverInstruction` — "click to view" hint
- i18n support (ελληνικά/αγγλικά)
- Semantic colors + spacing tokens

**REUSE** — αυτό το component εμφανίζεται στο hover info panel.

### 2.4 Property Viewer — Hit-Testing Gap

**Αρχεία**:
- `src/components/property-viewer/FloorPlanCanvas/PropertyPolygon.tsx` — SVG polygon rendering
- `src/components/property-viewer/FloorPlanCanvas/PropertyPolygonPath.tsx` — SVG path generation

**Τρέχον**: Hit-testing **ΔΕΝ ΥΠΑΡΧΕΙ** — τα SVG polygons δεν ανιχνεύουν mouse position.

---

## 3. Task A: Canvas Hit-Testing Engine

### Screen-to-World Coordinate Transform

**Πρόβλημα**: Ο mouse position είναι σε screen coords, αλλά τα polygon vertices είναι σε world coords (DXF space).

```
Mouse Position (screen)     Canvas Transform Matrix     World Position
   (clientX, clientY)    →    inverse(transform)    →    (worldX, worldY)
```

**Transform chain**:
1. `canvas.getBoundingClientRect()` → offset from viewport
2. `(clientX - rect.left, clientY - rect.top)` → canvas-local coords
3. Inverse of zoom + pan transform → world coords

### Hit-Test Flow (per mousemove)

```
1. Mouse position → screen coords
2. Screen coords → world coords (inverse transform)
3. For each overlay polygon:
   a. Wrap in UniversalPolygon { points, isClosed: true }
   b. isPointInPolygon(worldPoint, universalPolygon)
   c. If hit → return overlay
4. First hit wins (front-to-back order)
5. No hit → hoveredOverlay = null
```

### Performance Optimization

| Technique | Benefit |
|-----------|---------|
| **Bounding box pre-filter** | Skip polygons whose AABB doesn't contain mouse point |
| **Throttle mousemove** | `requestAnimationFrame` — max 1 hit-test per frame (60fps) |
| **Early exit** | Stop at first hit (overlays rarely overlap) |
| **Cached AABB** | Compute bounding boxes once, invalidate on overlay change |

### Bounding Box Pre-Filter

```typescript
// Pseudocode — computed once per overlay
interface AABB { minX: number; minY: number; maxX: number; maxY: number; }

function computeAABB(polygon: Array<{x: number; y: number}>): AABB {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function isInsideAABB(point: {x: number; y: number}, aabb: AABB): boolean {
  return point.x >= aabb.minX && point.x <= aabb.maxX
      && point.y >= aabb.minY && point.y <= aabb.maxY;
}
```

---

## 4. Task B: Hover Behavior

### Hover Info Panel — Position & Content

**Position**: Fixed, κάτω δεξιά στην οθόνη (δεν ακολουθεί τον κέρσορα)

**Πεδία** (Phase 1):

| Πεδίο | Παράδειγμα | Source |
|-------|-----------|--------|
| Όνομα μονάδας | A-DI-0.02 Διαμέρισμα 2 | `unit.name` |
| Τύπος | Διαμέρισμα / Μεζονέτα | `unit.unitType` |
| Εμβαδόν | 90 τ.μ. | `unit.area` |
| Τιμή | €150.000 / €800/μήνα | `unit.commercialData` |
| Εμπορική κατάσταση | Προς Πώληση | `unit.commercialStatus` |

### Data Resolution: Overlay → Unit

```
overlay.linked.unitId → Firestore query: units/{unitId}
  → unit.name, unit.unitType, unit.area, unit.commercialStatus, unit.commercialData
```

**Caching**: Unit data cached per session — δεν αλλάζει κατά τη χρήση.

### Hover Visual Feedback (Canvas)

| State | Fill Opacity | Stroke Width | Cursor |
|-------|-------------|-------------|--------|
| **Normal** | 0.5 (from SPEC-237B) | 2px | default |
| **Hovered (available)** | 0.7 (`OPACITY.MEDIUM_LOW`) | 3px | `pointer` |
| **Hovered (unavailable)** | 0.5 (unchanged) | 2px (unchanged) | `default` |

### Clickable vs Non-Clickable Status Map

| commercialStatus | Clickable | Cursor | Hover Info |
|-----------------|-----------|--------|-----------|
| `for-sale` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `for-rent` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `for-sale-and-rent` | ✅ Ναι | `pointer` | ✅ Πλήρη στοιχεία |
| `reserved` | ❌ Όχι | `default` | ⚠️ Μόνο "Κρατημένο" |
| `sold` | ❌ Όχι | `default` | ⚠️ Μόνο "Πωλημένο" |
| `rented` | ❌ Όχι | `default` | ⚠️ Μόνο "Ενοικιασμένο" |
| `unavailable` | ❌ Όχι | `default` | ⚠️ Μόνο "Μη Διαθέσιμο" |

### Available Status Set

```typescript
const CLICKABLE_STATUSES = new Set<PropertyStatus>([
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
]);

function isClickable(status: PropertyStatus): boolean {
  return CLICKABLE_STATUSES.has(status);
}
```

---

## 5. Task C: Click Navigation

### Click Handler

```
Canvas click event
  → Hit-test → overlay found?
    → overlay.status in CLICKABLE_STATUSES?
      → YES: router.push(`/properties?view=floorplan&selected=${overlay.linked.unitId}`)
      → NO: nothing (non-clickable status)
    → No overlay hit: nothing
```

**Route**: `/properties?view=floorplan&selected={unitId}`

Η πλοήγηση γίνεται στην **ίδια σελίδα** — μόνο αλλαγή `?selected=` query param. Αυτό φορτώνει τα πλήρη στοιχεία του ακινήτου στο δεξί panel.

---

## 6. Task D: Bidirectional Hover Sync

### Shared State

**REUSE `useHoveredProperty`** + νέο shared state:

```typescript
// Shared across PropertyList + FloorplanGallery
const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
```

### Direction A: Λίστα → Κάτοψη

```
PropertyListCard onMouseEnter → setHoveredUnitId(unit.id)
  → FloorplanGallery: finds overlay where linked.unitId === hoveredUnitId
  → Canvas re-render: highlighted polygon (brighter fill + thicker stroke)
  → HoverInfo panel updates
```

### Direction B: Κάτοψη → Λίστα

```
Canvas mousemove → hit-test → overlay found
  → setHoveredUnitId(overlay.linked.unitId)
  → PropertyList: finds card where unit.id === hoveredUnitId
  → Card highlight + scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  → HoverInfo panel updates
```

### Layout Context

```
┌──────────────┬────────────────────────────┬────────────────┐
│  ΑΡΙΣΤΕΡΑ    │         ΚΕΝΤΡΟ             │    ΔΕΞΙΑ       │
│  PropertyList│   FloorplanGallery         │  Details +     │
│  (360px)     │   (flex-grow)              │  HoverInfo     │
│              │                            │                │
│  hover card ──────→ highlight polygon     │  ┌──────────┐ │
│              │                            │  │ Hover    │ │
│ ◄──── hover polygon ◄────────────────────│  │ Info     │ │
│  highlight   │                            │  │ (κάτω    │ │
│  + scroll    │                            │  │  δεξιά)  │ │
│              │                            │  └──────────┘ │
└──────────────┴────────────────────────────┴────────────────┘
```

### Edge Cases

| Σενάριο | Συμπεριφορά |
|---------|-------------|
| Hover σε reserved/sold polygon → no card in list | HoverInfo panel ενημερώνεται, λίστα δεν αλλάζει |
| Hover σε card χωρίς polygon (δεν σχεδιάστηκε ακόμα) | Λίστα highlight, κάτοψη δεν αλλάζει |
| Mouse leaves canvas | `hoveredUnitId = null`, όλα reset |
| Mouse leaves list card | `hoveredUnitId = null`, όλα reset |
| Zoom σε πολύ μικρό polygon | Hit-test λειτουργεί κανονικά (world coords) |

---

## 7. Κεντρικοποιημένα Συστήματα (REUSE ONLY)

| Σύστημα | Αρχείο | Χρήση στο SPEC-237C |
|---------|--------|---------------------|
| `isPointInPolygon()` | `packages/core/polygon-system/utils/polygon-utils.ts` (γρ. 255-276) | Canvas hit-testing |
| `useHoveredProperty()` | `src/features/property-hover/hooks/useHoveredProperty.ts` | Shared hover state |
| `PropertyHoverInfo` | `src/components/property-viewer/PropertyHoverInfo.tsx` | Hover info panel UI |
| `PropertyHoverHeader` | `src/features/property-hover/components/PropertyHoverHeader.tsx` | Header sub-component |
| `PropertyHoverLocation` | `src/features/property-hover/components/PropertyHoverLocation.tsx` | Location sub-component |
| `PropertyHoverPriceArea` | `src/features/property-hover/components/PropertyHoverPriceArea.tsx` | Price+Area sub-component |
| `getPropertyStatusConfig()` | `src/features/property-hover/constants.ts` | Status → color+label config |
| `getStatusColors()` | `src/subapps/dxf-viewer/config/color-mapping.ts` | Highlight color resolution |
| `OPACITY` constants | `src/subapps/dxf-viewer/config/color-config.ts` (γρ. 242-254) | Hover opacity values |

---

## 8. Prohibitions

- ⛔ **ΜΗΝ δημιουργήσεις** νέο point-in-polygon algorithm — χρησιμοποίησε `isPointInPolygon()` από `polygon-utils.ts`
- ⛔ **ΜΗΝ δημιουργήσεις** νέο hover info component — χρησιμοποίησε `PropertyHoverInfo` + sub-components
- ⛔ **ΜΗΝ χρησιμοποιήσεις** inline styles για hover panel positioning — χρησιμοποίησε Tailwind utilities
- ⛔ **ΜΗΝ δημιουργήσεις** νέο color mapping — χρησιμοποίησε `getStatusColors()` + `getPropertyStatusConfig()`
- ⛔ **ΜΗΝ τροποποιήσεις** overlays κατά το hover/click — read-only access
- ⛔ **ΜΗΝ δημιουργήσεις** tooltip component — hover info εμφανίζεται σε fixed panel, ΟΧΙ σε tooltip

---

## 9. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Mouse hover πάνω σε polygon → hover info panel εμφανίζεται | Visual — κάτω δεξιά |
| 2 | Hover info δείχνει σωστά στοιχεία (όνομα, τύπος, τιμή, status) | Data accuracy |
| 3 | Click σε available polygon → `?selected=` αλλάζει | URL + details panel |
| 4 | Click σε unavailable polygon → τίποτα | No navigation |
| 5 | Cursor αλλάζει: `pointer` για available, `default` για unavailable | Visual |
| 6 | Hover σε list card → polygon highlight στην κάτοψη | Bidirectional sync A→B |
| 7 | Hover σε polygon → list card highlight + scroll into view | Bidirectional sync B→A |
| 8 | Reserved/sold polygon hover → info panel, αλλά ΟΧΙ list highlight | Correct behavior |
| 9 | Hit-testing ακριβές μετά zoom/pan | World coord transform correct |
| 10 | Performance: 60fps mousemove σε 50+ polygons | No frame drops |

---

## 10. Σχετικά ADRs & SPECs

| Αναφορά | Σχέση |
|---------|-------|
| **ADR-237** | Parent ADR — Polygon Overlay Bridge |
| **SPEC-237A** | Foundation — Level-to-Floor mapping |
| **SPEC-237B** | Prerequisite — Canvas overlay rendering |
| **ADR-236** | Multi-Level Property Management |

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Hit-testing accuracy σε complex polygons | LOW | `isPointInPolygon` ray-casting = industry standard |
| Performance σε πολλά polygons + mousemove | MEDIUM | AABB pre-filter + rAF throttling |
| Unit data fetching latency (hover delay) | LOW | Cache unit data per session |
| Bidirectional sync infinite loop | LOW | Compare `hoveredUnitId` before setState |
| PDF/Image coordinate mismatch | MEDIUM | Validate transform matrix against useZoomPan |

---

---

## 12. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-16 | IMPLEMENTED — Full Phase A (canvas hit-testing/hover/click) + Phase B (bidirectional sync) | Claude |

### Implementation Summary (2026-03-16)

**Files Modified (9)**:
1. `FloorplanGallery.tsx` — +3 props, screenToWorld(), AABB cache, hitTestOverlays() using centralized `isPointInPolygon`, rAF-throttled mouse handlers, highlight rendering
2. `ListCard.types.ts` — +onMouseLeave, +isHovered props
3. `ListCard.tsx` — Destructure new props, ring-2 highlight class, onMouseLeave handler
4. `PropertyListCard.tsx` — +isHovered, +onMouseEnter, +onMouseLeave pass-through
5. `PropertyList.tsx` — +hoveredPropertyId, +onHoverProperty, per-card wiring, auto-scroll via data-property-id
6. `ReadOnlyMediaViewer.tsx` — +3 overlay interaction props, pass to FloorplanGallery + FloorFloorplanTabContent
7. `ListLayout.tsx` — +onHoverProperty, wire PropertyList + ReadOnlyMediaViewer bidirectionally
8. `ReadOnlyPropertyViewerLayout.tsx` — Destructure + pass onHoverProperty to ListLayout
9. `types.ts` — +onHoverProperty to ReadOnlyPropertyViewerLayoutProps

**Centralized Systems Reused**: `isPointInPolygon()`, `getStatusColors()`, `withOpacity()`, `PropertyHoverInfo`, `hoveredPropertyId` state

---

*SPEC Format based on: ADR-237 Polygon Overlay Bridge*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
