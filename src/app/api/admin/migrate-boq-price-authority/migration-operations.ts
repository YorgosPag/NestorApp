/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ `priceAuthority` ΤΩΝ ΓΡΑΜΜΩΝ BOQ (ADR-923 §5.11 «3ε»)
 * =============================================================================
 *
 * Μέχρι την 3ε το πεδίο γραφόταν καρφωμένο `master`, ενώ master δεν υπήρχε: 116/116 γραμμές (31/10/2026) δήλωναν πηγή που
 * δεν έχουν. Εδώ η γραμμή χωρίς `priceSource` γίνεται `item`, και το φίλτρο «Πηγή Τιμής» του report builder λέει την αλήθεια.
 *
 * ✅ Ιδεμπότητη: αγγίζει μόνο `master` **χωρίς** δεσμό, άρα το δεύτερο πέρασμα γράφει 0.
 * ✅ Γραμμή με δεσμό δεν αγγίζεται ποτέ: εκεί το `master` είναι αληθινό.
 * ✅ Αγγίζει ένα πεδίο + `updatedAt`, χωρίς καμία τιμή ή ποσότητα.
 *
 * @module api/admin/migrate-boq-price-authority/migration-operations
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { BOQ_ITEM_DEFAULTS } from '@/types/boq';

const BATCH_SIZE = 400;

export interface BoqPriceAuthorityReport {
  readonly dryRun: boolean;
  readonly scanned: number;
  readonly affectedDocuments: number;
  readonly skippedLinked: number;
}

/** Χρειάζεται διόρθωση αυτό το έγγραφο; Καθαρό, ώστε να ελέγχεται χωρίς Firestore. */
export function needsAuthorityFix(data: Readonly<Record<string, unknown>>): boolean {
  return data.priceAuthority === 'master' && !data.priceSource;
}

export async function migrateBoqPriceAuthority(db: Firestore, dryRun: boolean): Promise<BoqPriceAuthorityReport> {
  // tenant-scope-exempt: μετάπτωση super-admin (ADR-703) πάνω σε ΟΛΟΥΣ τους μισθωτές· φρουρά στο createMigrationRoute.
  const snap = await db.collection(COLLECTIONS.BOQ_ITEMS).where('priceAuthority', '==', 'master').get();
  const stale = snap.docs.filter((doc) => needsAuthorityFix(doc.data()));
  if (!dryRun) {
    const updatedAt = nowISO();
    for (let start = 0; start < stale.length; start += BATCH_SIZE) {
      const batch = db.batch();
      stale.slice(start, start + BATCH_SIZE).forEach((doc) => batch.update(doc.ref, { priceAuthority: BOQ_ITEM_DEFAULTS.priceAuthority, updatedAt }));
      await batch.commit();
    }
  }
  return { dryRun, scanned: snap.size, affectedDocuments: stale.length, skippedLinked: snap.size - stale.length };
}
