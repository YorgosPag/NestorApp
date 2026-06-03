/**
 * DELETE WALL FAMILY TYPE COMMAND — ADR-412 Φ5 (Q6, non-destructive detach).
 *
 * Deletes a wall family type that may be in use. Composed as a `CompoundCommand`
 * (single undo) of:
 *   1. N × `AssignWallTypeCommand` — detach each current-scene instance
 *      (`typeId → undefined`, params KEPT = non-destructive). Reuses the
 *      existing, tested per-instance command.
 *   2. `CatalogDeleteOp` (last child) — optimistically remove the type from the
 *      catalog store + fire-and-forget delete the doc + audit.
 *
 * Child order matters: forward = detach walls, THEN drop the type (no dangling
 * link on the active scene). Undo (reverse) = restore the type FIRST (with its
 * original id), then re-attach the walls — so they re-link to the restored type.
 *
 * Cross-floor / non-selected instances are NOT eagerly detached here (would need
 * the all-floors persistence fan-out). They keep a dangling `typeId` in Firestore
 * but render correctly: `resolveEffectiveWallParams` falls back to the instance's
 * cached params when the type is gone («type always wins», graceful) — the
 * drift-tolerant cache `docToEntity` already relies on. Cleaned on next per-wall
 * save. Documented (not silent).
 *
 * @see AssignWallTypeCommand.ts — the reused per-instance detach
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
 * and is undone first (reverse) — restoring the type before walls re-link.
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
    return `Delete wall type (${this.snapshot.id})`;
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
 * remove the type. Pass the resolved per-instance `AssignWallTypeCommand` detach
 * children (built by the controller) + the catalog snapshot + side-effect deps.
 */
export function createDeleteWallFamilyTypeCommand(
  snapshot: BimFamilyType,
  detachCommands: readonly ICommand[],
  deps: FamilyTypeDeleteDeps,
): CompoundCommand {
  return new CompoundCommand('DeleteWallFamilyType', [
    ...detachCommands,
    new CatalogDeleteOp(snapshot, deps),
  ]);
}
