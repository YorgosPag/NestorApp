/**
 * MEP fitting auto-reconciliation — scene-ops + pipe-topology signature helpers.
 * Extracted from `useMepFittingAutoReconciliation.ts` for file-size compliance
 * (<500 lines); behavior-preserving pure helpers.
 *
 * @module hooks/data/mep-fitting-reconcile-ops
 * @see ./useMepFittingAutoReconciliation.ts
 */

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
import { collectHostConnectorEndpoints } from '../../bim/mep-systems/mep-host-connector-endpoints';
import type { LevelManagerLike } from './useMepFittingAutoReconciliation';

/**
 * Apply the reconcile create/delete ops to the scene in a single setLevelScene.
 *
 * RE-READS the CURRENT scene at apply time — never the stale snapshot captured at
 * the start of the async reconcile. Otherwise a pipe drawn during the reconcile's
 * `await` window (Firestore save) would be clobbered by writing back the old
 * entity list — which then auto-saves a scene MISSING that pipe, so it vanishes on
 * the next reload. Re-reading preserves every concurrent edit.
 */
export function applySceneOps(
  levelId: string,
  levelManager: LevelManagerLike,
  created: readonly MepFittingEntity[],
  deletedIds: readonly string[],
): void {
  if (created.length === 0 && deletedIds.length === 0) return;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;
  const deleteSet = new Set(deletedIds);
  const kept = scene.entities.filter((e) => !deleteSet.has(e.id));
  levelManager.setLevelScene(levelId, {
    ...scene,
    entities: [...kept, ...(created as unknown as AnySceneEntity[])],
  }, 'system-reconcile');
}

// ============================================================================
// TOPOLOGY SIGNATURE — drives the debounced reconcile trigger
// ============================================================================

/**
 * Stable signature of the pipe topology: only the geometry inputs that affect
 * junction derivation (segment endpoints + diameters). A pure pan / unrelated
 * entity edit leaves this unchanged ⇒ no reconcile ⇒ no churn.
 */
export function buildPipeTopologySignature(scene: SceneModel | null): string {
  if (!scene) return '';
  const parts: string[] = [];
  for (const e of scene.entities) {
    if (!isPipeSegment(e)) continue;
    const p = (e as { params?: Record<string, unknown> }).params ?? {};
    parts.push(`seg:${e.id}:${JSON.stringify(p)}`);
  }
  // ADR-408 Φ-B2b EXT #2 (phase 1β): point-host pipe connectors (manifold outlets …)
  // also drive the desired fitting set — a cap appears/disappears as a host MOVES or
  // RE-ELEVATES even with no pipe edit. Hash the SAME endpoints the junction derive
  // consumes (one SSoT collector) so reconcile fires iff a host connector actually
  // shifts, not on every host param tweak.
  for (const h of collectHostConnectorEndpoints(scene.entities)) {
    parts.push(`host:${h.entityId}:${h.connectorId}:${h.point.x},${h.point.y},${h.zScene}:${h.diameterMm}`);
  }
  return parts.sort().join('|');
}

function isPipeSegment(entity: AnySceneEntity): boolean {
  return (entity as { type?: string }).type === 'mep-segment';
}
