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

import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';
import type { ListingMatchFacts } from '../demand-match-vocabulary';

/** Η σταθερή «σήμερα» όλων των σουιτών ζήτησης. */
export const TODAY = '2026-08-11';

/** Η σταθερή στιγμή αναφοράς — για τη **φρεσκάδα**, όχι για το ταίριασμα. */
export const NOW_ISO = '2026-08-11T00:00:00.000Z';

/** Η ουδέτερη ζήτηση: «οπουδήποτε, όποτε, πώληση, χωρίς όρο χαρακτηριστικών». */
export function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: 'dmnd_1',
    authorUserId: 'usr_1',
    authorCompanyId: null,
    mandate: { kind: 'self' },
    seeks: ['sell'],
    place: { kind: 'anywhere' },
    timing: { kind: 'whenever' },
    features: NO_DEMAND_FEATURES,
    proximity: [],
    lifeContext: null,
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
    coverImage: null,
    gallery: [],
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
    bedrooms: 3,
    title: 'Δοκιμή',
    legality: [],
    projectedAt: NOW_ISO,
    ...overrides,
  };
}

/**
 * Τα γεγονότα γύρω από την αγγελία — **και τα τρία κενά ανοιχτά** από προεπιλογή.
 *
 * ⚠️ Αυτή είναι η **σημερινή, μετρημένη** κατάσταση παραγωγής: το επίπεδο Α είναι
 * άδειο, η διαθεσιμότητα δεν αντλείται, οι αποστάσεις POI δεν μετρώνται. Ένα fixture
 * που τα γέμιζε «για ευκολία» θα δοκίμαζε τη μηχανή σε κόσμο που **δεν υπάρχει**.
 */
export function facts(overrides: Partial<ListingMatchFacts> = {}): ListingMatchFacts {
  return {
    listing: listing(),
    place: null,
    availability: null,
    proximityMetres: {},
    ...overrides,
  };
}
