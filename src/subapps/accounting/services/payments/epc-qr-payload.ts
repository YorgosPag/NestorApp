/**
 * @fileoverview EPC QR payload — «Σάρωση για πληρωμή» SEPA Credit Transfer (EPC069-12 v3.1)
 * @description Το περιεχόμενο του QR που προσυμπληρώνει τη μεταφορά στην τραπεζική εφαρμογή του λήπτη.
 *   Κάθε κανόνας εδώ είναι **γραμμή του επίσημου κειμένου** (EPC069-12 v3.1, 19/03/2024, §2.1–2.2):
 *
 *   - Service tag `BCD` · Version `002` (BIC προαιρετικό εντός ΕΟΧ) · Character set `1` = UTF-8 · Identification `SCT`
 *   - Δικαιούχος 1–70 · IBAN 1–34 («Only IBAN is allowed») · Ποσό `EUR` + 0.01 … 999999999.99
 *   - Purpose ≤4 (κενό εδώ) · Structured remittance ≤35 (RF, ISO 11649) **Ή** unstructured ≤140 — ποτέ και τα δύο
 *   - Διαχωριστής LF · **κανένας** διαχωριστής μετά το τελευταίο συμπληρωμένο στοιχείο
 *   - Σύνολο ≤ **331 bytes** (UTF-8: ο αριθμός χαρακτήρων μπορεί να είναι μικρότερος) · QR error level **M**
 *
 * ⚠️ Το EPC ορίζει τη λειτουργία ως **προαιρετική** για τις τράπεζες: το QR συμπληρώνει, ποτέ δεν αντικαθιστά,
 *   τον πίνακα λογαριασμών του τιμολογίου.
 *
 * Καθαρή συνάρτηση: κανένα I/O. Αδύνατο payload ⇒ `null` + λόγος — ποτέ κομμένο όνομα ή «διορθωμένο» ποσό.
 *
 * @see ADR-ACC-018 §15
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { cleanBIC, cleanIBAN, isValidBIC, validateIBAN } from '@/types/contacts/banking';
import { isValidCreditorReference, cleanCreditorReference } from './creditor-reference';

/** Όρια του EPC069-12 v3.1 §2.2 — ένα σημείο, ώστε έλεγχος και τεκμηρίωση να μην αποκλίνουν. */
export const EPC_QR_LIMITS = {
  maxPayloadBytes: 331,
  maxNameLength: 70,
  maxIbanLength: 34,
  maxStructuredReferenceLength: 35,
  maxUnstructuredLength: 140,
  minAmount: 0.01,
  maxAmount: 999_999_999.99,
} as const;

/** Το επίπεδο διόρθωσης σφαλμάτων που ορίζει το EPC (§2.1). */
export const EPC_QR_ERROR_CORRECTION = 'M' as const;

export interface EpcQrInput {
  /** Επωνυμία δικαιούχου (BT-85) — ακριβώς όπως είναι γνωστή στην τράπεζα */
  beneficiaryName: string;
  /** IBAN δικαιούχου (BT-84) */
  iban: string;
  /** BIC (BT-86) — προαιρετικό εντός ΕΟΧ (v002) */
  bic: string | null;
  /** Ποσό σε EUR */
  amount: number;
  /** Αιτιολογία: έγκυρο RF ⇒ structured · αλλιώς ελεύθερο κείμενο ⇒ unstructured (BT-83) */
  remittance: string;
}

export type EpcQrRejection =
  | 'invalid_name'
  | 'invalid_iban'
  | 'invalid_bic'
  | 'invalid_amount'
  | 'invalid_remittance'
  | 'payload_too_large';

export type EpcQrResult =
  | { readonly ok: true; readonly payload: string }
  | { readonly ok: false; readonly reason: EpcQrRejection };

/** «EUR12.3» — έως 2 δεκαδικά, χωρίς μηδενικά στο τέλος, τελεία ως υποδιαστολή (παραδείγματα §2.3). */
function formatEpcAmount(amount: number): string {
  const cents = Math.round(amount * 100);
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction ? `EUR${whole}.${fraction}` : `EUR${whole}`;
}

function remittanceLines(remittance: string): readonly [string, string] | null {
  const trimmed = remittance.trim();
  if (trimmed.length === 0) return ['', ''];
  if (isValidCreditorReference(trimmed)) return [cleanCreditorReference(trimmed), ''];
  if (trimmed.length > EPC_QR_LIMITS.maxUnstructuredLength) return null;
  return ['', trimmed];
}

function rejectionOf(input: EpcQrInput, name: string): EpcQrRejection | null {
  if (name.length === 0 || name.length > EPC_QR_LIMITS.maxNameLength) return 'invalid_name';
  const iban = cleanIBAN(input.iban);
  if (iban.length > EPC_QR_LIMITS.maxIbanLength || !validateIBAN(iban).valid) return 'invalid_iban';
  if (input.bic !== null && input.bic.trim() !== '' && !isValidBIC(input.bic)) return 'invalid_bic';
  const { amount } = input;
  if (!Number.isFinite(amount) || amount < EPC_QR_LIMITS.minAmount || amount > EPC_QR_LIMITS.maxAmount) {
    return 'invalid_amount';
  }
  return null;
}

/** Το payload του EPC QR, ή ο λόγος που δεν μπορεί να υπάρξει. */
export function buildEpcQrPayload(input: EpcQrInput): EpcQrResult {
  const name = input.beneficiaryName.trim().replace(/\s+/g, ' ');
  const rejection = rejectionOf(input, name);
  if (rejection !== null) return { ok: false, reason: rejection };

  const remittance = remittanceLines(input.remittance);
  if (remittance === null) return { ok: false, reason: 'invalid_remittance' };

  const bic = input.bic && input.bic.trim() !== '' ? cleanBIC(input.bic) : '';
  const elements = [
    'BCD', '002', '1', 'SCT', bic, name, cleanIBAN(input.iban), formatEpcAmount(input.amount),
    '', remittance[0], remittance[1],
  ];
  // «The last populated element is not followed by any character or element separator.»
  while (elements.length > 0 && elements[elements.length - 1] === '') elements.pop();
  const payload = elements.join('\n');

  if (new TextEncoder().encode(payload).length > EPC_QR_LIMITS.maxPayloadBytes) {
    return { ok: false, reason: 'payload_too_large' };
  }
  return { ok: true, payload };
}
