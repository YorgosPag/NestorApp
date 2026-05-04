/**
 * GET  /api/procurement/agreements — List framework agreements (filtered)
 * POST /api/procurement/agreements — Create framework agreement
 *
 * Query params (GET): status, vendorContactId, search, includeDeleted
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-330 §3 Phase 5 Framework Agreements
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  listFrameworkAgreements,
  createFrameworkAgreement,
} from '@/subapps/procurement/services/framework-agreement-service';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  DISCOUNT_TYPES,
  type FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FRAMEWORK_AGREEMENTS_API');

const VolumeBreakpointSchema = z.object({
  thresholdEur: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
});

const CreateFrameworkAgreementSchema = z.object({
  agreementNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  vendorContactId: z.string().min(1),
  status: z.enum(FRAMEWORK_AGREEMENT_STATUSES).optional(),
  validFrom: z.string().min(1),
  validUntil: z.string().min(1),
  applicableProjectIds: z.array(z.string().min(1)).nullable().optional(),
  applicableMaterialIds: z.array(z.string().min(1)).nullable().optional(),
  applicableAtoeCategoryCodes: z.array(z.string().min(1)).nullable().optional(),
  currency: z.string().min(2).max(8).optional(),
  totalCommitment: z.number().nonnegative().nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  flatDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  volumeBreakpoints: z.array(VolumeBreakpointSchema).optional(),
});

// ============================================================================
// GET — List
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const statusParam = url.searchParams.get('status');
        const isValidStatus =
          statusParam &&
          (FRAMEWORK_AGREEMENT_STATUSES as readonly string[]).includes(statusParam);
        const items = await listFrameworkAgreements(ctx, {
          status: isValidStatus ? (statusParam as FrameworkAgreementStatus) : undefined,
          vendorContactId: url.searchParams.get('vendorContactId') ?? undefined,
          search: url.searchParams.get('search') ?? undefined,
          includeDeleted: url.searchParams.get('includeDeleted') === 'true',
        });
        return NextResponse.json({ success: true, data: items });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list framework agreements');
        logger.error('Framework agreements list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// POST — Create
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateFrameworkAgreementSchema, await req.json());
        if (parsed.error) return parsed.error;
        const agreement = await createFrameworkAgreement(ctx, parsed.data);
        return NextResponse.json({ success: true, data: agreement }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create framework agreement');
        const status =
          error instanceof Error && error.name === 'FrameworkAgreementNumberConflictError'
            ? 409
            : error instanceof Error && error.name === 'FrameworkAgreementValidationError'
              ? 400
              : 500;
        logger.error('Framework agreement create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
