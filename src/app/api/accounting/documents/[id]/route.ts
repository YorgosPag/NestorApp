/**
 * =============================================================================
 * GET + PATCH /api/accounting/documents/[id] — Single Document Operations
 * =============================================================================
 *
 * GET:   Get single document with AI-extracted data
 * PATCH: Confirm or reject extracted data (creates journal entry on confirm)
 *        Confirm = ONE idempotent transaction (`confirmExpenseDocument`, ADR-917 Φ4.0): only `review` is
 *        confirmable, a replay answers with the SAME journal entry, a missing figure is 422 — never 0 €.
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
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { defineRoute, ok, notFound, conflict } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { validatePostingAllowed } from '@/subapps/accounting/services';
import { resolveExpenseConfirmation } from '@/subapps/accounting/services/expense-confirmation-input';
import { confirmExpenseDocument } from '@/subapps/accounting/services/expense-confirmation.server';
import { assertPostingAllowed } from '../../_shared/fiscal-period-errors';
import { requireExpenseDocument } from '../../_shared/expense-document-access';

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
    const { document } = await requireExpenseDocument(auth, params.id);
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
    const { repository, document } = await requireExpenseDocument(auth, id);

    if (body.action === 'reject') {
      // A confirmed document has POSTED its journal entry — «rejected» would hide a cost the books still carry.
      if (document.status === 'confirmed') conflict('Confirmed document cannot be rejected', { status: document.status });
      // Allocated lines are linked to POs (projection) — clearing them is the allocation writer's job, first.
      if ((document.costAllocations ?? []).length > 0) {
        throw new ApiError(409, 'Clear the cost allocation before rejecting', 'EXPENSE_HAS_ALLOCATIONS');
      }
      await repository.updateExpenseDocument(id, {
        status: 'rejected',
        notes: body.notes ?? document.notes,
      });

      await logFinancialTransition(auth, 'invoice', id, document.status ?? 'pending', 'rejected').catch(() => {/* non-blocking */});

      return ok({ documentId: id, status: 'rejected' });
    }

    // ── Confirm flow ─────────────────────────────────────────────────

    const resolution = resolveExpenseConfirmation(document, body);
    if (!resolution.ok) {
      throw new ApiError(422, 'Expense confirmation is missing figures', 'EXPENSE_CONFIRMATION_INCOMPLETE', {
        missing: [...resolution.missing],
      });
    }
    assertPostingAllowed(await validatePostingAllowed(repository, resolution.confirmation.date));

    const tenant = { companyId: auth.companyId, userId: auth.uid };
    const outcome = await confirmExpenseDocument(getAdminFirestore(), tenant, id, resolution.confirmation);
    if (outcome.kind === 'not_found') notFound('Document not found');
    if (outcome.kind === 'not_reviewable') conflict('Document is not awaiting review', { status: outcome.status });
    if (outcome.kind === 'allocation_exceeds_net') {
      throw new ApiError(409, 'Cost allocation exceeds the confirmed net amount', 'EXPENSE_ALLOCATION_EXCEEDS_NET', {
        allocated: outcome.allocated,
      });
    }

    const journalEntryId = outcome.journalEntryId;
    if (outcome.kind === 'confirmed') {
      await logFinancialTransition(auth, 'invoice', id, outcome.previousStatus, 'confirmed', {
        journalEntryId,
      }).catch(() => {/* non-blocking */});
    }

    return ok({
      documentId: id,
      status: 'confirmed',
      journalEntryId,
    });
  },
});
