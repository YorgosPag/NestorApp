/**
 * =============================================================================
 * GET + POST /api/accounting/journal — List & Create Journal Entries
 * =============================================================================
 *
 * GET:  List journal entries with filters (type, category, fiscalYear, quarter, paymentMethod, contactId)
 * POST: Create a new journal entry (income or expense)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/journal
 * @enterprise ADR-ACC-001 Chart of Accounts
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  JournalEntryFilters,
  CreateJournalEntryInput,
  EntryType,
  AccountCategory,
  FiscalQuarter,
  PaymentMethod,
} from '@/subapps/accounting/types';

// =============================================================================
// GET — List Journal Entries
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

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

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list journal entries';
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
// POST — Create Journal Entry
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as CreateJournalEntryInput;

        if (!body.date || !body.type || !body.category || !body.description) {
          return NextResponse.json(
            { success: false, error: 'date, type, category, and description are required' },
            { status: 400 }
          );
        }

        if (typeof body.netAmount !== 'number' || body.netAmount <= 0) {
          return NextResponse.json(
            { success: false, error: 'netAmount must be a positive number' },
            { status: 400 }
          );
        }

        const { id } = await repository.createJournalEntry(body);

        return NextResponse.json(
          { success: true, data: { entryId: id } },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create journal entry';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
