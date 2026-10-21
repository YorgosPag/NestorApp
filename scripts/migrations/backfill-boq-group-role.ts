/**
 * =============================================================================
 * BACKFILL — ρητός ρόλος γονέα ομάδας BOQ (`groupRole`, ADR-917 Λ7)
 * =============================================================================
 *
 * **Γιατί**: οι γονείς ομάδας BIM πριν το Λ7 δεν έχουν `groupRole`. Οι αθροιστές τον αποφασίζουν
 * ήδη στην ανάγνωση (`boq-line-role.resolveBoqGroupRole`), άρα η μετάπτωση **δεν αλλάζει κανένα
 * ποσό** — μετατρέπει την απόδειξη σε ρητό πεδίο, ώστε ο κλάδος fallback να μετρά προς το μηδέν.
 * Τα υπογεγραμμένα (frozen) έγγραφα δεν τα ξαναγράφει ποτέ ο builder ⇒ μόνο έτσι αποκτούν πεδίο.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Απόφαση: ΑΠΟΚΛΕΙΣΤΙΚΑ `resolveBoqGroupRole` — ο ίδιος κανόνας με κάθε    │
 * │    αθροιστή. Γράφεται ΜΟΝΟ ρόλος με βάση `source-entity` (απόδειξη).      │
 * │ 🔒 Γράφει ΜΟΝΟ το `groupRole`. Ούτε `updatedAt`, ούτε ποσότητες/τιμές.     │
 * │ 🔒 Ιδεμποτική: ρητός ρόλος ή μη-γονέας ⇒ καμία γραφή.                      │
 * │ ⛔ Ρόλος χωρίς απόδειξη (`unresolved`) ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή/εικασία.       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE (μόνο με εντολή Giorgio — dry-run ΠΡΩΤΑ):
 * ```bash
 * npx tsx scripts/migrations/backfill-boq-group-role.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrations/backfill-boq-group-role.ts --execute  # εγγραφή
 * ```
 *
 * @see src/services/measurements/boq-line-role.ts · ADR-917 §2.4 Λ7
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../../src/config/firestore-collections';
import { resolveBoqGroupRole, type BoqRoleInput } from '../../src/services/measurements/boq-line-role';
import type { BoqGroupRole } from '../../src/types/boq';
import { applyEnvLocal } from '../_shared/loadEnvLocal';
import { initAdminApp } from '../_shared/firebaseAdminOps';

/** Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean. */
export type GroupRolePlan =
  | { readonly kind: 'write'; readonly groupRole: BoqGroupRole }
  | { readonly kind: 'noop' }
  | { readonly kind: 'unresolved' };

/** **Τι πρέπει να γραφτεί** σε αυτό το έγγραφο — χωρίς δίσκο. */
export function planGroupRole(id: string, raw: Record<string, unknown>): GroupRolePlan {
  const { role, basis } = resolveBoqGroupRole({ id, ...raw } as BoqRoleInput);
  if (basis === 'unresolved') return { kind: 'unresolved' };
  if (basis !== 'source-entity' || role === null) return { kind: 'noop' };
  return { kind: 'write', groupRole: role };
}

/** Firestore επιτρέπει έως 500 πράξεις ανά batch· κρατάμε περιθώριο. */
const BATCH_SIZE = 400;

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);
  console.log(`\nΡόλος γονέα BOQ (Λ7) — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collection(COLLECTIONS.BOQ_ITEMS).get();
  const tally = { summary: 0, work: 0, noop: 0, unresolved: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const plan = planGroupRole(doc.id, doc.data());
    if (plan.kind !== 'write') {
      tally[plan.kind] += 1;
      if (plan.kind === 'unresolved') console.log(`  ⛔ ${doc.id}: γονέας χωρίς αποδείξιμο ρόλο — ΔΕΝ γράφεται`);
      continue;
    }
    tally[plan.groupRole] += 1;
    if (!execute) continue;
    batch.update(doc.ref, { groupRole: plan.groupRole });
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
    `  ${COLLECTIONS.BOQ_ITEMS}: σύνολο ${snapshot.size} · σύνοψη ${tally.summary} · εργασία ${tally.work} · ` +
      `χωρίς αλλαγή ${tally.noop} · χωρίς απόδειξη ${tally.unresolved}`,
  );
  console.log(execute ? '\nΓΡΑΦΤΗΚΑΝ.\n' : '\n(dry-run, τίποτα δεν γράφτηκε)\n');
  if (tally.unresolved > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('backfill-boq-group-role')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
