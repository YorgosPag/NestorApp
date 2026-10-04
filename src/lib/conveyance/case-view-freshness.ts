/**
 * Conveyance — «είναι αυτή η όψη ΠΑΛΙΟΤΕΡΗ από ό,τι ήδη δείχνω;» (ADR-901 §14.8 · άγκυρα Α37)
 *
 * Μια αργή ανάγνωση μπορεί να φτάσει **μετά** από νεότερη (απάντηση πράξης · άλλη ανάγνωση). Αν γινόταν δεκτή, η
 * οθόνη θα γύριζε πίσω — και στον οικοδεσπότη θα γύριζε πίσω **και η βάση του CAS** (`version`) ⇒ η επόμενη εντολή
 * θα έπαιρνε 409 χωρίς κανέναν πραγματικό ανταγωνισμό. Η ΜΙΑ κρίση, καθαρή, για τις δύο όψεις.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/case-view-freshness
 */

import type { ConveyanceCaseView, EngagedCaseView } from '@/types/conveyance-case';

/** Όψη οικοδεσπότη της **ίδιας** υπόθεσης με μικρότερη αναθεώρηση σήματος **ή** μικρότερη έκδοση CAS. */
export function isOlderHostView(next: ConveyanceCaseView | null, current: ConveyanceCaseView | null): boolean {
  if (!next || !current || next.conveyanceCase.id !== current.conveyanceCase.id) return false;
  return next.freshness.revision < current.freshness.revision || next.conveyanceCase.version < current.conveyanceCase.version;
}

/** Όψη συμμετοχής της **ίδιας** συμμετοχής με μικρότερη αναθεώρηση σήματος. */
export function isOlderEngagedView(next: EngagedCaseView, current: EngagedCaseView | null): boolean {
  return current !== null && next.engagementId === current.engagementId && next.freshness.revision < current.freshness.revision;
}
