/**
 * auto-foundation-reconcile — pure diff του DERIVED foundation layout έναντι των
 * ήδη υπαρχόντων **auto** πεδίλων (ADR-459 Phase 7).
 *
 * Ο `planFoundationLayout` παράγει το επιθυμητό layout· αυτό το module το συγκρίνει
 * με τα auto πέδιλα που ήδη ζουν στον όροφο Θεμελίωσης και βγάζει τις ελάχιστες
 * ενέργειες:
 *   · `creates`  — νέες ομάδες κολωνών χωρίς υπάρχον πέδιλο (ο caller χτίζει entity).
 *   · `updates`  — ίδια ομάδα κολωνών, αλλαγμένη γεωμετρία → **in-place update** του
 *      υπάρχοντος πεδίλου (σταθερό id, Revit hosted-element regeneration· ΟΧΙ delete+create).
 *   · `removeFootingIds` — auto πέδιλα που δεν αντιστοιχούν πλέον σε **καμία** ομάδα
 *      (κολώνα διαγράφηκε / ομάδα διαλύθηκε combined↔isolated → νέα ταυτότητα).
 *
 * Matching: ένα auto πέδιλο **ταιριάζει** με σχεδιασμένο όταν στηρίζει **ακριβώς το
 * ίδιο σύνολο κολωνών** (key) **ΚΑΙ** η γεωμετρία του είναι ~ίδια (θέση/διαστάσεις
 * εντός ανοχής). Matched = no-op → **idempotent**: αν τίποτα δεν άλλαξε, και τα δύο
 * arrays είναι κενά. Το σύνολο κολωνών ανά υπάρχον πέδιλο προκύπτει από τα FK
 * `ColumnParams.footingId` (authoritative, organism).
 *
 * Pure module — zero React/DOM/Firestore deps.
 *
 * @see ./auto-foundation-layout.ts — planFoundationLayout (η επιθυμητή κατάσταση)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { FoundationEntity } from '../types/foundation-types';
import type { FoundationLayoutPlan, PlannedFooting } from './auto-foundation-layout';

/** Ανοχή ταύτισης θέσης πεδίλου (mm) — κάτω από αυτή = «δεν μετακινήθηκε». */
export const RECONCILE_POSITION_TOL_MM = 50;
/** Ανοχή ταύτισης διάστασης πεδίλου (mm) — module detailing. */
export const RECONCILE_DIMENSION_TOL_MM = 50;
/** Ανοχή ταύτισης περιστροφής πεδίλου (μοίρες) — follow κολώνας. */
export const RECONCILE_ROTATION_TOL_DEG = 0.5;

/** Κολώνα ως είσοδος του reconciler — μόνο id + τρέχον FK. */
export interface ReconcileColumn {
  readonly id: string;
  readonly footingId?: string;
}

/**
 * In-place ενημέρωση υπάρχοντος auto πεδίλου (ADR-459 Φ7 — Revit stable-identity):
 * ίδιο σύνολο κολωνών, αλλαγμένη γεωμετρία (rotation/resize/move) → το πέδιλο
 * **περιστρέφεται/προσαρμόζεται επί τόπου** διατηρώντας το `existingId`, αντί για
 * delete+create (id churn). Mirror του Revit hosted-element regeneration.
 */
export interface FoundationUpdate {
  readonly existingId: string;
  readonly planned: PlannedFooting;
}

/** Ενέργειες reconcile — ο caller χτίζει τα create/update entities & εκτελεί batch command. */
export interface FoundationReconcilePlan {
  readonly creates: readonly PlannedFooting[];
  /** In-place updates (ίδιο σύνολο κολωνών, νέα γεωμετρία → σταθερό id). */
  readonly updates: readonly FoundationUpdate[];
  readonly removeFootingIds: readonly string[];
}

/** Σταθερό key από σύνολο column ids (sorted-join). */
function columnSetKey(ids: readonly string[]): string {
  return [...ids].sort().join('|');
}

/** Σύνολο κολωνών ανά υπάρχον auto πέδιλο, από τα FK των κολωνών. */
function servedColumnsByFooting(
  autoFootingIds: ReadonlySet<string>,
  columns: readonly ReconcileColumn[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of columns) {
    if (c.footingId === undefined || !autoFootingIds.has(c.footingId)) continue;
    const list = map.get(c.footingId);
    if (list) list.push(c.id);
    else map.set(c.footingId, [c.id]);
  }
  return map;
}

/** True αν η γεωμετρία υπάρχοντος pad ταυτίζεται (εντός ανοχής) με σχεδιασμένο. */
function geometryMatches(existing: FoundationEntity, planned: PlannedFooting, s: number): boolean {
  if (existing.params.kind !== 'pad') return false;
  const posTol = RECONCILE_POSITION_TOL_MM * s;
  const dimTol = RECONCILE_DIMENSION_TOL_MM;
  return (
    Math.abs(existing.params.position.x - planned.position.x) <= posTol &&
    Math.abs(existing.params.position.y - planned.position.y) <= posTol &&
    Math.abs(existing.params.width - planned.widthMm) <= dimTol &&
    Math.abs(existing.params.length - planned.lengthMm) <= dimTol &&
    // ADR-459 Φ7 — follow περιστροφής κολώνας: αλλαγή rotation → re-derive πεδίλου.
    Math.abs(existing.params.rotation - planned.rotationDeg) <= RECONCILE_ROTATION_TOL_DEG
  );
}

/**
 * Diff επιθυμητού layout έναντι των υπαρχόντων auto πεδίλων → creates + removes.
 * `existingAutoFootings` = ΜΟΝΟ τα auto πέδιλα (ο caller έχει φιλτράρει το
 * `autoDesigned` flag — χειροκίνητα πέδιλα δεν περνούν εδώ ποτέ).
 */
export function reconcileFoundationLayout(
  plan: FoundationLayoutPlan,
  existingAutoFootings: readonly FoundationEntity[],
  columns: readonly ReconcileColumn[],
  sceneUnits: SceneUnits,
): FoundationReconcilePlan {
  const s = mmToSceneUnits(sceneUnits);
  const autoIds = new Set(existingAutoFootings.map((f) => f.id));
  const servedBy = servedColumnsByFooting(autoIds, columns);

  // Υπάρχοντα auto πέδιλα ανά key (σύνολο κολωνών που στηρίζουν τώρα).
  const existingByKey = new Map<string, FoundationEntity>();
  for (const f of existingAutoFootings) {
    existingByKey.set(columnSetKey(servedBy.get(f.id) ?? []), f);
  }

  const creates: PlannedFooting[] = [];
  const updates: FoundationUpdate[] = [];
  const matchedFootingIds = new Set<string>();
  for (const planned of plan.footings) {
    const existing = existingByKey.get(columnSetKey(planned.columnIds));
    if (!existing) {
      // Νέα ομάδα κολωνών χωρίς υπάρχον πέδιλο → δημιουργία (νέα ταυτότητα).
      creates.push(planned);
      continue;
    }
    // Ίδιο σύνολο κολωνών → claim το υπάρχον (δεν αφαιρείται)· in-place ή no-op.
    matchedFootingIds.add(existing.id);
    if (!geometryMatches(existing, planned, s)) {
      // ADR-459 Φ7 — Revit stable-identity: περιστροφή/resize/move → in-place update.
      updates.push({ existingId: existing.id, planned });
    }
    // else: ίδια γεωμετρία → idempotent no-op.
  }

  // Remove ΜΟΝΟ τα auto πέδιλα που καμία ομάδα δεν διεκδίκησε (διαλυμένη ομάδα:
  // combined↔isolated, διαγραφή κολώνας) — εκεί η ταυτότητα όντως αλλάζει.
  const removeFootingIds = existingAutoFootings
    .filter((f) => !matchedFootingIds.has(f.id))
    .map((f) => f.id);

  return { creates, updates, removeFootingIds };
}
