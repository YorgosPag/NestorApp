/**
 * DELETE FAMILY TYPE COMMAND — generic (ADR-412 Q6 / ADR-421 SLICE C).
 *
 * Category-agnostic version of `DeleteWallFamilyTypeCommand` (non-destructive
 * detach). Composed as a `CompoundCommand` (single undo) of:
 *   1. N × per-instance detach commands (e.g. `AssignOpeningTypeCommand` /
 *      `AssignWallTypeCommand`) — `typeId → undefined`, params KEPT. Built by the
 *      controller and passed in (this file is entity-agnostic).
 *   2. `CatalogDeleteOp` (last child) — optimistically remove the type from the
 *      catalog store + fire-and-forget delete the doc + audit.
 *
 * Child order matters: forward = detach instances, THEN drop the type. Undo
 * (reverse) = restore the type FIRST (original id), then re-attach the instances.
 *
 * Cross-floor / non-selected instances keep a dangling `typeId` in Firestore but
 * render correctly: `resolveEffective*Params` falls back to the instance's cached
 * params when the type is gone («type always wins», graceful). Cleaned on next
 * per-entity save. Documented (not silent).
 *
 * SSoT (ADR-604): the former per-entity `Delete{Wall,Slab,Roof}FamilyTypeCommand`
 * duplicates were removed — Wall/Slab/Roof/Opening controllers all inject this
 * single generic via `makeDeleteCommand`, passing their `label`.
 *
 * @see ../CompoundCommand.ts — single-undo composition
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §5 Q6
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { CompoundCommand } from '../CompoundCommand';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Injected catalog side-effects (store + persist + audit), testable. */
export interface FamilyTypeDeleteDeps {
  readonly getTypes: () => readonly BimFamilyType[];
  readonly setTypes: (types: readonly BimFamilyType[]) => void;
  /** Fire-and-forget Firestore delete of the type doc. */
  readonly removePersist: () => void;
  /** Fire-and-forget Firestore re-create with the ORIGINAL id (undo). */
  readonly restorePersist: () => void;
  readonly auditDeleted: () => void;
  readonly auditRestored: () => void;
}

/**
 * Catalog-level delete op: optimistic store removal + fire-and-forget persist +
 * audit. The LAST child of the compound so it runs after the detaches (forward)
 * and is undone first (reverse) — restoring the type before instances re-link.
 */
export class CatalogDeleteOp implements ICommand {
  readonly id: string;
  readonly name = 'CatalogDeleteFamilyType';
  readonly type = 'catalog-delete-family-type';
  readonly timestamp: number;

  constructor(
    private readonly snapshot: BimFamilyType,
    private readonly deps: FamilyTypeDeleteDeps,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.deps.setTypes(this.deps.getTypes().filter((t) => t.id !== this.snapshot.id));
    this.deps.removePersist();
    this.deps.auditDeleted();
  }

  undo(): void {
    // Avoid a duplicate if the snapshot somehow still resolves.
    const rest = this.deps.getTypes().filter((t) => t.id !== this.snapshot.id);
    this.deps.setTypes([...rest, this.snapshot]);
    this.deps.restorePersist();
    this.deps.auditRestored();
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Delete family type (${this.snapshot.id})`;
  }

  getAffectedEntityIds(): string[] {
    return [];
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { snapshot: this.snapshot },
      version: 1,
    };
  }
}

/**
 * Build the single-undo delete command: detach all current-scene instances, then
 * remove the type. `label` names the compound for the history (e.g.
 * `'DeleteOpeningFamilyType'`).
 */
export function createDeleteFamilyTypeCommand(
  label: string,
  snapshot: BimFamilyType,
  detachCommands: readonly ICommand[],
  deps: FamilyTypeDeleteDeps,
): CompoundCommand {
  return new CompoundCommand(label, [
    ...detachCommands,
    new CatalogDeleteOp(snapshot, deps),
  ]);
}
