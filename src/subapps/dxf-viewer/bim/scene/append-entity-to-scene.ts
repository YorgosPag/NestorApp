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
import type { Entity } from '../../types/entities';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateBimEntityCommand } from '../../core/commands/entity-commands/CreateBimEntityCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { EventBus } from '../../systems/events/EventBus';
import {
  STRUCTURAL_OVERLAP_TYPES,
  structuralFootprintOf,
  findStructuralOverlap,
} from '../placement/structural-placement-overlap';

/**
 * ADR-567 — `true` αν η δομική οντότητα θα καθόταν πάνω σε υπάρχουσα δομική (ουσιαστική
 * επικάλυψη εμβαδού). Emit-άρει `bim:placement-blocked` για non-blocking toast. Reuse
 * το SSoT {@link findStructuralOverlap}· non-structural τύποι (opening, MEP, furniture…)
 * περνούν πάντα (δεν ανήκουν στο {@link STRUCTURAL_OVERLAP_TYPES}).
 */
function isStructuralOverlapBlocked(entity: Entity, existing: readonly Entity[]): boolean {
  if (!STRUCTURAL_OVERLAP_TYPES.has(entity.type)) return false;
  const footprint = structuralFootprintOf(entity);
  if (!footprint) return false;
  const hit = findStructuralOverlap(footprint, existing, {
    excludeIds: new Set([entity.id]),
    candidateType: entity.type,
  });
  if (!hit) return false;
  EventBus.emit('bim:placement-blocked', { entityType: entity.type, blockedById: hit.blockedById, count: 1 });
  return true;
}

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
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;
  // ADR-567 — ΠΟΤΕ δομική πάνω σε υπάρχουσα δομική (ουσιαστική επικάλυψη εμβαδού).
  if (isStructuralOverlapBlocked(entity as unknown as Entity, scene.entities as unknown as Entity[])) return;
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
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;
  // ADR-567 — φιλτράρισε όσες θα κάθονταν πάνω σε υπάρχουσα δομική (ή σε ήδη-αποδεκτή
  // του ίδιου batch). Το `existing` μεγαλώνει με κάθε αποδεκτή ώστε τα region-fill κελιά
  // να μην επικαλύπτονται ούτε μεταξύ τους. `count` = πόσες κόπηκαν (N.7.2 — όχι silent cap).
  const existing: Entity[] = [...(scene.entities as unknown as Entity[])];
  const accepted: E[] = [];
  let blocked = 0;
  let firstBlockedById: string | null = null;
  let firstBlockedType: string | null = null;
  for (const e of entities) {
    const ent = e as unknown as Entity;
    if (STRUCTURAL_OVERLAP_TYPES.has(ent.type)) {
      const footprint = structuralFootprintOf(ent);
      const hit = footprint
        ? findStructuralOverlap(footprint, existing, { excludeIds: new Set([ent.id]), candidateType: ent.type })
        : null;
      if (hit) {
        blocked++;
        if (!firstBlockedById) {
          firstBlockedById = hit.blockedById;
          firstBlockedType = ent.type;
        }
        continue; // δεν μπαίνει ΚΑΙ δεν γίνεται baseline για τις επόμενες
      }
    }
    accepted.push(e);
    existing.push(ent);
  }
  if (blocked > 0 && firstBlockedById && firstBlockedType) {
    EventBus.emit('bim:placement-blocked', {
      entityType: firstBlockedType,
      blockedById: firstBlockedById,
      count: blocked,
    });
  }
  if (accepted.length === 0) return;
  // ADR-527: shared singleton adapter per (accessor, level) — not a fresh `new` per call.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  const commands = accepted.map(
    (e) => new CreateBimEntityCommand(e as unknown as AnySceneEntity, tool, adapter),
  );
  getGlobalCommandHistory().execute(new CompoundCommand(batchName, commands));
}
