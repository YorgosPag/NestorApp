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

import type { ISceneManager } from '../interfaces';
import type { Entity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import type { BeamSupportType } from '../../../bim/types/beam-types';
import type { SlabSupportCondition } from '../../../bim/structural/loads/slab-beam-support';
import { buildReinforcePatch, type ReinforceableParams } from '../../../bim/structural/reinforce-patch';
import {
  EntityIdsBatchPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

export class AutoReinforceOrganismCommand extends EntityIdsBatchPatchCommand<ReinforceableParams> {
  readonly name = 'AutoReinforceOrganism';
  readonly type = 'auto-reinforce-organism';

  constructor(
    entityIds: readonly string[],
    sceneManager: ISceneManager,
    private readonly provider: StructuralCodeProvider,
    // ADR-486 — DERIVED topology-aware τύπος στήριξης ανά δοκάρι (πρόβολος → wL²/2).
    private readonly supportTypeByBeamId?: ReadonlyMap<string, BeamSupportType>,
    // ADR-491 — DERIVED FEM ροπή φορέα ανά κολώνα στήριξης (πρόβολος → M-N οπλισμός).
    private readonly columnFemMomentById?: ReadonlyMap<string, number>,
    // ADR-498 — DERIVED topology-aware συνθήκη στήριξης ανά πλάκα (πρόβολος → hogging άνω σχάρα).
    private readonly slabSupportConditionBySlabId?: ReadonlyMap<string, SlabSupportCondition>,
    // ADR-499 §6.3-c — DERIVED στρεπτική ροπή T_Ed ανά δοκάρι (μονόπλευρη πρόβολος-πλάκα →
    // στρεπτικοί κλειστοί συνδετήρες + γωνιακοί διαμήκεις).
    private readonly beamTorsionByBeamId?: ReadonlyMap<string, number>,
    // ADR-504 Φ2 — DERIVED υπο-άνοιγμα συνεχούς δοκού ανά δοκάρι (wL_sub²/10 + συμμετρικός χάλυβας).
    private readonly beamSpanByBeamId?: ReadonlyMap<string, number>,
  ) {
    super(entityIds, sceneManager, true);
  }

  /** Snapshot live params per member → {prev, next}. Skips non-structural & already-reinforced. */
  protected buildPatches(): BatchPatchEntry<ReinforceableParams>[] {
    const out: BatchPatchEntry<ReinforceableParams>[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity) continue;
      const patch = buildReinforcePatch(
        entity,
        this.provider,
        this.supportTypeByBeamId?.get(entityId),
        this.columnFemMomentById?.get(entityId),
        this.slabSupportConditionBySlabId?.get(entityId),
        this.beamTorsionByBeamId?.get(entityId),
        this.beamSpanByBeamId?.get(entityId),
      );
      if (!patch) continue; // idempotent: non-structural ή ήδη οπλισμένο
      out.push({ entityId, prev: patch.prev, next: patch.next });
    }
    return out;
  }

  /** Geometry-neutral apply — reinforcement είναι additive, geometry/validation αμετάβλητα. */
  protected applyState(entry: BatchPatchEntry<ReinforceableParams>, params: ReinforceableParams): void {
    this.writeParamsOnly(entry.entityId, params);
  }

  /** Ids που πράγματι οπλίστηκαν (μετά το build) — για toast/emit count. */
  getReinforcedEntityIds(): string[] {
    return this.patchedEntityIds();
  }

  getDescription(): string {
    return `Auto-reinforce ${this.patches.length} structural member(s)`;
  }
  // getAffectedEntityIds / validate / serializeData inherited (EntityIdsBatchPatchCommand).
}
