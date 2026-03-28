/**
 * POST /api/procurement/invoice-match — Match expense document to POs
 *
 * Accepts an expense document ID, fetches extracted data,
 * and returns ranked PO candidates with confidence scores.
 * If auto-match >= 85%, writes suggestedPOId to the document.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (AI Invoice Matching)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { matchInvoiceToPO } from '@/services/procurement/po-invoice-matcher';
import type { ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';

const logger = createModuleLogger('PO_INVOICE_MATCH');

// ============================================================================
// POST — Match invoice to PO
// ============================================================================

async function handlePost(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse> {
  try {
    const body = await request.json() as { expenseDocId?: string };
    const expenseDocId = typeof body.expenseDocId === 'string' ? body.expenseDocId.trim() : '';

    if (!expenseDocId) {
      return NextResponse.json(
        { success: false, error: 'expenseDocId is required' },
        { status: 400 }
      );
    }

    // Fetch expense document
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(expenseDocId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Expense document not found' },
        { status: 404 }
      );
    }

    const expenseDoc = docSnap.data() as ReceivedExpenseDocument;

    if (!expenseDoc.extractedData) {
      return NextResponse.json(
        { success: false, error: 'Document has no extracted data yet' },
        { status: 400 }
      );
    }

    // Run matching
    const result = await matchInvoiceToPO(ctx.companyId, expenseDoc.extractedData);

    // If auto-matched, write suggestion to document
    if (result.autoMatched && result.bestMatch) {
      await docRef.update({
        suggestedPOId: result.bestMatch.poId,
        poMatchConfidence: result.bestMatch.confidence,
        updatedAt: new Date().toISOString(),
      });

      logger.info('Auto-matched expense doc to PO', {
        expenseDocId,
        poId: result.bestMatch.poId,
        confidence: result.bestMatch.confidence,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        candidates: result.candidates,
        bestMatch: result.bestMatch,
        autoMatched: result.autoMatched,
      },
    });
  } catch (error) {
    logger.error('Invoice-to-PO matching failed', {
      error: getErrorMessage(error),
    });
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export const POST = withStandardRateLimit(withAuth(handlePost));
