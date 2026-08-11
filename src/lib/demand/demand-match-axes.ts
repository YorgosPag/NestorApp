/**
 * @fileoverview **ΕΝΑΣ ΑΞΟΝΑΣ, ΜΙΑ ΕΡΩΤΗΣΗ** — τι εμποδίζει, και πόσο λείπει.
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.2 · §12.6
 * @module lib/demand/demand-match-axes
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΖΕΙ ΕΔΩ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΧΩΡΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι **πέντε** άξονες, ο καθένας απαντά **μόνος του** και **δεν ξέρει** τι σημαίνει
 * η απάντησή του: αν ένα εμπόδιο κάνει το αποτέλεσμα `near-miss` ή `no-match` το
 * αποφασίζει το `demand-matching.ts`. Ο διαχωρισμός δεν είναι διακοσμητικός — είναι
 * αυτό που επιτρέπει να δοκιμαστεί **κάθε άξονας μόνος του**, χωρίς να στηθεί
 * ολόκληρη ετυμηγορία, και να αλλάξει η **πολιτική** (`NEAR_MISS_MAX_AXES`) χωρίς να
 * αγγιχτεί κανένα κριτήριο.
 *
 * 🔑 **Τα κοινά πρωτόγονα έρχονται από τους υπάρχοντες SSoT, ποτέ ξαναγραμμένα:**
 * `withinRange` (`listing-filters.ts`) · `getEffectivePrice` (`price-resolver.ts`) ·
 * `distanceMeters` (`lib/geo/geo-distance.ts`) · `isPointInGeoOutline` (`geo-ring.ts`).
 * Έτσι ο χάρτης, η λίστα και η μηχανή **δεν μπορούν** να διαφωνήσουν για το ίδιο ερώτημα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React/Firestore.
 */

import { getEffectivePrice } from '@/lib/properties/price-resolver';
import { withinRange } from '@/lib/listings/listing-filters';
import { isPointInGeoOutline } from '@/lib/geo/geo-ring';
import { distanceMeters } from '@/lib/geo/geo-distance';
import type { PublicListing } from '@/types/public-listing';
import type { DemandTiming, PropertyDemand } from '@/types/property-demand';
import {
  NO_GAPS,
  type DemandBlocker,
  type DemandGaps,
  type ListingAvailability,
  type ListingMatchFacts,
} from './demand-match-vocabulary';

// =============================================================================
// ΟΙ ΑΞΟΝΕΣ
// =============================================================================

/** Είδος διάθεσης + είδος ακινήτου. Ίδια κατηγορήματα με το φίλτρο της οθόνης. */
export function categoryBlockers(demand: PropertyDemand, listing: PublicListing): DemandBlocker[] {
  const found: DemandBlocker[] = [];

  if (!listing.offerKinds.some((kind) => demand.seeks.includes(kind))) {
    found.push('offer-kind');
  }
  const { types } = demand.features;
  if (types.length > 0 && !types.includes(listing.type)) {
    found.push('property-type');
  }

  return found;
}

/** Τιμή · εμβαδόν · υπνοδωμάτια · όροφος — με το **πόσο** μαζί. */
export function numericOutcome(
  demand: PropertyDemand,
  listing: PublicListing,
): { blockers: DemandBlocker[]; gaps: DemandGaps } {
  const f = demand.features;
  const blockers: DemandBlocker[] = [];
  const gaps: { -readonly [K in keyof DemandGaps]: DemandGaps[K] } = { ...NO_GAPS };

  const price = getEffectivePrice(listing)?.amount ?? null;
  if (!withinRange(price, f.priceMin, f.priceMax)) {
    if (price !== null && f.priceMax !== null && price > f.priceMax) {
      blockers.push('price-above');
      gaps.priceOverBy = price - f.priceMax;
    }
    if (price !== null && f.priceMin !== null && price < f.priceMin) {
      blockers.push('price-below');
      gaps.priceUnderBy = f.priceMin - price;
    }
    // ⚠️ Αγγελία ΧΩΡΙΣ τιμή: το `withinRange` λέει «όχι» και **δεν υπάρχει πόσο**.
    // Λογίζεται ως `price-above` χωρίς κενό θα ήταν ψέμα· εδώ μένει άρνηση χωρίς
    // μετρήσιμο εμπόδιο, δηλαδή ⇒ `no-match` (βλ. τη λογιστική στο §6).
    if (price === null) blockers.push('price-above');
  }

  if (!withinRange(listing.areaSqm, f.areaMin, f.areaMax)) {
    const area = listing.areaSqm;
    if (area !== null && f.areaMin !== null && area < f.areaMin) {
      blockers.push('area-below');
      gaps.areaShortBy = f.areaMin - area;
    }
    if (area !== null && f.areaMax !== null && area > f.areaMax) {
      blockers.push('area-above');
      gaps.areaOverBy = area - f.areaMax;
    }
    if (area === null) blockers.push('area-below');
  }

  if (f.bedroomsMin !== null) {
    if (listing.bedrooms === null) {
      blockers.push('bedrooms-below');
    } else if (listing.bedrooms < f.bedroomsMin) {
      blockers.push('bedrooms-below');
      gaps.bedroomsShortBy = f.bedroomsMin - listing.bedrooms;
    }
  }

  if (!withinRange(listing.floor, f.floorMin, f.floorMax)) blockers.push('floor-outside');

  return { blockers, gaps };
}

/** Χωρικός άξονας — και η **μόνη** θέση που η θέση της αγγελίας κρίνεται. */
export function spatialOutcome(
  demand: PropertyDemand,
  facts: ListingMatchFacts,
): { blockers: DemandBlocker[]; distanceOverMetres: number | null } {
  const { place } = demand;

  if (place.kind === 'anywhere') return { blockers: [], distanceOverMetres: null };

  if (place.kind === 'place') {
    // 🔴 Ο δεσμός προς το επίπεδο Α **δεν υπάρχει ακόμη στα δεδομένα**. Η μηχανή δεν
    // μαντεύει από συντεταγμένες: «ίδιο σημείο» δεν είναι «ίδιο κτίριο», και η Α5
    // απαγορεύει ρητά να μετατρέπουμε άγνοια σε ισχυρισμό.
    if (facts.place === null) return { blockers: ['place-unresolved'], distanceOverMetres: null };
    const sameLand = facts.place.landId === place.landId;
    const sameBuilding =
      place.buildingId === null || facts.place.buildingId === place.buildingId;
    return {
      blockers: sameLand && sameBuilding ? [] : ['other-place'],
      distanceOverMetres: null,
    };
  }

  // `near` και `area` απαιτούν και τα δύο **γνωστή** θέση.
  const position = facts.listing.position;
  if (position.kind !== 'known') {
    return { blockers: ['position-unknown'], distanceOverMetres: null };
  }

  if (place.kind === 'area') {
    const inside = isPointInGeoOutline(position.point, place.outline);
    return { blockers: inside ? [] : ['outside-area'], distanceOverMetres: null };
  }

  const metres = distanceMeters(place.center, position.point);
  const limitMetres = place.radiusKm * 1000;
  if (metres <= limitMetres) return { blockers: [], distanceOverMetres: null };
  return { blockers: ['outside-radius'], distanceOverMetres: metres - limitMetres };
}

/** Χρονικός άξονας — «τι θα υπάρχει **τότε**». */
export function timingBlockers(
  timing: DemandTiming,
  availability: ListingAvailability | null,
  todayDate: string,
): DemandBlocker[] {
  if (timing.kind === 'whenever') return [];

  if (timing.kind === 'now') {
    // ⚠️ «Τώρα» **δεν** απαιτεί δηλωμένη διαθεσιμότητα: μια αγγελία στην αγορά είναι
    // εξ ορισμού διαθέσιμη σήμερα, αλλιώς δεν θα ήταν δημοσιευμένη. Απορρίπτεται μόνο
    // αν κάποιος έχει δηλώσει ρητά **μελλοντική** αρχή.
    if (availability?.from == null) return [];
    return availability.from <= todayDate ? [] : ['not-available-then'];
  }

  if (availability === null || (availability.from === null && availability.to === null)) {
    return ['availability-unknown'];
  }
  // Επικάλυψη διαστημάτων: `from ≤ toDate` **και** `to ≥ fromDate`.
  const startsInTime = availability.from === null || availability.from <= timing.toDate;
  const endsInTime = availability.to === null || availability.to >= timing.fromDate;
  return startsInTime && endsInTime ? [] : ['not-available-then'];
}

/** **Ζ6** — γειτονιά. Ξεχωρίζει «μακριά» από «δεν ρωτήθηκε». */
export function proximityBlockers(demand: PropertyDemand, facts: ListingMatchFacts): DemandBlocker[] {
  const found: DemandBlocker[] = [];

  for (const requirement of demand.proximity) {
    const metres = facts.proximityMetres[requirement.kind];
    if (metres === undefined) {
      found.push('proximity-unknown');
    } else if (metres > requirement.maxMetres) {
      found.push('proximity-too-far');
    }
  }

  return found;
}

