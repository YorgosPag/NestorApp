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
 * `readNumericAnswer` (`lib/criteria/`) · `withinRange` (`listing-filters.ts`) ·
 * `distanceMeters` (`lib/geo/geo-distance.ts`) · `isPointInGeoOutline` (`geo-ring.ts`).
 * Έτσι ο χάρτης, η λίστα και η μηχανή **δεν μπορούν** να διαφωνήσουν για το ίδιο ερώτημα.
 *
 * ⚠️ **Ο `getEffectivePrice` ΕΦΥΓΕ από αυτό το αρχείο, και είναι διόρθωση** (ADR-777
 * §8.52): τον ρωτά πλέον ο **ΕΝΑΣ** αναγνώστης, μέσα από τον `readNumericAnswer`. Δύο
 * κλήσεις του ίδιου επιλυτή από δύο σημεία δεν είναι «κοινός SSoT» — είναι δύο
 * αναγνώστες που συμφωνούν **σήμερα**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React/Firestore.
 */

import { withinRange } from '@/lib/listings/listing-filters';
// 🔑 ADR-777 §8.52 — Ο **ΕΝΑΣ** αναγνώστης. Η ζήτηση ΔΕΝ ρωτά πια μόνη της «τι απαντά
// η αγγελία;» — ούτε για την τιμή (`getEffectivePrice` ζει ΜΕΣΑ του), ούτε για τη γη.
import { readNumericAnswer } from '@/lib/criteria/listing-criterion-reading';
import type { RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { isPointInGeoOutline } from '@/lib/geo/geo-ring';
import { distanceMeters } from '@/lib/geo/geo-distance';
import { metresOutsideFrontage, sideOfPolyline } from '@/lib/geo/geo-line';
import type { LocationProvenance } from '@/lib/location/location-provenance';
import type { PlacePosition } from '@/types/geo/public-place';
import type { PublicListing } from '@/types/public-listing';
import type { DemandPlace, DemandTiming, PropertyDemand } from '@/types/property-demand';
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

/**
 * Οι αποστάσεις **όσο χτίζονται** — ο ίδιος τύπος με το {@link DemandGaps}, χωρίς το
 * `readonly`.
 *
 * 🔑 **Ονομάζεται μία φορά, επίτηδες**: γραμμένος στη σειρά σε τέσσερις υπογραφές θα
 * ήταν structural clone που το CHECK 3.28 μετρά (N.18) — και, χειρότερα, ένα νέο πεδίο
 * κενού θα απαιτούσε τέσσερις πανομοιότυπες επεξεργασίες που **καμία πύλη δεν συνδέει**.
 *
 * ⚠️ **Ζει μόνο εδώ, μέσα στο αρχείο**: η μεταβλητότητα είναι λεπτομέρεια της
 * **κατασκευής**, όχι του συμβολαίου. Εξαγόμενος, θα καλούσε καταναλωτές να γράψουν
 * πάνω σε ένα σύνολο που η μηχανή παραδίδει **κλειστό**.
 */
type MutableGaps = { -readonly [K in keyof DemandGaps]: DemandGaps[K] };

/**
 * Τιμή · εμβαδόν · υπνοδωμάτια · όροφος — με το **πόσο** μαζί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-777 §8.52 — ΕΔΩ ΖΟΥΣΕ ΕΝΑΣ **ΔΕΥΤΕΡΟΣ ΑΝΑΓΝΩΣΤΗΣ**, ΚΑΙ ΕΛΕΓΕ ΨΕΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα αυτή η συνάρτηση ρωτούσε **η ίδια** «τι απαντά η αγγελία;», με ωμά
 * `listing.x === null`. Δύο συνέπειες, **και οι δύο μετρημένες**:
 *
 *   **(α) Η σιωπή γινόταν ΙΣΧΥΡΙΣΜΟΣ.** Αγγελία χωρίς δηλωμένη τιμή έβγαινε
 *   `price-above` — *«είναι πιο ακριβή απ' όσο θέλεις»* για ποσό που **κανείς δεν
 *   ξέρει**. Το ίδιο σε εμβαδόν, υπνοδωμάτια, όροφο. Παραβίαση της **Α5** στην πιο
 *   καθαρή της μορφή, και ο κώδικας **το παραδεχόταν σε σχόλιο**.
 *
 *   **(β) Η ΓΗ ΚΡΙΝΟΤΑΝ ΣΕ ΥΠΝΟΔΩΜΑΤΙΑ.** Το §8.50 εξαίρεσε ρητά **24 άξονες** για τα
 *   οικόπεδα (`LAND_CANNOT_ANSWER`) — αλλά **μόνο στην αναζήτηση**. Μετρημένο: καμία
 *   αναφορά σε `isLandProperty`/`criterionAppliesTo` σε ολόκληρο το `lib/demand/`.
 *   Δηλαδή **η ίδια αγγελία, δύο απαντήσεις**, στην ίδια εφαρμογή. Ένα οικόπεδο έχει
 *   `bedrooms: null` **εκ κατασκευής**, άρα λογιζόταν «λιγότερα υπνοδωμάτια».
 *
 * 🔑 **Η ΘΕΡΑΠΕΙΑ ΕΙΝΑΙ ΜΙΑ, ΚΑΙ ΛΥΝΕΙ ΚΑΙ ΤΑ ΔΥΟ: ΠΑΨΕ ΝΑ ΕΙΣΑΙ ΑΝΑΓΝΩΣΤΗΣ.**
 * Ο **ΕΝΑΣ** αναγνώστης ({@link readNumericAnswer}) απαντά ήδη σε **τέσσερις**
 * καταστάσεις, και κάθε μία έχει **διαφορετική** σωστή συνέπεια εδώ:
 *
 * | Απάντηση | Τι σημαίνει | Τι κάνει ο άξονας |
 * |---|---|---|
 * | `declared` | η αγγελία απάντησε | συγκρίνει, με «πόσο» |
 * | `never-asked` | **δεν δηλώθηκε** | εμπόδιο **απουσίας**, χωρίς «πόσο» |
 * | `not-applicable` | **δεν σηκώνει την ερώτηση** *(γη)* | **ΚΑΝΕΝΑ εμπόδιο** |
 * | `declared-none` | δεν προκύπτει σε αριθμό | — |
 *
 * ⚠️ Η **τρίτη γραμμή είναι δωρεάν**: έρχεται μαζί με τη δεύτερη, χωρίς δικό της
 * κώδικα. Δύο πολιτικές έγιναν μία **επειδή έμεινε ένας κριτής** — όχι επειδή
 * γράφτηκε δεύτερη φορά ο ίδιος κανόνας.
 *
 * ⛔ **ΜΗΝ ξαναγράψεις `listing.x === null` εδώ.** Θα ήταν τρίτος αναγνώστης, και θα
 * ξαναχάσει σιωπηλά τη γη — το ακριβές σχήμα του ADR-749.
 */
export function numericOutcome(
  demand: PropertyDemand,
  listing: PublicListing,
): { blockers: DemandBlocker[]; gaps: DemandGaps } {
  const f = demand.features;
  const blockers: DemandBlocker[] = [];
  const gaps: MutableGaps = { ...NO_GAPS };

  priceAxis(listing, f, blockers, gaps);
  areaAxis(listing, f, blockers, gaps);
  bedroomsAxis(listing, f, blockers, gaps);
  floorAxis(listing, f, blockers);

  return { blockers, gaps };
}

/**
 * Ο κοινός σκελετός των τεσσάρων αξόνων: **ρώτα τον ΕΝΑΝ αναγνώστη, μετά κρίνε**.
 *
 * 🔑 Επιστρέφει `number | null` **αφού** έχει ήδη γράψει το εμπόδιο απουσίας — ώστε ο
 * καλών να ασχολείται μόνο με την αριθμητική. Το `null` εδώ σημαίνει **«μη συνεχίσεις»**
 * και **ποτέ** «η τιμή είναι άγνωστη»: η διάκριση απουσίας ⇄ μη-εφαρμοσιμότητας έχει
 * **ήδη** αποφασιστεί, στη μία θέση που την ξέρει.
 */
function answerOrBlock(
  listing: PublicListing,
  key: RangeCriterionKey,
  absent: DemandBlocker,
  asked: boolean,
  blockers: DemandBlocker[],
): number | null {
  if (!asked) return null;
  const answer = readNumericAnswer(listing, key);
  if (answer.state === 'declared') return answer.value;
  // ⚠️ `not-applicable` ⇒ ΣΙΩΠΗ, όχι εμπόδιο. Ένα οικόπεδο δεν «απέτυχε» στον όροφο:
  //    δεν του τέθηκε ποτέ το ερώτημα (§8.50, `LAND_CANNOT_ANSWER`).
  if (answer.state === 'never-asked' || answer.state === 'declared-none') blockers.push(absent);
  return null;
}

function priceAxis(
  listing: PublicListing,
  f: PropertyDemand['features'],
  blockers: DemandBlocker[],
  gaps: MutableGaps,
): void {
  const price = answerOrBlock(
    listing, 'price', 'price-undeclared',
    f.priceMin !== null || f.priceMax !== null, blockers,
  );
  if (price === null) return;
  if (f.priceMax !== null && price > f.priceMax) {
    blockers.push('price-above');
    gaps.priceOverBy = price - f.priceMax;
  }
  if (f.priceMin !== null && price < f.priceMin) {
    blockers.push('price-below');
    gaps.priceUnderBy = f.priceMin - price;
  }
}

function areaAxis(
  listing: PublicListing,
  f: PropertyDemand['features'],
  blockers: DemandBlocker[],
  gaps: MutableGaps,
): void {
  const area = answerOrBlock(
    listing, 'areaSqm', 'area-undeclared',
    f.areaMin !== null || f.areaMax !== null, blockers,
  );
  if (area === null) return;
  if (f.areaMin !== null && area < f.areaMin) {
    blockers.push('area-below');
    gaps.areaShortBy = f.areaMin - area;
  }
  if (f.areaMax !== null && area > f.areaMax) {
    blockers.push('area-above');
    gaps.areaOverBy = area - f.areaMax;
  }
}

function bedroomsAxis(
  listing: PublicListing,
  f: PropertyDemand['features'],
  blockers: DemandBlocker[],
  gaps: MutableGaps,
): void {
  const bedrooms = answerOrBlock(
    listing, 'bedrooms', 'bedrooms-undeclared', f.bedroomsMin !== null, blockers,
  );
  if (bedrooms === null || f.bedroomsMin === null) return;
  if (bedrooms < f.bedroomsMin) {
    blockers.push('bedrooms-below');
    gaps.bedroomsShortBy = f.bedroomsMin - bedrooms;
  }
}

/** ⚠️ Ο **μόνος** άξονας χωρίς «πόσο»: ένας όροφος εκτός εύρους δεν έχει έλλειμμα. */
function floorAxis(
  listing: PublicListing,
  f: PropertyDemand['features'],
  blockers: DemandBlocker[],
): void {
  const floor = answerOrBlock(
    listing, 'floor', 'floor-undeclared',
    f.floorMin !== null || f.floorMax !== null, blockers,
  );
  if (floor === null) return;
  if (!withinRange(floor, f.floorMin, f.floorMax)) blockers.push('floor-outside');
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

  // `near`, `area` και `frontage` απαιτούν και τα τρία **γνωστή** θέση.
  const position = facts.listing.position;
  if (position.kind !== 'known') {
    return { blockers: ['position-unknown'], distanceOverMetres: null };
  }

  if (place.kind === 'area') {
    const inside = isPointInGeoOutline(position.point, place.outline);
    return { blockers: inside ? [] : ['outside-area'], distanceOverMetres: null };
  }

  // 🔴 **ΡΗΤΟ NARROWING, ΟΧΙ CAST.** Μέχρι εδώ το `place` έχει αποκλείσει
  // `anywhere`/`place`/`area` — μένουν `near` και `frontage`. Χωρίς αυτόν τον κλάδο ο
  // μεταγλωττιστής θα άφηνε το `place.center` παρακάτω να διαβαστεί πάνω σε `frontage`
  // (όπου δεν υπάρχει), και η 5η μορφή θα έσπαγε **σιωπηλά** στο πρώτο πραγματικό
  // ταίριασμα αντί να μη μεταγλωττίζεται.
  if (place.kind === 'frontage') {
    return frontageOutcome(place, position);
  }

  const metres = distanceMeters(place.center, position.point);
  const limitMetres = place.radiusKm * 1000;
  if (metres <= limitMetres) return { blockers: [], distanceOverMetres: null };
  return { blockers: ['outside-radius'], distanceOverMetres: metres - limitMetres };
}

/**
 * **Ζ4 δομημένη** — η κρίση του μετώπου, με τη σειρά που ζητά ο ίδιος ο τύπος
 * ({@link DemandPlace}, κλάδος `frontage`): πρώτα το **βάθος**, μετά η **πλευρά**.
 *
 * 🔑 **Το βάθος κρίνεται ΠΡΙΝ την πλευρά.** Δεν έχει νόημα «λάθος πλευρά» για ένα
 * σημείο 3 χλμ. μακριά από τον άξονα — αυτό είναι απλώς έξω από το μέτωπο, ό,τι κι αν
 * λέει η γεωμετρία της πλευράς εκεί.
 */
function frontageOutcome(
  place: Extract<DemandPlace, { kind: 'frontage' }>,
  position: Extract<PlacePosition, { kind: 'known' }>,
): { blockers: DemandBlocker[]; distanceOverMetres: number | null } {
  const outsideByMetres = metresOutsideFrontage(position.point, place.axis, place.depthMetres);
  if (outsideByMetres > 0) {
    return { blockers: ['outside-frontage'], distanceOverMetres: outsideByMetres };
  }

  // «Και οι δύο πλευρές» δεν ρωτά ποτέ ποια πλευρά — δεν υπάρχει εμπόδιο να κριθεί.
  if (place.side === 'both') return { blockers: [], distanceOverMetres: null };

  if (!sideJudgeableFrom(position)) {
    return { blockers: ['side-unresolved'], distanceOverMetres: null };
  }

  const side = sideOfPolyline(position.point, place.axis);
  // Πάνω στη γραμμή = χωρίς πλευρά, ό,τι κι αν ζητήθηκε.
  if (side === 'on') return { blockers: ['side-unresolved'], distanceOverMetres: null };
  if (side !== place.side) return { blockers: ['wrong-side'], distanceOverMetres: null };

  return { blockers: [], distanceOverMetres: null };
}

/**
 * Οι προελεύσεις θέσης στις οποίες επιτρέπεται να στηριχθεί κρίση **πλευράς**.
 *
 * 🔴 **Γιατί ΑΚΡΙΒΩΣ αυτές, και γιατί ονομασμένη σταθερά αντί για σκόρπιο `||`.** Ένας
 * δρόμος έχει πλάτος 8–20 μ. — δηλαδή ένα σφάλμα θέσης μικρότερο από αυτό δεν αλλάζει
 * ποτέ την απάντηση «ποια πλευρά», ενώ ένα μεγαλύτερο μπορεί να την αναστρέψει. Θα
 * ήταν φυσικό να εκφραστεί ως κατώφλι σε **μέτρα** πάνω στο σφάλμα θέσης — αλλά αυτό
 * το κατώφλι **δεν υπάρχει πουθενά στον κώδικα**: το `GeocodingAccuracy`
 * (`geocoding-thresholds.ts`) κωδικοποιεί μόνο βαθμούς εμπιστοσύνης του geocoder, ποτέ
 * μέτρα σφάλματος. Ένα εφευρημένο κατώφλι σε μέτρα θα ήταν αριθμός **χωρίς
 * προέλευση** — ακριβώς ό,τι το `PlacePosition.accuracy` υπάρχει για να αποτρέψει.
 *
 * Άρα κρίνουμε με το λεξιλόγιο που **υπάρχει ήδη**: θέση **ανθρώπινη ή μετρημένη**
 * (`manual`/`drawn`/`survey`/`bim` — η ίδια η {@link PlacePosition} δεν τους δίνει
 * καν πεδίο `accuracy`, γιατί δεν είναι συμπέρασμα μηχανής) επιτρέπεται πάντα· μια
 * γεωκωδικοποιημένη θέση επιτρέπεται **μόνο** στο ανώτατο σκαλί (`'exact'`, ROOFTOP).
 *
 * ⚠️ **Το `'osm'` ΔΕΝ είναι εδώ, και είναι απόφαση — όχι παράλειψη.** Το OSM δεν είναι
 * ούτε «άνθρωπος έδειξε *αυτό* το σημείο για *αυτή* τη ζήτηση» ούτε «geocoder με
 * βαθμολογημένη ακρίβεια»: είναι κόμβος/περίγραμμα τρίτου χωρίς καμία συνοδευτική
 * μέτρηση σφάλματος στον τύπο μας — η {@link PlacePosition} για `osm` δεν κουβαλά
 * `accuracy` καθόλου, όπως ακριβώς και το `manual`, αλλά εδώ η θέση **δεν την έδειξε
 * άνθρωπος για το συγκεκριμένο ερώτημα** παρά αντλήθηκε ζωντανά. Δεν υπάρχει
 * μετρήσιμος λόγος να το εμπιστευτούμε **περισσότερο** από `geocoded/approximate` —
 * και η Α5 απαγορεύει ρητά να μετατρέπεται άγνοια σε ισχυρισμό. Άρα `osm` πέφτει σε
 * `side-unresolved`, ίδια θεραπεία με κάθε άλλη μη-αξιόπιστη προέλευση.
 */
const PROVENANCES_TRUSTED_FOR_SIDE = [
  'manual',
  'drawn',
  'survey',
  'bim',
] as const satisfies readonly LocationProvenance[];

/** `true` αν η θέση της αγγελίας είναι αρκετά αξιόπιστη ώστε να κριθεί **πλευρά**. */
function sideJudgeableFrom(position: Extract<PlacePosition, { kind: 'known' }>): boolean {
  if (position.provenance === 'geocoded') return position.accuracy === 'exact';
  return (PROVENANCES_TRUSTED_FOR_SIDE as readonly LocationProvenance[]).includes(
    position.provenance,
  );
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

