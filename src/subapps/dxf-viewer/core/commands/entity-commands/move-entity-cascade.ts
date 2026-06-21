/**
 * MOVE ENTITY CASCADE — SSoT for the move command cascade sequence
 *
 * 🏢 ADR-049 / ADR-363 / ADR-408 Φ-C / ADR-492 — Both MoveEntityCommand and
 * MoveMultipleEntitiesCommand ran the IDENTICAL cascade ordering on execute/redo
 * and undo (the only delta being updateEntity vs updateEntities). This module
 * owns that ordering ONCE so the two commands stay byte-for-byte in sync.
 *
 * Forward (execute/redo) cascade order — must NOT be reordered:
 *  1. retarget connected pipes BEFORE the host moves (OLD→NEW anchors)
 *  2. apply the host's own geometry updates (caller-supplied)
 *  3. recompute hosted wall openings against the moved wall
 *  4. translate the slab's independent-coord slab-openings by the same delta
 *  5. reframe beams (column/beam move) + announce everything in ONE emit
 *
 * Undo cascade order — emit-FIRST to close the Firebase ca9-reset race:
 *  1. emit the restored entities (marks persistence hooks dirty pre-mutation)
 *  2. reverse-follow connected pipes BEFORE the host reverts
 *  3. apply the host's reverse geometry updates (caller-supplied)
 *  4. recompute hosted wall openings
 *  5. reverse-translate slab-openings
 *  6. reframe beams against the reverted geometry (separate emit, restore first)
 *  7. emit the reverted followers (slab-openings + pipes) if any
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import { reverseDelta } from './move-entity-geometry';
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
import {
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../../../bim/beams/beam-column-reframe-cascade';
import { cascadeMovedSlabOpenings } from '../../../bim/cascade/slab-opening-move-cascade';
import { cascadeConnectedPipesByDelta } from '../../../bim/mep-segments/cascade-connected-pipes-by-delta';

/**
 * Run the forward (execute/redo) move cascade for one or more entities.
 *
 * @param movedEntities  post-move host entities, prebuilt by the caller (snapshot+updates
 *                       on execute, scene+updates on redo) — never read from getLevelScene.
 * @param applyUpdates   applies the host geometry updates to the scene (updateEntity /
 *                       updateEntities) — runs AFTER pipe retargeting, BEFORE the cascades.
 */
export function runMoveForwardCascade(
  entityIds: string[],
  delta: Point2D,
  sceneManager: ISceneManager,
  movedEntities: SceneEntity[],
  applyUpdates: () => void,
): void {
  // ADR-408 Φ-C — retarget connected pipes BEFORE the host moves (OLD→NEW anchors).
  const movedPipes = cascadeConnectedPipesByDelta(entityIds, delta, sceneManager);
  applyUpdates();
  cascadeHostedOpeningsForWalls(entityIds, sceneManager);
  // ADR-049 — a moved slab carries its independent-coord slab-openings.
  const movedSlabOpenings = cascadeMovedSlabOpenings(entityIds, delta, sceneManager);
  // ADR-492 — reframe beams (column-move OR beam-move) + announce in the SAME emit
  // (persist + organism see the corrected geometry in one pass; no second event →
  // no reactive loop). Dedup-by-id: a moved beam that was itself reframed rides once.
  reframeBeamsAndEmit([...movedEntities, ...movedSlabOpenings, ...movedPipes], entityIds, sceneManager);
}

/**
 * Run the undo move cascade (reverse delta) for one or more entities.
 *
 * @param revertedEntities    original (pre-move) host entities from snapshots — emitted
 *                            FIRST so persistence hooks mark dirty before any mutation.
 * @param applyReverseUpdates applies the reverse geometry updates to the scene.
 */
export function runMoveUndoCascade(
  entityIds: string[],
  delta: Point2D,
  sceneManager: ISceneManager,
  revertedEntities: SceneEntity[],
  applyReverseUpdates: () => void,
): void {
  // Emit FIRST so the persistence hook marks entities dirty BEFORE the scene is
  // updated. This closes the race window where a Firebase ca9-reset snapshot
  // (dirty=false) could arrive between updateEntity and the emit and overwrite
  // the reverted scene with stale moved data.
  emitRestoredEntities(revertedEntities);
  // ADR-408 Φ-C — reverse-follow connected pipes BEFORE the host reverts (OLD→NEW anchors).
  const revertedPipes = cascadeConnectedPipesByDelta(entityIds, reverseDelta(delta), sceneManager);
  applyReverseUpdates();
  cascadeHostedOpeningsForWalls(entityIds, sceneManager);
  // ADR-049 — reverse-translate the slab's openings, then emit them so their
  // persistence saves the reverted footprint (same delta-invert, no snapshot).
  const revertedSlabOpenings = cascadeMovedSlabOpenings(entityIds, reverseDelta(delta), sceneManager);
  // ADR-492 — re-frame beams against the reverted geometry, separate emit (restore first).
  reframeBeamsAndEmitAfterRestore(entityIds, sceneManager);
  const revertedFollowers = [...revertedSlabOpenings, ...revertedPipes];
  if (revertedFollowers.length > 0) emitRestoredEntities(revertedFollowers);
}
