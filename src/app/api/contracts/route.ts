/**
 * =============================================================================
 * GET + POST /api/contracts — List & Create Legal Contracts
 * =============================================================================
 *
 * GET:  List contracts for a unit (?unitId=X)
 * POST: Create a new legal contract (preliminary/final/payoff)
 *
 * @module api/contracts
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LegalContractService } from '@/services/legal-contract.service';
import type { CreateContractInput, ContractPhase } from '@/types/legal-contracts';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// GET — List Contracts for Unit
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { searchParams } = new URL(req.url);
        const unitId = searchParams.get('unitId');

        if (!unitId) {
          return NextResponse.json(
            { success: false, error: 'unitId query parameter is required' },
            { status: 400 }
          );
        }

        const contracts = await LegalContractService.getContractsForUnit(unitId);
        return NextResponse.json({ success: true, data: contracts });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list contracts');
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
// POST — Create Contract
// =============================================================================

const VALID_PHASES: ContractPhase[] = ['preliminary', 'final', 'payoff'];

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as CreateContractInput;

        if (!body.unitId || !body.projectId || !body.buildingId || !body.buyerContactId) {
          return NextResponse.json(
            { success: false, error: 'unitId, projectId, buildingId, and buyerContactId are required' },
            { status: 400 }
          );
        }

        if (!body.phase || !VALID_PHASES.includes(body.phase)) {
          return NextResponse.json(
            { success: false, error: 'phase must be preliminary, final, or payoff' },
            { status: 400 }
          );
        }

        const result = await LegalContractService.createContract(body, ctx.uid);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { success: true, data: result.contract },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create contract');
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
