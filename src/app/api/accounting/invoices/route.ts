/**
 * =============================================================================
 * GET + POST /api/accounting/invoices — List & Create Invoices
 * =============================================================================
 *
 * GET:  List invoices with optional filters (type, paymentStatus, fiscalYear, customerId, projectId)
 * POST: Create a new invoice + auto-generate journal entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/invoices
 * @enterprise ADR-ACC-002 Invoicing System
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  InvoiceFilters,
  InvoiceType,
  CreateInvoiceInput,
} from '@/subapps/accounting/types';

// =============================================================================
// GET — List Invoices
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const filters: InvoiceFilters = {};

        const type = searchParams.get('type');
        if (type) {
          filters.type = type as InvoiceType;
        }

        const paymentStatus = searchParams.get('paymentStatus');
        if (paymentStatus === 'unpaid' || paymentStatus === 'partial' || paymentStatus === 'paid') {
          filters.paymentStatus = paymentStatus;
        }

        const fiscalYear = searchParams.get('fiscalYear');
        if (fiscalYear) {
          filters.fiscalYear = parseInt(fiscalYear, 10);
        }

        const customerId = searchParams.get('customerId');
        if (customerId) {
          filters.customerId = customerId;
        }

        const projectId = searchParams.get('projectId');
        if (projectId) {
          filters.projectId = projectId;
        }

        const pageSize = searchParams.get('pageSize');
        const result = await repository.listInvoices(
          filters,
          pageSize ? parseInt(pageSize, 10) : undefined
        );

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list invoices';
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
// POST — Create Invoice
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { service, repository } = createAccountingServices();
        const body = (await req.json()) as CreateInvoiceInput;

        if (!body.series || !body.type || !body.issueDate) {
          return NextResponse.json(
            { success: false, error: 'series, type, and issueDate are required' },
            { status: 400 }
          );
        }

        // Create the invoice
        const { id, number } = await repository.createInvoice(body);

        // Auto-generate journal entry from the new invoice
        const journalEntry = await service.createJournalEntryFromInvoice(id);

        return NextResponse.json(
          {
            success: true,
            data: {
              invoiceId: id,
              number,
              journalEntryId: journalEntry?.entryId ?? null,
            },
          },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create invoice';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
