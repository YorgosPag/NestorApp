/**
 * @fileoverview Άγκυρες — **άξονας** (ανοιχτή πολυγραμμή): πλευρά, απόσταση, ζώνη μετώπου.
 * @related lib/geo/geo-line.ts · types/geo/coordinates.ts (GeoPolyline) · ADR-777 §7
 *
 * Τρία συμβόλαια που μπορούν να σπάσουν σιωπηλά, και το test τα ξεχωρίζει:
 *
 * **Σ** — η **σύμβαση προσήμου** αριστερά/δεξιά. Δεν είναι αυθαίρετη· είναι η μόνη
 * σταθερά όταν ο δρόμος στρίβει (ADR-769: «νότια» σπάει, «ως προς τη φορά» όχι).
 * Το test που αντιστρέφει τη φορά του άξονα είναι ΤΟ κρίσιμο — αν κάποιος ποτέ γράψει
 * `crossSign < 0 ⇒ left` αντί για `> 0`, αυτό το ένα test το πιάνει.
 *
 * **Κ** — η ζώνη μετώπου είναι **κάψουλα**, όχι ορθογώνιο (σκόπιμο, βλ. κεφαλίδα
 * `geo-line.ts`): πέρα από το άκρο του άξονα η απόσταση συνεχίζει να μειώνεται ομαλά.
 *
 * **Π** — σε πολυγραμμή με στροφή, η πλευρά κρίνεται στο **πλησιέστερο** τμήμα, όχι
 * στο πρώτο.
 */

import {
  distanceToPolylineMetres,
  frontagePolylineOutline,
  metresOutsideFrontage,
  sideOfPolyline,
} from '../geo-line';
import { distanceMeters } from '@/lib/geo/geo-distance';
import { isPointInGeoOutline } from '../geo-ring';
import type { GeoPolyline } from '@/types/geo/coordinates';

/**
 * Άξονας Βορράς → Νότος, ~200 μ., σε πραγματική κλίμακα Θεσσαλονίκης (lat ~40.63).
 * Οι συντεταγμένες υπολογίστηκαν με ισαπέχουσα προβολή (ίδια μηχανή με το SUT) γύρω
 * από το `NORTH_END`, ώστε τα offsets σε μέτρα να είναι γνωστά εκ των προτέρων.
 */
const NORTH_END = { lat: 40.63, lng: 22.94 };
const SOUTH_END = { lat: 40.62820135927255, lng: 22.94 }; // ~200 μ. νότια του NORTH_END
const AXIS_NORTH_TO_SOUTH: GeoPolyline = [NORTH_END, SOUTH_END];
const AXIS_SOUTH_TO_NORTH: GeoPolyline = [SOUTH_END, NORTH_END];

/** Στο ύψος του μέσου του άξονα: σημείο 12 μ. ανατολικά, 12 μ. δυτικά, και πάνω στον άξονα. */
const MID_LAT = 40.62910067963628;
const POINT_EAST_12M = { lat: MID_LAT, lng: 22.940142198066255 };
const POINT_WEST_12M = { lat: MID_LAT, lng: 22.939857801933748 };
const POINT_ON_AXIS = { lat: MID_LAT, lng: 22.94 };

/** 15 μ. νότια του `SOUTH_END`, δηλαδή **πέρα** από το άκρο του άξονα. */
const POINT_BEYOND_SOUTH_END = { lat: 40.62806646121799, lng: 22.94 };

describe('Σ — σύμβαση πλευράς: αριστερά/δεξιά ΩΣ ΠΡΟΣ ΤΗ ΦΟΡΑ, όχι πυξίδα', () => {
  it('άξονας Β→Ν: ανατολικά ΠΑΝΤΑ "left", δυτικά ΠΑΝΤΑ "right"', () => {
    // Σαν να περπατάς προς τον Νότο (η φορά του άξονα): η Ανατολή είναι στο
    // αριστερό σου χέρι, η Δύση στο δεξί. Αυτή είναι η σύμβαση που διαβάζει ο SUT.
    expect(sideOfPolyline(POINT_EAST_12M, AXIS_NORTH_TO_SOUTH)).toBe('left');
    expect(sideOfPolyline(POINT_WEST_12M, AXIS_NORTH_TO_SOUTH)).toBe('right');
  });

  it('🔴 ΚΡΙΣΙΜΟ: αντιστροφή της φοράς του άξονα ΑΝΤΙΣΤΡΕΦΕΙ την πλευρά', () => {
    // Ο ΙΔΙΟΣ γεωμετρικός δρόμος, γραμμένος από την άλλη άκρη: τα ίδια σημεία
    // πρέπει τώρα να απαντήσουν το ΑΝΤΙΘΕΤΟ. Αν κάποιος ποτέ σκληρογράψει τη φορά
    // αντί να τη διαβάσει από το `axis`, αυτό το test κοκκινίζει.
    expect(sideOfPolyline(POINT_EAST_12M, AXIS_SOUTH_TO_NORTH)).toBe('right');
    expect(sideOfPolyline(POINT_WEST_12M, AXIS_SOUTH_TO_NORTH)).toBe('left');
  });

  it('σημείο πάνω στον άξονα → "on"', () => {
    expect(sideOfPolyline(POINT_ON_AXIS, AXIS_NORTH_TO_SOUTH)).toBe('on');
  });
});

describe('Π — πολυγραμμή σε σχήμα «Γ»: κρίνει το ΠΛΗΣΙΕΣΤΕΡΟ τμήμα', () => {
  // Α (Βορράς) → Β (223 μ. νότια) → Γ (400 μ. ανατολικά της Β): γωνία στο Β.
  const A = { lat: 40.63, lng: 22.94 };
  const B = { lat: 40.627994515588895, lng: 22.94 };
  const C = { lat: 40.627994515588895, lng: 22.944739793197307 };
  const L_SHAPE_AXIS: GeoPolyline = [A, B, C];

  // 5 μ. νότια του μέσου του τμήματος Β→Γ — ~200 μ. μακριά από το τμήμα Α→Β
  // (μετρημένο ανεξάρτητα, haversine), άρα το τμήμα Β→Γ κερδίζει ξεκάθαρα.
  const POINT_NEAR_SECOND_SEGMENT = { lat: 40.62794954957071, lng: 22.942369896598656 };

  it('η πλευρά είναι αυτή του τμήματος Β→Γ ("right"), ΟΧΙ του Α→Β (θα έλεγε "left")', () => {
    // Β→Γ δείχνει ανατολικά· νότια ενός ανατολικού τμήματος είναι "right" (σαν να
    // περπατάς προς την Ανατολή: ο Νότος είναι στο δεξί σου χέρι) — ίδια σύμβαση
    // με το group Σ. Αν η συνάρτηση έκρινε λάθος με το πρώτο τμήμα (Α→Β, που δείχνει
    // Νότο), θα απαντούσε "left" — το αντίθετο.
    expect(sideOfPolyline(POINT_NEAR_SECOND_SEGMENT, L_SHAPE_AXIS)).toBe('right');
  });

  it('η απόσταση είναι ~5 μ. (προς Β→Γ), όχι ~200 μ. (προς Α→Β)', () => {
    expect(distanceToPolylineMetres(POINT_NEAR_SECOND_SEGMENT, L_SHAPE_AXIS)).toBeCloseTo(5, 0);
  });
});

describe('Κ — μέτρηση απόστασης σε πραγματική κλίμακα (μέτρα, ΟΧΙ μοίρες)', () => {
  it('σημείο 12 μ. στο πλάι → η μηχανή απαντά ~12 μ.', () => {
    // Ανοχή 1%: το equirectangular σφάλμα σε αυτή την κλίμακα είναι τεκμηριωμένα
    // κάτω από 0,01% (geo-local-frame.ts) — η ανοχή εδώ είναι για τη δική μας
    // στρογγυλοποίηση κατά τον υπολογισμό των fixtures, όχι για τη μηχανή.
    expect(distanceToPolylineMetres(POINT_EAST_12M, AXIS_NORTH_TO_SOUTH)).toBeCloseTo(12, 1);
    expect(distanceToPolylineMetres(POINT_WEST_12M, AXIS_NORTH_TO_SOUTH)).toBeCloseTo(12, 1);
  });

  it('ανεξάρτητη επαλήθευση: η SSoT απόσταση (haversine) προς το ΠΛΗΣΙΕΣΤΕΡΟ σημείο συμφωνεί', () => {
    // Δεύτερη φωνή, όπως στο geo-ring-validity.test.ts: το πλησιέστερο σημείο πάνω
    // στον κάθετο άξονα είναι το ίδιο lat με το σημείο δοκιμής, lng = 22.94.
    const nearestOnAxis = { lat: POINT_EAST_12M.lat, lng: 22.94 };
    const independentDistance = distanceMeters(POINT_EAST_12M, nearestOnAxis);
    expect(Math.abs(distanceToPolylineMetres(POINT_EAST_12M, AXIS_NORTH_TO_SOUTH) - independentDistance)).toBeLessThan(0.5);
  });
});

describe('Κ — metresOutsideFrontage: η ζώνη είναι ΚΑΨΟΥΛΑ, όχι ορθογώνιο', () => {
  it('μέσα στο βάθος → 0', () => {
    expect(metresOutsideFrontage(POINT_ON_AXIS, AXIS_NORTH_TO_SOUTH, 3)).toBe(0);
    expect(metresOutsideFrontage(POINT_EAST_12M, AXIS_NORTH_TO_SOUTH, 20)).toBe(0);
  });

  it('12 μ. στο πλάι, βάθος 2 μ. → ~10 μ. έξω', () => {
    expect(metresOutsideFrontage(POINT_EAST_12M, AXIS_NORTH_TO_SOUTH, 2)).toBeCloseTo(10, 1);
  });

  it('🔴 πέρα από το άκρο του άξονα → ΘΕΤΙΚΟ (η ζώνη στρογγυλεύει, δεν σταματά απότομα)', () => {
    // 15 μ. νότια του τέλους του άξονα, βάθος 5 μ.: η απόσταση clamped στο άκρο
    // (SOUTH_END) είναι ~15 μ., άρα ~10 μ. έξω — ΟΧΙ 0 και ΟΧΙ Infinity. Ένα
    // ορθογώνιο μοντέλο θα έδινε ασυνέχεια ακριβώς εδώ.
    const outside = metresOutsideFrontage(POINT_BEYOND_SOUTH_END, AXIS_NORTH_TO_SOUTH, 5);
    expect(outside).toBeGreaterThan(0);
    expect(outside).toBeCloseTo(10, 0);
  });
});

describe('frontagePolylineOutline — smoke test με ανεξάρτητο μάρτυρα (isPointInGeoOutline)', () => {
  // Ελέγχει το ΣΧΗΜΑ (μισή/πλήρης κάψουλα), όχι την ακρίβεια πίξελ — γι' αυτό
  // χρησιμοποιεί το geo-ring ως ανεξάρτητο κριτή «είναι μέσα;» πάνω στο περίγραμμα
  // που η ίδια η frontagePolylineOutline παρήγαγε.
  const DEPTH = 20;

  it('η μισή κάψουλα "left" περιέχει σημείο στα ανατολικά, ΟΧΙ στα δυτικά', () => {
    const outline = frontagePolylineOutline(AXIS_NORTH_TO_SOUTH, 'left', DEPTH);
    expect(outline.length).toBeGreaterThan(2);
    expect(isPointInGeoOutline(POINT_EAST_12M, outline)).toBe(true);
    expect(isPointInGeoOutline(POINT_WEST_12M, outline)).toBe(false);
  });

  it('η πλήρης κάψουλα "both" περιέχει σημεία ΚΑΙ στις δύο πλευρές', () => {
    const outline = frontagePolylineOutline(AXIS_NORTH_TO_SOUTH, 'both', DEPTH);
    expect(isPointInGeoOutline(POINT_EAST_12M, outline)).toBe(true);
    expect(isPointInGeoOutline(POINT_WEST_12M, outline)).toBe(true);
  });

  it('🔴 στρογγυλό άκρο: σημείο λίγο πέρα από το τέλος του άξονα παραμένει μέσα', () => {
    // POINT_BEYOND_SOUTH_END είναι 15 μ. νότια του άκρου — μέσα στην ακτίνα 20 μ.
    // του στρογγυλού άκρου, άρα ΜΕΣΑ στην κάψουλα παρόλο που είναι πέρα από το
    // ευθύγραμμο τμήμα του άξονα (η ίδια λογική με το metresOutsideFrontage).
    const outline = frontagePolylineOutline(AXIS_NORTH_TO_SOUTH, 'both', DEPTH);
    expect(isPointInGeoOutline(POINT_BEYOND_SOUTH_END, outline)).toBe(true);
  });

  it('κανένα σημείο του περιγράμματος δεν είναι NaN', () => {
    for (const side of ['left', 'right', 'both'] as const) {
      const outline = frontagePolylineOutline(AXIS_NORTH_TO_SOUTH, side, DEPTH);
      for (const point of outline) {
        expect(Number.isFinite(point.lat)).toBe(true);
        expect(Number.isFinite(point.lng)).toBe(true);
      }
    }
  });
});
