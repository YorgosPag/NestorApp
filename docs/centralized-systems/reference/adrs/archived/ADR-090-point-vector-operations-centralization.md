# ADR-090: Point Vector Operations Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `subtractPoints()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `subtractPoints()`, `addPoints()`, `scalePoint()`, `offsetPoint()` from `geometry-rendering-utils.ts`
- **Impact**: 15+ inline vector arithmetic patterns → 4 centralized functions
- **Problem**: Duplicate vector arithmetic patterns scattered across 8+ files:
  - `{ x: p1.x - p2.x, y: p1.y - p2.y }` - Vector subtraction
  - `{ x: point.x + dir.x * dist, y: point.y + dir.y * dist }` - Point offset
- **Solution**: Centralized vector arithmetic functions
- **API**:
  ```typescript
  // Vector subtraction: p1 - p2 = vector from p2 to p1
  subtractPoints(p1: Point2D, p2: Point2D): Point2D

  // Vector addition
  addPoints(p1: Point2D, p2: Point2D): Point2D

  // Scale vector by scalar
  scalePoint(point: Point2D, scalar: number): Point2D

  // Offset point by direction * distance (combines add + scale)
  offsetPoint(point: Point2D, direction: Point2D, distance: number): Point2D
  ```
- **Files Migrated**:
  - `geometry-utils.ts` - `angleBetweenPoints()` vector calculations
  - `useUnifiedDrawing.tsx` - Measure-angle tool vector calculations
  - `PolylineRenderer.ts` - Rectangle side vectors (4 patterns)
  - `useDynamicInputMultiPoint.ts` - Angle calculation vectors
  - `angle-utils.ts` - Uses `pointOnCircle()` for label positioning
  - `text-labeling-utils.ts` - Uses `offsetPoint()` for text positioning
  - `line-utils.ts` - Uses `offsetPoint()` for gap calculations
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate vector arithmetic
  - Consistent API: `subtractPoints(p1, p2)` instead of `{ x: p1.x - p2.x, ... }`
  - Clear semantic meaning (subtract vs offset vs scale)
  - Type-safe Point2D interface
- **Companion**: ADR-065 (Distance), ADR-073 (Midpoint), ADR-074 (Point On Circle)
