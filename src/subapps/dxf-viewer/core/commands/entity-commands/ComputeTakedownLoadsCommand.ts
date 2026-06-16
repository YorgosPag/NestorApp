/**
 * COMPUTE TAKEDOWN LOADS COMMAND — ADR-464 Slice 4 (tributary load takedown).
 *
 * Batch, undoable εγγραφή του DERIVED service φορτίου (`appliedLoad`,
 * source='takedown') σε N πέδιλα (pad). Τα προτεινόμενα φορτία υπολογίζονται pure
 * από τον `computeFootingTakedownLoads` (tributary half-spacing + area loads) και
 * περνούν εδώ έτοιμα· το command απλώς τα εφαρμόζει + υποστηρίζει undo/redo.
 *
 * **Geometry-neutral:** το φορτίο είναι additive input — δεν αλλάζει διαστάσεις,
 * οπότε το `updateEntity` δέχεται μόνο `{kind, params}` (mirror του
 * `AutoReinforceOrganismCommand`). Το `prev` κρατά τα αρχικά params αυτούσια ώστε
 * το undo να μην εισάγει explicit `undefined` (Firestore-safe, ADR-390 Φ4).
 *
 * @see bim/structural/footing-design/footing-load-takedown.ts — pure computation
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το pattern mirror
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { isFoundationEntity } from '../../../types/entities';
import type { FoundationParams } from '../../../bim/types/foundation-types';
import { isTakedownWritable } from '../../../bim/structural/loads/structural-loads-types';
import type { FootingTakedownLoad } from '../../../bim/structural/footing-design/footing-load-takedown';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

interface TakedownPatchEntry {
  readonly entityId: string;
  readonly prev: FoundationParams;
  readonly next: FoundationParams;
}

export class ComputeTakedownLoadsCommand implements ICommand {
  readonly id: string;
  readonly name = 'ComputeTakedownLoads';
  readonly type = 'compute-takedown-loads';
  readonly timestamp: number;

  private patches: TakedownPatchEntry[] = [];
  private wasExecuted = false;

  constructor(
    private readonly loads: readonly FootingTakedownLoad[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.entityId, p.prev);
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
    this.signalPersist();
  }

  /** Snapshot live params per footing → {prev, next}. Re-checks pad + writability (idempotent). */
  private buildPatches(): void {
    for (const { footingId, appliedLoad } of this.loads) {
      const entity = this.sceneManager.getEntity(footingId) as unknown as Entity | undefined;
      if (!entity || !isFoundationEntity(entity) || entity.params.kind !== 'pad') continue;
      if (!isTakedownWritable(entity.params.appliedLoad)) continue;
      this.patches.push({
        entityId: footingId,
        prev: entity.params,
        next: { ...entity.params, appliedLoad },
      });
    }
  }

  /** Geometry-neutral apply — appliedLoad είναι input, geometry/validation αμετάβλητα. */
  private applyPatch(entityId: string, params: FoundationParams): void {
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast τα patched πέδιλα ώστε το persistence layer να τα σώσει. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  /** Ids που πράγματι έλαβαν φορτίο (μετά το build) — για toast/emit count. */
  getLoadedFootingIds(): string[] {
    if (this.patches.length === 0) this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Compute takedown loads for ${this.patches.length} footing(s)`;
  }

  getAffectedEntityIds(): string[] {
    return this.loads.map((l) => l.footingId);
  }

  validate(): string | null {
    if (this.loads.length === 0) return 'At least one footing load is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { footingIds: this.loads.map((l) => l.footingId) },
      version: 1,
    };
  }
}
