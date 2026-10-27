/**
 * Zod schemas of the RFQ document routes (`/api/rfqs`, `/api/rfqs/[id]`) — ONE place for both.
 *
 * ⚠️ `z.object` STRIPS undeclared keys. Until ADR-330 §5.1 S3.2 `CreateRfqSchema` did not declare
 * `boqItemIds` / `adHocLines` / `invitedVendorIds` / `sourcingEventId`, although `CreateRfqDTO` and
 * `RfqBuilder` send them: every RFQ created from the form was saved with NO lines, NO invited vendors and
 * NO parent package — a 201 that lied. Every field of `CreateRfqDTO` the service reads is declared here.
 *
 * @see ADR-327 §17 Q28-Q31 · ADR-330 §5.1 S3.2
 */

import { z } from 'zod';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { RFQ_FROM_BOQ_MAX_ITEMS } from '@/subapps/procurement/types/rfq';
import { RfqLineItemSchema } from '@/app/api/procurement/_shared/rfq-line-schema';

const RFQ_INLINE_LINES_MAX = 100;

/** Each invited vendor adds writes to the ONE create batch (Firestore: 500 ops) — bounded well inside it. */
const RFQ_INVITED_VENDORS_MAX = 100;

/** Legacy inline line (`RFQ.lines[]`, `linesStorage: 'inline_legacy'`). */
const RfqInlineLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().positive().nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

const RfqInlineLinesSchema = z.array(RfqInlineLineSchema).max(RFQ_INLINE_LINES_MAX).optional();

/** Q29 escape hatch — sub-collection lines typed by hand; a BOQ line travels as `boqItemIds`, never here. */
const AdHocLineSchema = RfqLineItemSchema.omit({ boqItemId: true }).extend({ source: z.literal('ad_hoc') });

export const CreateRfqSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  lines: RfqInlineLinesSchema,
  deadlineDate: z.string().nullable().optional(),
  awardMode: z.enum(['whole_package', 'cherry_pick']).default('whole_package'),
  reminderTemplate: z.enum(['aggressive', 'standard', 'soft', 'off']).default('standard'),
  comparisonTemplateId: z.string().nullable().optional(),
  boqItemIds: z.array(z.string().min(1)).min(1).max(RFQ_FROM_BOQ_MAX_ITEMS).optional(),
  adHocLines: z.array(AdHocLineSchema).min(1).max(RFQ_INLINE_LINES_MAX).optional(),
  invitedVendorIds: z.array(z.string().min(1)).max(RFQ_INVITED_VENDORS_MAX).optional(),
  sourcingEventId: z.string().min(1).nullable().optional(),
});

export const UpdateRfqSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  lines: RfqInlineLinesSchema,
  deadlineDate: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
  awardMode: z.enum(['whole_package', 'cherry_pick']).optional(),
  reminderTemplate: z.enum(['aggressive', 'standard', 'soft', 'off']).optional(),
  winnerQuoteId: z.string().nullable().optional(),
});
