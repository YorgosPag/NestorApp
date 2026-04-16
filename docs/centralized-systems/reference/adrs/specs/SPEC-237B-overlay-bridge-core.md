# SPEC-237B: Overlay Bridge Core — Read-Only Hook + Canvas Rendering

| Field | Value |
|-------|-------|
| **ADR** | ADR-237 |
| **Phase** | B — Overlay Bridge Core (Φάση 2 + 3) |
| **Priority** | HIGH |
| **Status** | IMPLEMENTED |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | SPEC-237A (Level-to-Floor mapping) |
| **Dependencies** | SPEC-237C εξαρτάται από αυτό |

---

## 1. Objective

Υλοποίηση του **πυρήνα του Bridge** — ένα read-only hook που φορτώνει overlays από Firestore βάσει `floorId`, και ένα Canvas rendering layer που σχεδιάζει τα polygon overlays πάνω σε κάθε τύπο κάτοψης (DXF, PDF, εικόνα) με δυναμικά χρώματα βάσει `commercialStatus`.

**Αρχιτεκτονική Αρχή**: Τα `dxf_overlay_levels` παραμένουν **SSoT** (Single Source of Truth). Ο bridge **μόνο διαβάζει** — zero writes.

---

## 2. Τρέχουσα Κατάσταση Κώδικα (Source of Truth)

### 2.1 DXF Overlay Store — onSnapshot Pattern

**Αρχείο**: `src/subapps/dxf-viewer/overlays/overlay-store.tsx` (γρ. 61-110)

```typescript
// Existing real-time subscription pattern
const collectionRef = collection(db, `dxf_overlay_levels/${levelId}/items`);
const q = query(collectionRef, orderBy('createdAt', 'asc'));

const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Normalize polygon format: {x,y}[] → [x,y][] → [x,y][]
    // 3 formats supported: {x,y} objects, flat [x1,y1,...], nested [[x,y],...]
  });
});
```

**REUSE αυτό το pattern** — η νέα hook χρησιμοποιεί ίδιο Firestore collection, ίδιο onSnapshot, αλλά read-only.

### 2.2 Overlay Interface

**Αρχείο**: `src/subapps/dxf-viewer/overlays/types.ts` (γρ. 27-43)

```typescript
interface Overlay {
  id: string;
  levelId: string;
  kind: OverlayKind;       // 'unit' | 'parking' | 'storage' | 'footprint'
  polygon: Array<[number, number]>;  // world coords [x, y]
  status?: PropertyStatus;
  label?: string;
  linked?: {
    unitId?: string;
    parkingId?: string;
    storageId?: string;
  };
  style?: OverlayStyle;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
```

### 2.3 Color System — STATUS_COLORS_MAPPING

**Αρχείο**: `src/subapps/dxf-viewer/config/color-mapping.ts`

```typescript
// Κεντρικοποιημένος mapper: PropertyStatus → { stroke, fill }
export const STATUS_COLORS_MAPPING: Record<PropertyStatus, { stroke: string; fill: string }> = {
  'for-sale':           { stroke: UI_COLORS.SUCCESS,      fill: withOpacity(UI_COLORS.SUCCESS, 0.5) },
  'for-rent':           { stroke: UI_COLORS.INFO,         fill: withOpacity(UI_COLORS.INFO, 0.5) },
  'reserved':           { stroke: UI_COLORS.WARNING,      fill: withOpacity(UI_COLORS.WARNING, 0.5) },
  'sold':               { stroke: UI_COLORS.ERROR,        fill: withOpacity(UI_COLORS.ERROR, 0.5) },
  'rented':             { stroke: UI_COLORS.DARK_RED,     fill: withOpacity(UI_COLORS.DARK_RED, 0.5) },
  'unavailable':        { stroke: UI_COLORS.DARK_GRAY,    fill: withOpacity(UI_COLORS.DARK_GRAY, 0.375) },
  // ... 10 statuses total
};

// Helper: any status → colors (ελληνικά ή αγγλικά)
export function getStatusColors(status: string): { stroke: string; fill: string } | null;
```

**REUSE `getStatusColors()`** — μην δημιουργήσεις νέο color mapping.

### 2.4 Opacity System

**Αρχείο**: `src/subapps/dxf-viewer/config/color-config.ts` (γρ. 242-254)

```typescript
export const OPACITY = {
  OPAQUE: 1.0,
  VERY_HIGH: 0.95,
  HIGH: 0.9,
  MEDIUM: 0.8,
  MEDIUM_LOW: 0.7,     // ← Regions, secondary elements
  SUBTLE: 0.6,
  LOW: 0.5,            // ← PDF backgrounds
  VERY_LOW: 0.3,
  FAINT: 0.1,
};
```

### 2.5 withOpacity Utility

**Αρχείο**: `src/subapps/dxf-viewer/config/color-config.ts` (γρ. 256-276)

```typescript
export const withOpacity = (color: string, opacity: number): string => {
  // Handles: #hex → #hexAA, rgb() → rgba(), rgba() → updated alpha
};
```

**REUSE** — μην δημιουργήσεις νέα opacity utility.

### 2.6 overlaysToRegions Adapter

**Αρχείο**: `src/subapps/dxf-viewer/overlays/overlay-adapter.ts` (γρ. 8-54)

```typescript
export function overlaysToRegions(overlays: Overlay[]): Region[] {
  // Converts Overlay[] → Region[] for canvas rendering
  // Handles 3 polygon formats: {x,y}[], flat[], nested[]
  // Uses getStatusColors() for color resolution
  // Default opacity: 0.7
}
```

**REUSE αυτή τη λογική** για polygon format normalization. Δεν χρειάζεται νέος converter.

### 2.7 FloorplanGallery — Canvas Rendering Target

**Αρχείο**: `src/components/shared/files/media/FloorplanGallery.tsx` (980 γραμμές)

| Τύπος Κάτοψης | Rendering | Γραμμές |
|---------------|-----------|---------|
| DXF | Canvas 2D — `renderDxfToCanvas()` | 157-308 |
| PDF | `<iframe>` | 778 |
| Εικόνα (JPG/PNG) | `<img>` with zoom/pan | 787 |

### 2.8 useZoomPan Hook

**Αρχείο**: `src/hooks/useZoomPan.ts`

```typescript
interface ZoomPanConfig {
  minZoom?: number;     // default: 0.25
  maxZoom?: number;     // default: 4
  zoomStep?: number;    // default: 0.25
  defaultZoom?: number; // default: 1
  wheelSensitivity?: number; // default: 0.001
}
```

**Features**: Mouse wheel zoom, drag pan, touch pinch-to-zoom, button controls.
**REUSE** — overlay canvas πρέπει να συγχρονίζεται με το zoom/pan state.

---

## 3. Task A: `useFloorOverlays` Hook (Read-Only)

### Proposed API

```typescript
interface UseFloorOverlaysParams {
  /** Floor ID — from Level.floorId (SPEC-237A) */
  floorId: string | null;
}

interface FloorOverlayItem {
  id: string;
  polygon: Array<{ x: number; y: number }>;  // Firestore native format
  kind: OverlayKind;
  status?: PropertyStatus;
  label?: string;
  linked?: {
    unitId?: string;
    parkingId?: string;
    storageId?: string;
  };
  levelId: string;
}

function useFloorOverlays(params: UseFloorOverlaysParams): {
  overlays: ReadonlyArray<FloorOverlayItem>;
  loading: boolean;
  error: string | null;
}
```

### Data Flow

```
floorId
  → Query: Level documents where floorId === targetFloorId
  → Για κάθε matching level:
      → onSnapshot: dxf_overlay_levels/{levelId}/items
      → Filter: μόνο overlays με linked.unitId (skip footprints)
  → Merge & return: ReadonlyArray<FloorOverlayItem>
```

### Query Strategy

**2-Step Query** (Firestore limitation — no joins):

1. **Step 1**: Βρες levels με `floorId === targetFloorId`
   ```
   dxf_viewer_levels where floorId == "floor_xyz"
   → Returns: [level_abc, level_def]
   ```

2. **Step 2**: Subscribe σε overlays κάθε level
   ```
   dxf_overlay_levels/level_abc/items → onSnapshot
   dxf_overlay_levels/level_def/items → onSnapshot
   ```

### Polygon Format

**Firestore Format**: `Array<{x: number, y: number}>` (objects)

Ο bridge **δεν μετατρέπει** — τα objects `{x, y}` είναι ήδη compatible με:
- Property Viewer vertex format: `{x, y}`
- Canvas `lineTo(vertex.x, vertex.y)` — direct access

> **ΣΗΜΑΝΤΙΚΟ**: Η overlay-store.tsx μετατρέπει `{x,y}` → `[x,y]` (tuples) για internal DXF use. Ο bridge **ΔΕΝ** κάνει αυτή τη μετατροπή — κρατάει objects.

### Filter Logic

```typescript
// Skip footprints — δεν χρειάζεται rendering στη δημόσια σελίδα
overlays.filter(ov => ov.kind !== 'footprint')
```

---

## 4. Task B: Canvas Overlay Rendering Layer

### Rendering Strategy ανά Τύπο Κάτοψης

| Τύπος | Base Rendering | Overlay Strategy |
|-------|---------------|-----------------|
| **DXF** | Canvas 2D (`renderDxfToCanvas()`) | Overlay drawing **πάνω στο ίδιο Canvas** μετά το DXF rendering |
| **PDF** | `<iframe>` | Transparent **Canvas overlay** (absolute positioned) πάνω από iframe |
| **Εικόνα** | `<img>` with zoom/pan | Transparent **Canvas overlay** (absolute positioned) πάνω από img |

### DXF Overlay Rendering (Same Canvas)

```
renderDxfToCanvas()     ← Existing: σχεδιάζει entities
  ↓
drawOverlayPolygons()   ← NEW: σχεδιάζει overlays
  ↓
Canvas complete
```

**Canvas API Pattern**:
```typescript
// Pseudocode — NOT actual implementation
ctx.save();
for (const overlay of overlays) {
  const colors = getStatusColors(overlay.status ?? 'unavailable');
  ctx.fillStyle = colors?.fill ?? withOpacity(UI_COLORS.DARK_GRAY, 0.375);
  ctx.strokeStyle = colors?.stroke ?? UI_COLORS.DARK_GRAY;
  ctx.lineWidth = 2;

  ctx.beginPath();
  overlay.polygon.forEach((vertex, i) => {
    if (i === 0) ctx.moveTo(vertex.x, vertex.y);
    else ctx.lineTo(vertex.x, vertex.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
ctx.restore();
```

### PDF/Image Overlay Rendering (Separate Canvas)

```html
<div style="position: relative">
  <!-- Base content -->
  <iframe src="..." />  <!-- PDF -->
  <!-- OR -->
  <img src="..." />     <!-- Image -->

  <!-- Overlay Canvas (absolute, same dimensions) -->
  <canvas
    style="position: absolute; top: 0; left: 0; pointer-events: none"
    width={containerWidth}
    height={containerHeight}
  />
</div>
```

**Zoom/Pan Sync**: Το overlay canvas πρέπει να εφαρμόζει **ίδιο transform** με το base content:
- Χρήση `useZoomPan` hook — ίδιο zoom level + pan offset
- Canvas transform: `ctx.setTransform(zoom, 0, 0, zoom, panX, panY)`

### Color Mapping — commercialStatus → Χρώμα

**REUSE `getStatusColors()`** από `color-mapping.ts`:

| commercialStatus | Χρώμα Stroke | Χρώμα Fill (0.5 opacity) |
|-----------------|-------------|------------------------|
| `for-sale` | 🟢 SUCCESS (πράσινο) | 🟢 SUCCESS @ 50% |
| `for-rent` | 🔵 INFO (μπλε) | 🔵 INFO @ 50% |
| `for-sale-and-rent` | 🟣 LIGHT_PURPLE | 🟣 LIGHT_PURPLE @ 50% |
| `reserved` | 🟡 WARNING (κίτρινο) | 🟡 WARNING @ 50% |
| `sold` | 🔴 ERROR (κόκκινο) | 🔴 ERROR @ 50% |
| `rented` | 🔴 DARK_RED | 🔴 DARK_RED @ 50% |
| `unavailable` | ⚫ DARK_GRAY | ⚫ DARK_GRAY @ 37.5% |

**Χρώμα resolution**: `overlay.status` (αν υπάρχει) → `getStatusColors()`. Αν δεν υπάρχει status: `overlay.linked.unitId` → fetch unit → `unit.commercialStatus` → `getStatusColors()`.

### Overlay Opacity

**REUSE `OPACITY` constants** από `color-config.ts`:

| Σενάριο | Opacity Value | Constant |
|---------|-------------|----------|
| Normal polygon fill | 0.5 | `OPACITY.LOW` |
| Hovered polygon fill | 0.7 | `OPACITY.MEDIUM_LOW` |
| Unavailable polygon | 0.375 | Custom (ήδη στο STATUS_COLORS_MAPPING) |
| Polygon stroke | 1.0 | `OPACITY.OPAQUE` |

---

## 5. Κεντρικοποιημένα Συστήματα (REUSE ONLY)

| Σύστημα | Αρχείο | Χρήση στο SPEC-237B |
|---------|--------|---------------------|
| `getStatusColors()` | `src/subapps/dxf-viewer/config/color-mapping.ts` | Status → color resolution |
| `STATUS_COLORS_MAPPING` | `src/subapps/dxf-viewer/config/color-mapping.ts` | Full status-to-color map |
| `withOpacity()` | `src/subapps/dxf-viewer/config/color-config.ts` (γρ. 256-276) | Dynamic opacity on colors |
| `OPACITY` constants | `src/subapps/dxf-viewer/config/color-config.ts` (γρ. 242-254) | Centralized opacity values |
| `overlaysToRegions()` | `src/subapps/dxf-viewer/overlays/overlay-adapter.ts` (γρ. 8-54) | Polygon format normalization |
| `onSnapshot` pattern | `overlay-store.tsx` (γρ. 61-110) | Real-time Firestore subscription |
| `renderDxfToCanvas()` | `FloorplanGallery.tsx` (γρ. 157-308) | Existing DXF rendering — extend |
| `useZoomPan` hook | `src/hooks/useZoomPan.ts` | Zoom/pan state for overlay sync |

---

## 6. Prohibitions

- ⛔ **ΜΗΝ δημιουργήσεις** νέο Firestore collection — SSoT = `dxf_overlay_levels`
- ⛔ **ΜΗΝ γράψεις** στο `dxf_overlay_levels` από τη δημόσια σελίδα — read-only only
- ⛔ **ΜΗΝ δημιουργήσεις** νέο color mapping — χρησιμοποίησε `getStatusColors()`
- ⛔ **ΜΗΝ χρησιμοποιήσεις** SVG rendering — ήδη Canvas-based architecture
- ⛔ **ΜΗΝ αντιγράψεις** polygon vertices σε Unit documents
- ⛔ **ΜΗΝ δημιουργήσεις** νέα opacity utility — χρησιμοποίησε `withOpacity()`

---

## 7. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `useFloorOverlays(floorId)` επιστρέφει overlays real-time | Hook returns data, loading states |
| 2 | DXF κάτοψη εμφανίζει polygon overlays πάνω στο σχέδιο | Visual — colored polygons visible |
| 3 | PDF κάτοψη εμφανίζει polygon overlays | Visual — transparent canvas over iframe |
| 4 | Image κάτοψη εμφανίζει polygon overlays | Visual — transparent canvas over img |
| 5 | Χρώματα αντιστοιχούν στο `commercialStatus` | Visual — green=sale, blue=rent, red=sold |
| 6 | Zoom/Pan δουλεύει σωστά με overlays | Polygons ακολουθούν zoom+pan transforms |
| 7 | Footprint overlays φιλτράρονται (δεν εμφανίζονται) | No footprint polygons on public page |
| 8 | Real-time sync: αλλαγή στο DXF Viewer → εμφανίζεται | onSnapshot triggers re-render |

---

## 8. Σχετικά ADRs & SPECs

| Αναφορά | Σχέση |
|---------|-------|
| **ADR-237** | Parent ADR — Polygon Overlay Bridge |
| **SPEC-237A** | Prerequisite — Level-to-Floor mapping |
| **SPEC-237C** | Depends on this — Interactive overlays (hit-testing, hover) |
| **ADR-119** | Centralized Canvas globalAlpha Opacity Values |
| **ADR-134** | Extended Opacity Values |

---

## 9. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Firestore reads per page view | Cache overlays per session — δεν αλλάζουν συχνά |
| Many polygons (50+) | Batch rendering, skip off-screen polygons |
| Canvas re-renders on zoom/pan | `requestAnimationFrame` throttling |
| 2-step query (levels → overlays) | Parallel subscriptions, merge results |
| PDF/Image overlay alignment | Sync with `useZoomPan` transform state |

---

*SPEC Format based on: ADR-237 Polygon Overlay Bridge*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
