/**
 * GET    /api/procurement/agreements/[agreementId]
 * PATCH  /api/procurement/agreements/[agreementId]
 * DELETE /api/procurement/agreements/[agreementId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 5 Framework Agreements
 * @see ADR-603 API Route-Handler Factory SSoT
 * @see ADR-742 §3.4 — η άρνηση ιδιοκτησίας περνά από τον κοινό εκτελεστή
 */

import 'server-only';

import type { z } from 'zod';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import {
  getFrameworkAgreement,
  updateFrameworkAgreement,
  softDeleteFrameworkAgreement,
} from '@/subapps/procurement/services/framework-agreement-service';
import { toFrameworkAgreementWire } from '@/subapps/procurement/services/framework-agreement-doc';
import { createModuleLogger } from '@/lib/telemetry';
import { runProcurementMutation } from '../../_shared/procurement-mutation';
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
    // Η υπηρεσία σιωπά (Δ): ξένο ≡ ανύπαρκτο, ένα `null` για τους δύο λόγους.
    const agreement = await getFrameworkAgreement(auth, agreementId);
    if (!agreement) {
      notFound('Framework agreement not found');
    }
    return ok(toFrameworkAgreementWire(agreement));
  },
});

// ============================================================================
// PATCH
// ============================================================================

export const PATCH = defineRoute<z.ZodTypeAny, { agreementId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to update framework agreement',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      auth,
      schema: UpdateFrameworkAgreementSchema,
      logger,
      logMessage: 'Framework agreement update error',
      logContext: { agreementId: params.agreementId },
      fallbackError: 'Failed to update framework agreement',
      ...AGREEMENT_ERROR_NAMES,
      run: async (data) =>
        ok(toFrameworkAgreementWire(await updateFrameworkAgreement(auth, params.agreementId, data))),
    }),
});

// ============================================================================
// DELETE — soft-delete
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { agreementId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete framework agreement',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      auth,
      logger,
      logMessage: 'Framework agreement delete error',
      logContext: { agreementId: params.agreementId },
      fallbackError: 'Failed to delete framework agreement',
      ...AGREEMENT_ERROR_NAMES,
      run: async () => {
        await softDeleteFrameworkAgreement(auth, params.agreementId);
        return ok();
      },
    }),
});
