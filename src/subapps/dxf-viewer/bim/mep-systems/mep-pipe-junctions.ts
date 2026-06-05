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
 * Point-host pipe connectors (manifold outlets, ADR-408 Φ-B2b EXT #2) also seed
 * endpoints so a pipe end at equipment becomes a host node (no spurious cap).
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
import { resolvePipeJoinTolerance } from './mep-pipe-network-derive';
import { collectHostConnectorEndpoints } from './mep-host-connector-endpoints';
import type { HostConnectorEndpoint } from './mep-host-connector-endpoints';
import { mmToSceneUnits } from '../../utils/scene-units';

/** One resolved junction node: a coincidence point of pipe endpoints. */
export interface PipeJunction {
  /** Idempotency anchor — quantized node position string. Same node ⇒ same key. */
  readonly key: string;
  /** Node centre (canvas units), averaged from the coincident endpoints. */
  readonly position: Point3D;
  /** mm. Centreline elevation, averaged from the incident segments. */
  readonly centerlineElevationMm: number;
  /** The ends meeting at this node (sorted by entityId+connectorId). */
  readonly incidents: readonly MepFittingIncident[];
}

/**
 * One endpoint feeding the junction union-find — either a pipe-segment end or a
 * point-host (manifold / fixture) pipe connector (ADR-408 Φ-B2b EXT #2). Both are
 * resolved to the same shape (world point + canvas-unit elevation + precomputed
 * incident fields) so the coincidence + bucketing logic is host-agnostic.
 */
interface JunctionEndpoint {
  /** FK → the owning entity (segment OR host). */
  readonly entityId: string;
  readonly connectorId: string;
  readonly point: Point3D;
  /** mm. This endpoint's own elevation (sloped runs differ start vs end, Φ-A). */
  readonly elevationMm: number;
  /**
   * This endpoint's elevation in CANVAS units — `elevationMm · mmToScene` (ADR-408
   * Φ-B2b EXT). Same unit as `point.x`/`.y`, so endpoint coincidence is tested as a
   * true 3D sphere (xyz) instead of a planar disc: two pipes crossing at the same
   * (x,y) but different height are NO LONGER falsely merged into one node.
   */
  readonly zScene: number;
  /** Unit direction AWAY from the node (precomputed). Zero vector for a host. */
  readonly directionUnit: Point3D;
  /** mm. Nominal diameter (0 for a host endpoint). */
  readonly diameterMm: number;
  /** True for a point-host connector — its node yields no fitting (the equipment is the fitting). */
  readonly host: boolean;
}

/** Collect both endpoints (start, end) of a pipe segment, with direction refs. */
function segmentEndpointsOf(seg: MepSegmentEntity): readonly JunctionEndpoint[] {
  const { startPoint, endPoint } = seg.params;
  const elev = resolveSegmentEndpointElevationsMm(seg.params);
  const mmToScene = mmToSceneUnits(seg.params.sceneUnits ?? 'mm');
  const diameterMm = resolveSegmentSection(seg.params).widthMm;
  return [
    {
      entityId: seg.id,
      connectorId: SEGMENT_START_CONNECTOR_ID,
      point: startPoint,
      elevationMm: elev.startMm,
      zScene: elev.startMm * mmToScene,
      directionUnit: directionUnit(startPoint, endPoint, elev.startMm, elev.endMm, mmToScene),
      diameterMm,
      host: false,
    },
    {
      entityId: seg.id,
      connectorId: SEGMENT_END_CONNECTOR_ID,
      point: endPoint,
      elevationMm: elev.endMm,
      zScene: elev.endMm * mmToScene,
      directionUnit: directionUnit(endPoint, startPoint, elev.endMm, elev.startMm, mmToScene),
      diameterMm,
      host: false,
    },
  ];
}

/** Adapt a collected host connector → a junction endpoint (host incident, no direction). */
function hostEndpoint(h: HostConnectorEndpoint): JunctionEndpoint {
  return {
    entityId: h.entityId,
    connectorId: h.connectorId,
    point: h.point,
    elevationMm: h.elevationMm,
    zScene: h.zScene,
    directionUnit: { x: 0, y: 0, z: 0 },
    diameterMm: h.diameterMm,
    host: true,
  };
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

/**
 * Squared 3D distance between two pipe endpoints (ADR-408 Φ-B2b EXT). `x`/`y` are
 * the plan coords; `zScene` is the endpoint elevation already in canvas units, so
 * all three axes share one unit and the join tolerance becomes a true 3D sphere.
 * Two endpoints are the same node only when they coincide in xyz — pipes crossing
 * in plan but at different heights stay distinct nodes (no false elbow/cross).
 */
function endpointDist2(a: JunctionEndpoint, b: JunctionEndpoint): number {
  const dx = a.point.x - b.point.x;
  const dy = a.point.y - b.point.y;
  const dz = a.zScene - b.zScene;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Unit vector from the node toward the segment's other endpoint, in TRUE 3D
 * (ADR-408 Φ-B2b). The vertical component is the run's slope, so a fitting can tilt
 * to meet sloped/riser pipes (Φ-A per-endpoint z) instead of sitting flat. `dz`
 * converts the mm elevation delta to canvas units (`mmToScene`) so x/y/z share one
 * unit; the result's proportions therefore match the pipe's world-metre axis exactly.
 */
function directionUnit(
  from: Point3D,
  to: Point3D,
  fromElevMm: number,
  toElevMm: number,
  mmToScene: number,
): Point3D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = (toElevMm - fromElevMm) * mmToScene;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: dx / len, y: dy / len, z: dz / len };
}

/**
 * Quantize a node position to the tolerance grid → a stable key. Snapping each
 * coordinate to a `tolerance`-sized cell makes the key invariant to sub-tolerance
 * jitter (Firestore echo, float drift), so the resolver is idempotent.
 *
 * The `z` cell (ADR-408 Φ-B2b EXT) disambiguates nodes at the same plan position
 * but different heights — without it two pipes crossing in plan at different
 * elevations would collide onto one key and the reconciler (diff BY junctionKey)
 * would treat one as the other and delete it. `qz` is appended ONLY when non-zero,
 * so every existing horizontal network (z=0) keeps its exact legacy key — no
 * reconcile churn, no re-creation of already-persisted fittings.
 */
function junctionKey(position: Point3D, zScene: number, tolerance: number): string {
  const grid = tolerance > 0 ? tolerance : 1;
  const qx = Math.round(position.x / grid);
  const qy = Math.round(position.y / grid);
  const qz = Math.round(zScene / grid);
  return qz === 0 ? `${qx}:${qy}` : `${qx}:${qy}:${qz}`;
}

/** Build a sorted incident snapshot for one endpoint (host flag attached only when set). */
function toIncident(ep: JunctionEndpoint): MepFittingIncident {
  const base: MepFittingIncident = {
    entityId: ep.entityId,
    connectorId: ep.connectorId,
    directionUnit: ep.directionUnit,
    diameterMm: ep.diameterMm,
  };
  return ep.host ? { ...base, host: true } : base;
}

/** Assemble one `PipeJunction` from a bucket of coincident endpoints. */
function buildJunction(bucket: readonly JunctionEndpoint[], tolerance: number): PipeJunction {
  const n = bucket.length;
  let sumX = 0;
  let sumY = 0;
  let sumZScene = 0;
  // Centreline elevation averages the SEGMENT ends (a host node classifies to
  // null, so its centreline is unused); fall back to the whole bucket for a
  // lone-host node so the average is always defined.
  let sumSegElev = 0;
  let segCount = 0;
  let sumAllElev = 0;
  for (const ep of bucket) {
    sumX += ep.point.x;
    sumY += ep.point.y;
    sumZScene += ep.zScene;
    sumAllElev += ep.elevationMm;
    if (!ep.host) {
      sumSegElev += ep.elevationMm;
      segCount += 1;
    }
  }
  // `position.z` stays 0 (no consumer reads it; the converter/renderer/trim use
  // `centerlineElevationMm`). The averaged `zScene` only feeds the z-aware key.
  const position: Point3D = { x: sumX / n, y: sumY / n, z: 0 };
  const incidents = bucket
    .map(toIncident)
    .sort((a, b) =>
      a.entityId === b.entityId
        ? a.connectorId.localeCompare(b.connectorId)
        : a.entityId.localeCompare(b.entityId),
    );
  return {
    key: junctionKey(position, sumZScene / n, tolerance),
    position,
    centerlineElevationMm: segCount > 0 ? sumSegElev / segCount : sumAllElev / n,
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
  tolerance?: number,
): PipeJunction[] {
  // Unit-aware default — a raw `1`-unit tolerance is 1 METRE in a metre scene,
  // which merged a short pipe's own endpoints into a single (cross) junction and
  // collapsed distinct nodes onto one quantized key (ADR-408 Φ11 hotfix).
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const segments = entities
    .filter(isMepSegmentEntity)
    .filter((s) => s.params.domain === 'pipe')
    .sort((a, b) => a.id.localeCompare(b.id));

  if (segments.length === 0) return [];

  const segmentEndpoints = segments.flatMap((seg) => [...segmentEndpointsOf(seg)]);
  // Point-host pipe connectors (manifold outlets …) join the union-find too: a
  // pipe end landing on a host coincides with its connector (xyz), so the node
  // carries a host incident → classifies to null → no spurious cap (ADR-408
  // Φ-B2b EXT #2). Empty when the scene has no pipe-connectable hosts.
  const hostEndpoints = collectHostConnectorEndpoints(entities).map(hostEndpoint);
  const endpoints: JunctionEndpoint[] = [...segmentEndpoints, ...hostEndpoints];
  const parent = endpoints.map((_, i) => i);
  const tol2 = tol * tol;

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      if (endpointDist2(endpoints[i]!, endpoints[j]!) <= tol2) {
        parent[find(parent, j)] = find(parent, i);
      }
    }
  }

  const buckets = new Map<number, JunctionEndpoint[]>();
  for (let i = 0; i < endpoints.length; i++) {
    const root = find(parent, i);
    const bucket = buckets.get(root) ?? [];
    bucket.push(endpoints[i]!);
    buckets.set(root, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => buildJunction(bucket, tol))
    .sort((a, b) => a.key.localeCompare(b.key));
}
