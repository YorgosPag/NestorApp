/**
 * SSOT — apply-entity-preview
 *
 * Pure function that returns a cloned `DxfEntityUnion` with its geometry
 * transformed for a live drag preview (grip move/stretch, or wholesale
 * translation). Original entity is never mutated.
 *
 * This is the single source of truth for "what does the entity look like
 * during a drag" used by:
 *   - useMovePreview (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview (grip drag, center + vertex + edge)
 *
 * Extracted from `DxfRenderer.applyDragPreview` (ADR-040 Phase D, 2026-05-09)
 * which previously drew the preview inline in the main canvas. The unified
 * preview architecture moves all ghost rendering to the dedicated PreviewCanvas
 * overlay, keeping the bitmap cache invalidation-free during drag.
 *
 * @see rendering/ghost/draw-ghost-entity — companion renderer
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion, DxfText, DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-363 Slice F — plain DXF line rotation live ghost (shared rotate SSoT).
import { applyLineRotationDrag } from '../../systems/line/line-grips';
import type { Entity } from '../../types/entities';
import { applyTextGripDrag } from '../../bim/text/text-grips';
// ADR-363 Phase 1G.5 — whole-entity translate SSoT (shared by the Alt move ghost + commit).
import { calculateBimMovedGeometry } from '../../bim/utils/bim-move-geometry';
import { applyStairGripDrag } from '../../bim/stairs/stair-grips';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import type { WallEntity } from '../../bim/types/wall-types';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import type { BeamEntity } from '../../bim/types/beam-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import type { ColumnEntity } from '../../bim/types/column-types';
import { applyFoundationGripDrag } from '../../bim/foundations/foundation-grips';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import type { SlabEntity } from '../../bim/types/slab-types';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { computeRoofGeometry } from '../../bim/geometry/roof-geometry';
import type { RoofEntity } from '../../bim/types/roof-types';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { computeFloorFinishGeometry, type FloorFinishEntity } from '../../bim/types/floor-finish-types';
import {
  applyHatchGripDrag, applyHatchOriginGripDrag, isHatchOriginGripKind, hatchBoundsCenter,
  isHatchAngleGripKind, hatchGradientAngleGripPos, applyHatchAngleGripDrag,
} from '../../bim/hatch/hatch-grips';
import { withGradientPatch, DEFAULT_GRADIENT_DEFAULTS } from '../../bim/hatch/hatch-gradient-build';
import type { HatchEntity } from '../../types/entities';
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { applyMepManifoldGripDrag } from '../../bim/mep-manifolds/mep-manifold-grips';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import { applyMepSegmentGripDrag } from '../../bim/mep-segments/mep-segment-grips';
import { computeMepSegmentGeometry } from '../../bim/geometry/mep-segment-geometry';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { resolveOpeningAltMove, openingRehostToleranceWorld } from '../../bim/walls/opening-grips';
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import type { EntityPreviewTransform } from './entity-preview-types';
import { unwrapStair, applyClassicEntityPreview } from './apply-entity-preview-helpers';

export type { EntityPreviewTransform };

/**
 * Optional scene context for previews that need neighbours. Currently only the
 * hosted-opening Alt-move ghost uses it (`walls` → resolve slide / re-host +
 * recompute the full door symbol). Omitted by callers that preview self-contained
 * entities; the opening ghost then falls back to an outline-only axis slide.
 */
export interface ApplyEntityPreviewContext {
  readonly walls?: readonly WallEntity[];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a drag-preview transform to a DXF entity. Returns a cloned entity
 * with new geometry, or the original entity unchanged when:
 *  - `preview` is undefined / does not target this entity
 *  - `delta` is zero
 *  - the entity type is unsupported for the requested transform
 *
 * Pure: never mutates the input entity.
 */
export function applyEntityPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform | undefined,
  ctx?: ApplyEntityPreviewContext,
): DxfEntityUnion {
  if (!preview || preview.entityId !== entity.id) return entity;
  const { delta, gripIndex, movesEntity, edgeVertexIndices, stairGripKind, wallGripKind, beamGripKind, columnGripKind, foundationGripKind, slabGripKind, slabOpeningGripKind, roofGripKind, floorFinishGripKind, hatchGripKind, mepFixtureGripKind, electricalPanelGripKind, mepManifoldGripKind, mepSegmentGripKind, furnitureGripKind, textGripKind, lineGripKind, anchorPos, rotatePivot } = preview;
  if (delta.x === 0 && delta.y === 0) return entity;

  // ── ADR-363 Phase 1C — parametric wall live preview ───────────────────────
  if (wallGripKind && anchorPos && entity.type === 'wall') {
    const wall = entity as unknown as WallEntity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    // ADR-363 Phase 1G — `rotatePivot` (set only for the wall-rotation 3-click
    // hot-grip) rotates the ghost around the picked centre instead of the midpoint.
    const newParams = applyWallGripDrag(wallGripKind, { originalParams: wall.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === wall.params) return entity;
    const newGeometry = computeWallGeometry(newParams, wall.kind);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-397 — parametric column live preview (move / rotation / resize) ────
  // Mirror of the wall branch: routes through `applyColumnGripDrag` so the live
  // ghost matches the commit. `rotatePivot` (column-rotation 6-click) orbits the
  // picked centre; width/depth/center need no pivot. Without this branch columns
  // had ZERO live preview (commit worked on release only) → "δεν συμπεριφέρεται σωστά".
  if (columnGripKind && anchorPos && entity.type === 'column') {
    const col = entity as unknown as ColumnEntity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const newParams = applyColumnGripDrag(columnGripKind, { originalParams: col.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === col.params) return entity;
    const newGeometry = computeColumnGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-436 Slice 1b — parametric foundation pad live preview ──────────────
  // Mirror of the column branch: `applyFoundationGripDrag` (rotation / width-length
  // resize / Alt-move) so the live ghost matches the commit. `rotatePivot`
  // (foundation-rotation 6-click) orbits the picked centre.
  if (foundationGripKind && anchorPos && entity.type === 'foundation') {
    const foundation = entity as unknown as FoundationEntity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const newParams = applyFoundationGripDrag(foundationGripKind, { originalParams: foundation.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === foundation.params) return entity;
    const newGeometry = computeFoundationGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 5.5 — parametric beam live preview ──────────────────────
  // ADR-363 Phase 5.5d — `rotatePivot` (set only for the beam-rotation 6-click
  // hot-grip) orbits the ghost around the picked centre; `currentPos` lets the
  // pivot-rotate measure the swept angle. Move/start/end/curve/width/depth ignore
  // both (delta-driven). Mirror of the wall/column branch.
  if (beamGripKind && entity.type === 'beam') {
    const beam = entity as unknown as BeamEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyBeamGripDrag(beamGripKind, {
      originalParams: beam.params,
      delta,
      currentPos,
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === beam.params) return entity;
    const newGeometry = computeBeamGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-406 — parametric MEP fixture live preview (move / rotation / corner) ──
  // Mirror of the beam branch; ORTHO (F8) is read from `cadToggleState` so the
  // corner-resize ghost matches the commit. Without this branch the fixture only
  // updated on release (no live feedback).
  if (mepFixtureGripKind && entity.type === 'mep-fixture') {
    const fixture = entity as unknown as MepFixtureEntity;
    // ADR-397 — `rotatePivot` (set only for the mep-fixture-rotation 6-click
    // hot-grip) orbits the ghost around the picked centre; `currentPos` lets the
    // pivot-rotate measure the swept angle. Move/corner ignore both (delta-driven).
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyMepFixtureGripDrag(mepFixtureGripKind, {
      originalParams: fixture.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === fixture.params) return entity;
    const newGeometry = computeMepFixtureGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-408 Φ3 — parametric electrical panel live preview (move/rotation/corner) ──
  // Mirror of the MEP fixture branch; ORTHO (F8) is read from `cadToggleState` so
  // the corner-resize ghost matches the commit. `rotatePivot` (panel-rotation
  // 6-click) orbits the picked centre; move/corner ignore it (delta-driven).
  if (electricalPanelGripKind && entity.type === 'electrical-panel') {
    const panel = entity as unknown as ElectricalPanelEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyElectricalPanelGripDrag(electricalPanelGripKind, {
      originalParams: panel.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === panel.params) return entity;
    const newGeometry = computeElectricalPanelGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-408 Φ12 — parametric MEP manifold live preview (move/rotation/corner) ──
  // Mirror of the electrical panel branch; ORTHO (F8) is read from `cadToggleState`
  // so the corner-resize ghost matches the commit. `rotatePivot` (manifold-rotation
  // 6-click) orbits the picked centre; move/corner ignore it (delta-driven).
  if (mepManifoldGripKind && entity.type === 'mep-manifold') {
    const manifold = entity as unknown as MepManifoldEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyMepManifoldGripDrag(mepManifoldGripKind, {
      originalParams: manifold.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === manifold.params) return entity;
    const newGeometry = computeMepManifoldGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-408 Φ8 — parametric MEP segment live preview (start/end/midpoint/section/rotate) ──
  // Mirror of the beam branch: routes through `applyMepSegmentGripDrag` so the live
  // ghost matches the commit. `rotatePivot` (mep-segment-rotation 6-click) orbits the
  // picked centre; start/end/midpoint/section grips are purely delta-driven.
  if (mepSegmentGripKind && entity.type === 'mep-segment') {
    const seg = entity as unknown as MepSegmentEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyMepSegmentGripDrag(mepSegmentGripKind, {
      originalParams: seg.params,
      delta,
      currentPos,
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === seg.params) return entity;
    const newGeometry = computeMepSegmentGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-410 — parametric furniture live preview (move / rotation / corner) ──
  // Mirror of the electrical panel branch; ORTHO (F8) is read from `cadToggleState`
  // so the corner-resize ghost matches the commit. `rotatePivot` (furniture-rotation
  // 6-click) orbits the picked centre; move/corner ignore it (delta-driven).
  if (furnitureGripKind && entity.type === 'furniture') {
    const furniture = entity as unknown as FurnitureEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyFurnitureGripDrag(furnitureGripKind, {
      originalParams: furniture.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === furniture.params) return entity;
    const newGeometry = computeFurnitureGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 3.5 — parametric slab live preview ──────────────────────
  // entity IS the raw SlabEntity from scene.entities — access .params directly
  // (not via a DxfSlab wrapper; mirrors beam pattern).
  if (slabGripKind && entity.type === 'slab') {
    const slab = entity as unknown as SlabEntity;
    const newParams = applySlabGripDrag(slabGripKind, { originalParams: slab.params, delta });
    if (newParams === slab.params) return entity;
    // ADR-550 — recompute geometry so the WYSIWYG preview (real renderer reads
    // `.geometry`) tracks the reshape; the simplified ghost reads params and ignores this.
    return { ...(entity as object), params: newParams, geometry: computeSlabGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 3.7a — parametric slab-opening live preview ─────────────
  if (slabOpeningGripKind && entity.type === 'slab-opening') {
    const so = entity as unknown as SlabOpeningEntity;
    const newParams = applySlabOpeningGripDrag(slabOpeningGripKind, { originalParams: so.params, delta });
    if (newParams === so.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    return { ...(entity as object), params: newParams, geometry: computeSlabOpeningGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-417 Φ1-part-2 #2 — parametric roof live preview ───────────────────
  // entity IS the raw RoofEntity from scene.entities — access .params directly
  // (roof is a DIRECT entity, mirror slab/beam). Geometry is NOT recomputed here:
  // `draw-ghost-entity` paints the new footprint outline from params, so the
  // ghost follows the dragged vertex / inserted midpoint without the slope math.
  if (roofGripKind && entity.type === 'roof') {
    const roof = entity as unknown as RoofEntity;
    const newParams = applyRoofGripDrag(roofGripKind, { originalParams: roof.params, delta });
    if (newParams === roof.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    // Roof uses a straight-skeleton solve → heavier per-frame; browser-verify perf.
    return { ...(entity as object), params: newParams, geometry: computeRoofGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-419 — parametric floor-finish live preview ─────────────────────────
  // entity IS the raw FloorFinishEntity from scene.entities (DIRECT entity,
  // mirrors roof). Geometry is NOT recomputed here — the ghost renderer paints
  // the new footprint polygon from params, so the preview follows the dragged
  // vertex / inserted edge-midpoint without the tile-pattern math.
  if (floorFinishGripKind && entity.type === 'floor-finish') {
    const finish = entity as unknown as FloorFinishEntity;
    const newParams = applyFloorFinishGripDrag(floorFinishGripKind, { originalParams: finish.params, delta });
    if (newParams === finish.params) return entity;
    // ADR-550 — recompute geometry for the WYSIWYG preview (real renderer reads `.geometry`).
    return { ...(entity as object), params: newParams, geometry: computeFloorFinishGeometry(newParams) } as unknown as DxfEntityUnion;
  }

  // ── ADR-507 — parametric hatch live preview ────────────────────────────────
  // entity IS the raw HatchEntity (DIRECT entity, boundaryPaths at top level).
  // The ghost renderer repaints the outline from the new ring without re-running
  // the fill-pattern math.
  if (hatchGripKind && entity.type === 'hatch') {
    const hatch = entity as unknown as HatchEntity;
    // ADR-507 Φ5 A3 — gradient origin/seed grip: μετακινεί το patternOrigin, ΟΧΙ όριο.
    if (isHatchOriginGripKind(hatchGripKind)) {
      const current = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths);
      if (!current) return entity;
      const patternOrigin = applyHatchOriginGripDrag(current, { delta });
      return { ...(entity as object), patternOrigin } as unknown as DxfEntityUnion;
    }
    // ADR-507 Φ5 A4 — gradient-angle βραχίονας: περιστρέφει το gradient.angleDeg (όχι όριο).
    // Η live γωνία = atan2(anchor+delta − origin)· anchor = θέση της λαβής (SSoT pos fn).
    if (isHatchAngleGripKind(hatchGripKind)) {
      const gradient = hatch.gradient;
      if (!gradient) return entity;
      const origin = hatch.patternOrigin ?? hatchBoundsCenter(hatch.boundaryPaths);
      if (!origin) return entity;
      const anchor = hatchGradientAngleGripPos(origin, gradient.angleDeg ?? 0, hatch.boundaryPaths);
      if (!anchor) return entity;
      // Shift → snap σε 15° (preview === commit· ίδιο modifier με το commit path).
      const newAngle = applyHatchAngleGripDrag(
        origin, { x: anchor.x + delta.x, y: anchor.y + delta.y }, ShiftKeyTracker.getSnapshot(),
      );
      const newGradient = withGradientPatch(gradient, DEFAULT_GRADIENT_DEFAULTS, { field: 'angleDeg', value: newAngle });
      return { ...(entity as object), gradient: newGradient } as unknown as DxfEntityUnion;
    }
    const newBoundaryPaths = applyHatchGripDrag(hatchGripKind, { originalBoundaryPaths: hatch.boundaryPaths, delta });
    if (newBoundaryPaths === hatch.boundaryPaths) return entity;
    return { ...(entity as object), boundaryPaths: newBoundaryPaths } as unknown as DxfEntityUnion;
  }

  // ── ADR-557 — text/mtext rect-box live preview (move / rotation / resize) ──
  // Routes through the SAME `applyTextGripDrag` the commit runs (preview ≡ commit),
  // then folds the top-level patch onto the cloned `DxfText` so the ghost shows the
  // new position / rotation / height (+ width|widthFactor). `anchorPos` = the grabbed
  // grip world pos at mouseDown so the rotation sweep matches the commit. text-move
  // also routes here (its patch = position+delta) for one transform path, not two.
  // NOTE: `DxfEntityUnion` has no `mtext` variant — MTEXT is normalised to `'text'` at
  // scene→Dxf conversion (`dxf-text-entity-converter`), so `'text'` covers both here.
  if (textGripKind && entity.type === 'text') {
    const t = entity as unknown as DxfText;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const patch = applyTextGripDrag(textGripKind, { entity: t, delta, currentPos });
    if (Object.keys(patch).length === 0) return entity;
    return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Slice F — plain DXF line ROTATION live ghost ──────────────────
  // The line is a primitive (start/end, no params); the rotation ghost spins both
  // endpoints about `rotatePivot` (the picked centre) via the SAME shared
  // `rotateAxisPointsAboutPivot` SSoT the commit (RotateEntityCommand) runs, so the
  // preview ≡ commit. `anchorPos` = the reference anchor (swept angle starts at 0).
  // ⚠️ Slice G.5: gate to `'line-rotation'` ONLY — the MOVE grip (`'line-move'`) is a
  // whole-entity translate (movesEntity + edgeVertexIndices); it must fall through to
  // the `movesEntity` / classic ghost below (preview ≡ the centre midpoint grip), NOT
  // spin. A bare `if (lineGripKind)` rotated the move ghost.
  if (lineGripKind === 'line-rotation' && anchorPos && entity.type === 'line') {
    const line = entity as unknown as DxfLine;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const rotated = applyLineRotationDrag({ start: line.start, end: line.end, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (!rotated) return entity;
    return { ...(entity as object), start: rotated.start, end: rotated.end } as unknown as DxfEntityUnion;
  }

  // ── ADR-358 Phase 5d — parametric stair live preview ─────────────────────
  // Stair grips mutate `StairParams`; geometry is fully derived. Route
  // through the same SSoT pure helper the commit adapter uses, then re-derive
  // geometry. We expose the resulting entity in the same `DxfStair` wrapper
  // shape the canvas pipeline uses (`type: 'stair', stairEntity: {...}`),
  // so `drawGhostEntity` can find it via `entity.stairEntity.geometry`.
  if (stairGripKind && anchorPos) {
    const stair = unwrapStair(entity);
    if (!stair) return entity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const newParams = applyStairGripDrag(stairGripKind, {
      originalParams: stair.params,
      delta,
      currentPos,
      // ADR-393 v2 Phase 2 — multi-flight corner transforms read the last
      // flight's direction from the walkline; supply geometry so the live ghost
      // matches the commit path (otherwise an L/U/Γ end-corner preview would
      // decompose on flight-1's axis and snap on release).
      geometry: stair.geometry,
    });
    if (newParams === stair.params) return entity;
    const newGeometry = computeStairGeometry(newParams);
    const ghostStair: StairEntity = {
      ...stair,
      params: newParams,
      geometry: newGeometry,
    };
    return {
      ...(entity as object),
      type: 'stair',
      stairEntity: ghostStair,
    } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Φ1G.5 Slice 2 — hosted-opening Alt-move ghost (slide / re-host) ──
  // A hosted opening slides along its wall — or RE-HOSTS to another wall (Revit
  // «Pick New Host»). With the scene `walls` (ctx) + the grabbed base point
  // (`anchorPos`), resolve the move through the SAME SSoT as the commit
  // (`resolveOpeningAltMove`) and recompute the FULL geometry against the resolved
  // host (`computeOpeningGeometry`) — so the ghost shows the door symbol (swing
  // arc + leaf) on the new wall, auto-rotated + auto-thickness, matching the commit.
  if (movesEntity && entity.type === 'opening') {
    const opening = entity as unknown as OpeningEntity;
    const walls = ctx?.walls;
    if (walls && walls.length > 0 && anchorPos) {
      const currentHost = walls.find((w) => w.id === opening.params.wallId);
      if (currentHost) {
        const resolved = resolveOpeningAltMove({
          originalParams: opening.params,
          basePoint: anchorPos,
          currentPos: { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y },
          currentHost,
          candidateWalls: walls,
          rehostToleranceWorld: openingRehostToleranceWorld(currentHost),
        });
        if (!resolved) return entity;
        const geometry = computeOpeningGeometry(
          resolved.params,
          resolved.host,
          resolved.host.params.sceneUnits ?? 'mm',
        );
        return { ...(entity as object), params: resolved.params, geometry } as unknown as DxfEntityUnion;
      }
    }
    // Fallback (no scene walls supplied): outline-only slide constrained to the
    // opening's own axis (geometry.rotation, radians) so the ghost never flies
    // off the wall even without a host-wall lookup.
    const rot = opening.geometry?.rotation;
    if (rot === undefined) return entity;
    const axis: Point2D = { x: Math.cos(rot), y: Math.sin(rot) };
    const along = delta.x * axis.x + delta.y * axis.y;
    const slideVec: Point2D = { x: axis.x * along, y: axis.y * along };
    return applyClassicEntityPreview(entity, slideVec, gripIndex, true, edgeVertexIndices);
  }

  // ── ADR-363 Phase 1G.5 — Alt «move-from-characteristic-point» whole-entity ghost ──
  // Reached when the preview carries `movesEntity` + `delta` but NO parametric
  // gripKind (every kind-specific branch above returns first). Translate the WHOLE
  // BIM entity by `delta` through the move SSoT so the live ghost matches the commit
  // (`calculateBimMovedGeometry`). Non-BIM entities (line/circle/text) → null patch →
  // fall through to the classic translate path below. `opening` → `{}` (host-derived).
  if (movesEntity) {
    const bimPatch = calculateBimMovedGeometry(entity as unknown as Entity, delta);
    if (bimPatch && Object.keys(bimPatch).length > 0) {
      return { ...(entity as object), ...bimPatch } as unknown as DxfEntityUnion;
    }
  }

  // Classic (non-parametric) path: whole-translation, edge-stretch, vertex-stretch.
  return applyClassicEntityPreview(entity, delta, gripIndex, movesEntity, edgeVertexIndices);
}
