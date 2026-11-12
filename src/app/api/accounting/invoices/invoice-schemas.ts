/**
 * @fileoverview Invoice API — Zod Schemas & Constants
 * @description Extracted from [id]/route.ts to stay under 300-line API route limit
 * @module api/accounting/invoices/invoice-schemas
 */

import { z } from 'zod';
import { MYDATA_INCOME_TYPES } from '@/subapps/accounting/types';
import type {
  CancellationReasonCode,
  InvoiceLineItem,
  MyDataDocumentStatus,
  VatBreakdown,
} from '@/subapps/accounting/types';
import { isGreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { isVatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { hasVatExemptionContradiction } from '@/subapps/accounting/services/mydata/mydata-codes';
import { invoiceAmountsOf, lineNetAmount } from '@/subapps/accounting/utils/invoice-amounts';

// ============================================================================
// INVOICE LINE + AMOUNTS (ADR-ACC-003 §22.2 — ο διακομιστής δεν εμπιστεύεται ποσά του πελάτη)
// ============================================================================

/** Ανώτατο πλήθος γραμμών ανά παραστατικό — φράχτης μεγέθους εγγράφου, όχι επιχειρηματικό όριο. */
export const MAX_INVOICE_LINES = 500;

const money = z.number().finite();

const InvoiceLineItemShape = z.object({
  lineNumber: z.number().int().min(1),
  description: z.string().max(1000),
  quantity: z.number().finite(),
  unit: z.string().max(50),
  unitPrice: money,
  vatRate: z.number().refine(isGreekVatRatePercent, { message: 'vatRate is not a Greek VAT rate (GREEK_VAT_RATES)' }),
  netAmount: money,
  mydataCode: z.enum(MYDATA_INCOME_TYPES),
  vatExemptionCategory: z
    .number()
    .refine(isVatExemptionCode, { message: 'vatExemptionCategory is not an AADE §8.3 code (VAT_EXEMPTION_REASONS)' })
    .nullable()
    .optional(),
});

/**
 * Γραμμή τιμολογίου — **ένα** συμβόλαιο για POST και PATCH. Το `satisfies` δένει το σχήμα με τον τύπο: νέο
 * υποχρεωτικό πεδίο στο `InvoiceLineItem` χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης, όχι σιωπηλό πέταμα.
 *
 * 🔑 Αντίφαση = απόρριψη, ποτέ σιωπηλή διόρθωση: αιτία εξαίρεσης σε γραμμή που δεν τη δέχεται, ή καθαρό που δεν
 * ισούται με ποσότητα × τιμή. Γραμμή 0% **χωρίς** αιτία περνά (πρόχειρο) — τη μπλοκάρει ο `mydata-preflight.ts`.
 */
export const InvoiceLineItemSchema = InvoiceLineItemShape.superRefine((line, ctx) => {
  if (hasVatExemptionContradiction(line)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vatExemptionCategory'],
      message: `vatExemptionCategory is allowed only on a 0% (AADE VAT category 7) line, not on vatRate ${line.vatRate}`,
    });
  }
  const expectedNet = lineNetAmount(line.quantity, line.unitPrice);
  if (line.netAmount !== expectedNet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['netAmount'],
      message: `netAmount must equal quantity × unitPrice rounded per line (expected ${expectedNet})`,
    });
  }
}) satisfies z.ZodType<InvoiceLineItem>;

const VatBreakdownSchema = z.object({ vatRate: z.number(), netAmount: money, vatAmount: money });

/** Τα πεδία ποσών του σώματος POST/PATCH — όλα παράγωγα των γραμμών. */
export const invoiceAmountFields = {
  lineItems: z.array(InvoiceLineItemSchema).max(MAX_INVOICE_LINES).optional(),
  totalNetAmount: money.optional(),
  totalVatAmount: money.optional(),
  totalGrossAmount: money.optional(),
  vatBreakdown: z.array(VatBreakdownSchema).optional(),
};

interface InvoiceAmountBody {
  lineItems?: readonly InvoiceLineItem[];
  totalNetAmount?: number;
  totalVatAmount?: number;
  totalGrossAmount?: number;
  vatBreakdown?: readonly VatBreakdown[];
}

const INVOICE_TOTAL_FIELDS = ['totalNetAmount', 'totalVatAmount', 'totalGrossAmount'] as const;

function sameVatBreakdown(sent: readonly VatBreakdown[], expected: readonly VatBreakdown[]): boolean {
  return sent.length === expected.length && expected.every((row) => sent.some((other) =>
    other.vatRate === row.vatRate && other.netAmount === row.netAmount && other.vatAmount === row.vatAmount));
}

/**
 * Τα σύνολα **ισούνται** με αυτά που υπολογίζει ο διακομιστής από τις γραμμές (`invoiceAmountsOf` — ο ίδιος
 * υπολογισμός με τη φόρμα και τον preflight). Γραμμές ⇒ σύνολα υποχρεωτικά· σύνολα χωρίς γραμμές ⇒ απόρριψη
 * (θα ξέφευγαν από τις αποθηκευμένες γραμμές).
 */
export function refineInvoiceAmounts(body: InvoiceAmountBody, ctx: z.RefinementCtx): void {
  const sentAmounts = INVOICE_TOTAL_FIELDS.some((field) => body[field] !== undefined) || body.vatBreakdown !== undefined;
  if (!body.lineItems) {
    if (sentAmounts) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lineItems'], message: 'invoice amounts are derived from lineItems: send them together' });
    }
    return;
  }
  const expected = invoiceAmountsOf(body.lineItems);
  for (const field of INVOICE_TOTAL_FIELDS) {
    if (body[field] !== expected[field]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} must equal the sum of the line amounts (expected ${expected[field]})` });
    }
  }
  if (body.vatBreakdown && !sameVatBreakdown(body.vatBreakdown, expected.vatBreakdown)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vatBreakdown'], message: 'vatBreakdown must equal the per-rate sums of the line amounts' });
  }
}

// ============================================================================
// UPDATE INVOICE SCHEMA
// ============================================================================

/** Τα πεδία που POST και PATCH ελέγχουν **ίδια** — ένα σημείο, ώστε τα δύο σχήματα να μην αποκλίνουν. */
export const invoiceSharedFields = {
  dueDate: z.string().max(30).nullable().optional(),
  contactId: z.string().max(128).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  ...invoiceAmountFields,
  notes: z.string().max(5000).nullable().optional(),
};

export const UpdateInvoiceSchema = z.object({
  type: z.string().max(50).optional(),
  issueDate: z.string().max(30).optional(),
  ...invoiceSharedFields,
}).passthrough().superRefine(refineInvoiceAmounts);

// ============================================================================
// SERVER-OWNED FIELDS (ADR-ACC-003 §22 — ένας γραφέας της κατάστασης myDATA)
// ============================================================================

/**
 * Πεδία που γράφει **μόνο** ο διακομιστής. Τα schemas είναι `.passthrough()`, άρα η απλή απουσία
 * τους από το schema **δεν** τα κόβει — κόβονται ρητά εδώ, σε POST και PATCH.
 *
 * 🔴 Χωρίς αυτό ένα πρόχειρο τιμολόγιο μπορούσε να σταλεί με `mydata.status = 'accepted'` και ψεύτικο
 * ΜΑΡΚ — «διαβιβασμένο» χωρίς να φτάσει ποτέ στην ΑΑΔΕ, και πια αμετάβλητο (`IMMUTABLE_STATUSES`).
 */
const SERVER_OWNED_INVOICE_FIELDS = [
  'mydata',
  // ADR-ACC-030: οι κινήσεις πληρωμής έχουν ΕΝΑΝ γραφέα (`recordInvoicePayment`, σε transaction) και τα
  // παράγωγα (`totalPaid` · `totalRefunded` · `balanceDue` · `paymentStatus`) τα βγάζει ΜΟΝΟ το
  // `settleInvoicePayments`. Ένα PATCH με παλιό αντίγραφο του `payments[]` θα έσβηνε σιωπηλά πληρωμή που μόλις
  // κατέγραψε το webhook του παρόχου (lost update).
  'payments',
  'totalPaid',
  'totalRefunded',
  'balanceDue',
  'paymentStatus',
] as const;

type ServerOwnedInvoiceField = (typeof SERVER_OWNED_INVOICE_FIELDS)[number];

export function stripServerOwnedInvoiceFields<T extends object>(body: T): Omit<T, ServerOwnedInvoiceField> {
  const copy = { ...body };
  for (const field of SERVER_OWNED_INVOICE_FIELDS) Reflect.deleteProperty(copy, field);
  return copy;
}

// ============================================================================
// CANCEL INVOICE SCHEMA + CONSTANTS
// ============================================================================

export const CANCELLATION_REASON_CODES: readonly CancellationReasonCode[] = [
  'BILLING_ERROR', 'DUPLICATE', 'ORDER_CANCELLED',
  'TERMS_CHANGED', 'GOODS_RETURNED', 'OTHER',
];

export const CancelInvoiceSchema = z.object({
  reasonCode: z.enum(CANCELLATION_REASON_CODES as unknown as [string, ...string[]]),
  notes: z.string().max(2000).optional().default(''),
}).refine(
  (data) => data.reasonCode !== 'OTHER' || (data.notes.trim().length > 0),
  { message: 'Notes are mandatory when reason is OTHER', path: ['notes'] }
);

// ============================================================================
// STATUS SETS (immutability guards)
// ============================================================================

/** Accepted/sent/cancelled invoices are IMMUTABLE (fiscal law + ΑΑΔΕ submission) */
export const IMMUTABLE_STATUSES: ReadonlySet<MyDataDocumentStatus> = new Set([
  'accepted', 'cancelled', 'sent',
]);

/** Draft or rejected → can be voided */
export const VOIDABLE_STATUSES: ReadonlySet<string> = new Set(['draft', 'rejected']);

/** Issued → requires credit note */
export const CREDIT_NOTE_STATUSES: ReadonlySet<string> = new Set(['sent', 'accepted']);
