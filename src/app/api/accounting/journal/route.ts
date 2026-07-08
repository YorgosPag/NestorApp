/**
 * =============================================================================
 * GET + POST /api/accounting/journal — List & Create Journal Entries
 * =============================================================================
 *
 * GET:  List journal entries with filters (type, category, fiscalYear, quarter, paymentMethod, contactId)
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
import { defineRoute, ok, created } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { validatePostingAllowed } from '@/subapps/accounting/services';
import type {
  JournalEntryFilters,
  EntryType,
  AccountCategory,
  FiscalQuarter,
  PaymentMethod,
  CreateJournalEntryInput,
} from '@/subapps/accounting/types';
import { readListContext } from '../_shared/list-request-context';
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

    const filters: JournalEntryFilters = {};

    const type = searchParams.get('type');
    if (type === 'income' || type === 'expense') {
      filters.type = type as EntryType;
    }

    const category = searchParams.get('category');
    if (category) {
      filters.category = category as AccountCategory;
    }

    const fiscalYear = searchParams.get('fiscalYear');
    if (fiscalYear) {
      filters.fiscalYear = parseInt(fiscalYear, 10);
    }

    const quarter = searchParams.get('quarter');
    if (quarter) {
      const q = parseInt(quarter, 10);
      if (q >= 1 && q <= 4) {
        filters.quarter = q as FiscalQuarter;
      }
    }

    const paymentMethod = searchParams.get('paymentMethod');
    if (paymentMethod) {
      filters.paymentMethod = paymentMethod as PaymentMethod;
    }

    const contactId = searchParams.get('contactId');
    if (contactId) {
      filters.contactId = contactId;
    }

    const pageSize = searchParams.get('pageSize');
    const result = await repository.listJournalEntries(
      filters,
      pageSize ? parseInt(pageSize, 10) : undefined
    );

    return ok(result);
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
