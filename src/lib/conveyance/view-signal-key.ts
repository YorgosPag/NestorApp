/**
 * =============================================================================
 * Conveyance — Η ΤΑΥΤΟΤΗΤΑ μιας όψης για το σήμα αλλαγής (ADR-901 §14.8)
 * =============================================================================
 *
 * Η όψη της υπόθεσης **παράγεται στον server** ανά θεατή — ο client δεν μπορεί (και δεν πρέπει) να ακούει τις
 * συλλογές της. Ακούει **ένα** έγγραφο ανά όψη, με **μόνο** έναν αριθμό (`revision`): «η όψη σου άλλαξε, ξαναρώτα».
 *
 * | Όψη           | Ποιος τη βλέπει                         | Κάτοχος του σήματος (κανόνας `get`) |
 * |---------------|-----------------------------------------|-------------------------------------|
 * | `host`        | ο χώρος της υπόθεσης (ίδια για όλα τα μέλη) | `companyId`                     |
 * | `engagement`  | ο επαγγελματίας της συμμετοχής          | `uid`                               |
 *
 * ⚠️ Η όψη του οικοδεσπότη ζητείται **ανά ακίνητο** (`GET /api/conveyance-cases?propertyId=` — «η πιο πρόσφατη
 *    υπόθεση του ακινήτου»), άρα **αυτή** είναι η ταυτότητά της, όχι το `caseId`: έτσι και το **άνοιγμα** υπόθεσης
 *    από άλλο μέλος του χώρου φτάνει σε όποιον κοιτά το ακίνητο, που ακόμη δεν ξέρει κανένα `caseId`.
 *
 * 🔑 Ο σπόρος είναι **ο ίδιος** για τον γραφέα (server · Cloud Function) και τον listener (client): το id
 *    **υπολογίζεται**, δεν αναζητείται — καμία λίστα, κανένα ερώτημα, κανένας δείκτης.
 *
 * **Layering**: leaf — καμία εισαγωγή, ώστε να προβάλλεται αυτούσιο στα Functions (ADR-874).
 *
 * @module lib/conveyance/view-signal-key
 */

/** Η όψη του οικοδεσπότη — μία ανά ακίνητο (η τρέχουσα υπόθεσή του), κοινή για όλα τα μέλη του χώρου. */
export interface HostCaseView {
  readonly kind: 'host';
  readonly propertyId: string;
  readonly companyId: string;
}

/** Η όψη ενός επαγγελματία — μία ανά συμμετοχή, μόνο για τον λογαριασμό της. */
export interface EngagementCaseView {
  readonly kind: 'engagement';
  readonly engagementId: string;
  readonly uid: string;
}

export type CaseViewKey = HostCaseView | EngagementCaseView;

/** Ο σπόρος του ντετερμινιστικού id (`cvs_…`) — και η ταυτότητα της όψης σε σύνολο (καμία διπλή αύξηση). */
export function viewSignalSeed(view: CaseViewKey): string {
  return view.kind === 'host' ? `conveyance-view:host:${view.companyId}:${view.propertyId}` : `conveyance-view:engagement:${view.engagementId}`;
}

/** Το πεδίο που κρίνει ο κανόνας ανάγνωσης — ο **κάτοχος** του σήματος, τίποτα άλλο. */
export function viewSignalOwner(view: CaseViewKey): { readonly companyId: string } | { readonly uid: string } {
  return view.kind === 'host' ? { companyId: view.companyId } : { uid: view.uid };
}
