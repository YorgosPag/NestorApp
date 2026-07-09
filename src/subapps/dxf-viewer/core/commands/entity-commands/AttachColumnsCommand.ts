/**
 * ATTACH COLUMNS COMMAND — ADR-401 Phase F.3 (column auto/manual attach UX).
 *
 * Batch, undoable «Attach Top/Base to Structural» for N columns onto ONE structural
 * host (beam / slab). Sets each column's side binding to `'attached'` and appends the
 * host id to `attachTopToIds` / `attachBaseToIds`, then recomputes `geometry` +
 * `validation`. One command = ONE undo entry (Revit "Attach").
 *
 * Thin subclass of the `ColumnAttachDetachCommand` base (ADR-610): supplies ΜΟΝΟ the
 * column binding mutation (`attachEntitySide`) + metadata. Columns do NOT host openings
 * → no cascade.
 *
 * @see ./attach-detach-domain-commands.ts — the column base (recompute + snapshot)
 * @see ./DetachColumnsCommand.ts — the detach twin
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F)
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { ColumnKind, ColumnParams } from '../../../bim/types/column-types';
import { attachEntitySide, type EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import { ColumnAttachDetachCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

export type ColumnAttachSide = EntityAttachSide;

/** A column to attach + its `kind` (kept in sync on the entity root). */
export interface ColumnAttachTarget {
  readonly columnId: string;
  readonly kind: ColumnKind;
}

export class AttachColumnsCommand extends ColumnAttachDetachCommand {
  readonly name = 'AttachColumns';
  readonly type = 'attach-columns';

  constructor(
    private readonly side: ColumnAttachSide,
    private readonly hostId: string,
    private readonly targets: readonly ColumnAttachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): AttachDetachPatch<ColumnParams>[] {
    return this.buildColumnPatches(this.targets, (t) => t.columnId, (prev) =>
      attachEntitySide(prev, this.side, this.hostId),
    );
  }

  getDescription(): string {
    return `Attach ${this.targets.length} column(s) ${this.side} to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.columnId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
    if (this.targets.length === 0) return 'At least one column target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { side: this.side, hostId: this.hostId, targets: this.targets };
  }
}
