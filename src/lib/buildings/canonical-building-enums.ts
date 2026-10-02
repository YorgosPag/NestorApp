/**
 * @fileoverview **Κανονικά λεξιλόγια στο σύνορο ανάγνωσης κτιρίου** (ADR-898 §18.2).
 * @module lib/buildings/canonical-building-enums
 *
 * 🔑 Η αποθηκευμένη κατάσταση μεταφράζεται σε κανονική **μία φορά, όταν διαβάζεται** — ώστε φίλτρα, ομαδοποίηση,
 *   κάρτες και αναφορές να βλέπουν το ΙΔΙΟ λεξιλόγιο. Πριν: κτίριο με `in_progress` εξαφανιζόταν από **κάθε** φίλτρο
 *   κατάστασης και έπεφτε σε δική του ομάδα με ωμό όνομα.
 * 🔑 Άγνωστη τιμή μένει ως έχει (καμία μαντεψιά)· η ετικέτα τη λέει «Μη ορισμένη» (`building-enum-labels`).
 * 🔑 **Ένας σχεδιαστής** για ανάγνωση ΚΑΙ συμπλήρωση δίσκου (`scripts/migrations/migrate-building-status-aliases.ts`):
 *   ό,τι δείχνει η οθόνη είναι ακριβώς ό,τι θα γράψει η συμπλήρωση — καμία δεύτερη λογική.
 */

import { parseBuildingStatus, type BuildingStatus } from '@/constants/building-statuses';

export type BuildingStatusBackfill =
  | { readonly kind: 'noop' }
  | { readonly kind: 'write'; readonly updates: { readonly status: BuildingStatus } };

/** `write` μόνο όταν η αποθηκευμένη τιμή είναι **ψευδώνυμο** με γνωστή κανονική· κανονική ή άγνωστη ⇒ `noop`. */
export function planBuildingStatusBackfill(data: { readonly status?: unknown }): BuildingStatusBackfill {
  const status = parseBuildingStatus(data.status);
  return status === null || status === data.status ? { kind: 'noop' } : { kind: 'write', updates: { status } };
}

export function withCanonicalBuildingStatus<T extends { readonly status?: unknown }>(doc: T): T {
  const plan = planBuildingStatusBackfill(doc);
  return plan.kind === 'noop' ? doc : { ...doc, ...plan.updates };
}
