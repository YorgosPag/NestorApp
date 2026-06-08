/**
 * ADR-408 Φ-B2a — connected elevation propagation (Revit-style network move).
 *
 * A `mep-segment` (pipe) is an independent entity: editing the elevation (`z`) of
 * one endpoint does NOT, on its own, move the *coincident* endpoint of the pipe
 * that joins it at that node — so the run physically tears apart (the screenshot:
 * manifold → pipe A → coupling → pipe B; dropping pipe A's joined end left the
 * coupling + pipe B's start stranded at the old height). In Revit, connected ends
 * move together.
 *
 * This pure resolver takes the elevation edit already applied to the edited
 * segment (`editedNext`, from `buildElevationParams`) and returns the FULL set of
 * segment patches needed so the whole network node rises/falls as one:
 *   - the edited segment itself (anchor-corrected, see below), then
 *   - every OTHER pipe segment whose endpoint is coincident (xy within
 *     `tolerance`) with a changed node, retargeted to that node's resolved `z`.
 *
 * **Anchor rule:** a manifold / fixture outlet coincident with a changed node
 * forces the node's `z` to that source's elevation — a pipe end cannot drag away
 * from its host (the source wins). The exact host `z` is recovered by the Φ-B1
 * resolver (`resolveMepConnectorElevationMmAt`), which knows each host stores its
 * datum differently (`mountingElevationMm`, NOT `position.z`).
 *
 * **Tee / body taps (Φ-B2a EXT):** the original pass matched only endpoint-to-
 * endpoint joins (incl. 3-way nodes where every pipe has an *endpoint* there). A
 * branch that taps the *middle* of a through-main was left behind. Two symmetric
 * rules now close that gap, treating the through-main as the anchor (Revit: a
 * branch hangs off the main, it never tears it):
 *   - editing the BRANCH end that taps a main's body ⇒ it snaps to the main's
 *     interpolated elevation at the tap (anchor, like a manifold outlet), and
 *   - editing the MAIN ⇒ every branch endpoint sitting on its body follows to the
 *     main's new interpolated elevation at that tap.
 * Interpolation is linear along the main, so it is exact for flat *and* sloped
 * mains. Endpoint joins keep priority over body taps for the same endpoint.
 *
 * Junction matching here stays planar (xy). After propagation the coincident
 * endpoints share one `z`, so the existing planar fitting reconciliation averages
 * to that `z` and the coupling re-attaches — no 3D-junction change needed yet
 * (that is Φ-B2b). Scope: **pipe** segments only (plumbing); ducts are a future
 * phase, mirroring `derivePipeJunctions`.
 *
 * Pure: no store / Firestore / command / React. Deterministic & idempotent —
 * already-consistent `z`'s yield a single (edited-only) patch with no-ops.
 *
 * @see ./mep-connector-elevation.ts — resolveMepConnectorElevationMmAt (Φ-B1)
 * @see ../mep-systems/mep-pipe-junctions.ts — the planar junction reconciliation
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-B2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isMepSegmentEntity,
  isMepManifoldEntity,
  isMepFixtureEntity,
} from '../../types/entities';
import type { MepSegmentEntity, MepSegmentParams } from '../types/mep-segment-types';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../types/mep-segment-types';
import type { MepManifoldParams } from '../types/mep-manifold-types';
import { connectorWorldPosition } from '../types/mep-connector-types';
import { getEntityConnectors } from '../mep-systems/connector-access';
import { resolvePipeJoinTolerance } from '../mep-systems/mep-pipe-network-derive';
import { resolveMepConnectorElevationMmAt } from './mep-connector-elevation';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';

/** Degenerate-segment guard (squared length below this ⇒ a point, not a run). */
const MIN_SEGMENT_LEN2 = 1e-9;

/** One segment whose params must change so the network node moves together. */
export interface SegmentElevationPatch {
  readonly segment: MepSegmentEntity;
  readonly nextParams: MepSegmentParams;
}

/** A plan node (xy) whose elevation changed, with its resolved (anchor-aware) z. */
interface ChangedNode {
  readonly which: 'start' | 'end';
  readonly x: number;
  readonly y: number;
  readonly zMm: number;
}

/** Squared plan distance. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Anchor elevation (mm) at a plan node, or `null` when no manifold / fixture
 * outlet lies within `tol2` of it. The source's exact `z` comes from the Φ-B1
 * resolver (host datum, not `position.z`).
 */
function resolveAnchorElevationAt(
  entities: readonly Entity[],
  x: number,
  y: number,
  tol2: number,
): number | null {
  for (const e of entities) {
    if (!isMepManifoldEntity(e) && !isMepFixtureEntity(e)) continue;
    const { position } = e.params;
    const rotation = e.params.rotation ?? 0;
    for (const c of getEntityConnectors(e)) {
      const w = connectorWorldPosition(c, position, rotation);
      if (dist2(x, y, w.x, w.y) <= tol2) {
        return resolveMepConnectorElevationMmAt(e, x, y);
      }
    }
  }
  return null;
}

/**
 * If plan point `p` lies on the BODY of segment `a→b` (perpendicular distance
 * within `tol`, foot strictly between the endpoints), return the foot's parameter
 * `t ∈ (0,1)`; else `null`. The endpoint zones (foot within `tol` of `a` or `b`)
 * are EXCLUDED — those are end-to-end / 3-way joins already handled by coincidence
 * matching. This is the "tee on the main's body" detector (ADR-408 Φ-B2a EXT).
 */
function projectOnSegmentBodyParam(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  tol2: number,
): number | null {
  const lenSq = dist2(a.x, a.y, b.x, b.y);
  if (lenSq < MIN_SEGMENT_LEN2) return null;
  const foot = getNearestPointOnLine(p, a, b, true);
  if (dist2(p.x, p.y, foot.x, foot.y) > tol2) return null; // not on the line
  // Foot near either endpoint ⇒ endpoint join, not a body tee.
  if (dist2(foot.x, foot.y, a.x, a.y) <= tol2 || dist2(foot.x, foot.y, b.x, b.y) <= tol2) {
    return null;
  }
  return ((foot.x - a.x) * (b.x - a.x) + (foot.y - a.y) * (b.y - a.y)) / lenSq;
}

/** Linear elevation (mm) at parameter `t` along a segment's start→end z's. */
function interpolateSegmentZMm(params: MepSegmentParams, t: number): number {
  const elev = resolveSegmentEndpointElevationsMm(params);
  return elev.startMm + t * (elev.endMm - elev.startMm);
}

/**
 * Through-pipe anchor (mm) at plan node `(x,y)`: if the node lies on the BODY of
 * some OTHER pipe segment, that main is the anchor — a branch tapping it inherits
 * the main's interpolated elevation at the tap (Revit: the branch hangs off the
 * main, never tears it). `null` when no main passes through the node.
 */
function resolveThroughPipeAnchorAt(
  entities: readonly Entity[],
  editedId: string,
  x: number,
  y: number,
  tol2: number,
): number | null {
  for (const e of entities) {
    if (e.id === editedId || !isMepSegmentEntity(e) || e.params.domain !== 'pipe') continue;
    const t = projectOnSegmentBodyParam({ x, y }, e.params.startPoint, e.params.endPoint, tol2);
    if (t !== null) return interpolateSegmentZMm(e.params, t);
  }
  return null;
}

/** Return params with the two endpoint z's set + the derived centreline cache. */
function withEndpointZ(
  params: MepSegmentParams,
  startZ: number,
  endZ: number,
): MepSegmentParams {
  return {
    ...params,
    startPoint: { ...params.startPoint, z: startZ },
    endPoint: { ...params.endPoint, z: endZ },
    centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
  };
}

/**
 * Anchor elevation (mm) at a changed node, by precedence:
 *   1. manifold / fixture outlet — the source always wins,
 *   2. a through-pipe whose BODY the node taps — the main the branch hangs off,
 *   3. `null` — no anchor, the raw edited value stands.
 */
function resolveNodeAnchorMm(
  entities: readonly Entity[],
  editedId: string,
  x: number,
  y: number,
  tol2: number,
): number | null {
  const host = resolveAnchorElevationAt(entities, x, y, tol2);
  if (host !== null) return host;
  return resolveThroughPipeAnchorAt(entities, editedId, x, y, tol2);
}

/** Build the changed-node list for the edited segment (anchor-corrected z). */
function collectChangedNodes(
  editedId: string,
  prevParams: MepSegmentParams,
  nextParams: MepSegmentParams,
  entities: readonly Entity[],
  tol2: number,
): ChangedNode[] {
  const prev = resolveSegmentEndpointElevationsMm(prevParams);
  const next = resolveSegmentEndpointElevationsMm(nextParams);
  const nodes: ChangedNode[] = [];
  if (next.startMm !== prev.startMm) {
    const p = nextParams.startPoint;
    const anchorZ = resolveNodeAnchorMm(entities, editedId, p.x, p.y, tol2);
    nodes.push({ which: 'start', x: p.x, y: p.y, zMm: anchorZ ?? next.startMm });
  }
  if (next.endMm !== prev.endMm) {
    const p = nextParams.endPoint;
    const anchorZ = resolveNodeAnchorMm(entities, editedId, p.x, p.y, tol2);
    nodes.push({ which: 'end', x: p.x, y: p.y, zMm: anchorZ ?? next.endMm });
  }
  return nodes;
}

/** Re-apply the resolved node z's to the edited segment's own endpoints. */
function applyResolvedNodes(
  params: MepSegmentParams,
  nodes: readonly ChangedNode[],
): MepSegmentParams {
  const elev = resolveSegmentEndpointElevationsMm(params);
  let startZ = elev.startMm;
  let endZ = elev.endMm;
  for (const node of nodes) {
    if (node.which === 'start') startZ = node.zMm;
    else endZ = node.zMm;
  }
  return withEndpointZ(params, startZ, endZ);
}

/**
 * Patch another segment whose endpoint either (a) COINCIDES with a changed node
 * (end-to-end / 3-way join — existing behaviour) or (b) TAPS THE BODY of the just
 * edited segment (a tee on the edited main → it follows the main's interpolated
 * elevation at the tap, ADR-408 Φ-B2a EXT). Coincidence wins over body for the same
 * endpoint. Returns the new params, or `null` when nothing on this segment moves.
 */
function patchOtherSegment(
  seg: MepSegmentEntity,
  nodes: readonly ChangedNode[],
  editedNewParams: MepSegmentParams,
  tol2: number,
): MepSegmentParams | null {
  const elev = resolveSegmentEndpointElevationsMm(seg.params);
  const a = editedNewParams.startPoint;
  const b = editedNewParams.endPoint;

  /** Resolved new z for one endpoint, or `null` when it does not move. */
  const resolveEndpointZ = (p: Point2D, currentZ: number): number | null => {
    for (const node of nodes) {
      if (dist2(node.x, node.y, p.x, p.y) <= tol2) {
        return node.zMm !== currentZ ? node.zMm : null; // endpoint join claims it
      }
    }
    const t = projectOnSegmentBodyParam(p, a, b, tol2);
    if (t !== null) {
      const z = interpolateSegmentZMm(editedNewParams, t);
      return z !== currentZ ? z : null;
    }
    return null;
  };

  const nextStart = resolveEndpointZ(seg.params.startPoint, elev.startMm);
  const nextEnd = resolveEndpointZ(seg.params.endPoint, elev.endMm);
  if (nextStart === null && nextEnd === null) return null;
  return withEndpointZ(seg.params, nextStart ?? elev.startMm, nextEnd ?? elev.endMm);
}

/**
 * Resolve all segment patches for a connected elevation edit. Always returns at
 * least the edited segment (anchor-corrected). Coincident pipe endpoints follow.
 */
export function resolveConnectedElevationPatches(
  entities: readonly Entity[],
  edited: MepSegmentEntity,
  editedNext: MepSegmentParams,
  tolerance?: number,
): SegmentElevationPatch[] {
  // Only pipes propagate (plumbing); ducts are a future phase.
  if (edited.params.domain !== 'pipe') {
    return [{ segment: edited, nextParams: editedNext }];
  }
  // Unit-aware default (ADR-408 Φ11 hotfix) — a raw 1-unit tolerance is 1 metre
  // in a metre scene, which would propagate elevation to far-apart endpoints.
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const tol2 = tol * tol;
  const changed = collectChangedNodes(edited.id, edited.params, editedNext, entities, tol2);
  if (changed.length === 0) {
    return [{ segment: edited, nextParams: editedNext }];
  }

  // The edited segment's final geometry — the main whose body branches may tap.
  const editedNewParams = applyResolvedNodes(editedNext, changed);
  const patches: SegmentElevationPatch[] = [{ segment: edited, nextParams: editedNewParams }];
  for (const other of entities) {
    if (other.id === edited.id || !isMepSegmentEntity(other)) continue;
    if (other.params.domain !== 'pipe') continue;
    const patched = patchOtherSegment(other, changed, editedNewParams, tol2);
    if (patched) patches.push({ segment: other, nextParams: patched });
  }
  return patches;
}

/**
 * ADR-408 Φ-B2a (host side) — when a manifold MOVES in elevation, the pipe ends
 * snapped to its outlets follow (Revit "host moves, connectors move with it").
 *
 * Given the manifold's NEXT params (already carrying the new `mountingElevationMm`
 * + rebuilt `connectors`), retarget every pipe endpoint coincident (xy within
 * `tolerance`) with one of its connector world positions to that connector's new
 * elevation (`mountingElevationMm` + the connector's local z). Only the `z` moves;
 * a manifold elevation edit leaves outlet xy unchanged, so the same pipe ends stay
 * matched. The manifold is the anchor — pipes follow it, never the reverse.
 *
 * Pure. Returns one patch per affected pipe segment (empty when none connect).
 */
export function resolveManifoldConnectedPipePatches(
  entities: readonly Entity[],
  manifoldId: string,
  nextManifoldParams: MepManifoldParams,
  tolerance?: number,
): SegmentElevationPatch[] {
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const tol2 = tol * tol;
  const { position, mountingElevationMm } = nextManifoldParams;
  const rotation = nextManifoldParams.rotation ?? 0;
  const ports = (nextManifoldParams.connectors ?? []).map((c) => {
    const w = connectorWorldPosition(c, position, rotation);
    return { x: w.x, y: w.y, zMm: mountingElevationMm + (c.localPosition.z ?? 0) };
  });
  if (ports.length === 0) return [];

  const patches: SegmentElevationPatch[] = [];
  for (const e of entities) {
    if (e.id === manifoldId || !isMepSegmentEntity(e) || e.params.domain !== 'pipe') continue;
    const elev = resolveSegmentEndpointElevationsMm(e.params);
    let startZ = elev.startMm;
    let endZ = elev.endMm;
    let touched = false;
    const { startPoint, endPoint } = e.params;
    for (const port of ports) {
      if (dist2(port.x, port.y, startPoint.x, startPoint.y) <= tol2 && startZ !== port.zMm) {
        startZ = port.zMm;
        touched = true;
      }
      if (dist2(port.x, port.y, endPoint.x, endPoint.y) <= tol2 && endZ !== port.zMm) {
        endZ = port.zMm;
        touched = true;
      }
    }
    if (touched) patches.push({ segment: e, nextParams: withEndpointZ(e.params, startZ, endZ) });
  }
  return patches;
}
