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
import { createAccountingServices } from '@/subapps/accounting/services';
import type { UpdateInvoiceInput } from '@/subapps/accounting/types';

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
        const message = error instanceof Error ? error.message : 'Failed to fetch invoice';
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

        await repository.updateInvoice(id, body);

        return NextResponse.json({
          success: true,
          data: { invoiceId: id, updated: true },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update invoice';
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
        const message = error instanceof Error ? error.message : 'Failed to cancel invoice';
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
