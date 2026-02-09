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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services';
import type {
  BankTransactionFilters,
  BankTransaction,
  TransactionDirection,
  MatchStatus,
} from '@/subapps/accounting/types';

// =============================================================================
// GET — List Bank Transactions
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
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
        const message = error instanceof Error ? error.message : 'Failed to list bank transactions';
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
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as Omit<
          BankTransaction,
          'transactionId' | 'createdAt' | 'updatedAt'
        >;

        if (!body.accountId || !body.valueDate || !body.direction) {
          return NextResponse.json(
            { success: false, error: 'accountId, valueDate, and direction are required' },
            { status: 400 }
          );
        }

        if (typeof body.amount !== 'number' || body.amount <= 0) {
          return NextResponse.json(
            { success: false, error: 'amount must be a positive number' },
            { status: 400 }
          );
        }

        const { id } = await repository.createBankTransaction(body);

        return NextResponse.json(
          { success: true, data: { transactionId: id } },
          { status: 201 }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create bank transaction';
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
