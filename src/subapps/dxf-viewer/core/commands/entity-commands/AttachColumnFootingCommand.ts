/**
 * ATTACH COLUMN-FOOTING COMMAND — ADR-459 Phase 2 (analytical connectivity FK).
 *
 * Batch, undoable εδραίωση του **αναλυτικού** FK `ColumnParams.footingId` για N
 * κολόνες προς ΕΝΑ footing element (πέδιλο/πεδιλοδοκός/εδαφόπλακα). Revit
 * Structural Connectivity: η σχέση στήριξης γίνεται **ρητή & persisted**, ώστε ο
 * στατικός οργανισμός (ADR-459) να είναι authoritative και το «λείπει το πέδιλο»
 * hard. Mirror του `AttachColumnsCommand`.
 *
 * **Geometry-neutral:** το `footingId` ΔΕΝ μετακινεί τη βάση της κολόνας (το
 * φυσικό base-attach είναι ξεχωριστό — `attachBaseToIds`/ADR-401). Recompute
 * geometry+validation γίνεται μόνο για consistency με το contract του
 * `updateEntity` (το αποτέλεσμα είναι ταυτόσημο — κανένα από τα δύο δεν διαβάζει
 * `footingId`).
 *
 * Per-column snapshots (prev/next params) χτίζονται ΜΙΑ φορά στο πρώτο
 * `execute()`· `undo()`/`redo()` είναι pure re-applies (idempotent). Το undo
 * αφαιρεί το FK (επαναφέρει το prev — τυπικά `footingId: undefined`).
 *
 * @see core/commands/entity-commands/AttachColumnsCommand.ts — το pattern mirror
 * @see bim/foundations/foundation-column-attach-coordinator.ts — η detection
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
// ADR-401 — persist the FK change (auto-attach targets non-selected columns).
import { signalEntitiesAttached } from './attach-persist-signal';

interface ColumnFootingPatch {
  readonly columnId: string;
  readonly prev: ColumnParams;
  readonly next: ColumnParams;
}

export class AttachColumnFootingCommand implements ICommand {
  readonly id: string;
  readonly name = 'AttachColumnFooting';
  readonly type = 'attach-column-footing';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: ColumnFootingPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly footingId: string,
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

  /** Snapshot live params per column → {prev, next} (next = prev + footingId). */
  private buildPatches(): void {
    for (const columnId of this.columnIds) {
      const entity = this.sceneManager.getEntity(columnId) as unknown as { params?: ColumnParams } | undefined;
      const prev = entity?.params;
      if (!prev || prev.footingId === this.footingId) continue; // idempotent
      this.patches.push({ columnId, prev, next: { ...prev, footingId: this.footingId } });
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
    return `Attach ${this.columnIds.length} column(s) to footing ${this.footingId}`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.columnIds];
  }

  validate(): string | null {
    if (!this.footingId) return 'Footing entity ID is required';
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
        footingId: this.footingId,
        columnIds: [...this.columnIds],
      },
      version: 1,
    };
  }
}
