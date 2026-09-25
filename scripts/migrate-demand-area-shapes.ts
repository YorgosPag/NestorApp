/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ — `place.area.outline` → `place.area.shapes` (ADR-888 §3.5)
 * =============================================================================
 *
 * **Γιατί**: η σχεδιασμένη περιοχή της ζήτησης κρατά πλέον **πολλά** σχήματα (η ίδια γεωμετρία με τον χάρτη
 * αποτελεσμάτων, ADR-885). Ο αναγνώστης (`withAreaShapes`) διαβάζει ήδη το παλιό σχήμα· αυτή η μετάπτωση
 * ξαναγράφει τα παλιά έγγραφα ώστε ο κλάδος συμβατότητας να **σβηστεί** όταν μετρήσει 0.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Μετασχηματισμός: ΑΠΟΚΛΕΙΣΤΙΚΑ `withAreaShapes` + `demandPlaceForStorage` —│
 * │    ο ίδιος κωδικοποιητής με αναγνώστη και υπηρεσία (σχήματα ως `{ring}`).  │
 * │ 🔒 Γράφει ΜΟΝΟ το `place`. Τίποτε άλλο (ούτε `updatedAt`: δεν άλλαξε ανάγκη). │
 * │ 🔒 Ιδεμποτική: έγγραφο χωρίς `place.outline` ⇒ καμία γραφή.                 │
 * │ ⛔ `place` με ΚΑΙ `outline` ΚΑΙ `shapes` ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή.              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE (μόνο με εντολή Giorgio):
 * ```bash
 * npx tsx scripts/migrate-demand-area-shapes.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrate-demand-area-shapes.ts --execute  # εγγραφή
 * ```
 *
 * @see src/lib/demand/demand-area.ts · docs/centralized-systems/reference/adrs/ADR-888-demand-save-search-from-map.md
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import { demandPlaceForStorage, withAreaShapes } from '../src/lib/demand/demand-area';
import type { DemandPlace } from '../src/types/property-demand';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

/** Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean. */
export type AreaShapesPlan =
  | { readonly kind: 'write'; readonly place: unknown }
  | { readonly kind: 'noop' }
  | { readonly kind: 'conflict' };

/** **Τι πρέπει να γραφτεί** σε αυτό το έγγραφο — χωρίς δίσκο. */
export function planAreaShapes(raw: Record<string, unknown>): AreaShapesPlan {
  const place = raw.place;
  if (typeof place !== 'object' || place === null || !('outline' in place)) return { kind: 'noop' };
  if ('shapes' in place) return { kind: 'conflict' };
  // Ο ΙΔΙΟΣ κωδικοποιητής με την υπηρεσία: ανάγνωση → μνήμη → μορφή εγγράφου (`{ring}`, χωρίς πίνακα-σε-πίνακα).
  const next = withAreaShapes(place) as DemandPlace;
  return { kind: 'write', place: demandPlaceForStorage(next) };
}

/** Firestore επιτρέπει έως 500 πράξεις ανά batch· κρατάμε περιθώριο. */
const BATCH_SIZE = 400;

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);
  console.log(`\nΠεριοχή ζήτησης → πολλά σχήματα — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collection(COLLECTIONS.PROPERTY_DEMANDS).get();
  const tally = { write: 0, noop: 0, conflict: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const plan = planAreaShapes(doc.data());
    tally[plan.kind] += 1;
    if (plan.kind === 'conflict') console.log(`  ⛔ ${doc.id}: place με outline ΚΑΙ shapes — ΔΕΝ γράφεται`);
    if (plan.kind !== 'write' || !execute) continue;
    batch.update(doc.ref, { place: plan.place });
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
    `  ${COLLECTIONS.PROPERTY_DEMANDS}: σύνολο ${snapshot.size} · προς εγγραφή ${tally.write} · ` +
      `ήδη νέο σχήμα/άλλη μορφή ${tally.noop} · σε σύγκρουση ${tally.conflict}`,
  );
  console.log(execute ? '\nΓΡΑΦΤΗΚΑΝ.\n' : '\n(dry-run, τίποτα δεν γράφτηκε)\n');
  if (tally.conflict > 0) process.exitCode = 1;
}

if (process.argv[1]?.includes('migrate-demand-area-shapes')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
