/**
 * COMPUTE LOAD PATH COMMAND — ADR-467 (full structural load path).
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
 * @see docs/centralized-systems/reference/adrs/ADR-467-load-path-engine.md
 */

import type { ISceneManager } from '../interfaces';
import type { Entity } from '../../../types/entities';
import {
  isLoadPathMember,
  memberAppliedLoad,
  type LoadPathMember,
  type MemberLoadPatch,
} from '../../../bim/structural/loads/load-path-takedown';
import { isTakedownWritable } from '../../../bim/structural/loads/structural-loads-types';
import {
  BatchEntityPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

type MemberParams = LoadPathMember['params'];

export class ComputeLoadPathCommand extends BatchEntityPatchCommand<MemberParams> {
  readonly name = 'ComputeLoadPath';
  readonly type = 'compute-load-path';

  constructor(
    private readonly loads: readonly MemberLoadPatch[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager, true);
  }

  /** Snapshot live params per μέλος → {prev, next}. Re-checks member + writability. */
  protected buildPatches(): BatchPatchEntry<MemberParams>[] {
    const out: BatchPatchEntry<MemberParams>[] = [];
    for (const { entityId, appliedLoad } of this.loads) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity || !isLoadPathMember(entity)) continue;
      if (!isTakedownWritable(memberAppliedLoad(entity))) continue;
      out.push({
        entityId,
        prev: entity.params,
        next: { ...entity.params, appliedLoad } as MemberParams,
      });
    }
    return out;
  }

  /** Geometry-neutral apply — appliedLoad είναι input, geometry/validation αμετάβλητα. */
  protected applyState(entry: BatchPatchEntry<MemberParams>, params: MemberParams): void {
    this.writeParamsOnly(entry.entityId, params);
  }

  /** Ids που πράγματι έλαβαν φορτίο (μετά το build) — για toast/emit count. */
  getLoadedMemberIds(): string[] {
    return this.patchedEntityIds();
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

  protected serializeData(): Record<string, unknown> {
    return { entityIds: this.loads.map((l) => l.entityId) };
  }
}
