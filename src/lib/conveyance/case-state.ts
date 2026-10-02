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

import { LEGAL_PHASES, type LegalPhase } from '@/constants/legal-phases';
import type { ConveyanceCaseState, StoredCaseState } from '@/types/conveyance-case';

const FINAL_SIGNED_INDEX = LEGAL_PHASES.indexOf('final_signed');

/** Έχει υπογραφεί το οριστικό; (κάθε φάση από `final_signed` και μετά) */
function isFinalContractSigned(legalPhase: LegalPhase | null | undefined): boolean {
  if (!legalPhase) return false;
  return LEGAL_PHASES.indexOf(legalPhase) >= FINAL_SIGNED_INDEX;
}

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
