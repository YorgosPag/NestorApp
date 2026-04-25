import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// QT-NNNN ATOMIC COUNTER
// Pattern mirrors procurement-repository.ts:47-63 (PO-NNNN counter)
// ADR-327 §5.2 — quote_counters collection, Admin SDK only
// ============================================================================

export async function getNextQuoteNumber(companyId: string): Promise<string> {
  return safeFirestoreOperation(async (db) => {
    const counterRef = db
      .collection(COLLECTIONS.QUOTE_COUNTERS)
      .doc(companyId);

    const nextNumber = await db.runTransaction(async (txn) => {
      const snap = await txn.get(counterRef);
      const current = snap.exists
        ? (snap.data() as { lastNumber: number }).lastNumber
        : 0;
      const next = current + 1;
      txn.set(counterRef, { lastNumber: next }, { merge: true });
      return next;
    });

    return `QT-${String(nextNumber).padStart(4, '0')}`;
  }, 'QT-0000');
}
