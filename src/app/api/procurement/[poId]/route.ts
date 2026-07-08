/**
 * GET    /api/procurement/[poId] — Get single PO
 * PATCH  /api/procurement/[poId] — Update PO / status transitions
 * DELETE /api/procurement/[poId] — Soft delete PO
 *
 * PATCH actions via ?action= query param:
 *   approve, order, close, cancel, record-delivery, link-invoice, duplicate, update
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-267 §Phase A
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, ok, created, notFound, httpError } from '@/lib/api/define-route';
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
import { UpdatePOSchema } from '../_shared/po-schema';

type PoParams = { poId: string };

// ============================================================================
// SCHEMAS — per-action (not shared; single-use)
// ============================================================================

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

export const GET = defineRoute<z.ZodTypeAny, PoParams>({
  rateLimit: 'standard',
  // 1-arg getErrorMessage default in the original 500 path — preserved verbatim.
  fallbackError: 'Unknown error',
  handler: async ({ params }) => {
    const po = await getPO(params.poId);
    if (!po) return notFound('Purchase order not found');
    return ok(po);
  },
});

// ============================================================================
// PATCH — Update / Status actions (action-switch, all failures → 400)
// ============================================================================

export const PATCH = defineRoute<z.ZodTypeAny, PoParams>({
  rateLimit: 'sensitive',
  handler: async ({ req, auth, params }) => {
    const { poId } = params;
    try {
      const url = new URL(req.url);
      const action = url.searchParams.get('action') ?? 'update';
      const body = await req.json();

      switch (action) {
        case 'approve': {
          await approvePO(auth, poId);
          return NextResponse.json({ success: true, message: 'PO approved' });
        }

        case 'order': {
          await markOrdered(auth, poId);
          return NextResponse.json({ success: true, message: 'PO marked as ordered' });
        }

        case 'close': {
          await closePO(auth, poId);
          return NextResponse.json({ success: true, message: 'PO closed' });
        }

        case 'cancel': {
          const parsed = safeParseBody(CancelSchema, body);
          if (parsed.error) return parsed.error;
          await cancelPO(
            auth,
            poId,
            parsed.data.reason as POCancellationReason,
            parsed.data.comment
          );
          return NextResponse.json({ success: true, message: 'PO cancelled' });
        }

        case 'record-delivery': {
          const parsed = safeParseBody(DeliverySchema, body);
          if (parsed.error) return parsed.error;
          const result = await recordPODelivery(auth, poId, parsed.data);
          return NextResponse.json({
            success: true,
            message: 'Delivery recorded',
            data: { newStatus: result.newStatus },
          });
        }

        case 'link-invoice': {
          const parsed = safeParseBody(LinkInvoiceSchema, body);
          if (parsed.error) return parsed.error;
          await linkInvoiceToPO(auth, poId, parsed.data.invoiceId);
          return NextResponse.json({ success: true, message: 'Invoice linked' });
        }

        case 'duplicate': {
          const result = await duplicatePO(auth, poId);
          return created(result);
        }

        case 'update':
        default: {
          const parsed = safeParseBody(UpdatePOSchema, body);
          if (parsed.error) return parsed.error;
          await updatePO(auth, poId, {
            ...parsed.data,
            taxRate: parsed.data.taxRate as POVatRate | undefined,
          });
          return NextResponse.json({ success: true, message: 'PO updated' });
        }
      }
    } catch (error) {
      httpError(400, getErrorMessage(error));
    }
  },
});

// ============================================================================
// DELETE — Soft delete (failures → 400)
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, PoParams>({
  rateLimit: 'sensitive',
  handler: async ({ auth, params }) => {
    try {
      await deletePO(auth, params.poId);
      return NextResponse.json({ success: true, message: 'PO deleted' });
    } catch (error) {
      httpError(400, getErrorMessage(error));
    }
  },
});
