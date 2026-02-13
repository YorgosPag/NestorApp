# ADR-066: Rendering Z-Index Centralization

## Status
✅ **IMPLEMENTED** (2026-02-01)

## Context

Τα rendering z-index values ήταν **διάσπαρτα και ασυνεπή** σε 10+ αρχεία με διαφορετικές τιμές για τα ίδια components:

| Component | Types File | CanvasSettings | Διαφορά |
|-----------|-----------|----------------|---------|
| Grid | 100 | 1 | ❌ 99x |
| Ruler | 200 | 100 | ❌ 2x |
| Cursor | 900 | 1001 | ❌ Different |
| Snap | 950 | 900 | ❌ 50 |
| Crosshair | 1000 | 1000 | ✅ Same |
| Origin | 1000 | - | - |

### Προβλήματα

1. **Inconsistency**: Διαφορετικές τιμές για το ίδιο component
2. **Maintenance**: Αλλαγή απαιτούσε ενημέρωση πολλαπλών αρχείων
3. **Documentation**: Καμία κεντρική τεκμηρίωση της hierarchy

## Decision

Δημιουργήσαμε **`RENDERING_ZINDEX`** στο `config/tolerance-config.ts` ως single source of truth:

```typescript
export const RENDERING_ZINDEX = {
  /** Grid - background layer, rendered first */
  GRID: 10,
  /** Rulers - above grid, structure layer */
  RULER: 100,
  /** Entities - main content layer */
  ENTITIES: 200,
  /** Selection marquee and grips */
  SELECTION: 300,
  /** Cursor indicator */
  CURSOR: 800,
  /** Snap indicators - high visibility */
  SNAP: 900,
  /** Crosshair - top interactive layer */
  CROSSHAIR: 950,
  /** Origin markers - debug/reference */
  ORIGIN: 1000,
} as const;
```

### Hierarchy Design

```
0-99:    Background layers (grid)
100-199: Structure layers (rulers)
200-299: Content layers (entities)
300-399: Selection layers (marquee, grips)
800-899: Interactive layers (cursor)
900-949: Feedback layers (snap)
950-999: Overlay layers (crosshair)
1000+:   Debug layers (origin markers)
```

## Consequences

### Θετικά
- ✅ **Single Source of Truth**: Όλα τα z-index values σε ένα σημείο
- ✅ **Consistency**: Ίδιες τιμές σε όλα τα αρχεία
- ✅ **Type Safety**: `as const` για TypeScript autocomplete
- ✅ **Documentation**: Inline comments εξηγούν κάθε layer

### Αλλαγές
- Grid: 100 → 10 (rendered first)
- Cursor: 900/1001 → 800 (below snap indicators)
- Crosshair: 1000 → 950 (below origin markers)

## Files Changed

| Αρχείο | Αλλαγή |
|--------|--------|
| `config/tolerance-config.ts` | +1 section (RENDERING_ZINDEX) |
| `rendering/ui/grid/GridTypes.ts` | zIndex: RENDERING_ZINDEX.GRID |
| `rendering/ui/ruler/RulerTypes.ts` | zIndex: RENDERING_ZINDEX.RULER |
| `rendering/ui/cursor/CursorTypes.ts` | zIndex: RENDERING_ZINDEX.CURSOR |
| `rendering/ui/snap/SnapTypes.ts` | zIndex: RENDERING_ZINDEX.SNAP |
| `rendering/ui/crosshair/CrosshairTypes.ts` | zIndex: RENDERING_ZINDEX.CROSSHAIR |
| `rendering/ui/origin/OriginMarkersTypes.ts` | zIndex: RENDERING_ZINDEX.ORIGIN |
| `rendering/ui/grid/LegacyGridAdapter.ts` | zIndex: RENDERING_ZINDEX.GRID |
| `rendering/ui/cursor/LegacyCursorAdapter.ts` | zIndex: RENDERING_ZINDEX.CURSOR |
| `rendering/ui/snap/LegacySnapAdapter.ts` | zIndex: RENDERING_ZINDEX.SNAP |
| `rendering/canvas/core/CanvasSettings.ts` | All 5 zIndex values centralized |

## Usage

```typescript
import { RENDERING_ZINDEX } from '../config/tolerance-config';

// In defaults
const DEFAULT_GRID_SETTINGS: GridSettings = {
  // ...
  zIndex: RENDERING_ZINDEX.GRID  // 10
};

// In adapters
const flatSettings: GridSettings = {
  // ...
  zIndex: RENDERING_ZINDEX.GRID  // 10
};
```

## Important Note

⚠️ **Αυτά είναι internal rendering priorities, ΟΧΙ CSS z-index!**

Για CSS z-index χρησιμοποίησε: `styles/DxfZIndexSystem.styles.ts`

## 🔒 SELECTION Layer — Window/Crossing Marquee (2026-02-13)

> **⚠️ ΜΗΝ ΤΡΟΠΟΠΟΙΗΘΕΙ**: Το SELECTION layer (z-index 300) χρησιμοποιείται για το AutoCAD-style
> Window/Crossing marquee selection, το οποίο λειτουργεί **ΠΛΗΡΩΣ ΣΩΣΤΑ** (2026-02-13).
> Η marquee rendering γίνεται ως step 4 μέσα στο RAF loop του DxfCanvas (μετά scene → grid → rulers → **selection box**).
> Η αλλαγή z-index ή rendering order μπορεί να κάνει το selection box invisible.

## Related ADRs

- **ADR-002**: Enterprise Z-Index Hierarchy (CSS z-index)
- **ADR-134**: Centralized Opacity Constants
- **ADR-004**: Canvas Theme System
- **ADR-035**: Tool Overlay Mode Metadata (Window/Crossing changelog)

## References

- Location: `src/subapps/dxf-viewer/config/tolerance-config.ts`
- Section: `RENDERING_ZINDEX`
