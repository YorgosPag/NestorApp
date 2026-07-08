/**
 * Zod schemas for RFQ lines — SSoT shared by the RFQ-line routes.
 *
 * `RfqLineItemSchema` is the single-line create shape, reused by:
 *   - `rfqs/[rfqId]/lines` POST      (add single line)
 *   - `rfqs/[rfqId]/lines/bulk` POST (array item, wrapped by `BulkCreateSchema`)
 * These two were byte-identical hand-duplicated object literals — the token
 * clone jscpd would flag. They are now one schema.
 *
 * `UpdateRfqLineSchema` is `RfqLineItemSchema.omit({ source, boqItemId }).partial()`
 * — byte-equivalent to the previously hand-duplicated PATCH schema: an update
 * cannot re-declare `source`/`boqItemId` (immutable provenance), and every
 * remaining field becomes optional (`description`/`trade` gain `.optional()`).
 *
 * @module app/api/procurement/_shared/rfq-line-schema
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { z } from 'zod';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';

export const RfqLineItemSchema = z.object({
  source: z.enum(['boq', 'ad_hoc']),
  boqItemId: z.string().nullable().optional(),
  description: z.string().min(1).max(1000),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const UpdateRfqLineSchema = RfqLineItemSchema.omit({
  source: true,
  boqItemId: true,
}).partial();
