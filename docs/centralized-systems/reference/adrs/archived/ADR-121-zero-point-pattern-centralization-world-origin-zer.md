# ADR-121: Zero Point Pattern Centralization (WORLD_ORIGIN, ZERO_VECTOR, EMPTY_BOUNDS)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `config/geometry-constants.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `config/geometry-constants.ts`
- **Decision**: Centralize all `{ x: 0, y: 0 }` inline patterns to semantic constants
- **Problem**: 74 repetitions of `{ x: 0, y: 0 }` across 41 files with different semantic meanings:
  - World coordinate origin (coordinate transforms, rulers, grids)
  - Zero vectors (return values, fallbacks)
  - Empty bounds (error states, empty arrays)
  - Mutable state initialization (React useState)
- **Solution**: Semantic constants + factory functions for different use cases
- **Constants** (immutable with `Object.freeze()`):
  - `WORLD_ORIGIN: Readonly<Point2D>` - Reference point in world coordinates (transforms, rulers)
  - `ZERO_VECTOR: Readonly<Point2D>` - Generic zero point (returns, fallbacks)
  - `ZERO_DELTA: Readonly<Point2D>` - Zero movement vector (delta tracking)
  - `EMPTY_BOUNDS: Readonly<BoundingBox>` - Zero-size bounding box (empty arrays)
  - `DEFAULT_BOUNDS: Readonly<BoundingBox>` - Standard placeholder (100x100)
- **Factory Functions** (for mutable state):
  - `createZeroPoint(): Point2D` - Fresh mutable zero point (React state)
  - `createEmptyBounds(): BoundingBox` - Fresh mutable empty bounds
- **Utility Functions**:
  - `isAtOrigin(point: Point2D): boolean` - Check if point is at origin
  - `isEmptyBounds(bounds: BoundingBox): boolean` - Check if bounds are empty
- **API**:
  ```typescript
  // Immutable usage (coordinate transforms, rendering)
  import { WORLD_ORIGIN, ZERO_VECTOR, EMPTY_BOUNDS } from '../config/geometry-constants';

  const screenOrigin = worldToScreen(WORLD_ORIGIN, transform);
  return isValid ? result : ZERO_VECTOR;
  const bounds = entities.length > 0 ? calculateBounds(entities) : { ...EMPTY_BOUNDS };

  // Mutable usage (React state)
  import { createZeroPoint } from '../config/geometry-constants';

  const [position, setPosition] = useState<Point2D>(createZeroPoint());
  const dragDelta = useRef<Point2D>(createZeroPoint());
  ```
- **Files Migrated** (18 files, ~42 replacements):
  - **Phase 1 - Core Rendering** (5 files):
    - `rendering/ui/grid/GridRenderer.ts` - 3 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/ruler/RulerRenderer.ts` - 2 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/origin/OriginMarkersRenderer.ts` - 1 worldOrigin → WORLD_ORIGIN
    - `rendering/ui/origin/OriginMarkerUtils.ts` - 1 worldOrigin → WORLD_ORIGIN
    - `rendering/passes/BackgroundPass.ts` - 1 inline → WORLD_ORIGIN
  - **Phase 2 - Geometry Utils** (3 files):
    - `rendering/entities/shared/geometry-utils.ts` - 3 returns/accumulators → ZERO_VECTOR
    - `rendering/entities/shared/line-utils.ts` - 1 unitVector → ZERO_VECTOR
    - `rendering/canvas/utils/CanvasUtils.ts` - 3 error returns → ZERO_VECTOR
  - **Phase 3 - Bounds & Fallbacks** (4 files):
    - `systems/zoom/utils/bounds.ts` - 4 fallback bounds → EMPTY_BOUNDS / DEFAULT_BOUNDS
    - `hooks/scene/useSceneState.ts` - 2 empty scene → EMPTY_BOUNDS
    - `grips/resolveTarget.ts` - 2 mock bbox → DEFAULT_BOUNDS
    - `systems/rulers-grid/types.ts` - Removed local DEFAULT_ORIGIN, re-exports from centralized
  - **Phase 4 - State Hooks** (3 files):
    - `hooks/useEntityDrag.ts` - 3 totalDelta init → createZeroPoint()
    - `hooks/useGripMovement.ts` - 2 totalDelta init → createZeroPoint()
    - `hooks/useViewState.ts` - 1 panStart init → createZeroPoint()
  - **Phase 5 - Misc Files** (2 files):
    - `systems/constraints/config.ts` - 1 basePoint → ZERO_VECTOR
    - `debug/CalibrationGridRenderer.ts` - 3 worldOrigin → WORLD_ORIGIN
- **Backward Compatibility**:
  - `systems/rulers-grid/types.ts` re-exports `DEFAULT_ORIGIN` from geometry-constants
- **Pattern**: Single Source of Truth (SSOT) + Factory Pattern
- **Benefits**:
  - Zero inline `{ x: 0, y: 0 }` patterns (semantic constants instead)
  - Semantic clarity: WORLD_ORIGIN vs ZERO_VECTOR vs ZERO_DELTA
  - Type safety with `Readonly<Point2D>` for immutable constants
  - Mutable state safety with factory functions (no shared references)
  - Single point of change for coordinate system origin
  - Consistent bounds handling across codebase
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "\{ *x: *0, *y: *0 *\}" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only geometry-constants.ts)
- **Companion**: ADR-065 (Distance Calculation), ADR-034 (Geometry Centralization), ADR-114 (Bounding Box)
