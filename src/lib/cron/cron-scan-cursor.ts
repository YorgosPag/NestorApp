/**
 * **ΑΠΟ ΠΟΥ ΣΥΝΕΧΙΖΕΙ Η ΣΑΡΩΣΗ** — σημείο συνέχισης μιας κυλιόμενης σάρωσης, ανά συλλογή (ADR-332 §D33).
 *
 * 🔑 **Ζει στο ΙΔΙΟ έγγραφο με το lease της εργασίας** (`cron_job_state/{slug}`, πεδίο `scanCursor`).
 * Το lease γράφεται πάντα με `merge: true`, άρα δεν το σβήνει· και η συλλογή είναι ήδη κλειστή στους
 * κανόνες (μόνο Admin SDK). Δεύτερη συλλογή θα ήταν δεύτερο σύνολο κανόνων για τα ίδια δεδομένα εργασίας.
 *
 * `null` ⇒ «από την αρχή»: η σάρωση που τελείωσε έναν κύκλο ξεκινά τον επόμενο, ώστε κάθε έγγραφο να
 * ξαναελέγχεται περιοδικά — και όχι μόνο όσα άλλαξαν από τη στιγμή που γράφτηκε ο κώδικας.
 *
 * @module lib/cron/cron-scan-cursor
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

/** Το τελευταίο έγγραφο που ελέγχθηκε, ανά συλλογή. */
export type CronScanCursor = Readonly<Record<string, string | null>>;

const CURSOR_FIELD = 'scanCursor';

function stateRef(db: AdminFirestore, slug: string) {
  return db.collection(COLLECTIONS.CRON_JOB_STATE).doc(slug);
}

export async function readCronScanCursor(db: AdminFirestore, slug: string): Promise<CronScanCursor> {
  const value: unknown = (await stateRef(db, slug).get()).data()?.[CURSOR_FIELD];
  if (typeof value !== 'object' || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([collection, docId]) => [collection, typeof docId === 'string' ? docId : null] as const);
  return Object.fromEntries(entries);
}

export async function writeCronScanCursor(db: AdminFirestore, slug: string, cursor: CronScanCursor): Promise<void> {
  await stateRef(db, slug).set({ [CURSOR_FIELD]: cursor }, { merge: true });
}
