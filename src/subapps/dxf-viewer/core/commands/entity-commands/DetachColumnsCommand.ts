/**
 * DETACH COLUMNS COMMAND — ADR-401 (manual/host-delete detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N columns — the inverse of
 * `AttachColumnsCommand`. Resets the side binding to its default + clears the host list
 * via the shared `detachEntitySide` SSoT, then recomputes geometry + validation.
 *
 * Thin subclass of the `ColumnAttachDetachCommand` base (ADR-610).
 *
 * @see ./attach-detach-domain-commands.ts — the column base (recompute + snapshot)
 * @see ./AttachColumnsCommand.ts — the attach twin
 * @see bim/entities/entity-attach-detach.ts — detachEntitySide SSoT
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { ColumnKind, ColumnParams } from '../../../bim/types/column-types';
import { detachEntitySide, type EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import { ColumnAttachDetachCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

export type ColumnDetachSide = EntityAttachSide;

/** A column to detach + its `kind` (kept in sync on the entity root). */
export interface ColumnDetachTarget {
  readonly columnId: string;
  readonly kind: ColumnKind;
}

export class DetachColumnsCommand extends ColumnAttachDetachCommand {
  readonly name = 'DetachColumns';
  readonly type = 'detach-columns';

  constructor(
    private readonly side: ColumnDetachSide,
    private readonly targets: readonly ColumnDetachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): AttachDetachPatch<ColumnParams>[] {
    return this.buildColumnPatches(this.targets, (t) => t.columnId, (prev) =>
      detachEntitySide(prev, this.side),
    );
  }

  getDescription(): string {
    return `Detach ${this.targets.length} column(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.columnId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one column target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { side: this.side, targets: this.targets };
  }
}
