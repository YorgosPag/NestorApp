/**
 * =============================================================================
 * GET + POST /api/accounting/assets — List & Create Fixed Assets
 * =============================================================================
 *
 * GET:  List fixed assets with filters (category, status, acquisitionYear)
 * POST: Create a new fixed asset entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/assets
 * @enterprise ADR-ACC-007 Fixed Assets & Depreciation
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services';
import type {
  FixedAssetFilters,
  CreateFixedAssetInput,
  AssetCategory,
  AssetStatus,
} from '@/subapps/accounting/types';

// =============================================================================
// GET — List Fixed Assets
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const filters: FixedAssetFilters = {};

        const category = searchParams.get('category');
        if (category) {
          filters.category = category as AssetCategory;
        }

        const status = searchParams.get('status');
        if (status) {
          filters.status = status as AssetStatus;
        }

        const acquisitionYear = searchParams.get('acquisitionYear');
        if (acquisitionYear) {
          filters.acquisitionYear = parseInt(acquisitionYear, 10);
        }

        const pageSize = searchParams.get('pageSize');
        const result = await repository.listFixedAssets(
          filters,
          pageSize ? parseInt(pageSize, 10) : undefined
        );

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list fixed assets';
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
// POST — Create Fixed Asset
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as CreateFixedAssetInput;

        if (!body.description || !body.category || !body.acquisitionDate) {
          return NextResponse.json(
            { success: false, error: 'description, category, and acquisitionDate are required' },
            { status: 400 }
          );
        }

        if (typeof body.acquisitionCost !== 'number' || body.acquisitionCost <= 0) {
          return NextResponse.json(
            { success: false, error: 'acquisitionCost must be a positive number' },
            { status: 400 }
          );
        }

        const { id } = await repository.createFixedAsset(body);

        return NextResponse.json(
          { success: true, data: { assetId: id } },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create fixed asset';
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
