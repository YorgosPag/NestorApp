/**
 * Grip type definitions — extracted from useGripMovement.ts (SRP, ADR-358 Phase 5b).
 * Consumed by useGripMovement, grip-registry, unified-grip-types, stair-grips, dimension-grips.
 *
 * The per-entity parametric grip-kind discriminator unions live in `grip-kinds.ts`
 * (SRP / Google file-size standard N.7.1) and are re-exported here so existing
 * `import { WallGripKind } from '../grip-types'` call-sites keep working unchanged.
 */

import type { Point2D } from '../rendering/types/Types';
import type {
  GripType,
  StairGripKind,
  DimensionGripKind,
  WallGripKind,
  OpeningGripKind,
  SlabGripKind,
  SlabOpeningGripKind,
  RoofGripKind,
  FloorFinishGripKind,
  HatchGripKind,
  MepUnderfloorGripKind,
  BeamGripKind,
  ColumnGripKind,
  FoundationGripKind,
  MepFixtureGripKind,
  ElectricalPanelGripKind,
  MepManifoldGripKind,
  MepRadiatorGripKind,
  MepBoilerGripKind,
  MepWaterHeaterGripKind,
  FurnitureGripKind,
  FloorplanSymbolGripKind,
  MepSegmentGripKind,
  XLineGripKind,
  RayGripKind,
  PolylineGripKind,
  CircleGripKind,
  ArcGripKind,
  LineGripKind,
  GroupGripKind,
  AnnotationSymbolGripKind,
  TextGripKind,
} from './grip-kinds';

// Re-export the grip-kind unions for backward compatibility (call-sites import
// these from `grip-types`). `export type *` mirrors the import list above without
// re-typing the 33 names — ADR-583 / N.18, no parallel twin list.
export type * from './grip-kinds';

/** Grip information */
export interface GripInfo {
  entityId: string;
  gripIndex: number;
  type: GripType;
  position: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
  /**
   * ADR-358 Phase 5b — parametric stair grip discriminator. Present only when
   * the grip belongs to a `StairEntity`; routes the commit through
   * `applyStairGripDrag()` + `UpdateStairParamsCommand` instead of the
   * standard `StretchEntityCommand` vertex path.
   */
  stairGripKind?: StairGripKind;
  /**
   * ADR-362 Phase I2 — dimension grip discriminator. Present only when
   * the grip belongs to a `DxfDimension`; routes commit through
   * `applyDimensionGripDrag()` + direct scene patch.
   */
  dimGripKind?: DimensionGripKind;
  /**
   * ADR-363 Phase 1C — parametric wall grip discriminator. Present only when
   * the grip belongs to a `WallEntity`; routes the commit through
   * `applyWallGripDrag()` + `UpdateWallParamsCommand` instead of the standard
   * `StretchEntityCommand` vertex path.
   */
  wallGripKind?: WallGripKind;
  /**
   * ADR-363 Phase 2.5 — parametric opening grip discriminator. Present only
   * when the grip belongs to an `OpeningEntity`; routes the commit through
   * `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand` (drag-along-wall).
   */
  openingGripKind?: OpeningGripKind;
  /**
   * ADR-363 Phase 3.5 — parametric slab grip discriminator. Present only when
   * the grip belongs to a `SlabEntity`; routes the commit through
   * `applySlabGripDrag()` + `UpdateSlabParamsCommand` (per-vertex translate).
   */
  slabGripKind?: SlabGripKind;
  /**
   * ADR-363 Phase 3.7a — parametric slab-opening grip discriminator. Present
   * only when the grip belongs to a `SlabOpeningEntity`; routes the commit
   * through `applySlabOpeningGripDrag()` + `UpdateSlabOpeningParamsCommand`
   * (per-vertex translate + edge-midpoint insertion).
   */
  slabOpeningGripKind?: SlabOpeningGripKind;
  /**
   * ADR-417 Φ1-part-2 #2 — parametric roof grip discriminator. Present only when
   * the grip belongs to a `RoofEntity`; routes the commit through
   * `applyRoofGripDrag()` + `UpdateRoofParamsCommand` (per-vertex translate +
   * edge-midpoint insertion, `edges` kept in lockstep with `outline.vertices`).
   */
  roofGripKind?: RoofGripKind;
  /**
   * ADR-419 — floor finish polygon grip discriminator. Present only when the
   * grip belongs to a `FloorFinishEntity`; routes the commit through
   * `applyFloorFinishGripDrag()` + `UpdateFloorFinishParamsCommand`
   * (per-vertex translate + edge-midpoint insertion).
   */
  floorFinishGripKind?: FloorFinishGripKind;
  /**
   * ADR-507 — hatch boundary grip discriminator. Present only when the grip
   * belongs to a `HatchEntity`; routes the commit through `applyHatchGripDrag()`
   * + `UpdateHatchBoundaryCommand` (per-vertex translate on `boundaryPaths`).
   */
  hatchGripKind?: HatchGripKind;
  /**
   * ADR-408 Εύρος Β #3 — underfloor heating loop polygon grip discriminator.
   * Present only when the grip belongs to a `MepUnderfloorEntity`; routes the
   * commit through `applyMepUnderfloorGripDrag()` +
   * `UpdateMepUnderfloorParamsCommand` (per-vertex translate + edge-midpoint
   * insertion, mirrors floor-finish / slab pattern). After each drag,
   * `buildUnderfloorConnectors` re-derives the two hydronic connectors.
   */
  mepUnderfloorGripKind?: MepUnderfloorGripKind;
  /**
   * ADR-363 Phase 5.5a — parametric beam grip discriminator. Present only when
   * the grip belongs to a `BeamEntity`; routes the commit through
   * `applyBeamGripDrag()` + `UpdateBeamParamsCommand` (start/end/midpoint
   * translate + curve control move).
   */
  beamGripKind?: BeamGripKind;
  /**
   * ADR-363 Phase 4.5 — parametric column grip discriminator. Present only when
   * the grip belongs to a `ColumnEntity`; routes the commit through
   * `applyColumnGripDrag()` + `UpdateColumnParamsCommand` (center translate +
   * rotation + width/depth resize).
   */
  columnGripKind?: ColumnGripKind;
  /**
   * ADR-436 Slice 1b — parametric foundation grip discriminator. Present only
   * when the grip belongs to a `FoundationEntity`; routes the commit through
   * `applyFoundationGripDrag()` + `UpdateFoundationParamsCommand` (rotation +
   * width/length resize; Alt+drag whole-entity move). pad = width × length.
   */
  foundationGripKind?: FoundationGripKind;
  /**
   * ADR-406 — parametric MEP fixture grip discriminator. Present only when the
   * grip belongs to a `MepFixtureEntity`; routes the commit through
   * `applyMepFixtureGripDrag()` + `UpdateMepFixtureParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  mepFixtureGripKind?: MepFixtureGripKind;
  /**
   * ADR-408 Φ3 — parametric electrical panel grip discriminator. Present only
   * when the grip belongs to an `ElectricalPanelEntity`; routes the commit
   * through `applyElectricalPanelGripDrag()` + `UpdateElectricalPanelParamsCommand`
   * (center translate + rotation + opposite-corner-anchored width/length resize).
   */
  electricalPanelGripKind?: ElectricalPanelGripKind;
  /**
   * ADR-408 Φ12 — parametric plumbing manifold grip discriminator. Present only
   * when the grip belongs to a `MepManifoldEntity`; routes the commit through
   * `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  mepManifoldGripKind?: MepManifoldGripKind;
  /**
   * ADR-408 Εύρος Β #1 — parametric heating radiator grip discriminator. Present
   * only when the grip belongs to a `MepRadiatorEntity`; routes the commit through
   * `applyMepRadiatorGripDrag()` + `UpdateMepRadiatorParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  mepRadiatorGripKind?: MepRadiatorGripKind;
  /**
   * ADR-408 Εύρος Β #2 — parametric heating boiler grip discriminator. Present
   * only when the grip belongs to a `MepBoilerEntity`; routes the commit through
   * `applyMepBoilerGripDrag()` + `UpdateMepBoilerParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  mepBoilerGripKind?: MepBoilerGripKind;
  /**
   * ADR-408 DHW — parametric domestic hot water heater grip discriminator. Present
   * only when the grip belongs to a `MepWaterHeaterEntity`; routes the commit through
   * `applyMepWaterHeaterGripDrag()` + `UpdateMepWaterHeaterParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  mepWaterHeaterGripKind?: MepWaterHeaterGripKind;
  /**
   * ADR-410 — parametric furniture grip discriminator. Present only when the
   * grip belongs to a `FurnitureEntity`; routes the commit through
   * `applyFurnitureGripDrag()` + `UpdateFurnitureParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/depth resize).
   */
  furnitureGripKind?: FurnitureGripKind;
  /**
   * ADR-415 — parametric floorplan-symbol grip discriminator. Present only when
   * the grip belongs to a `FloorplanSymbolEntity`; routes the commit through
   * `applyFloorplanSymbolGripDrag()` + `UpdateFloorplanSymbolParamsCommand`
   * (centre translate + rotation + opposite-corner-anchored width/depth resize).
   */
  floorplanSymbolGripKind?: FloorplanSymbolGripKind;
  /**
   * ADR-408 Φ8 — parametric MEP segment grip discriminator. Present only when
   * the grip belongs to a `MepSegmentEntity`; routes the commit through
   * `applyMepSegmentGripDrag()` + `UpdateMepSegmentParamsCommand` (start/end/
   * midpoint translate + section resize + rotation).
   */
  mepSegmentGripKind?: MepSegmentGripKind;
  /**
   * ADR-359 Phase 11 — XLine grip discriminator. Present only when the grip
   * belongs to an `XLineEntity`; routes commit through `applyXLineGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  xlineGripKind?: XLineGripKind;
  /**
   * ADR-359 Phase 11 — Ray grip discriminator. Present only when the grip
   * belongs to a `RayEntity`; routes commit through `applyRayGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  rayGripKind?: RayGripKind;
  /**
   * ADR-510 Φ3c — multifunctional polyline grip discriminator. Present only when
   * the grip belongs to a plain DXF `polyline`; drives the polyline-ops context
   * menu (Add / Remove / Convert-to-Arc / Convert-to-Line) and routes arc-apex
   * drags through `commitPolylineBulgeGripDrag()` + `SetBulgeCommand` (live bulge
   * curvature). Straight-segment grips keep the standard stretch/move path.
   */
  polylineGripKind?: PolylineGripKind;
  /**
   * ADR-561 — circle grip discriminator. Present only on the centre grip of a
   * plain DXF `circle` (`'circle-move'`); opts it into the SHARED move pipeline
   * (4-arrow glyph + per-arm directional prompt + whole-entity translate). The
   * circle is symmetric → no rotation kind (parity με κυκλική κολόνα ADR-519).
   */
  circleGripKind?: CircleGripKind;
  /**
   * ADR-561 — arc grip discriminator. Present on the centre MOVE (`'arc-move'`)
   * and the rotation handle (`'arc-rotation'`) of a plain DXF `arc`. Move → shared
   * move pipeline· rotation → shared hot-grip rotate + `RotateEntityCommand`
   * (pivot = centre), full `line-rotation` parity.
   */
  arcGripKind?: ArcGripKind;
  /**
   * ADR-363 Slice F — line rotation grip discriminator. Present only on the
   * rotation handle of a plain DXF `line`; opts the grip into the SHARED hot-grip
   * rotate flow and routes commit through `commitLineGripDrag()` +
   * `RotateEntityCommand` (full `wall-rotation` parity, no bespoke transform).
   */
  lineGripKind?: LineGripKind;
  /**
   * ADR-557 — parametric text/mtext grip discriminator. Present only when the
   * grip belongs to a `DxfText` (TEXT or MTEXT normalised to 'text'); routes the
   * commit through `applyTextGripDrag()` + `UpdateTextTransformCommand` (rect-box
   * parity: corner/edge resize + center move + rotation via `rect-grip-engine`).
   */
  textGripKind?: TextGripKind;
  /**
   * ADR-575 §8 — GROUP gizmo grip discriminator. Present only on the two whole-group
   * handles emitted for a selected `type:'group'` container (move cross + rotation
   * handle at the bbox centre). Routes commit through the whole-group move
   * (`calculateMovedGeometry` case 'group') / `RotateEntityCommand` (`rotateEntity`
   * case 'group') — ΜΗΔΕΝ bespoke transform. Emitted at `grip-registry` (the members
   * are suppressed), NOT `computeDxfEntityGrips`.
   */
  groupGripKind?: GroupGripKind;
  /**
   * ADR-583 — annotation symbol (North arrow) grip discriminator. Present on the two
   * whole-entity handles (move cross + rotation) of a lightweight `annotation-symbol`.
   * Routes commit through the whole-entity move (`calculateMovedGeometry` case
   * 'annotation-symbol') / `RotateEntityCommand` (`rotateEntity` case 'annotation-symbol')
   * — ΜΗΔΕΝ bespoke transform. Mirror of `arc-*` (move + rotation, no resize).
   */
  annotationSymbolGripKind?: AnnotationSymbolGripKind;
}

/** Grip drag state */
export interface GripDragState {
  isDragging: boolean;
  activeGrip: GripInfo | null;
  startPosition: Point2D | null;
  currentPosition: Point2D | null;
  totalDelta: Point2D;
  hasMoved: boolean;
}
