/**
 * GET  /api/rfqs — List RFQs (scoped by companyId)
 * POST /api/rfqs — Create RFQ
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §5.3 Phase 1a
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createRfqWithOutcome, listRfqs } from '@/subapps/procurement/services/rfq-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CreateRfqSchema } from './_shared/rfq-schemas';
import { rfqCreateErrorResponse } from './_shared/rfq-error-response';

const logger = createModuleLogger('RFQS_API');

// ============================================================================
// GET — List RFQs
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const projectId = url.searchParams.get('projectId') ?? undefined;
        const status = url.searchParams.get('status') ?? undefined;
        const search = url.searchParams.get('search') ?? undefined;

        const rfqs = await listRfqs(ctx.companyId, { projectId, status: status as never, search });
        return NextResponse.json({ success: true, data: rfqs });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list RFQs');
        logger.error('RFQ list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

// ============================================================================
// POST — Create RFQ
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateRfqSchema, await req.json());
        if (parsed.error) return parsed.error;

        const { rfq, catalogSuppliers } = await createRfqWithOutcome(ctx, {
          ...parsed.data,
          buildingId: parsed.data.buildingId ?? null,
          deadlineDate: parsed.data.deadlineDate ?? null,
          description: parsed.data.description ?? null,
          comparisonTemplateId: parsed.data.comparisonTemplateId ?? null,
        });

        // ADR-923 §5.13 Τ6: ό,τι ΣΤΑΛΘΗΚΕ αποφασίζει το επόμενο βήμα της οθόνης — ποτέ το πρόχειρο.
        return NextResponse.json({ success: true, data: rfq, catalogSuppliers }, { status: 201 });
      } catch (error) {
        logger.error('RFQ create error', { error: getErrorMessage(error, 'Failed to create RFQ') });
        return rfqCreateErrorResponse(error);
      }
    }
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
