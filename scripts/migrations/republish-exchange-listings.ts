/**
 * =============================================================================
 * ΕΠΑΝΑΠΡΟΒΟΛΗ — οι αγγελίες αντιπαροχής αποκτούν το ποσοστό τους (ADR-777 §8.60.17.6 #1)
 * =============================================================================
 *
 * **Γιατί**: ο κρίκος 12 (`exchange: { landownerShare }`) μπήκε στην προβολή στις 2026-09-18.
 * Οι αγγελίες αντιπαροχής που γράφτηκαν **πριν** λένε «προς συζήτηση» ως την επόμενη
 * αποθήκευση του ακινήτου — ακόμη κι όταν ο κάτοχος **έχει** δηλώσει ποσοστό.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 ΚΑΜΙΑ δεύτερη προβολή: η γραφή είναι ο ΕΝΑΣ `republishOwnerProperty` —  │
 * │    ο ίδιος που τρέχει στην αποθήκευση και στο `/api/admin/rebuild-…`.       │
 * │ 🔒 Η ξηρή κρίση «τι θα γραφτεί» τρέχει τις ΙΔΙΕΣ καθαρές συναρτήσεις        │
 * │    (`projectableFromOwnerProperty` → `buildPublicListing`) — όχι αντίγραφο. │
 * │ 🔒 Αγγίζει ΜΟΝΟ ό,τι είναι μπαγιάτικο. Ιδεμποτητικό: 2η εκτέλεση ⇒ 0.       │
 * │ ⛔ Αγγελία που ο κριτής θα ΑΠΕΣΥΡΕ ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή: η απόσυρση δεν    │
 * │    είναι δουλειά μιας επαναπροβολής όρου — είναι απόφαση του κατόχου.      │
 * │ ⛔ Επαγγελματίας (`properties`): καμία πηγή ποσοστού σε αυτή την πλευρά ⇒   │
 * │    η επαναπροβολή δεν θα άλλαζε τίποτα· αναφέρεται ονομαστικά.             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE (το `server-only` λύνεται με τον δηλωμένο μηχανισμό του πακέτου — βλ.
 * `backfill-first-contact-offerer.ts`):
 * ```bash
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/republish-exchange-listings.ts
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/republish-exchange-listings.ts --apply
 * ```
 *
 * @see src/services/owner-property/owner-property-publication.service.ts · ADR-813
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { readStoredOwnerProperty } from '@/lib/owner-property/owner-property-from-document';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { buildPublicListing } from '@/services/listings/public-listing-projection';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminApp } = require('../_shared/firebaseAdminOps');

const APPLY = process.argv.slice(2).includes('--apply');

/** Το αποθηκευμένο ποσοστό: αριθμός, `null` («προς συζήτηση») ή **απόν πεδίο** (πριν τον κρίκο 12). */
type StoredShare = number | null | 'absent';

/** Η απόφαση για μία αγγελία — **ονομασμένη**, ποτέ `boolean`. */
export type ExchangeRepublishPlan =
  | { readonly kind: 'republish'; readonly stored: StoredShare; readonly expected: number | null }
  | { readonly kind: 'current'; readonly stored: StoredShare }
  | { readonly kind: 'would-withdraw' }
  | { readonly kind: 'professional' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'orphan' };

const PLAN_KINDS: readonly ExchangeRepublishPlan['kind'][] = [
  'republish', 'current', 'would-withdraw', 'professional', 'unreadable', 'orphan',
];

/** Τι κρατά **σήμερα** η δημόσια αγγελία — ωμά, ώστε το απόν πεδίο να μη γίνει σιωπηλά `null`. */
export function storedShareOf(listing: Readonly<Record<string, unknown>>): StoredShare {
  const exchange = listing.exchange;
  if (typeof exchange !== 'object' || exchange === null || !('landownerShare' in exchange)) {
    return 'absent';
  }
  const share = (exchange as { landownerShare: unknown }).landownerShare;
  return typeof share === 'number' ? share : null;
}

/** **Καθαρό**: αγγελία + ακίνητο κατόχου → τι πρέπει να γίνει. Η προβολή είναι η ΙΔΙΑ του γραφέα. */
export function planOwnerExchange(
  listing: Readonly<Record<string, unknown>>,
  owner: OwnerProperty,
  at: string,
): ExchangeRepublishPlan {
  const projected = buildPublicListing(
    projectableFromOwnerProperty(owner, at),
    placeKnowledgeFromOwnerProperty(owner, at),
    at,
  );
  if (projected === null) return { kind: 'would-withdraw' };

  const expected = projected.exchange?.landownerShare ?? null;
  const stored = storedShareOf(listing);
  return stored === expected ? { kind: 'current', stored } : { kind: 'republish', stored, expected };
}

/** Βρίσκει την πηγή της αγγελίας και την κρίνει. */
async function planListing(
  db: AdminFirestore,
  id: string,
  listing: Record<string, unknown>,
  at: string,
): Promise<{ plan: ExchangeRepublishPlan; owner: OwnerProperty | null }> {
  const ownerDoc = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(id).get();
  if (ownerDoc.exists) {
    const owner = readStoredOwnerProperty(ownerDoc.data(), id)?.property ?? null;
    if (owner === null) return { plan: { kind: 'unreadable' }, owner: null };
    return { plan: planOwnerExchange(listing, owner, at), owner };
  }
  const professional = await db.collection(COLLECTIONS.PROPERTIES).doc(id).get();
  return { plan: { kind: professional.exists ? 'professional' : 'orphan' }, owner: null };
}

/** Γράφει μέσω του ΕΝΟΣ γραφέα και ξαναδιαβάζει: «έγραψε» ≠ «λέει αυτό που έπρεπε». */
async function applyAndVerify(
  db: AdminFirestore,
  owner: OwnerProperty,
  expected: number | null,
): Promise<boolean> {
  const { publish } = await republishOwnerProperty(db, owner);
  if (publish !== 'published') return false;
  const after = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(owner.id).get();
  return storedShareOf(after.data() ?? {}) === expected;
}

function describe(id: string, plan: ExchangeRepublishPlan): string {
  switch (plan.kind) {
    case 'republish': return `   ✍️  ${id}: ${String(plan.stored)} → ${String(plan.expected)}`;
    case 'current': return `   ✅ ${id}: ήδη ${String(plan.stored)}`;
    case 'would-withdraw': return `   ⚠️  ${id}: ο κριτής θα την ΑΠΕΣΥΡΕ — καμία γραφή, θέλει απόφαση`;
    case 'professional': return `   ℹ️  ${id}: επαγγελματίας — καμία πηγή ποσοστού, τίποτα να αλλάξει`;
    case 'unreadable': return `   ⚠️  ${id}: το ακίνητο κατόχου δεν διαβάζεται — καμία γραφή`;
    case 'orphan': return `   ⚠️  ${id}: αγγελία χωρίς πηγή — καμία γραφή (δουλειά του rebuild)`;
  }
}

/**
 * **Το αντίστροφο ερώτημα**: ακίνητα κατόχου με αντιπαροχή που **δεν** έχουν αγγελία.
 *
 * 🔴 Χωρίς αυτό, «0 αγγελίες αντιπαροχής» δεν ξεχωρίζει το *«καμία δεν υπάρχει»* από το
 * *«καμία δεν γράφτηκε»*. Ρωτά τον **ίδιο** κριτή (`buildPublicListing`). ⛔ **Μόνο αναφορά**:
 * η πρώτη δημοσίευση είναι πράξη του κατόχου (αποθήκευση) ή του `rebuild`, όχι επαναπροβολή όρου.
 */
async function reportUnlistedOwners(
  db: AdminFirestore,
  listedIds: ReadonlySet<string>,
  at: string,
): Promise<void> {
  const owners = await db.collection(COLLECTIONS.OWNER_PROPERTIES).get();
  for (const doc of owners.docs) {
    if (listedIds.has(doc.id)) continue;
    const owner = readStoredOwnerProperty(doc.data(), doc.id)?.property ?? null;
    if (owner === null || !owner.offers.some((offer) => offer.kind === 'exchange')) continue;
    const projected = buildPublicListing(
      projectableFromOwnerProperty(owner, at),
      placeKnowledgeFromOwnerProperty(owner, at),
      at,
    );
    console.log(
      projected === null
        ? `   ℹ️  ${doc.id}: αντιπαροχή χωρίς αγγελία — ο κριτής ΣΥΜΦΩΝΕΙ (μη δημοσιεύσιμο)`
        : `   ⚠️  ${doc.id}: αντιπαροχή χωρίς αγγελία ενώ ο κριτής θα τη δημοσίευε — δουλειά του rebuild`,
    );
  }
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log(`\n🔁 ΕΠΑΝΑΠΡΟΒΟΛΗ αγγελιών αντιπαροχής — ADR-777 §8.60.17.6 #1`);
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}`);

  const at = nowISO();
  const snapshot = await db
    .collection(COLLECTIONS.PUBLIC_LISTINGS)
    .where('offerKinds', 'array-contains', 'exchange')
    .get();
  const tally = new Map<ExchangeRepublishPlan['kind'], number>();
  let failed = false;

  for (const doc of snapshot.docs) {
    const { plan, owner } = await planListing(db, doc.id, doc.data(), at);
    tally.set(plan.kind, (tally.get(plan.kind) ?? 0) + 1);
    console.log(describe(doc.id, plan));
    if (APPLY && plan.kind === 'republish' && owner !== null) {
      const ok = await applyAndVerify(db, owner, plan.expected);
      console.log(ok ? '      ✔ γράφτηκε και διαβάζεται σωστά' : '      ❌ ΔΕΝ επιβεβαιώθηκε');
      failed = failed || !ok;
    }
  }

  await reportUnlistedOwners(db, new Set(snapshot.docs.map((doc) => doc.id)), at);

  console.log(`\n   αγγελίες αντιπαροχής: ${snapshot.size}`);
  for (const kind of PLAN_KINDS) console.log(`   ${kind.padEnd(16)} ${tally.get(kind) ?? 0}`);
  if (!APPLY) console.log('\n   (ξηρό τρέξιμο — ξανατρέξε με --apply για γραφή)');
  process.exit(failed ? 1 : 0);
}

// Εκτελείται μόνο ως script — τα καθαρά μέρη εισάγονται χωρίς παρενέργειες.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Η επαναπροβολή απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
