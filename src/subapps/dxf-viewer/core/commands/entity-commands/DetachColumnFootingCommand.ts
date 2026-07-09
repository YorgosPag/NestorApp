/**
 * DETACH COLUMN-FOOTING COMMAND — ADR-459 Φ4f (manual connectivity UX).
 *
 * Batch, undoable αφαίρεση του **αναλυτικού** FK `ColumnParams.footingId` για N
 * κολόνες — ο αντίστροφος του `AttachColumnFootingCommand`. Geometry-neutral. Το `next`
 * **αφαιρεί το κλειδί** `footingId` (ΟΧΙ explicit `undefined` — Firestore-safe, ADR-390 Φ4).
 *
 * Thin subclass of the `ColumnFootingFkCommand` base (ADR-610). Το undo επαναφέρει το
 * prev (με το αρχικό footingId).
 *
 * @see ./attach-detach-domain-commands.ts — ColumnFootingFkCommand (columnIds + recompute)
 * @see ./AttachColumnFootingCommand.ts — ο δίδυμος attach
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6h
 */

import type { SerializedCommand } from '../interfaces';
import type { ColumnParams } from '../../../bim/types/column-types';
import { ColumnFootingFkCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

/** Αφαιρεί το κλειδί `footingId` (Firestore-safe — όχι explicit undefined). */
function withoutFootingId(params: ColumnParams): ColumnParams {
  const { footingId: _omit, ...rest } = params;
  void _omit;
  return rest;
}

export class DetachColumnFootingCommand extends ColumnFootingFkCommand {
  readonly name = 'DetachColumnFooting';
  readonly type = 'detach-column-footing';

  protected buildPatches(): AttachDetachPatch<ColumnParams>[] {
    return this.footingPatches((prev) =>
      prev.footingId === undefined ? null : withoutFootingId(prev),
    );
  }

  getDescription(): string {
    return `Detach ${this.columnIds.length} column(s) from footing`;
  }

  validate(): string | null {
    if (this.columnIds.length === 0) return 'At least one column id is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { columnIds: [...this.columnIds] };
  }
}
