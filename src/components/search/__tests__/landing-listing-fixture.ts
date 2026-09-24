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

export type LandingOfferKind = PublicListing['offerKinds'][number];

export function landingListing(
  id: string,
  offerKinds: readonly LandingOfferKind[],
  mapped: boolean,
): PublicListing {
  return {
    id,
    title: `Τ-${id}`,
    gallery: [],
    floorplans: [],
    coverImage: null,
    authorship: 'owner-declared',
    commercial: { askingPrice: 100000, finalPrice: null, rentPrice: null, nightlyRate: null },
    commercialStatus: 'for-sale',
    offerKinds,
    position: mapped
      ? { kind: 'known', provenance: 'manual', point: { lat: 38, lng: 23 }, outline: null }
      : { kind: 'unknown', reason: 'owner-declined' },
    areaSqm: 90,
    floor: null,
    bedrooms: null,
    legality: [],
    agencyName: null,
    agencyId: null,
    priceReduction: null,
  } as unknown as PublicListing;
}
