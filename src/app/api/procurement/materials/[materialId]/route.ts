/**
 * GET    /api/procurement/materials/[materialId]
 * PATCH  /api/procurement/materials/[materialId]
 * DELETE /api/procurement/materials/[materialId] — soft-delete
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-330 §3 Phase 4 Material Catalog
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getMaterial,
  updateMaterial,
  softDeleteMaterial,
} from '@/subapps/procurement/services/material-service';
import { MAX_PREFERRED_SUPPLIERS } from '@/subapps/procurement/types/material';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MATERIAL_API');

const BOQ_UNITS = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
] as const;

const UpdateMaterialSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  unit: z.enum(BOQ_UNITS).optional(),
  atoeCategoryCode: z.string().min(1).max(20).optional(),
  description: z.string().max(2000).nullable().optional(),
  preferredSupplierContactIds: z
    .array(z.string().min(1))
    .max(MAX_PREFERRED_SUPPLIERS)
    .optional(),
  avgPrice: z.number().nonnegative().nullable().optional(),
  lastPrice: z.number().nonnegative().nullable().optional(),
  lastPurchaseDate: z.string().nullable().optional(),
});

// ============================================================================
// GET
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ materialId: string }> },
): Promise<NextResponse> {
  const { materialId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const material = await getMaterial(ctx, materialId);
        if (!material) {
          return NextResponse.json(
            { success: false, error: 'Material not found' },
            { status: 404 },
          );
        }
        return NextResponse.json({ success: true, data: material });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get material');
        logger.error('Material get error', { materialId, error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// PATCH
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ materialId: string }> },
): Promise<NextResponse> {
  const { materialId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(UpdateMaterialSchema, await req.json());
        if (parsed.error) return parsed.error;
        const material = await updateMaterial(ctx, materialId, parsed.data);
        return NextResponse.json({ success: true, data: material });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update material');
        const status = errorStatus(error);
        logger.error('Material update error', { materialId, error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// DELETE — soft-delete
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ materialId: string }> },
): Promise<NextResponse> {
  const { materialId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await softDeleteMaterial(ctx, materialId);
        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete material');
        const status = errorStatus(error);
        logger.error('Material delete error', { materialId, error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// HELPERS
// ============================================================================

function errorStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.name === 'MaterialCodeConflictError') return 409;
    if (error.name === 'MaterialValidationError') return 400;
    const msg = error.message;
    if (msg.includes('not found')) return 404;
    if (msg.includes('Forbidden')) return 403;
  }
  return 400;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
