/**
 * AUTO-REINFORCE ORGANISM COMMAND — ADR-459 Phase 4d (auto-apply reinforcement).
 *
 * Batch, undoable αυτόματος οπλισμός N δομικών μελών (κολόνα / δοκάρι / πέδιλο):
 * κάθε μέλος **χωρίς** `params.reinforcement` παίρνει τον code-suggested
 * ελάχιστο-έγκυρο οπλισμό (μέσω `provider.suggest*` + SSoT section-context).
 * Revit «Reinforcement» auto-apply — η πρόθεση οπλισμού γίνεται **persisted**
 * (ΟΧΙ DERIVED· τα διαγνωστικά/ποσότητες παραμένουν DERIVED).
 *
 * **Geometry-neutral:** ο οπλισμός είναι additive — δεν αλλάζει διαστάσεις, οπότε
 * το `updateEntity` δέχεται μόνο `{kind, params}` (geometry/validation cache του
 * entity μένουν έγκυρα). Mirror του `AttachColumnFootingCommand`.
 *
 * Per-member snapshots χτίζονται ΜΙΑ φορά στο πρώτο `execute()`· `undo`/`redo` =
 * pure re-applies (idempotent). Idempotent ΚΑΙ ως προς ήδη-οπλισμένα μέλη (skip).
 * Το `prev` κρατά τα αρχικά params αυτούσια (χωρίς `reinforcement` key) → το undo
 * δεν εισάγει explicit `undefined` (Firestore-safe).
 *
 * @see core/commands/entity-commands/AttachColumnFootingCommand.ts — το pattern mirror
 * @see bim/structural/section-context.ts — buildReinforcePatch (SSoT dispatcher)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4d
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import type { BeamSupportType } from '../../../bim/types/beam-types';
import type { SlabSupportCondition } from '../../../bim/structural/loads/slab-beam-support';
import { buildReinforcePatch, type ReinforceableParams } from '../../../bim/structural/reinforce-patch';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

interface ReinforcePatchEntry {
  readonly entityId: string;
  readonly prev: ReinforceableParams;
  readonly next: ReinforceableParams;
}

export class AutoReinforceOrganismCommand implements ICommand {
  readonly id: string;
  readonly name = 'AutoReinforceOrganism';
  readonly type = 'auto-reinforce-organism';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: ReinforcePatchEntry[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: readonly string[],
    private readonly sceneManager: ISceneManager,
    private readonly provider: StructuralCodeProvider,
    // ADR-486 — DERIVED topology-aware τύπος στήριξης ανά δοκάρι (πρόβολος → wL²/2).
    private readonly supportTypeByBeamId?: ReadonlyMap<string, BeamSupportType>,
    // ADR-491 — DERIVED FEM ροπή φορέα ανά κολώνα στήριξης (πρόβολος → M-N οπλισμός).
    private readonly columnFemMomentById?: ReadonlyMap<string, number>,
    // ADR-498 — DERIVED topology-aware συνθήκη στήριξης ανά πλάκα (πρόβολος → hogging άνω σχάρα).
    private readonly slabSupportConditionBySlabId?: ReadonlyMap<string, SlabSupportCondition>,
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

  /** Snapshot live params per member → {prev, next}. Skips non-structural & already-reinforced. */
  private buildPatches(): void {
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity) continue;
      const patch = buildReinforcePatch(
        entity,
        this.provider,
        this.supportTypeByBeamId?.get(entityId),
        this.columnFemMomentById?.get(entityId),
        this.slabSupportConditionBySlabId?.get(entityId),
      );
      if (!patch) continue; // idempotent: non-structural ή ήδη οπλισμένο
      this.patches.push({ entityId, prev: patch.prev, next: patch.next });
    }
  }

  /** Geometry-neutral apply — reinforcement είναι additive, geometry/validation αμετάβλητα. */
  private applyPatch(entityId: string, params: ReinforceableParams): void {
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast the patched members so the persistence layer saves them. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  /** Ids που πράγματι οπλίστηκαν (μετά το build) — για toast/emit count. */
  getReinforcedEntityIds(): string[] {
    if (this.patches.length === 0) this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Auto-reinforce ${this.patches.length} structural member(s)`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  validate(): string | null {
    if (this.entityIds.length === 0) return 'At least one entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityIds: [...this.entityIds],
      },
      version: 1,
    };
  }
}
