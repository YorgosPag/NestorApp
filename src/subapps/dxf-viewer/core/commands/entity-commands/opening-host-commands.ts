/**
 * @module core/commands/entity-commands/opening-host-commands
 * @description ADR-911 Φ4-2 — τα δύο αναιρέσιμα μισά του δεσμού τοίχου ↔ ανοίγματος όταν ο
 * ξενιστής αλλάζει μέσα σε παρτίδα. Και τα δύο φέρουν έτοιμα `{prev, next}` από το καθαρό σχέδιο
 * εγγραφής (`bim/model-from-drawing/opening-write-plan.ts`)· εδώ δεν υπολογίζεται τίποτα.
 *
 *   · {@link RehostOpeningsCommand} — άνοιγμα που ΥΠΗΡΧΕ και ο τοίχος του ενώθηκε ή επεκτάθηκε:
 *     νέο `wallId` / `offsetFromStart`. Γράφει μέσω του `applyOpeningHostPatch` (το ίδιο SSoT με
 *     τις `WallSplitCommand` / `WallMergeCommand`) και ξανασώζει (`origin: 'retrim'` — re-save,
 *     όχι νέα οντότητα· ο ανιχνευτής του ADR-533 σιωπά).
 *   · {@link SetHostedOpeningIdsCommand} — ο ΚΑΘΡΕΦΤΗΣ `hostedOpeningIds` ενός τοίχου που υπήρχε.
 *     Αυθεντία είναι το `opening.params.wallId`· ο καθρέφτης δεν αποθηκεύεται, αλλά τον διαβάζουν
 *     η διαίρεση/ένωση τοίχων. Το `onOpeningCreated` τον έγραφε με γυμνό `setLevelScene` — εδώ
 *     είναι αναιρέσιμος.
 */

import type { SceneEntity } from '../interfaces';
import type { AnySceneEntity } from '../../../types/scene';
import type { OpeningParams } from '../../../bim/types/opening-types';
import { applyOpeningHostPatch } from '../../../bim/walls/opening-host-patch';
import { emitBimEntityCreated } from '../../../systems/events/bim-entity-lifecycle-events';
import type { BatchPatchEntry } from './batch-entity-patch-command';
import { PrecomputedPatchCommand } from './precomputed-patch-command';

export type OpeningRehostEntry = BatchPatchEntry<OpeningParams>;

export class RehostOpeningsCommand extends PrecomputedPatchCommand<OpeningParams> {
  readonly name = 'RehostOpenings';
  readonly type = 'rehost-openings';

  protected applyState(entry: OpeningRehostEntry, state: OpeningParams): void {
    applyOpeningHostPatch(this.sceneManager, entry.entityId, state);
  }

  /** Re-save κάθε ανοίγματος με τα params που μόλις γράφτηκαν (διαβασμένα από τη σκηνή). */
  protected afterApply(): void {
    for (const entry of this.entries) {
      const entity = this.sceneManager.getEntity(entry.entityId);
      if (entity) emitBimEntityCreated(entity as unknown as AnySceneEntity, 'opening', 'retrim');
    }
  }

  getDescription(): string {
    return `Re-host ${this.entries.length} openings`;
  }
}

/** `undefined` = ο τοίχος δεν είχε ποτέ καθρέφτη — το undo τον επιστρέφει ΑΚΡΙΒΩΣ έτσι, όχι ως `[]`. */
export type HostedOpeningIds = readonly string[] | undefined;
export type HostedOpeningIdsEntry = BatchPatchEntry<HostedOpeningIds>;

export class SetHostedOpeningIdsCommand extends PrecomputedPatchCommand<HostedOpeningIds> {
  readonly name = 'SetHostedOpeningIds';
  readonly type = 'set-hosted-opening-ids';

  protected applyState(entry: HostedOpeningIdsEntry, state: HostedOpeningIds): void {
    this.sceneManager.updateEntity(entry.entityId, {
      hostedOpeningIds: state ? [...state] : undefined,
    } as unknown as Partial<SceneEntity>);
  }

  getDescription(): string {
    return `Mirror hosted openings on ${this.entries.length} walls`;
  }
}
