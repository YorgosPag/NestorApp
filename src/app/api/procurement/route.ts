/**
 * GET  /api/procurement — List purchase orders
 * POST /api/procurement — Create purchase order
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (POST)
 * @see ADR-267 §Phase A
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { createPO, listPOs } from '@/services/procurement';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import type { PurchaseOrderStatus, POVatRate } from '@/types/procurement';

const logger = createModuleLogger('PROCUREMENT_API');

// ============================================================================
// SCHEMAS
// ============================================================================

const CreatePOItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
  boqItemId: z.string().nullable().default(null),
  categoryCode: z.string().min(1).max(20),
});

const CreatePOSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().nullable().optional(),
  supplierId: z.string().min(1),
  items: z.array(CreatePOItemSchema).min(1).max(100),
  taxRate: z.union([z.literal(24), z.literal(13), z.literal(6), z.literal(0)]),
  dateNeeded: z.string().nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
  supplierNotes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
});

// ============================================================================
// GET — List POs
// ============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') as PurchaseOrderStatus | null;
        const projectId = url.searchParams.get('projectId') ?? undefined;
        const supplierId = url.searchParams.get('supplierId') ?? undefined;

        const pos = await listPOs({
          companyId: ctx.companyId,
          status: status ?? undefined,
          projectId,
          supplierId,
        });

        return NextResponse.json({ success: true, data: pos });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list purchase orders');
        logger.error('PO list error', { error: message });
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
  return handler(request);
}

// ============================================================================
// POST — Create PO
// ============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CreatePOSchema, await req.json());
        if (parsed.error) return parsed.error;

        const result = await createPO(ctx, {
          ...parsed.data,
          buildingId: parsed.data.buildingId ?? null,
          dateNeeded: parsed.data.dateNeeded ?? null,
          deliveryAddress: parsed.data.deliveryAddress ?? null,
          paymentTermsDays: parsed.data.paymentTermsDays ?? null,
          supplierNotes: parsed.data.supplierNotes ?? null,
          internalNotes: parsed.data.internalNotes ?? null,
          taxRate: parsed.data.taxRate as POVatRate,
        });

        return NextResponse.json(
          { success: true, data: result },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create purchase order');
        logger.error('PO create error', { error: message });
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        );
      }
    }
  );
  return handler(request);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const POST = withSensitiveRateLimit(handlePost);
