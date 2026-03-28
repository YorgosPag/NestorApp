/**
 * GET    /api/procurement/[poId] — Get single PO
 * PATCH  /api/procurement/[poId] — Update PO / status transitions
 * DELETE /api/procurement/[poId] — Soft delete PO
 *
 * PATCH actions via ?action= query param:
 *   approve, order, close, cancel, record-delivery, link-invoice, duplicate, update
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 §Phase A
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getPO,
  updatePO,
  approvePO,
  markOrdered,
  closePO,
  cancelPO,
  recordPODelivery,
  linkInvoiceToPO,
  deletePO,
  duplicatePO,
} from '@/services/procurement';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import type { POCancellationReason, POVatRate } from '@/types/procurement';

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdatePOItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
  boqItemId: z.string().nullable().optional(),
  categoryCode: z.string().min(1).max(20),
});

const UpdatePOSchema = z.object({
  projectId: z.string().min(1).optional(),
  buildingId: z.string().nullable().optional(),
  supplierId: z.string().min(1).optional(),
  items: z.array(UpdatePOItemSchema).min(1).max(100).optional(),
  taxRate: z.union([z.literal(24), z.literal(13), z.literal(6), z.literal(0)]).optional(),
  dateNeeded: z.string().nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
  supplierNotes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
});

const CancelSchema = z.object({
  reason: z.enum([
    'supplier_change', 'plan_change', 'wrong_order',
    'supplier_delay', 'budget_cut', 'duplicate', 'other',
  ]),
  comment: z.string().max(500).optional(),
});

const DeliverySchema = z.object({
  items: z.array(z.object({
    itemId: z.string().min(1),
    quantityReceived: z.number().positive(),
  })).min(1),
});

const LinkInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
});

// ============================================================================
// GET — Single PO
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
): Promise<NextResponse> {
  const { poId } = await segmentData!.params;

  const handler = withAuth(
    async (
      _req: NextRequest,
      _ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const po = await getPO(poId);
        if (!po) {
          return NextResponse.json(
            { success: false, error: 'Purchase order not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: po });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 }
        );
      }
    }
  );
  return handler(request);
}

// ============================================================================
// PATCH — Update / Status actions
// ============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
): Promise<NextResponse> {
  const { poId } = await segmentData!.params;

  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action') ?? 'update';
        const body = await req.json();

        switch (action) {
          case 'approve': {
            await approvePO(ctx, poId);
            return NextResponse.json({ success: true, message: 'PO approved' });
          }

          case 'order': {
            await markOrdered(ctx, poId);
            return NextResponse.json({ success: true, message: 'PO marked as ordered' });
          }

          case 'close': {
            await closePO(ctx, poId);
            return NextResponse.json({ success: true, message: 'PO closed' });
          }

          case 'cancel': {
            const parsed = safeParseBody(CancelSchema, body);
            if (parsed.error) return parsed.error;
            await cancelPO(
              ctx,
              poId,
              parsed.data.reason as POCancellationReason,
              parsed.data.comment
            );
            return NextResponse.json({ success: true, message: 'PO cancelled' });
          }

          case 'record-delivery': {
            const parsed = safeParseBody(DeliverySchema, body);
            if (parsed.error) return parsed.error;
            const result = await recordPODelivery(ctx, poId, parsed.data);
            return NextResponse.json({
              success: true,
              message: 'Delivery recorded',
              data: { newStatus: result.newStatus },
            });
          }

          case 'link-invoice': {
            const parsed = safeParseBody(LinkInvoiceSchema, body);
            if (parsed.error) return parsed.error;
            await linkInvoiceToPO(ctx, poId, parsed.data.invoiceId);
            return NextResponse.json({ success: true, message: 'Invoice linked' });
          }

          case 'duplicate': {
            const result = await duplicatePO(ctx, poId);
            return NextResponse.json(
              { success: true, data: result },
              { status: 201 }
            );
          }

          case 'update':
          default: {
            const parsed = safeParseBody(UpdatePOSchema, body);
            if (parsed.error) return parsed.error;
            await updatePO(ctx, poId, {
              ...parsed.data,
              taxRate: parsed.data.taxRate as POVatRate | undefined,
            });
            return NextResponse.json({ success: true, message: 'PO updated' });
          }
        }
      } catch (error) {
        const message = getErrorMessage(error);
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
// DELETE — Soft delete
// ============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
): Promise<NextResponse> {
  const { poId } = await segmentData!.params;

  const handler = withAuth(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse> => {
      try {
        await deletePO(ctx, poId);
        return NextResponse.json({ success: true, message: 'PO deleted' });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
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
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
