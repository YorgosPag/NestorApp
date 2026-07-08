/**
 * GET  /api/procurement/materials — List materials (filtered)
 * POST /api/procurement/materials — Create material
 *
 * Query params (GET): atoeCategoryCode, supplierContactId, search, includeDeleted
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-330 §3 Phase 4 Material Catalog
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, created, httpError } from '@/lib/api/define-route';
import {
  listMaterials,
  createMaterial,
} from '@/subapps/procurement/services/material-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveProcurementErrorStatus } from '../_shared/error-status';
import { CreateMaterialSchema } from '../_shared/material-schema';
import { readCatalogListFilters } from '../_shared/catalog-list-filters';

const logger = createModuleLogger('MATERIALS_API');

// ============================================================================
// GET — List materials
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list materials',
  handler: async ({ req, auth }) => {
    const params = new URL(req.url).searchParams;
    const items = await listMaterials(auth, {
      atoeCategoryCode: params.get('atoeCategoryCode') ?? undefined,
      supplierContactId: params.get('supplierContactId') ?? undefined,
      ...readCatalogListFilters(req),
    });
    return ok(items);
  },
});

// ============================================================================
// POST — Create material
// ============================================================================

export const POST = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to create material',
  handler: async ({ req, auth }) => {
    try {
      const parsed = safeParseBody(CreateMaterialSchema, await req.json());
      if (parsed.error) return parsed.error;
      const material = await createMaterial(auth, parsed.data);
      return created(material);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create material');
      const status = resolveProcurementErrorStatus(error, {
        conflictName: 'MaterialCodeConflictError',
        validationName: 'MaterialValidationError',
        mode: 'create',
      });
      logger.error('Material create error', { error: message });
      httpError(status, message);
    }
  },
});
