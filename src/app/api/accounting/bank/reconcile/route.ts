/**
 * =============================================================================
 * POST /api/accounting/bank/reconcile — Reconcile Matched Transactions
 * PATCH /api/accounting/bank/reconcile — Admin Unlock Reconciled Transaction
 * =============================================================================
 *
 * POST: Reconcile a matched transaction (matched → reconciled)
 * PATCH: Admin-only unlock with mandatory reason (reconciled → matched)
 *
 * Segregation of duties: matchedBy !== reconciledBy (except super_admin)
 *
 * @module api/accounting/bank/reconcile
 * @see AUDIT-2026-03-29.md Q1 (reconciled), Q4 (admin unlock), Q8 (segregation)
 * @compliance SAP/Oracle reconciliation patterns
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { defineRoute, ok } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { logAccountingEvent } from '@/subapps/accounting/services/accounting-audit-service';
import {
  ReconcileSchema,
  AdminUnlockSchema,
} from '@/subapps/accounting/services/bank/bank-match-validation';
import {
  createBankMatchError,
  type BankMatchProblem,
} from '@/subapps/accounting/services/bank/bank-match-errors';
import { nowISO } from '@/lib/date-local';

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
// POST — Reconcile (matched → reconciled)
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: ReconcileSchema,
  fallbackError: 'Failed to reconcile transaction',
  handler: async ({ auth, body }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const { transactionId, expectedVersion } = body;

    // ── Fetch transaction ─────────────────────────────────────────
    const txn = await repository.getBankTransaction(transactionId);
    if (!txn) {
      return problemResponse(
        createBankMatchError('TRANSACTION_NOT_FOUND',
          `Transaction ${transactionId} not found`, 404)
      );
    }

    // ── Must be matched (not unmatched, not already reconciled) ──
    if (txn.matchStatus === 'unmatched' || txn.matchStatus === 'excluded') {
      return problemResponse(
        createBankMatchError('NOT_MATCHED',
          'Transaction is not matched. Match it first.',
          400,
          { currentStatus: txn.matchStatus })
      );
    }

    if (txn.matchStatus === 'reconciled') {
      return problemResponse(
        createBankMatchError('ALREADY_RECONCILED',
          'Transaction is already reconciled.',
          409,
          { reconciledBy: txn.reconciledByName ?? null, reconciledAt: txn.reconciledAt ?? null })
      );
    }

    // ── Optimistic locking (Q7) ──────────────────────────────────
    if (expectedVersion !== undefined && txn.version !== undefined) {
      if (txn.version !== expectedVersion) {
        return problemResponse(
          createBankMatchError('VERSION_CONFLICT',
            'Transaction was modified. Please refresh the page.',
            409,
            {
              currentVersion: txn.version,
              expectedVersion,
              lastModifiedBy: txn.matchedByName ?? null,
            })
        );
      }
    }

    // ── Segregation of duties (Q8) ──────────────────────────────
    // matchedBy !== reconciledBy, EXCEPT super_admin
    if (auth.globalRole !== 'super_admin') {
      // Check who matched this transaction
      // matchedByName stores the email of the matcher
      if (txn.matchedByName === auth.email) {
        return problemResponse(
          createBankMatchError('SEGREGATION_VIOLATION',
            'Cannot reconcile a transaction you matched yourself. Ask another user.',
            403,
            { matchedBy: txn.matchedByName })
        );
      }
    }

    // ── Update to reconciled ─────────────────────────────────────
    const newVersion = (txn.version ?? 0) + 1;
    const now = nowISO();

    await repository.updateBankTransaction(transactionId, {
      matchStatus: 'reconciled',
      reconciledBy: auth.uid,
      reconciledAt: now,
      reconciledByName: auth.email,
      version: newVersion,
    });

    // ── Audit log ───────────────────────────────────────────────
    await logAccountingEvent(repository, {
      eventType: 'BANK_RECONCILED',
      entityType: 'bank_transaction',
      entityId: transactionId,
      userId: auth.uid,
      details: `Reconciled: ${transactionId} (was ${txn.matchStatus})`,
      metadata: {
        beforeStatus: txn.matchStatus,
        afterStatus: 'reconciled',
        matchedEntityId: txn.matchedEntityId ?? '',
        matchedEntityType: txn.matchedEntityType ?? '',
      },
    });

    return ok({
      transactionId,
      status: 'reconciled' as const,
      reconciledBy: auth.uid,
      reconciledAt: now,
      version: newVersion,
    });
  },
});

// =============================================================================
// PATCH — Admin Unlock (reconciled → matched)
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to unlock transaction',
  handler: async ({ req, auth }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Admin-only ────────────────────────────────────────────────
    if (auth.globalRole !== 'super_admin' && auth.globalRole !== 'company_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admin can unlock reconciled transactions' },
        { status: 403 }
      );
    }

    // ── Parse ─────────────────────────────────────────────────────
    const rawBody = await req.json();
    const parsed = safeParseBody(AdminUnlockSchema, rawBody);
    if (parsed.error) return parsed.error;
    const { transactionId, reason } = parsed.data;

    // ── Fetch transaction ─────────────────────────────────────────
    const txn = await repository.getBankTransaction(transactionId);
    if (!txn) {
      return problemResponse(
        createBankMatchError('TRANSACTION_NOT_FOUND',
          `Transaction ${transactionId} not found`, 404)
      );
    }

    // ── Must be reconciled ────────────────────────────────────────
    if (txn.matchStatus !== 'reconciled') {
      return problemResponse(
        createBankMatchError('NOT_RECONCILED',
          `Transaction is not reconciled (current status: ${txn.matchStatus})`,
          400,
          { currentStatus: txn.matchStatus })
      );
    }

    // ── Revert to matched (not unmatched) ───────────────────────
    const previousStatus = txn.matchStatus;
    const newVersion = (txn.version ?? 0) + 1;

    // Determine what status to revert to (auto_matched or manual_matched)
    // Default to manual_matched since we can't know the original
    await repository.updateBankTransaction(transactionId, {
      matchStatus: 'manual_matched',
      reconciledBy: null,
      reconciledAt: null,
      reconciledByName: null,
      version: newVersion,
    });

    // ── Audit log with reason ────────────────────────────────────
    await logAccountingEvent(repository, {
      eventType: 'BANK_RECONCILE_UNLOCKED',
      entityType: 'bank_transaction',
      entityId: transactionId,
      userId: auth.uid,
      details: `Admin unlock: ${transactionId}. Reason: ${reason}`,
      metadata: {
        beforeStatus: previousStatus,
        afterStatus: 'manual_matched',
        unlockReason: reason,
        previousReconciledBy: txn.reconciledBy ?? '',
        previousReconciledAt: txn.reconciledAt ?? '',
      },
    });

    return ok({
      transactionId,
      status: 'manual_matched' as const,
      unlockedBy: auth.uid,
      reason,
      version: newVersion,
    });
  },
});
