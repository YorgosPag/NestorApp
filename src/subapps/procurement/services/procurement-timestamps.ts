import 'server-only';

import admin from 'firebase-admin';
import { normalizeToDate } from '@/lib/date-local';

/**
 * ISO ημερομηνία από το σύνορο του API → Firestore `Timestamp` (κενό ⇒ `null`).
 *
 * ΕΝΑ σημείο για τη μετατροπή που ήταν γραμμένη τέσσερις φορές στα RFQ / sourcing events — και που έλειπε
 * από το `createRfq`, όπου η «Προθεσμία» της φόρμας γραφόταν σιωπηλά `null` (ADR-330 §5.1 S3.2).
 * Μη αναγνώσιμη τιμή ⇒ «τώρα», όπως έκαναν και τα αντίγραφα.
 */
export function toDeadlineTimestamp(iso: string | null | undefined): admin.firestore.Timestamp | null {
  if (!iso) return null;
  return admin.firestore.Timestamp.fromDate(normalizeToDate(iso) ?? new Date());
}

/** Μερική ενημέρωση: `undefined` ⇒ κράτα την τρέχουσα τιμή, αλλιώς μετέτρεψε (κενό ⇒ καθαρισμός). */
export function patchDeadlineTimestamp(
  iso: string | null | undefined,
  current: admin.firestore.Timestamp | null,
): admin.firestore.Timestamp | null {
  return iso === undefined ? current : toDeadlineTimestamp(iso);
}
