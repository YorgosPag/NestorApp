/**
 * =============================================================================
 * GET + PATCH + DELETE /api/accounting/invoices/[id] — Single Invoice CRUD
 * =============================================================================
 *
 * GET:    Fetch a single invoice by ID (404 if not found)
 * PATCH:  Update invoice fields
 * DELETE: Cancel invoice (soft delete — fiscal documents must be preserved)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/invoices/[id]
 * @enterprise ADR-ACC-002 Invoicing System
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { UpdateInvoiceInput, MyDataDocumentStatus } from '@/subapps/accounting/types';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// GET — Single Invoice
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const invoice = await repository.getInvoice(id);

        if (!invoice) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: invoice });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to fetch invoice');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PATCH — Update Invoice
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as UpdateInvoiceInput;

        if (!body || Object.keys(body).length === 0) {
          return NextResponse.json(
            { success: false, error: 'No update fields provided' },
            { status: 400 }
          );
        }

        // Verify invoice exists
        const existing = await repository.getInvoice(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        // 🛡️ ADR-249 P0-1: Invoice immutability guard
        // Accepted/sent/cancelled invoices are IMMUTABLE (fiscal law + ΑΑΔΕ submission)
        const IMMUTABLE_STATUSES: ReadonlySet<MyDataDocumentStatus> = new Set([
          'accepted', 'cancelled', 'sent',
        ]);
        const currentStatus = existing.mydata?.status as MyDataDocumentStatus | undefined;
        if (currentStatus && IMMUTABLE_STATUSES.has(currentStatus)) {
          return NextResponse.json(
            { success: false, error: `Cannot edit invoice with myDATA status '${currentStatus}'. Only draft or rejected invoices are editable.` },
            { status: 403 }
          );
        }

        await repository.updateInvoice(id, body);

        return NextResponse.json({
          success: true,
          data: { invoiceId: id, updated: true },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update invoice');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

// =============================================================================
// DELETE — Cancel Invoice (Soft Delete)
// =============================================================================

/**
 * Fiscal documents (invoices) must NEVER be hard-deleted per Greek tax law.
 * Instead, we update the mydata status to 'cancelled'.
 */
async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();

        // Verify invoice exists
        const existing = await repository.getInvoice(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        // 🛡️ ADR-249 P0-1: Prevent double-cancellation (409 Conflict)
        if (existing.mydata?.status === 'cancelled') {
          return NextResponse.json(
            { success: false, error: 'Invoice is already cancelled' },
            { status: 409 }
          );
        }

        // Soft delete: mark as cancelled (fiscal docs are never hard-deleted)
        await repository.updateInvoice(id, {
          mydata: {
            ...existing.mydata,
            status: 'cancelled',
          },
        });

        return NextResponse.json({
          success: true,
          data: { invoiceId: id, cancelled: true },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to cancel invoice');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const DELETE = withStandardRateLimit(handleDelete);
