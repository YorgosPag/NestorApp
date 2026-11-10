/**
 * **Αγγίζει αυτή η συναλλαγή τις τιμές της βιτρίνας;** (ADR-923 §5.13 Σ6, ανασκόπηση Μ1). Η ΜΙΑ απάντηση, που ρωτά η μηχανή μετά
 * το commit για να ακυρώσει τη μνήμη των ανώνυμων τιμών (`revalidatePublicPrices`).
 *
 * Η τελική τιμή εξαρτάται από δύο πράγματα:
 * - την **τιμολόγηση** (λίστες, εκδόσεις, γραμμές, ομάδες, αναθέσεις, συνθήκες, ορατότητα): ό,τι σηματοδοτεί όψη **τιμών**
 *   (`catalogViewsOfWrite` + `isPricingView`), άρα κάθε νέο είδος τιμολόγησης καλύπτεται αυτόματα·
 * - τον **συντελεστή ΦΠΑ**, που ζει στην κατηγορία (`vatRate`, Ε3). Η κατηγορία δεν είναι είδος τιμολόγησης· αυτό ήταν το κενό.
 *
 * 🔴 **Όψη ≠ τιμή** (ADR-923 §5.5.2, 2026-11-11): το παλιό `views.length > 0` θεωρούσε **κάθε** σήμα αλλαγή τιμής ⇒ η όψη παρτίδας
 *    εισαγωγής θα ακύρωνε τη βιτρίνα σε κάθε κλικ, και η πρόσκληση προμήθειας (`supply`) την ακύρωνε ήδη. Ρωτάμε **μόνο** `isPricingView`.
 * ⚠️ Καθαρό: το είδος έρχεται ως συμβολοσειρά (`CatalogKind`), όπως στο `catalog-view-key`.
 * @module subapps/catalog/public/showcase-price-writes
 */

import { isPricingView, type CatalogView } from '../views/catalog-view-key';

/** Είδη εκτός τιμολόγησης που αλλάζουν την τελική τιμή της βιτρίνας. */
const SHOWCASE_PRICE_INPUT_KINDS: ReadonlySet<string> = new Set(['category']);

export function showcasePricesTouched(views: readonly CatalogView[], writtenKinds: Iterable<string>): boolean {
  if (views.some(isPricingView)) return true;
  for (const kind of writtenKinds) if (SHOWCASE_PRICE_INPUT_KINDS.has(kind)) return true;
  return false;
}
