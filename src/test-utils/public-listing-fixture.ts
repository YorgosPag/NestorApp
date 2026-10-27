/**
 * @fileoverview **ΤΟ ΕΝΑ FIXTURE ΔΗΜΟΣΙΑΣ ΑΓΓΕΛΙΑΣ** — χτίζεται από το **ΙΔΙΟ** σύνορο ανάγνωσης με την παραγωγή.
 * @module test-utils/public-listing-fixture
 * @related ADR-839 (αλυσίδα σχήματος) · ADR-919 §7 · CHECK 3.74 · lib/listings/public-listing-from-document.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΚΑΘΕ ΝΕΟ ΠΕΔΙΟ ΑΦΗΝΕ ΠΙΣΩ ΤΟΥ FIXTURES ΠΟΥ ΛΕΝΕ ΨΕΜΑΤΑ (μετρημένο 2026-10-26)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ADR-919 βήμα 7 (`56e90890`) έκανε το `availability` **υποχρεωτικό** στο `PublicListing` και το κατανάλωσε στην
 * κάρτα (`ListingDeliveryBadge` ⇒ `availability.kind`). Το χειρόγραφο fixture της σελίδας-προσγείωσης πήρε το
 * `availabilityTrack` του ίδιου commit αλλά **όχι** το `availability` ⇒ `TypeError … reading 'kind'`, κόκκινο στο
 * `main`. Ο κώδικας ήταν σωστός: το σύνορο ανάγνωσης γεμίζει το πεδίο με τον κρίκο 25. Ψέματα έλεγε το fixture.
 *
 * Το ίδιο σχήμα είναι γραμμένο **τρεις φορές** στο `ListingDetailContent.test.tsx` (`models` · `videos` ·
 * `floorPlates`), και ο τύπος **δεν** βοηθά: το `tsconfig` αποκλείει τα `__tests__` και το jest τρέχει με
 * `@swc/jest` ⇒ κανένα fixture μέσα σε σουίτα **δεν τυποελέγχεται ποτέ**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΘΕΡΑΠΕΙΑ ΤΗΣ ΚΛΑΣΗΣ — ΤΟ ΠΡΟΤΥΠΟ ΤΟΥ PROTOBUF (default instance), ΟΧΙ ΤΡΙΤΟΣ ΚΑΘΡΕΦΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα «πλήρες» χειρόγραφο αντικείμενο εδώ θα ήταν άλλη μια λίστα πεδίων που παλιώνει (ADR-736 §5.3 — η κλάση που το
 * `public-listing-schema.ts` αρνείται ρητά). Αντί γι' αυτό, το fixture είναι **έγγραφο της πρώτης έκδοσης** που
 * περνά από το `publicListingFromDocument` — την **ίδια** πόρτα που περνά κάθε αγγελία της βάσης. Η αλυσίδα
 * μεταναστεύσεων γεμίζει κάθε πεδίο που προστέθηκε από τότε, και το CHECK 3.74 εγγυάται ότι ο **επόμενος** κρίκος
 * θα γραφτεί. Αποτέλεσμα: **νέο υποχρεωτικό πεδίο = μηδέν αλλαγές εδώ**.
 *
 * ⚠️ **Τα πεδία που δίνει ο καλών περνούν κι αυτά από την αλυσίδα** — άρα ό,τι δεν θα επιβίωνε την ανάγνωση στην
 * παραγωγή (σκουπίδι σε `availability`, `terrain` κ.λπ.) **δεν** επιβιώνει ούτε εδώ. Είναι σκόπιμο: μια σουίτα που
 * αποδίδει αγγελία που η βάση δεν μπορεί να επιστρέψει, δοκιμάζει κόσμο που δεν υπάρχει. Οι έγκυρες τιμές μένουν
 * αυτούσιες (Κ3 — ιδιοδυναμία κάθε κρίκου, `public-listing-schema.test.ts`).
 *
 * ```ts
 * import { publicListingFixture } from '@/test-utils/public-listing-fixture';
 * const listing = publicListingFixture('prop_a', { offerKinds: ['leaseOut'], areaSqm: 70 });
 * ```
 */

import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import type { StoredListingDocument } from '@/lib/listings/public-listing-schema-types';
import type { PublicListing } from '@/types/public-listing';

/**
 * **Τα πεδία της έκδοσης 1** — ό,τι έγραφε ο πρώτος γραφέας, με ουδέτερες τιμές.
 *
 * 🔑 **Δεν είναι λίστα του σημερινού σχήματος, και δεν πρέπει να γίνει**: είναι το σημείο εκκίνησης της αλυσίδας
 * (ίδιο σύνολο κλειδιών με το `PRODUCTION_V1` της Κ7). Καμία σφραγίδα `schemaVersion` ⇒ η ανάγνωση τρέχει
 * **όλους** τους κρίκους, όπως σε κάθε αφρόντιστο έγγραφο της βάσης.
 */
const FIRST_SCHEMA_DOCUMENT: StoredListingDocument = {
  commercialStatus: 'for-sale',
  commercial: { askingPrice: 100000, finalPrice: null, rentPrice: null },
  coverImage: null,
  gallery: [],
  type: 'apartment',
  areaSqm: 90,
  offerKinds: ['sell'],
  position: { kind: 'unknown', reason: 'never-asked' },
  place: null,
  floor: null,
  bedrooms: null,
  title: 'fixture-listing',
  authorship: 'owner-declared',
  agencyName: null,
  agencyId: null,
  projectedAt: '2026-09-01T09:00:00.000Z',
};

/** Δημόσια αγγελία όπως θα την επέστρεφε η ανάγνωση της παραγωγής — με τα `fields` του καλούντος από πάνω. */
export function publicListingFixture(id: string, fields: Partial<PublicListing> = {}): PublicListing {
  const listing = publicListingFromDocument({ ...FIRST_SCHEMA_DOCUMENT, ...fields }, id);
  // Αδύνατο για αντικείμενο (μόνη άρνηση: «δεν είναι καν αντικείμενο») — αλλά ποτέ σιωπηλό `null` σε fixture.
  if (listing === null) throw new Error(`publicListingFixture(${id}) — read boundary rejected the document`);
  return listing;
}
