/**
 * =============================================================================
 * GET + POST /api/accounting/bank/transactions — List & Create Bank Transactions
 * =============================================================================
 *
 * GET:  List bank transactions with filters (accountId, direction, matchStatus)
 * POST: Create a new bank transaction manually
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/transactions
 * @enterprise ADR-ACC-008 Bank Reconciliation
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  BankTransactionFilters,
  BankTransaction,
  TransactionDirection,
  MatchStatus,
} from '@/subapps/accounting/types';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

// ── Zod Schema (Q5 — SAP BAPI / Stripe pattern) ──────────────────────────

const CreateBankTransactionSchema = z.object({
  accountId: z.string().min(1).max(128),
  valueDate: z.string().min(10).max(30),
  direction: z.enum(['credit', 'debit']),
  amount: z.number().positive().max(999_999_999),
  currency: z.string().length(3).default('EUR'),
  bankDescription: z.string().max(500).optional(),
  counterparty: z.string().max(200).nullable().optional(),
  paymentReference: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).passthrough();

// =============================================================================
// GET — List Bank Transactions
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const { searchParams } = new URL(req.url);

        const filters: BankTransactionFilters = {};

        const accountId = searchParams.get('accountId');
        if (accountId) {
          filters.accountId = accountId;
        }

        const direction = searchParams.get('direction');
        if (direction === 'credit' || direction === 'debit') {
          filters.direction = direction as TransactionDirection;
        }

        const matchStatus = searchParams.get('matchStatus');
        if (matchStatus) {
          filters.matchStatus = matchStatus as MatchStatus;
        }

        const pageSize = searchParams.get('pageSize');
        const result = await repository.listBankTransactions(
          filters,
          pageSize ? parseInt(pageSize, 10) : undefined
        );

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list bank transactions');
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
// POST — Create Bank Transaction
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });
        const parsed = safeParseBody(CreateBankTransactionSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const { id } = await repository.createBankTransaction(
          body as unknown as Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>
        );

        return NextResponse.json(
          { success: true, data: { transactionId: id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create bank transaction');
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
