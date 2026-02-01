# ADR-160: Internal Angle Arc Rendering (dot product logic)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Drawing System |
| **Canonical Location** | `drawInternalAngleArc()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `drawInternalAngleArc()` from `rendering/entities/BaseEntityRenderer.ts`
- **Decision**: Use dot product logic for ALWAYS rendering INTERNAL angle arcs
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: `AngleMeasurementRenderer` used simple arc logic (angle1 → angle2), sometimes rendering EXTERNAL arcs
- **Existing Correct Logic**: `drawInternalArc()` (lines 667-718) uses dot product to select correct CCW/CW direction
- **Solution**: New method `drawInternalAngleArc(vertex, point1, point2, radiusWorld)` that:
  1. Calculates unit vectors from vertex to each point
  2. Delegates to `drawInternalArc()` which uses dot product for correct direction
- **Algorithm** (from drawInternalArc):
  ```typescript
  // Calculate bisector (interior direction)
  const bisectorX = (prevUnit.x + nextUnit.x) / 2;
  const bisectorY = (prevUnit.y + nextUnit.y) / 2;
  // Dot product to choose CCW or CW
  const useCCW = dot(midCCW, cNorm) > dot(midCW, cNorm);
  addArcPath(ctx, v, rPx, a1, a2, useCCW);
  ```
- **Files Changed**:
  - `BaseEntityRenderer.ts`: Added `drawInternalAngleArc()` method
  - `AngleMeasurementRenderer.ts`: Changed from `drawCentralizedArc()` to `drawInternalAngleArc()`
- **Benefits**:
  - Τόξα ΠΑΝΤΑ εσωτερικά (μικρότερη γωνία)
  - Consistent με Polyline/Rectangle angle rendering
  - CAD-standard behavior (AutoCAD dimension arcs)
- **Companion**: ADR-140 (Angle Measurement Constants), ADR-159 (Measurement Colors)

---
