/**
 * ATTACH COLUMN-FOOTING COMMAND — ADR-459 Phase 2 (analytical connectivity FK).
 *
 * Batch, undoable εδραίωση του **αναλυτικού** FK `ColumnParams.footingId` για N
 * κολόνες προς ΕΝΑ footing element. Revit Structural Connectivity: η σχέση στήριξης
 * γίνεται **ρητή & persisted**. Geometry-neutral (recompute μόνο για consistency).
 *
 * Thin subclass of the `ColumnFootingFkCommand` base (ADR-610): supplies το FK-add
 * mutation + idempotency guard. Το undo αφαιρεί το FK (prev).
 *
 * @see ./attach-detach-domain-commands.ts — ColumnFootingFkCommand (columnIds + recompute)
 * @see ./DetachColumnFootingCommand.ts — ο δίδυμος detach
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { ColumnParams } from '../../../bim/types/column-types';
import { ColumnFootingFkCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

export class AttachColumnFootingCommand extends ColumnFootingFkCommand {
  readonly name = 'AttachColumnFooting';
  readonly type = 'attach-column-footing';

  constructor(
    private readonly footingId: string,
    columnIds: readonly string[],
    sceneManager: ISceneManager,
  ) {
    super(columnIds, sceneManager);
  }

  protected buildPatches(): AttachDetachPatch<ColumnParams>[] {
    return this.footingPatches((prev) =>
      prev.footingId === this.footingId ? null : { ...prev, footingId: this.footingId },
    );
  }

  getDescription(): string {
    return `Attach ${this.columnIds.length} column(s) to footing ${this.footingId}`;
  }

  validate(): string | null {
    if (!this.footingId) return 'Footing entity ID is required';
    if (this.columnIds.length === 0) return 'At least one column id is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { footingId: this.footingId, columnIds: [...this.columnIds] };
  }
}
