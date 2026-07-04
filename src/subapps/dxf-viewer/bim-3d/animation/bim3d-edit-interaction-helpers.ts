'use client';

/**
 * ADR-402 / ADR-401 / ADR-408 — Pure private helpers extracted from
 * `bim3d-edit-interaction-handlers.ts` for file-size compliance (N.7.1, ≤500 lines).
 *
 * Contains:
 *   - capture helpers (move-dependents, circuit-wires, connected-pipes, incident-fittings)
 *   - `buildDeps` — adapter deps for a target level
 *   - `findBimEntityWorldBox` — union world-space AABB for all meshes tagged with bimId
 *
 * No behaviour change — these are verbatim moves.
 */

import * as THREE from 'three';
import { finiteBox3FromObject } from '../scene/finite-bounds';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { findAttachedWalls } from '../../bim/cascade/bim-cascade-resolver';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { affectedWireSystemIds } from './bim3d-wire-preview-rebuild';
import {
  connectedPipeSegmentIds,
  incidentFittingIds,
} from './bim3d-pipe-follow-preview-rebuild';
import { sceneEntitiesForEdit } from './bim3d-edit-live-preview-apply';
import type { EditInteractionCtx } from './bim3d-edit-interaction-handlers';

// ─── capture helpers ──────────────────────────────────────────────────────────

/**
 * ADR-401 — capture the attached walls that must re-clip live while the dragged
 * structural hosts (beam/slab) move. `findAttachedWalls` is the reverse-lookup
 * SSoT (host→attached-wall); only top-attached walls qualify (MVP scope). No
 * dependents → no-op (fast path: a plain move stays a rigid mesh transform).
 */
export function captureMoveDependents(ctx: EditInteractionCtx, ids: readonly string[]): void {
  const hostIds = new Set(ids);
  const dependentWallIds = findAttachedWalls(hostIds, useBim3DEntitiesStore.getState().walls);
  if (dependentWallIds.length > 0) {
    ctx.preview.captureDependents(ctx.manager.bimLayer.group, dependentWallIds, hostIds);
  }
}

/**
 * ADR-408 Φ7 P2/P2b — capture the home-run conduits to re-route live while the
 * dragged fixtures/panels (`ids`) move OR plan-rotate. `affectedWireSystemIds` is
 * the membership SSoT (dragged host = circuit source/member). No affected circuit
 * → no-op (fast path: the drag stays a plain rigid mesh transform).
 */
export function captureCircuitWires(ctx: EditInteractionCtx, ids: readonly string[]): void {
  const systemIds = affectedWireSystemIds(new Set(ids));
  if (systemIds.length > 0) {
    ctx.preview.captureWires(ctx.manager.bimLayer.group, systemIds);
  }
}

/**
 * ADR-408 Φ-C — capture the pipe segments connected to the dragged MEP entities so
 * their ends STRETCH live (host/pipe move/rotate/vertical → snapped ends follow).
 * No connected pipe → no-op (fast path: the drag stays a plain rigid mesh transform).
 */
export function captureConnectedPipes(ctx: EditInteractionCtx, ids: readonly string[]): void {
  const segmentIds = connectedPipeSegmentIds(new Set(ids), sceneEntitiesForEdit(ctx));
  if (segmentIds.length > 0) {
    ctx.preview.capturePipes(ctx.manager.bimLayer.group, segmentIds);
  }
}

/**
 * ADR-408 Φ-D/Φ-E — capture the fittings (caps/elbows/tees) incident to the dragged
 * segment(s) + followers so they FOLLOW live (the cap on a pipe end re-places in real
 * time, not on release). No incident fitting → no-op.
 */
export function captureIncidentFittings(ctx: EditInteractionCtx, ids: readonly string[]): void {
  const fittingIds = incidentFittingIds(new Set(ids), sceneEntitiesForEdit(ctx));
  if (fittingIds.length > 0) {
    ctx.preview.captureFittings(ctx.manager.bimLayer.group, fittingIds);
  }
}

// ─── outcome dispatch helpers ─────────────────────────────────────────────────

/** Adapter deps for the target level — the adapter only reads currentLevelId/get/set. */
export function buildDeps(levels: LevelsHookReturn, levelId: string): DxfCommitDeps {
  return {
    currentLevelId: levelId,
    getLevelScene: levels.getLevelScene,
    setLevelScene: levels.setLevelScene,
    execute: () => {},
    moveEntities: () => {},
    onToolChange: () => {},
  };
}

// ─── scene helpers ────────────────────────────────────────────────────────────

/** Union world-space bounding box over every mesh tagged with `bimId`. */
export function findBimEntityWorldBox(group: THREE.Object3D, bimId: string): THREE.Box3 | null {
  let box: THREE.Box3 | null = null;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if ((obj.userData['bimId'] as string | undefined) !== bimId) return;
    const b = finiteBox3FromObject(obj);
    if (!b) return;
    if (box) box.union(b);
    else box = b;
  });
  return box;
}
