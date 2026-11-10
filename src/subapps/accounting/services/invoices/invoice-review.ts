/**
 * @fileoverview **Έλεγχος παραστατικού πριν την έκδοση — ο συνθέτης** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/services/invoices/invoice-review
 *
 * Καθαρή συνάρτηση: πρόχειρο παραστατικό → ταξινομημένα ευρήματα με βαθμίδα, άγκυρα και πηγή. Συνθέτει τους ΔΥΟ
 * υπάρχοντες ελέγχους — **δεν** έχει δικό του κανόνα:
 * - `preflightMyDataDraft` (`mydata-preflight.ts`) — ό,τι θα απορρίψει / θα σταματήσει τη διαβίβαση στην ΑΑΔΕ·
 * - `reviewInvoiceVat` (`invoice-vat-review.ts`) — η μεταχείριση ΦΠΑ των γραμμών 0% (Φ2 + EN 16931).
 *
 * 🔑 **Ένας κανόνας, δύο σημεία**: η φόρμα ρωτά αυτή τη συνάρτηση ζωντανά· η διαβίβαση ξανατρέχει τον ίδιο
 * `mydata-preflight.ts` στο αποθηκευμένο τιμολόγιο. Βαθμίδα = ιδιότητα του κωδικού, δηλωμένη δίπλα στον έλεγχό του.
 * 🔑 **Άγκυρα, όχι DOM**: λέει «ποιο πεδίο» σημασιολογικά· το UI τη μεταφράζει σε στοιχείο (`invoice-field-ids.ts`).
 *
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import type { VatExemptionCode } from '../config/vat-exemption-reasons';
import {
  MYDATA_PREFLIGHT_SEVERITY,
  preflightMyDataDraft,
  type MyDataDraftFacts,
  type MyDataPreflightIssueCode,
} from '../mydata/mydata-preflight';
import {
  INVOICE_VAT_REVIEW_SEVERITY,
  reviewInvoiceVat,
  type InvoiceVatReviewCode,
  type VatTreatmentDimension,
} from '../tax/invoice-vat-review';
import { severityRank, type InvoiceReviewSeverity } from './review-severity';

// ============================================================================
// ΛΕΞΙΛΟΓΙΟ
// ============================================================================

export type InvoiceReviewCode = MyDataPreflightIssueCode | InvoiceVatReviewCode;

/** Η μία βαθμίδα κάθε κωδικού — ένωση των δύο δηλώσεων, εξαντλητική από κατασκευή. */
export const INVOICE_REVIEW_SEVERITY = {
  ...MYDATA_PREFLIGHT_SEVERITY,
  ...INVOICE_VAT_REVIEW_SEVERITY,
} as const satisfies Record<InvoiceReviewCode, InvoiceReviewSeverity>;

/** Το πεδίο που διορθώνει το εύρημα — σημασιολογικά. `company` = στοιχεία επιχείρησης (εκτός φόρμας). */
export type InvoiceReviewAnchor =
  | { readonly kind: 'line'; readonly lineNumber: number; readonly field: 'vatRate' | 'vatExemption' }
  | { readonly kind: 'customer'; readonly field: 'vatNumber' | 'postalCode' | 'country' }
  | { readonly kind: 'invoice'; readonly field: 'type' | 'paymentMethod' | 'withholdingRate' | 'lines' }
  | { readonly kind: 'company' };

type AnchorKind =
  | { readonly kind: 'line'; readonly field: 'vatRate' | 'vatExemption' }
  | Exclude<InvoiceReviewAnchor, { kind: 'line' }>;

/**
 * Πού διορθώνεται κάθε κωδικός. Οι κωδικοί που **δεν** βγαίνουν ποτέ από πρόχειρο (κατάσταση, νόμισμα, ΜΑΡΚ, σύνολα
 * — η φόρμα τα υπολογίζει με τον ίδιο υπολογισμό, §22.2) δείχνουν τις γραμμές ή το παραστατικό.
 */
const ANCHOR_BY_CODE = {
  STATUS_NOT_TRANSMITTABLE: { kind: 'invoice', field: 'type' },
  UNSUPPORTED_CURRENCY: { kind: 'invoice', field: 'type' },
  ISSUER_VAT_INVALID: { kind: 'company' },
  COUNTERPART_VAT_MISSING: { kind: 'customer', field: 'vatNumber' },
  COUNTERPART_VAT_INVALID: { kind: 'customer', field: 'vatNumber' },
  COUNTERPART_ADDRESS_MISSING: { kind: 'customer', field: 'postalCode' },
  COUNTERPART_COUNTRY_TYPE_MISMATCH: { kind: 'invoice', field: 'type' },
  CORRELATED_MARK_MISSING: { kind: 'invoice', field: 'type' },
  PAYMENT_METHOD_NOT_TRANSMITTABLE: { kind: 'invoice', field: 'paymentMethod' },
  NO_LINES: { kind: 'invoice', field: 'lines' },
  VAT_RATE_UNKNOWN: { kind: 'line', field: 'vatRate' },
  VAT_EXEMPTION_MISSING: { kind: 'line', field: 'vatExemption' },
  WITHHOLDING_CATEGORY_AMBIGUOUS: { kind: 'invoice', field: 'withholdingRate' },
  NET_TOTAL_MISMATCH: { kind: 'invoice', field: 'lines' },
  VAT_TOTAL_MISMATCH: { kind: 'invoice', field: 'lines' },
  VAT_EXEMPTION_SCENARIO_MISMATCH: { kind: 'line', field: 'vatExemption' },
  VAT_EXEMPTION_COUNTRY_UNKNOWN: { kind: 'customer', field: 'country' },
  VAT_TREATMENT_UNMAPPED: { kind: 'line', field: 'vatExemption' },
} as const satisfies Record<InvoiceReviewCode, AnchorKind>;

/**
 * Τα σφάλματα της ΑΑΔΕ που **προλαβαίνει** το εύρημα — μόνο όσα επαληθεύτηκαν στην επίσημη τεκμηρίωση
 * (myDATA API v1.0.9 §7 / v1.0.12): 217 «vatExemptionCategory υποχρεωτικό στην κατηγορία 7»· 243 / 244 / 287 χώρα
 * λήπτη ανά τύπο. Κανένας άλλος κωδικός δεν αποδίδεται χωρίς πηγή.
 */
const AADE_ERRORS_BY_CODE: Partial<Record<InvoiceReviewCode, readonly number[]>> = {
  VAT_EXEMPTION_MISSING: [217],
  COUNTERPART_COUNTRY_TYPE_MISMATCH: [243, 244, 287],
};

const NO_AADE_ERRORS: readonly number[] = [];

export interface InvoiceReviewFinding {
  readonly code: InvoiceReviewCode;
  readonly severity: InvoiceReviewSeverity;
  readonly anchor: InvoiceReviewAnchor;
  /** Γραμμή (1-based), όταν το εύρημα αφορά γραμμή — ακόμη κι αν η άγκυρα είναι πεδίο του πελάτη. */
  readonly lineNumber: number | null;
  /** Η αιτία εξαίρεσης της γραμμής, για τα ευρήματα μεταχείρισης ΦΠΑ. */
  readonly vatExemptionCategory: VatExemptionCode | null;
  readonly dimensions: readonly VatTreatmentDimension[];
  readonly aadeErrors: readonly number[];
}

// ============================================================================
// ΣΥΝΘΕΣΗ
// ============================================================================

function anchorOf(code: InvoiceReviewCode, lineNumber: number | null): InvoiceReviewAnchor {
  const anchor: AnchorKind = ANCHOR_BY_CODE[code];
  if (anchor.kind !== 'line') return anchor;
  return lineNumber === null ? { kind: 'invoice', field: 'lines' } : { ...anchor, lineNumber };
}

function finding(
  code: InvoiceReviewCode,
  lineNumber: number | null,
  vat: { readonly category: VatExemptionCode; readonly dimensions: readonly VatTreatmentDimension[] } | null,
): InvoiceReviewFinding {
  return {
    code,
    severity: INVOICE_REVIEW_SEVERITY[code],
    anchor: anchorOf(code, lineNumber),
    lineNumber,
    vatExemptionCategory: vat?.category ?? null,
    dimensions: vat?.dimensions ?? [],
    aadeErrors: AADE_ERRORS_BY_CODE[code] ?? NO_AADE_ERRORS,
  };
}

/** Βαθμίδα (σοβαρότερο πρώτο) → γραμμή (παραστατικό πριν τις γραμμές) → σειρά ελέγχου (σταθερή ταξινόμηση). */
function compareFindings(a: InvoiceReviewFinding, b: InvoiceReviewFinding): number {
  return severityRank(a.severity) - severityRank(b.severity) || (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
}

/** Όλα τα ευρήματα ενός πρόχειρου παραστατικού — κενό = έτοιμο για διαβίβαση. */
export function reviewInvoiceDraft(draft: MyDataDraftFacts): InvoiceReviewFinding[] {
  const preflight = preflightMyDataDraft(draft).map((issue) => finding(issue.code, issue.lineNumber, null));
  const vat = reviewInvoiceVat(draft).map((item) =>
    finding(item.code, item.lineNumber, { category: item.vatExemptionCategory, dimensions: item.dimensions }),
  );
  return [...preflight, ...vat].sort(compareFindings);
}

/** Μπορεί να διαβιβαστεί; — κανένα εύρημα `block`. */
export function isReadyForTransmission(findings: readonly InvoiceReviewFinding[]): boolean {
  return findings.every((item) => item.severity !== 'block');
}
