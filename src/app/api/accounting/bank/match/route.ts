/**
 * =============================================================================
 * POST /api/accounting/bank/match — Enterprise Bank Transaction Matching
 * =============================================================================
 *
 * Supports both 1:1 and N:M matching via MatchingEngine.
 * Enterprise validations: Zod, fiscal period, amount re-verification,
 * duplicate prevention, optimistic locking, direction matching (Q1-Q9).
 *
 * @module api/accounting/bank/match
 * @see AUDIT-2026-03-29.md Q1-Q9
 * @compliance SAP/Xero/Sage bank reconciliation patterns
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { validatePostingAllowed } from '@/subapps/accounting/services/fiscal-period-service';
import { logAccountingEvent } from '@/subapps/accounting/services/accounting-audit-service';
import {
  MatchRequestSchema,
  type SingleMatchInput,
  type GroupMatchInput,
  validateDirection,
  isWithinTolerance,
  DEFAULT_AMOUNT_TOLERANCE,
} from '@/subapps/accounting/services/bank/bank-match-validation';
import {
  createBankMatchError,
  type BankMatchProblem,
} from '@/subapps/accounting/services/bank/bank-match-errors';

// =============================================================================
// HELPERS
// =============================================================================

function problemResponse(problem: BankMatchProblem): NextResponse {
  return NextResponse.json(
    { success: false, error: problem },
    { status: problem.status }
  );
}

// =============================================================================
// POST — Match
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const { matchingEngine, repository } = createAccountingServices();

      // ── Parse & Validate ────────────────────────────────────────────
      const body = await req.json();
      const parsed = safeParseBody(MatchRequestSchema, body);
      if (parsed.error) return parsed.error;
      const data = parsed.data;

      // ── N:M group match ─────────────────────────────────────────────
      if ('transactionIds' in data) {
        return handleGroupMatch(data, ctx, repository, matchingEngine);
      }

      // ── 1:1 match ──────────────────────────────────────────────────
      return handleSingleMatch(data, ctx, repository, matchingEngine);
    }
  );

  return handler(request);
}

// =============================================================================
// 1:1 MATCH HANDLER
// =============================================================================

async function handleSingleMatch(
  data: SingleMatchInput,
  ctx: AuthContext,
  repository: ReturnType<typeof createAccountingServices>['repository'],
  matchingEngine: ReturnType<typeof createAccountingServices>['matchingEngine']
): Promise<NextResponse> {
  // 1. Fetch transaction from Firestore (server-side re-verification Q2)
  const transaction = await repository.getBankTransaction(data.transactionId);
  if (!transaction) {
    return problemResponse(
      createBankMatchError('TRANSACTION_NOT_FOUND',
        `Η συναλλαγή ${data.transactionId} δεν βρέθηκε`, 404)
    );
  }

  // 2. Optimistic locking check (Q7)
  if (data.expectedVersion !== undefined && transaction.version !== undefined) {
    if (transaction.version !== data.expectedVersion) {
      return problemResponse(
        createBankMatchError('VERSION_CONFLICT',
          'Η συναλλαγή τροποποιήθηκε από άλλον χρήστη. Ανανεώστε τη σελίδα.',
          409,
          {
            currentVersion: transaction.version,
            expectedVersion: data.expectedVersion,
            lastModifiedBy: transaction.matchedByName ?? null,
          })
      );
    }
  }

  // 3. Already-matched hard block (Q3)
  if (transaction.matchStatus === 'auto_matched' ||
      transaction.matchStatus === 'manual_matched' ||
      transaction.matchStatus === 'reconciled') {
    return problemResponse(
      createBankMatchError('ALREADY_MATCHED',
        `Η συναλλαγή είναι ήδη σε κατάσταση "${transaction.matchStatus}". Κάντε πρώτα unmatch.`,
        409,
        { currentStatus: transaction.matchStatus })
    );
  }

  // 4. Direction validation (Q9)
  const dirCheck = validateDirection(transaction.direction, data.entityType);
  if (!dirCheck.valid) {
    return problemResponse(
      createBankMatchError('DIRECTION_MISMATCH',
        dirCheck.reason ?? 'Direction mismatch', 400,
        { direction: transaction.direction, entityType: data.entityType })
    );
  }

  // 5. Server-side amount re-verification (Q2)
  if (data.clientAmount !== undefined) {
    if (!isWithinTolerance(transaction.amount, data.clientAmount, DEFAULT_AMOUNT_TOLERANCE)) {
      return problemResponse(
        createBankMatchError('AMOUNT_MISMATCH',
          `Το ποσό στον server (€${transaction.amount.toFixed(2)}) διαφέρει από το client (€${data.clientAmount.toFixed(2)}) πάνω από ±€${DEFAULT_AMOUNT_TOLERANCE}`,
          409,
          {
            serverAmount: transaction.amount,
            clientAmount: data.clientAmount,
            tolerance: DEFAULT_AMOUNT_TOLERANCE,
          })
      );
    }
  }

  // 6. Fiscal period check (Q6)
  const periodCheck = await validatePostingAllowed(repository, transaction.transactionDate);
  if (!periodCheck.allowed) {
    const code = periodCheck.periodStatus === 'LOCKED' ? 'PERIOD_LOCKED' as const
      : periodCheck.periodStatus === 'CLOSED' ? 'PERIOD_CLOSED' as const
      : 'PERIOD_NOT_FOUND' as const;
    return problemResponse(
      createBankMatchError(code,
        periodCheck.reason ?? 'Η λογιστική περίοδος δεν επιτρέπει αλλαγές',
        403,
        { periodId: periodCheck.periodId, periodStatus: periodCheck.periodStatus })
    );
  }

  // 7. Execute match via engine
  const result = await matchingEngine.matchTransaction(
    data.transactionId,
    data.entityId,
    data.entityType
  );

  // 8. Update version + matchedByName (Q7)
  const newVersion = (transaction.version ?? 0) + 1;
  await repository.updateBankTransaction(data.transactionId, {
    version: newVersion,
    matchedByName: ctx.email,
  });

  // 9. Audit log (Q5)
  await logAccountingEvent(repository, {
    eventType: 'BANK_MATCHED',
    entityType: 'bank_transaction',
    entityId: data.transactionId,
    userId: ctx.uid,
    details: `Match: ${data.transactionId} → ${data.entityType}:${data.entityId}`,
    metadata: {
      entityId: data.entityId,
      entityType: data.entityType,
      confidence: result.confidence ?? 0,
      periodId: periodCheck.periodId ?? '',
      beforeStatus: transaction.matchStatus,
      afterStatus: result.status,
    },
  });

  return NextResponse.json({ success: true, data: { ...result, version: newVersion } });
}

// =============================================================================
// N:M GROUP MATCH HANDLER
// =============================================================================

async function handleGroupMatch(
  data: GroupMatchInput,
  ctx: AuthContext,
  repository: ReturnType<typeof createAccountingServices>['repository'],
  matchingEngine: ReturnType<typeof createAccountingServices>['matchingEngine']
): Promise<NextResponse> {
  // 1. Verify all transactions exist and are unmatched
  for (const txnId of data.transactionIds) {
    const txn = await repository.getBankTransaction(txnId);
    if (!txn) {
      return problemResponse(
        createBankMatchError('TRANSACTION_NOT_FOUND',
          `Η συναλλαγή ${txnId} δεν βρέθηκε`, 404)
      );
    }

    // Already-matched hard block (Q3)
    if (txn.matchStatus !== 'unmatched' && txn.matchStatus !== 'excluded') {
      return problemResponse(
        createBankMatchError('ALREADY_MATCHED',
          `Η συναλλαγή ${txnId} είναι ήδη "${txn.matchStatus}". Κάντε unmatch πρώτα.`,
          409,
          { transactionId: txnId, currentStatus: txn.matchStatus })
      );
    }

    // Optimistic locking (Q7)
    if (data.expectedVersion !== undefined && txn.version !== undefined) {
      if (txn.version !== data.expectedVersion) {
        return problemResponse(
          createBankMatchError('VERSION_CONFLICT',
            `Η συναλλαγή ${txnId} τροποποιήθηκε. Ανανεώστε τη σελίδα.`,
            409,
            { transactionId: txnId, currentVersion: txn.version })
        );
      }
    }

    // Fiscal period check (Q6)
    const periodCheck = await validatePostingAllowed(repository, txn.transactionDate);
    if (!periodCheck.allowed) {
      return problemResponse(
        createBankMatchError(
          periodCheck.periodStatus === 'LOCKED' ? 'PERIOD_LOCKED' : 'PERIOD_CLOSED',
          `${periodCheck.reason} (συναλλαγή: ${txnId})`,
          403,
          { transactionId: txnId, periodId: periodCheck.periodId })
      );
    }
  }

  // 2. Execute group match
  const results = await matchingEngine.matchGroup(
    data.transactionIds,
    data.entityRefs
  );

  // 3. Update version + matchedByName for all transactions
  for (const txnId of data.transactionIds) {
    const txn = await repository.getBankTransaction(txnId);
    const newVersion = ((txn?.version) ?? 0) + 1;
    await repository.updateBankTransaction(txnId, {
      version: newVersion,
      matchedByName: ctx.email,
    });
  }

  // 4. Audit log
  await logAccountingEvent(repository, {
    eventType: 'BANK_MATCHED',
    entityType: 'bank_transaction',
    entityId: data.transactionIds.join(','),
    userId: ctx.uid,
    details: `Group match: ${data.transactionIds.length} transactions → ${data.entityRefs.length} entities`,
    metadata: {
      transactionCount: data.transactionIds.length,
      entityCount: data.entityRefs.length,
    },
  });

  return NextResponse.json({ success: true, data: results });
}

export const POST = withStandardRateLimit(handlePost);
