/**
 * GET  /api/rfqs — List RFQs (scoped by companyId)
 * POST /api/rfqs — Create RFQ
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-327 §5.3 Phase 1a
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createRfq, listRfqs } from '@/subapps/procurement/services/rfq-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';

const logger = createModuleLogger('RFQS_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const RfqLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().positive().nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

const CreateRfqSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  lines: z.array(RfqLineSchema).max(100).optional(),
  deadlineDate: z.string().nullable().optional(),
  awardMode: z.enum(['whole_package', 'cherry_pick']).default('whole_package'),
  reminderTemplate: z.enum(['aggressive', 'standard', 'soft', 'off']).default('standard'),
  comparisonTemplateId: z.string().nullable().optional(),
});

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

        const result = await createRfq(ctx, {
          ...parsed.data,
          buildingId: parsed.data.buildingId ?? null,
          deadlineDate: parsed.data.deadlineDate ?? null,
          description: parsed.data.description ?? null,
          comparisonTemplateId: parsed.data.comparisonTemplateId ?? null,
        });

        return NextResponse.json({ success: true, data: result }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create RFQ');
        logger.error('RFQ create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 400 });
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
