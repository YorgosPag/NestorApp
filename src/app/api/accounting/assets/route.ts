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

import { defineRoute, created, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { ASSET_CATEGORIES, ASSET_STATUSES } from '@/subapps/accounting/types';
import type { FixedAssetFilters, CreateFixedAssetInput } from '@/subapps/accounting/types';
import { MAX_FISCAL_YEAR, MIN_FISCAL_YEAR } from '../_shared/fiscal-year-param';
import {
  optionalEnumParam,
  optionalIntParam,
  readListContext,
  readPageRequest,
  respondWithPage,
} from '../_shared/list-request-context';

// =============================================================================
// GET — List Fixed Assets
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list fixed assets',
  handler: async ({ req, auth }) => {
    const { repository, searchParams } = readListContext(req, auth);

    const filters: FixedAssetFilters = {
      category: optionalEnumParam(searchParams, 'category', ASSET_CATEGORIES),
      status: optionalEnumParam(searchParams, 'status', ASSET_STATUSES),
      acquisitionYear: optionalIntParam(searchParams, 'acquisitionYear', MIN_FISCAL_YEAR, MAX_FISCAL_YEAR),
    };

    return respondWithPage(() => repository.listFixedAssets(filters, readPageRequest(searchParams)));
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
