/**
 * **ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΣΩΜΑ ΑΓΓΕΛΙΩΝ, ΑΝΤΙΓΡΑΜΜΕΝΟ ΜΙΑ ΦΟΡΑ** — ADR-777 §8.52.
 *
 * @related ADR-777 §8.52 · `lib/criteria/listing-criterion-reading`
 * @module lib/demand/__tests__/__fixtures__/public-listings-corpus
 *
 * Οκτώ αγγελίες, αντιγραμμένες από το `public_listings` του Firestore στις
 * **2026-09-05**, με **μόνο** τα πεδία που ρωτά ο `readNumericAnswer`: είδος, εμβαδόν,
 * όροφος, υπνοδωμάτια, και το εμπορικό μπλοκ από το οποίο προκύπτει η τιμή.
 *
 * 🔑 **Χτίζεται με το ΥΠΑΡΧΟΝ εργοστάσιο** (`demand-fixtures.listing`) — ένας δεύτερος
 * κατασκευαστής `PublicListing` θα απέκλινε στην πρώτη προσθήκη πεδίου, και μια δοκιμή
 * που περνά επειδή το fixture της είναι διαφορετικό δηλώνει κάλυψη που δεν υπάρχει.
 *
 * 🔴 **ΤΙ ΜΠΟΡΕΙ ΚΑΙ ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΑΠΟΔΕΙΞΕΙ ΑΥΤΟ ΤΟ ΣΩΜΑ — ΔΙΑΒΑΣΕ ΤΟ ΠΡΙΝ ΤΟ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ:**
 *
 * Οι τίτλοι το λένε μόνοι τους — *«ΔΟΚΙΜΗ Α — Ενοικίαση ΜΕ ενοίκιο»*, *«ΔΟΚΙΜΗ Β —
 * Ενοικίαση ΧΩΡΙΣ ενοίκιο»*, *«TEST-2 ADR-834»*. Είναι **χειροποίητα δοκίμια**, όχι
 * αγορά. Άρα:
 *
 * | Ερώτημα | Απαντιέται εδώ; |
 * |---|---|
 * | *«υπάρχει αγγελία χωρίς τιμή;»* | ✅ **ναι** — ισχυρισμός **υπάρξεως** |
 * | *«υπάρχει γη που δεν σηκώνει την ερώτηση ορόφου;»* | ✅ **ναι** |
 * | *«σε ΤΙ ΠΟΣΟΣΤΟ των αγγελιών λείπει η τιμή;»* | ❌ **ΟΧΙ** |
 *
 * ⚠️ Το «1 στις 8» **δεν είναι ποσοστό της αγοράς** — είναι μέτρηση του τι
 * πληκτρολόγησε κάποιος όταν έφτιαχνε δοκίμια, και μάλιστα **σκόπιμα**: δύο από τα
 * οκτώ φτιάχτηκαν για να δοκιμάσουν ακριβώς την απουσία τιμής. Ένας αριθμός που
 * παράγεται από τον σχεδιασμό του δείγματος και μετά διαβάζεται ως ιδιότητα του
 * κόσμου είναι το ίδιο σχήμα με το «`0` σημαίνει ότι κανείς δεν κοίταξε».
 */

import type { PublicListing } from '@/types/public-listing';
import { listing } from '../demand-fixtures';

/**
 * Το σώμα της **2026-09-05**. Η σειρά είναι του Firestore, ώστε μια επόμενη
 * αντιγραφή να συγκρίνεται γραμμή προς γραμμή.
 */
export const LISTING_CORPUS_2026_09_05: readonly PublicListing[] = [
  // ── Δύο ΟΙΚΟΠΕΔΑ: εμβαδόν ναι, όροφος/υπνοδωμάτια **εκ κατασκευής** null ───────
  listing({
    id: 'ownp_330a5a4b-3d36-41a6-8f61-b5a85f1ae9d1',
    title: 'TEST-2 ADR-834',
    type: 'plot',
    areaSqm: 500,
    floor: null,
    bedrooms: null,
    offerKinds: ['sell'],
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 150_000, finalPrice: null, rentPrice: null, nightlyRate: null },
    authorship: 'owner-declared',
  }),
  listing({
    id: 'ownp_697570ad-4f47-4b8d-aabb-78cb11e6b88d',
    title: 'TEST-6 ADR-841 O-20 katopsi',
    type: 'plot',
    areaSqm: 450,
    floor: null,
    bedrooms: null,
    offerKinds: ['sell'],
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 180_000, finalPrice: null, rentPrice: null, nightlyRate: null },
    authorship: 'owner-declared',
  }),

  // ── Έξι κτίσματα ──────────────────────────────────────────────────────────────
  listing({
    id: 'prop_2d612992-32fd-4ec3-b459-38c9882f7017',
    title: 'Μεζονέτα 95 τ.μ.',
    type: 'maisonette',
    areaSqm: 95,
    floor: 1,
    bedrooms: 3,
    offerKinds: ['sell'],
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null, nightlyRate: null },
  }),
  listing({
    id: 'prop_48a7caf6-ddeb-4f6b-a074-2d3ddb9daa3b',
    title: 'Διαμέρισμα 95 τ.μ.',
    type: 'apartment',
    areaSqm: 95,
    // ⚠️ **Ισόγειο = `0`, όχι απουσία.** Ένας αναγνώστης που έγραφε `listing.floor ||`
    // θα το κατέτασσε στη σιωπή — η διάκριση «0 ⇄ null» είναι ολόκληρη η Α5.
    floor: 0,
    bedrooms: 3,
    offerKinds: ['sell'],
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 170_000, finalPrice: null, rentPrice: null, nightlyRate: null },
  }),
  listing({
    id: 'prop_a0000001-7777-4aaa-8aaa-000000000001',
    title: 'ΔΟΚΙΜΗ Α — Ενοικίαση ΜΕ ενοίκιο',
    type: 'apartment',
    areaSqm: 80,
    floor: 1,
    bedrooms: 2,
    offerKinds: ['leaseOut'],
    commercialStatus: 'for-rent',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: 500, nightlyRate: null },
  }),
  // 🔴 **Η ΑΓΓΕΛΙΑ ΠΟΥ ΚΑΝΕΙ ΤΟ ΨΕΜΑ ΠΡΟΣΒΑΣΙΜΟ**: ζητά ενοικίαση και **δεν δηλώνει
  //    ενοίκιο**. Σήμερα η μηχανή της ζήτησης τη λογίζει `price-above`, δηλαδή «είναι
  //    πιο ακριβή απ' όσο θέλεις» — για τιμή που **κανείς δεν ξέρει**.
  listing({
    id: 'prop_a0000002-7777-4aaa-8aaa-000000000002',
    title: 'ΔΟΚΙΜΗ Β — Ενοικίαση ΧΩΡΙΣ ενοίκιο',
    type: 'apartment',
    areaSqm: 70,
    floor: 1,
    bedrooms: 1,
    offerKinds: ['leaseOut'],
    commercialStatus: 'for-rent',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null },
  }),
  listing({
    id: 'prop_a0000003-7777-4aaa-8aaa-000000000003',
    title: 'ΔΟΚΙΜΗ Γ — Πώληση ΚΑΙ Ενοικίαση',
    type: 'apartment',
    areaSqm: 110,
    floor: 2,
    bedrooms: 3,
    offerKinds: ['leaseOut', 'sell'],
    commercialStatus: 'for-sale-and-rent',
    commercial: { askingPrice: 250_000, finalPrice: null, rentPrice: 700, nightlyRate: null },
  }),
  listing({
    id: 'prop_a0000004-7777-4aaa-8aaa-000000000004',
    title: 'ΔΟΚΙΜΗ Δ — Πώληση+Ενοικ. ΧΩΡΙΣ ενοίκιο',
    type: 'apartment',
    areaSqm: 120,
    floor: 2,
    bedrooms: 3,
    offerKinds: ['leaseOut', 'sell'],
    commercialStatus: 'for-sale-and-rent',
    commercial: { askingPrice: 260_000, finalPrice: null, rentPrice: null, nightlyRate: null },
  }),
];
