/**
 * DXF GRIP COMPUTATION — PURE FUNCTIONS
 *
 * AutoCAD-style grip point computation from DXF entity geometry.
 * No React dependency — pure math functions.
 *
 * @module hooks/grip-computation
 * @see useDxfGripInteraction.ts (deprecated hook)
 * @see hooks/grips/useUnifiedGripInteraction (active replacement)
 */

import type { Point2D } from '../rendering/types/Types';
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
import { getMepSegmentGrips } from '../bim/mep-segments/mep-segment-grips';
import { getRoofGrips } from '../bim/roofs/roof-grips';
import { getFloorFinishGrips } from '../bim/floor-finishes/floor-finish-grips';
import { getMepUnderfloorGrips } from '../bim/mep-underfloor/mep-underfloor-grips';
import { getTextGrips } from '../bim/text/text-grips';
import {
  hatchBoundsCenter, hatchGradientAngleGripPos,
  HATCH_GRADIENT_ORIGIN_KIND, HATCH_GRADIENT_ANGLE_KIND,
} from '../bim/hatch/hatch-grips';
import { getDimensionGrips } from './dimensions/useDimensionGrips';
import { getXLineGrips } from '../systems/xline/xline-grips';
import { getRayGrips } from '../systems/ray/ray-grips';
// ADR-363 Slice F/G.4 — plain DXF line grips SSoT (start/end/midpoint + rotation handle).
// Shared with `LineRenderer.getGrips` so interaction + 2D painting never diverge.
import { getLineGrips } from '../systems/line/line-grips';

// ============================================================================
// TYPES — extracted to grip-computation-types.ts (re-exported for compat)
// ============================================================================

export type {
  GripPhase,
  GripIdentifier,
  DxfGripDragPreview,
  DxfGripInteractionState,
  UseDxfGripInteractionReturn,
} from './grip-computation-types';

// ============================================================================
// PURE: Compute grips from DXF entity geometry
// ============================================================================

export function computeDxfEntityGrips(entity: DxfEntityUnion): GripInfo[] {
  const grips: GripInfo[] = [];

  switch (entity.type) {
    case 'line': {
      // ADR-363 Slice F/G.4 — start/end + midpoint MOVE + rotation handle, via the
      // SHARED `getLineGrips` SSoT (the SAME `LineRenderer.getGrips` paints on canvas,
      // so interaction ≡ 2D render — no duplicate emission). The midpoint MOVE flag +
      // `edgeVertexIndices` (ORTHO + StretchEntityCommand parity) and the `'axis-quarter'`
      // rotation handle (wall parity, shared hot-grip rotate) live in that one source.
      grips.push(...getLineGrips(entity.id, entity.start, entity.end));
      break;
    }

    case 'circle': {
      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'center',
        position: entity.center, movesEntity: true,
      });
      const quadrants: Point2D[] = [
        { x: entity.center.x + entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y + entity.radius },
        { x: entity.center.x - entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y - entity.radius },
      ];
      quadrants.forEach((pos, i) => {
        grips.push({
          // ADR-559 — quadrant grips (gripIndex 1-4 still drives radius edit) typed `'quadrant'`
          // so the «Εμφάνιση Quadrants» toggle gates them in hit-test too (visible ≡ pickable).
          entityId: entity.id, gripIndex: i + 1, type: 'quadrant',
          position: pos, movesEntity: false,
        });
      });
      break;
    }

    case 'polyline': {
      // ADR-510 Φ3c — tag every grip with `polylineGripKind` so the context menu
      // + commit pipeline can branch by role. Vertex grips at each outline point;
      // edge grips at the chord midpoint (straight) or the arc apex (bulged).
      const bulges = entity.bulges;
      entity.vertices.forEach((v, i) => {
        grips.push({
          entityId: entity.id, gripIndex: i, type: 'vertex',
          position: v, movesEntity: false,
          polylineGripKind: `polyline-vertex-${i}`,
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
          polylineGripKind: isArc
            ? `polyline-arc-midpoint-${i}`
            : `polyline-segment-midpoint-${i}`,
        });
      }
      break;
    }

    case 'arc': {
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      const midRad = (startRad + endRad) / 2;

      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'center',
        position: entity.center, movesEntity: true,
      });
      grips.push({
        entityId: entity.id, gripIndex: 1, type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(startRad),
          y: entity.center.y + entity.radius * Math.sin(startRad),
        },
        movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 2, type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(endRad),
          y: entity.center.y + entity.radius * Math.sin(endRad),
        },
        movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 3, type: 'edge',
        position: {
          x: entity.center.x + entity.radius * Math.cos(midRad),
          y: entity.center.y + entity.radius * Math.sin(midRad),
        },
        movesEntity: true,
      });
      break;
    }

    case 'text': {
      // ADR-557 — full rect-box parity grips (4 corners + 4 edge midpoints +
      // centre MOVE + rotation) via the shared text↔RectFrame adapter, the SAME
      // `rect-grip-engine` SSoT the wall / rectangular column use. Covers BOTH
      // TEXT (X-scale `widthFactor`) and MTEXT (real `width` frame) — the converter
      // carries the discriminator onto `DxfText`.
      grips.push(...getTextGrips(entity));
      break;
    }

    case 'angle-measurement': {
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
      break;
    }

    case 'stair': {
      // ADR-358 Phase 5b — parametric stair grips (5 kinds, §5.12).
      // ADR-402: accept BOTH shapes — the 2D canvas passes the DxfStair wrapper
      // (`.stairEntity`), the 3D snap path (buildDragSnapFn) passes the domain
      // StairEntity directly (params at top level). Mirrors wall/beam/column,
      // which already take the raw entity.
      const stair = entity.stairEntity ?? (entity as unknown as StairEntity);
      grips.push(...getStairGrips(stair));
      break;
    }

    case 'dimension': {
      // ADR-362 Phase I2 — dimension grips (up to 5 per entity, §D9).
      grips.push(...getDimensionGrips(entity));
      break;
    }

    case 'xline': {
      // ADR-359 Phase 11 — basePoint (translate) + direction handle (rotate).
      grips.push(...getXLineGrips(entity.xlineEntity));
      break;
    }

    case 'ray': {
      // ADR-359 Phase 11 — basePoint (translate) + direction handle (rotate).
      grips.push(...getRayGrips(entity.rayEntity));
      break;
    }

    case 'wall': {
      // ADR-363 Phase 1C — parametric wall grips (start/end/midpoint/thickness).
      grips.push(...getWallGrips(entity as unknown as WallEntity));
      break;
    }

    case 'beam': {
      grips.push(...getBeamGrips(entity as unknown as BeamEntity));
      break;
    }

    case 'column': {
      // ADR-397 — parametric column grips (center MOVE / rotation / width / depth
      // + variant handles). Without this case the interactive grip registry got
      // ZERO column grips, so hover/hot-grip/drag never fired (only the render-loop
      // move glyph was visible). Mirrors wall/beam dispatch.
      grips.push(...getColumnGrips(entity as unknown as ColumnEntity));
      break;
    }

    case 'foundation': {
      // ADR-436 Slice 1b — parametric foundation pad grips (rotation / width /
      // length). Without this case the interactive grip registry got ZERO
      // foundation grips → hover/hot-grip/drag never fired. Mirrors column.
      grips.push(...getFoundationGrips(entity as unknown as FoundationEntity));
      break;
    }

    case 'slab': {
      // ADR-402: accept BOTH shapes (see 'stair' note) — 3D snap passes the
      // domain SlabEntity directly, 2D canvas passes the DxfSlab wrapper.
      const slab = entity.slabEntity ?? (entity as unknown as SlabEntity);
      grips.push(...getSlabGrips(slab));
      break;
    }

    case 'slab-opening': {
      // ADR-402/535: accept BOTH shapes (mirror 'slab'/'opening') — the 3D edit/snap
      // path passes the domain `SlabOpeningEntity` directly (from the level scene),
      // the 2D canvas passes the DxfSlabOpening wrapper (`.slabOpeningEntity`). Without
      // the fallback a 3D reshape-grip lookup passed `undefined` → crash.
      const slabOpening = entity.slabOpeningEntity ?? (entity as unknown as SlabOpeningEntity);
      grips.push(...getSlabOpeningGrips(slabOpening));
      break;
    }

    case 'opening': {
      // ADR-402: accept BOTH shapes (mirror 'slab') — the 3D edit/snap path passes
      // the domain `OpeningEntity` directly, the 2D canvas passes the `DxfOpening`
      // wrapper (`.openingEntity`). Without the fallback, a 3D opening edit passed
      // `undefined` to getOpeningGrips → crash on `entity.geometry`.
      const opening = entity.openingEntity ?? (entity as unknown as OpeningEntity);
      grips.push(...getOpeningGrips(opening));
      break;
    }

    case 'mep-fixture': {
      // ADR-406 — parametric light-fixture grips (move + rotation + 4 corner
      // resize). DxfMepFixture carries params at top level (mirror DxfColumn).
      grips.push(...getMepFixtureGrips(entity as unknown as MepFixtureEntity));
      break;
    }

    case 'electrical-panel': {
      // ADR-408 Φ3 — parametric electrical panel grips (move + rotation + 4 corner
      // resize, rectangular-only). Carries params at top level (mirror mep-fixture).
      grips.push(...getElectricalPanelGrips(entity as unknown as ElectricalPanelEntity));
      break;
    }

    case 'mep-manifold': {
      // ADR-408 Φ12 — parametric MEP manifold grips (move + rotation + 4 corner
      // resize, rectangular-only). 1:1 mirror of electrical-panel.
      grips.push(...getMepManifoldGrips(entity as unknown as MepManifoldEntity));
      break;
    }

    case 'mep-radiator': {
      // ADR-408 Εύρος Β — parametric heating radiator grips (move + rotation + 4
      // corner resize, rectangular-only). 1:1 mirror of mep-manifold.
      grips.push(...getMepRadiatorGrips(entity as unknown as MepRadiatorEntity));
      break;
    }

    case 'mep-boiler': {
      // ADR-408 Εύρος Β #2 — parametric heating boiler grips (move + rotation + 4
      // corner resize, rectangular-only). 1:1 mirror of mep-radiator.
      grips.push(...getMepBoilerGrips(entity as unknown as MepBoilerEntity));
      break;
    }

    case 'mep-water-heater': {
      // ADR-408 DHW — parametric domestic hot water heater grips (move + rotation + 4
      // corner resize, rectangular-only). 1:1 mirror of mep-boiler.
      grips.push(...getMepWaterHeaterGrips(entity as unknown as MepWaterHeaterEntity));
      break;
    }

    case 'furniture': {
      // ADR-410 — parametric furniture grips (move + rotation + 4 corner
      // resize, rectangular-only). Carries params at top level (mirror mep-fixture).
      grips.push(...getFurnitureGrips(entity as unknown as FurnitureEntity));
      break;
    }

    case 'floorplan-symbol': {
      // ADR-415 — parametric floorplan-symbol grips (move + rotation + 4 corner
      // resize, rectangular-only). 1:1 mirror of furniture (shared box SSoT).
      grips.push(...getFloorplanSymbolGrips(entity as unknown as FloorplanSymbolEntity));
      break;
    }

    case 'mep-segment': {
      // ADR-408 Φ8 — parametric MEP segment grips (start / end / midpoint /
      // section-width / rotation). Carries params at top level (mirror beam).
      grips.push(...getMepSegmentGrips(entity as unknown as MepSegmentEntity));
      break;
    }

    case 'roof': {
      // ADR-417 Φ1-part-2 #2 — parametric roof grips (per-vertex translate +
      // edge-midpoint insertion, Revit «Edit Footprint»). Roof is a DIRECT
      // entity (params at top level, mirror beam/mep-segment — NOT wrapped like
      // slab's `entity.slabEntity`).
      grips.push(...getRoofGrips(entity as unknown as RoofEntity));
      break;
    }

    case 'floor-finish': {
      // ADR-419 — parametric floor-finish grips (per-vertex translate +
      // edge-midpoint insertion, Revit «Edit Boundary»). Floor-finish is a
      // DIRECT entity (params.footprint polygon at top level, mirrors roof).
      grips.push(...getFloorFinishGrips(entity as unknown as FloorFinishEntity));
      break;
    }

    case 'mep-underfloor': {
      // ADR-408 Εύρος Β #3 — parametric underfloor heating loop grips (per-vertex
      // translate + edge-midpoint insertion, Revit «Edit Boundary» parity). The
      // underfloor entity is DIRECT (params.footprint polygon at top level, mirrors
      // floor-finish). After each drag, buildUnderfloorConnectors re-derives the
      // two hydronic connectors.
      grips.push(...getMepUnderfloorGrips(entity as unknown as MepUnderfloorEntity));
      break;
    }

    case 'hatch': {
      // ADR-507 — hatch boundary vertex grips: one per (path, vertex), mirror of
      // HatchRenderer.getGrips. Hatch is a DIRECT entity (boundaryPaths at top level
      // in DxfEntityUnion). The `hatchGripKind` encodes BOTH ring + vertex indices
      // so the drag commit (applyHatchGripDrag → UpdateHatchBoundaryCommand) can
      // translate the exact vertex even on multi-ring (island) hatches.
      type HatchLike = {
        boundaryPaths?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
        fillType?: string;
        patternOrigin?: { x: number; y: number };
        gradient?: { angleDeg?: number };
      };
      const hatchLike = entity as unknown as HatchLike;
      const paths = hatchLike.boundaryPaths ?? [];
      let gripIndex = 0;
      paths.forEach((path, pathIdx) => {
        path.forEach((v, vertexIdx) => {
          grips.push({
            entityId: entity.id, gripIndex, type: 'vertex',
            position: { x: v.x, y: v.y }, movesEntity: false,
            hatchGripKind: `hatch-vertex-${pathIdx}-${vertexIdx}`,
          });
          gripIndex += 1;
        });
      });
      // ADR-507 Φ5 A3 — gradient origin/seed λαβή (ΜΟΝΟ όταν fillType='gradient').
      // Θέση = patternOrigin όταν υπάρχει, αλλιώς κέντρο bbox (ίδιο SSoT με τον
      // fillGradient). Commit → applyHatchOriginGripDrag + UpdateHatchOriginCommand.
      if (hatchLike.fillType === 'gradient') {
        const originPos = hatchLike.patternOrigin ?? hatchBoundsCenter(paths);
        if (originPos) {
          grips.push({
            entityId: entity.id, gripIndex, type: 'vertex',
            position: { x: originPos.x, y: originPos.y }, movesEntity: false,
            hatchGripKind: HATCH_GRADIENT_ORIGIN_KIND,
          });
          gripIndex += 1;
          // ADR-507 Φ5 A4 — gradient-angle βραχίονας (μετά το origin). Θέση = origin +
          // R·(cosθ,sinθ) μέσω του SSoT `hatchGradientAngleGripPos`. Commit →
          // applyHatchAngleGripDrag + UpdateHatchGradientCommand (περιστρέφει angleDeg).
          const anglePos = hatchGradientAngleGripPos(originPos, hatchLike.gradient?.angleDeg ?? 0, paths);
          if (anglePos) {
            grips.push({
              entityId: entity.id, gripIndex, type: 'vertex',
              position: { x: anglePos.x, y: anglePos.y }, movesEntity: false,
              hatchGripKind: HATCH_GRADIENT_ANGLE_KIND,
            });
            gripIndex += 1;
          }
        }
      }
      break;
    }
  }

  return grips;
}

/** Recalculate angle (degrees) between two arms meeting at a vertex */
export function computeAngleDegrees(vertex: Point2D, p1: Point2D, p2: Point2D): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = Math.abs(a2 - a1) * (180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}
