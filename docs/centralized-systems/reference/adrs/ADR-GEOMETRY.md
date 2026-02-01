# ADR-GEOMETRY: Geometry & Math Operations

| Metadata | Value |
|----------|-------|
| **Status** | ACTIVE |
| **Last Updated** | 2026-02-01 |
| **Category** | Domain - Geometry |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Overview

Αυτό το domain ADR ενοποιεί **26 επιμέρους ADRs** που αφορούν γεωμετρικές λειτουργίες και μαθηματικούς υπολογισμούς. Καλύπτει:

- **Distance & Vector Operations** - Υπολογισμοί αποστάσεων και διανυσμάτων
- **Angle Calculations** - Υπολογισμοί γωνιών, μετατροπές, κανονικοποίηση
- **Point Operations** - Σημεία, bounds, validation
- **Precision & Tolerances** - Ακρίβεια γεωμετρικών υπολογισμών
- **Constants** - Μαθηματικές σταθερές (TAU, RIGHT_ANGLE, etc.)

**Canonical Locations:**
- `src/subapps/dxf-viewer/utils/geometry/geometry-utils.ts` - Core geometry functions
- `src/subapps/dxf-viewer/rendering/entities/shared/geometry-rendering-utils.ts` - Rendering-specific geometry
- `src/subapps/dxf-viewer/config/tolerance-config.ts` - Precision constants
- `src/subapps/dxf-viewer/config/geometry-constants.ts` - Zero points, bounds constants

---

## 🚫 Global Prohibitions

- ❌ **Inline `Math.sqrt((p1.x-p2.x)² + (p1.y-p2.y)²)`** → Use `calculateDistance(p1, p2)`
- ❌ **Inline `Math.atan2(dy, dx)`** → Use `calculateAngle(from, to)` or `vectorAngle(v)`
- ❌ **Inline `Math.PI / 180` or `180 / Math.PI`** → Use `degToRad()` / `radToDeg()`
- ❌ **Inline `Math.PI * 2`** → Use `TAU` constant
- ❌ **Inline `Math.PI / 2`** → Use `RIGHT_ANGLE` constant
- ❌ **Inline `{ x: 0, y: 0 }`** → Use `WORLD_ORIGIN`, `ZERO_VECTOR`, or `createZeroPoint()`
- ❌ **Inline `Math.max(min, Math.min(max, value))`** → Use `clamp(value, min, max)`
- ❌ **Inline epsilon values (1e-10, 1e-6, 0.001)**  → Use `GEOMETRY_PRECISION.*`
- ❌ **Global `isFinite()`** → Use `Number.isFinite()` (strict, no coercion)

---

## Decisions

### 1. Geometry Calculations Centralization (ex-ADR-034)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: Scattered polygon calculation code across multiple files.

**Decision**: Centralize all geometry calculations in dedicated utility files.

**Canonical Locations**:
- `geometry-utils.ts` - Pure math (SSOT for polygon calculations)
- `geometry-rendering-utils.ts` - Rendering-specific geometry

---

### 2. Distance & Vector Operations (ex-ADR-065)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 42+ inline `Math.sqrt((p.x-q.x)² + (p.y-q.y)²)` implementations.

**Decision**: Centralize to canonical functions.

**Canonical Functions** (from `geometry-rendering-utils.ts`):
```typescript
calculateDistance(p1: Point2D, p2: Point2D): number
normalizeVector(v: Point2D): Point2D
getUnitVector(from: Point2D, to: Point2D): Point2D
getPerpendicularUnitVector(from: Point2D, to: Point2D): Point2D
```

**Eliminated Patterns**:
- `Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2)` → `calculateDistance(p, q)`
- `unitX = dx / length; unitY = dy / length;` → `getUnitVector()`
- `perpX = -dy / length; perpY = dx / length;` → `getPerpendicularUnitVector()`

---

### 3. Angle Calculation (ex-ADR-066)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 9+ inline `Math.atan2(dy, dx)` implementations.

**Decision**: Use `calculateAngle()` for point-to-point angles.

**Canonical Function** (from `geometry-rendering-utils.ts`):
```typescript
calculateAngle(from: Point2D, to: Point2D): number  // Returns radians
```

---

### 4. Radians/Degrees Conversion (ex-ADR-067)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 15+ inline `Math.PI / 180` calculations.

**Decision**: Use centralized conversion functions.

**Canonical Functions** (from `geometry-utils.ts`):
```typescript
degToRad(degrees: number): number
radToDeg(radians: number): number
DEGREES_TO_RADIANS  // Constant: Math.PI / 180
RADIANS_TO_DEGREES  // Constant: 180 / Math.PI
```

---

### 5. Angle Normalization (ex-ADR-068)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 7+ inline angle normalization implementations with inconsistent ranges.

**Decision**: Centralize to functions with consistent output ranges.

**Canonical Functions** (from `geometry-utils.ts`):
```typescript
normalizeAngleRad(angle: number): number  // Range: [0, 2π)
normalizeAngleDeg(angle: number): number  // Range: [0, 360)
```

**Algorithm**: `modulo + if` (efficient for extreme values)

---

### 6. Vector Magnitude (ex-ADR-070)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 15+ inline `Math.sqrt(v.x * v.x + v.y * v.y)` implementations.

**Decision**: Distinguish from distance calculation.

**Canonical Function** (from `geometry-rendering-utils.ts`):
```typescript
vectorMagnitude(v: Point2D): number  // Length of 1 vector
// vs calculateDistance(p1, p2)      // Distance between 2 points
```

---

### 7. Clamp Function (ex-ADR-071)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 40+ inline `Math.max(min, Math.min(max, value))` implementations.

**Decision**: Centralize with semantic wrappers.

**Canonical Functions** (from `geometry-utils.ts`):
```typescript
clamp(value: number, min: number, max: number): number
clamp01(value: number): number   // [0, 1] range (opacity, alpha)
clamp255(value: number): number  // [0, 255] range (RGB)
```

---

### 8. Dot Product (ex-ADR-072)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 9+ inline `v1.x * v2.x + v1.y * v2.y` implementations.

**Decision**: Centralize with clear distinction from magnitude.

**Canonical Function** (from `geometry-rendering-utils.ts`):
```typescript
dotProduct(v1: Point2D, v2: Point2D): number
// Mathematical properties:
// dot = 0 → vectors perpendicular
// dot > 0 → angle < 90°
// dot < 0 → angle > 90°
```

---

### 9. Midpoint/Bisector Calculation (ex-ADR-073)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 55+ inline `(a + b) / 2` implementations.

**Decision**: Semantic separation for different use cases.

**Canonical Functions**:
```typescript
// From geometry-rendering-utils.ts
calculateMidpoint(p1: Point2D, p2: Point2D): Point2D

// From geometry-utils.ts
bisectorAngle(angle1: number, angle2: number): number

// From SpatialUtils.ts
SpatialUtils.boundsCenter(bounds: SpatialBounds): Point2D
```

---

### 10. Point On Circle (ex-ADR-074)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 13 inline `center.x + radius * Math.cos(angle)` implementations.

**Decision**: Centralize polar-to-cartesian conversion.

**Canonical Function** (from `geometry-rendering-utils.ts`):
```typescript
pointOnCircle(center: Point2D, radius: number, angle: number): Point2D
// angle in radians: 0=right, π/2=up, π=left, 3π/2=down
```

---

### 11. TAU Constant (ex-ADR-077)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 42 inline `Math.PI * 2` / `2 * Math.PI` patterns.

**Decision**: Use semantic constant for full circle.

**Canonical Constant** (from `canvasPaths.ts`, re-exported from `geometry-utils.ts`):
```typescript
export const TAU = Math.PI * 2;  // ≈ 6.2832 (full circle)
```

---

### 12. Vector Angle & Angle Between Vectors (ex-ADR-078)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 20 inline `Math.atan2()` implementations with different semantics.

**Decision**: Separate functions for different angle calculations.

**Canonical Functions** (from `geometry-rendering-utils.ts`):
```typescript
// Angle of single vector from origin
vectorAngle(v: Point2D): number  // Range: [-π, π]

// Signed angle between 2 vectors
angleBetweenVectors(v1: Point2D, v2: Point2D): number
// Positive = v2 CCW from v1, Negative = v2 CW from v1

// vs calculateAngle(from, to) - angle from point A to point B
```

---

### 13. Geometric Epsilon/Precision (ex-ADR-079)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 25 inline epsilon/precision values (1e-10, 1e-6, 0.001, etc.) scattered across 16 files.

**Decision**: Semantic precision categories in tolerance-config.ts.

**Canonical Constants** (from `tolerance-config.ts`):
```typescript
GEOMETRY_PRECISION: {
  DENOMINATOR_ZERO: 1e-10,  // Intersection calculations
  VERTEX_DUPLICATE: 1e-6,    // Duplicate vertex detection
  POINT_MATCH: 0.001,        // Point matching
}

AXIS_DETECTION: {
  ZERO_THRESHOLD: 0.001,     // Zero/axis proximity
}

MOVEMENT_DETECTION: {
  MIN_MOVEMENT: 0.001,       // Minimum movement threshold
  ZOOM_CHANGE: 0.001,        // Zoom change detection
}

VECTOR_PRECISION: {
  MIN_MAGNITUDE: 0.001,      // Safe division threshold
}

ENTITY_LIMITS: {
  MIN_SIZE: 0.001,           // Minimum entity size
}
```

---

### 14. Rectangle Bounds (ex-ADR-080)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 10+ inline bounding box calculations with duplicate `Math.min`/`Math.abs` patterns.

**Decision**: Centralize to single function.

**Canonical Function** (from `geometry-rendering-utils.ts`):
```typescript
interface RectBounds { x: number; y: number; width: number; height: number; }
rectFromTwoPoints(p1: Point2D, p2: Point2D): RectBounds
```

---

### 15. Point-In-Bounds (ex-ADR-089)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 4 duplicate point-in-bounds implementations.

**Decision**: Two functions for different bounds formats.

**Canonical Functions** (from `SpatialUtils.ts`):
```typescript
// For SpatialBounds format { minX, maxX, minY, maxY }
SpatialUtils.pointInBounds(point: Point2D, bounds: SpatialBounds): boolean

// For { min, max } Point2D format
SpatialUtils.pointInRect(point: Point2D, rect: { min: Point2D, max: Point2D }): boolean
```

---

### 16. Point Vector Operations (ex-ADR-090)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 15+ inline vector arithmetic patterns.

**Decision**: Centralize vector operations.

**Canonical Functions** (from `geometry-rendering-utils.ts`):
```typescript
subtractPoints(p1: Point2D, p2: Point2D): Point2D  // p1 - p2
addPoints(p1: Point2D, p2: Point2D): Point2D       // p1 + p2
scalePoint(point: Point2D, scalar: number): Point2D
offsetPoint(point: Point2D, direction: Point2D, distance: number): Point2D
```

---

### 17. Inline Deg-to-Rad Extension (ex-ADR-100)
**Date**: 2026-01-31 | **Status**: IMPLEMENTED

**Problem**: 5 remaining inline `Math.PI / 180` patterns after ADR-067.

**Decision**: Complete migration to `degToRad()`.

**Files Cleaned**: PreviewRenderer.ts (4), FormatterRegistry.ts (1)

---

### 18. Angular Constants (ex-ADR-103)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 18 inline `Math.PI / 2` and `Math.PI / 6` patterns.

**Decision**: Semantic constants for common angles.

**Canonical Constants** (from `geometry-utils.ts`):
```typescript
RIGHT_ANGLE = Math.PI / 2  // ≈ 1.5708 rad = 90°
ARROW_ANGLE = Math.PI / 6  // ≈ 0.5236 rad = 30°
```

---

### 19. Zero Point Pattern (ex-ADR-121)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 74 repetitions of `{ x: 0, y: 0 }` across 41 files with different semantic meanings.

**Decision**: Semantic constants + factory functions.

**Canonical Constants** (from `geometry-constants.ts`):
```typescript
// Immutable constants (Object.freeze)
WORLD_ORIGIN: Readonly<Point2D>   // Coordinate transforms, rulers
ZERO_VECTOR: Readonly<Point2D>    // Returns, fallbacks
ZERO_DELTA: Readonly<Point2D>     // Delta tracking
EMPTY_BOUNDS: Readonly<BoundingBox>
DEFAULT_BOUNDS: Readonly<BoundingBox>  // 100x100 placeholder

// Factory functions for mutable state
createZeroPoint(): Point2D        // React useState
createEmptyBounds(): BoundingBox

// Utility functions
isAtOrigin(point: Point2D): boolean
isEmptyBounds(bounds: BoundingBox): boolean
```

---

### 20. clampScale Function (ex-ADR-131)
**Date**: 2026-01-01 | **Status**: IMPLEMENTED

**Problem**: 2 duplicate `clampScale` implementations (PDF vs Zoom).

**Decision**: Unified function with defaults + wrapper.

**Canonical Functions** (from `transform-config.ts`):
```typescript
clampScale(scale: number, minScale?: number, maxScale?: number): number
clampPdfScale(scale: number): number  // PDF-specific (0.01 - 10)
PDF_SCALE_LIMITS: { MIN_SCALE: 0.01, MAX_SCALE: 10 }
```

---

### 21. Coordinate Validation (ex-ADR-132)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: Scattered coordinate validation patterns (undefined, NaN, Infinity checks).

**Decision**: Type guard functions with TypeScript type predicates.

**Canonical Functions** (from `entity-validation-utils.ts`):
```typescript
isValidPoint(point: unknown): point is Point2D      // null, undefined, NaN
isValidPointStrict(point: unknown): point is Point2D // Also checks Infinity
```

---

### 22. Angle Difference Normalization (ex-ADR-134)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 4 scattered `while (angleDiff > Math.PI)` patterns with inconsistent boundaries.

**Decision**: Centralize with mathematically correct boundary.

**Canonical Function** (from `geometry-utils.ts`):
```typescript
normalizeAngleDiff(angleDiff: number): number  // Range: (-π, π]
// Result > 0: counterclockwise
// Result < 0: clockwise
```

---

### 23. MIN_POLY_POINTS (ex-ADR-145)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: Same constant `= 3` in 3 places.

**Decision**: Single centralized constant.

**Canonical Constant** (from `tolerance-config.ts`):
```typescript
MIN_POLY_POINTS = 3  // Minimum vertices for valid polygon
```

---

### 24. Degenerate Determinant Tolerance (ex-ADR-156)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: Hardcoded `1e-10` for determinant zero-check.

**Decision**: Use existing `GEOMETRY_PRECISION.DENOMINATOR_ZERO`.

**Use Case**: Detecting collinear points in Kasa circle fit algorithm.

---

### 25. isFinite() Standardization (ex-ADR-161)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: Mixed usage of global `isFinite()` and `Number.isFinite()`.

**Decision**: Standardize to `Number.isFinite()` (strict, no type coercion).

```typescript
// ❌ BEFORE: Global isFinite (type coercion)
return isFinite(p.x) && isFinite(p.y);

// ✅ AFTER: Number.isFinite (strict)
return Number.isFinite(p.x) && Number.isFinite(p.y);
```

---

### 26. Line Direction Normalization (ex-ADR-164)
**Date**: 2026-02-01 | **Status**: IMPLEMENTED

**Problem**: 3 functions with duplicate inline direction normalization code.

**Decision**: Use existing ADR-065 functions.

```typescript
// ❌ BEFORE: 10+ lines inline calculation
const dx = refEnd.x - refStart.x;
const dy = refEnd.y - refStart.y;
const refLength = Math.sqrt(dx * dx + dy * dy);
const refDirX = dx / refLength;
const perpDirX = -refDirY;

// ✅ AFTER: 3-4 lines with centralized functions
const refLength = calculateDistance(refStart, refEnd);
const refDir = getUnitVector(refStart, refEnd);
const perpDir = getPerpendicularUnitVector(refStart, refEnd);
```

---

## Quick Reference - Import Examples

```typescript
// Distance & Vector Operations
import {
  calculateDistance,
  calculateAngle,
  vectorMagnitude,
  dotProduct,
  normalizeVector,
  getUnitVector,
  getPerpendicularUnitVector,
  vectorAngle,
  angleBetweenVectors,
  calculateMidpoint,
  pointOnCircle,
  rectFromTwoPoints,
  subtractPoints,
  addPoints,
  scalePoint,
  offsetPoint,
} from '../rendering/entities/shared/geometry-rendering-utils';

// Core Geometry Functions
import {
  degToRad,
  radToDeg,
  normalizeAngleRad,
  normalizeAngleDeg,
  normalizeAngleDiff,
  bisectorAngle,
  clamp,
  clamp01,
  clamp255,
  TAU,
  RIGHT_ANGLE,
  ARROW_ANGLE,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
} from '../utils/geometry/geometry-utils';

// Zero Points & Bounds
import {
  WORLD_ORIGIN,
  ZERO_VECTOR,
  ZERO_DELTA,
  EMPTY_BOUNDS,
  DEFAULT_BOUNDS,
  createZeroPoint,
  createEmptyBounds,
  isAtOrigin,
  isEmptyBounds,
} from '../config/geometry-constants';

// Precision Constants
import {
  GEOMETRY_PRECISION,
  AXIS_DETECTION,
  MOVEMENT_DETECTION,
  VECTOR_PRECISION,
  ENTITY_LIMITS,
  MIN_POLY_POINTS,
} from '../config/tolerance-config';

// Spatial Utilities
import { SpatialUtils } from '../core/spatial/SpatialUtils';
// SpatialUtils.pointInBounds(), SpatialUtils.pointInRect(), SpatialUtils.boundsCenter()

// Coordinate Validation
import {
  isValidPoint,
  isValidPointStrict,
} from '../rendering/entities/shared/entity-validation-utils';

// Scale Clamping
import {
  clampScale,
  clampPdfScale,
  PDF_SCALE_LIMITS,
} from '../config/transform-config';
```

---

## Archived ADRs

The following individual ADRs have been consolidated into this domain ADR:

| Original ADR | Title | Archived Location |
|--------------|-------|-------------------|
| ADR-034 | Geometry Calculations Centralization | `archived/ADR-034-geometry-calculations-centralization.md` |
| ADR-065 | Distance & Vector Operations Centralization | `archived/ADR-065-distance-vector-operations-centralization.md` |
| ADR-066 | Angle Calculation Centralization | `archived/ADR-066-angle-calculation-centralization.md` |
| ADR-067 | Radians/Degrees Conversion Centralization | `archived/ADR-067-radians-degrees-conversion-centralization.md` |
| ADR-068 | Angle Normalization Centralization | `archived/ADR-068-angle-normalization-centralization.md` |
| ADR-070 | Vector Magnitude Centralization | `archived/ADR-070-vector-magnitude-centralization.md` |
| ADR-071 | Clamp Function Centralization | `archived/ADR-071-clamp-function-centralization.md` |
| ADR-072 | Dot Product Centralization | `archived/ADR-072-dot-product-centralization.md` |
| ADR-073 | Midpoint/Bisector Calculation Centralization | `archived/ADR-073-midpoint-bisector-calculation-centralization.md` |
| ADR-074 | Point On Circle Centralization | `archived/ADR-074-point-on-circle-centralization.md` |
| ADR-077 | TAU Constant Centralization | `archived/ADR-077-tau-constant-centralization-2-math-pi.md` |
| ADR-078 | Vector Angle & Angle Between Vectors Centralization | `archived/ADR-078-vector-angle-angle-between-vectors-centralization.md` |
| ADR-079 | Geometric Epsilon/Precision Centralization | `archived/ADR-079-geometric-epsilon-precision-centralization.md` |
| ADR-080 | Rectangle Bounds Centralization | `archived/ADR-080-rectangle-bounds-centralization-rectfromtwopoints.md` |
| ADR-089 | Point-In-Bounds Centralization | `archived/ADR-089-point-in-bounds-centralization.md` |
| ADR-090 | Point Vector Operations Centralization | `archived/ADR-090-point-vector-operations-centralization.md` |
| ADR-100 | Inline Degrees-to-Radians Conversion Centralization | `archived/ADR-100-inline-degrees-to-radians-conversion-centralizatio.md` |
| ADR-103 | Angular Constants Centralization | `archived/ADR-103-angular-constants-centralization-right-angle-arrow.md` |
| ADR-121 | Zero Point Pattern Centralization | `archived/ADR-121-zero-point-pattern-centralization-world-origin-zer.md` |
| ADR-131 | clampScale Function Centralization | `archived/ADR-131-clampscale-function-centralization-pdf-zoom.md` |
| ADR-132 | Coordinate Validation Centralization | `archived/ADR-132-coordinate-validation-centralization-isvalidpoint-.md` |
| ADR-134 | Angle Difference Normalization | `archived/ADR-134-angle-difference-normalization-normalizeanglediff.md` |
| ADR-145 | MIN_POLY_POINTS Centralization | `archived/ADR-145-min-poly-points-centralization.md` |
| ADR-156 | Degenerate Determinant Tolerance | `archived/ADR-156-degenerate-determinant-tolerance-geometry-precisio.md` |
| ADR-161 | isFinite() Standardization | `archived/ADR-161-isfinite-standardization-global-number-isfinite.md` |
| ADR-164 | Line Direction Normalization | `archived/ADR-164-line-direction-normalization-adr-065-functions.md` |

---

## Benefits of Consolidation

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **ADR Files** | 26 separate files | 1 domain file | 96% reduction |
| **Navigation** | Search 26 files | Single document | Instant lookup |
| **Duplicates** | 200+ inline patterns | 0 (centralized) | 100% eliminated |
| **Consistency** | Scattered implementations | Single source of truth | Enterprise-grade |

---

*Consolidated: 2026-02-01*
*Based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, Google*
