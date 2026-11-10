/**
 * Conveyance — η κατάσταση της υπόθεσης που βλέπει ο χρήστης (ADR-901 §5.1 · §2 Ε-Ε).
 *
 * Το `signed` **δεν αποθηκεύεται**: για εργολάβο παράγεται από το `legalPhase` του ADR-230
 * (`final_signed` και μετά). Το `LEGAL_PHASES` δεν έχει Κτηματολόγιο, γι' αυτό τα
 * `registered`/`closed`/`cancelled` είναι **ρητές** πράξεις και υπερισχύουν.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/case-state
 */

import { LEGAL_PHASES, isLegalPhase, type LegalPhase } from '@/constants/legal-phases';
import type { ConveyanceCaseState, StoredCaseState } from '@/types/conveyance-case';

const FINAL_SIGNED_INDEX = LEGAL_PHASES.indexOf('final_signed');

/**
 * Έχει υπογραφεί το οριστικό; (κάθε φάση από `final_signed` και μετά) — και η **κυριότητα** πέρασε στους αγοραστές
 * (ADR-915 §25: το μητρώο ρωτά εδώ ποιος είναι πια ο ιδιοκτήτης, όχι δεύτερο κατώφλι φάσης).
 *
 * Δέχεται `unknown`: πολλές αναγνώσεις φέρνουν το έγγραφο ως ωμό spread του Firestore. Ο έλεγχος
 * τύπου γίνεται **εδώ**, μία φορά, ώστε κανένας καταναλωτής να μη χρειάζεται cast (ADR-915 §38).
 */
export function isFinalContractSigned(legalPhase: unknown): boolean {
  if (!isLegalPhase(legalPhase)) return false;
  return LEGAL_PHASES.indexOf(legalPhase) >= FINAL_SIGNED_INDEX;
}

/**
 * Η άρνηση του server όταν ζητείται «Πωλήθηκε» χωρίς υπογεγραμμένο οριστικό (ADR-935) — ΕΝΑ κείμενο για τις δύο
 * πόρτες (ακίνητο · θέσεις/αποθήκες) και για τον πελάτη που το μεταφράζει σε `sales.errors.finalContractNotSigned`.
 */
export const FINAL_CONTRACT_NOT_SIGNED_MESSAGE = 'Final contract must be signed before sale';

export function effectiveCaseState(
  stored: StoredCaseState,
  legalPhase: LegalPhase | null | undefined,
): ConveyanceCaseState {
  if (stored !== 'open') return stored;
  return isFinalContractSigned(legalPhase) ? 'signed' : 'open';
}

/** Δέχεται η υπόθεση αλλαγές από τον οικοδεσπότη; (πάγωμα Ε-6 μετά την υπογραφή) */
export function isCaseEditable(state: ConveyanceCaseState): boolean {
  return state === 'open';
}

/**
 * Δέχεται η υπόθεση **νέες** προτάσεις; Μετά την υπογραφή **ναι** — ο συμβολαιογράφος δουλεύει ως τη
 * μεταγραφή· μετά το κλείσιμο/ακύρωση **όχι** (οι συμμετοχές έχουν ήδη τελειώσει).
 *
 * Καθαρό: το ρωτούν ο server (προτάσεις · προσκλήσεις) **και** ο κοινός κριτής του «Ζήτησε έγγραφο» (ADR-901 Φ4.5).
 */
export function acceptsEngagements(state: ConveyanceCaseState): boolean {
  return state !== 'closed' && state !== 'cancelled';
}
