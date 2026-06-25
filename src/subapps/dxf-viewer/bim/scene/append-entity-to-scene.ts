/**
 * ADR-397 — SSoT for the "append a freshly-built BIM entity to the active level
 * scene + broadcast `drawing:entity-created`" pattern.
 *
 * Before this module the append-then-emit body was copy-pasted in
 * `useSpecialTools.appendAndBroadcast` (slab / beam / column-draw) and in
 * `add-column-to-scene` / `add-wall-to-scene`. This is the single
 * implementation; the per-entity helpers now delegate here (N.0.2 — no
 * duplicate of the persistence trigger).
 *
 * The `drawing:entity-created` broadcast is REQUIRED, not optional: it is the
 * trigger the `use*Persistence` hooks wait on to schedule the first Firestore
 * save. A bare scene mutation (without the event) leaves the entity local-only.
 *
 * ADR-390 (2026-06-21) — UNDOABLE: the append now runs through a
 * `CreateBimEntityCommand` on the global `CommandHistory` instead of a bare
 * `setLevelScene()`. Before, the manual-draw / Ctrl-COPY create was NOT on the
 * undo stack, so Ctrl+Z could not remove a freshly-placed column/beam/slab (the
 * only undoable step was a downstream structural reaction). The command keeps the
 * exact same `drawing:entity-created` broadcast on execute/redo and adds the
 * symmetric `bim:<type>-delete-requested` cleanup on undo.
 *
 * Walls do NOT use this directly because they recompute neighbour trims over the
 * whole entity list before persisting (`add-wall-to-scene`), which replaces the
 * single-append semantics — that is a deliberate, documented exception.
 *
 * @see core/commands/entity-commands/CreateBimEntityCommand.ts — the undoable command
 * @see bim/columns/add-column-to-scene.ts — column wrapper (draw + Ctrl-copy)
 * @see hooks/tools/useSpecialTools.ts — slab / beam draw callers
 */
import type { SceneModel } from '../../types/scene';
import type { AnySceneEntity } from '../../types/scene';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateBimEntityCommand } from '../../core/commands/entity-commands/CreateBimEntityCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';

/**
 * Minimal level-scene accessor — structurally satisfied by both
 * `LevelsHookReturn` (draw tools) and `DxfCommitDeps` (grip commits).
 */
export interface SceneAppendAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Append `entity` to the active level scene as an **undoable** create
 * (`CreateBimEntityCommand`) and broadcast `drawing:entity-created` with the given
 * `tool`. No-op when there is no active level / scene.
 */
export function appendEntityToScene<E extends { id: string }>(
  accessor: SceneAppendAccessor,
  entity: E,
  tool: string,
): void {
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  // Preserve the original no-scene no-op (the adapter would otherwise mint a
  // default scene). BIM creates always have an active floor scene.
  if (!accessor.getLevelScene(levelId)) return;
  // ADR-527: shared singleton adapter per (accessor, level) — not a fresh `new` per call.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  const command = new CreateBimEntityCommand(entity as unknown as AnySceneEntity, tool, adapter);
  getGlobalCommandHistory().execute(command);
}

/**
 * ADR-511 (Slice C) — Append MANY freshly-built BIM entities as a SINGLE undoable batch
 * (`CompoundCommand` of `CreateBimEntityCommand`s). Each child still broadcasts
 * `drawing:entity-created` so every entity persists, but Ctrl+Z removes the whole batch at
 * once (Revit «room-fill = one undo»). No-op when there is no active level / scene / entities.
 */
export function appendEntitiesToScene<E extends { id: string }>(
  accessor: SceneAppendAccessor,
  entities: readonly E[],
  tool: string,
  batchName = 'Batch create',
): void {
  const levelId = accessor.currentLevelId;
  if (!levelId || entities.length === 0) return;
  if (!accessor.getLevelScene(levelId)) return;
  // ADR-527: shared singleton adapter per (accessor, level) — not a fresh `new` per call.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  const commands = entities.map(
    (e) => new CreateBimEntityCommand(e as unknown as AnySceneEntity, tool, adapter),
  );
  getGlobalCommandHistory().execute(new CompoundCommand(batchName, commands));
}
