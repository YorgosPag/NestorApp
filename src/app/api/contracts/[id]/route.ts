/**
 * =============================================================================
 * GET + PATCH /api/contracts/[id] — Get & Update Contract
 * =============================================================================
 *
 * GET:   Get contract by ID
 * PATCH: Update contract fields (amount, deposit, notes, fileIds)
 *
 * @module api/contracts/[id]
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LegalContractService } from '@/services/legal-contract.service';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// VALIDATION SCHEMA — ADR-252 Phase 3 Security Hardening
// =============================================================================

const updateContractSchema = z.object({
  contractAmount: z.number().min(0).max(100_000_000).nullable().optional(),
  depositAmount: z.number().min(0).max(100_000_000).nullable().optional(),
  depositTerms: z.enum(['forfeit', 'double_return', 'refund']).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  fileIds: z.array(z.string().min(1).max(200)).max(50).optional(),
}).strict();

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — Get Contract by ID
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;
        const contract = await LegalContractService.getContractById(id);

        if (!contract) {
          return NextResponse.json(
            { success: false, error: 'Contract not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: contract });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get contract');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PATCH — Update Contract Fields
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;
        const rawBody: unknown = await req.json();
        const parsed = updateContractSchema.safeParse(rawBody);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.issues[0].message },
            { status: 400 }
          );
        }

        const result = await LegalContractService.updateContract(id, parsed.data);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update contract');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
