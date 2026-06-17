/**
 * auto-foundation-reconcile — pure diff του DERIVED foundation layout έναντι των
 * ήδη υπαρχόντων **auto** πεδίλων (ADR-459 Phase 7).
 *
 * Ο `planFoundationLayout` παράγει το επιθυμητό layout· αυτό το module το συγκρίνει
 * με τα auto πέδιλα που ήδη ζουν στον όροφο Θεμελίωσης και βγάζει τις ελάχιστες
 * ενέργειες:
 *   · `creates`  — σχεδιασμένα πέδιλα που δεν υπάρχουν ακόμη (ο caller χτίζει entity).
 *   · `removeFootingIds` — auto πέδιλα που δεν αντιστοιχούν πλέον σε καμία ομάδα
 *      (κολώνα διαγράφηκε/μετακινήθηκε/άλλαξε ομάδα → re-derive καθαρά, χωρίς stale).
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

/** Κολώνα ως είσοδος του reconciler — μόνο id + τρέχον FK. */
export interface ReconcileColumn {
  readonly id: string;
  readonly footingId?: string;
}

/** Ενέργειες reconcile — ο caller χτίζει τα create entities & εκτελεί batch command. */
export interface FoundationReconcilePlan {
  readonly creates: readonly PlannedFooting[];
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
    Math.abs(existing.params.length - planned.lengthMm) <= dimTol
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
  const matchedFootingIds = new Set<string>();
  for (const planned of plan.footings) {
    const existing = existingByKey.get(columnSetKey(planned.columnIds));
    if (existing && geometryMatches(existing, planned, s)) {
      matchedFootingIds.add(existing.id); // no-op (idempotent)
    } else {
      creates.push(planned);
    }
  }

  const removeFootingIds = existingAutoFootings
    .filter((f) => !matchedFootingIds.has(f.id))
    .map((f) => f.id);

  return { creates, removeFootingIds };
}
