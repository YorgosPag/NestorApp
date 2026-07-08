/**
 * GET /api/procurement/sourcing-events/[eventId]/aggregate
 * Sourcing event aggregate: sibling RFQ stats, best totals per trade, package best total.
 * @see ADR-327 step (i)
 * @see ADR-603 API Route-Handler Factory SSoT
 */
import 'server-only';

import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import { getSourcingEvent } from '@/subapps/procurement/services/sourcing-event-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { listQuotes } from '@/subapps/procurement/services/quote-service';
import type { RfqStatus } from '@/subapps/procurement/types/rfq';
import type { SourcingEventStatus } from '@/subapps/procurement/types/sourcing-event';
import type { QuoteStatus } from '@/subapps/procurement/types/quote';

const COMPARABLE_STATUSES: ReadonlySet<QuoteStatus> = new Set([
  'submitted', 'under_review', 'accepted',
]);

// ============================================================================
// SHAPE
// ============================================================================

export interface SourcingEventRfqRow {
  rfqId: string;
  title: string;
  trade: string | null;
  status: RfqStatus;
  bestQuoteTotal: number | null;
  winnerQuoteId: string | null;
}

export interface SourcingEventAggregate {
  eventId: string;
  title: string;
  status: SourcingEventStatus;
  rfqCount: number;
  tradeCount: number;
  uniqueVendorCount: number;
  bestPackageTotal: number | null;
  isPartialTotal: boolean;
  rfqs: SourcingEventRfqRow[];
}

// ============================================================================
// GET
// ============================================================================

export const GET = defineRoute<import('zod').ZodTypeAny, { eventId: string }>({
  rateLimit: 'standard',
  fallbackError: 'Failed to compute sourcing event aggregate',
  handler: async ({ auth, params }) => {
    const { eventId } = params;

    const event = await getSourcingEvent(auth, eventId);
    if (!event) notFound('Sourcing event not found');

    const rfqSnapshots = await Promise.all(
      event.rfqIds.map((rfqId) => getRfq(auth.companyId, rfqId)),
    );
    const rfqs = rfqSnapshots.filter(
      (r): r is NonNullable<typeof r> => r !== null,
    );

    const bestTotals = await Promise.all(
      rfqs.map(async (rfq) => {
        const quotes = await listQuotes(auth.companyId, { rfqId: rfq.id });
        const comparable = quotes.filter((q) => COMPARABLE_STATUSES.has(q.status));
        if (comparable.length === 0) return null;
        return Math.min(...comparable.map((q) => q.totals.total));
      }),
    );

    const uniqueVendors = new Set(rfqs.flatMap((r) => r.invitedVendorIds));
    const uniqueTrades = new Set(
      rfqs.flatMap((r) => r.lines.map((l) => l.trade)).filter(Boolean),
    );

    const definedTotals = bestTotals.filter((t): t is number => t !== null);
    const isPartialTotal = definedTotals.length < rfqs.length;
    const bestPackageTotal =
      definedTotals.length > 0
        ? Math.round(definedTotals.reduce((a, b) => a + b, 0) * 100) / 100
        : null;

    const aggregate: SourcingEventAggregate = {
      eventId: event.id,
      title: event.title,
      status: event.status,
      rfqCount: event.rfqCount,
      tradeCount: uniqueTrades.size,
      uniqueVendorCount: uniqueVendors.size,
      bestPackageTotal,
      isPartialTotal,
      rfqs: rfqs.map((rfq, i) => ({
        rfqId: rfq.id,
        title: rfq.title,
        trade: rfq.lines[0]?.trade ?? null,
        status: rfq.status,
        bestQuoteTotal: bestTotals[i],
        winnerQuoteId: rfq.winnerQuoteId,
      })),
    };

    return ok(aggregate);
  },
});
