/**
 * SSoT command-based delete for DXF/BIM entities by id.
 *
 * Extracted (behavior-preserving) from `useSmartDelete` PRIORITY 3 so the SAME
 * canonical delete path is shared by BOTH triggers:
 *   - keyboard / floating-toolbar Delete (`useSmartDelete`)
 *   - contextual ribbon «Διαγραφή» (`useRibbonEntityDelete` → the 6 structural
 *     bridges: column / beam / wall / slab / roof / opening)
 *
 * Before unification the ribbon path raw-emitted `bim:X-delete-requested`, which
 * was NOT undoable and ran NO cascades. Routing it through this core gives the
 * ribbon delete the full command semantics:
 *   - undoable via CommandHistory (Ctrl+Z) — symmetric restore (ADR-390)
 *   - wall→opening + slab→slab-opening orphan cascade (ADR-363 Φ7A)
 *   - ADR-401 host-detach (column + wall) + structural-host warning (inside the
 *     Delete command itself)
 *   - ADR-408 Φ4 MEP integrity cascade bundled in one CompoundCommand
 *   - synchronous scene removal BEFORE `emitBimDeleteEvents` → the coalesced
 *     structural reactions read a FRESH scene (eliminates the delete-path race
 *     structurally instead of the per-hook optimistic band-aid).
 *
 * Selection / grip / cross-level-footing / circuit handling stay with the
 * callers (those are trigger-specific, not part of the delete mechanism).
 *
 * @module hooks/canvas/delete-entities-core
 * @see ./useSmartDelete.ts
 * @see ../../ui/ribbon/hooks/useRibbonEntityDelete.ts
 * @see ADR-032 (command history) · ADR-390 (symmetric delete/undo) · ADR-401 (cascade)
 */

import {
  DeleteEntityCommand,
  DeleteMultipleEntitiesCommand,
  CompoundCommand,
  type ICommand,
} from '../../core/commands';
import type { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import type { Entity } from '../../types/entities';
import { collectBimDeleteIds, emitBimDeleteEvents } from './smart-delete-bim-events';
import {
  findHostedOpenings,
  findHostedSlabOpenings,
  findHostedStairwellOpenings,
} from '../../bim/cascade/bim-cascade-resolver';
import { isManagedSlabOpening } from '../../bim/stairs/managed-slab-opening-lock';
import { createModuleLogger } from '@/lib/telemetry';
import { requestWallCascadeDelete } from '../../bim/walls/wall-cascade-delete-store';
import { resolveMepCascadeOnDelete } from '../../bim/mep-systems/mep-system-coordinator';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { UpdateMepSystemParamsCommand } from '../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { DissolveMepSystemCommand } from '../../core/commands/entity-commands/DissolveMepSystemCommand';

const logger = createModuleLogger('delete-entities-core');

export interface DeleteEntitiesCoreDeps {
  /** Level-scoped scene manager (the delete commands mutate the scene through it). */
  readonly adapter: LevelSceneManagerAdapter;
  /**
   * Live scene entities of the active level — needed for the host-lookup of the
   * wall→opening / slab→slab-opening orphan cascade. Pass `scene.entities` of the
   * level the adapter targets.
   */
  readonly sceneEntities: readonly Entity[];
  /** CommandHistory execute (undoable). */
  readonly executeCommand: (command: ICommand) => void;
}

/**
 * Delete `ids` through the canonical command path (+ cascades + Firestore events).
 *
 * Returns `false` when nothing was deleted because the user cancelled the
 * wall-opening cascade prompt (mirrors the old `useSmartDelete` early-return);
 * `true` once the delete command has executed. Does NOT touch selection — the
 * caller clears whatever selection model it owns.
 */
export async function deleteEntitiesById(
  ids: readonly string[],
  deps: DeleteEntitiesCoreDeps,
): Promise<boolean> {
  const { adapter, sceneEntities, executeCommand } = deps;
  if (ids.length === 0) return false;

  // ADR-632 Φ5 — managed (engine-owned) stairwell openings είναι κλειδωμένα:
  // η ΑΠΕΥΘΕΙΑΣ επιλογή τους για delete τα προστατεύει (hard-block) — ο engine ή
  // το ρητό Override τα διαχειρίζεται, ΠΟΤΕ σιωπηλή απώλεια. Δεν εξαφανίζονται
  // αθόρυβα (N.7.2 → log). Τα cascade-added σε delete ΣΚΑΛΑΣ ΔΕΝ επηρεάζονται
  // (προστίθενται χωριστά παρακάτω, δεν είναι στο `ids`).
  const protectedManagedIds = ids.filter((id) => {
    const e = adapter.getEntity(id);
    return e ? isManagedSlabOpening(e as unknown as Entity) : false;
  });
  const effectiveIds = protectedManagedIds.length === 0
    ? ids
    : ids.filter((id) => !protectedManagedIds.includes(id));
  if (protectedManagedIds.length > 0) {
    logger.warn('delete: skipped managed stairwell opening(s) — locked; delete the stair or Override first', {
      count: protectedManagedIds.length,
    });
  }
  if (effectiveIds.length === 0) return false;

  // ADR-363 Φ7A — BIM cascade via the centralized resolver (SSoT). wall→opening
  // prompts the user (existing wall-cascade-delete dialog); slab→slab-opening
  // cascades automatically (orphan prevention, no prompt).
  const deletingWallIds = new Set(effectiveIds.filter((id) => adapter.getEntity(id)?.type === 'wall'));
  const deletingSlabIds = new Set(effectiveIds.filter((id) => adapter.getEntity(id)?.type === 'slab'));
  // ADR-632 Φ4 — σκάλα → auto stairwell openings (marker `autoStairId`) που
  // κατέχει· cascade σιωπηλά (auto-derived, όχι user-authored).
  const deletingStairIds = new Set(effectiveIds.filter((id) => adapter.getEntity(id)?.type === 'stair'));
  const selectionSet = new Set(effectiveIds);
  const orphanedOpeningIds = findHostedOpenings(deletingWallIds, sceneEntities, selectionSet);
  const orphanedSlabOpeningIds = findHostedSlabOpenings(deletingSlabIds, sceneEntities, selectionSet);
  const orphanedStairwellOpeningIds = findHostedStairwellOpenings(
    deletingStairIds,
    sceneEntities,
    selectionSet,
  );

  let idsToDelete: string[] = [...effectiveIds];
  if (orphanedOpeningIds.length > 0) {
    const action = await requestWallCascadeDelete(orphanedOpeningIds.length);
    if (action === 'cancel') return false;
    idsToDelete = [...idsToDelete, ...orphanedOpeningIds];
  }
  if (orphanedSlabOpeningIds.length > 0) {
    idsToDelete = [...idsToDelete, ...orphanedSlabOpeningIds];
  }
  if (orphanedStairwellOpeningIds.length > 0) {
    idsToDelete = [...idsToDelete, ...orphanedStairwellOpeningIds];
  }

  // Collect BIM IDs by type BEFORE executeCommand removes them from the scene
  // (SSoT: smart-delete-bim-events.ts).
  const collected = collectBimDeleteIds(idsToDelete, adapter);

  const deleteCommand: ICommand = idsToDelete.length === 1
    ? new DeleteEntityCommand(idsToDelete[0], adapter)
    : new DeleteMultipleEntitiesCommand(idsToDelete, adapter);

  // ADR-408 Φ4 — plan the MEP integrity cascade for the deleted panels / fixtures
  // (the only entities that can be a circuit source or member) and bundle the
  // dissolve / member-removal commands with the entity delete so a single Ctrl+Z
  // reverses everything.
  const deletedMepIds = new Set<string>([...collected.panelIds, ...collected.fixtureIds]);
  const cascade = deletedMepIds.size > 0
    ? resolveMepCascadeOnDelete(deletedMepIds, useMepSystemStore.getState().getSystems())
    : { dissolve: [], memberRemovals: [] };
  const cascadeCommands: ICommand[] = [
    ...cascade.dissolve.map((s) => new DissolveMepSystemCommand(s)),
    ...cascade.memberRemovals.map(
      (r) => new UpdateMepSystemParamsCommand(r.systemId, r.nextParams, r.prevParams),
    ),
  ];

  if (cascadeCommands.length > 0) {
    executeCommand(new CompoundCommand('Delete MEP', [deleteCommand, ...cascadeCommands]));
  } else {
    executeCommand(deleteCommand);
  }

  // Trigger Firestore deleteDoc (+ subscription re-add prevention) for each
  // deleted BIM entity type (SSoT: smart-delete-bim-events.ts).
  emitBimDeleteEvents(collected);

  return true;
}
