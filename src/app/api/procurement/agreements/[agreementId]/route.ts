/**
 * GET    /api/procurement/agreements/[agreementId]
 * PATCH  /api/procurement/agreements/[agreementId]
 * DELETE /api/procurement/agreements/[agreementId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 5 Framework Agreements
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getFrameworkAgreement,
  updateFrameworkAgreement,
  softDeleteFrameworkAgreement,
} from '@/subapps/procurement/services/framework-agreement-service';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  DISCOUNT_TYPES,
} from '@/subapps/procurement/types/framework-agreement';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FRAMEWORK_AGREEMENT_API');

const VolumeBreakpointSchema = z.object({
  thresholdEur: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100),
});

const UpdateFrameworkAgreementSchema = z.object({
  agreementNumber: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  vendorContactId: z.string().min(1).optional(),
  status: z.enum(FRAMEWORK_AGREEMENT_STATUSES).optional(),
  validFrom: z.string().min(1).optional(),
  validUntil: z.string().min(1).optional(),
  applicableProjectIds: z.array(z.string().min(1)).nullable().optional(),
  applicableMaterialIds: z.array(z.string().min(1)).nullable().optional(),
  applicableAtoeCategoryCodes: z.array(z.string().min(1)).nullable().optional(),
  currency: z.string().min(2).max(8).optional(),
  totalCommitment: z.number().nonnegative().nullable().optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  flatDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  volumeBreakpoints: z.array(VolumeBreakpointSchema).optional(),
});

// ============================================================================
// GET
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ agreementId: string }> },
): Promise<NextResponse> {
  const { agreementId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const agreement = await getFrameworkAgreement(ctx, agreementId);
        if (!agreement) {
          return NextResponse.json(
            { success: false, error: 'Framework agreement not found' },
            { status: 404 },
          );
        }
        return NextResponse.json({ success: true, data: agreement });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get framework agreement');
        logger.error('Framework agreement get error', { agreementId, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// PATCH
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ agreementId: string }> },
): Promise<NextResponse> {
  const { agreementId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateFrameworkAgreementSchema, await req.json());
        if (parsed.error) return parsed.error;
        const agreement = await updateFrameworkAgreement(ctx, agreementId, parsed.data);
        return NextResponse.json({ success: true, data: agreement });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update framework agreement');
        const status = errorStatus(error);
        logger.error('Framework agreement update error', { agreementId, error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// DELETE — soft-delete
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ agreementId: string }> },
): Promise<NextResponse> {
  const { agreementId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await softDeleteFrameworkAgreement(ctx, agreementId);
        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete framework agreement');
        const status = errorStatus(error);
        logger.error('Framework agreement delete error', { agreementId, error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

function errorStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.name === 'FrameworkAgreementNumberConflictError') return 409;
    if (error.name === 'FrameworkAgreementValidationError') return 400;
    const msg = error.message;
    if (msg.includes('not found')) return 404;
    if (msg.includes('Forbidden')) return 403;
  }
  return 400;
}

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
