/**
 * =============================================================================
 * GET + POST /api/accounting/invoices — List & Create Invoices
 * =============================================================================
 *
 * GET:  List invoices with optional filters (type, paymentStatus, fiscalYear, customerId, projectId)
 * POST: Create a new invoice + auto-generate journal entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/invoices
 * @enterprise ADR-ACC-002 Invoicing System
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, ok, created } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  validatePostingAllowed,
  checkCreditLimit,
  updateCustomerBalance,
} from '@/subapps/accounting/services';
import { getFiscalYearFromDate } from '@/subapps/accounting/services/repository/firestore-helpers';
import type { InvoiceFilters, InvoiceType, CreateInvoiceInput } from '@/subapps/accounting/types';
import { readListContext } from '../_shared/list-request-context';

const VALID_INVOICE_TYPES = [
  'service_invoice', 'sales_invoice', 'retail_receipt',
  'service_receipt', 'credit_invoice', 'service_invoice_eu', 'service_invoice_3rd',
] as const;

const CreateInvoiceSchema = z.object({
  series: z.string().min(1).max(20),
  type: z.enum(VALID_INVOICE_TYPES),
  issueDate: z.string().min(10).max(30),
  dueDate: z.string().max(30).nullable().optional(),
  contactId: z.string().max(128).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  lineItems: z.array(z.record(z.unknown())).optional(),
  notes: z.string().max(5000).nullable().optional(),
}).passthrough();

// =============================================================================
// GET — List Invoices
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list invoices',
  handler: async ({ req, auth }) => {
    const { repository, searchParams } = readListContext(req, auth);

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

    const propertyId = searchParams.get('propertyId');
    if (propertyId) {
      filters.propertyId = propertyId;
    }

    const pageSize = searchParams.get('pageSize');
    const result = await repository.listInvoices(
      filters,
      pageSize ? parseInt(pageSize, 10) : undefined
    );

    return ok(result);
  },
});

// =============================================================================
// POST — Create Invoice
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: CreateInvoiceSchema,
  fallbackError: 'Failed to create invoice',
  handler: async ({ auth, body }) => {
    const { service, repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Hook 1a: Validate posting allowed (Q4 — fiscal period check) ──
    const postingCheck = await validatePostingAllowed(repository, body.issueDate);
    if (!postingCheck.allowed) {
      return NextResponse.json(
        { success: false, error: postingCheck.reason },
        { status: 422 }
      );
    }

    // ── Hook 1b: Credit limit check (Q4 — SAP KNKK pattern) ──────────
    const contactId = body.contactId;
    let creditWarning: string | null = null;
    if (contactId) {
      const balance = await repository.getCustomerBalance(contactId);
      if (balance) {
        const grossAmount = body.lineItems?.reduce(
          (sum: number, li: Record<string, unknown>) =>
            sum + (typeof li.grossAmount === 'number' ? li.grossAmount : 0),
          0
        ) ?? 0;
        const creditCheck = checkCreditLimit(balance, grossAmount);
        if (!creditCheck.allowed) {
          return NextResponse.json(
            { success: false, error: creditCheck.warning },
            { status: 422 }
          );
        }
        creditWarning = creditCheck.warning;
      }
    }

    // Create the invoice
    const { id, number } = await repository.createInvoice(body as unknown as CreateInvoiceInput);

    // Auto-generate journal entry from the new invoice
    const journalEntry = await service.createJournalEntryFromInvoice(id);

    // ── Hook 1c: Update customer balance (Q4 — synchronous, Q6) ───────
    if (contactId) {
      const fiscalYear = getFiscalYearFromDate(body.issueDate);
      await updateCustomerBalance(repository, contactId, fiscalYear);
    }

    return created({
      invoiceId: id,
      number,
      journalEntryId: journalEntry?.entryId ?? null,
      creditWarning,
    });
  },
});
