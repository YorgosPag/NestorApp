/**
 * Shared Zod field shapes for journal-entry create/update (ADR-603).
 *
 * The create (journal/route) and update (journal/[id]/route) schemas share the
 * same trailing set of optional monetary/relational fields verbatim — a jscpd
 * structural sibling clone (N.18). This module owns that shared shape so both
 * schemas spread ONE definition; the head fields (which differ in required-ness
 * between create and update) stay local to each route.
 *
 * @module api/accounting/_shared/journal-entry-fields
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 * @enterprise ADR-ACC-001 Chart of Accounts
 */

import { z } from 'zod';

/**
 * Optional monetary + relational journal-entry fields, identical between the
 * create and update schemas. Spread into a `z.object({ …head, ...this })`.
 */
export const journalEntryOptionalFields = {
  vatRate: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).max(999_999_999).optional(),
  grossAmount: z.number().min(0).max(999_999_999).optional(),
  vatDeductible: z.boolean().optional(),
  paymentMethod: z.string().max(50).optional(),
  contactId: z.string().max(128).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  invoiceId: z.string().max(128).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
} as const;
