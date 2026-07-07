/**
 * DXF GRIP COMPUTATION — SHARED TYPES
 *
 * Type declarations for the grip interaction / drag-preview pipeline.
 * Extracted from `grip-computation.ts` (pure type defs, no logic) so the
 * computation module stays under the 500-line limit. Re-exported from
 * `grip-computation.ts` for backwards-compatible import paths.
 *
 * @module hooks/grip-computation-types
 */

import type { Point2D } from '../rendering/types/Types';
import type { StairGripKind, WallGripKind } from './useGripMovement';
import type { ColumnGripKind, FoundationGripKind, BeamGripKind, SlabGripKind, SlabOpeningGripKind, RoofGripKind, OpeningGripKind, MepFixtureGripKind, ElectricalPanelGripKind, MepManifoldGripKind, MepRadiatorGripKind, MepBoilerGripKind, MepWaterHeaterGripKind, FurnitureGripKind, FloorplanSymbolGripKind, MepSegmentGripKind, FloorFinishGripKind, HatchGripKind, MepUnderfloorGripKind, DimensionGripKind, LineGripKind, ArcGripKind, PolylineGripKind, GroupGripKind, TextGripKind } from './grip-types';

// ============================================================================
// TYPES (still used by grips/ modules and CanvasLayerStack)
// ============================================================================

/** Interaction phase of the grip state machine */
export type GripPhase = 'idle' | 'hovering' | 'warm' | 'dragging';

/** Unique grip identifier for rendering pipeline */
export interface GripIdentifier {
  entityId: string;
  gripIndex: number;
}

/** Drag preview data for live rendering */
export interface DxfGripDragPreview {
  entityId: string;
  gripIndex: number;
  delta: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
  /**
   * ADR-358 Phase 5d — parametric stair drag-preview discriminator. Set when
   * the active grip is a `stair-*` kind; consumed by `applyEntityPreview` to
   * route through `applyStairGripDrag` + `computeStairGeometry` for the live
   * ghost. `anchorPos` carries the grip world position captured at mouseDown
   * so the preview can reconstruct `currentPos = anchorPos + delta` (the same
   * value the commit path uses).
   */
  stairGripKind?: StairGripKind;
  anchorPos?: Point2D;
  /**
   * ADR-363 Phase 1C — parametric wall grip discriminator. Routes live preview
   * through `applyWallGripDrag` + `computeWallGeometry` (mirrors stair pattern).
   */
  wallGripKind?: WallGripKind;
  /**
   * ADR-363 Phase 4.5c.5 — parametric column/beam grip discriminators. Set
   * when the active grip is a dimensional column or beam grip; consumed by
   * `useGripDimAnnotation` to render a live "w=350mm" label on the preview
   * canvas. Non-dimensional grips (center, rotation, start/end) are omitted.
   */
  columnGripKind?: ColumnGripKind;
  /**
   * ADR-436 Slice 1b — parametric foundation grip discriminator. Routes the live
   * ghost through `applyFoundationGripDrag` + `computeFoundationGeometry`, and
   * drives the "w=350" / "l=400" dim label via `useGripDimAnnotation`.
   */
  foundationGripKind?: FoundationGripKind;
  beamGripKind?: BeamGripKind;
  slabGripKind?: SlabGripKind;
  slabOpeningGripKind?: SlabOpeningGripKind;
  openingGripKind?: OpeningGripKind;
  /**
   * ADR-406 — parametric MEP fixture grip discriminator. Routes the live ghost
   * through `applyMepFixtureGripDrag` + `computeMepFixtureGeometry`.
   */
  mepFixtureGripKind?: MepFixtureGripKind;
  /**
   * ADR-408 Φ3 — parametric electrical panel grip discriminator. Routes the live
   * ghost through `applyElectricalPanelGripDrag` + `computeElectricalPanelGeometry`.
   */
  electricalPanelGripKind?: ElectricalPanelGripKind;
  /**
   * ADR-408 Φ12 — parametric MEP manifold grip discriminator. Routes the live
   * ghost through `applyMepManifoldGripDrag` + `computeMepManifoldGeometry`.
   */
  mepManifoldGripKind?: MepManifoldGripKind;
  /**
   * ADR-408 Εύρος Β — parametric heating radiator grip discriminator. Routes the
   * live ghost through `applyMepRadiatorGripDrag` + `computeMepRadiatorGeometry`.
   */
  mepRadiatorGripKind?: MepRadiatorGripKind;
  /**
   * ADR-408 Εύρος Β #2 — parametric heating boiler grip discriminator. Routes the
   * live ghost through `applyMepBoilerGripDrag` + `computeMepBoilerGeometry`.
   */
  mepBoilerGripKind?: MepBoilerGripKind;
  /**
   * ADR-408 DHW — parametric domestic hot water heater grip discriminator. Routes the
   * live ghost through `applyMepWaterHeaterGripDrag` + `computeMepWaterHeaterGeometry`.
   */
  mepWaterHeaterGripKind?: MepWaterHeaterGripKind;
  /**
   * ADR-410 — parametric furniture grip discriminator. Routes the live ghost
   * through `applyFurnitureGripDrag` + `computeFurnitureGeometry`.
   */
  furnitureGripKind?: FurnitureGripKind;
  /**
   * ADR-415 — parametric floorplan-symbol grip discriminator. Routes the live ghost
   * through `applyFloorplanSymbolGripDrag` + `computeFloorplanSymbolGeometry`.
   */
  floorplanSymbolGripKind?: FloorplanSymbolGripKind;
  /**
   * ADR-408 Φ8 — parametric MEP segment grip discriminator. Routes the live ghost
   * through `applyMepSegmentGripDrag` + `computeMepSegmentGeometry`.
   */
  mepSegmentGripKind?: MepSegmentGripKind;
  /**
   * ADR-417 Φ1-part-2 #2 — parametric roof grip discriminator. Routes the live
   * ghost through `applyRoofGripDrag` (params-only; `draw-ghost-entity` paints
   * the new footprint outline).
   */
  roofGripKind?: RoofGripKind;
  /**
   * ADR-419 — parametric floor-finish grip discriminator. Routes the live ghost
   * through `applyFloorFinishGripDrag` (params-only; footprint polygon redrawn).
   */
  floorFinishGripKind?: FloorFinishGripKind;
  /**
   * ADR-507 — hatch boundary grip discriminator. Routes the live ghost through
   * `applyHatchGripDrag` (boundaryPaths-only; outline redrawn from the new ring).
   */
  hatchGripKind?: HatchGripKind;
  /**
   * ADR-362 Phase I (Round 22) — dimension grip discriminator. Set when the active
   * grip is a `dim-*` kind; consumed by `useDimGripGhostPreview` to render the live
   * dimension ghost via `applyDimensionGripDrag` + `renderPreviewDimension` (preview
   * ≡ commit — the SAME pure transform `commitDimensionGripDrag` runs on release).
   * `anchorPos` carries the grip world position at mouseDown (used as `gripPos` for
   * the linear rotation handle, matching the commit's `grip.position`).
   */
  dimGripKind?: DimensionGripKind;
  /**
   * ADR-408 Εύρος Β #3 — parametric underfloor heating loop grip discriminator.
   * Routes the live ghost through `applyMepUnderfloorGripDrag` (params-only;
   * footprint polygon + serpentine path redrawn).
   */
  mepUnderfloorGripKind?: MepUnderfloorGripKind;
  /**
   * ADR-557 — parametric text/mtext grip discriminator. Routes the live ghost
   * through `applyTextGripDrag` (the SAME pure transform the commit runs), so the
   * dragged box (corner/edge resize, move, rotation) is byte-identical preview ≡
   * commit. `anchorPos` carries the grip world position at mouseDown so the
   * rotation sweep can reconstruct the start angle around the bbox-center.
   */
  textGripKind?: TextGripKind;
  /**
   * ADR-363 Slice F — plain DXF line rotation discriminator. Routes the live ghost
   * through `applyLineRotationDrag` (the SAME shared `rotateAxisPointsAboutPivot`
   * the commit runs), so the spinning line is byte-identical preview ≡ commit.
   * `anchorPos` carries the reference anchor so the swept angle starts at 0.
   */
  lineGripKind?: LineGripKind;
  /**
   * ADR-561 — plain DXF arc rotation discriminator (forwarded from `UnifiedGripInfo.
   * arcGripKind` via `buildRotateReferencePreview`). Routes the live ghost through the
   * shared `applyPrimitiveRotationDrag` → `rotateEntity` the commit runs, so preview ≡
   * commit by identity. `anchorPos` carries the reference anchor (sweep 0).
   */
  arcGripKind?: ArcGripKind;
  /**
   * ADR-561 — plain DXF polyline/rectangle rotation discriminator (forwarded from
   * `UnifiedGripInfo.polylineGripKind` via `buildRotateReferencePreview`). Routes the live
   * ghost through the SAME shared `applyPrimitiveRotationDrag` → `rotateEntity` (rotate
   * every vertex) the commit runs, so preview ≡ commit by identity. `anchorPos` carries
   * the reference anchor (sweep 0).
   */
  polylineGripKind?: PolylineGripKind;
  /**
   * ADR-575 §8 — GROUP gizmo discriminator (forwarded from `UnifiedGripInfo.groupGripKind`
   * via `buildDxfDragPreview` / `buildRotateReferencePreview`). Routes the live ghost
   * through the SAME `calculateMovedGeometry` (move) / `applyPrimitiveRotationDrag` →
   * `rotateEntity` case 'group' (rotation) the commit runs, so preview ≡ commit by
   * identity — every member translated / rotated. `anchorPos` carries the reference anchor.
   */
  groupGripKind?: GroupGripKind;
  /**
   * ADR-363 Phase 1G — set when the active grip is a wall corner being moved via
   * the hot-grip (click-click) state. Consumed by `useGripGhostPreview` to draw
   * the dashed rubber-band leader from `anchorPos` → cursor (anchorPos + delta).
   */
  hotGrip?: boolean;
  /**
   * ADR-363 Phase 1G — rotation centre for the `wall-rotation` hot-grip. When set
   * the live ghost rotates around it (passed to `applyWallGripDrag` as `pivot`).
   */
  rotatePivot?: Point2D;
  /**
   * ADR-363 Phase 1G.3 — rotate-reference (6-click) guide segments, drawn dashed
   * by `useGripGhostPreview` (display-only; NOT consumed by `applyEntityPreview`).
   * `rotateRefLine` = the existing/reference direction the user traced (2 clicks);
   * `rotateAlignLine` = the target/alignment direction being traced live. The wall
   * spins by `angle(align) − angle(ref)` around `rotatePivot`.
   */
  rotateRefLine?: { from: Point2D; to: Point2D };
  rotateAlignLine?: { from: Point2D; to: Point2D };
  /**
   * ADR-397 Σ3 — signed sweep angle (degrees, +CCW/−CW) of a FREE rotate, for the
   * live ON-CURSOR angle readout drawn by `useGripGhostPreview`. Set from the cursor
   * sweep, or overridden by the typed angle while the user is keying one in.
   */
  rotateSweepDeg?: number;
  /** ADR-397 Σ3 — world anchor (the cursor) for the rotate angle readout pill. */
  rotateReadoutAnchor?: Point2D;
  /**
   * ADR-040 Φ12 — set when this rotation sweep is CURSOR-DRIVEN (free rotate, or the
   * 6-click reference `await-align-end` step), as opposed to a keyed-in typed angle.
   * Lets `useGripGhostPreview` recompute the sweep LIVE from the realtime effective-world
   * cursor (`resolveLiveRotationFromCursor`) so the rotating ghost is locked 1:1 to the
   * crosshair — same as translate. NOT set for typed-angle (the value is keyed, not the
   * cursor) → that flow keeps the React `dragPreview`.
   */
  rotateCursorDriven?: boolean;
}

/** Grip interaction state for rendering pipeline */
export interface DxfGripInteractionState {
  hoveredGrip?: GripIdentifier;
  activeGrip?: GripIdentifier;
  /**
   * ADR-501 — grip keys (`${entityId}_${gripIndex}`) clicked-to-select for a
   * multi-grip move → render orange ('armed'). Fed from {@link GripArmedStore}.
   */
  armedKeys?: ReadonlySet<string>;
}

/** Return type of useDxfGripInteraction */
export interface UseDxfGripInteractionReturn {
  gripInteractionState: DxfGripInteractionState;
  isDraggingGrip: boolean;
  /** @deprecated Use isDraggingGrip */
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  /** @deprecated No-op in drag-release model */
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}
