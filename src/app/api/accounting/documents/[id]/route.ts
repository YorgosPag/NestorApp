/**
 * =============================================================================
 * GET + PATCH /api/accounting/documents/[id] — Single Document Operations
 * =============================================================================
 *
 * GET:   Get single document with AI-extracted data
 * PATCH: Confirm or reject extracted data (creates journal entry on confirm)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/documents/[id]
 * @enterprise ADR-ACC-005 AI Document Processing
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent, logFinancialTransition } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { isoToday, getQuarterFromDate } from '@/subapps/accounting/services/repository/firestore-helpers';
import type { AccountCategory, ExpenseCategory, CreateJournalEntryInput } from '@/subapps/accounting/types';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const PatchDocumentSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  confirmedCategory: z.string().max(100).optional(),
  confirmedNetAmount: z.number().min(0).max(999_999_999).optional(),
  confirmedVatAmount: z.number().min(0).max(999_999_999).optional(),
  confirmedDate: z.string().max(30).optional(),
  confirmedIssuerName: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

// =============================================================================
// GET — Single Expense Document
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

        const document = await repository.getExpenseDocument(id);
        if (!document) {
          return NextResponse.json(
            { success: false, error: 'Document not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: document });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get document');
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
// PATCH — Confirm/Reject Document
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const parsed = safeParseBody(PatchDocumentSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const document = await repository.getExpenseDocument(id);
        if (!document) {
          return NextResponse.json(
            { success: false, error: 'Document not found' },
            { status: 404 }
          );
        }

        if (body.action === 'reject') {
          await repository.updateExpenseDocument(id, {
            status: 'rejected',
            notes: body.notes ?? document.notes,
          });

          await logFinancialTransition(ctx, 'invoice', id, document.status ?? 'pending', 'rejected').catch(() => {/* non-blocking */});

          return NextResponse.json({ success: true, data: { documentId: id, status: 'rejected' } });
        }

        // ── Confirm flow ─────────────────────────────────────────────────

        const confirmedCategory = body.confirmedCategory ?? document.confirmedCategory ?? 'other_expense';
        const confirmedNetAmount = body.confirmedNetAmount ?? document.extractedData.netAmount ?? 0;
        const confirmedVatAmount = body.confirmedVatAmount ?? document.extractedData.vatAmount ?? 0;
        const confirmedDate = body.confirmedDate ?? document.extractedData.issueDate ?? isoToday();
        const confirmedIssuerName = body.confirmedIssuerName ?? document.extractedData.issuerName ?? null;

        // Create journal entry for the confirmed expense
        const vatRate = document.extractedData.vatRate ?? 24;
        const vatAmount = confirmedVatAmount;
        const grossAmount = confirmedNetAmount + vatAmount;
        const quarter = getQuarterFromDate(confirmedDate);

        const journalInput: CreateJournalEntryInput = {
          date: confirmedDate,
          type: 'expense',
          category: confirmedCategory as AccountCategory,
          description: `Παραστατικό: ${document.fileName}${confirmedIssuerName ? ` — ${confirmedIssuerName}` : ''}`,
          netAmount: confirmedNetAmount,
          vatRate,
          vatAmount,
          grossAmount,
          vatDeductible: true,
          paymentMethod: document.extractedData.paymentMethod ?? 'bank_transfer',
          contactId: null,
          contactName: confirmedIssuerName ?? null,
          invoiceId: null,
          mydataCode: 'category2_4',
          e3Code: '585_001',
          fiscalYear: document.fiscalYear,
          quarter,
          notes: `AI Document: ${id}`,
        };

        const { id: journalEntryId } = await repository.createJournalEntry(journalInput);

        // Update document with confirmed data
        await repository.updateExpenseDocument(id, {
          status: 'confirmed',
          confirmedCategory: confirmedCategory as ExpenseCategory,
          confirmedNetAmount,
          confirmedVatAmount,
          confirmedDate,
          confirmedIssuerName: confirmedIssuerName ?? null,
          journalEntryId,
          notes: body.notes ?? document.notes,
        });

        await logFinancialTransition(ctx, 'invoice', id, document.status ?? 'pending', 'confirmed', {
          journalEntryId,
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({
          success: true,
          data: {
            documentId: id,
            status: 'confirmed',
            journalEntryId,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update document');
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
