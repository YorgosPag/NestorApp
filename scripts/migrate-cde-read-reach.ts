/**
 * =============================================================================
 * ΜΕΤΑΝΑΣΤΕΥΣΗ — ο φράχτης ανάγνωσης σε ΚΑΘΕ ζωντανό FileRecord (ADR-862 Φ0 Β11)
 * =============================================================================
 *
 * **Γιατί**: ο κανόνας `allow list` των `files` δέχεται μόνο λίστες που δηλώνουν
 * `cdeReadReach == 'tenant'` (ή `createdBy == uid`). Το φίλτρο ισότητας **αποκλείει
 * έγγραφα χωρίς το πεδίο** ⇒ χωρίς αυτή τη μετανάστευση, μετά το push του κώδικα κάθε
 * παλιό αρχείο θα εξαφανιζόταν από κάθε λίστα.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Κριτής της φάσης: ΑΠΟΚΛΕΙΣΤΙΚΑ ο γνήσιος `readContainerState` και η     │
 * │    `readReachFor` — ΚΑΝΕΝΑ αντίγραφο της λογικής σε αυτό το αρχείο.        │
 * │ 🔒 Γράφει ΜΟΝΟ το `cdeReadReach`. Τίποτε άλλο (ούτε `updatedAt`: η        │
 * │    προβολή δεν είναι επεξεργασία του αρχείου από άνθρωπο).                 │
 * │ 🔒 Ιδεμποτητική: ό,τι έχει ήδη σωστό φράχτη ⇒ καμία γραφή.                 │
 * │ ⛔ `unreadable` ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή: φράχτης σε έγγραφο που δεν ξέρουμε  │
 * │    τι είναι θα ήταν μαντεψιά ορατότητας.                                   │
 * │ 🔴 ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ (ADR-862 Φ0 Β11): δείκτες → ΑΥΤΟ → push κώδικα → κανόνες │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/migrate-cde-read-reach.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrate-cde-read-reach.ts --execute  # εγγραφή
 * ```
 *
 * @see src/lib/auth/container-read-reach.ts · src/lib/files/file-record-read.ts
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import type { CdeReadReach } from '../src/config/iso19650-constants';
import { readReachFor } from '../src/lib/auth/container-read-reach';
import { readContainerState } from '../src/lib/files/file-record-read';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

/** Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean. */
export type ReachPlan =
  | { readonly kind: 'write'; readonly reach: CdeReadReach }
  | { readonly kind: 'noop' }
  | { readonly kind: 'unreadable'; readonly why: string };

/** **Τι πρέπει να γραφτεί** σε αυτό το έγγραφο — καθαρό, χωρίς δίσκο. */
export function planReadReach(raw: Record<string, unknown>): ReachPlan {
  const state = readContainerState(raw);
  if (state.phase === 'unreadable') return { kind: 'unreadable', why: state.why };
  const reach = readReachFor(state.phase);
  if (reach === null) return { kind: 'unreadable', why: 'phase-without-reach' };
  return raw.cdeReadReach === reach ? { kind: 'noop' } : { kind: 'write', reach };
}

/** Firestore επιτρέπει έως 500 πράξεις ανά batch· κρατάμε περιθώριο. */
const BATCH_SIZE = 400;

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);

  console.log(`\nΦράχτης ανάγνωσης CDE — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collection(COLLECTIONS.FILES).get();
  const tally = { write: 0, noop: 0, unreadable: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const plan = planReadReach(doc.data());
    tally[plan.kind] += 1;
    if (plan.kind === 'unreadable') {
      console.log(`  ⛔ ${doc.id}: ${plan.why} — ΔΕΝ γράφεται`);
      continue;
    }
    if (plan.kind === 'noop') continue;
    console.log(`  ✎ ${doc.id} → ${plan.reach}`);
    if (!execute) continue;
    batch.update(doc.ref, { cdeReadReach: plan.reach });
    pending += 1;
    if (pending === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (execute && pending > 0) await batch.commit();

  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `\nΣύνολο ${snapshot.size} · προς εγγραφή ${tally.write} · ήδη σωστά ${tally.noop} · ` +
      `μη αναγνώσιμα ${tally.unreadable}${execute ? ' · ΓΡΑΦΤΗΚΑΝ' : ' · (dry-run, τίποτα δεν γράφτηκε)'}\n`,
  );
  if (tally.unreadable > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('migrate-cde-read-reach')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
