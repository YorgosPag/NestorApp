# ADR-034: Validation Bounds Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `src/subapps/dxf-viewer/config/validation-bounds-config.ts` |
| **Author** | George Pagonis + Claude Code (Anthropic AI) |

---

## 1. Context

Validation bounds (min/max ranges for clamp operations) were hardcoded inline across 22+ files in the codebase, leading to:

### The Problem

- **Inconsistency**: Same property validated with different ranges in different files (e.g., gripSize: 3-20 vs 1-255)
- **Maintenance Nightmare**: Changing bounds required finding and updating 30+ hardcoded values
- **No Discoverability**: Impossible to know all valid ranges without reading every file
- **Error-prone**: Easy to introduce typos or inconsistent values

### Affected Patterns

```typescript
// BEFORE: Hardcoded bounds scattered everywhere
opacity: clamp(value, 0, 1);           // domain.ts
opacity: clamp(value, 0.1, 1.0);       // gripSettings.ts
fontSize: clamp(value, 8, 72);         // domain.ts
gridSize: clamp(value, 10, 500);       // SpatialUtils.ts
```

---

## 2. Decision

Create a single centralized configuration file for all validation bounds.

### Canonical Source

```
src/subapps/dxf-viewer/config/validation-bounds-config.ts
```

### API

```typescript
import {
  // Bound Constants
  OPACITY_BOUNDS,
  TEXT_BOUNDS,
  LINE_BOUNDS,
  GRIP_BOUNDS,
  SPATIAL_BOUNDS,
  PERCENTAGE_BOUNDS,

  // Helper Functions
  clampOpacity,
  clampFontSize,
  clampGripSize,
  clampLineWidth,
  // ...and more
} from '../config/validation-bounds-config';

// Usage with constants
const opacity = clamp(value, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max);

// Usage with helper functions (recommended for readability)
const fontSize = clampFontSize(value);
```

### Categories

| Category | Constants | Description |
|----------|-----------|-------------|
| **OPACITY_BOUNDS** | STANDARD (0-1), VISIBLE (0.1-1) | Transparency values |
| **TEXT_BOUNDS** | FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, etc. | ISO 3098 text standards |
| **LINE_BOUNDS** | WIDTH, DASH_SCALE, DASH_OFFSET | ISO 128 line standards |
| **GRIP_BOUNDS** | SIZE, PICK_BOX, APERTURE, MAX_PER_ENTITY | AutoCAD grip standards |
| **SPATIAL_BOUNDS** | GRID_CELL_SIZE, SNAP_ZOOM_FACTOR | Spatial indexing limits |
| **PERCENTAGE_BOUNDS** | STANDARD (0-100), RATIO (0-1), FIT_TO_VIEW_PADDING | Percentage values |

---

## 3. Consequences

### Positive

- **Single Source of Truth**: All valid ranges in one discoverable location
- **Consistency Guaranteed**: Same bounds used everywhere by importing from config
- **Easy Maintenance**: Change once, applies everywhere
- **Self-Documenting**: Comments explain the reasoning for each bound
- **Type-Safe**: `as const` ensures literal types and prevents accidental mutation
- **Helper Functions**: Semantic clamp functions improve code readability

### Negative

- **Import Required**: Files need to import from config (minor inconvenience)
- **More Verbose**: `OPACITY_BOUNDS.STANDARD.min` vs just `0` (but more meaningful)

---

## 4. Prohibitions (after this ADR)

- **Hardcoded clamp bounds** for validation are prohibited
- **New inline bounds** like `clamp(value, 0, 1)` should use centralized constants
- **Duplicate bound definitions** in multiple files are prohibited

### Exceptions

Mathematical constants that are not validation bounds are allowed inline:
```typescript
// ALLOWED: Mathematical constants
clamp(cosAngle, -1, 1);  // Math.acos domain constraint
```

---

## 5. Migration

| File | Status | Notes |
|------|--------|-------|
| `settings-core/types/domain.ts` | Migrated | 13 clamp calls updated |
| `types/gripSettings.ts` | Migrated | 5 clamp calls updated |
| `core/spatial/SpatialUtils.ts` | Migrated | 1 clamp call updated |
| `systems/ai-snapping/AISnappingEngine.ts` | Migrated | 1 clamp call updated |
| `services/FitToViewService.ts` | N/A | Already uses FIT_TO_VIEW_DEFAULTS from transform-config |
| `systems/zoom/utils/bounds.ts` | Migrated | `isValidBounds` delegates to `SpatialUtils.isValidRect` |

---

## 5b. Bounds Validation Functions

Two validation functions exist for different bound formats:

| Function | Location | Format | Strictness |
|----------|----------|--------|------------|
| `SpatialUtils.isValidBounds(bounds)` | `core/spatial/SpatialUtils.ts` | `{ minX, minY, maxX, maxY }` | Allows `min == max` |
| `SpatialUtils.isValidRect(bounds)` | `core/spatial/SpatialUtils.ts` | `{ min: Point2D, max: Point2D }` | Requires `max > min` |

### Usage

```typescript
import { SpatialUtils } from '../core/spatial/SpatialUtils';

// For SpatialBounds format (point entities allowed)
SpatialUtils.isValidBounds({ minX: 0, minY: 0, maxX: 0, maxY: 0 }); // true

// For Bounds/Rect format (requires area)
SpatialUtils.isValidRect({ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }); // false - needs area
SpatialUtils.isValidRect({ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } }); // true
```

### Re-exports for Compatibility

`systems/zoom/utils/bounds.ts` re-exports `isValidBounds` that delegates to `SpatialUtils.isValidRect`

---

## 6. References

- Related: [ADR-071](./archived/ADR-071-clamp-function-centralization.md) - Clamp function centralization
- Related: [ADR-043](./ADR-043-zoom-constants-consolidation.md) - Zoom constants (includes scale bounds)
- Industry Standard: ISO 128 (Technical drawing line widths)
- Industry Standard: ISO 3098 (Technical drawing lettering)
- Industry Standard: AutoCAD system variables (GRIPSIZE, PICKBOX, APERTURE)

---

## 7. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-01 | ADR Created | George Pagonis + Claude Code |
| 2026-02-01 | Status: Implemented | George Pagonis |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
