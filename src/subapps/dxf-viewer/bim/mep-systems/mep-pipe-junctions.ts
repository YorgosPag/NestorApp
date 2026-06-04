/**
 * ADR-408 Φ11 — derive pipe junctions from physical connectivity (SSoT, pure).
 *
 * A **junction** is a node where one or more pipe-segment endpoints coincide
 * (within `DEFAULT_PIPE_JOIN_TOLERANCE`). It is the geometric anchor a fitting is
 * materialised on (Revit auto-places an elbow / tee / cross / coupling / reducer /
 * cap at each such node). This is the point-based counterpart of the line-based
 * network derivation in `mep-pipe-network-derive.ts`: there we union *segments*
 * into systems; here we union *endpoints* into nodes and snapshot every pipe end
 * that meets at each node (the classification + geometry input).
 *
 * Mirrors the union-find + endpoint logic of `mep-pipe-network-derive.ts`, but the
 * grouping unit is the endpoint (2 per segment), not the segment, and each node
 * carries the incident directions + diameters.
 *
 * Pure: no store / Firestore / React / command. Deterministic & idempotent — the
 * same scene yields the same junction set (stable `junctionKey`, sorted incidents)
 * across re-render, so the resolver downstream is replay-safe.
 *
 * Scope: **pipe** segments only (plumbing). Duct grouping is a future phase.
 *
 * @see ./mep-pipe-network-derive.ts — the line-based (system) counterpart
 * @see ../mep-fittings/mep-fitting-classify.ts — consumes the incident topology
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Entity } from '../../types/entities';
import { isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import { resolveSegmentSection, resolveSegmentEndpointElevationsMm } from '../types/mep-segment-types';
import type { Point3D } from '../types/bim-base';
import type { MepFittingIncident } from '../types/mep-fitting-types';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';
import { DEFAULT_PIPE_JOIN_TOLERANCE } from './mep-pipe-network-derive';

/** One resolved junction node: a coincidence point of pipe endpoints. */
export interface PipeJunction {
  /** Idempotency anchor — quantized node position string. Same node ⇒ same key. */
  readonly key: string;
  /** Node centre (canvas units), averaged from the coincident endpoints. */
  readonly position: Point3D;
  /** mm. Centreline elevation, averaged from the incident segments. */
  readonly centerlineElevationMm: number;
  /** The pipe ends meeting at this node (sorted by segmentId+connectorId). */
  readonly incidents: readonly MepFittingIncident[];
}

/** One pipe endpoint, tagged with its owning segment + connector role. */
interface SegmentEndpoint {
  readonly segment: MepSegmentEntity;
  readonly connectorId: string;
  readonly point: Point3D;
  /** The OTHER endpoint of the same segment — direction reference. */
  readonly other: Point3D;
  /** mm. This endpoint's own elevation (sloped runs differ start vs end, Φ-A). */
  readonly elevationMm: number;
}

/** Collect both endpoints (start, end) of a pipe segment, with direction refs. */
function endpointsOf(seg: MepSegmentEntity): readonly SegmentEndpoint[] {
  const { startPoint, endPoint } = seg.params;
  const elev = resolveSegmentEndpointElevationsMm(seg.params);
  return [
    { segment: seg, connectorId: SEGMENT_START_CONNECTOR_ID, point: startPoint, other: endPoint, elevationMm: elev.startMm },
    { segment: seg, connectorId: SEGMENT_END_CONNECTOR_ID, point: endPoint, other: startPoint, elevationMm: elev.endMm },
  ];
}

/** Union-find root with path compression (mirrors network-derive). */
function find(parent: number[], i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root]!;
  while (parent[i] !== root) {
    const next = parent[i]!;
    parent[i] = root;
    i = next;
  }
  return root;
}

/** Squared distance between two plan points (z ignored — junctions are planar). */
function dist2(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Unit vector from the node toward the segment's other endpoint. */
function directionUnit(from: Point3D, to: Point3D): Point3D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: dx / len, y: dy / len, z: 0 };
}

/**
 * Quantize a node position to the tolerance grid → a stable key. Snapping each
 * coordinate to a `tolerance`-sized cell makes the key invariant to sub-tolerance
 * jitter (Firestore echo, float drift), so the resolver is idempotent.
 */
function junctionKey(position: Point3D, tolerance: number): string {
  const grid = tolerance > 0 ? tolerance : 1;
  const qx = Math.round(position.x / grid);
  const qy = Math.round(position.y / grid);
  return `${qx}:${qy}`;
}

/** Build a sorted incident snapshot for one endpoint. */
function toIncident(ep: SegmentEndpoint): MepFittingIncident {
  return {
    segmentId: ep.segment.id,
    connectorId: ep.connectorId,
    directionUnit: directionUnit(ep.point, ep.other),
    diameterMm: resolveSegmentSection(ep.segment.params).widthMm,
  };
}

/** Assemble one `PipeJunction` from a bucket of coincident endpoints. */
function buildJunction(bucket: readonly SegmentEndpoint[], tolerance: number): PipeJunction {
  const n = bucket.length;
  let sumX = 0;
  let sumY = 0;
  let sumElev = 0;
  for (const ep of bucket) {
    sumX += ep.point.x;
    sumY += ep.point.y;
    sumElev += ep.elevationMm;
  }
  const position: Point3D = { x: sumX / n, y: sumY / n, z: 0 };
  const incidents = bucket
    .map(toIncident)
    .sort((a, b) =>
      a.segmentId === b.segmentId
        ? a.connectorId.localeCompare(b.connectorId)
        : a.segmentId.localeCompare(b.segmentId),
    );
  return {
    key: junctionKey(position, tolerance),
    position,
    centerlineElevationMm: sumElev / n,
    incidents,
  };
}

/**
 * Resolve all pipe junctions in the scene. Pure & deterministic: endpoints are
 * processed in (segmentId, connector) order, buckets + incidents are sorted, so
 * the same scene always yields the same junction set (stable for tests + undo).
 *
 * Two endpoints belong to the same junction when they lie within `tolerance`.
 * Duct segments are ignored (no plumbing fittings). A lone endpoint forms its own
 * 1-incident junction (classified downstream as a cap).
 */
export function derivePipeJunctions(
  entities: readonly Entity[],
  tolerance: number = DEFAULT_PIPE_JOIN_TOLERANCE,
): PipeJunction[] {
  const segments = entities
    .filter(isMepSegmentEntity)
    .filter((s) => s.params.domain === 'pipe')
    .sort((a, b) => a.id.localeCompare(b.id));

  if (segments.length === 0) return [];

  const endpoints: SegmentEndpoint[] = segments.flatMap((seg) => [...endpointsOf(seg)]);
  const parent = endpoints.map((_, i) => i);
  const tol2 = tolerance * tolerance;

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      if (dist2(endpoints[i]!.point, endpoints[j]!.point) <= tol2) {
        parent[find(parent, j)] = find(parent, i);
      }
    }
  }

  const buckets = new Map<number, SegmentEndpoint[]>();
  for (let i = 0; i < endpoints.length; i++) {
    const root = find(parent, i);
    const bucket = buckets.get(root) ?? [];
    bucket.push(endpoints[i]!);
    buckets.set(root, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => buildJunction(bucket, tolerance))
    .sort((a, b) => a.key.localeCompare(b.key));
}
