/**
 * **Τα κοινά fixtures της ζήτησης** — μία ζήτηση, μία αγγελία, μία «σήμερα».
 *
 * @related ADR-777 §7 (Α9) · CLAUDE.md N.18 (jscpd) · N.0.2
 * @module lib/demand/__tests__/demand-fixtures
 *
 * 🔴 **Εξήχθη όταν η δεύτερη σουίτα τα χρειάστηκε.** Γραμμένα δύο φορές, οι δύο
 * εκδοχές θα απέκλιναν — και μια δοκιμή που περνά επειδή το **fixture** της είναι
 * διαφορετικό είναι χειρότερη από καμία δοκιμή: δηλώνει κάλυψη που δεν υπάρχει.
 *
 * ⚠️ **Η «σήμερα» είναι ΣΤΑΘΕΡΗ.** Η μηχανή δέχεται την ημερομηνία ως **παράμετρο**
 * ακριβώς γι' αυτό: ένα ταίριασμα που αλλάζει απάντηση ανάλογα με το πότε τρέχει η
 * δοκιμή δεν είναι αναπαραγώγιμο, και θα έσπαγε μόνο του κάποια μέρα **χωρίς να
 * αλλάξει κώδικας**.
 */

import {
  NO_AMOUNT_RANGE,
  NO_DEMAND_FEATURES,
  demandSeek,
  type DemandAmountRange,
  type DemandSeek,
  type PropertyDemand,
} from '@/types/property-demand';
import type { OfferKind } from '@/types/property-offers';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';
import type { ListingMatchFacts } from '../demand-match-vocabulary';
import { LISTING_AVAILABILITY_UNKNOWN } from '@/types/listing-availability';
import { UNDECLARED_LISTING_OBJECTIVE_VALUE } from '@/lib/objective-value/objective-value-declarations';

/** Η σταθερή «σήμερα» όλων των σουιτών ζήτησης. */
export const TODAY = '2026-08-11';

/** Η σταθερή στιγμή αναφοράς — για τη **φρεσκάδα**, όχι για το ταίριασμα. */
export const NOW_ISO = '2026-08-11T00:00:00.000Z';

/**
 * **Μία εναλλακτική** — `seek('leaseOut', { max: 900 })` (ADR-777 §8.60.15).
 *
 * 🔑 Περνά από τον **ίδιο** κατασκευαστή με την παραγωγή (`demandSeek`): η αντιπαροχή πετά το εύρος
 * και εδώ, ώστε κανένα fixture να μην περιγράφει ζήτηση που η εφαρμογή δεν μπορεί να γράψει.
 */
export function seek(kind: OfferKind, price: Partial<DemandAmountRange> = {}): DemandSeek {
  return demandSeek(kind, { ...NO_AMOUNT_RANGE, ...price });
}

/** Η ουδέτερη ζήτηση: «οπουδήποτε, όποτε, πώληση, χωρίς όρο χαρακτηριστικών». */
export function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: 'dmnd_1',
    authorUserId: 'usr_1',
    authorCompanyId: null,
    mandate: { kind: 'self' },
    seeks: [seek('sell')],
    place: { kind: 'anywhere' },
    timing: { kind: 'whenever' },
    features: NO_DEMAND_FEATURES,
    proximity: [],
    lifeContext: null,
    title: null,
    placeLabel: null,
    ownerSignal: 'allowed',
    lifecycle: 'active',
    affirmedAt: NOW_ISO,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

/** Η ουδέτερη αγγελία: διαμέρισμα 100 τ.μ., 200.000 €, γνωστή θέση στη Θεσσαλονίκη. */
export function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null, nightlyRate: null },
    // ADR-835 §4.5 — η ουδέτερη αγγελία είναι **πώληση**, άρα `stay: null`.
    stay: null,
    exchange: null,
    // ADR-777 §8.93 — πώληση κατοικίας ⇒ η ερώτηση των κοινοχρήστων ΤΙΘΕΤΑΙ· τίποτα δηλωμένο (ό,τι γράφει ο προβολέας).
    commonCharges: { monthlyAmount: null, includes: null },
    // ADR-777 §8.94 — πώληση κτιρίου ⇒ η ερώτηση του ΠΕΑ ΤΙΘΕΤΑΙ· κανένας αριθμός δηλωμένος (ό,τι γράφει ο προβολέας).
    energyCertificate: { primaryEnergy: null, co2Emissions: null, usefulArea: null, finalEnergy: null, scope: null, absence: null },
    coverImage: null,
    gallery: [],
    // ADR-777 §8.88 — τα κουτιά μέσων έλειπαν από εδώ (το fixture είχε μείνει πίσω από το σχήμα): η κάρτα ρωτά πλέον
    // `models`/`tour` για το σήμα χωρικών μέσων, και ένα `undefined` θα έσκαγε σε κάθε σουίτα που ζωγραφίζει κάρτα.
    floorplans: [],
    models: [],
    videos: [],
    floorPlates: [],
    tour: null,
    terrain: null,
    type: 'apartment',
    areaSqm: 100,
    offerKinds: ['sell'],
    position: {
      kind: 'known',
      provenance: 'manual',
      point: { lat: 40.64, lng: 22.94 },
      locatedAt: NOW_ISO,
    },
    floor: 2,
    // ADR-777 §8.92 — έλειπε (το fixture είχε μείνει ξανά πίσω από το σχήμα· το έπιασε η Κ1 της αποκάλυψης, που
    // πλέον το συγκρίνει με τον προβολέα). `null` = «δεν δηλώθηκε είδος στάθμης», όπως τα παλαιά έγγραφα.
    floorKind: null,
    bedrooms: 3,
    title: 'Δοκιμή',
    // ✅ **ADR-842 Φ3** — τα 23 χαρακτηριστικά, ως **μία** ονομασμένη απουσία.
    //    Οκτώ fixtures θα κρατούσαν ο καθένας τη δική του λίστα `null` — δηλαδή οκτώ
    //    λίστες που συμφωνούν μέχρι την πρώτη προσθήκη πεδίου.
    ...UNASKED_LISTING_ATTRIBUTES,
    place: null,
    adminArea: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    legality: [],
    projectedAt: NOW_ISO,
    listedAt: { kind: 'unknown', reason: 'predates-record' },
    // ADR-919 §7 — η σημερινή, μετρημένη αλήθεια: κανένα κτίριο δεν έχει δηλώσει παράδοση.
    availability: LISTING_AVAILABILITY_UNKNOWN,
    // ADR-919 §10 — καμία δημόσια υπόσχεση ⇒ καμία ιστορία.
    availabilityTrack: null,
    priceReduction: null,
    objectiveValueDeclarations: UNDECLARED_LISTING_OBJECTIVE_VALUE,
    levelAreas: null,
    ...overrides,
  };
}

/**
 * Τα γεγονότα γύρω από την αγγελία — **και τα τρία κενά ανοιχτά** από προεπιλογή.
 *
 * ⚠️ Αυτή είναι η **σημερινή, μετρημένη** κατάσταση παραγωγής: το επίπεδο Α είναι
 * άδειο, η διαθεσιμότητα δεν αντλείται (`unknown`), οι αποστάσεις POI δεν μετρώνται. Ένα fixture
 * που τα γέμιζε «για ευκολία» θα δοκίμαζε τη μηχανή σε κόσμο που **δεν υπάρχει**.
 */
export function facts(overrides: Partial<ListingMatchFacts> = {}): ListingMatchFacts {
  return {
    listing: listing(),
    place: null,
    availability: LISTING_AVAILABILITY_UNKNOWN,
    proximityMetres: {},
    ...overrides,
  };
}
