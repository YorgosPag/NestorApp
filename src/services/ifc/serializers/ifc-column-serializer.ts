/**
 * IFC4 Column Serializer (ADR-369 §Q8.4 — TASK B)
 *
 * Παράγει IfcColumn ανά ColumnEntity:
 *   - IfcLocalPlacement στο column world center (anchor + rotation εφαρμοσμένα).
 *   - Profile per kind:
 *       rectangular            → IfcRectangleProfileDef (width × depth)
 *       circular               → IfcCircleProfileDef (radius = width / 2)
 *       L-shape / T-shape      → bbox fallback (rectangle width × depth) —
 *                                IfcLShape/IfcTShapeProfileDef σε future task
 *   - IfcExtrudedAreaSolid κατά [0,0,1] depth = column height.
 *   - Storey containment via `SerializerContext.elementsByStorey`.
 *
 * Units: mm → m πριν το graph.
 * baseOffset handling ίδιο με wall: baseZ = storeyZ + baseOffset_m.
 * topBinding='unconnected' + unconnectedHeight → override height.
 */

import type { ColumnEntity, ColumnAnchor, ColumnKind } from '@/subapps/dxf-viewer/bim/types/column-types';
import { ANCHOR_OFFSETS } from '@/subapps/dxf-viewer/bim/types/column-types';
import { isColumnEntity } from '@/subapps/dxf-viewer/types/entities';

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
  appendCircleSweep,
  appendLocalPlacement,
  appendRectangleSweep,
  buildFloorLookup,
  readFloorElevationM,
  type Vec3,
} from './serializer-helpers';

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeColumns(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  if (!params.scenes) return;
  const floors = buildFloorLookup(params.floors);
  for (const [floorId, scene] of params.scenes) {
    const storeyID = spatial.storeyIDs.get(floorId);
    if (storeyID == null) continue;
    const storeyZ = readFloorElevationM(floors.byId.get(floorId));
    for (const entity of scene.entities) {
      if (!isColumnEntity(entity)) continue;
      writeColumn(graph, entity, {
        storeyID,
        storeyZ,
        contextID: spatial.contextID,
        ctx,
      });
    }
  }
}

// ─── Per-column emission ────────────────────────────────────────────────────

interface ColumnWriteContext {
  readonly storeyID: number;
  readonly storeyZ: number;
  readonly contextID: number;
  readonly ctx: SerializerContext;
}

function writeColumn(graph: IfcGraph, col: ColumnEntity, w: ColumnWriteContext): void {
  const proj = projectColumn(col);
  if (!proj) return;

  const placementID = appendLocalPlacement(
    graph,
    { x: proj.centerXM, y: proj.centerYM, z: w.storeyZ + proj.baseOffsetM },
    { x: 0, y: 0, z: 1 },
    proj.refDirection,
  );

  const shapeID = appendColumnShape(graph, col.params.kind, proj, w.contextID);

  const columnID = graph.add('IFCCOLUMN', [
    lbl(col.ifcGuid),
    null,
    col.name ? lbl(col.name) : null,
    null,
    null,
    ref(placementID),
    ref(shapeID),
    null,
    enumValue('COLUMN'),
  ]);

  w.ctx.columnIDs.set(col.id, columnID);
  pushElementForStorey(w.ctx, w.storeyID, columnID);
}

// ─── Projection (anchor + rotation + units) ─────────────────────────────────

interface ColumnProjection {
  readonly centerXM: number;
  readonly centerYM: number;
  readonly refDirection: Vec3;
  readonly widthM: number;
  readonly depthM: number;
  readonly heightM: number;
  readonly baseOffsetM: number;
}

function projectColumn(col: ColumnEntity): ColumnProjection | null {
  const { position, anchor, width, depth, rotation, kind, baseOffset, topBinding, unconnectedHeight } =
    col.params;
  if (width <= 0 || depth <= 0) return null;

  const offset = kind === 'circular'
    ? { dx: 0, dy: 0 }
    : ANCHOR_OFFSETS[anchor];
  const shiftX = -offset.dx * width;
  const shiftY = -offset.dy * depth;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dxRot = shiftX * cos - shiftY * sin;
  const dyRot = shiftX * sin + shiftY * cos;

  const effectiveHeightMm =
    topBinding === 'unconnected' && typeof unconnectedHeight === 'number'
      ? unconnectedHeight
      : col.params.height;

  return {
    centerXM: (position.x + dxRot) * MM_TO_M,
    centerYM: (position.y + dyRot) * MM_TO_M,
    refDirection: { x: cos, y: sin, z: 0 },
    widthM: width * MM_TO_M,
    depthM: depth * MM_TO_M,
    heightM: effectiveHeightMm * MM_TO_M,
    baseOffsetM: (baseOffset ?? 0) * MM_TO_M,
  };
}

// ─── Profile dispatch (per kind) ────────────────────────────────────────────

function appendColumnShape(
  graph: IfcGraph,
  kind: ColumnKind,
  proj: ColumnProjection,
  contextID: number,
): number {
  const direction: Vec3 = { x: 0, y: 0, z: 1 };
  if (kind === 'circular') {
    return appendCircleSweep(graph, {
      contextID,
      radius: proj.widthM / 2,
      direction,
      depth: proj.heightM,
    });
  }
  return appendRectangleSweep(graph, {
    contextID,
    profile: { xDim: proj.widthM, yDim: proj.depthM },
    direction,
    depth: proj.heightM,
  });
}
