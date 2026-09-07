/**
 * @fileoverview ΑΓΚΥΡΕΣ — **το ερώτημα φεύγει από τον φυλλομετρητή, χωρίς να χάσει το «ίσως»**.
 * @related ADR-777 §8.65 · lib/listings/listing-geo-query.ts · lib/geo/geo-area.ts
 *
 * 🔴 **Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ ΕΙΝΑΙ Η Κ4, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΓΡΑΦΤΗΚΕ ΠΡΩΤΗ.** Το Βήμα 4
 * μπορούσε να ακυρώσει σιωπηλά το Βήμα 3: μόλις το ερώτημα κόβει στο κάδρο, μια αγγελία
 * που ξέρουμε μόνο *«κάπου στην πόλη»* και έχει **σημείο** λίγο έξω από την οθόνη δεν
 * κατεβαίνει ποτέ — και ολόκληρος ο κάδος «ίσως» αδειάζει **χωρίς να αλλάξει γραμμή
 * στον κριτή και χωρίς να κοκκινίσει καμία από τις άγκυρές του**.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { areaBoundingBox, expandBoundingBox } from '@/lib/geo/geo-area';
import { distanceMeters } from '@/lib/geo/geo-distance';
import type { GeoBoundingBox, GeoCircle } from '@/types/geo/coordinates';
import type { PublicListing } from '@/types/public-listing';

import {
  countIsExactFor,
  listingAreaKey,
  listingCountBox,
  listingReadBox,
  listingReadPlan,
  LISTING_POINT_FIELD,
  LISTING_READ_CAP,
  MAX_LISTING_UNCERTAINTY_KM,
} from '../listing-geo-query';
import { LISTING_UNCERTAINTY_KM } from '../listing-map-shape';
import { listingAreaVerdict } from '../listing-search-area';

/** Ένα μικρό κάδρο στο κέντρο της Αθήνας — ~2 χλμ πλευρά. */
const FRAME: GeoBoundingBox = { south: 37.97, north: 37.99, west: 23.72, east: 23.75 };

// ============================================================================
// Κ1 — ΤΟ ΟΡΘΟΓΩΝΙΟ ΑΝΑΓΝΩΣΗΣ ΕΙΝΑΙ ΔΙΕΥΡΥΜΕΝΟ
// ============================================================================

describe('Κ1 — διαβάζουμε ΠΑΡΑΠΑΝΩ από όσα δείχνουμε', () => {
  it('το ορθογώνιο ανάγνωσης περιέχει γνήσια το κάδρο', () => {
    const read = listingReadBox(FRAME);
    expect(read.north).toBeGreaterThan(FRAME.north);
    expect(read.south).toBeLessThan(FRAME.south);
    expect(read.east).toBeGreaterThan(FRAME.east);
    expect(read.west).toBeLessThan(FRAME.west);
  });

  it('η διεύρυνση είναι ΤΟΥΛΑΧΙΣΤΟΝ η μέγιστη αβεβαιότητα, σε μέτρα', () => {
    const read = listingReadBox(FRAME);
    const northPad = distanceMeters(
      { lat: FRAME.north, lng: FRAME.west },
      { lat: read.north, lng: FRAME.west }
    );
    expect(northPad).toBeGreaterThanOrEqual(MAX_LISTING_UNCERTAINTY_KM * 1000 - 1);
  });

  it('η μέγιστη αβεβαιότητα ΠΑΡΑΓΕΤΑΙ από τον πίνακα, δεν γράφεται', () => {
    const declared = Object.values(LISTING_UNCERTAINTY_KM).filter(
      (km): km is number => km !== null
    );
    expect(MAX_LISTING_UNCERTAINTY_KM).toBe(Math.max(...declared));
    // Αν κάποιος προσθέσει σκαλί μεγαλύτερο από την πόλη, αυτό εδώ **πρέπει** να το
    // ακολουθήσει μόνο του — αλλιώς το «ίσως» αρχίζει να χάνει αγγελίες σιωπηλά.
    expect(MAX_LISTING_UNCERTAINTY_KM).toBeGreaterThan(0);
  });
});

// ============================================================================
// Κ2 — Η ΚΑΤΑΜΕΤΡΗΣΗ ΔΕΝ ΕΙΝΑΙ Η ΑΝΑΓΝΩΣΗ  🔴 Ο ΜΕΤΡΗΤΗΣ ΔΕΝ ΨΕΥΔΕΤΑΙ
// ============================================================================

describe('Κ2 — το ορθογώνιο της καταμέτρησης είναι ΑΔΙΕΥΡΥΝΤΟ', () => {
  it('μετράμε την ερώτηση του ανθρώπου, όχι το ορθογώνιο ανάγνωσης', () => {
    expect(listingCountBox(FRAME)).toEqual(FRAME);
  });

  it('το ορθογώνιο καταμέτρησης είναι ΓΝΗΣΙΑ μικρότερο από αυτό της ανάγνωσης', () => {
    // Μετρημένο στο διευρυμένο, ο μετρητής θα ήταν «συνεπής και ψεύτης» (§8.62).
    const count = listingCountBox(FRAME);
    const read = listingReadBox(FRAME);
    expect(count.north).toBeLessThan(read.north);
    expect(count.east).toBeLessThan(read.east);
  });

  it('ακριβής αριθμός μόνο όταν η ερώτηση ΕΙΝΑΙ ορθογώνιο ή δεν υπάρχει', () => {
    const circle: GeoCircle = { center: { lat: 37.98, lng: 23.73 }, radiusKm: 3 };
    expect(countIsExactFor(null)).toBe(true);
    expect(countIsExactFor(FRAME)).toBe(true);
    // Ο κύκλος μετριέται στο περιγεγραμμένο ορθογώνιο — έως 21,5% μεγαλύτερο.
    expect(countIsExactFor(circle)).toBe(false);
  });
});

// ============================================================================
// Κ3 — ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΠΕΔΙΩΝ ΥΠΑΡΧΟΥΝ ΣΤΟ ΕΓΓΡΑΦΟ  🔴 ΣΙΩΠΗΛΗ ΑΠΟΤΥΧΙΑ
// ============================================================================

describe('Κ3 — οι διαδρομές πεδίων δείχνουν σε πραγματικά δεδομένα', () => {
  function readPath(source: unknown, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (node, segment) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[segment]
            : undefined,
        source
      );
  }

  it('το "position.point.lat" λύνεται σε αριθμό πάνω σε ΠΡΑΓΜΑΤΙΚΗ αγγελία', () => {
    // 🔴 Ερώτημα σε ανύπαρκτο πεδίο ΔΕΝ σκάει — γυρίζει **μηδέν έγγραφα**, δηλαδή
    //    «δεν υπάρχει τίποτα εδώ» για μια αγορά γεμάτη ακίνητα.
    const sample: PublicListing = listing();
    expect(typeof readPath(sample, LISTING_POINT_FIELD.lat)).toBe('number');
    expect(typeof readPath(sample, LISTING_POINT_FIELD.lng)).toBe('number');
  });

  it('🔴 Η ΕΝΑΛΛΑΓΗ lat/lng ΔΕΝ ΠΕΡΝΑ — και δεν αρκεί «είναι διαφορετικά»', () => {
    // Ανεστραμμένες, οι δύο διαδρομές λύνονται **και οι δύο** σε αριθμό και παραμένουν
    // διαφορετικές μεταξύ τους: ένας έλεγχος «δεν είναι ίδιες» θα περνούσε πράσινος
    // πάνω στο ελάττωμα. Η μόνη άγκυρα που το πιάνει είναι η **ταυτότητα της τιμής**.
    const sample: PublicListing = listing();
    if (sample.position.kind !== 'known') throw new Error('το fixture έχασε τη θέση του');

    expect(readPath(sample, LISTING_POINT_FIELD.lat)).toBe(sample.position.point.lat);
    expect(readPath(sample, LISTING_POINT_FIELD.lng)).toBe(sample.position.point.lng);
    expect(sample.position.point.lat).not.toBe(sample.position.point.lng);
  });
});

// ============================================================================
// Κ4 — Η «ΤΡΙΤΗ ΚΑΤΗΓΟΡΙΑ» ΕΠΙΖΕΙ ΤΟΥ ΕΡΩΤΗΜΑΤΟΣ  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ4 — αγγελία «ίσως» με σημείο ΕΞΩ από το κάδρο κατεβαίνει κανονικά', () => {
  /** Αγγελία γεωκωδικοποιημένη σε **κέντρο πόλης** — αβεβαιότητα 10 χλμ. */
  function cityScaleListingAt(lat: number, lng: number): PublicListing {
    return listing({
      position: {
        kind: 'known',
        provenance: 'geocoded',
        point: { lat, lng },
        locatedAt: '2026-08-11T00:00:00.000Z',
        accuracy: 'center',
      },
    });
  }

  function within(box: GeoBoundingBox, point: { lat: number; lng: number }): boolean {
    return (
      point.lat >= box.south &&
      point.lat <= box.north &&
      point.lng >= box.west &&
      point.lng <= box.east
    );
  }

  it('ο κριτής τη λέει «ίσως» — και το σημείο της είναι ΕΞΩ από το κάδρο', () => {
    const outsider = cityScaleListingAt(38.04, 23.735); // ~5,5 χλμ βόρεια του κάδρου
    expect(within(FRAME, { lat: 38.04, lng: 23.735 })).toBe(false);
    expect(listingAreaVerdict(outsider, FRAME)).toBe('maybe');
  });

  it('🔴 ΚΑΙ ΤΟ ΣΗΜΕΙΟ ΤΗΣ ΕΙΝΑΙ ΜΕΣΑ ΣΤΟ ΟΡΘΟΓΩΝΙΟ ΑΝΑΓΝΩΣΗΣ', () => {
    // Χωρίς τη διεύρυνση, αυτή η αγγελία δεν θα κατέβαινε ΠΟΤΕ και ο κάδος «ίσως»
    // θα άδειαζε σιωπηλά. Κανένα test του κριτή δεν θα το έπιανε: ο κριτής είναι σωστός.
    expect(within(listingReadBox(FRAME), { lat: 38.04, lng: 23.735 })).toBe(true);
  });

  it('αγγελία πραγματικά μακριά ΔΕΝ κατεβαίνει — η διεύρυνση δεν είναι «φέρε τα πάντα»', () => {
    const crete = { lat: 35.34, lng: 25.13 };
    expect(within(listingReadBox(FRAME), crete)).toBe(false);
    expect(listingAreaVerdict(cityScaleListingAt(crete.lat, crete.lng), FRAME)).toBe('outside');
  });
});

// ============================================================================
// Κ5 — ΤΟ ΣΧΕΔΙΟ ΚΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΠΕΡΙΟΧΗΣ
// ============================================================================

describe('Κ5 — δύο ρητές καταστάσεις, και ένα σταθερό κλειδί', () => {
  it('χωρίς περιοχή, το σχέδιο είναι «παντού» — αλλά ΠΟΤΕ «χωρίς όριο»', () => {
    expect(listingReadPlan(null)).toEqual({ kind: 'everywhere' });
    expect(LISTING_READ_CAP).toBeGreaterThan(0);
  });

  it('με περιοχή, το σχέδιο κουβαλά το ΔΙΕΥΡΥΜΕΝΟ ορθογώνιο', () => {
    const plan = listingReadPlan(FRAME);
    expect(plan.kind).toBe('within');
    if (plan.kind !== 'within') throw new Error('αδύνατο');
    expect(plan.box).toEqual(listingReadBox(FRAME));
  });

  it('🔴 ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ ΙΔΙΟ ΓΙΑ ΙΣΟΔΥΝΑΜΑ ΑΝΤΙΚΕΙΜΕΝΑ — ο φραγμός του βρόχου', () => {
    // Τα φίλτρα ξαναγεννιούνται σε κάθε απόδοση· εξάρτηση στην **αναφορά** θα
    // ξανάνοιγε τη συνδρομή σε κάθε απόδοση.
    const twin: GeoBoundingBox = { east: 23.75, north: 37.99, south: 37.97, west: 23.72 };
    expect(twin).not.toBe(FRAME);
    expect(listingAreaKey(twin)).toBe(listingAreaKey(FRAME));
  });

  it('διαφορετική γεωγραφία ⇒ διαφορετικό κλειδί, και ο κύκλος δεν μπερδεύεται με ορθογώνιο', () => {
    const moved: GeoBoundingBox = { ...FRAME, north: 38.5 };
    const circle: GeoCircle = { center: { lat: 37.98, lng: 23.73 }, radiusKm: 3 };

    expect(listingAreaKey(moved)).not.toBe(listingAreaKey(FRAME));
    expect(listingAreaKey(circle)).not.toBe(listingAreaKey(FRAME));
    expect(listingAreaKey(null)).not.toBe(listingAreaKey(FRAME));
  });

  it('το κλειδί ΟΝΟΜΑΖΕΙ το σχήμα του — ζώνη ασφαλείας, καταγεγραμμένη ως τέτοια', () => {
    // ⚠️ Η μετάλλαξη «και τα δύο γράφουν box:» **επιβιώνει** και είναι ισοδύναμη
    //    σήμερα (κύκλος 4 τμήματα · ορθογώνιο 5 ⇒ σύγκρουση αδύνατη). Ο έλεγχος εδώ
    //    δεν προσποιείται ότι την πιάνει: πιάνει τη **δήλωση**, ώστε η μέρα που ο
    //    κύκλος αποκτήσει τέταρτο συστατικό να μην είναι σιωπηλή.
    const circle: GeoCircle = { center: { lat: 37.98, lng: 23.73 }, radiusKm: 3 };
    expect(listingAreaKey(FRAME).split(':')[0]).toBe('box');
    expect(listingAreaKey(circle).split(':')[0]).toBe('circle');
    expect(listingAreaKey(null)).not.toContain(':');
  });
});

// ============================================================================
// Κ6 — Η ΓΕΩΜΕΤΡΙΑ ΠΟΥ ΤΟ ΤΡΟΦΟΔΟΤΕΙ (lib/geo/geo-area.ts)
// ============================================================================

describe('Κ6 — περιγεγραμμένο ορθογώνιο και διεύρυνση', () => {
  it('ορθογώνιο σε ορθογώνιο: ταυτότητα', () => {
    expect(areaBoundingBox(FRAME)).toEqual(FRAME);
  });

  it('κύκλος → ορθογώνιο που τον ΠΕΡΙΕΧΕΙ σε κάθε πλευρά', () => {
    const circle: GeoCircle = { center: { lat: 37.98, lng: 23.73 }, radiusKm: 5 };
    const box = areaBoundingBox(circle);

    // Το βόρειο άκρο του κύκλου πρέπει να χωράει, και το ανατολικό επίσης.
    for (const edge of [
      { lat: box.north, lng: circle.center.lng },
      { lat: box.south, lng: circle.center.lng },
      { lat: box.north, lng: box.east },
    ]) {
      expect(edge).toBeDefined();
    }
    expect(distanceMeters(circle.center, { lat: box.north, lng: circle.center.lng }))
      .toBeGreaterThanOrEqual(circle.radiusKm * 1000 - 1);
    expect(distanceMeters(circle.center, { lat: circle.center.lat, lng: box.east }))
      .toBeGreaterThanOrEqual(circle.radiusKm * 1000 - 1);
  });

  it('🔴 ΤΟ ΟΡΘΟΓΩΝΙΟ ΠΕΡΙΕΧΕΙ ΤΟΝ ΣΦΑΙΡΙΚΟ ΔΙΣΚΟ — ΑΝΕΞΑΡΤΗΤΟ ΚΡΙΤΗΡΙΟ', () => {
    // 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΓΡΑΦΤΗΚΕ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ Η ΠΡΩΤΗ ΗΤΑΝ ΤΥΦΛΗ.** Έλεγε ότι η
    //    **γωνία** του ορθογωνίου απέχει περισσότερο από την ακτίνα — που είναι αληθές
    //    για **κάθε** εύλογη υλοποίηση, γιατί η διαγώνιος είναι πάντα μεγαλύτερη από
    //    την πλευρά. Η μέτρηση μετάλλαξης το απέδειξε: η εκδοχή που μετρά στο **κέντρο**
    //    πέρασε πράσινη.
    //
    // ✅ Το σωστό κριτήριο είναι **εξωτερικό**: ο κλασικός τύπος του περιγεγραμμένου
    //    ορθογωνίου σφαιρικού δίσκου, `Δλ = asin(sin(r/R) / cos(φ))`. Δεν είναι
    //    αντιγραφή της υλοποίησης — είναι **άλλος δρόμος** προς την ίδια απαίτηση.
    //
    // 📏 **ΜΕΤΡΗΜΕΝΟ** (κύκλος 50 χλμ στις 60°): φράγμα `0,899348°` · μέτρηση στο
    //    **κέντρο** `0,899320°` ⇒ **λείπουν ~1,5 m** και ο δίσκος **κόβεται** ·
    //    μέτρηση στην **ακραία παράλληλο** `0,911742°` ⇒ περιέχει.
    const circle: GeoCircle = { center: { lat: 60, lng: 10 }, radiusKm: 50 };
    const box = areaBoundingBox(circle);

    const R_KM = 6371.0088;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sphericalLngBound =
      (Math.asin(Math.sin(circle.radiusKm / R_KM) / Math.cos(toRad(circle.center.lat))) * 180) /
      Math.PI;

    expect(box.east - circle.center.lng).toBeGreaterThanOrEqual(sphericalLngBound);
    expect(circle.center.lng - box.west).toBeGreaterThanOrEqual(sphericalLngBound);
  });

  it('🔴 ΚΑΙ ΤΟ ΙΔΙΟ ΙΣΧΥΕΙ ΣΤΑ ΕΛΛΗΝΙΚΑ ΠΛΑΤΗ — όχι μόνο σε ακραία', () => {
    const circle: GeoCircle = { center: { lat: 37.9838, lng: 23.7275 }, radiusKm: 10 };
    const box = areaBoundingBox(circle);

    const R_KM = 6371.0088;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sphericalLngBound =
      (Math.asin(Math.sin(circle.radiusKm / R_KM) / Math.cos(toRad(circle.center.lat))) * 180) /
      Math.PI;

    expect(box.east - circle.center.lng).toBeGreaterThanOrEqual(sphericalLngBound);
    // Και το πλάτος: το βόρειο άκρο απέχει τουλάχιστον την ακτίνα.
    expect(distanceMeters(circle.center, { lat: box.north, lng: circle.center.lng }))
      .toBeGreaterThanOrEqual(circle.radiusKm * 1000 - 1);
  });

  it('η διεύρυνση μεγαλώνει και τους τέσσερις άξονες', () => {
    const wider = expandBoundingBox(FRAME, 10);
    expect(wider.north).toBeGreaterThan(FRAME.north);
    expect(wider.south).toBeLessThan(FRAME.south);
    expect(wider.east).toBeGreaterThan(FRAME.east);
    expect(wider.west).toBeLessThan(FRAME.west);
  });

  it('διεύρυνση κατά μηδέν αφήνει το ορθογώνιο ως έχει', () => {
    const same = expandBoundingBox(FRAME, 0);
    expect(same.north).toBeCloseTo(FRAME.north, 10);
    expect(same.west).toBeCloseTo(FRAME.west, 10);
  });
});
