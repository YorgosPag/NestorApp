/**
 * @fileoverview Invoice API — Zod Schemas & Constants
 * @description Extracted from [id]/route.ts to stay under 300-line API route limit
 * @module api/accounting/invoices/invoice-schemas
 */

import { z } from 'zod';
import type { CancellationReasonCode, MyDataDocumentStatus } from '@/subapps/accounting/types';

// ============================================================================
// UPDATE INVOICE SCHEMA
// ============================================================================

export const UpdateInvoiceSchema = z.object({
  type: z.string().max(50).optional(),
  issueDate: z.string().max(30).optional(),
  dueDate: z.string().max(30).nullable().optional(),
  contactId: z.string().max(128).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  lineItems: z.array(z.record(z.unknown())).optional(),
  payments: z.array(z.record(z.unknown())).optional(),
  notes: z.string().max(5000).nullable().optional(),
}).passthrough();

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
const SERVER_OWNED_INVOICE_FIELDS = ['mydata'] as const;

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
