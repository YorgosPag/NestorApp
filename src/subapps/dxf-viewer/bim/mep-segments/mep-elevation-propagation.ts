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

/** Build the changed-node list for the edited segment (anchor-corrected z). */
function collectChangedNodes(
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
    const anchorZ = resolveAnchorElevationAt(entities, p.x, p.y, tol2);
    nodes.push({ which: 'start', x: p.x, y: p.y, zMm: anchorZ ?? next.startMm });
  }
  if (next.endMm !== prev.endMm) {
    const p = nextParams.endPoint;
    const anchorZ = resolveAnchorElevationAt(entities, p.x, p.y, tol2);
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

/** Patch another segment's endpoints that coincide with a changed node, or null. */
function patchCoincidentEndpoints(
  seg: MepSegmentEntity,
  nodes: readonly ChangedNode[],
  tol2: number,
): MepSegmentParams | null {
  const elev = resolveSegmentEndpointElevationsMm(seg.params);
  let startZ = elev.startMm;
  let endZ = elev.endMm;
  let touched = false;
  const { startPoint, endPoint } = seg.params;
  for (const node of nodes) {
    if (dist2(node.x, node.y, startPoint.x, startPoint.y) <= tol2 && startZ !== node.zMm) {
      startZ = node.zMm;
      touched = true;
    }
    if (dist2(node.x, node.y, endPoint.x, endPoint.y) <= tol2 && endZ !== node.zMm) {
      endZ = node.zMm;
      touched = true;
    }
  }
  return touched ? withEndpointZ(seg.params, startZ, endZ) : null;
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
  const changed = collectChangedNodes(edited.params, editedNext, entities, tol2);
  if (changed.length === 0) {
    return [{ segment: edited, nextParams: editedNext }];
  }

  const patches: SegmentElevationPatch[] = [
    { segment: edited, nextParams: applyResolvedNodes(editedNext, changed) },
  ];
  for (const other of entities) {
    if (other.id === edited.id || !isMepSegmentEntity(other)) continue;
    if (other.params.domain !== 'pipe') continue;
    const patched = patchCoincidentEndpoints(other, changed, tol2);
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
