/**
 * @fileoverview **Κύκλος ζωής συμφωνητικού** — καθαρή μηχανή (ADR-928 §5.5 · Φ2 αποφάσεις 6, 8, 9, 10).
 * @module subapps/procurement/subcontracts/agreements/agreement-lifecycle
 *
 * ```
 * draft ──issue──▶ issued ──accept──▶ accepted ──mobilize──▶ in_execution ──complete──▶ completed
 *   │                │                   │                      │
 *   └─discard        ├─withdraw          └─withdraw             └─terminate
 *                    └─expire (validUntil)
 * ```
 *
 * Ο **πίνακας** είναι το `SUBCONTRACT_AGREEMENT_FSM` (τύποι Φ0)· εδώ ζουν οι φύλακες που εξαρτώνται από τα
 * **δεδομένα** του εγγράφου (λήξη, τρόπος έκδοσης, εκκρεμείς αποκλίσεις). Το **δικαίωμα** το κρίνει το σύνορο της
 * διαδρομής (CHECK 3.68). Καθαρό: ο ίδιος κριτής για τον γραφέα και για τα κουμπιά της οθόνης (Φ3).
 */

import type { CalendarDay } from '@/constants/platform-operator';
import {
  SUBCONTRACT_AGREEMENT_FSM,
  type SubcontractAgreement,
  type SubcontractAgreementStatus,
  type SubcontractAgreementTransition,
} from '../types/agreement';
import type { ClauseSelection } from '../types/commercial-terms';

/** Γιατί αρνείται μια μετάβαση — κλειστό σύνολο, ένα HTTP status ανά είδος στον γραφέα. */
export type AgreementLifecycleRefusal =
  | 'invalidTransition'
  | 'deviationsPending'
  | 'offerExpired'
  | 'notYetExpired'
  | 'mobilizeOnOffer';

type LifecycleFacts = Pick<SubcontractAgreement, 'status' | 'role' | 'documentMode' | 'validUntil' | 'clauses'>;

/** Υπάρχει απόκλιση που **δεν** έχει εγκριθεί; (εκκρεμής **ή** απορριφθείσα — και οι δύο μπλοκάρουν την έκδοση) */
export function hasUnapprovedDeviations(clauses: readonly ClauseSelection[]): boolean {
  return clauses.some((selection) => Object.values(selection.deviations).some((deviation) => deviation.decision !== 'approved'));
}

/** Πέρασε η ισχύς της προσφοράς; Ημερολογιακές μέρες `YYYY-MM-DD` ⇒ η λεξικογραφική σύγκριση είναι χρονολογική. */
export function isPastValidity(validUntil: CalendarDay | null, today: CalendarDay): boolean {
  return validUntil !== null && today > validUntil;
}

/** Τρόπος Β: η προσφορά **γεννά** ξεχωριστό συμφωνητικό όταν γίνει αποδεκτή (§5.5 · Φ2 απόφαση 8). */
export function spawnsAgreementOnAccept(facts: Pick<SubcontractAgreement, 'role' | 'documentMode'>): boolean {
  return facts.role === 'offer' && facts.documentMode === 'offer_then_agreement';
}

const DATA_GUARDS: Readonly<Partial<Record<SubcontractAgreementTransition, (facts: LifecycleFacts, today: CalendarDay) => AgreementLifecycleRefusal | null>>> = {
  issue: (facts) => (hasUnapprovedDeviations(facts.clauses) ? 'deviationsPending' : null),
  accept: (facts, today) => (isPastValidity(facts.validUntil, today) ? 'offerExpired' : null),
  expire: (facts, today) => (isPastValidity(facts.validUntil, today) ? null : 'notYetExpired'),
  mobilize: (facts) => (spawnsAgreementOnAccept(facts) ? 'mobilizeOnOffer' : null),
};

/** `null` ⇒ η μετάβαση επιτρέπεται. Πρώτα ο πίνακας, μετά ο φύλακας δεδομένων. */
export function refuseTransition(
  facts: LifecycleFacts,
  transition: SubcontractAgreementTransition,
  today: CalendarDay,
): AgreementLifecycleRefusal | null {
  if (!SUBCONTRACT_AGREEMENT_FSM[transition].from.includes(facts.status)) return 'invalidTransition';
  return DATA_GUARDS[transition]?.(facts, today) ?? null;
}

/** Η κατάσταση μετά τη μετάβαση — από τον **ίδιο** πίνακα. */
export function statusAfter(transition: SubcontractAgreementTransition): SubcontractAgreementStatus {
  return SUBCONTRACT_AGREEMENT_FSM[transition].to;
}

/** Το περιεχόμενο αλλάζει **μόνο** στο πρόχειρο· μετά το `issue` κάθε αλλαγή είναι τροποποίηση (§5.6, μελλοντικά). */
export function refuseContentEdit(status: SubcontractAgreementStatus): AgreementLifecycleRefusal | null {
  return status === 'draft' ? null : 'invalidTransition';
}

/** Η απόφαση απόκλισης γίνεται μόνο σε πρόχειρο — μετά την έκδοση η απόκλιση έχει ήδη παγώσει. */
export const refuseDeviationDecision = refuseContentEdit;

/** Ανάθεση εργοταξίου (Δ2): σε συμφωνητικό πολλών έργων, αφού συμφωνηθεί και όσο εκτελείται. */
const ASSIGNABLE: readonly SubcontractAgreementStatus[] = ['accepted', 'in_execution'];

export function refuseAssignment(facts: Pick<SubcontractAgreement, 'status' | 'scope'>): AgreementLifecycleRefusal | null {
  return facts.scope.kind === 'multi_project' && ASSIGNABLE.includes(facts.status) ? null : 'invalidTransition';
}
