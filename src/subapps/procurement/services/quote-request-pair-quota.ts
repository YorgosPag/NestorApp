import 'server-only';

/**
 * **Η ποσόστωση αιτημάτων προσφοράς ανά ζεύγος (αγοραστής, προμηθευτής)** — ατομική, μέσα στη συναλλαγή (ADR-923 §5.13 Τ5).
 *
 * 🔴 Πριν: `withinSubjectQuota` (Upstash) στο **σχέδιο** του `createRfq`, έξω από τη συναλλαγή. Τρία κενά:
 *    1. **αποτυχία του store ⇒ επιτρέπει** (και η μνήμη ανά διεργασία στο dev) — το όριο δεν ίσχυε όταν έπεφτε το Redis·
 *    2. η μονάδα καταναλωνόταν **πριν** από το commit: RFQ που αρνήθηκε αργότερα έτρωγε το όριο, ενώ επανάληψη της
 *       συναλλαγής δεν το ξαναμετρούσε — η κρίση και η εγγραφή δεν ήταν το ίδιο γεγονός·
 *    3. μετρούσε **μόνο** τους προμηθευτές των γραμμών καταλόγου: επαφή πλατφόρμας στο `invitedVendorIds` ή χειρόγραφη
 *       πρόσκληση πήγαινε στο ίδιο γραμματοκιβώτιο **χωρίς** να μετρηθεί.
 *
 * ✅ Τώρα: ένα έγγραφο ανά αγοραστή (`quote_request_pair_quotas/{buyerCompanyId}`, μόνο Admin SDK), ένας μετρητής ανά
 *    προμηθευτή μέσα στο τρέχον παράθυρο. Διαβάζεται και γράφεται **στην ίδια συναλλαγή** με το αίτημα: ταυτόχρονα αιτήματα
 *    συγκρούονται και το Firestore ξανατρέχει το ένα (καμία παράκαμψη με αγώνα), η επανάληψη ξαναδιαβάζει (ιδεμποτικό),
 *    και αποτυχία ⇒ **αρνείται** (fail-closed: χωρίς μέτρηση δεν φεύγει αίτημα σε ξένο γραμματοκιβώτιο).
 *
 * 🔑 Παράθυρο **σταθερό** (`floor(now / windowMs)`), όχι κυλιόμενο: ένα έγγραφο, χωρίς λίστα χρονοσφραγίδων. Το χειρότερο
 *    σενάριο είναι 2× το όριο γύρω από την αλλαγή παραθύρου — αποδεκτό για φρένο spam, όχι για χρέωση.
 *
 * @module subapps/procurement/services/quote-request-pair-quota
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';
import { QUOTE_REQUEST_PAIR_DAILY_QUOTA } from '@/lib/middleware/rate-limit-config';

type Db = admin.firestore.Firestore;
type Tx = admin.firestore.Transaction;

/** Μετρητές ανά προμηθευτή, **μόνο** του τρέχοντος παραθύρου. */
export type QuoteRequestPairCounts = Readonly<Record<string, number>>;

export type QuoteRequestPairAdmission =
  | { readonly kind: 'admitted'; readonly counts: QuoteRequestPairCounts }
  | { readonly kind: 'exhausted'; readonly supplierCompanyId: string };

export const quoteRequestWindowOf = (nowMs: number): number => Math.floor(nowMs / QUOTE_REQUEST_PAIR_DAILY_QUOTA.windowMs);

const quotaRef = (db: Db, buyerCompanyId: string) => db.collection(COLLECTIONS.QUOTE_REQUEST_PAIR_QUOTAS).doc(buyerCompanyId);

/** Οι μετρητές από το αποθηκευμένο έγγραφο· άλλο παράθυρο ή χαλασμένο έγγραφο ⇒ μηδέν. */
export function quoteRequestPairCountsOf(data: unknown, window: number): QuoteRequestPairCounts {
  if (typeof data !== 'object' || data === null) return {};
  const { window: stored, pairs } = data as { window?: unknown; pairs?: unknown };
  if (stored !== window || typeof pairs !== 'object' || pairs === null) return {};
  return Object.fromEntries(Object.entries(pairs).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0));
}

/** **Καθαρή** κρίση: χωρά ακόμη ένα αίτημα για **κάθε** προμηθευτή; Όλοι ή κανένας. */
export function admitQuoteRequestPairs(counts: QuoteRequestPairCounts, supplierCompanyIds: readonly string[]): QuoteRequestPairAdmission {
  const next: Record<string, number> = { ...counts };
  for (const supplierCompanyId of new Set(supplierCompanyIds)) {
    const used = next[supplierCompanyId] ?? 0;
    if (used >= QUOTE_REQUEST_PAIR_DAILY_QUOTA.limit) return { kind: 'exhausted', supplierCompanyId };
    next[supplierCompanyId] = used + 1;
  }
  return { kind: 'admitted', counts: next };
}

/** Η ανάγνωση — μέσα σε συναλλαγή (`tx`) ή, για την πρόωρη άρνηση του σχεδίου, χωρίς (`null`, καμία κατανάλωση). */
export async function readQuoteRequestPairCounts(tx: Tx | null, db: Db, buyerCompanyId: string, nowMs: number): Promise<QuoteRequestPairCounts> {
  const ref = quotaRef(db, buyerCompanyId);
  const snap = tx === null ? await ref.get() : await tx.get(ref);
  return quoteRequestPairCountsOf(snap.data(), quoteRequestWindowOf(nowMs));
}

/** Η εγγραφή — σύγχρονη, στη φάση εγγραφής της ίδιας συναλλαγής. Αντικαθιστά ολόκληρο το έγγραφο (τα παλιά παράθυρα φεύγουν). */
export function writeQuoteRequestPairCounts(tx: Tx, db: Db, buyerCompanyId: string, counts: QuoteRequestPairCounts, nowMs: number): void {
  tx.set(quotaRef(db, buyerCompanyId), {
    companyId: buyerCompanyId,
    window: quoteRequestWindowOf(nowMs),
    pairs: counts,
    updatedAt: admin.firestore.Timestamp.fromMillis(nowMs),
  });
}

/**
 * Μία μονάδα για **ένα** ζεύγος, σε δική της συναλλαγή — για δρόμους που δεν έχουν συναλλαγή αιτήματος (χειρόγραφη
 * πρόσκληση). `false` ⇒ το όριο εξαντλήθηκε.
 */
export function consumeQuoteRequestPair(db: Db, buyerCompanyId: string, supplierCompanyId: string, nowMs: number = Date.now()): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const admission = admitQuoteRequestPairs(await readQuoteRequestPairCounts(tx, db, buyerCompanyId, nowMs), [supplierCompanyId]);
    if (admission.kind === 'exhausted') return false;
    writeQuoteRequestPairCounts(tx, db, buyerCompanyId, admission.counts, nowMs);
    return true;
  });
}
