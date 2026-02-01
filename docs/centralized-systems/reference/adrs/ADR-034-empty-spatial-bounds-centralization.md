# ADR-034: EMPTY_SPATIAL_BOUNDS Consolidation

## Status
**✅ IMPLEMENTED** | Date: 2026-02-01

## Category
**Data & State** / **Canvas & Rendering**

## Context

Στο codebase υπήρχαν **9 διάσπαρτα inline instances** του pattern `{ minX: 0, minY: 0, maxX: 0, maxY: 0 }` που χρησιμοποιούνταν ως fallback για empty bounds.

### Existing Pattern (BoundingBox format)

Υπήρχε ήδη το `EMPTY_BOUNDS` στο `geometry-constants.ts`:

```typescript
export const EMPTY_BOUNDS: Readonly<BoundingBox> = Object.freeze({
  min: Object.freeze({ x: 0, y: 0 }),
  max: Object.freeze({ x: 0, y: 0 })
});
```

Αυτό χρησιμοποιεί το format `{ min: Point2D, max: Point2D }`.

### Problem: Διαφορετικό Format

Τα 9 inline instances χρησιμοποιούσαν το **SpatialBounds** format:
- `{ minX: number, minY: number, maxX: number, maxY: number }`

Αυτό το format χρησιμοποιείται από:
- `SpatialIndex` system
- `getEntityBounds()` function
- Entity query operations

### Scattered Code Locations (Before)

| Αρχείο | Γραμμή | Context |
|--------|--------|---------|
| `core/spatial/SpatialUtils.ts` | 25 | `boundsFromPoints()` empty array fallback |
| `systems/selection/shared/selection-duplicate-utils.ts` | 28 | `calculateBoundingBox()` empty array fallback |
| `types/entities.ts` | 429 | `getEntityBounds()` polyline no vertices |
| `types/entities.ts` | 491 | `getEntityBounds()` spline no controlPoints |
| `types/entities.ts` | 503 | `getEntityBounds()` leader no vertices |
| `types/entities.ts` | 518 | `getEntityBounds()` hatch no boundaryPaths |
| `types/entities.ts` | 531 | `getEntityBounds()` xline no basePoint |
| `types/entities.ts` | 545 | `getEntityBounds()` ray no basePoint |
| `types/entities.ts` | 560 | `getEntityBounds()` default case |

## Decision

Δημιουργία νέου centralized constant `EMPTY_SPATIAL_BOUNDS` στο `config/geometry-constants.ts` για το SpatialBounds format.

```typescript
/**
 * 📦 EMPTY_SPATIAL_BOUNDS - Zero-size spatial bounds (SpatialBounds format)
 *
 * Use for:
 * - Empty entity lists (getEntityBounds fallback)
 * - Spatial index empty results
 * - calculateBoundingBox empty array
 * - boundsFromPoints empty array fallback
 *
 * 🏢 ADR-034: Centralized empty bounds for SpatialBounds format
 */
export const EMPTY_SPATIAL_BOUNDS: Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}> = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0
});
```

## Implementation

### Files Updated

| Αρχείο | Αλλαγές |
|--------|---------|
| `config/geometry-constants.ts` | +30 lines - Added `EMPTY_SPATIAL_BOUNDS` constant |
| `types/entities.ts` | +1 import, 7x replace inline → constant |
| `core/spatial/SpatialUtils.ts` | +1 import, 1x replace inline → constant |
| `systems/selection/shared/selection-duplicate-utils.ts` | +1 import, 1x replace inline → constant |

### Before vs After

**Before:**
```typescript
// In entities.ts
if (!entity.vertices) {
  return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}
```

**After:**
```typescript
// In entities.ts
import { EMPTY_SPATIAL_BOUNDS } from '../config/geometry-constants';

if (!entity.vertices) {
  // 🏢 ADR-034: Centralized Empty Spatial Bounds
  return EMPTY_SPATIAL_BOUNDS;
}
```

## Consequences

### Benefits

1. **Single Source of Truth**: 9 inline instances → 1 centralized constant
2. **Consistency**: Consistent empty bounds handling across the codebase
3. **Maintainability**: Single point of change if default behavior needs modification
4. **Type Safety**: `Object.freeze()` prevents accidental mutation
5. **Documentation**: Clear JSDoc explaining usage patterns

### Trade-offs

- Additional import needed in files using the constant
- Slight learning curve for developers (need to know about both `EMPTY_BOUNDS` and `EMPTY_SPATIAL_BOUNDS`)

## Related ADRs

- **ADR-121**: Zero Point Pattern Centralization (WORLD_ORIGIN, ZERO_VECTOR)
- **ADR-158**: Infinity Bounds Initialization (createInfinityBounds)
- **ADR-089**: Point-In-Bounds Centralization (SpatialUtils.pointInBounds)

## Usage Guidelines

### When to use `EMPTY_SPATIAL_BOUNDS`

```typescript
// ✅ For functions returning SpatialBounds format
function getEntityBounds(entity: Entity): SpatialBounds {
  if (!entity.vertices) {
    return EMPTY_SPATIAL_BOUNDS;
  }
  // ...
}

// ✅ For spatial operations
function boundsFromPoints(points: Point2D[]): SpatialBounds {
  if (points.length === 0) {
    return EMPTY_SPATIAL_BOUNDS;
  }
  // ...
}
```

### When to use `EMPTY_BOUNDS`

```typescript
// ✅ For functions returning BoundingBox format (min/max Point2D)
function calculateBounds(entities: Entity[]): BoundingBox {
  if (entities.length === 0) {
    return EMPTY_BOUNDS;
  }
  // ...
}
```

## Verification

```bash
# TypeScript compilation
npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json

# Verify no inline instances remain
grep -n "{ minX: 0, minY: 0, maxX: 0, maxY: 0 }" src/subapps/dxf-viewer/**/*.ts
# Should only show the comment in geometry-constants.ts
```

---

*Auto-generated: 2026-02-01*
*Enterprise standards inspired by: AutoCAD, Figma, Adobe Illustrator*
