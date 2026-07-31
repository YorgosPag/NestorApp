/**
 * GET    /api/procurement/materials/[materialId]
 * PATCH  /api/procurement/materials/[materialId]
 * DELETE /api/procurement/materials/[materialId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 4 Material Catalog
 * @see ADR-603 API Route-Handler Factory SSoT
 * @see ADR-742 §3.4 — η άρνηση ιδιοκτησίας περνά από τον κοινό εκτελεστή
 */

import 'server-only';

import type { z } from 'zod';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import {
  getMaterial,
  updateMaterial,
  softDeleteMaterial,
} from '@/subapps/procurement/services/material-service';
import { createModuleLogger } from '@/lib/telemetry';
import { runProcurementMutation } from '../../_shared/procurement-mutation';
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
    // Η υπηρεσία σιωπά (Δ): ξένο ≡ ανύπαρκτο, ένα `null` για τους δύο λόγους.
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

export const PATCH = defineRoute<z.ZodTypeAny, { materialId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to update material',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      auth,
      schema: UpdateMaterialSchema,
      logger,
      logMessage: 'Material update error',
      logContext: { materialId: params.materialId },
      fallbackError: 'Failed to update material',
      ...MATERIAL_ERROR_NAMES,
      run: async (data) => ok(await updateMaterial(auth, params.materialId, data)),
    }),
});

// ============================================================================
// DELETE — soft-delete
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { materialId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Failed to delete material',
  handler: ({ req, auth, params }) =>
    runProcurementMutation({
      req,
      auth,
      logger,
      logMessage: 'Material delete error',
      logContext: { materialId: params.materialId },
      fallbackError: 'Failed to delete material',
      ...MATERIAL_ERROR_NAMES,
      run: async () => {
        await softDeleteMaterial(auth, params.materialId);
        return ok();
      },
    }),
});
