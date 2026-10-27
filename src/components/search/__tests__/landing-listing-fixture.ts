/**
 * @fileoverview **ΤΗ ΜΙΑ ΨΕΥΤΙΚΗ ΑΓΓΕΛΙΑ ΤΩΝ ΣΕΛΙΔΩΝ-ΠΡΟΣΓΕΙΩΣΗΣ** — κόμβος `/` και ακτίνα `/stay`.
 * @related ADR-777 §8.82 · showcase-profile-fixture (το ίδιο μάθημα, για τα προφίλ) · CHECK 3.28
 * @module components/search/__tests__/landing-listing-fixture
 *
 * 🔴 **Έγινε κοινή τη στιγμή που απέκτησε δεύτερο αναγνώστη** (§8.82): ζούσε χειρόγραφη στο
 * `landing-tabpanel.test.tsx`, και η σουίτα της ακτίνας `/stay` θα τη χρειαζόταν **αυτούσια**.
 * Το `showcase-profile-fixture.ts` καταγράφει τι κόστισε την προηγούμενη φορά: δύο αντίγραφα,
 * το σχήμα άλλαξε, διορθώθηκε **το ένα** — το άλλο έμεινε κόκκινο σιωπηλά.
 *
 * ⚠️ **Τουλάχιστον μία με ΓΝΩΣΤΗ θέση, αλλιώς η σελίδα δεν ρωτά «πού;» καθόλου**: η κάλυψη
 * θα ήταν `no-location` ⇒ `coverageAnswersWhere` ψευδές. *(Πιάστηκε γράφοντας τη σουίτα του
 * κόμβου: με όλες τις θέσεις άγνωστες, μηδέν `role="tab"`.)*
 */

import type { PublicListing } from '@/types/public-listing';
import { publicListingFixture } from '@/test-utils/public-listing-fixture';

export type LandingOfferKind = PublicListing['offerKinds'][number];

/**
 * 🔴 **Μόνο ό,τι διαφέρει μεταξύ των αγγελιών της σελίδας** — όλα τα άλλα πεδία τα δίνει το σύνορο ανάγνωσης
 * (`publicListingFixture`). Μέχρι 2026-10-26 εδώ ζούσε χειρόγραφο αντίγραφο του σχήματος με `as unknown as`, που
 * ξέχασε το `availability` του ADR-919 ⇒ `TypeError … reading 'kind'` στην κάρτα, και οι σουίτες κόκκινες στο `main`.
 */
export function landingListing(
  id: string,
  offerKinds: readonly LandingOfferKind[],
  mapped: boolean,
): PublicListing {
  return publicListingFixture(id, {
    title: `Τ-${id}`,
    offerKinds,
    position: mapped
      ? { kind: 'known', provenance: 'manual', point: { lat: 38, lng: 23 }, outline: null }
      : { kind: 'unknown', reason: 'owner-declined' },
  });
}
