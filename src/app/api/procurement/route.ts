/**
 * GET  /api/procurement — List purchase orders
 * POST /api/procurement — Create purchase order
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-267 §Phase A
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, created } from '@/lib/api/define-route';
import { createPO, listPOs } from '@/services/procurement';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import { rethrowProcurementFailure } from './_shared/procurement-error-outcome';
import type { PurchaseOrderStatus, POVatRate } from '@/types/procurement';
import { CreatePOSchema } from './_shared/po-schema';

const logger = createModuleLogger('PROCUREMENT_API');

// ============================================================================
// GET — List POs
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list purchase orders',
  handler: async ({ req, auth }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as PurchaseOrderStatus | null;
    const projectId = url.searchParams.get('projectId') ?? undefined;
    const supplierId = url.searchParams.get('supplierId') ?? undefined;

    const pos = await listPOs({
      companyId: auth.companyId,
      status: status ?? undefined,
      projectId,
      supplierId,
    });

    return ok(pos);
  },
});

// ============================================================================
// POST — Create PO
// ============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to create purchase order',
  handler: async ({ req, auth }) => {
    try {
      const parsed = await safeJsonBody(CreatePOSchema, req);
      if (parsed.error) return parsed.error;

      const result = await createPO(auth, {
        ...parsed.data,
        buildingId: parsed.data.buildingId ?? null,
        dateNeeded: parsed.data.dateNeeded ?? null,
        deliveryAddress: parsed.data.deliveryAddress ?? null,
        paymentTermsDays: parsed.data.paymentTermsDays ?? null,
        supplierNotes: parsed.data.supplierNotes ?? null,
        internalNotes: parsed.data.internalNotes ?? null,
        taxRate: parsed.data.taxRate as POVatRate,
      });

      return created(result);
    } catch (error) {
      // Expected failures → 400 with their message; the unexpected → generic 500 + requestId (ADR-603 §Ασπίδα).
      logger.error('PO create error', { error: getErrorMessage(error, 'Failed to create purchase order') });
      rethrowProcurementFailure(error, auth.globalRole, 'Failed to create purchase order');
    }
  },
});
