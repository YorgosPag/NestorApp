/**
 * DETACH COLUMN-FOOTING COMMAND — ADR-459 Φ4f (manual connectivity UX).
 *
 * Batch, undoable αφαίρεση του **αναλυτικού** FK `ColumnParams.footingId` για N
 * κολόνες — ο αντίστροφος του `AttachColumnFootingCommand`. Revit Structural
 * «Detach»: η ρητή σχέση στήριξης κολόνας↔πεδίλου σπάει, ώστε ο στατικός
 * οργανισμός (ADR-459) να επανέλθει σε spatial-coincidence fallback ή να
 * επισημάνει «λείπει το πέδιλο» αν δεν υπάρχει κάλυψη.
 *
 * **Geometry-neutral:** το `footingId` ΔΕΝ μετακινεί τη βάση της κολόνας — όπως και
 * στο attach. Το `next` **αφαιρεί το κλειδί** `footingId` (ΟΧΙ explicit `undefined`)
 * ώστε το persist να μη σπάσει το Firestore (μάθημα ADR-390 Φ4).
 *
 * Per-column snapshots χτίζονται ΜΙΑ φορά στο πρώτο `execute()`· `undo`/`redo` =
 * pure re-applies (idempotent). Το undo επαναφέρει το prev (με το αρχικό footingId).
 *
 * @see core/commands/entity-commands/AttachColumnFootingCommand.ts — ο δίδυμος attach
 * @see core/commands/entity-commands/DetachColumnsCommand.ts — το detach pattern
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6h
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

interface ColumnFootingDetachPatch {
  readonly columnId: string;
  readonly prev: ColumnParams;
  readonly next: ColumnParams;
}

/** Αφαιρεί το κλειδί `footingId` (Firestore-safe — όχι explicit undefined). */
function withoutFootingId(params: ColumnParams): ColumnParams {
  const { footingId: _omit, ...rest } = params;
  void _omit;
  return rest;
}

export class DetachColumnFootingCommand implements ICommand {
  readonly id: string;
  readonly name = 'DetachColumnFooting';
  readonly type = 'detach-column-footing';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: ColumnFootingDetachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly columnIds: readonly string[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.columnId, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.columnId, p.prev);
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.columnId, p.next);
    this.signalPersist();
  }

  /** Snapshot live params per column → {prev, next} (next = prev χωρίς footingId). */
  private buildPatches(): void {
    for (const columnId of this.columnIds) {
      const entity = this.sceneManager.getEntity(columnId) as unknown as { params?: ColumnParams } | undefined;
      const prev = entity?.params;
      if (!prev || prev.footingId === undefined) continue; // idempotent: ήδη αποσυνδεδεμένη
      this.patches.push({ columnId, prev, next: withoutFootingId(prev) });
    }
  }

  private applyPatch(columnId: string, params: ColumnParams): void {
    const geometry: ColumnGeometry = computeColumnGeometry(params);
    const validation = validateColumnParams(params).bimValidation;
    this.sceneManager.updateEntity(columnId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast the patched columns so the persistence layer saves them. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.columnId));
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Detach ${this.columnIds.length} column(s) from footing`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.columnIds];
  }

  validate(): string | null {
    if (this.columnIds.length === 0) return 'At least one column id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        columnIds: [...this.columnIds],
      },
      version: 1,
    };
  }
}
