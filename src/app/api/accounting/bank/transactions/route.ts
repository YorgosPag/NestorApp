/**
 * =============================================================================
 * GET + POST /api/accounting/bank/transactions — List & Create Bank Transactions
 * =============================================================================
 *
 * GET:  List bank transactions with filters (accountId, direction, matchStatus)
 * POST: Create a new bank transaction manually
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/bank/transactions
 * @enterprise ADR-ACC-008 Bank Reconciliation
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type {
  BankTransactionFilters,
  BankTransaction,
  TransactionDirection,
  MatchStatus,
} from '@/subapps/accounting/types';
import { readListContext } from '../../_shared/list-request-context';

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

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list bank transactions',
  handler: async ({ req, auth }) => {
    const { repository, searchParams } = readListContext(req, auth);

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

    return ok(result);
  },
});

// =============================================================================
// POST — Create Bank Transaction
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: CreateBankTransactionSchema,
  fallbackError: 'Failed to create bank transaction',
  handler: async ({ auth, body }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    const { id } = await repository.createBankTransaction(
      body as unknown as Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>
    );

    return created({ transactionId: id });
  },
});
