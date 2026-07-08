/**
 * GET    /api/procurement/materials/[materialId]
 * PATCH  /api/procurement/materials/[materialId]
 * DELETE /api/procurement/materials/[materialId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 4 Material Catalog
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, notFound, httpError } from '@/lib/api/define-route';
import {
  getMaterial,
  updateMaterial,
  softDeleteMaterial,
} from '@/subapps/procurement/services/material-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveProcurementErrorStatus } from '../../_shared/error-status';
import { UpdateMaterialSchema } from '../../_shared/material-schema';

const logger = createModuleLogger('MATERIAL_API');

const MATERIAL_ERROR_NAMES = {
  conflictName: 'MaterialCodeConflictError',
  validationName: 'MaterialValidationError',
} as const;

// ============================================================================
// GET
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get material',
  handler: async ({ auth, params }) => {
    const { materialId } = params;
    const material = await getMaterial(auth, materialId);
    if (!material) {
      notFound('Material not found');
    }
    return ok(material);
  },
});

// ============================================================================
// PATCH
// ============================================================================

export const PATCH = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to update material',
  handler: async ({ req, auth, params }) => {
    const { materialId } = params;
    try {
      const parsed = safeParseBody(UpdateMaterialSchema, await req.json());
      if (parsed.error) return parsed.error;
      const material = await updateMaterial(auth, materialId, parsed.data);
      return ok(material);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update material');
      const status = resolveProcurementErrorStatus(error, { ...MATERIAL_ERROR_NAMES, mode: 'mutation' });
      logger.error('Material update error', { materialId, error: message });
      httpError(status, message);
    }
  },
});

// ============================================================================
// DELETE — soft-delete
// ============================================================================

export const DELETE = defineRoute({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete material',
  handler: async ({ auth, params }) => {
    const { materialId } = params;
    try {
      await softDeleteMaterial(auth, materialId);
      return ok();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to delete material');
      const status = resolveProcurementErrorStatus(error, { ...MATERIAL_ERROR_NAMES, mode: 'mutation' });
      logger.error('Material delete error', { materialId, error: message });
      httpError(status, message);
    }
  },
});
