/**
 * =============================================================================
 * GET + POST /api/accounting/journal — List & Create Journal Entries
 * =============================================================================
 *
 * GET:  One page of journal entries (cursor, ADR-ACC-010 §2.1.1) — filters type, fiscalYear, quarter, contactId
 * POST: Create a new journal entry (income or expense)
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/journal
 * @enterprise ADR-ACC-001 Chart of Accounts
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute, created } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { validatePostingAllowed } from '@/subapps/accounting/services';
import { ENTRY_TYPES } from '@/subapps/accounting/types';
import type { JournalEntryFilters, CreateJournalEntryInput } from '@/subapps/accounting/types';
import {
  optionalEnumParam,
  optionalFiscalYearParam,
  optionalIdParam,
  optionalQuarterParam,
  readListContext,
  readPageRequest,
  respondWithPage,
} from '../_shared/list-request-context';
import { journalEntryOptionalFields } from '../_shared/journal-entry-fields';

const CreateJournalEntrySchema = z.object({
  date: z.string().min(10).max(30),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  netAmount: z.number().positive().max(999_999_999),
  ...journalEntryOptionalFields,
}).passthrough();

// =============================================================================
// GET — List Journal Entries
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list journal entries',
  handler: async ({ req, auth }) => {
    const { repository, searchParams } = readListContext(req, auth);

    const filters: JournalEntryFilters = {
      type: optionalEnumParam(searchParams, 'type', ENTRY_TYPES),
      fiscalYear: optionalFiscalYearParam(searchParams),
      quarter: optionalQuarterParam(searchParams),
      contactId: optionalIdParam(searchParams, 'contactId'),
    };

    return respondWithPage(() => repository.listJournalEntries(filters, readPageRequest(searchParams)));
  },
});

// =============================================================================
// POST — Create Journal Entry
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: CreateJournalEntrySchema,
  fallbackError: 'Failed to create journal entry',
  handler: async ({ auth, body }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Hook 4: Validate posting allowed (Q4 — fiscal period check) ───
    const postingCheck = await validatePostingAllowed(repository, body.date);
    if (!postingCheck.allowed) {
      return NextResponse.json(
        { success: false, error: postingCheck.reason },
        { status: 422 }
      );
    }

    const { id } = await repository.createJournalEntry(body as unknown as CreateJournalEntryInput);

    return created({ entryId: id });
  },
});
