/**
 * GET    /api/procurement/agreements/[agreementId]
 * PATCH  /api/procurement/agreements/[agreementId]
 * DELETE /api/procurement/agreements/[agreementId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 5 Framework Agreements
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, notFound, httpError } from '@/lib/api/define-route';
import {
  getFrameworkAgreement,
  updateFrameworkAgreement,
  softDeleteFrameworkAgreement,
} from '@/subapps/procurement/services/framework-agreement-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveProcurementErrorStatus } from '../../_shared/error-status';
import { UpdateFrameworkAgreementSchema } from '../../_shared/framework-agreement-schema';

const logger = createModuleLogger('FRAMEWORK_AGREEMENT_API');

const AGREEMENT_ERROR_NAMES = {
  conflictName: 'FrameworkAgreementNumberConflictError',
  validationName: 'FrameworkAgreementValidationError',
} as const;

// ============================================================================
// GET
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get framework agreement',
  handler: async ({ auth, params }) => {
    const { agreementId } = params;
    const agreement = await getFrameworkAgreement(auth, agreementId);
    if (!agreement) {
      notFound('Framework agreement not found');
    }
    return ok(agreement);
  },
});

// ============================================================================
// PATCH
// ============================================================================

export const PATCH = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to update framework agreement',
  handler: async ({ req, auth, params }) => {
    const { agreementId } = params;
    try {
      const parsed = safeParseBody(UpdateFrameworkAgreementSchema, await req.json());
      if (parsed.error) return parsed.error;
      const agreement = await updateFrameworkAgreement(auth, agreementId, parsed.data);
      return ok(agreement);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update framework agreement');
      const status = resolveProcurementErrorStatus(error, { ...AGREEMENT_ERROR_NAMES, mode: 'mutation' });
      logger.error('Framework agreement update error', { agreementId, error: message });
      httpError(status, message);
    }
  },
});

// ============================================================================
// DELETE — soft-delete
// ============================================================================

export const DELETE = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete framework agreement',
  handler: async ({ auth, params }) => {
    const { agreementId } = params;
    try {
      await softDeleteFrameworkAgreement(auth, agreementId);
      return ok();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete framework agreement');
      const status = resolveProcurementErrorStatus(error, { ...AGREEMENT_ERROR_NAMES, mode: 'mutation' });
      logger.error('Framework agreement delete error', { agreementId, error: message });
      httpError(status, message);
    }
  },
});
