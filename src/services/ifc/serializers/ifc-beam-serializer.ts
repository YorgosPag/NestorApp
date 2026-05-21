/**
 * IFC4 Beam Serializer (ADR-369 §Q8.4 — TASK C)
 *
 * Παράγει IfcBeam ανά BeamEntity:
 *   - IfcLocalPlacement στο beam start, με LOCAL Z = beam direction
 *     (horizontal) και LOCAL Y = world Z (vertical). Profile (width × depth)
 *     ζει στο XY local plane (κάθετο στον άξονα).
 *   - Profile:
 *       sectionType === 'I' → IfcIShapeProfileDef
 *       sectionType === 'H' → IfcIShapeProfileDef με H-style ratios
 *       διαφορετικά         → IfcRectangleProfileDef
 *   - IfcExtrudedAreaSolid κατά local +Z, depth = beam length.
 *
 * Top-face elevation: `topElevation + zOffset` (ADR-369 §2.2 + §854).
 * Beam center vertical = top_z - depth/2.
 *
 * Curved beams (kind='curved') εξάγονται ως ευθύγραμμα start→end στο Q8.4 —
 * actual Bezier path swept solid σε future task (IfcSweptDiskSolid).
 */

import type { BeamEntity, BeamSectionType } from '@/subapps/dxf-viewer/bim/types/beam-types';
import { isBeamEntity } from '@/subapps/dxf-viewer/types/entities';

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
  appendIShapeSweep,
  appendLocalPlacement,
  appendRectangleSweep,
  type Vec3,
} from './serializer-helpers';

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeBeams(
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
      if (!isBeamEntity(entity)) continue;
      writeBeam(graph, entity, {
        storeyID,
        contextID: spatial.contextID,
        ctx,
      });
    }
  }
}

// ─── Per-beam emission ──────────────────────────────────────────────────────

interface BeamWriteContext {
  readonly storeyID: number;
  readonly contextID: number;
  readonly ctx: SerializerContext;
}

function writeBeam(graph: IfcGraph, beam: BeamEntity, w: BeamWriteContext): void {
  const proj = projectBeam(beam);
  if (!proj) return;

  const placementID = appendLocalPlacement(
    graph,
    { x: proj.startXM, y: proj.startYM, z: proj.centerZM },
    proj.beamAxis,
    proj.refDirection,
  );

  const shapeID = appendBeamShape(graph, beam, proj, w.contextID);

  const beamID = graph.add('IFCBEAM', [
    lbl(beam.ifcGuid),
    null,
    beam.name ? lbl(beam.name) : null,
    null,
    null,
    ref(placementID),
    ref(shapeID),
    null,
    enumValue('BEAM'),
  ]);

  w.ctx.beamIDs.set(beam.id, beamID);
  pushElementForStorey(w.ctx, w.storeyID, beamID);
}

// ─── Projection ─────────────────────────────────────────────────────────────

interface BeamProjection {
  readonly startXM: number;
  readonly startYM: number;
  /** World Z of vertical CENTER of beam cross-section (metres). */
  readonly centerZM: number;
  readonly beamAxis: Vec3;
  readonly refDirection: Vec3;
  readonly widthM: number;
  readonly depthM: number;
  readonly lengthM: number;
}

function projectBeam(beam: BeamEntity): BeamProjection | null {
  const { startPoint, endPoint, width, depth, topElevation, zOffset } = beam.params;
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm < 1) return null;
  const dirX = dx / lengthMm;
  const dirY = dy / lengthMm;
  const topZmm = topElevation + (zOffset ?? 0);
  const centerZmm = topZmm - depth / 2;
  return {
    startXM: startPoint.x * MM_TO_M,
    startYM: startPoint.y * MM_TO_M,
    centerZM: centerZmm * MM_TO_M,
    beamAxis: { x: dirX, y: dirY, z: 0 },
    refDirection: { x: -dirY, y: dirX, z: 0 },
    widthM: width * MM_TO_M,
    depthM: depth * MM_TO_M,
    lengthM: lengthMm * MM_TO_M,
  };
}

// ─── Profile dispatch ───────────────────────────────────────────────────────

function appendBeamShape(
  graph: IfcGraph,
  beam: BeamEntity,
  proj: BeamProjection,
  contextID: number,
): number {
  const direction: Vec3 = { x: 0, y: 0, z: 1 };
  const sectionType = beam.params.sectionType;
  if (sectionType === 'I' || sectionType === 'H') {
    return appendIShapeSweep(graph, {
      contextID,
      profile: deriveIShape(proj.widthM, proj.depthM, sectionType),
      direction,
      depth: proj.lengthM,
    });
  }
  return appendRectangleSweep(graph, {
    contextID,
    profile: { xDim: proj.widthM, yDim: proj.depthM },
    direction,
    depth: proj.lengthM,
  });
}

function deriveIShape(
  widthM: number,
  depthM: number,
  sectionType: BeamSectionType,
): {
  overallWidth: number;
  overallDepth: number;
  webThickness: number;
  flangeThickness: number;
} {
  if (sectionType === 'H') {
    return {
      overallWidth: widthM,
      overallDepth: depthM,
      webThickness: widthM * 0.12,
      flangeThickness: depthM * 0.20,
    };
  }
  return {
    overallWidth: widthM,
    overallDepth: depthM,
    webThickness: widthM * 0.10,
    flangeThickness: depthM * 0.10,
  };
}
