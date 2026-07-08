/**
 * =============================================================================
 * GET + POST /api/accounting/assets — List & Create Fixed Assets
 * =============================================================================
 *
 * GET:  List fixed assets with filters (category, status, acquisitionYear)
 * POST: Create a new fixed asset entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/assets
 * @enterprise ADR-ACC-007 Fixed Assets & Depreciation
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, created, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  FixedAssetFilters,
  CreateFixedAssetInput,
  AssetCategory,
  AssetStatus,
} from '@/subapps/accounting/types';

// =============================================================================
// GET — List Fixed Assets
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list fixed assets',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
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

    return ok(result);
  },
});

// =============================================================================
// POST — Create Fixed Asset
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to create fixed asset',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const body = (await req.json()) as CreateFixedAssetInput;

    if (!body.description || !body.category || !body.acquisitionDate) {
      badRequest('description, category, and acquisitionDate are required');
    }

    if (typeof body.acquisitionCost !== 'number' || body.acquisitionCost <= 0) {
      badRequest('acquisitionCost must be a positive number');
    }

    const { id } = await repository.createFixedAsset(body);

    return created({ assetId: id });
  },
});
