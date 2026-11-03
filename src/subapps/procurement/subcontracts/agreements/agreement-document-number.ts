/**
 * @fileoverview **Αριθμός εγγράφου** συμφωνητικού — καθαρή μορφή και κλειδί ακολουθίας (ADR-928 Φ2 απόφαση 7).
 * @module subapps/procurement/subcontracts/agreements/agreement-document-number
 *
 * Ο μετρητής ζει σε **ένα** έγγραφο ανά χώρο (`subcontract_agreement_counters/{companyId}`) με έναν αριθμό ανά
 * ακολουθία (`offer:2026`, `agreement:2026`). Τον αυξάνει ο γραφέας **μέσα** στη συναλλαγή που γράφει το έγγραφο: δεν
 * υπάρχει αριθμός χωρίς έγγραφο ούτε έγγραφο χωρίς αριθμό.
 */

import { AGREEMENT_NUMBER_MIN_DIGITS, AGREEMENT_NUMBER_PREFIX } from '@/config/subcontracts/agreement-numbering';
import type { CalendarDay } from '@/constants/platform-operator';
import type { AgreementDocumentRole } from '../types/agreement';

/** Το έγγραφο του μετρητή. */
export interface SubcontractAgreementCounter {
  readonly companyId: string;
  /** Ακολουθία → τελευταίος αριθμός που δόθηκε. */
  readonly sequences: Readonly<Record<string, number>>;
}

/** Το κλειδί ακολουθίας: είδος εγγράφου + έτος της ημερολογιακής μέρας (Ελλάδα). */
export function agreementSequenceKey(role: AgreementDocumentRole, today: CalendarDay): string {
  return `${role}:${today.slice(0, 4)}`;
}

/** «ΣΥΜ-2026-014». */
export function formatAgreementDocumentNumber(role: AgreementDocumentRole, today: CalendarDay, sequence: number): string {
  return `${AGREEMENT_NUMBER_PREFIX[role]}-${today.slice(0, 4)}-${String(sequence).padStart(AGREEMENT_NUMBER_MIN_DIGITS, '0')}`;
}

/** Ο επόμενος αριθμός και ο νέος μετρητής — καθαρό, ο γραφέας μόνο διαβάζει πριν και γράφει μετά. */
export function nextAgreementNumber(
  counter: SubcontractAgreementCounter | null,
  companyId: string,
  role: AgreementDocumentRole,
  today: CalendarDay,
): { readonly documentNumber: string; readonly counter: SubcontractAgreementCounter } {
  const key = agreementSequenceKey(role, today);
  const sequence = (counter?.sequences[key] ?? 0) + 1;
  return {
    documentNumber: formatAgreementDocumentNumber(role, today, sequence),
    counter: { companyId, sequences: { ...(counter?.sequences ?? {}), [key]: sequence } },
  };
}
