/**
 * POST /api/procurement/invoice-match — Match expense document to POs
 *
 * Accepts an expense document ID, fetches extracted data,
 * and returns ranked PO candidates with confidence scores.
 * If auto-match >= 85%, writes suggestedPOId to the document.
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-267 Phase C (AI Invoice Matching)
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest, notFound } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { matchInvoiceToPO } from '@/services/procurement/po-invoice-matcher';
import type { ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('PO_INVOICE_MATCH');

// ============================================================================
// POST — Match invoice to PO
// ============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth }) => {
    const body = (await req.json()) as { expenseDocId?: string };
    const expenseDocId = typeof body.expenseDocId === 'string' ? body.expenseDocId.trim() : '';

    if (!expenseDocId) badRequest('expenseDocId is required');

    // Fetch expense document
    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS).doc(expenseDocId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) notFound('Expense document not found');

    const expenseDoc = docSnap.data() as ReceivedExpenseDocument;

    if (!expenseDoc.extractedData) badRequest('Document has no extracted data yet');

    // Run matching
    const result = await matchInvoiceToPO(auth.companyId, expenseDoc.extractedData);

    // If auto-matched, write suggestion to document
    if (result.autoMatched && result.bestMatch) {
      await docRef.update({
        suggestedPOId: result.bestMatch.poId,
        poMatchConfidence: result.bestMatch.confidence,
        updatedAt: nowISO(),
      });

      logger.info('Auto-matched expense doc to PO', {
        expenseDocId,
        poId: result.bestMatch.poId,
        confidence: result.bestMatch.confidence,
      });
    }

    return ok({
      candidates: result.candidates,
      bestMatch: result.bestMatch,
      autoMatched: result.autoMatched,
    });
  },
});
