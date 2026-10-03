/**
 * =============================================================================
 * ΜΕΤΑΝΑΣΤΕΥΣΗ — ακίνητα · θέσεις · αποθήκες φιλοξενούνται σε ΟΡΟΦΟ (ADR-903 §6)
 * =============================================================================
 *
 * **Γιατί**: ως τις 2026-10-03 η θέση στάθμευσης είχε `floor` ελεύθερο κείμενο («Υπόγειο -1»,
 * `basement-1`) **χωρίς** `floorId`, η αποθήκη κείμενο + προαιρετικό `floorId`, και κανένα αντίγραφο
 * δεν ακολουθούσε την αναρίθμηση ορόφου. Πλέον (Revit `LevelId`): `floorId` = αυθεντία,
 * `floor` (αριθμός) + `floorKind` = παράγωγο αντίγραφο.
 *
 * 🔑 **Δεν είναι προϋπόθεση του deploy**: ο ΕΝΑΣ αναγνώστης (`readHostedFloor`) διαβάζει και το
 * παλιό κείμενο μέσω του parser. Η μετανάστευση απλώς δένει τα παλιά έγγραφα στον όροφό τους.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Η απόφαση ΔΕΝ γράφεται εδώ: ο ΕΝΑΣ `planHostedFloorBackfill` (jest).    │
 * │ 🔒 Γράφει ΜΟΝΟ `floorId`/`floor`/`floorKind`. Κανένα `updatedAt`.          │
 * │ ⛔ Καμία μαντεψιά: ό,τι δεν λύνεται μονοσήμαντα ΑΝΑΦΕΡΕΤΑΙ, δεν γράφεται.  │
 * │ 🔒 Ιδεμποτική, με ξανα-κρίση ΜΕΣΑ στη συναλλαγή + επαλήθευση μετά.         │
 * │ ⛔ Τρέχει με --apply ΜΟΝΟ με ρητή εντολή Giorgio.                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npm run migrate:hosted-floor-ref                # ξηρό: τι θα γραφτεί + τι δεν λύνεται
 * npm run migrate:hosted-floor-ref -- --verify    # ελεγκτής απόκλισης: μόνο αναφορά, exit 1 αν αποκλίνει
 * npm run migrate:hosted-floor-ref -- --apply     # γραφή
 * ```
 *
 * @see src/lib/floor/plan-hosted-floor-backfill.ts · ADR-813 (ο ΕΝΑΣ εκκινητής firebase-admin)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  buildFloorIndex,
  planHostedFloorBackfill,
  type FloorIndex,
  type HostedFloorBackfill,
} from '@/lib/floor/plan-hosted-floor-backfill';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const VERIFY = ARGS.includes('--verify');

/** Οι τρεις συλλογές που φιλοξενούνται σε όροφο — η ίδια απόφαση για καθεμία. */
const HOSTED_COLLECTIONS = [COLLECTIONS.PROPERTIES, COLLECTIONS.PARKING_SPACES, COLLECTIONS.STORAGE] as const;

interface CollectionTally {
  scanned: number;
  writes: number;
  unresolved: number;
  failed: boolean;
}

function plan(data: unknown, index: FloorIndex): HostedFloorBackfill {
  return planHostedFloorBackfill((data ?? {}) as Record<string, unknown>, index);
}

/** Ξανα-κρίνει **μέσα** στη συναλλαγή και γράφει· επιστρέφει αν ισορρόπησε (`noop` μετά). */
async function applyAndVerify(db: AdminFirestore, collection: string, id: string, index: FloorIndex): Promise<boolean> {
  const ref = db.collection(collection).doc(id);
  await db.runTransaction(async (tx) => {
    const planned = plan((await tx.get(ref)).data(), index);
    if (planned.kind === 'write') tx.update(ref, { ...planned.fields });
  });
  return plan((await ref.get()).data(), index).kind === 'noop';
}

async function migrateCollection(db: AdminFirestore, collection: string, index: FloorIndex): Promise<CollectionTally> {
  const snapshot = await db.collection(collection).get();
  const tally: CollectionTally = { scanned: snapshot.size, writes: 0, unresolved: 0, failed: false };
  for (const doc of snapshot.docs) {
    const planned = plan(doc.data(), index);
    if (planned.kind === 'noop') continue;
    if (planned.kind === 'unresolved') {
      tally.unresolved += 1;
      console.log(`   ⚠️  ${collection}/${doc.id}: ${planned.reason} — ${planned.detail}`);
      continue;
    }
    tally.writes += 1;
    console.log(`   ${collection}/${doc.id} [${planned.via}]: ${JSON.stringify(planned.fields)}`);
    if (APPLY && !(await applyAndVerify(db, collection, doc.id, index))) {
      console.log(`   ❌ ${collection}/${doc.id}: γράφτηκε αλλά ΔΕΝ ισορρόπησε`);
      tally.failed = true;
    }
  }
  console.log(`   ${collection}: έγγραφα ${tally.scanned} · προς γραφή ${tally.writes} · άλυτα ${tally.unresolved}`);
  return tally;
}

async function loadFloorIndex(db: AdminFirestore): Promise<FloorIndex> {
  const snapshot = await db.collection(COLLECTIONS.FLOORS).get();
  return buildFloorIndex(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  const mode = APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : VERIFY ? '🔎 ΕΛΕΓΧΟΣ ΑΠΟΚΛΙΣΗΣ (--verify)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ';
  console.log(`\n🏢 Φιλοξενία σε όροφο — ADR-903 §6`);
  console.log(`   έργο: ${projectId} · τρόπος: ${mode}`);

  const index = await loadFloorIndex(db);
  console.log(`   όροφοι στο ευρετήριο: ${index.byId.size}`);

  let failed = false;
  let drift = 0;
  for (const collection of HOSTED_COLLECTIONS) {
    const tally = await migrateCollection(db, collection, index);
    failed = failed || tally.failed;
    drift += tally.writes;
  }
  if (!APPLY) console.log('\n   (χωρίς γραφή — το --apply τρέχει ΜΟΝΟ με εντολή Giorgio)');
  process.exit(failed || (VERIFY && drift > 0) ? 1 : 0);
}

// Εκτελείται μόνο ως script — ο σχεδιαστής ζει στο `src/lib` και ελέγχεται σε jest.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η μετανάστευση απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
