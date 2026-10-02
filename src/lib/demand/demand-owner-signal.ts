/**
 * @fileoverview **ΜΕΤΡΑΕΙ ΑΥΤΗ Η ΖΗΤΗΣΗ ΠΡΟΣ ΙΔΙΟΚΤΗΤΕΣ;** — ένας κριτής, μία ανάγνωση.
 * @related ADR-900 · types/property-demand.ts (`DEMAND_OWNER_SIGNALS`) · lib/demand/demand-interest.ts
 * @module lib/demand/demand-owner-signal
 *
 * 🔑 **Ο κριτής είναι ΕΝΑΣ** και τον ρωτά **μόνο** το `classifyDemandInterest` — τη μία πύλη από
 * τη ζήτηση προς **κάθε** ακροατήριο ιδιοκτήτη (πάνελ ακινήτου · ειδοποιητές cron · σελίδα ελέγχου
 * ενδιαφέροντος). Δεύτερο φίλτρο σε καταναλωτή θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα.
 *
 * ⚠️ **Αστοχία προς την ιδιωτικότητα**: απουσία = `allowed` (έγγραφα πριν το ADR-900 — ο άνθρωπος
 * δεν ρωτήθηκε, και η καταμέτρηση ήταν ήδη ανώνυμη)· **κάθε άλλη** μη αναγνωρίσιμη τιμή = `withheld`.
 * Ένα χαλασμένο πεδίο δεν επιτρέπεται να γυρίσει μια άρνηση σε αποκάλυψη.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { DemandOwnerSignal, PropertyDemand } from '@/types/property-demand';

/** Η τιμή μιας ζήτησης που δεν δήλωσε τίποτα — **και** η προεπιλογή της φόρμας. */
export const DEFAULT_DEMAND_OWNER_SIGNAL: DemandOwnerSignal = 'allowed';

/** **Αποθηκευμένη τιμή → σήμα.** Ολική, fail-closed (βλ. κεφαλίδα). */
export function ownerSignalOf(stored: unknown): DemandOwnerSignal {
  if (stored === undefined || stored === null) return DEFAULT_DEMAND_OWNER_SIGNAL;
  return stored === 'allowed' ? 'allowed' : 'withheld';
}

/** `true` αν η ζήτηση **επιτρέπεται** να μετρήσει σε ακροατήριο ιδιοκτήτη. */
export function signalsOwners(demand: Pick<PropertyDemand, 'ownerSignal'>): boolean {
  return demand.ownerSignal === 'allowed';
}
