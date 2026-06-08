/**
 * ADR-408 Φ-C — connectivity-preserving MOVE propagation (Revit-style "host moves,
 * connectors move with it / connected pipe ends follow").
 *
 * Sibling of {@link ./mep-elevation-propagation.ts}, which keeps a network's
 * elevation coherent when only the `z` of one endpoint is edited. This resolver
 * closes the orthogonal gap: when a **host** (manifold / sanitary fixture / boiler /
 * radiator / water-heater / underfloor loop) MOVES in plan (XY translate, rotation)
 * or in elevation (Z), or when a **pipe** itself is dragged, the pipe ends snapped
 * to the moved anchors must FOLLOW — the run stretches/bends (its length changes),
 * the far end stays. In Revit the connected end tracks the element; it never tears
 * off the network.
 *
 * **Model — anchors:** a moving element exposes a set of world "anchors" (x, y, z):
 *   - a host → its pipe connectors' world poses (XY via `connectorWorldPosition`,
 *     elevation via the per-host datum `pointHostMountingElevationMm` + connector
 *     local z), and
 *   - a segment → its two endpoints (`startPoint` / `endPoint`).
 * Each anchor is paired OLD→NEW (its world pose before vs after the move). Every
 * OTHER pipe endpoint coincident (xy within `tolerance`) with an anchor's OLD pose
 * is retargeted to that anchor's NEW pose — XY **and** Z. Match on OLD, retarget to
 * NEW = exact tracking (not "nearest"), so rotation (which sweeps connector XY) is
 * covered for free.
 *
 * **Anchor rule:** the moved element is the anchor — pipes follow it, never the
 * reverse (Revit: the host owns the connection point). A connected pipe's far end
 * is untouched, so the run simply changes length.
 *
 * **Drag-merge stability:** a patch is emitted for EVERY endpoint that *coincides*
 * with a moved anchor (even a sub-pixel sample), not only when it visibly moved.
 * This keeps the connected-pipe set — hence the wrapping `CompoundCommand`'s child
 * shape — STABLE across a continuous grip drag, so consecutive samples merge into a
 * single undo entry (`CompoundCommand.canMergeWith` requires equal child count).
 *
 * Pure: no store / Firestore / command / React. Deterministic & idempotent. Scope:
 * **pipe** segments only (plumbing); ducts mirror later.
 *
 * @see ./mep-elevation-propagation.ts — the Z-only sibling (SegmentElevationPatch)
 * @see ./mep-connector-elevation.ts — pointHostMountingElevationMm (per-host datum)
 * @see ../mep-manifolds/mep-manifold-param-update.ts — the CompoundCommand pattern
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-C
 */

import type { Entity } from '../../types/entities';
import { isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../types/mep-segment-types';
import type { Point3D } from '../types/bim-base';
import { connectorWorldPosition } from '../types/mep-connector-types';
import {
  getEntityConnectors,
  getConnectorHostPlanTransform,
} from '../mep-systems/connector-access';
import { resolvePipeJoinTolerance } from '../mep-systems/mep-pipe-network-derive';
import { pointHostMountingElevationMm } from './mep-connector-elevation';

/** Below this squared coordinate delta two points count as identical (float noise). */
const COORD_EPS2 = 1e-12;

/** One pipe segment whose endpoints must change so it follows a moved element. */
export interface SegmentEndpointMovePatch {
  readonly segment: MepSegmentEntity;
  readonly nextParams: MepSegmentParams;
}

/** A moved anchor: its OLD plan pose (the match key) and NEW world pose (x, y, z mm). */
interface AnchorMove {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly toZMm: number;
}

/** Squared plan distance. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Pipe-connector world poses of a host, keyed by host-local `connectorId`. XY is
 * resolved through the host plan transform; the elevation comes from the per-host
 * mounting datum (NOT `position.z`) plus the connector's local z. Only `pipe`-domain
 * connectors are returned (electrical ports never join a water run). Empty when the
 * host carries no plumbing datum (e.g. an electrical panel).
 */
function hostPipeConnectorPoses(host: Entity): Map<string, Point3D> {
  const datum = pointHostMountingElevationMm(host);
  if (datum === null) return new Map();
  const { position, rotation } = getConnectorHostPlanTransform(host);
  const poses = new Map<string, Point3D>();
  for (const c of getEntityConnectors(host)) {
    if (c.domain !== 'pipe') continue;
    const w = connectorWorldPosition(c, position, rotation);
    poses.set(c.connectorId, { x: w.x, y: w.y, z: datum + (c.localPosition.z ?? 0) });
  }
  return poses;
}

/** Pair OLD→NEW connector poses by `connectorId` into anchor moves. */
function buildHostAnchors(prevHost: Entity, nextHost: Entity): AnchorMove[] {
  const prev = hostPipeConnectorPoses(prevHost);
  const next = hostPipeConnectorPoses(nextHost);
  const anchors: AnchorMove[] = [];
  for (const [id, from] of prev) {
    const to = next.get(id);
    if (!to) continue; // connector removed (e.g. outlet-count change) — not a move
    anchors.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, toZMm: to.z ?? 0 });
  }
  return anchors;
}

/** The anchor whose OLD pose is nearest to `(x,y)` within `tol2`, or `null`. */
function nearestAnchor(
  x: number,
  y: number,
  anchors: readonly AnchorMove[],
  tol2: number,
): AnchorMove | null {
  let best: AnchorMove | null = null;
  let bestD = tol2;
  for (const a of anchors) {
    const d = dist2(x, y, a.fromX, a.fromY);
    if (d <= bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/**
 * Retarget a single endpoint to the NEW pose of the anchor it coincides with, or
 * `null` when it touches no anchor. Returns the new endpoint AND whether it actually
 * moved (a coincident-but-unmoved endpoint still yields a point so the patch shape
 * stays stable for drag-merge — see file header).
 */
function retargetEndpoint(
  p: Point3D,
  anchors: readonly AnchorMove[],
  tol2: number,
): { point: Point3D; moved: boolean } | null {
  const a = nearestAnchor(p.x, p.y, anchors, tol2);
  if (!a) return null;
  const point: Point3D = { x: a.toX, y: a.toY, z: a.toZMm };
  const moved = dist2(p.x, p.y, a.toX, a.toY) > COORD_EPS2 || (p.z ?? 0) !== a.toZMm;
  return { point, moved };
}

/** Apply the anchor retarget to a segment's two endpoints, or `null` when neither touches an anchor. */
function retargetSegment(
  seg: MepSegmentEntity,
  anchors: readonly AnchorMove[],
  tol2: number,
): MepSegmentParams | null {
  const start = retargetEndpoint(seg.params.startPoint, anchors, tol2);
  const end = retargetEndpoint(seg.params.endPoint, anchors, tol2);
  if (!start && !end) return null;
  const startPoint = start ? start.point : seg.params.startPoint;
  const endPoint = end ? end.point : seg.params.endPoint;
  return {
    ...seg.params,
    startPoint,
    endPoint,
    centerlineElevationMm: deriveCenterlineElevationMm(startPoint.z ?? 0, endPoint.z ?? 0),
  };
}

/** Retarget every connected pipe (skipping the moved element) against the anchors. */
function retargetPipeEndpoints(
  entities: readonly Entity[],
  movedId: string,
  anchors: readonly AnchorMove[],
  tol2: number,
): SegmentEndpointMovePatch[] {
  if (anchors.length === 0) return [];
  const patches: SegmentEndpointMovePatch[] = [];
  for (const e of entities) {
    if (e.id === movedId || !isMepSegmentEntity(e) || e.params.domain !== 'pipe') continue;
    const next = retargetSegment(e, anchors, tol2);
    if (next) patches.push({ segment: e, nextParams: next });
  }
  return patches;
}

/**
 * Resolve the pipe-segment patches needed so every pipe end snapped to a moved
 * HOST connector follows the host (XY + Z + rotation). `prevHost`/`nextHost` are the
 * same entity before vs after the move (`{ ...host, params: nextParams }`). Returns
 * one patch per connected pipe (empty when none connect).
 */
export function resolveHostMoveConnectedPipePatches(
  entities: readonly Entity[],
  prevHost: Entity,
  nextHost: Entity,
  tolerance?: number,
): SegmentEndpointMovePatch[] {
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const anchors = buildHostAnchors(prevHost, nextHost);
  return retargetPipeEndpoints(entities, prevHost.id, anchors, tol * tol);
}

/**
 * Resolve the pipe-segment patches needed so every neighbouring pipe end coincident
 * with a moved SEGMENT endpoint follows it (Revit: dragging a pipe drags the joins
 * with it). Anchors are the moved segment's two endpoints, OLD→NEW (XY + per-endpoint
 * Z). Returns one patch per connected neighbour (empty when none connect).
 */
export function resolveSegmentMoveConnectedPipePatches(
  entities: readonly Entity[],
  prevSegment: MepSegmentEntity,
  nextParams: MepSegmentParams,
  tolerance?: number,
): SegmentEndpointMovePatch[] {
  if (prevSegment.params.domain !== 'pipe') return [];
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const nextElev = resolveSegmentEndpointElevationsMm(nextParams);
  const prev = prevSegment.params;
  const anchors: AnchorMove[] = [
    {
      fromX: prev.startPoint.x,
      fromY: prev.startPoint.y,
      toX: nextParams.startPoint.x,
      toY: nextParams.startPoint.y,
      toZMm: nextElev.startMm,
    },
    {
      fromX: prev.endPoint.x,
      fromY: prev.endPoint.y,
      toX: nextParams.endPoint.x,
      toY: nextParams.endPoint.y,
      toZMm: nextElev.endMm,
    },
  ];
  return retargetPipeEndpoints(entities, prevSegment.id, anchors, tol * tol);
}
