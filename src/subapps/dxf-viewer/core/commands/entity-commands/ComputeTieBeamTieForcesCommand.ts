/**
 * COMPUTE TIE-BEAM TIE FORCES COMMAND — ADR-477 Slice 3 (EN1998-5 §5.4.1.2).
 *
 * Batch, undoable εγγραφή της DERIVED σεισμικής δύναμης σύνδεσης `seismicTieForceKn`
 * στις συνδετήριες δοκούς. Τα N_tie υπολογίζονται pure scene-level από το
 * `computeTieBeamTieForces` (μετά το load takedown — οι κολώνες έχουν ήδη `appliedLoad`)
 * και περνούν εδώ έτοιμα· το command τα εφαρμόζει + undo/redo. Mirror του
 * `ComputeLoadPathCommand` (ADR-467).
 *
 * **Geometry-neutral & idempotent:** το `seismicTieForceKn` είναι additive input —
 * geometry/validation αμετάβλητα. Patch γράφεται ΜΟΝΟ όταν η τιμή αλλάζει ουσιαστικά
 * (αποφυγή churn σε επαναλαμβανόμενο proactive run). Το `prev` κρατά τα αρχικά params
 * αυτούσια (Firestore-safe undo, ADR-390 Φ4).
 *
 * @see bim/structural/loads/tie-beam-tie-force.ts — pure computation
 * @see core/commands/entity-commands/ComputeLoadPathCommand.ts — το mirror pattern
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 3
 */

import type { ISceneManager } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { isFoundationEntity } from '../../../types/entities';
import type { TieBeamParams } from '../../../bim/types/foundation-types';
import type { TieBeamTieForcePatch } from '../../../bim/structural/loads/tie-beam-tie-force';
import {
  BatchEntityPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

/** Ανοχή ισότητας N_tie (kN) — κάτω από αυτή θεωρείται no-op (idempotent skip). */
const TIE_FORCE_EQUAL_TOL_KN = 0.05;

export class ComputeTieBeamTieForcesCommand extends BatchEntityPatchCommand<TieBeamParams> {
  readonly name = 'ComputeTieBeamTieForces';
  readonly type = 'compute-tie-beam-tie-forces';

  constructor(
    private readonly forces: readonly TieBeamTieForcePatch[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager, true);
  }

  /** Snapshot live params per συνδετήρια → {prev, next}. Skip όταν N_tie αμετάβλητο. */
  protected buildPatches(): BatchPatchEntry<TieBeamParams>[] {
    const out: BatchPatchEntry<TieBeamParams>[] = [];
    for (const { tieBeamId, seismicTieForceKn } of this.forces) {
      const entity = this.sceneManager.getEntity(tieBeamId) as unknown as Entity | undefined;
      if (!entity || !isFoundationEntity(entity) || entity.params.kind !== 'tie-beam') continue;
      const prev = entity.params;
      if (Math.abs((prev.seismicTieForceKn ?? 0) - seismicTieForceKn) < TIE_FORCE_EQUAL_TOL_KN) continue;
      out.push({ entityId: tieBeamId, prev, next: { ...prev, seismicTieForceKn } });
    }
    return out;
  }

  /** Geometry-neutral apply — seismicTieForceKn είναι input, geometry/validation αμετάβλητα. */
  protected applyState(entry: BatchPatchEntry<TieBeamParams>, params: TieBeamParams): void {
    this.writeParamsOnly(entry.entityId, params);
  }

  /** Ids που πράγματι άλλαξαν N_tie (μετά το build) — για emit/toast count. */
  getChangedTieBeamIds(): string[] {
    return this.patchedEntityIds();
  }

  getDescription(): string {
    return `Compute seismic tie force for ${this.patches.length} tie-beam(s)`;
  }

  getAffectedEntityIds(): string[] {
    return this.forces.map((f) => f.tieBeamId);
  }

  validate(): string | null {
    if (this.forces.length === 0) return 'At least one tie force is required';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityIds: this.forces.map((f) => f.tieBeamId) };
  }
}
