/**
 * GET /api/procurement/sourcing-events/[eventId]/aggregate
 * Sourcing event aggregate: sibling RFQ stats, best totals per trade, package best total.
 * @see ADR-327 step (i)
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getSourcingEvent } from '@/subapps/procurement/services/sourcing-event-service';
import { getRfq } from '@/subapps/procurement/services/rfq-service';
import { listQuotes } from '@/subapps/procurement/services/quote-service';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { RfqStatus } from '@/subapps/procurement/types/rfq';
import type { SourcingEventStatus } from '@/subapps/procurement/types/sourcing-event';
import type { QuoteStatus } from '@/subapps/procurement/types/quote';

const logger = createModuleLogger('SOURCING_EVENT_AGGREGATE');

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
// HANDLER
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const event = await getSourcingEvent(ctx, eventId);
        if (!event) {
          return NextResponse.json(
            { success: false, error: 'Sourcing event not found' },
            { status: 404 },
          );
        }

        const rfqSnapshots = await Promise.all(
          event.rfqIds.map((rfqId) => getRfq(ctx.companyId, rfqId)),
        );
        const rfqs = rfqSnapshots.filter(
          (r): r is NonNullable<typeof r> => r !== null,
        );

        const bestTotals = await Promise.all(
          rfqs.map(async (rfq) => {
            const quotes = await listQuotes(ctx.companyId, { rfqId: rfq.id });
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

        return NextResponse.json({ success: true, data: aggregate });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to compute sourcing event aggregate');
        logger.error('Sourcing event aggregate error', { eventId, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// EXPORT
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
