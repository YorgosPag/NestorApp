/**
 * **ΠΟΙΟΣ ΔΕΙΧΝΕΙ ΑΝΤΙΚΕΙΜΕΝΙΚΗ ΧΩΡΙΣ ΝΑ ΤΟ ΕΠΕΛΕΞΕ** — ADR-898 §23.2. **Μόνο ανάγνωση.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ως τις 2026-11-21 η προεπιλογή του `objectiveValueDeclarations.display` ήταν `shown`, και κάθε απάντηση στη φόρμα
 * γράφει **ολόκληρο** το μπλοκ. Άρα ένα αποθηκευμένο `shown` **δεν** αποδεικνύει επιλογή. Πριν αποφασιστεί **πώς**
 * γίνεται η μετάπτωση, μετράται **πόσα** και **ποια** — με τον **ίδιο** κριτή διάθεσης που κρίνει τη σελίδα
 * (`offersObjectiveValue`), ώστε «φαίνεται στο κοινό» εδώ να σημαίνει ό,τι και εκεί.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 ΚΑΜΙΑ γραφή. Ούτε `--apply`: η γραφή, αν χρειαστεί, είναι άλλη απόφαση. │
 * │ 🔒 Διαβάζει το ΩΜΟ πεδίο: ο αναγνώστης κανονικοποιεί, και θα έκρυβε την      │
 * │    απουσία πίσω από την προεπιλογή.                                         │
 * │ 🔒 Τρεις συλλογές: ιδιώτες · εταιρεία · δημόσιες αγγελίες (η αγγελία μπορεί │
 * │    να κρατά ακόμη `shown` από πριν την τελευταία της προβολή).               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/objective-value-display-consent.report.ts
 * ```
 *
 * @see docs/centralized-systems/reference/adrs/ADR-898-objective-value-calculator.md §23.2
 */

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { offersObjectiveValue } from '@/lib/objective-value/objective-value-offer-kinds';
import { isOfferKind, type OfferKind } from '@/types/property-offers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const SHOWN_FIELD = 'objectiveValueDeclarations.display';

/** Μια γραμμή της αναφοράς — **ονομασμένη** η κρίση, ποτέ `boolean`. */
export interface ConsentRow {
  readonly collection: 'owner_properties' | 'properties' | 'public_listings';
  readonly id: string;
  readonly offerKinds: readonly OfferKind[];
  readonly audience: 'public' | 'not-offered';
}

/** Τα είδη διάθεσης ενός ωμού εγγράφου — `offers[].kind` (ιδιώτης) · `offerKinds` (αγγελία) · `offers[].kind` (εταιρεία). */
export function offerKindsOf(data: Readonly<Record<string, unknown>>): OfferKind[] {
  if (Array.isArray(data.offerKinds)) return data.offerKinds.filter(isOfferKind);
  if (!Array.isArray(data.offers)) return [];
  return data.offers
    .map((offer: unknown) => (typeof offer === 'object' && offer !== null ? (offer as { kind?: unknown }).kind : null))
    .filter(isOfferKind);
}

/** **Καθαρό**: ωμό έγγραφο → γραμμή. Ο κριτής είναι ο ΕΝΑΣ της σελίδας. */
export function consentRowOf(collection: ConsentRow['collection'], id: string, data: Readonly<Record<string, unknown>>): ConsentRow {
  const offerKinds = offerKindsOf(data);
  return { collection, id, offerKinds, audience: offersObjectiveValue(offerKinds) ? 'public' : 'not-offered' };
}

async function shownIn(db: AdminFirestore, collection: ConsentRow['collection'], name: string): Promise<ConsentRow[]> {
  const snapshot = await db.collection(name).where(SHOWN_FIELD, '==', 'shown').get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot) => consentRowOf(collection, doc.id, doc.data()));
}

function describe(row: ConsentRow): string {
  const kinds = row.offerKinds.length === 0 ? '—' : row.offerKinds.join('+');
  const verdict = row.audience === 'public' ? '⚠️  ΦΑΙΝΕΤΑΙ στο κοινό' : 'ℹ️  δεν φαίνεται (όχι πώληση)';
  return `   ${verdict} · ${row.collection}/${row.id} · ${kinds}`;
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log(`\n👁️  ΑΝΑΦΟΡΑ «display: shown» — ADR-898 §23.2 · έργο: ${projectId} · μόνο ανάγνωση`);

  const rows = [
    ...(await shownIn(db, 'owner_properties', COLLECTIONS.OWNER_PROPERTIES)),
    ...(await shownIn(db, 'properties', COLLECTIONS.PROPERTIES)),
    ...(await shownIn(db, 'public_listings', COLLECTIONS.PUBLIC_LISTINGS)),
  ];
  for (const row of rows) console.log(describe(row));

  const count = (collection: ConsentRow['collection'], audience: ConsentRow['audience']) =>
    rows.filter((row) => row.collection === collection && row.audience === audience).length;
  console.log('\n   συλλογή             φαίνεται  δεν φαίνεται');
  for (const collection of ['owner_properties', 'properties', 'public_listings'] as const) {
    console.log(`   ${collection.padEnd(20)}${String(count(collection, 'public')).padEnd(10)}${count(collection, 'not-offered')}`);
  }
  process.exit(0);
}

// Εκτελείται μόνο ως script — τα καθαρά μέρη εισάγονται χωρίς παρενέργειες.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η αναφορά απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
