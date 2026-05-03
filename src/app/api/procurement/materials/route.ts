/**
 * GET  /api/procurement/materials — List materials (filtered)
 * POST /api/procurement/materials — Create material
 *
 * Query params (GET): atoeCategoryCode, supplierContactId, search, includeDeleted
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-330 §3 Phase 4 Material Catalog
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  listMaterials,
  createMaterial,
} from '@/subapps/procurement/services/material-service';
import { MAX_PREFERRED_SUPPLIERS } from '@/subapps/procurement/types/material';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MATERIALS_API');

const BOQ_UNITS = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
] as const;

const CreateMaterialSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  unit: z.enum(BOQ_UNITS),
  atoeCategoryCode: z.string().min(1).max(20),
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
// GET — List materials
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const items = await listMaterials(ctx, {
          atoeCategoryCode: url.searchParams.get('atoeCategoryCode') ?? undefined,
          supplierContactId: url.searchParams.get('supplierContactId') ?? undefined,
          search: url.searchParams.get('search') ?? undefined,
          includeDeleted: url.searchParams.get('includeDeleted') === 'true',
        });
        return NextResponse.json({ success: true, data: items });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list materials');
        logger.error('Materials list error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// POST — Create material
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreateMaterialSchema, await req.json());
        if (parsed.error) return parsed.error;
        const material = await createMaterial(ctx, parsed.data);
        return NextResponse.json({ success: true, data: material }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create material');
        const status =
          error instanceof Error && error.name === 'MaterialCodeConflictError'
            ? 409
            : error instanceof Error && error.name === 'MaterialValidationError'
              ? 400
              : 500;
        logger.error('Material create error', { error: message });
        return NextResponse.json({ success: false, error: message }, { status });
      }
    },
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
