/**
 * IFC4 Slab Serializer (ADR-369 §Q8.4 — TASK D)
 *
 * Παράγει IfcSlab ανά SlabEntity:
 *   - IfcLocalPlacement στο world origin με τη top-face Z (FFL + offset).
 *   - Profile = IfcArbitraryClosedProfileDef (slab outline CCW, world XY).
 *   - IfcExtrudedAreaSolid κατά (0,0,-1) depth = thickness (slab hangs DOWN).
 *   - PredefinedType: floor→FLOOR · ceiling→FLOOR · roof→ROOF · ground→FLOOR
 *     · foundation→BASESLAB.
 *
 * Phase 1 subset (ADR-369 §9 Q7):
 *   - `geometryType === 'box'`     → standard extrusion (full support).
 *   - `geometryType === 'tilted'`  → ίδια εξαγωγή, slope rotation deferred.
 *   - mesh variant → δεν υποστηρίζεται από SlabGeometryType union, no-op.
 *
 * Units: mm → m πριν το graph. levelElevation σε mm (ADR-369 §2.1 canonical).
 */

import type { SlabEntity, SlabKind } from '@/subapps/dxf-viewer/bim/types/slab-types';
import { isSlabEntity } from '@/subapps/dxf-viewer/types/entities';

import {
  IfcGraph,
  enumValue,
  lbl,
  ref,
} from '../ifc-entity-graph';
import { MM_TO_M } from '../ifc-units';
import type { SpatialHierarchyOutput } from '../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../ifc-exporter.service';

import type { SerializerContext } from './serializer-context';
import { pushElementForStorey } from './serializer-context';
import {
  appendLocalPlacement,
  appendPolygonSweep,
  type Point2,
} from './serializer-helpers';

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeSlabs(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  if (!params.scenes) return;
  for (const [floorId, scene] of params.scenes) {
    const storeyID = spatial.storeyIDs.get(floorId);
    if (storeyID == null) continue;
    for (const entity of scene.entities) {
      if (!isSlabEntity(entity)) continue;
      writeSlab(graph, entity, {
        storeyID,
        contextID: spatial.contextID,
        ctx,
      });
    }
  }
}

// ─── Per-slab emission ──────────────────────────────────────────────────────

interface SlabWriteContext {
  readonly storeyID: number;
  readonly contextID: number;
  readonly ctx: SerializerContext;
}

function writeSlab(graph: IfcGraph, slab: SlabEntity, w: SlabWriteContext): void {
  const polyM = projectSlabOutline(slab);
  if (polyM.length < 3) return;

  const topZmm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  const topZM = topZmm * MM_TO_M;
  const thicknessM = slab.params.thickness * MM_TO_M;

  const placementID = appendLocalPlacement(
    graph,
    { x: 0, y: 0, z: topZM },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
  );

  const shapeID = appendPolygonSweep(graph, {
    contextID: w.contextID,
    polygon: polyM,
    direction: { x: 0, y: 0, z: -1 },
    depth: thicknessM,
  });

  const slabID = graph.add('IFCSLAB', [
    lbl(slab.ifcGuid),
    null,
    slab.name ? lbl(slab.name) : null,
    null,
    null,
    ref(placementID),
    ref(shapeID),
    null,
    enumValue(mapSlabPredefinedType(slab.params.kind)),
  ]);

  w.ctx.slabIDs.set(slab.id, slabID);
  pushElementForStorey(w.ctx, w.storeyID, slabID);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function projectSlabOutline(slab: SlabEntity): Point2[] {
  return slab.params.outline.vertices.map((v) => ({
    x: v.x * MM_TO_M,
    y: v.y * MM_TO_M,
  }));
}

function mapSlabPredefinedType(kind: SlabKind): string {
  switch (kind) {
    case 'roof':
      return 'ROOF';
    case 'foundation':
      return 'BASESLAB';
    case 'floor':
    case 'ground':
    case 'ceiling':
      return 'FLOOR';
    default:
      return 'NOTDEFINED';
  }
}
