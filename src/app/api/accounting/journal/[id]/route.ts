/**
 * =============================================================================
 * GET + PATCH + DELETE /api/accounting/journal/[id] — Single Journal Entry CRUD
 * =============================================================================
 *
 * GET:    Fetch a single journal entry by ID (404 if not found)
 * PATCH:  Update journal entry fields
 * DELETE: Delete journal entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/journal/[id]
 * @enterprise ADR-ACC-001 Chart of Accounts
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { logAuditEvent, logEntityDeletion } from '@/lib/auth';
import { defineRoute, ok, badRequest, notFound, httpError } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { UpdateJournalEntryInput } from '@/subapps/accounting/types';
import { journalEntryOptionalFields } from '../../_shared/journal-entry-fields';

const UpdateJournalEntrySchema = z.object({
  date: z.string().max(30).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  netAmount: z.number().min(0).max(999_999_999).optional(),
  ...journalEntryOptionalFields,
}).passthrough();

// =============================================================================
// GET — Single Journal Entry
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to fetch journal entry',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const entry = await repository.getJournalEntry(id);

    if (!entry) {
      notFound('Journal entry not found');
    }

    return ok(entry);
  },
});

// =============================================================================
// PATCH — Update Journal Entry
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'standard',
  schema: UpdateJournalEntrySchema,
  fallbackError: 'Failed to update journal entry',
  handler: async ({ auth, body, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    if (Object.keys(body).length === 0) {
      badRequest('No update fields provided');
    }

    // Verify entry exists
    const existing = await repository.getJournalEntry(id);
    if (!existing) {
      notFound('Journal entry not found');
    }

    // Phase 1a: Immutability guard — reversed/reversal entries are locked
    if (existing.status === 'REVERSED') {
      httpError(403, 'Cannot edit a reversed journal entry. It has been superseded by a reversal entry.');
    }
    if (existing.isReversal) {
      httpError(403, 'Cannot edit a reversal journal entry. Reversal entries are immutable.');
    }

    await repository.updateJournalEntry(id, body as UpdateJournalEntryInput);

    await logAuditEvent(auth, 'data_updated', id, 'journal_entry', {
      metadata: { reason: 'Journal entry updated' },
    }).catch(() => {/* non-blocking */});

    return ok({ entryId: id, updated: true });
  },
});

// =============================================================================
// DELETE — Delete Journal Entry
// =============================================================================

export const DELETE = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to delete journal entry',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // Verify entry exists
    const existing = await repository.getJournalEntry(id);
    if (!existing) {
      notFound('Journal entry not found');
    }

    // Phase 1a: Immutability guard — reversed/reversal entries cannot be deleted
    if (existing.status === 'REVERSED' || existing.isReversal) {
      httpError(403, 'Cannot delete reversed or reversal journal entries. They form an immutable audit trail.');
    }

    await logEntityDeletion(auth, 'journal_entry', id, {
      type: existing.type ?? 'unknown',
      category: existing.category ?? 'unknown',
    }).catch(() => {/* non-blocking */});

    await repository.deleteJournalEntry(id);

    return ok({ entryId: id, deleted: true });
  },
});
