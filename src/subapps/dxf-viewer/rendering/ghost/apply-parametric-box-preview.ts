/**
 * SSOT — apply-parametric-box-preview
 *
 * The "box-like" parametric BIM grip-drag preview branches, extracted from
 * `apply-entity-preview.ts` to keep that file under the 500-line Google limit
 * (SOS N.7.1). Each branch is a near-identical mirror of its commit path
 * (`applyXGripDrag` → `computeXGeometry`) so the live ghost ≡ the committed
 * result: move / rotation (`rotatePivot`) / corner-resize (ORTHO via
 * `cadToggleState`).
 *
 * Returns `null` when the preview does not target one of these entity kinds, so
 * the caller falls through to the next branch group unchanged. Returns the
 * (possibly unchanged) entity otherwise — exactly the semantics the inline
 * branches had.
 *
 * @see rendering/ghost/apply-entity-preview — consumer
 * @see ADR-397 / ADR-406 / ADR-408 / ADR-410 / ADR-436 — per-kind grip preview
 */

import type { Point2D } from '../types/Types';
// SSoT — canonical point translation (ADR-577 consolidation).
import { translatePoint } from '../entities/shared/geometry-vector-utils';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import type { BeamEntity } from '../../bim/types/beam-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import type { ColumnEntity } from '../../bim/types/column-types';
import { applyFoundationGripDrag } from '../../bim/foundations/foundation-grips';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';
import type { FoundationEntity } from '../../bim/types/foundation-types';
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
import { applyGenericSolidGripDrag } from '../../bim/entities/generic-solid/generic-solid-grips';
import { computeGenericSolidGeometry } from '../../bim/entities/generic-solid/generic-solid-geometry';
import type { GenericSolidEntity } from '../../bim/entities/generic-solid/generic-solid-types';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import type { EntityPreviewTransform } from './entity-preview-types';
import { gripKindOf } from '../../hooks/grip-kinds';

/**
 * Apply the box-like parametric grip-drag preview for column / foundation /
 * beam / MEP fixture / electrical panel / MEP manifold / MEP segment /
 * furniture. Returns the transformed (or unchanged) entity when the preview
 * targets one of these kinds, else `null` to signal "not handled here".
 */
export function applyParametricBoxPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
): DxfEntityUnion | null {
  const { delta, anchorPos, rotatePivot } = preview;
  // ADR-602 Stage 4 — read each discriminator via the tagged SSoT accessor (populated by
  // `toEntityPreviewTransform` beside the legacy fields). Same names + types → dispatch below unchanged.
  const beamGripKind = gripKindOf(preview, 'beam');
  const columnGripKind = gripKindOf(preview, 'column');
  const foundationGripKind = gripKindOf(preview, 'foundation');
  const mepFixtureGripKind = gripKindOf(preview, 'mep-fixture');
  const electricalPanelGripKind = gripKindOf(preview, 'electrical-panel');
  const mepManifoldGripKind = gripKindOf(preview, 'mep-manifold');
  const mepSegmentGripKind = gripKindOf(preview, 'mep-segment');
  const furnitureGripKind = gripKindOf(preview, 'furniture');
  const genericSolidGripKind = gripKindOf(preview, 'generic-solid');

  // ── ADR-397 — parametric column live preview (move / rotation / resize) ────
  // Mirror of the wall branch: routes through `applyColumnGripDrag` so the live
  // ghost matches the commit. `rotatePivot` (column-rotation 6-click) orbits the
  // picked centre; width/depth/center need no pivot. Without this branch columns
  // had ZERO live preview (commit worked on release only) → "δεν συμπεριφέρεται σωστά".
  if (columnGripKind && anchorPos && entity.type === 'column') {
    const col = entity as unknown as ColumnEntity;
    const currentPos: Point2D = translatePoint(anchorPos, delta);
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
    const currentPos: Point2D = translatePoint(anchorPos, delta);
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
      ? translatePoint(anchorPos, delta)
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
      ? translatePoint(anchorPos, delta)
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
      ? translatePoint(anchorPos, delta)
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
      ? translatePoint(anchorPos, delta)
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
      ? translatePoint(anchorPos, delta)
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
      ? translatePoint(anchorPos, delta)
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

  // ── ADR-684 Φ2/Φ3 — parametric generic-solid live preview (move / rotation / box corner) ──
  // Mirror of the furniture branch; ORTHO (F8) από το `cadToggleState` ώστε το corner-resize ghost
  // να ισούται με το commit. `rotatePivot` (generic-solid-rotation 6-click) περιστρέφει περί το
  // επιλεγμένο κέντρο. Οι γωνιακές λαβές εκπέμπονται μόνο για box· τα άλλα σχήματα παίρνουν
  // μόνο move/rotation, ίδια διαδρομή.
  if (genericSolidGripKind && entity.type === 'generic-solid') {
    const solid = entity as unknown as GenericSolidEntity;
    const currentPos: Point2D = anchorPos
      ? translatePoint(anchorPos, delta)
      : { x: delta.x, y: delta.y };
    const newParams = applyGenericSolidGripDrag(genericSolidGripKind, {
      originalParams: solid.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === solid.params) return entity;
    const newGeometry = computeGenericSolidGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  return null;
}
