'use client';

/**
 * ADR-635 Φ C.18 — Load-time backfill για per-entity entities που φορτώθηκαν από ένα
 * scene blob ΑΛΛΑ δεν έχουν backing Firestore doc (SSoT).
 *
 * ΓΙΑΤΙ: ο server-wizard import (ADR-033, «Door B») parse-άρει το DXF server-side, γράφει
 * το `.dxf.processed.json` και δένει τον όροφο — αλλά **ποτέ δεν εκπέμπει
 * `drawing:entity-created`**, άρα κανένα per-entity doc δεν δημιουργείται. Στο reload το
 * `reconcileLoadedSceneBim` πετά κάθε per-entity entity ως derived cache και τίποτα δεν το
 * ξαναγεμίζει → μόνιμη εξαφάνιση (117 imported γραμμοσκιάσεις, incident 2026-07-20). Ο
 * client import («Door A») δεν έχει το πρόβλημα (first-save-άρει μέσω `commitImportedScene`).
 *
 * Η ΛΥΣΗ (existence-checked, idempotent):
 *   1. `detectMissingPerEntityDocIds` — read-only `batchGet` ανά family· επιστρέφει τα ids
 *      του blob που ΔΕΝ έχουν doc. Δεν αγγίζει τον generic persistence factory (~30 hosts).
 *   2. `emitBackfillFirstSaves` — εκπέμπει `drawing:entity-created` ΜΟΝΟ γι' αυτά, μέσω του
 *      **ίδιου** SSoT emitter που χρησιμοποιεί το Door A (`emitImportedEntityCreateEvents`,
 *      N.18 — όχι δίδυμο). Το always-on `HatchPersistenceHost` (που φέρει `userId`) κάνει το
 *      write· έτσι ο loader δεν χρειάζεται userId ούτε instantiate service.
 *
 * Ασφάλεια όταν το doc ΥΠΑΡΧΕΙ: το id δεν είναι στο missing set → δεν εκπέμπεται → το
 * reconcile το στριμώχνει ως σήμερα και η subscription το ξαναγεμίζει από το authoritative
 * doc (κανένα stale-blob overwrite). Ίδιο αποτέλεσμα σε διπλή κλήση (2η φορά docs υπάρχουν
 * → κενό missing → no-op).
 *
 * Server parser scope: παράγει ΜΟΝΟ DXF primitives + hatch (walls/columns/stairs είναι
 * interactive-only), άρα σήμερα το registry είναι hatch-only· είναι δομημένο ώστε να
 * επεκταθεί σε stair/BIM αν ποτέ ο server parser τα βγάλει.
 *
 * @see ./scene-bim-load-policy.ts — `reconcileLoadedSceneBimPreserving` (κρατά τα missing ορατά)
 * @see ./emit-imported-entity-create-events.ts — ο κοινός first-save emitter (Door A + backfill)
 * @see docs/centralized-systems/reference/adrs/ADR-635-autocad-dxf-import-entity-coverage.md (Φ C.18)
 */

import type { SceneModel } from '../../types/scene';
import type { AnySceneEntity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import type { EntityCreateTargetScope } from '../../bim/persistence/bim-floor-scope';
import { firestoreQueryService } from '@/services/firestore';
import { emitImportedEntityCreateEvents } from './emit-imported-entity-create-events';

/**
 * Per-entity family → Firestore collection key. Κάθε entry ζεύγος type-guard + το
 * collection όπου ζει το per-entity doc του. Hatch-only σήμερα (βλ. module doc).
 */
const BACKFILL_COLLECTIONS: readonly {
  readonly match: (e: AnySceneEntity) => boolean;
  readonly collection: 'FLOORPLAN_HATCHES';
}[] = [{ match: isHatchEntity, collection: 'FLOORPLAN_HATCHES' }];

/**
 * Επιστρέφει τα ids των per-entity entities του `loaded` που ΔΕΝ έχουν backing Firestore
 * doc (batch existence check ανά family). Read-only· κανένα write· δεν χρειάζεται userId
 * (tenant isolation enforced από firestore.rules στο `batchGet`).
 */
export async function detectMissingPerEntityDocIds(
  loaded: SceneModel,
): Promise<Set<string>> {
  const missing = new Set<string>();
  for (const { match, collection } of BACKFILL_COLLECTIONS) {
    const ids = loaded.entities.filter(match).map((e) => e.id);
    if (ids.length === 0) continue; // cheap skip — κανένα Firestore round-trip
    const existing = await firestoreQueryService.batchGet(collection, ids);
    for (const id of ids) if (!existing.has(id)) missing.add(id);
  }
  return missing;
}

/**
 * Εκπέμπει `drawing:entity-created` (first-save) ΜΟΝΟ για τα entities του `loaded` των
 * οποίων το id ∈ `missing`, με τον δηλωμένο `scope` (Φ C.16 — write ανεξάρτητο του render
 * timing του persistence host). No-op όταν `missing` κενό.
 *
 * @param loaded  Το scene που φορτώθηκε (πηγή των entities προς backfill).
 * @param missing Τα ids χωρίς doc (από `detectMissingPerEntityDocIds`).
 * @param scope   Ο ΣΤΟΧΟΣ-όροφος του first-save (levelId + floorId/floorplanId).
 */
export function emitBackfillFirstSaves(
  loaded: SceneModel,
  missing: ReadonlySet<string>,
  scope: EntityCreateTargetScope,
): void {
  if (missing.size === 0) return;
  const toSave = loaded.entities.filter((e) => missing.has(e.id));
  emitImportedEntityCreateEvents(toSave, scope);
}
