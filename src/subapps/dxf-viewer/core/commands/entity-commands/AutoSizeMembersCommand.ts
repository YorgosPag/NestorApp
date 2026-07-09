/**
 * AUTO-SIZE MEMBERS COMMAND — ADR-475 (δοκάρι) + ADR-499 (πλάκα-πρόβολος), member-generic.
 *
 * Batch, undoable αυτόματη διαστασιολόγηση N μελών: κάθε AUTO μέλος παίρνει την
 * **ελάχιστη επαρκή** διατομή μέσω του αντίστοιχου SSoT patch builder —
 * `buildBeamSizePatch` (ύψος δοκαριού: EC2 §7.4.2 βέλος + ULS κάμψη/διάτμηση) ή
 * `buildSlabSizePatch` (πάχος πλάκας-προβόλου: L/d + φυσική πύλη M_Ed≤M_Rd,lim, ADR-499).
 * Revit-grade — η διατομή (`depth`/`thickness`) γίνεται **persisted** γεωμετρία (σε
 * αντίθεση με τον additive/derived οπλισμό).
 *
 * **Geometry-mutating:** αλλάζει διατομή → το `applyPatch` ξανα-υπολογίζει `geometry`
 * + `validation` atomically per kind (`compute{Beam,Slab}Geometry`+`validate{Beam,Slab}Params`,
 * mirror `Update{Beam,Slab}ParamsCommand`) ώστε render/BOQ να μην αποκλίνουν.
 *
 * Per-member snapshots χτίζονται ΜΙΑ φορά στο πρώτο `execute()`· `undo`/`redo` =
 * pure re-applies (idempotent). Idempotent ΚΑΙ ως προς converged/locked μέλη (skip
 * μέσω convergence guard / `autoSized:false`). Το `prev` κρατά τα αρχικά params
 * αυτούσια → το undo δεν εισάγει explicit `undefined` (Firestore-safe).
 *
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το pattern mirror
 * @see bim/structural/sizing/beam-size-patch.ts — buildBeamSizePatch (SSoT)
 * @see core/commands/entity-commands/UpdateBeamParamsCommand.ts — το geometry recompute mirror
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { isBeamEntity, isSlabEntity, isColumnEntity } from '../../../types/entities';
import type { BeamGeometry, BeamParams } from '../../../bim/types/beam-types';
import type { SlabGeometry, SlabParams } from '../../../bim/types/slab-types';
import type { ColumnGeometry, ColumnParams } from '../../../bim/types/column-types';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import { buildBeamSizePatch } from '../../../bim/structural/sizing/beam-size-patch';
import { buildSlabSizePatch } from '../../../bim/structural/sizing/slab-size-patch';
import { buildColumnSizePatch } from '../../../bim/structural/sizing/column-size-patch';
import {
  resolveActiveBeamSupportType,
  resolveActiveBeamTorsion,
  resolveActiveBeamSpanMm,
  resolveActiveBeamSizingLimits,
  resolveActiveSlabSupportCondition,
  resolveActiveColumnDesignMoment,
} from '../../../bim/structural/active-reinforcement';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import { validateBeamParams } from '../../../bim/validators/beam-validator';
import { validateSlabParams } from '../../../bim/validators/slab-validator';
import { validateColumnParams } from '../../../bim/validators/column-validator';
import {
  EntityIdsBatchPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

/** Διατομικά params μέλους που διαστασιολογείται (ύψος δοκαριού / πάχος πλάκας / διατομή κολώνας). */
type MemberSizeParams = BeamParams | SlabParams | ColumnParams;

interface SizePatchEntry extends BatchPatchEntry<MemberSizeParams> {
  readonly entityType: 'beam' | 'slab' | 'column';
}

export class AutoSizeMembersCommand extends EntityIdsBatchPatchCommand<MemberSizeParams, SizePatchEntry> {
  readonly name = 'AutoSizeMembers';
  readonly type = 'auto-size-members';

  constructor(
    entityIds: readonly string[],
    sceneManager: ISceneManager,
    private readonly provider: StructuralCodeProvider,
  ) {
    super(entityIds, sceneManager);
  }

  /**
   * Snapshot live params per μέλος → {prev, next}. Member-generic (ADR-499): δοκάρι
   * (ύψος, ADR-475) + πλάκα-πρόβολος (πάχος, ADR-499). Skips non-sizeable / locked /
   * converged μέσω του null-return κάθε patch builder.
   */
  protected buildPatches(): SizePatchEntry[] {
    const out: SizePatchEntry[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity) continue;
      if (isBeamEntity(entity)) {
        // ADR-486 §C — topology-aware τύπος στήριξης: ο πρόβολος (1 στήριξη) διαστασιολογείται
        // με wL²/2 ώστε ρ≤ρ_max, ίδιο SSoT με τον οπλισμό (μηδέν διπλή αλήθεια).
        // ADR-499 §6.3-b — + DERIVED στρέψη από μονόπλευρη πρόβολο-πλάκα: το ύψος μεγαλώνει
        // ώστε T_Ed/T_Rd,max + V_Ed/V_Rd,max ≤ 1 (ίδιο SSoT με τον sensor/classifier).
        // ADR-504 Φ2 — + DERIVED υπο-άνοιγμα συνεχούς δοκού: το ύψος ΜΙΚΡΑΙΝΕΙ (ροπή/βέλος από
        // max sub-span μεταξύ ενδιάμεσων στηρίξεων). Αυτό κάνει πράξη το «η δοκός μικραίνει».
        // ADR-506 — + width-aware όρια (πρακτικό ΝΟΚ ύψος + cap πλάτους κολώνας): όταν το ύψος
        // χτυπά το ΝΟΚ όριο, το πλάτος φαρδαίνει two-way στο ελάχιστο επαρκές (≤ πλάτος κολώνας).
        const patch = buildBeamSizePatch(
          entity, this.provider,
          resolveActiveBeamSupportType(entityId), resolveActiveBeamTorsion(entityId),
          resolveActiveBeamSpanMm(entityId), resolveActiveBeamSizingLimits(entityId),
        );
        if (patch) out.push({ entityId, entityType: 'beam', prev: patch.prev, next: patch.next });
      } else if (isSlabEntity(entity)) {
        // ADR-498/499 — πρόβολος-πλάκα: το πάχος αυτο-μεγαλώνει ώστε M_Ed≤M_Rd,lim + L/d≤όριο.
        const patch = buildSlabSizePatch(entity, this.provider, resolveActiveSlabSupportCondition(entityId));
        if (patch) out.push({ entityId, entityType: 'slab', prev: patch.prev, next: patch.next });
      } else if (isColumnEntity(entity)) {
        // ADR-499 §B2 / ADR-502 §Slice2 — στηρίζουσα κολώνα προβόλου: η διατομή αυτο-μεγαλώνει
        // ώστε As,req≤ρ_max·A_c + λυγηρότητα, με τη ροπή σχεδιασμού (engaged FEM ?? static wL²/2·
        // ίδιο SSoT με τον οπλισμό → live always-on, μηδέν διπλή αλήθεια).
        const patch = buildColumnSizePatch(entity, this.provider, resolveActiveColumnDesignMoment(entityId));
        if (patch) out.push({ entityId, entityType: 'column', prev: patch.prev, next: patch.next });
      }
    }
    return out;
  }

  /** Geometry-mutating apply — διατομή αλλάζει → recompute geometry+validation atomically per kind. */
  protected applyState(entry: SizePatchEntry, params: MemberSizeParams): void {
    if (entry.entityType === 'slab') {
      const slabParams = params as SlabParams;
      const geometry: SlabGeometry = computeSlabGeometry(slabParams);
      const validation = validateSlabParams(slabParams).bimValidation;
      this.sceneManager.updateEntity(entry.entityId, {
        kind: slabParams.kind, params: slabParams, geometry, validation,
      } as unknown as Partial<SceneEntity>);
      return;
    }
    if (entry.entityType === 'column') {
      // ADR-499 §B2 — mirror UpdateColumnParamsCommand: recompute geometry + ρ-validation
      // με τον ενεργό κανονισμό (provider.id) ώστε render/BOQ/validation να μην αποκλίνουν.
      const columnParams = params as ColumnParams;
      const geometry: ColumnGeometry = computeColumnGeometry(columnParams);
      const validation = validateColumnParams(columnParams, this.provider.id).bimValidation;
      this.sceneManager.updateEntity(entry.entityId, {
        kind: columnParams.kind, params: columnParams, geometry, validation,
      } as unknown as Partial<SceneEntity>);
      return;
    }
    const beamParams = params as BeamParams;
    const geometry: BeamGeometry = computeBeamGeometry(beamParams);
    const validation = validateBeamParams(beamParams).bimValidation;
    this.sceneManager.updateEntity(entry.entityId, {
      kind: beamParams.kind, params: beamParams, geometry, validation,
    } as unknown as Partial<SceneEntity>);
  }

  /** Ids που πράγματι διαστασιολογήθηκαν (μετά το build) — για emit/persist. */
  getResizedEntityIds(): string[] {
    return this.patchedEntityIds();
  }

  getDescription(): string {
    return `Auto-size ${this.patches.length} member(s)`;
  }
  // getAffectedEntityIds / validate / serializeData inherited (EntityIdsBatchPatchCommand).
}
