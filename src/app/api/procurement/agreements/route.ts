/**
 * GET  /api/procurement/agreements — List framework agreements (filtered)
 * POST /api/procurement/agreements — Create framework agreement
 *
 * Query params (GET): status, vendorContactId, search, includeDeleted
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-330 §3 Phase 5 Framework Agreements
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, created, httpError } from '@/lib/api/define-route';
import {
  listFrameworkAgreements,
  createFrameworkAgreement,
} from '@/subapps/procurement/services/framework-agreement-service';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  type FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveProcurementErrorStatus } from '../_shared/error-status';
import { CreateFrameworkAgreementSchema } from '../_shared/framework-agreement-schema';
import { readCatalogListFilters } from '../_shared/catalog-list-filters';

const logger = createModuleLogger('FRAMEWORK_AGREEMENTS_API');

// ============================================================================
// GET — List
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list framework agreements',
  handler: async ({ req, auth }) => {
    const params = new URL(req.url).searchParams;
    const statusParam = params.get('status');
    const isValidStatus =
      statusParam &&
      (FRAMEWORK_AGREEMENT_STATUSES as readonly string[]).includes(statusParam);
    const items = await listFrameworkAgreements(auth, {
      status: isValidStatus ? (statusParam as FrameworkAgreementStatus) : undefined,
      vendorContactId: params.get('vendorContactId') ?? undefined,
      ...readCatalogListFilters(req),
    });
    return ok(items);
  },
});

// ============================================================================
// POST — Create
// ============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to create framework agreement',
  handler: async ({ req, auth }) => {
    try {
      const parsed = safeParseBody(CreateFrameworkAgreementSchema, await req.json());
      if (parsed.error) return parsed.error;
      const agreement = await createFrameworkAgreement(auth, parsed.data);
      return created(agreement);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create framework agreement');
      const status = resolveProcurementErrorStatus(error, {
        conflictName: 'FrameworkAgreementNumberConflictError',
        validationName: 'FrameworkAgreementValidationError',
        mode: 'create',
      });
      logger.error('Framework agreement create error', { error: message });
      httpError(status, message);
    }
  },
});
