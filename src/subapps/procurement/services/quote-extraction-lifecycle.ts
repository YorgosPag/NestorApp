/**
 * **Ο κύκλος ζωής της εξαγωγής AI μιας προσφοράς** (ADR-327 §6.10) — ο ΕΝΑΣ γραφέας του `Quote.extraction`.
 *
 * | Μετάβαση | Ποιος | Πού |
 * |---|---|---|
 * | — → `pending` (προσπάθεια 1) | δημιουργία σάρωσης | `createQuote({ requestExtraction })` — στην ΙΔΙΑ εγγραφή |
 * | `failed`/κολλημένη → `pending` (n+1) | «Επανάληψη» | `markQuoteExtractionPending` — συναλλαγή |
 * | `pending` → `succeeded` | επιτυχής εξαγωγή | `applyExtractedData` — ΜΑΖΙ με τα δεδομένα |
 * | `pending` → `failed` + κωδικός | αποτυχία / «δεν είναι προσφορά» | `markQuoteExtractionFailed` |
 *
 * 🔑 **Fencing token = `attempt`** (Kleppmann, «How to do distributed locking»): η διεργασία μιας προσπάθειας που
 * κρίθηκε κολλημένη μπορεί να τελειώσει **μετά** την επανάληψη. Χωρίς αριθμό θα έγραφε `failed` πάνω σε μια ζωντανή
 * νεότερη προσπάθεια· με αριθμό, γράφει μόνο αν είναι ακόμη η τρέχουσα.
 *
 * @module subapps/procurement/services/quote-extraction-lifecycle
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthContext } from '@/lib/auth';
import type { Quote, QuoteExtractionErrorCode, QuoteExtractionState } from '../types/quote';
import { resolveQuoteIntakeView } from '../utils/quote-intake-view';
import { PROCUREMENT_RESOURCE, requireOwnedSnapshot } from './procurement-owned-doc';
import { quoteAuditEntry } from './quote-audit-entry';
import { quoteChangeStamp } from './quote-change-stamp';

const logger = createModuleLogger('QUOTE_EXTRACTION_LIFECYCLE');

/** Νέα προσπάθεια εξαγωγής. */
export function pendingExtraction(now: admin.firestore.Timestamp, attempt: number): QuoteExtractionState {
  return { status: 'pending', startedAt: now, finishedAt: null, errorCode: null, attempt };
}

/** Τέλος της τρέχουσας προσπάθειας· κρατά έναρξη και αριθμό της (έγγραφο πριν το §6.10 ⇒ 1η). */
export function finishedExtraction(
  previous: QuoteExtractionState | null | undefined,
  status: 'succeeded' | 'failed',
  errorCode: QuoteExtractionErrorCode | null,
): QuoteExtractionState {
  const now = admin.firestore.Timestamp.now();
  return { status, startedAt: previous?.startedAt ?? now, finishedAt: now, errorCode, attempt: previous?.attempt ?? 1 };
}

const subjectOf = (quoteId: string) => ({ resource: PROCUREMENT_RESOURCE.QUOTE, resourceId: quoteId }) as const;

export type RetryExtractionOutcome =
  | { readonly outcome: 'started'; readonly attempt: number }
  /** Τρέχει ήδη προσπάθεια που δεν έχει κολλήσει — δεύτερη θα διπλασίαζε κόστος AI και θα έτρεχε σε αγώνα. */
  | { readonly outcome: 'in_progress' }
  /** Υπάρχει ήδη εξαγωγή, ή η προσφορά δεν ζήτησε ποτέ (πύλη / χειροκίνητη). */
  | { readonly outcome: 'not_retryable' };

/**
 * «Επανάληψη»: `failed` ή κολλημένη `pending` → νέα `pending`. **Συναλλαγή** (compare-and-set): δύο κλικ ή δύο
 * καρτέλες ξεκινούν **μία** προσπάθεια· το δεύτερο βλέπει την πρώτη ως `in_progress`.
 */
export async function markQuoteExtractionPending(ctx: AuthContext, quoteId: string): Promise<RetryExtractionOutcome> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
    return db.runTransaction(async (tx): Promise<RetryExtractionOutcome> => {
      const current = requireOwnedSnapshot<Quote>(await tx.get(ref), ctx.companyId, subjectOf(quoteId));
      const view = resolveQuoteIntakeView(current, Date.now());
      if (view.kind === 'extracting') return { outcome: 'in_progress' };
      if (view.kind !== 'failed' && view.kind !== 'stalled') return { outcome: 'not_retryable' };

      const now = admin.firestore.Timestamp.now();
      const attempt = (current.extraction?.attempt ?? 1) + 1;
      tx.update(ref, sanitizeForFirestore({
        extraction: pendingExtraction(now, attempt),
        auditTrail: [...(current.auditTrail ?? []), quoteAuditEntry(ctx.uid, 'extraction_retried', null, `attempt=${attempt}`)],
        ...quoteChangeStamp(ctx.uid, now),
      }));
      return { outcome: 'started', attempt };
    });
  });
}

/**
 * `pending` → `failed` με κωδικό — μόνο αν η προσπάθεια `attempt` είναι **ακόμη** η τρέχουσα (fencing).
 * Πετά σφάλμα Firestore· ο επεξεργαστής στο `after()` το συλλαμβάνει και το καταγράφει. Αν χαθεί η ίδια η
 * σήμανση, την καλύπτει το όριο «κόλλησε» του κριτή (belt-and-suspenders).
 */
export async function markQuoteExtractionFailed(
  ctx: AuthContext,
  quoteId: string,
  errorCode: QuoteExtractionErrorCode,
  attempt: number,
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
    await db.runTransaction(async (tx) => {
      const current = requireOwnedSnapshot<Quote>(await tx.get(ref), ctx.companyId, subjectOf(quoteId));
      const currentAttempt = current.extraction?.attempt ?? 1;
      if (currentAttempt !== attempt || current.extractedData) {
        logger.warn('Stale extraction attempt — failure not recorded', { quoteId, attempt, currentAttempt });
        return;
      }
      tx.update(ref, sanitizeForFirestore({
        extraction: finishedExtraction(current.extraction, 'failed', errorCode),
        auditTrail: [...(current.auditTrail ?? []), quoteAuditEntry(ctx.uid, 'extraction_failed', null, errorCode)],
        ...quoteChangeStamp(ctx.uid),
      }));
    });
  });
}
