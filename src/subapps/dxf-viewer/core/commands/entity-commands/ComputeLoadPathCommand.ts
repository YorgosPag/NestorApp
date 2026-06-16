/**
 * COMPUTE LOAD PATH COMMAND — ADR-466 (full structural load path).
 *
 * Γενίκευση του `ComputeTakedownLoadsCommand` (ADR-464) σε **ΟΛΑ τα μέλη** της
 * διαδρομής φορτίων (πλάκα/δοκάρι/κολώνα/πέδιλο): batch, undoable εγγραφή του DERIVED
 * `appliedLoad` (source='takedown'). Τα φορτία υπολογίζονται pure από τον
 * `computeLoadPathPatches` και περνούν εδώ έτοιμα· το command τα εφαρμόζει + undo/redo.
 *
 * **Geometry-neutral:** το φορτίο είναι additive input — `updateEntity({kind, params})`
 * (mirror του ADR-464 command). Το `prev` κρατά τα αρχικά params αυτούσια (Firestore-
 * safe undo, ADR-390 Φ4). Re-check `isTakedownWritable` στο build-time (idempotent,
 * ΠΟΤΕ overwrite χειροκίνητου).
 *
 * @see bim/structural/loads/load-path-takedown.ts — pure computation + type guards
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το mirror pattern
 * @see docs/centralized-systems/reference/adrs/ADR-466-load-path-engine.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import {
  isLoadPathMember,
  memberAppliedLoad,
  type LoadPathMember,
  type MemberLoadPatch,
} from '../../../bim/structural/loads/load-path-takedown';
import { isTakedownWritable } from '../../../bim/structural/loads/structural-loads-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

type MemberParams = LoadPathMember['params'];

interface LoadPathPatchEntry {
  readonly entityId: string;
  readonly prev: MemberParams;
  readonly next: MemberParams;
}

export class ComputeLoadPathCommand implements ICommand {
  readonly id: string;
  readonly name = 'ComputeLoadPath';
  readonly type = 'compute-load-path';
  readonly timestamp: number;

  private patches: LoadPathPatchEntry[] = [];
  private wasExecuted = false;

  constructor(
    private readonly loads: readonly MemberLoadPatch[],
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

  /** Snapshot live params per μέλος → {prev, next}. Re-checks member + writability. */
  private buildPatches(): void {
    for (const { entityId, appliedLoad } of this.loads) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity || !isLoadPathMember(entity)) continue;
      if (!isTakedownWritable(memberAppliedLoad(entity))) continue;
      this.patches.push({
        entityId,
        prev: entity.params,
        next: { ...entity.params, appliedLoad } as MemberParams,
      });
    }
  }

  /** Geometry-neutral apply — appliedLoad είναι input, geometry/validation αμετάβλητα. */
  private applyPatch(entityId: string, params: MemberParams): void {
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
    } as unknown as Partial<SceneEntity>);
  }

  /** ADR-401 — broadcast τα patched μέλη ώστε το persistence layer να τα σώσει. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  /** Ids που πράγματι έλαβαν φορτίο (μετά το build) — για toast/emit count. */
  getLoadedMemberIds(): string[] {
    if (this.patches.length === 0) this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Compute load path for ${this.patches.length} member(s)`;
  }

  getAffectedEntityIds(): string[] {
    return this.loads.map((l) => l.entityId);
  }

  validate(): string | null {
    if (this.loads.length === 0) return 'At least one member load is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityIds: this.loads.map((l) => l.entityId) },
      version: 1,
    };
  }
}
