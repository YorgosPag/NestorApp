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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices, isoToday, getQuarterFromDate } from '@/subapps/accounting/services';
import type { ExpenseCategory, CreateJournalEntryInput } from '@/subapps/accounting/types';

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
        const message = error instanceof Error ? error.message : 'Failed to get document';
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

interface PatchDocumentBody {
  action: 'confirm' | 'reject';
  confirmedCategory?: ExpenseCategory;
  confirmedNetAmount?: number;
  confirmedVatAmount?: number;
  confirmedDate?: string;
  confirmedIssuerName?: string;
  notes?: string;
}

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as PatchDocumentBody;

        if (!body.action || (body.action !== 'confirm' && body.action !== 'reject')) {
          return NextResponse.json(
            { success: false, error: 'action must be "confirm" or "reject"' },
            { status: 400 }
          );
        }

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
          category: confirmedCategory,
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
          confirmedCategory,
          confirmedNetAmount,
          confirmedVatAmount,
          confirmedDate,
          confirmedIssuerName: confirmedIssuerName ?? null,
          journalEntryId,
          notes: body.notes ?? document.notes,
        });

        return NextResponse.json({
          success: true,
          data: {
            documentId: id,
            status: 'confirmed',
            journalEntryId,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update document';
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
