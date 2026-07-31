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

import { defineRoute, ok, created } from '@/lib/api/define-route';
import {
  listMaterials,
  createMaterial,
} from '@/subapps/procurement/services/material-service';
import { createModuleLogger } from '@/lib/telemetry';
import { runProcurementMutation } from '../_shared/procurement-mutation';
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
  handler: ({ req, auth }) =>
    runProcurementMutation({
      req,
      auth,
      schema: CreateMaterialSchema,
      logger,
      logMessage: 'Material create error',
      fallbackError: 'Failed to create material',
      conflictName: 'MaterialCodeConflictError',
      validationName: 'MaterialValidationError',
      mode: 'create',
      run: async (data) => created(await createMaterial(auth, data)),
    }),
});
