/**
 * =============================================================================
 * ΣΥΜΠΛΗΡΩΣΗ — ψευδώνυμα κατάστασης κτιρίου → κανονική τιμή (ADR-898 §18.2)
 * =============================================================================
 *
 * **Γιατί**: 4 κτίρια παλιού seed (χωρίς `createdAt`/`_v`, μετρημένο 2026-10-02) έχουν `status: 'in_progress'` —
 * κατάσταση **έργου**, όχι κτιρίου. Κανένας γραφέας του κώδικα δεν το παράγει.
 *
 * 🔑 **Δεν είναι προϋπόθεση του deploy**: το σύνορο ανάγνωσης (`withCanonicalBuildingStatus`) ήδη δείχνει «Υπό
 * Κατασκευή». Η συμπλήρωση καθαρίζει τον δίσκο, ώστε αναφορές/εξαγωγές/ερωτήματα Firestore (`where status ==`) να μη
 * χρειάζονται το ψευδώνυμο.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Η απόφαση ΔΕΝ γράφεται εδώ: καλείται ο ΕΝΑΣ `planBuildingStatusBackfill` │
 * │    — ο ίδιος με το σύνορο ανάγνωσης. Καμία δεύτερη λογική.                   │
 * │ 🔒 Γράφει ΜΟΝΟ `status`. Κανένα `updatedAt`: δεν είναι επεξεργασία ανθρώπου. │
 * │ ⛔ Καμία μαντεψιά: άγνωστη τιμή μένει ως έχει και ΑΝΑΦΕΡΕΤΑΙ.                │
 * │ 🔒 Ιδεμποτητική, με ξανα-κρίση ΜΕΣΑ στη συναλλαγή · επαλήθευση μετά.        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/migrations/migrate-building-status-aliases.ts            # ξηρό (μέτρηση)
 * npx tsx scripts/migrations/migrate-building-status-aliases.ts --apply    # γραφή
 * ```
 *
 * @see src/lib/buildings/canonical-building-enums.ts · ADR-813 (ο ΕΝΑΣ εκκινητής firebase-admin)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isBuildingStatus } from '@/constants/building-statuses';
import { planBuildingStatusBackfill, type BuildingStatusBackfill } from '@/lib/buildings/canonical-building-enums';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const APPLY = process.argv.slice(2).includes('--apply');

/** Ξανα-κρίνει **μέσα** στη συναλλαγή και γράφει· επιστρέφει το σχέδιο που **εφαρμόστηκε**. */
async function applyPlan(db: AdminFirestore, id: string): Promise<BuildingStatusBackfill> {
  const ref = db.collection(COLLECTIONS.BUILDINGS).doc(id);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const plan = planBuildingStatusBackfill((snapshot.data() ?? {}) as Record<string, unknown>);
    if (plan.kind === 'write') tx.update(ref, { ...plan.updates });
    return plan;
  });
}

/** Μετά τη γραφή: το έγγραφο πρέπει να κρίνεται `noop` — «έγραψε» ≠ «ολοκληρώθηκε». */
async function verifySettled(db: AdminFirestore, id: string): Promise<boolean> {
  const snapshot = await db.collection(COLLECTIONS.BUILDINGS).doc(id).get();
  return planBuildingStatusBackfill((snapshot.data() ?? {}) as Record<string, unknown>).kind === 'noop';
}

async function migrate(db: AdminFirestore): Promise<boolean> {
  const snapshot = await db.collection(COLLECTIONS.BUILDINGS).get();
  let writes = 0;
  let unknown = 0;
  let failed = false;
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const planned = planBuildingStatusBackfill(data);
    if (planned.kind === 'noop') {
      if (data.status !== undefined && !isBuildingStatus(data.status)) {
        unknown += 1;
        console.log(`   ⚠️  ${doc.id}: άγνωστη κατάσταση ${JSON.stringify(data.status)} — μένει ως έχει`);
      }
      continue;
    }
    writes += 1;
    console.log(`   ${doc.id}: ${JSON.stringify(data.status)} → ${JSON.stringify(planned.updates)}`);
    if (!APPLY) continue;
    await applyPlan(db, doc.id);
    if (!(await verifySettled(db, doc.id))) {
      console.log(`   ❌ ${doc.id}: γράφτηκε αλλά ΔΕΝ ισορρόπησε`);
      failed = true;
    }
  }
  console.log(`   κτίρια ${snapshot.size} · προς γραφή ${writes} · άγνωστες τιμές ${unknown}`);
  return failed;
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log(`\n🔁 ΣΥΜΠΛΗΡΩΣΗ κατάστασης κτιρίων — ADR-898 §18.2`);
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);
  const failed = await migrate(db);
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
