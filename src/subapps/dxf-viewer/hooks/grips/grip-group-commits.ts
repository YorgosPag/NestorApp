/**
 * ADR-575 §8 — GROUP gizmo ROTATION commit (whole-group rotate about the bbox centre).
 *
 * The group rotation handle routes through the CANONICAL `RotateEntityCommand` (the
 * SAME undoable, merge-coalescing command the ROTATE tool + the line/arc/polyline
 * rotation handles use) — NO bespoke transform. `RotateEntityCommand` runs the ONE
 * `rotateEntity` engine, whose `case 'group'` recurses every member about the SAME
 * pivot (handles nested groups too), so a group rotation is «just another entity id»
 * to the command.
 *
 * The swept angle + pivot come from the SHARED `resolveRotation` SSoT
 * (`grip-primitive-rotate-commits.ts`): the hot-grip rotate flow publishes {pivot,
 * anchor} in `BimRotateHotGripStore` before commit, and the swept angle = angle(anchor+
 * delta) − angle(anchor) about the pivot. The fallback pivot (no hot-grip centre picked)
 * is the group's bbox centre — the SAME `computeGroupSelectionBounds(...).center` the
 * gizmo places its handles on, so pivot ≡ gizmo origin. A degenerate / zero sweep no-ops.
 *
 * The `group-move` cross is NOT handled here — it is a whole-group TRANSLATE that falls
 * through to `commitWholeEntityMove` (→ `deps.moveEntities` → `calculateMovedGeometry`
 * case 'group' → recurse members), mirror of the line/arc/polyline move cross.
 *
 * @see hooks/grips/grip-primitive-rotate-commits.ts — `resolveRotation` (the shared SSoT)
 * @see utils/rotation-math.ts — `rotateEntity` case 'group' (the recurse engine)
 * @see docs/centralized-systems/reference/adrs/ADR-575-join-group-inverse-of-explode.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GroupEntity } from '../../types/entities';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';
import { computeGroupSelectionBounds } from '../../systems/group/group-selection-bounds';
import { resolveRotation } from './grip-primitive-rotate-commits';
// ADR-561 EXT — copy intent SSoT (right-click «Copy» toggle OR live Ctrl/⌘), the SAME
// predicate the primitive move-copy + rotate-copy commits use.
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';

/** Minimal structural view of the group scene shape read here. */
interface GroupSceneShape {
  type?: string;
  members?: unknown[];
}

/**
 * ADR-575 §8 — group gizmo rotation commit. Only the `'group-rotation'` handle routes
 * here (the `'group-move'` cross falls through to the whole-group translate upstream).
 * Rotates the whole group about its bbox centre via the canonical `RotateEntityCommand`.
 */
export function commitGroupGizmoRotation(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.groupGripKind !== 'group-rotation') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId) as GroupSceneShape | undefined;
  if (!raw || raw.type !== 'group') return;
  const bounds = computeGroupSelectionBounds(raw as unknown as GroupEntity);
  if (!bounds) return;
  const res = resolveRotation(grip, delta, bounds.center);
  if (!res) return;
  // ADR-561 EXT — Ctrl / «Copy» toggle → rotate a CLONE about the pivot. The canonical
  // `RotateEntityCommand.copyMode` owns the clone + undo/redo (ADR-357 Φ12).
  const command = new RotateEntityCommand([grip.entityId], res.pivot, res.sweptDeg, sceneManager, false, isGripCopyIntent());
  if (command.validate() !== null) return;
  deps.execute(command);
}
