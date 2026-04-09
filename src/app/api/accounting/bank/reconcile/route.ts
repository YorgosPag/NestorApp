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
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
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

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

      // ── Parse ─────────────────────────────────────────────────────
      const body = await req.json();
      const parsed = safeParseBody(ReconcileSchema, body);
      if (parsed.error) return parsed.error;
      const { transactionId, expectedVersion } = parsed.data;

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
      if (ctx.globalRole !== 'super_admin') {
        // Check who matched this transaction
        // matchedByName stores the email of the matcher
        if (txn.matchedByName === ctx.email) {
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
      const now = new Date().toISOString();

      await repository.updateBankTransaction(transactionId, {
        matchStatus: 'reconciled',
        reconciledBy: ctx.uid,
        reconciledAt: now,
        reconciledByName: ctx.email,
        version: newVersion,
      });

      // ── Audit log ───────────────────────────────────────────────
      await logAccountingEvent(repository, {
        eventType: 'BANK_RECONCILED',
        entityType: 'bank_transaction',
        entityId: transactionId,
        userId: ctx.uid,
        details: `Reconciled: ${transactionId} (was ${txn.matchStatus})`,
        metadata: {
          beforeStatus: txn.matchStatus,
          afterStatus: 'reconciled',
          matchedEntityId: txn.matchedEntityId ?? '',
          matchedEntityType: txn.matchedEntityType ?? '',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          transactionId,
          status: 'reconciled' as const,
          reconciledBy: ctx.uid,
          reconciledAt: now,
          version: newVersion,
        },
      });
    }
  );

  return handler(request);
}

// =============================================================================
// PATCH — Admin Unlock (reconciled → matched)
// =============================================================================

async function handlePatch(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

      // ── Admin-only ────────────────────────────────────────────────
      if (ctx.globalRole !== 'super_admin' && ctx.globalRole !== 'company_admin') {
        return NextResponse.json(
          { success: false, error: 'Only admin can unlock reconciled transactions' },
          { status: 403 }
        );
      }

      // ── Parse ─────────────────────────────────────────────────────
      const body = await req.json();
      const parsed = safeParseBody(AdminUnlockSchema, body);
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
        userId: ctx.uid,
        details: `Admin unlock: ${transactionId}. Reason: ${reason}`,
        metadata: {
          beforeStatus: previousStatus,
          afterStatus: 'manual_matched',
          unlockReason: reason,
          previousReconciledBy: txn.reconciledBy ?? '',
          previousReconciledAt: txn.reconciledAt ?? '',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          transactionId,
          status: 'manual_matched' as const,
          unlockedBy: ctx.uid,
          reason,
          version: newVersion,
        },
      });
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
export const PATCH = withStandardRateLimit(handlePatch);
