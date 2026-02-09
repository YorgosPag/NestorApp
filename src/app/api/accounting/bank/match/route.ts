/**
 * =============================================================================
 * POST /api/accounting/bank/match — Match Bank Transaction to Journal Entry
 * =============================================================================
 *
 * Links a bank transaction to a journal entry by updating the transaction's
 * matchStatus to 'manual_matched' and storing the journalEntryId.
 *
 * Body:
 *   - transactionId (required): Bank transaction Firestore ID
 *   - journalEntryId (required): Journal entry Firestore ID
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/match
 * @enterprise ADR-ACC-008 Bank Reconciliation
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';

// =============================================================================
// TYPES
// =============================================================================

interface MatchRequestBody {
  transactionId: string;
  journalEntryId: string;
}

// =============================================================================
// POST — Match Bank Transaction
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as MatchRequestBody;

        if (!body.transactionId || !body.journalEntryId) {
          return NextResponse.json(
            { success: false, error: 'transactionId and journalEntryId are required' },
            { status: 400 }
          );
        }

        // Verify bank transaction exists
        const transaction = await repository.getBankTransaction(body.transactionId);
        if (!transaction) {
          return NextResponse.json(
            { success: false, error: 'Bank transaction not found' },
            { status: 404 }
          );
        }

        // Verify journal entry exists
        const journalEntry = await repository.getJournalEntry(body.journalEntryId);
        if (!journalEntry) {
          return NextResponse.json(
            { success: false, error: 'Journal entry not found' },
            { status: 404 }
          );
        }

        // Update the bank transaction with match info
        await repository.updateBankTransaction(body.transactionId, {
          matchStatus: 'manual_matched',
          matchedEntityId: body.journalEntryId,
          matchedEntityType: 'journal_entry',
          matchConfidence: null,
        });

        return NextResponse.json({
          success: true,
          data: {
            transactionId: body.transactionId,
            journalEntryId: body.journalEntryId,
            matchStatus: 'manual_matched',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to match bank transaction';
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
