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
import { withAuth, logAuditEvent, logFinancialTransition } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  reverseJournalEntryForCancelledInvoice,
  createCreditNoteForInvoice,
} from '@/subapps/accounting/services/reversal-service';
import { updateCustomerBalance } from '@/subapps/accounting/services';
import { getFiscalYearFromDate } from '@/subapps/accounting/services/repository/firestore-helpers';
import type { MyDataDocumentStatus, UpdateInvoiceInput, CancellationReasonCode } from '@/subapps/accounting/types';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody, safeJsonBody } from '@/lib/validation/shared-schemas';
import {
  UpdateInvoiceSchema,
  CancelInvoiceSchema,
  IMMUTABLE_STATUSES,
  VOIDABLE_STATUSES,
  CREDIT_NOTE_STATUSES,
} from '../invoice-schemas';

// =============================================================================
// GET — Single Invoice
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
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
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const parsed = safeParseBody(UpdateInvoiceSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        if (Object.keys(body).length === 0) {
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
        const currentStatus = existing.mydata?.status as MyDataDocumentStatus | undefined;
        if (currentStatus && IMMUTABLE_STATUSES.has(currentStatus)) {
          return NextResponse.json(
            { success: false, error: `Cannot edit invoice with myDATA status '${currentStatus}'. Only draft or rejected invoices are editable.` },
            { status: 403 }
          );
        }

        await repository.updateInvoice(id, body as UpdateInvoiceInput);

        // ── Hook 3: Update balance if payments/amounts changed (Q4 — sync) ─
        const affectsBalance = !!(body.payments || body.lineItems);
        const contactId = existing.customer?.contactId;
        if (affectsBalance && contactId) {
          const fiscalYear = getFiscalYearFromDate(existing.issueDate);
          await updateCustomerBalance(repository, contactId, fiscalYear);
        }

        await logAuditEvent(ctx, 'data_updated', id, 'invoice', {
          metadata: { reason: 'Invoice fields updated' },
        }).catch(() => {/* non-blocking */});

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
// DELETE — Cancel Invoice (Void or Credit Note)
// =============================================================================

/**
 * Fiscal documents (invoices) must NEVER be hard-deleted per Greek tax law.
 *
 * Phase 1a routing (AUDIT A-1, ελληνική νομοθεσία):
 * - Draft/Rejected → VOID: soft-delete + journal reversal
 * - Sent/Accepted  → CREDIT NOTE: new credit_invoice + journal reversal
 * - Cancelled       → 409 Conflict
 */

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

        // Parse cancellation reason from body
        const parsed = await safeJsonBody(CancelInvoiceSchema, req);
        if (parsed.error) return parsed.error;
        const { reasonCode, notes } = parsed.data;

        const existing = await repository.getInvoice(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        if (existing.mydata?.status === 'cancelled') {
          return NextResponse.json(
            { success: false, error: 'Invoice is already cancelled' },
            { status: 409 }
          );
        }

        const currentStatus = existing.mydata?.status ?? 'draft';
        const reasonNotes = notes.trim() || null;

        // ── Path A: Draft/Rejected → VOID ─────────────────────────────
        if (VOIDABLE_STATUSES.has(currentStatus)) {
          await repository.updateInvoice(id, {
            mydata: { ...existing.mydata, status: 'cancelled' },
            cancellationReason: reasonCode as CancellationReasonCode,
            cancellationNotes: reasonNotes ?? undefined,
          });

          const reversal = await reverseJournalEntryForCancelledInvoice(
            repository, id, ctx.uid, reasonCode as CancellationReasonCode, reasonNotes
          );

          // ── Hook 2: Update balance after void (Q4 — synchronous) ────────
          const voidContactId = existing.customer?.contactId;
          if (voidContactId) {
            const fiscalYear = getFiscalYearFromDate(existing.issueDate);
            await updateCustomerBalance(repository, voidContactId, fiscalYear);
          }

          await logFinancialTransition(ctx, 'invoice', id, currentStatus, 'cancelled').catch(() => {/* non-blocking */});

          return NextResponse.json({
            success: true,
            data: {
              invoiceId: id,
              action: 'voided',
              cancelled: true,
              reversalEntryId: reversal?.reversalEntryId ?? null,
            },
          });
        }

        // ── Path B: Sent/Accepted → CREDIT NOTE ──────────────────────
        if (CREDIT_NOTE_STATUSES.has(currentStatus)) {
          const result = await createCreditNoteForInvoice(
            repository, existing, ctx.uid, reasonCode as CancellationReasonCode, reasonNotes
          );

          // ── Hook 2: Update balance after credit note (Q4 — synchronous) ─
          const cnContactId = existing.customer?.contactId;
          if (cnContactId) {
            const fiscalYear = getFiscalYearFromDate(existing.issueDate);
            await updateCustomerBalance(repository, cnContactId, fiscalYear);
          }

          await logFinancialTransition(ctx, 'invoice', id, currentStatus, 'credit_note_issued').catch(() => {/* non-blocking */});

          return NextResponse.json({
            success: true,
            data: {
              invoiceId: id,
              action: 'credit_note_issued',
              creditNoteId: result.creditNoteId,
              creditNoteNumber: result.creditNoteNumber,
              reversalEntryId: result.reversalEntryId,
            },
          });
        }

        // ── Unknown status → reject ──────────────────────────────────
        return NextResponse.json(
          { success: false, error: `Cannot cancel invoice with status '${currentStatus}'` },
          { status: 400 }
        );
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
