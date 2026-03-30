/**
 * =============================================================================
 * POST /api/sales/{unitId}/accounting-event — Sales-to-Accounting Bridge
 * =============================================================================
 *
 * Δημιουργεί λογιστικά παραστατικά (invoice + journal entry) από sales events.
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/sales/[unitId]/accounting-event
 * @see ADR-198 Sales-to-Accounting Bridge
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { SalesAccountingBridge } from '@/services/sales-accounting';
import type { SalesAccountingEvent } from '@/services/sales-accounting';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// VALIDATION
// =============================================================================

const VALID_EVENT_TYPES = ['deposit_invoice', 'final_sale_invoice', 'credit_invoice', 'reservation_notify'] as const;

function validateEvent(body: Partial<SalesAccountingEvent>): string | null {
  if (!body.eventType || !VALID_EVENT_TYPES.includes(body.eventType as typeof VALID_EVENT_TYPES[number])) {
    return 'eventType must be one of: deposit_invoice, final_sale_invoice, credit_invoice, reservation_notify';
  }
  if (!body.unitId?.trim()) return 'unitId is required';
  if (!body.unitName?.trim()) return 'unitName is required';

  switch (body.eventType) {
    case 'deposit_invoice': {
      const ev = body as Partial<SalesAccountingEvent & { depositAmount: number }>;
      if (typeof ev.depositAmount !== 'number' || ev.depositAmount <= 0) {
        return 'depositAmount must be a positive number';
      }
      break;
    }
    case 'final_sale_invoice': {
      const ev = body as Partial<SalesAccountingEvent & { finalPrice: number; depositAlreadyInvoiced: number }>;
      if (typeof ev.finalPrice !== 'number' || ev.finalPrice <= 0) {
        return 'finalPrice must be a positive number';
      }
      if (typeof ev.depositAlreadyInvoiced !== 'number' || ev.depositAlreadyInvoiced < 0) {
        return 'depositAlreadyInvoiced must be a non-negative number';
      }
      break;
    }
    case 'credit_invoice': {
      const ev = body as Partial<SalesAccountingEvent & { creditAmount: number; reason: string }>;
      if (typeof ev.creditAmount !== 'number' || ev.creditAmount <= 0) {
        return 'creditAmount must be a positive number';
      }
      if (!ev.reason?.trim()) {
        return 'reason is required for credit invoices';
      }
      break;
    }
    case 'reservation_notify': {
      if (!body.buyerContactId?.trim()) {
        return 'buyerContactId is required for reservation notifications';
      }
      break;
    }
  }

  return null;
}

// =============================================================================
// POST — Process Sales Accounting Event
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ unitId: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { unitId } = await segmentData!.params;
        const body = (await req.json()) as Partial<SalesAccountingEvent>;

        // Ensure unitId from URL matches body
        body.unitId = unitId;

        // Validate
        const validationError = validateEvent(body);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // Process event
        const bridge = new SalesAccountingBridge({ companyId: ctx.companyId, userId: ctx.uid });
        const result = await bridge.processEvent(body as SalesAccountingEvent);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 422 }
          );
        }

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to process accounting event');
        console.error('[accounting-event] Error:', message);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);

// =============================================================================
// GET — Diagnostic (verify route exists + accounting setup)
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const bridge = new SalesAccountingBridge({ companyId: 'system', userId: 'system' });
    const profile = await bridge.checkSetup();
    return NextResponse.json({
      route: 'sales-accounting-event',
      status: 'deployed',
      timestamp: new Date().toISOString(),
      accountingConfigured: profile !== null,
      profileName: profile?.businessName ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      route: 'sales-accounting-event',
      status: 'error',
      error: getErrorMessage(error, 'unknown'),
    });
  }
}
