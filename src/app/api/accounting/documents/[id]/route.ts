/**
 * =============================================================================
 * GET + PATCH /api/accounting/documents/[id] — Single Document Operations
 * =============================================================================
 *
 * GET:   Get single document with AI-extracted data
 * PATCH: Confirm or reject extracted data (creates journal entry on confirm)
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/documents/[id]
 * @enterprise ADR-ACC-005 AI Document Processing
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { logFinancialTransition } from '@/lib/auth';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { isoToday } from '@/subapps/accounting/services/repository/firestore-helpers';
import type { AccountCategory, ExpenseCategory } from '@/subapps/accounting/types';

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

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get document',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    const document = await repository.getExpenseDocument(id);
    if (!document) {
      notFound('Document not found');
    }

    return ok(document);
  },
});

// =============================================================================
// PATCH — Confirm/Reject Document
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'standard',
  schema: PatchDocumentSchema,
  fallbackError: 'Failed to update document',
  handler: async ({ auth, body, params }) => {
    const { id } = params;
    const { repository, service } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    const document = await repository.getExpenseDocument(id);
    if (!document) {
      notFound('Document not found');
    }

    if (body.action === 'reject') {
      await repository.updateExpenseDocument(id, {
        status: 'rejected',
        notes: body.notes ?? document.notes,
      });

      await logFinancialTransition(auth, 'invoice', id, document.status ?? 'pending', 'rejected').catch(() => {/* non-blocking */});

      return ok({ documentId: id, status: 'rejected' });
    }

    // ── Confirm flow ─────────────────────────────────────────────────

    const confirmedCategory = body.confirmedCategory ?? document.confirmedCategory ?? 'other_expense';
    const confirmedNetAmount = body.confirmedNetAmount ?? document.extractedData.netAmount ?? 0;
    const confirmedVatAmount = body.confirmedVatAmount ?? document.extractedData.vatAmount ?? 0;
    const confirmedDate = body.confirmedDate ?? document.extractedData.issueDate ?? isoToday();
    const confirmedIssuerName = body.confirmedIssuerName ?? document.extractedData.issuerName ?? null;
    const journalEntry = await service.createJournalEntryFromExpense({
      documentId: id,
      fileName: document.fileName,
      confirmedNetAmount,
      confirmedVatAmount,
      confirmedCategory: confirmedCategory as AccountCategory,
      confirmedDate,
      confirmedIssuerName: confirmedIssuerName ?? null,
      confirmedPaymentMethod: document.extractedData.paymentMethod ?? 'bank_transfer',
      fiscalYear: document.fiscalYear,
    });
    const journalEntryId = journalEntry?.entryId ?? null;

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

    await logFinancialTransition(auth, 'invoice', id, document.status ?? 'pending', 'confirmed', {
      journalEntryId,
    }).catch(() => {/* non-blocking */});

    return ok({
      documentId: id,
      status: 'confirmed',
      journalEntryId,
    });
  },
});
