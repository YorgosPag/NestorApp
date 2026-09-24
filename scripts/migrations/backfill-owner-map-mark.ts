/**
 * =============================================================================
 * BACKFILL — το σημάδι χάρτη στο αποτύπωμα δημοσίευσης (ADR-777 §8.73.5 #1 · §8.70.7)
 * =============================================================================
 *
 * **Γιατί**: το `publication.mapMark` γράφεται από 2026-09-23. Οι αγγελίες κατόχου που
 * δημοσιεύτηκαν **πριν** δεν το έχουν ⇒ η κάρτα τους λέει μόνο «δημόσια» (`unrecorded`) και ο
 * χάρτης χαρτοφυλακίου δεν τις ζωγραφίζει, μέχρι την επόμενη αποθήκευση από τον κάτοχο.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 ΚΑΜΙΑ δεύτερη γραφή: γράφει ο ΕΝΑΣ `republishOwnerProperty` — ο ίδιος   │
 * │    με την αποθήκευση και το `/api/admin/rebuild-public-listings`.           │
 * │ 🔒 Η ξηρή πρόβλεψη τρέχει τις ΙΔΙΕΣ καθαρές συναρτήσεις με τον γραφέα:      │
 * │    `buildPublicListing` → `listingMapMark(position)`.                       │
 * │ 🔒 Στόχος = δημόσια (κατά τον ΙΔΙΟ κριτή, `ownerListingVisibility`) ΚΑΙ     │
 * │    χωρίς πεδίο `mapMark`. Ιδεμποτητικό: 2η εκτέλεση ⇒ 0 στόχοι.             │
 * │ ⛔ Πρόβλεψη «θα αποσυρόταν» ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή: η απόσυρση είναι        │
 * │    απόφαση του κατόχου, όχι παρενέργεια ενός backfill.                       │
 * │ ✔ Μετά τη γραφή ΞΑΝΑΔΙΑΒΑΖΕΙ: «έγραψε» ≠ «λέει αυτό που προβλέφθηκε».       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE (το `server-only` λύνεται όπως στο `republish-exchange-listings.ts`):
 * ```bash
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/backfill-owner-map-mark.ts
 * npx cross-env NODE_OPTIONS=--conditions=react-server tsx scripts/migrations/backfill-owner-map-mark.ts --apply
 * ```
 *
 * @see src/services/owner-property/owner-property-publication.service.ts (`stampPublication`)
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { listingMapMark, parseListingMapMark, type ListingMapMark } from '@/lib/listings/listing-map-mark';
import { readStoredOwnerProperty } from '@/lib/owner-property/owner-property-from-document';
import {
  ownerListingVisibility,
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

/** Η κρίση για ένα ακίνητο κατόχου — **ονομασμένη**, ποτέ `boolean`. */
export type MapMarkBackfillPlan =
  | { readonly kind: 'stamp'; readonly expected: ListingMapMark | null }
  | { readonly kind: 'recorded' }
  | { readonly kind: 'not-public' }
  | { readonly kind: 'would-withdraw' };

const PLAN_ORDER: readonly MapMarkBackfillPlan['kind'][] = ['stamp', 'recorded', 'not-public', 'would-withdraw'];

/** **Καθαρό**: ακίνητο → τι θα έγραφε ο γραφέας στο `mapMark`. Ίδια διαδρομή με τη σφραγίδα. */
export function planMapMarkBackfill(owner: OwnerProperty, at: string): MapMarkBackfillPlan {
  if (ownerListingVisibility(owner, at) !== 'published') return { kind: 'not-public' };
  if (owner.publication?.mapMark !== undefined) return { kind: 'recorded' };
  const projected = buildPublicListing(
    projectableFromOwnerProperty(owner, at),
    placeKnowledgeFromOwnerProperty(owner, at),
    at,
  );
  return projected === null ? { kind: 'would-withdraw' } : { kind: 'stamp', expected: listingMapMark(projected.position) };
}

/** Θα έχει **πινέζα** μετά το backfill; (αποθηκευμένο σημάδι, ή το προβλεπόμενο) */
function markedAfterBackfill(owner: OwnerProperty, plan: MapMarkBackfillPlan): boolean {
  if (plan.kind === 'stamp') return plan.expected !== null;
  return plan.kind === 'recorded' && parseListingMapMark(owner.publication?.mapMark) !== null;
}

/** Πώς διαβάζεται ένα σημάδι στην αναφορά: σχήμα, ή η δηλωμένη απουσία του. */
function markLabel(mark: ListingMapMark | null | undefined): string {
  if (mark === undefined) return '(απόν)';
  return mark === null ? 'null — βέβαιο «χωρίς σημάδι»' : `${mark.shape} @ ${mark.point.lat.toFixed(3)},${mark.point.lng.toFixed(3)}`;
}

/** Γράφει μέσω του ΕΝΟΣ γραφέα και ξαναδιαβάζει το αποτύπωμα από τον δίσκο. */
async function stampAndConfirm(db: AdminFirestore, owner: OwnerProperty, expected: ListingMapMark | null): Promise<boolean> {
  const { publish } = await republishOwnerProperty(db, owner);
  if (publish !== 'published') return false;
  const after = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(owner.id).get();
  const stored = readStoredOwnerProperty(after.data(), owner.id)?.property.publication?.mapMark;
  return JSON.stringify(stored ?? null) === JSON.stringify(expected);
}

async function main(): Promise<void> {
  const { db, projectId } = initAdminApp(admin) as { db: AdminFirestore; projectId: string };
  console.log('\n🗺️  BACKFILL σημαδιού χάρτη (publication.mapMark) — ADR-777 §8.73.5 #1');
  console.log(`   έργο: ${projectId} · τρόπος: ${APPLY ? '✍️  ΓΡΑΦΗ (--apply)' : '👁️  ΞΗΡΟ ΤΡΕΞΙΜΟ'}\n`);

  const at = nowISO();
  const snapshot = await db.collection(COLLECTIONS.OWNER_PROPERTIES).get();
  const tally = new Map<MapMarkBackfillPlan['kind'], number>();
  let unreadable = 0;
  let markedAfter = 0;
  let failed = false;

  for (const doc of snapshot.docs) {
    const owner = readStoredOwnerProperty(doc.data(), doc.id)?.property ?? null;
    if (owner === null) {
      unreadable += 1;
      console.log(`   ⚠️  ${doc.id}: δεν διαβάζεται — καμία γραφή`);
      continue;
    }
    const plan = planMapMarkBackfill(owner, at);
    tally.set(plan.kind, (tally.get(plan.kind) ?? 0) + 1);
    if (markedAfterBackfill(owner, plan)) markedAfter += 1;
    if (plan.kind === 'would-withdraw') console.log(`   ⚠️  ${doc.id} «${owner.title}»: η επανασύνθεση θα την ΑΠΕΣΥΡΕ — καμία γραφή, θέλει απόφαση`);
    if (plan.kind !== 'stamp') continue;

    console.log(`   ✍️  ${doc.id} «${owner.title}»: mapMark ${markLabel(owner.publication?.mapMark)} → ${markLabel(plan.expected)}`);
    if (!APPLY) continue;
    const ok = await stampAndConfirm(db, owner, plan.expected);
    console.log(ok ? '      ✔ γράφτηκε και διαβάζεται σωστά' : '      ❌ ΔΕΝ επιβεβαιώθηκε');
    failed = failed || !ok;
  }

  console.log(`\n   ακίνητα κατόχου: ${snapshot.size} · μη αναγνώσιμα: ${unreadable}`);
  for (const kind of PLAN_ORDER) console.log(`   ${kind.padEnd(16)} ${tally.get(kind) ?? 0}`);
  // Ο χάρτης χαρτοφυλακίου εμφανίζεται από OWNER_PORTFOLIO_MAP_MIN_MARKED σημάδια και πάνω (§8.71).
  console.log(`   σημάδια στον χάρτη χαρτοφυλακίου μετά: ${markedAfter}`);
  if (!APPLY) console.log('\n   (ξηρό τρέξιμο — τίποτα δεν γράφτηκε· ξανατρέξε με --apply)');
  process.exit(failed ? 1 : 0);
}

// Εκτελείται μόνο ως script — το καθαρό μέρος εισάγεται χωρίς παρενέργειες.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('\n❌ Το backfill απέτυχε:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
