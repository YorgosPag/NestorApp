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

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { isFoundationEntity } from '../../../types/entities';
import type { TieBeamParams } from '../../../bim/types/foundation-types';
import type { TieBeamTieForcePatch } from '../../../bim/structural/loads/tie-beam-tie-force';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

/** Ανοχή ισότητας N_tie (kN) — κάτω από αυτή θεωρείται no-op (idempotent skip). */
const TIE_FORCE_EQUAL_TOL_KN = 0.05;

interface TieForcePatchEntry {
  readonly entityId: string;
  readonly prev: TieBeamParams;
  readonly next: TieBeamParams;
}

export class ComputeTieBeamTieForcesCommand implements ICommand {
  readonly id: string;
  readonly name = 'ComputeTieBeamTieForces';
  readonly type = 'compute-tie-beam-tie-forces';
  readonly timestamp: number;

  private patches: TieForcePatchEntry[] = [];
  private wasExecuted = false;

  constructor(
    private readonly forces: readonly TieBeamTieForcePatch[],
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

  /** Snapshot live params per συνδετήρια → {prev, next}. Skip όταν N_tie αμετάβλητο. */
  private buildPatches(): void {
    for (const { tieBeamId, seismicTieForceKn } of this.forces) {
      const entity = this.sceneManager.getEntity(tieBeamId) as unknown as Entity | undefined;
      if (!entity || !isFoundationEntity(entity) || entity.params.kind !== 'tie-beam') continue;
      const prev = entity.params;
      if (Math.abs((prev.seismicTieForceKn ?? 0) - seismicTieForceKn) < TIE_FORCE_EQUAL_TOL_KN) continue;
      this.patches.push({ entityId: tieBeamId, prev, next: { ...prev, seismicTieForceKn } });
    }
  }

  /** Geometry-neutral apply — seismicTieForceKn είναι input, geometry/validation αμετάβλητα. */
  private applyPatch(entityId: string, params: TieBeamParams): void {
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast τις patched δοκούς ώστε το persistence layer να τις σώσει. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  /** Ids που πράγματι άλλαξαν N_tie (μετά το build) — για emit/toast count. */
  getChangedTieBeamIds(): string[] {
    if (this.patches.length === 0) this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  canMergeWith(): boolean {
    return false;
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

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityIds: this.forces.map((f) => f.tieBeamId) },
      version: 1,
    };
  }
}
