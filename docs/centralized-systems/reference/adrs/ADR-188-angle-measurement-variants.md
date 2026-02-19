# ADR-188: Angle Measurement Variants — Line-Arc, Two-Arcs, MeasureGeom, Constraint

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-19 |
| **Category** | DXF Viewer / Measurement System |
| **Related** | ADR-065, ADR-066, ADR-067, ADR-068, ADR-072, ADR-073, ADR-140, ADR-142 |

## Context

The DXF Viewer toolbar had an angle measurement dropdown with 5 options:

| # | Tool ID | Status Before |
|---|---------|---------------|
| 1 | `measure-angle` (Basic Angle) | ✅ Working |
| 2 | `measure-angle-line-arc` (Line & Arc) | ❌ Stub only |
| 3 | `measure-angle-two-arcs` (Two Arcs) | ❌ Stub only |
| 4 | `measure-angle-measuregeom` (MeasureGeom) | ❌ Stub only |
| 5 | `measure-angle-constraint` (Constraint) | ❌ Stub only |

The 4 unimplemented tools were registered in:
- `ToolStateManager.ts` (metadata)
- `toolDefinitions.tsx` (toolbar dropdown)
- `ToolbarStatusBar.tsx` (status bar labels)
- `types.ts` (ToolType union)

But **NOT** registered in the drawing pipeline:
- `drawing-types.ts` (DrawingTool type)
- `drawing-entity-builders.ts` (entity creation + isEntityComplete)
- `drawing-preview-generator.ts` (preview rendering)
- `useUnifiedDrawing.tsx` (measurement tools set + finish logic)
- `useDrawingHandlers.ts` (double-click completion)

## Industry Research

### AutoCAD (Autodesk)

**MEASUREGEOM Angle command** — 3 sub-modes:
1. **Select arc**: Click on arc → angle = arc's subtended angle (center as vertex)
2. **Select two lines**: Click line1, line2 → angle at intersection
3. **Specify vertex**: Click vertex + 2 points → standard 3-point angle

Key: MEASUREGEOM shows measurement in command line only — **no persistent annotation**.

**DIMANGULAR command** — Angular dimension annotation:
- Arc → measures included angle
- Two non-parallel lines → angle at intersection
- Circle + 2 points → central angle
- 3-point method → vertex + 2 endpoints

**DCANGULAR command** — Parametric constraint:
- Constrains angle between line/polyline segments
- Constrains swept angle of arc
- Editable dimension value that modifies geometry

### Bentley MicroStation

**Measure Angle Between Lines** (Drawing > Analyze > Measure):
- Select two lines/segments → angle at intersection
- Auto-computes intersection if lines don't meet
- Flatten Direction option for 3D angles (None, View Z, ACS Z, AccuDraw Z)

## Decision

### Phase 1 (This Implementation): Point-Based 3-Point Input

All 4 variants use the **same 3-point input mechanism** as basic angle measurement:
- **Point 1**: First arm endpoint
- **Point 2 (Vertex)**: Angle apex
- **Point 3**: Second arm endpoint

This approach was chosen because:
1. Our drawing system is **point-collection-based**, not entity-selection-based
2. The mathematical calculation is identical for all variants with 3 points
3. Enables immediate functionality for all 5 angle tools
4. Same `AngleMeasurementEntity` type → same renderer → full feature parity

### Phase 2 (Future): Entity-Aware Selection

Future enhancements would add entity snapping:
- `measure-angle-line-arc`: Click on a line entity, then click on an arc → auto-compute tangent angle
- `measure-angle-two-arcs`: Click on two arc entities → angle between tangent lines
- `measure-angle-measuregeom`: Non-persistent display (show in status bar only, no entity)
- `measure-angle-constraint`: Editable angle value that modifies connected geometry

## Architecture

### Drawing Pipeline Flow

```
User clicks 3 points → DrawingTool recognized
  → drawing-entity-builders.ts: createEntityFromTool() creates AngleMeasurementEntity
  → isEntityComplete() returns true at 3 points
  → drawing-preview-generator.ts: Preview rendering during point collection
  → useUnifiedDrawing.tsx: Entity completed → added to measurement overlays
  → AngleMeasurementRenderer: 3-phase rendering (geometry → measurements → grips)
```

### Files Modified

| File | Change |
|------|--------|
| `hooks/drawing/drawing-types.ts` | Added 4 tools to `DrawingTool` union |
| `hooks/drawing/drawing-entity-builders.ts` | Added fall-through cases in `createEntityFromTool` + `isEntityComplete` |
| `hooks/drawing/drawing-preview-generator.ts` | Added to 5 tool check locations |
| `hooks/drawing/useUnifiedDrawing.tsx` | Added to `MEASUREMENT_TOOLS` set + `isFinishable` check |
| `hooks/drawing/useDrawingHandlers.ts` | Added to double-click completion handler |

### Shared Infrastructure (No Changes Needed)

- `AngleMeasurementEntity` type — already generic (vertex + point1 + point2 + angle)
- `AngleMeasurementRenderer` — renders any `angle-measurement` entity
- `angle-calculation.ts` — `angleBetweenVectors()`, `normalizeAngleDeg()`
- Icon components — All 5 already created (`AngleIconBase` + 4 variants)
- i18n labels — All 5 already in `property-statuses-enterprise.ts`
- ToolStateManager — All 5 already registered

## Consequences

### Positive
- All 5 angle measurement tools are now functional
- Zero new components or types needed — 100% reuse of existing infrastructure
- Users can immediately use all dropdown options
- Same rendering quality and grip interaction for all variants

### Negative
- Phase 1 tools are functionally identical (same 3-point input)
- Entity-aware selection (auto-detect line/arc) deferred to Phase 2

## Changelog

- **2026-02-19**: Phase 1 — All 4 variants implemented with 3-point input, 5 files modified
