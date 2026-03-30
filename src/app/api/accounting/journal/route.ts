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

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
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
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateJournalEntrySchema = z.object({
  date: z.string().min(10).max(30),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  netAmount: z.number().positive().max(999_999_999),
  vatRate: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).max(999_999_999).optional(),
  grossAmount: z.number().min(0).max(999_999_999).optional(),
  vatDeductible: z.boolean().optional(),
  paymentMethod: z.string().max(50).optional(),
  contactId: z.string().max(128).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  invoiceId: z.string().max(128).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).passthrough();

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
        const message = getErrorMessage(error, 'Failed to list journal entries');
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
        const parsed = safeParseBody(CreateJournalEntrySchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        // ── Hook 4: Validate posting allowed (Q4 — fiscal period check) ───
        const postingCheck = await validatePostingAllowed(repository, body.date);
        if (!postingCheck.allowed) {
          return NextResponse.json(
            { success: false, error: postingCheck.reason },
            { status: 422 }
          );
        }

        const { id } = await repository.createJournalEntry(body as unknown as CreateJournalEntryInput);

        return NextResponse.json(
          { success: true, data: { entryId: id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create journal entry');
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
