/**
 * =============================================================================
 * ΣΥΜΠΛΗΡΩΣΗ — η κατάσταση θέσεων/αποθηκών σε ΤΡΙΑ πεδία (ADR-777 §8.60.20)
 * =============================================================================
 *
 * **Γιατί**: ως τις 2026-09-18 το `status` χώρου ανακάτευε εμπορικό (`sold`), φυσικό
 * (`maintenance`) και κάδο (`deleted`). Πλέον: `commercialStatus` · `operationalStatus` ·
 * `status` = μόνο κύκλος ζωής (`active` · `deleted`).
 *
 * 🔑 **Δεν είναι προϋπόθεση του deploy**: ο ΕΝΑΣ αναγνώστης (`resolveSpaceStatuses`) διαβάζει
 * **και** το παλιό πεδίο, και κάθε γραφή γράφει το νέο («read both, write new»). Η συμπλήρωση απλώς
 * καθαρίζει τον δίσκο ώστε, όταν τρέξει παντού, να μπορεί να φύγει ο κλάδος του παλιού πεδίου.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Η απόφαση ΔΕΝ γράφεται εδώ: καλείται ο ΕΝΑΣ `planSpaceStatusBackfill` —  │
 * │    ο ίδιος πίνακας με κάθε οθόνη. Καμία δεύτερη λογική.                     │
 * │ 🔒 Γράφει ΜΟΝΟ `status`/`previousStatus` + ό,τι ΡΗΤΑ ισχυριζόταν το παλιό   │
 * │    πεδίο και λείπει. Κανένα `updatedAt`: δεν είναι επεξεργασία ανθρώπου.     │
 * │ ⛔ Καμία μαντεψιά: `available` ΔΕΝ γίνεται «προς πώληση», ούτε «Έτοιμο».     │
 * │ 🔒 Ιδεμποτητική, με ξανα-κρίση ΜΕΣΑ στη συναλλαγή.                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/migrations/migrate-space-status-split.ts            # ξηρό (μέτρηση)
 * npx tsx scripts/migrations/migrate-space-status-split.ts --apply    # γραφή
 * ```
 *
 * @see src/lib/spaces/space-status-split.ts · ADR-813 (ο ΕΝΑΣ εκκινητής firebase-admin)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  planSpaceStatusBackfill,
  type SpaceStatusBackfill,
} from '@/lib/spaces/space-status-split';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const APPLY = process.argv.slice(2).includes('--apply');

/** Οι δύο συλλογές χώρων — η ίδια απόφαση για καθεμία. */
const SPACE_COLLECTIONS = [COLLECTIONS.PARKING_SPACES, COLLECTIONS.STORAGE] as const;

/** Ξανα-κρίνει **μέσα** στη συναλλαγή και γράφει· επιστρέφει το σχέδιο που **εφαρμόστηκε**. */
async function applyPlan(db: AdminFirestore, collection: string, id: string): Promise<SpaceStatusBackfill> {
  const ref = db.collection(collection).doc(id);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const plan = planSpaceStatusBackfill((snapshot.data() ?? {}) as Record<string, unknown>);
    if (plan.kind === 'write') tx.update(ref, { ...plan.updates });
    return plan;
  });
}

/** Μετά τη γραφή: το έγγραφο πρέπει να κρίνεται `noop` — «έγραψε» ≠ «ολοκληρώθηκε». */
async function verifySettled(db: AdminFirestore, collection: string, id: string): Promise<boolean> {
  const snapshot = await db.collection(collection).doc(id).get();
  return planSpaceStatusBackfill((snapshot.data() ?? {}) as Record<string, unknown>).kind === 'noop';
}

async function migrateCollection(db: AdminFirestore, collection: string): Promise<boolean> {
  const snapshot = await db.collection(collection).get();
  let writes = 0;
  let failed = false;
  for (const doc of snapshot.docs) {
    const planned = planSpaceStatusBackfill(doc.data() as Record<string, unknown>);
    if (planned.kind === 'noop') continue;
    writes += 1;
    console.log(`   ${collection}/${doc.id}: ${JSON.stringify(planned.updates)}`);
    if (!APPLY) continue;
    await applyPlan(db, collection, doc.id);
    if (!(await verifySettled(db, collection, doc.id))) {
      console.log(`   ❌ ${collection}/${doc.id}: γράφτηκε αλλά ΔΕΝ ισορρόπησε`);
      failed = true;
    }
  }
  console.log(`   ${collection}: έγγραφα ${snapshot.size} · προς γραφή ${writes}`);
  return failed;
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log(`\n🔁 ΣΥΜΠΛΗΡΩΣΗ κατάστασης χώρων — ADR-777 §8.60.20`);
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);

  let failed = false;
  for (const collection of SPACE_COLLECTIONS) {
    failed = (await migrateCollection(db, collection)) || failed;
  }
  if (!APPLY) console.log('\n   (ξηρό τρέξιμο — ξανατρέξε με --apply για γραφή)');
  process.exit(failed ? 1 : 0);
}

// Εκτελείται μόνο ως script — ο σχεδιαστής ζει στο `src/lib` και ελέγχεται σε jest.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η συμπλήρωση απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
