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
  mydata: z.record(z.unknown()).optional(),
}).passthrough();

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
