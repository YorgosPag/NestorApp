/**
 * SSOT — EntityPreviewTransform type
 *
 * Per-entity drag-preview descriptor shared by `applyEntityPreview` and its
 * callers (Move tool, grip drag). Extracted from `apply-entity-preview.ts`
 * (2026-06-04 file-size split) — pure types, no logic.
 *
 * @see rendering/ghost/apply-entity-preview — consumer
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
import type {
  StairGripKind,
  ColumnGripKind,
  FoundationGripKind,
  BeamGripKind,
  SlabGripKind,
  SlabOpeningGripKind,
  RoofGripKind,
  FloorFinishGripKind,
  HatchGripKind,
  MepFixtureGripKind,
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  MepSegmentGripKind,
  FurnitureGripKind,
  LineGripKind,
  ArcGripKind,
  TextGripKind,
} from '../../hooks/grip-types';
import type { WallGripKind } from '../../hooks/useGripMovement';

/**
 * Per-entity preview transform. Structurally compatible with `DxfGripDragPreview`
 * (the grip system's projection) so callers can pass the value through without
 * re-mapping.
 *
 * Semantics:
 *  - `movesEntity=true`        → translate every coordinate by `delta`
 *  - `edgeVertexIndices`       → translate exactly two vertices (edge stretch)
 *  - otherwise (`gripIndex`)   → stretch single vertex / quadrant / arc end
 */
export interface EntityPreviewTransform {
  readonly entityId: string;
  readonly gripIndex: number;
  readonly delta: Point2D;
  readonly movesEntity: boolean;
  readonly edgeVertexIndices?: readonly [number, number];
  /**
   * ADR-358 Phase 5d — parametric stair discriminator + anchor. When set,
   * `applyEntityPreview` routes through `applyStairGripDrag` to compute new
   * `StairParams`, recomputes `StairGeometry`, and returns a wrapped stair
   * ghost. Anchor is the grip world position captured at mouseDown.
   */
  readonly stairGripKind?: StairGripKind;
  /**
   * ADR-363 Phase 1C — parametric wall discriminator. Routes preview through
   * `applyWallGripDrag` + `computeWallGeometry` (mirrors stair pattern).
   */
  readonly wallGripKind?: WallGripKind;
  /**
   * ADR-363 Phase 1G — rotation centre for the `wall-rotation` 3-click hot-grip.
   * Passed to `applyWallGripDrag` as `pivot` so the live ghost rotates around the
   * picked centre instead of the wall midpoint.
   */
  readonly rotatePivot?: Point2D;
  readonly beamGripKind?: BeamGripKind;
  /**
   * ADR-397 — parametric column discriminator. Routes preview through
   * `applyColumnGripDrag` + `computeColumnGeometry` (mirrors wall). With
   * `rotatePivot` set (column-rotation 6-click) the ghost orbits the picked centre.
   */
  readonly columnGripKind?: ColumnGripKind;
  /**
   * ADR-436 Slice 1b — parametric foundation discriminator. Routes preview through
   * `applyFoundationGripDrag` + `computeFoundationGeometry`. With `rotatePivot`
   * set (foundation-rotation 6-click) the ghost orbits the picked centre.
   */
  readonly foundationGripKind?: FoundationGripKind;
  readonly slabGripKind?: SlabGripKind;
  readonly slabOpeningGripKind?: SlabOpeningGripKind;
  /**
   * ADR-417 Φ1-part-2 #2 — parametric roof discriminator. Routes preview through
   * `applyRoofGripDrag` (params-only); the ghost is the new footprint outline.
   */
  readonly roofGripKind?: RoofGripKind;
  /**
   * ADR-419 — parametric floor-finish discriminator. Routes preview through
   * `applyFloorFinishGripDrag` (params-only); the ghost is the new footprint outline.
   */
  readonly floorFinishGripKind?: FloorFinishGripKind;
  /** ADR-507 — hatch boundary grip discriminator (live outline ghost). */
  readonly hatchGripKind?: HatchGripKind;
  /**
   * ADR-406 — parametric MEP fixture discriminator. Routes preview through
   * `applyMepFixtureGripDrag` + `computeMepFixtureGeometry`. ORTHO (F8) is read
   * from `cadToggleState` so the corner-resize ghost matches the commit.
   */
  readonly mepFixtureGripKind?: MepFixtureGripKind;
  /**
   * ADR-408 Φ3 — parametric electrical panel discriminator. Routes preview
   * through `applyElectricalPanelGripDrag` + `computeElectricalPanelGeometry`.
   * ORTHO (F8) is read from `cadToggleState` so the corner-resize ghost matches
   * the commit. With `rotatePivot` set (panel-rotation 6-click) the ghost orbits
   * the picked centre.
   */
  readonly electricalPanelGripKind?: ElectricalPanelGripKind;
  /**
   * ADR-408 Φ12 — parametric MEP manifold discriminator. Routes preview
   * through `applyMepManifoldGripDrag` + `computeMepManifoldGeometry`.
   * ORTHO (F8) is read from `cadToggleState` so the corner-resize ghost matches
   * the commit. With `rotatePivot` set (manifold-rotation 6-click) the ghost orbits
   * the picked centre.
   */
  readonly mepManifoldGripKind?: MepManifoldGripKind;
  /**
   * ADR-408 Φ8 — parametric MEP segment discriminator. Routes preview through
   * `applyMepSegmentGripDrag` + `computeMepSegmentGeometry`. With `rotatePivot`
   * set (mep-segment-rotation 6-click) the ghost orbits the picked centre.
   */
  readonly mepSegmentGripKind?: MepSegmentGripKind;
  /**
   * ADR-410 — parametric furniture discriminator. Routes preview through
   * `applyFurnitureGripDrag` + `computeFurnitureGeometry`. ORTHO (F8) is read
   * from `cadToggleState` so the corner-resize ghost matches the commit.
   * With `rotatePivot` set (furniture-rotation 6-click) the ghost orbits the
   * picked centre.
   */
  readonly furnitureGripKind?: FurnitureGripKind;
  /**
   * ADR-557 — parametric text/mtext discriminator. Routes preview through
   * `applyTextGripDrag` (the SAME pure transform the commit runs) to produce the
   * live box ghost — move / rotation (pivot = bbox-centre) / corner+edge resize.
   * `anchorPos` = the grabbed grip world pos at mouseDown (rotation sweep start).
   */
  readonly textGripKind?: TextGripKind;
  /**
   * ADR-363 Slice F — plain DXF line rotation discriminator. Routes preview
   * through `applyLineRotationDrag` (the SAME shared `rotateAxisPointsAboutPivot`
   * the commit runs) so the live ghost rotates start/end about `rotatePivot`
   * (the picked centre) exactly like the wall. `anchorPos` = the reference anchor.
   */
  readonly lineGripKind?: LineGripKind;
  /**
   * ADR-561 — plain DXF arc rotation discriminator. Routes preview through
   * `applyArcRotationDrag` (the SAME `sweptAngleDegAboutPivot` + `rotateEntity`-arc
   * primitives the commit runs) so the live ghost rotates the arc about `rotatePivot`
   * (its centre) exactly like the line. `anchorPos` = the reference anchor (sweep start).
   */
  readonly arcGripKind?: ArcGripKind;
  readonly anchorPos?: Point2D;
}
