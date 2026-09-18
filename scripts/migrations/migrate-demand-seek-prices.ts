/**
 * =============================================================================
 * ΜΕΤΑΝΑΣΤΕΥΣΗ — η τιμή της ζήτησης πάει ΣΤΗΝ ΕΝΑΛΛΑΚΤΙΚΗ (ADR-777 §8.60.15)
 * =============================================================================
 *
 * **Γιατί**: ως τις 2026-09-18 η ζήτηση είχε `seeks: ['sell', …]` και **ένα** αμονάδιστο
 * `features.priceMin/priceMax`. Το νέο σχήμα: `seeks: [{ kind, price: { min, max } }, …]` — η τιμή
 * **ανά** συναλλαγή, στη μονάδα της.
 *
 * 🔑 **Δεν είναι προϋπόθεση του deploy**: το σύνορο ανάγνωσης (`property-demand-from-document.ts`)
 * διαβάζει **και τα δύο** σχήματα και κάθε επεξεργασία γράφει το νέο. Η μετανάστευση απλώς
 * καθαρίζει τον δίσκο ώστε το παλιό σχήμα να πάψει να υπάρχει — μετά μπορεί να φύγει ο κλάδος.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Η αναβάθμιση ΔΕΝ γράφεται εδώ: καλείται ο ΕΝΑΣ `readStoredSeeks` — ο     │
 * │    ίδιος που διαβάζει κάθε οθόνη. Καμία δεύτερη λογική.                     │
 * │ 🔒 Γράφει ΜΟΝΟ `seeks` + σβήνει `features.priceMin/priceMax`. Ούτε          │
 * │    `updatedAt`: η μετανάστευση δεν είναι επεξεργασία του ανθρώπου.          │
 * │ 🔒 Ιδεμποτητική, με ξανα-κρίση ΜΕΣΑ στη συναλλαγή.                          │
 * │ ⛔ Πολλές διαθέσεις + ένα εύρος ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή: η μονάδα δεν          │
 * │    μαντεύεται (250.000 € ή €/μήνα;). Ο κάτοχος το λύνει με μία επεξεργασία. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/migrations/migrate-demand-seek-prices.ts            # ξηρό (μέτρηση)
 * npx tsx scripts/migrations/migrate-demand-seek-prices.ts --apply    # γραφή
 * ```
 *
 * @see src/lib/demand/demand-seeks-read.ts · ADR-813 (ο ΕΝΑΣ εκκινητής firebase-admin)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { LEGACY_PRICE_KEYS, readStoredSeeks } from '@/lib/demand/demand-seeks-read';
import { propertyDemandFromDocument } from '@/lib/demand/property-demand-from-document';
import type { DemandSeek } from '@/types/property-demand';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const APPLY = process.argv.slice(2).includes('--apply');

/** Η απόφαση για ένα έγγραφο — **ονομασμένη**, ποτέ `boolean`. */
export type DemandSeekPlan =
  | { readonly kind: 'write'; readonly seeks: readonly DemandSeek[] }
  | { readonly kind: 'strip-legacy' }
  | { readonly kind: 'noop' }
  | { readonly kind: 'ambiguous-price' }
  | { readonly kind: 'unreadable' };

/** Κουβαλά ακόμη το έγγραφο τα πεδία του παλιού εύρους; */
function hasLegacyPrice(features: unknown): boolean {
  return (
    typeof features === 'object' &&
    features !== null &&
    Object.keys(features).some((key) => LEGACY_PRICE_KEYS.has(key))
  );
}

/** **Τι πρέπει να γίνει σε αυτό το έγγραφο** — καθαρό, χωρίς δίσκο. */
export function planDemandSeeks(raw: Readonly<Record<string, unknown>>): DemandSeekPlan {
  const read = readStoredSeeks(raw.seeks, raw.features);
  if (read.kind !== 'read') return { kind: read.kind };
  if (read.legacy) return { kind: 'write', seeks: read.seeks };
  return hasLegacyPrice(raw.features) ? { kind: 'strip-legacy' } : { kind: 'noop' };
}

/** Οι γραφές ενός σχεδίου — **μόνο** `seeks` και η διαγραφή του παλιού εύρους. */
function updatesOf(plan: DemandSeekPlan): Record<string, unknown> | null {
  if (plan.kind !== 'write' && plan.kind !== 'strip-legacy') return null;
  const strip = Object.fromEntries(
    [...LEGACY_PRICE_KEYS].map((key) => [`features.${key}`, admin.firestore.FieldValue.delete()]),
  );
  return plan.kind === 'write' ? { seeks: plan.seeks, ...strip } : strip;
}

/** Ξανα-κρίνει **μέσα** στη συναλλαγή και γράφει· επιστρέφει το σχέδιο που **εφαρμόστηκε**. */
async function applyPlan(db: AdminFirestore, id: string): Promise<DemandSeekPlan> {
  const ref = db.collection(COLLECTIONS.PROPERTY_DEMANDS).doc(id);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const plan = planDemandSeeks((snapshot.data() ?? {}) as Record<string, unknown>);
    const updates = updatesOf(plan);
    if (updates !== null) tx.update(ref, updates);
    return plan;
  });
}

/** Μετά τη γραφή: διαβάζει **με τον πραγματικό αποκωδικοποιητή** — «έγραψε» ≠ «διαβάζεται». */
async function verifyReadable(db: AdminFirestore, id: string): Promise<boolean> {
  const snapshot = await db.collection(COLLECTIONS.PROPERTY_DEMANDS).doc(id).get();
  const raw = snapshot.data() ?? {};
  return propertyDemandFromDocument(raw, id) !== null && planDemandSeeks(raw).kind === 'noop';
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log(`\n🔁 ΜΕΤΑΝΑΣΤΕΥΣΗ τιμής ζήτησης — ADR-777 §8.60.15`);
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);

  const snapshot = await db.collection(COLLECTIONS.PROPERTY_DEMANDS).get();
  const tally = new Map<DemandSeekPlan['kind'], number>();
  let failed = false;

  for (const doc of snapshot.docs) {
    const planned = planDemandSeeks(doc.data() as Record<string, unknown>);
    const plan = APPLY && updatesOf(planned) !== null ? await applyPlan(db, doc.id) : planned;
    tally.set(plan.kind, (tally.get(plan.kind) ?? 0) + 1);
    if (plan.kind === 'ambiguous-price' || plan.kind === 'unreadable') {
      console.log(`   ⚠️  ${doc.id}: ${plan.kind} — ΚΑΜΙΑ γραφή, θέλει ανθρώπινη επεξεργασία`);
    }
    if (APPLY && updatesOf(plan) !== null && !(await verifyReadable(db, doc.id))) {
      console.log(`   ❌ ${doc.id}: γράφτηκε αλλά ΔΕΝ διαβάζεται καθαρά`);
      failed = true;
    }
  }

  console.log(`\n   έγγραφα: ${snapshot.size}`);
  for (const kind of ['write', 'strip-legacy', 'noop', 'ambiguous-price', 'unreadable'] as const) {
    console.log(`   ${kind.padEnd(16)} ${tally.get(kind) ?? 0}`);
  }
  if (!APPLY) console.log('\n   (ξηρό τρέξιμο — ξανατρέξε με --apply για γραφή)');
  process.exit(failed ? 1 : 0);
}

// Εκτελείται μόνο ως script — το `planDemandSeeks` εισάγεται από τα tests χωρίς παρενέργειες.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η μετανάστευση απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
