/**
 * DELETE ROOF FAMILY TYPE COMMAND — ADR-417 §10 #3 (non-destructive detach). Roof
 * analogue of {@link DeleteSlabFamilyTypeCommand}.
 *
 * Deletes a roof family type that may be in use. Composed as a `CompoundCommand`
 * (single undo) of:
 *   1. N × `AssignRoofTypeCommand` — detach each current-scene instance
 *      (`typeId → undefined`, params KEPT = non-destructive). Reuses the
 *      existing, tested per-instance command.
 *   2. `RoofCatalogDeleteOp` (last child) — optimistically remove the type from
 *      the catalog store + fire-and-forget delete the doc + audit.
 *
 * Child order matters: forward = detach roofs, THEN drop the type. Undo
 * (reverse) = restore the type FIRST (with its original id), then re-attach.
 *
 * Cross-floor / non-selected instances keep a dangling `typeId` in Firestore but
 * render correctly: `resolveEffectiveRoofParams` falls back to the instance's
 * cached params when the type is gone («type always wins», graceful). Cleaned on
 * next per-roof save. Documented (not silent).
 *
 * @see AssignRoofTypeCommand.ts — the reused per-instance detach
 * @see DeleteSlabFamilyTypeCommand.ts — the slab sibling
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import { CompoundCommand } from '../CompoundCommand';
import type { BimFamilyType } from '../../../bim/types/bim-family-type';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Injected catalog side-effects (store + persist + audit), testable. */
export interface RoofFamilyTypeDeleteDeps {
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
 * and is undone first (reverse) — restoring the type before roofs re-link.
 */
export class RoofCatalogDeleteOp implements ICommand {
  readonly id: string;
  readonly name = 'RoofCatalogDeleteFamilyType';
  readonly type = 'roof-catalog-delete-family-type';
  readonly timestamp: number;

  constructor(
    private readonly snapshot: BimFamilyType,
    private readonly deps: RoofFamilyTypeDeleteDeps,
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
    return `Delete roof type (${this.snapshot.id})`;
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
 * remove the type. Pass the resolved per-instance `AssignRoofTypeCommand` detach
 * children (built by the controller) + the catalog snapshot + side-effect deps.
 */
export function createDeleteRoofFamilyTypeCommand(
  snapshot: BimFamilyType,
  detachCommands: readonly ICommand[],
  deps: RoofFamilyTypeDeleteDeps,
): CompoundCommand {
  return new CompoundCommand('DeleteRoofFamilyType', [
    ...detachCommands,
    new RoofCatalogDeleteOp(snapshot, deps),
  ]);
}
