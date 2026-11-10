/**
 * @fileoverview **Έλεγχος μεταχείρισης ΦΠΑ των γραμμών 0% — ο πρώτος καταναλωτής των §22.6 / §22.7** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/services/tax/invoice-vat-review
 *
 * Καθαρή συνάρτηση: (τύπος, πελάτης, γραμμές) → ευρήματα. Για κάθε γραμμή 0% με **έγκυρη** αιτία ρωτά τους ΔΥΟ
 * επιλυτές — πεδίο Φ2 (`resolveVatReturnTreatment`) και EN 16931 (`resolveEn16931VatTreatment`, προφίλ `en16931`) — και
 * ομαδοποιεί τις ανάγκες ελέγχου **ανά λόγο**: ένα εύρημα ανά (γραμμή, λόγος), με τις διαστάσεις που το δίνουν.
 * Ο λόγος δεν ξαναγράφεται εδώ: τον δίνουν οι επιλυτές, που κρίνουν τον τόπο παροχής με τον ΕΝΑ κριτή της §22.5.
 *
 * Γραμμή 0% **χωρίς** αιτία δεν κρίνεται εδώ: είναι `VAT_EXEMPTION_MISSING` του `mydata-preflight.ts` (`block`).
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import type { InvoiceLineItem, InvoiceType } from '../../types/invoice';
import { isVatExemptionCode, type VatExemptionCode } from '../config/vat-exemption-reasons';
import type { InvoiceReviewSeverity } from '../invoices/review-severity';
import { requiresVatExemption } from '../mydata/mydata-codes';
import type { CustomerVatFacts } from './customer-vat-treatment';
import { resolveEn16931VatTreatment, type En16931ReviewReason } from './en16931-vat-treatment';
import { resolveVatReturnTreatment, type VatReturnReviewReason } from './vat-return-treatment';

// ============================================================================
// ΛΕΞΙΛΟΓΙΟ
// ============================================================================

export const INVOICE_VAT_REVIEW_CODES = [
  'VAT_EXEMPTION_SCENARIO_MISMATCH',
  'VAT_EXEMPTION_COUNTRY_UNKNOWN',
  'VAT_TREATMENT_UNMAPPED',
] as const;
export type InvoiceVatReviewCode = (typeof INVOICE_VAT_REVIEW_CODES)[number];

/**
 * - αντίφαση πελάτη/αιτίας και άγνωστη χώρα = **λάθος δεδομένων** που κρίνει ο άνθρωπος (`warn`)·
 * - `unmapped` = η εφαρμογή **δεν ξέρει** — καμία επίσημη πηγή για την αντιστοίχιση (`info`), όχι λάθος του χρήστη.
 */
export const INVOICE_VAT_REVIEW_SEVERITY = {
  VAT_EXEMPTION_SCENARIO_MISMATCH: 'warn',
  VAT_EXEMPTION_COUNTRY_UNKNOWN: 'warn',
  VAT_TREATMENT_UNMAPPED: 'info',
} as const satisfies Record<InvoiceVatReviewCode, InvoiceReviewSeverity>;

/** Πού θα φανεί η μεταχείριση: δήλωση ΦΠΑ (Φ2) ή ηλεκτρονικό τιμολόγιο EN 16931. */
export const VAT_TREATMENT_DIMENSIONS = ['vat_return', 'en16931'] as const;
export type VatTreatmentDimension = (typeof VAT_TREATMENT_DIMENSIONS)[number];

export interface InvoiceVatFinding {
  readonly code: InvoiceVatReviewCode;
  readonly lineNumber: number;
  readonly vatExemptionCategory: VatExemptionCode;
  /** Ποιες διαστάσεις δίνουν αυτόν τον λόγο — μη κενό, με τη σειρά του `VAT_TREATMENT_DIMENSIONS`. */
  readonly dimensions: readonly VatTreatmentDimension[];
}

export interface InvoiceVatReviewInput {
  readonly type: InvoiceType;
  readonly customer: CustomerVatFacts;
  readonly lineItems: readonly Pick<InvoiceLineItem, 'lineNumber' | 'vatRate' | 'vatExemptionCategory'>[];
}

type ReviewReason = VatReturnReviewReason | En16931ReviewReason;

const CODE_BY_REASON = {
  scenario_mismatch: 'VAT_EXEMPTION_SCENARIO_MISMATCH',
  unknown_country: 'VAT_EXEMPTION_COUNTRY_UNKNOWN',
  unmapped: 'VAT_TREATMENT_UNMAPPED',
} as const satisfies Record<ReviewReason, InvoiceVatReviewCode>;

// ============================================================================
// ΕΛΕΓΧΟΣ
// ============================================================================

/** Ο λόγος ελέγχου κάθε διάστασης για μία γραμμή (`null` = λύθηκε ή ρητή απάντηση χωρίς πεδίο). */
function reasonsOf(
  code: VatExemptionCode,
  input: InvoiceVatReviewInput,
): Readonly<Record<VatTreatmentDimension, ReviewReason | null>> {
  const facts = { vatExemptionCategory: code, customer: input.customer, invoiceType: input.type };
  const vatReturn = resolveVatReturnTreatment(facts);
  const en16931 = resolveEn16931VatTreatment(facts, 'en16931');
  return {
    vat_return: vatReturn.kind === 'needs_review' ? vatReturn.reason : null,
    en16931: en16931.kind === 'needs_review' ? en16931.reason : null,
  };
}

function lineFindings(
  lineNumber: number,
  code: VatExemptionCode,
  input: InvoiceVatReviewInput,
): InvoiceVatFinding[] {
  const reasons = reasonsOf(code, input);
  const findings: InvoiceVatFinding[] = [];
  for (const reason of Object.keys(CODE_BY_REASON) as ReviewReason[]) {
    const dimensions = VAT_TREATMENT_DIMENSIONS.filter((dimension) => reasons[dimension] === reason);
    if (dimensions.length > 0) {
      findings.push({ code: CODE_BY_REASON[reason], lineNumber, vatExemptionCategory: code, dimensions });
    }
  }
  return findings;
}

/** Όλα τα ευρήματα μεταχείρισης ΦΠΑ, κατά σειρά γραμμής. */
export function reviewInvoiceVat(input: InvoiceVatReviewInput): InvoiceVatFinding[] {
  return input.lineItems.flatMap((line) => {
    const code = line.vatExemptionCategory;
    if (!requiresVatExemption(line.vatRate) || !isVatExemptionCode(code)) return [];
    return lineFindings(line.lineNumber, code, input);
  });
}
