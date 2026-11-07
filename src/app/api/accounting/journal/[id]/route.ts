/**
 * =============================================================================
 * GET + PATCH /api/accounting/journal/[id] — Single Journal Entry
 * =============================================================================
 *
 * GET:   Fetch a single journal entry by ID (404 if not found)
 * PATCH: Change the TEXT of a posted entry (description / notes) — SAP FB02. Amount, date, category, VAT are
 *        corrected ONLY by reversal + new entry (`POST /journal/[id]/reversal`, ADR-ACC-010 §2.1.1 Φ8).
 *
 * There is NO DELETE: a posted entry is never removed (DATEV / GoBD §146(4) AO · SAP FB08 — storno, not delete).
 * Until 2026-11-07 DELETE removed any manual entry and PATCH rewrote amounts, leaving no trace of the original.
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/journal/[id]
 * @enterprise ADR-ACC-001 Chart of Accounts
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 * @enterprise ADR-ACC-010 §2.1.1 Φάση 8
 */

import 'server-only';

import { z } from 'zod';
import { logAuditEvent } from '@/lib/auth';
import { defineRoute, ok, badRequest, notFound, httpError } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { assertNotSubsystemOwned } from '../../_shared/journal-subsystem-guard';

/** ΜΟΝΟ τα `JOURNAL_EDITABLE_FIELDS` — `strict`: πεδίο ποσού/ημερομηνίας/κατηγορίας ⇒ 400, ποτέ σιωπηλή αγνόηση. */
const UpdateJournalEntrySchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  notes: z.string().max(5000).nullable().optional(),
}).strict();

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
// PATCH — Update the text of a Journal Entry
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

    // ADR-ACC-010 §2.1.1 Φ5: a subsystem entry (depreciation) changes ONLY through its subsystem.
    assertNotSubsystemOwned(existing);

    // Phase 1a: Immutability guard — reversed/reversal entries are locked
    if (existing.status === 'REVERSED') {
      httpError(403, 'Cannot edit a reversed journal entry. It has been superseded by a reversal entry.');
    }
    if (existing.isReversal) {
      httpError(403, 'Cannot edit a reversal journal entry. Reversal entries are immutable.');
    }

    await repository.updateJournalEntry(id, body);

    await logAuditEvent(auth, 'data_updated', id, 'journal_entry', {
      metadata: { reason: `Journal entry text updated: ${Object.keys(body).join(', ')}` },
    }).catch(() => {/* non-blocking */});

    return ok({ entryId: id, updated: true });
  },
});
