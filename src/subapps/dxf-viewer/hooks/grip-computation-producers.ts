/**
 * DXF GRIP PRODUCERS — introspectable per-type registry (ADR-587 Φ7).
 *
 * The per-`DxfEntityUnion['type']` grip-emission producers, extracted from
 * {@link computeDxfEntityGrips} (grip-computation.ts) so that file stays ≤500 LOC
 * (Google SRP, N.7.1) AND the produced-type set becomes **introspectable**.
 *
 * ADR-587 Φ7 (TIER-2 introspectable seam) — the previous `switch (entity.type)`
 * became a type-keyed {@link GRIP_PRODUCERS} registry (adapter — every case body is
 * behaviour-identical, only the dispatch shape changed). The keys are exported as
 * {@link GRIP_PRODUCER_SUPPORTED_TYPES} and bound to the descriptor domain
 * (`RENDERABLE_ENTITY_TYPES`) via `__tests__/grip-computation-coverage.test.ts`,
 * mirroring the live `ROTATE_HANDLERS`/`ROTATE_SUPPORTED_TYPES` seam
 * (`utils/rotation-math.ts`) and the `TO_DXF_HANDLERS` seam
 * (`hooks/canvas/dxf-scene-entity-handlers.ts`). A new renderable type with no
 * producer lands in the coverage `off-path` set → the test breaks → forces a
 * conscious decision (add a producer, or confirm the type is grip-less), instead of
 * the silent empty default that made freshly-committed BIM entities un-grippable.
 *
 * **Per-site default (ADR-587 §4.6, pinned):** an absent producer ⇒ the dispatcher
 * returns `[]` (silent no grips) — preserved verbatim in `computeDxfEntityGrips`,
 * NOT homogenised here.
 */

import type { DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from './useGripMovement';
import type { WallEntity } from '../bim/types/wall-types';
import type { BeamEntity } from '../bim/types/beam-types';
import type { ColumnEntity } from '../bim/types/column-types';
import type { FoundationEntity } from '../bim/types/foundation-types';
import type { StairEntity } from '../bim/types/stair-types';
import type { SlabEntity } from '../bim/types/slab-types';
import type { SlabOpeningEntity } from '../bim/types/slab-opening-types';
import type { OpeningEntity } from '../bim/types/opening-types';
import type { MepFixtureEntity } from '../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../bim/types/electrical-panel-types';
import type { MepManifoldEntity } from '../bim/types/mep-manifold-types';
import type { MepRadiatorEntity } from '../bim/types/mep-radiator-types';
import type { MepBoilerEntity } from '../bim/types/mep-boiler-types';
import type { MepWaterHeaterEntity } from '../bim/types/mep-water-heater-types';
import type { FurnitureEntity } from '../bim/types/furniture-types';
import type { FloorplanSymbolEntity } from '../bim/types/floorplan-symbol-types';
import type { MepSegmentEntity } from '../bim/types/mep-segment-types';
import type { RoofEntity } from '../bim/types/roof-types';
import type { FloorFinishEntity } from '../bim/types/floor-finish-types';
import type { MepUnderfloorEntity } from '../bim/types/mep-underfloor-types';
import { calculateMidpoint } from '../rendering/entities/shared/geometry-utils';
// ADR-510 Φ3c — bulge SSoT: arc apex = arc-midpoint grip position (no duplicate math).
import { bulgeApexPoint, isStraightSegment } from '../rendering/entities/shared/geometry-bulge-utils';
import { getStairGrips } from '../bim/stairs/stair-grips';
import { getWallGrips } from '../bim/walls/wall-grips';
import { getBeamGrips } from '../bim/beams/beam-grips';
import { getColumnGrips } from '../bim/columns/column-grips';
import { getFoundationGrips } from '../bim/foundations/foundation-grips';
import { getSlabGrips } from '../bim/slabs/slab-grips';
import { getSlabOpeningGrips } from '../bim/slab-openings/slab-opening-grips';
import { getOpeningGrips } from '../bim/walls/opening-grips';
import { getMepFixtureGrips } from '../bim/mep-fixtures/mep-fixture-grips';
import { getElectricalPanelGrips } from '../bim/electrical-panels/electrical-panel-grips';
import { getMepManifoldGrips } from '../bim/mep-manifolds/mep-manifold-grips';
import { getMepRadiatorGrips } from '../bim/mep-radiators/mep-radiator-grips';
import { getMepBoilerGrips } from '../bim/mep-boilers/mep-boiler-grips';
import { getMepWaterHeaterGrips } from '../bim/mep-water-heaters/mep-water-heater-grips';
import { getFurnitureGrips } from '../bim/furniture/furniture-grips';
import { getFloorplanSymbolGrips } from '../bim/floorplan-symbols/floorplan-symbol-grips';
import { getAnnotationSymbolGrips } from '../bim/annotation-symbols/annotation-symbol-grips';
import { getMepSegmentGrips } from '../bim/mep-segments/mep-segment-grips';
import { getRoofGrips } from '../bim/roofs/roof-grips';
import { getFloorFinishGrips } from '../bim/floor-finishes/floor-finish-grips';
import { getMepUnderfloorGrips } from '../bim/mep-underfloor/mep-underfloor-grips';
import { getTextGrips } from '../bim/text/text-grips';
import {
  hatchBoundsCenter, hatchGradientAngleGripPos, getHatchBoundaryGrips, getHatchEdgeMidpointGrips,
  HATCH_GRADIENT_ORIGIN_KIND, HATCH_GRADIENT_ANGLE_KIND,
} from '../bim/hatch/hatch-grips';
import { getDimensionGrips } from './dimensions/useDimensionGrips';
import { getXLineGrips } from '../systems/xline/xline-grips';
import { getRayGrips } from '../systems/ray/ray-grips';
// ADR-363 Slice F/G.4 — plain DXF line grips SSoT (start/end/midpoint + rotation handle).
// Shared with `LineRenderer.getGrips` so interaction + 2D painting never diverge.
import { getLineGrips } from '../systems/line/line-grips';
// ADR-561 — plain DXF primitive move/rotate grips SSoT (circle/arc/polyline).
// Shared with the matching `*Renderer.getGrips` so interaction ≡ 2D painting.
import { getCircleGrips } from '../systems/circle/circle-grips';
import { getArcGrips } from '../systems/arc/arc-grips';
import { getPolylineMoveRotateGrips, polylineMoveRotateStartIndex } from '../systems/polyline/polyline-grips';

// ============================================================================
// NARROWED ENTITY ALIASES — the exact static type the previous `switch` case
// narrowed `entity` to (mirror of `Extract<Entity, …>` in rotation-math.ts).
// ============================================================================

type PolylineDxf = Extract<DxfEntityUnion, { type: 'polyline' }>;
type AngleMeasurementDxf = Extract<DxfEntityUnion, { type: 'angle-measurement' }>;
type HatchDxf = Extract<DxfEntityUnion, { type: 'hatch' }>;

/** Structural view of the flat hatch primitive (byte-identical to the pre-Φ7 case). */
type HatchLike = {
  boundaryPaths?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
  fillType?: string;
  patternOrigin?: { x: number; y: number };
  gradient?: { angleDeg?: number };
};

// ============================================================================
// INLINE PRODUCERS — extracted verbatim from the 3 non-delegating switch cases.
// ============================================================================

/**
 * ADR-510 Φ3c — polyline vertex + edge grips (tagged with `polylineGripKind` so the
 * context menu + commit pipeline can branch by role), followed by the whole-polyline
 * MOVE cross + rotation handle (ADR-561, shared `getPolylineMoveRotateGrips` SSoT →
 * interaction ≡ render). Byte-identical to the pre-Φ7 `case 'polyline'` body.
 */
function buildPolylineGrips(entity: PolylineDxf): GripInfo[] {
  const grips: GripInfo[] = [];
  const bulges = entity.bulges;
  entity.vertices.forEach((v, i) => {
    grips.push({
      entityId: entity.id, gripIndex: i, type: 'vertex',
      position: v, movesEntity: false,
      gripKind: { on: 'polyline', kind: `polyline-vertex-${i}` },
    });
  });
  const vLen = entity.vertices.length;
  const edgeCount = entity.closed ? vLen : vLen - 1;
  for (let i = 0; i < edgeCount; i++) {
    const next = (i + 1) % vLen;
    const p0 = entity.vertices[i];
    const p1 = entity.vertices[next];
    const bulge = bulges?.[i];
    // ADR-510 Φ3c — an arc segment's grip sits at the apex (`bulgeApexPoint`),
    // NOT the chord midpoint, so dragging it changes curvature directly.
    const isArc = !isStraightSegment(bulge);
    grips.push({
      entityId: entity.id, gripIndex: vLen + i, type: 'edge',
      position: isArc ? bulgeApexPoint(p0, p1, bulge as number) : calculateMidpoint(p0, p1),
      movesEntity: false, edgeVertexIndices: [i, next],
      gripKind: {
        on: 'polyline',
        kind: isArc ? `polyline-arc-midpoint-${i}` : `polyline-segment-midpoint-${i}`,
      },
    });
  }
  grips.push(...getPolylineMoveRotateGrips(
    entity.id, entity.vertices, entity.closed,
    polylineMoveRotateStartIndex(vLen, entity.closed),
  ));
  return grips;
}

/**
 * ADR — angle-measurement 3-vertex grips (vertex + 2 arm endpoints). **Asymmetry
 * (pinned in coverage):** these grips carry NO `gripKind` — angle-measurement is the
 * one grip-producing type absent from `GRIP_KIND_ENTITIES`. Byte-identical body.
 */
function buildAngleMeasurementGrips(entity: AngleMeasurementDxf): GripInfo[] {
  const grips: GripInfo[] = [];
  grips.push({
    entityId: entity.id, gripIndex: 0, type: 'vertex',
    position: entity.vertex, movesEntity: false,
  });
  grips.push({
    entityId: entity.id, gripIndex: 1, type: 'vertex',
    position: entity.point1, movesEntity: false,
  });
  grips.push({
    entityId: entity.id, gripIndex: 2, type: 'vertex',
    position: entity.point2, movesEntity: false,
  });
  return grips;
}

/**
 * ADR-507 Φ5 — gradient origin/seed + angle-arm grips, appended after the boundary
 * grips. Extracted from `buildHatchGrips` to keep both functions ≤40 LOC (N.7.1);
 * threads the running `gripIndex` and returns the next value (behaviour-identical —
 * the guard is inverted only to flatten nesting). Emitted ONLY for `fillType==='gradient'`.
 */
function pushHatchGradientGrips(
  grips: GripInfo[], gripIndex: number, hatchLike: HatchLike,
  paths: HatchLike['boundaryPaths'], entityId: string,
): number {
  if (hatchLike.fillType !== 'gradient') return gripIndex;
  const originPos = hatchLike.patternOrigin ?? hatchBoundsCenter(paths ?? []);
  if (!originPos) return gripIndex;
  grips.push({
    entityId, gripIndex, type: 'vertex',
    position: { x: originPos.x, y: originPos.y }, movesEntity: false,
    gripKind: { on: 'hatch', kind: HATCH_GRADIENT_ORIGIN_KIND },
  });
  gripIndex += 1;
  // ADR-507 Φ5 A4 — gradient-angle βραχίονας (μετά το origin). Θέση = origin +
  // R·(cosθ,sinθ) μέσω του SSoT `hatchGradientAngleGripPos`.
  const anglePos = hatchGradientAngleGripPos(originPos, hatchLike.gradient?.angleDeg ?? 0, paths ?? []);
  if (anglePos) {
    grips.push({
      entityId, gripIndex, type: 'vertex',
      position: { x: anglePos.x, y: anglePos.y }, movesEntity: false,
      gripKind: { on: 'hatch', kind: HATCH_GRADIENT_ANGLE_KIND },
    });
    gripIndex += 1;
  }
  return gripIndex;
}

/**
 * ADR-507 — hatch boundary vertex grips (one per path/vertex) + edge-midpoint grips,
 * both from the SAME SSoT the visible `HatchRenderer.getGrips` uses (render ≡
 * interaction), then the optional gradient grips. `gripIndex` is the running index
 * (1-to-1 with the render). Byte-identical logic to the pre-Φ7 `case 'hatch'` body.
 */
function buildHatchGrips(entity: HatchDxf): GripInfo[] {
  const hatchLike = entity as unknown as HatchLike;
  const paths = hatchLike.boundaryPaths ?? [];
  const grips: GripInfo[] = [];
  let gripIndex = 0;
  for (const g of getHatchBoundaryGrips(paths)) {
    grips.push({
      entityId: entity.id, gripIndex, type: 'vertex',
      position: { x: g.point.x, y: g.point.y }, movesEntity: false,
      gripKind: { on: 'hatch', kind: `hatch-vertex-${g.pathIdx}-${g.vertexIdx}` },
    });
    gripIndex += 1;
  }
  for (const e of getHatchEdgeMidpointGrips(paths)) {
    grips.push({
      entityId: entity.id, gripIndex, type: 'midpoint',
      position: { x: e.point.x, y: e.point.y }, movesEntity: false,
      gripKind: { on: 'hatch', kind: `hatch-edge-midpoint-${e.pathIdx}-${e.edgeIdx}` },
    });
    gripIndex += 1;
  }
  // ADR-507 Φ5 — append the optional gradient origin/angle grips (mutates `grips`,
  // continues the running `gripIndex`); no-op unless `fillType==='gradient'`.
  pushHatchGradientGrips(grips, gripIndex, hatchLike, paths, entity.id);
  return grips;
}

// ============================================================================
// GRIP_PRODUCERS — introspectable per-type registry (ADR-587 Φ7, §5.3).
// Each entry's body is behaviour-identical to its former `switch` case; only the
// dispatch shape changed. All `as unknown as XEntity` casts are preserved verbatim.
// ============================================================================

export const GRIP_PRODUCERS: Partial<Record<DxfEntityUnion['type'], (e: DxfEntityUnion) => GripInfo[]>> = {
  // ADR-363 Slice F/G.4 — start/end + midpoint MOVE + rotation handle via the SHARED
  // `getLineGrips` SSoT (the SAME `LineRenderer.getGrips` paints on canvas).
  line: (e) => {
    const l = e as Extract<DxfEntityUnion, { type: 'line' }>;
    return getLineGrips(l.id, l.start, l.end);
  },

  // ADR-561 — centre MOVE cross + 4 quadrant radius handles via the SHARED
  // `getCircleGrips` SSoT. The circle is symmetric → NO rotation handle (ADR-519).
  circle: (e) => {
    const c = e as Extract<DxfEntityUnion, { type: 'circle' }>;
    return getCircleGrips(c.id, c.center, c.radius);
  },

  // ADR-510 Φ3c / ADR-561 — vertex + edge grips + whole-polyline MOVE/rotation.
  polyline: (e) => buildPolylineGrips(e as PolylineDxf),

  // ADR-561 — centre MOVE cross + start/end/mid reshape + rotation handle via the
  // SHARED `getArcGrips` SSoT (the SAME `ArcRenderer.getGrips` paints on canvas).
  arc: (e) => {
    const a = e as Extract<DxfEntityUnion, { type: 'arc' }>;
    return getArcGrips(a.id, a.center, a.radius, a.startAngle, a.endAngle);
  },

  // ADR-557 — full rect-box parity grips via the shared text↔RectFrame adapter
  // (covers BOTH TEXT and MTEXT — the converter carries the discriminator onto DxfText).
  text: (e) => getTextGrips(e as Extract<DxfEntityUnion, { type: 'text' }>),

  // Asymmetry (pinned) — 3-vertex grips WITHOUT gripKind.
  'angle-measurement': (e) => buildAngleMeasurementGrips(e as AngleMeasurementDxf),

  // ADR-358 Phase 5b / ADR-402 — parametric stair grips. Accept BOTH shapes: the 2D
  // canvas passes the DxfStair wrapper (`.stairEntity`), the 3D snap path passes the
  // domain StairEntity directly (params at top level).
  stair: (e) => {
    const s = e as Extract<DxfEntityUnion, { type: 'stair' }>;
    return getStairGrips(s.stairEntity ?? (e as unknown as StairEntity));
  },

  // ADR-362 Phase I2 — dimension grips (up to 5 per entity, §D9).
  dimension: (e) => getDimensionGrips(e as Extract<DxfEntityUnion, { type: 'dimension' }>),

  // ADR-359 Phase 11 — basePoint (translate) + direction handle (rotate).
  xline: (e) => getXLineGrips((e as Extract<DxfEntityUnion, { type: 'xline' }>).xlineEntity),
  ray: (e) => getRayGrips((e as Extract<DxfEntityUnion, { type: 'ray' }>).rayEntity),

  // ADR-363 Phase 1C — parametric wall grips (start/end/midpoint/thickness).
  wall: (e) => getWallGrips(e as unknown as WallEntity),

  beam: (e) => getBeamGrips(e as unknown as BeamEntity),

  // ADR-397 — parametric column grips (center MOVE / rotation / width / depth + variants).
  column: (e) => getColumnGrips(e as unknown as ColumnEntity),

  // ADR-436 Slice 1b — parametric foundation pad grips (rotation / width / length).
  foundation: (e) => getFoundationGrips(e as unknown as FoundationEntity),

  // ADR-402 — accept BOTH shapes (3D snap passes domain SlabEntity, 2D canvas passes wrapper).
  slab: (e) => {
    const s = e as Extract<DxfEntityUnion, { type: 'slab' }>;
    return getSlabGrips(s.slabEntity ?? (e as unknown as SlabEntity));
  },

  // ADR-402/535 — accept BOTH shapes (mirror 'slab'/'opening').
  'slab-opening': (e) => {
    const s = e as Extract<DxfEntityUnion, { type: 'slab-opening' }>;
    return getSlabOpeningGrips(s.slabOpeningEntity ?? (e as unknown as SlabOpeningEntity));
  },

  // ADR-402 — accept BOTH shapes (mirror 'slab').
  opening: (e) => {
    const o = e as Extract<DxfEntityUnion, { type: 'opening' }>;
    return getOpeningGrips(o.openingEntity ?? (e as unknown as OpeningEntity));
  },

  // ADR-406 — parametric light-fixture grips (move + rotation + 4 corner resize).
  'mep-fixture': (e) => getMepFixtureGrips(e as unknown as MepFixtureEntity),

  // ADR-408 Φ3 — parametric electrical panel grips (rectangular-only).
  'electrical-panel': (e) => getElectricalPanelGrips(e as unknown as ElectricalPanelEntity),

  // ADR-408 Φ12 — parametric MEP manifold grips (1:1 mirror of electrical-panel).
  'mep-manifold': (e) => getMepManifoldGrips(e as unknown as MepManifoldEntity),

  // ADR-408 Εύρος Β — parametric heating radiator grips (1:1 mirror of mep-manifold).
  'mep-radiator': (e) => getMepRadiatorGrips(e as unknown as MepRadiatorEntity),

  // ADR-408 Εύρος Β #2 — parametric heating boiler grips (1:1 mirror of mep-radiator).
  'mep-boiler': (e) => getMepBoilerGrips(e as unknown as MepBoilerEntity),

  // ADR-408 DHW — parametric domestic hot water heater grips (1:1 mirror of mep-boiler).
  'mep-water-heater': (e) => getMepWaterHeaterGrips(e as unknown as MepWaterHeaterEntity),

  // ADR-410 — parametric furniture grips (move + rotation + 4 corner resize).
  furniture: (e) => getFurnitureGrips(e as unknown as FurnitureEntity),

  // ADR-415 — parametric floorplan-symbol grips (1:1 mirror of furniture). Editor-only
  // type (absent from RENDERABLE_ENTITY_TYPES) — pinned as the non-renderable extra.
  'floorplan-symbol': (e) => getFloorplanSymbolGrips(e as unknown as FloorplanSymbolEntity),

  // ADR-408 Φ8 — parametric MEP segment grips (start / end / midpoint / width / rotation).
  'mep-segment': (e) => getMepSegmentGrips(e as unknown as MepSegmentEntity),

  // ADR-583 — lightweight North arrow: move cross + rotation handle (NO resize).
  'annotation-symbol': (e) => {
    const a = e as Extract<DxfEntityUnion, { type: 'annotation-symbol' }>;
    return getAnnotationSymbolGrips(a.id, a.position, a.sizeMm, a.rotation);
  },

  // ADR-417 Φ1-part-2 #2 — parametric roof grips (per-vertex translate + edge-midpoint insertion).
  roof: (e) => getRoofGrips(e as unknown as RoofEntity),

  // ADR-419 — parametric floor-finish grips (per-vertex translate + edge-midpoint insertion).
  'floor-finish': (e) => getFloorFinishGrips(e as unknown as FloorFinishEntity),

  // ADR-408 Εύρος Β #3 — parametric underfloor heating loop grips (per-vertex + edge-midpoint).
  'mep-underfloor': (e) => getMepUnderfloorGrips(e as unknown as MepUnderfloorEntity),

  // ADR-507 — hatch boundary + edge-midpoint + optional gradient grips.
  hatch: (e) => buildHatchGrips(e as HatchDxf),
};

/**
 * Types with an explicit grip producer (keys of {@link GRIP_PRODUCERS}) — bound to
 * the descriptor domain via the coverage test. Mirror of `ROTATE_SUPPORTED_TYPES` /
 * `TO_DXF_SUPPORTED_TYPES`.
 *
 * ⚠️ Domain = the grip-**producing** entities, NOT `RENDERABLE_ENTITY_TYPES`: it
 * INCLUDES the editor-only `floorplan-symbol` (non-renderable) and EXCLUDES renderable
 * types with no interactive grips (e.g. `point`, `lwpolyline`, `railing`, `mep-fitting`).
 * It also differs from `GRIP_KIND_ENTITIES` by exactly two entries (both pinned in the
 * coverage test): it INCLUDES `angle-measurement` (grips without a gripKind) and
 * EXCLUDES `group` (has a gripKind but is produced by the GroupGizmoLayer, not here).
 */
export const GRIP_PRODUCER_SUPPORTED_TYPES: readonly DxfEntityUnion['type'][] =
  Object.keys(GRIP_PRODUCERS) as DxfEntityUnion['type'][];
