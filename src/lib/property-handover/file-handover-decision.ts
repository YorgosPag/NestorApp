/**
 * @fileoverview **Η απόφαση παράδοσης του γραφείου, πάνω στο ίδιο το αρχείο** (ADR-916 §5.18 Φ-Δ.4).
 * @related lib/property-handover/handover-disposition.ts (η κρίση που τη σέβεται πρώτη μετά το Πρωτόκολλο) ·
 *          services/property-handover/property-handover-file-decision.service.ts (ο ΕΝΑΣ γραφέας) ·
 *          firestore.rules `handoverDecisionUnchanged`
 * @module lib/property-handover/file-handover-decision
 *
 * 🔑 **Γιατί στο αρχείο και όχι σε δική της συλλογή**: όπως η ετικέτα Purview ζει **πάνω** στο έγγραφο, η απόφαση
 * ταξιδεύει με αυτό (κάδος · επαναφορά) και η κρίση τη διαβάζει από την ίδια ανάγνωση — καμία δεύτερη πηγή να διαφωνήσει.
 * 🔑 **Ανά έκδοση** (ACC review status): νέα έκδοση = νέο έγγραφο ⇒ γεννιέται **χωρίς** απόφαση και κρίνεται ξανά.
 * 🔑 **Ανά ακίνητο, όχι ανά αγοραστή**: όλοι οι συνιδιοκτήτες (Δ6) παίρνουν το **ίδιο** πακέτο.
 *
 * ⛔ Το γράφει **μόνο** ο γραφέας της απόφασης (Admin SDK)· ο πελάτης ούτε το γεννά ούτε το αλλάζει (κανόνας).
 * 🔒 Η αιτιολογία είναι **του γραφείου**: ποτέ σε PDF · manifest · σελίδα αγοραστή · ειδοποίηση.
 *
 * **Layering**: leaf — τύπος + καθαρός αναγνώστης, κανένα SDK.
 */

import {
  HANDOVER_FILE_DECISION_DISPOSITIONS,
  HANDOVER_FILE_DECISION_REASON_MAX,
  type HandoverFileDecisionDisposition,
} from '@/types/property-handover-file-decision';

/** Το ΕΝΑ όνομα πεδίου — το διαβάζουν ο κανόνας (`handoverDecisionKeys`), η άγκυρα του ενός γραφέα και ο γραφέας. */
export const FILE_HANDOVER_DECISION_FIELD = 'handoverDecision';

export interface FileHandoverDecision {
  readonly disposition: HandoverFileDecisionDisposition;
  readonly reason: string;
  /** uid του ανθρώπου — μένει στο αρχείο για το ίχνος, **δεν** ταξιδεύει στην προεπισκόπηση. */
  readonly decidedBy: string;
  readonly decidedAt: string;
}

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isDisposition = (value: unknown): value is HandoverFileDecisionDisposition =>
  typeof value === 'string' && (HANDOVER_FILE_DECISION_DISPOSITIONS as readonly string[]).includes(value);

/** **Διαβάζει** την απόφαση από ωμό έγγραφο αρχείου — `null` ⇒ λείπει **ή** δεν διαβάζεται. Ποτέ ισχυρισμός τύπου. */
export function readFileHandoverDecision(raw: unknown): FileHandoverDecision | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { disposition, reason, decidedBy, decidedAt } = raw as Record<string, unknown>;
  if (!isDisposition(disposition) || !nonEmptyString(decidedBy) || !nonEmptyString(decidedAt)) return null;
  if (!nonEmptyString(reason) || reason.length > HANDOVER_FILE_DECISION_REASON_MAX) return null;
  return { disposition, reason, decidedBy, decidedAt };
}
