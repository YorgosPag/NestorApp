/**
 * @fileoverview Άγκυρες για τον **μοναδικό** SSoT απόστασης (ADR-777 · N.0.2).
 * @related lib/geo/geo-distance.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΡΟΥΡΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ — και τι **δεν** φρουρούσε καμία πριν
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τέσσερις προηγούμενες υλοποιήσεις είχαν **μία** σουίτα μεταξύ τους
 * (`rankSuggestions.test.ts`), με όριο **290–310 km** για μια απόσταση ~302 km —
 * δηλαδή ανοχή **±3%**. Μια αλλαγή ακτίνας Γης, ένα λάθος πρόσημο σε ημιδιαφορά, ή
 * σύγχυση `lat`/`lng` σε **συμμετρικό** ζεύγος θα περνούσαν **πράσινες**.
 *
 * ⚠️ Η `Κ3` είναι ο λόγος που η ενοποιημένη δέχεται **σημεία** και όχι τέσσερις
 * αριθμούς: με γυμνούς `number` η αντιμετάθεση **μεταγλωττίζεται**.
 */

import { distanceMeters, EARTH_RADIUS_METERS } from '../geo-distance';

/** Πραγματικά σημεία, ώστε η βαθμονόμηση να ελέγχεται από τρίτον. */
const ATHENS = { lat: 37.9838, lng: 23.7275 } as const;
const THESSALONIKI = { lat: 40.6401, lng: 22.9444 } as const;

describe('distanceMeters — ταυτότητες', () => {
  it('Κ1 — ίδιο σημείο ⇒ ακριβώς 0', () => {
    expect(distanceMeters(ATHENS, ATHENS)).toBe(0);
  });

  it('Κ2 — συμμετρική', () => {
    expect(distanceMeters(ATHENS, THESSALONIKI)).toBeCloseTo(
      distanceMeters(THESSALONIKI, ATHENS),
      9,
    );
  });

  it('Κ3 — αντιμετάθεση lat/lng ΔΕΝ δίνει την ίδια απόσταση (γιατί ο τύπος είναι σημείο)', () => {
    const swapped = { lat: ATHENS.lng, lng: ATHENS.lat };
    expect(distanceMeters(swapped, THESSALONIKI)).not.toBeCloseTo(
      distanceMeters(ATHENS, THESSALONIKI),
      0,
    );
  });
});

describe('distanceMeters — βαθμονόμηση σε γνωστές τιμές', () => {
  /**
   * 🔴 **ΔΕΥΤΕΡΗ ΦΩΝΗ, ΟΧΙ ΣΤΑΘΕΡΑ ΑΠΟ ΤΟΝ ΙΔΙΟ ΤΥΠΟ.**
   *
   * Μια αναμενόμενη τιμή βγαλμένη από τη **Haversine** θα επικύρωνε τη Haversine με
   * τον εαυτό της — η άγκυρα θα ήταν πράσινη ό,τι κι αν έκανε ο τύπος, αρκεί να το
   * έκανε **σταθερά**. Εδώ ο κριτής είναι ο **σφαιρικός νόμος συνημιτόνων**:
   * ανεξάρτητος τύπος, ίδια ακτίνα Γης ⇒ η σύγκριση μετρά τον **αλγόριθμο** και όχι
   * τη σταθερά. Ίδιο ιδίωμα με το `demand-listing-filters.test.ts`.
   *
   * Μετρημένο: **302 949,62 m**, και οι δύο τύποι συμφωνούν σε **0,0000 m**.
   */
  it('Κ4 — συμφωνεί με ανεξάρτητο τύπο (νόμος συνημιτόνων) σε Αθήνα → Θεσσαλονίκη', () => {
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    const cosine =
      Math.sin(rad(ATHENS.lat)) * Math.sin(rad(THESSALONIKI.lat)) +
      Math.cos(rad(ATHENS.lat)) *
        Math.cos(rad(THESSALONIKI.lat)) *
        Math.cos(rad(THESSALONIKI.lng) - rad(ATHENS.lng));
    const viaCosines =
      EARTH_RADIUS_METERS * Math.acos(Math.min(1, Math.max(-1, cosine)));

    expect(distanceMeters(ATHENS, THESSALONIKI)).toBeCloseTo(viaCosines, 3);
    // Και η απόλυτη τάξη μεγέθους, ώστε μια κοινή αστοχία των δύο να μη μείνει κρυφή.
    expect(distanceMeters(ATHENS, THESSALONIKI)).toBeCloseTo(302_950, -2);
  });

  /** Ένας μεσημβρινός βαθμός είναι, εξ ορισμού του τύπου, ακριβώς `R·π/180`. */
  it('Κ5 — 1° γεωγραφικού πλάτους = R·π/180', () => {
    const oneDegree = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(oneDegree).toBeCloseTo((EARTH_RADIUS_METERS * Math.PI) / 180, 6);
  });

  /** Στον ισημερινό ο μεσημβρινός και ο παράλληλος βαθμός συμπίπτουν. */
  it('Κ6 — 1° μήκους στον ισημερινό = 1° πλάτους', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }),
      6,
    );
  });
});

describe('distanceMeters — άκρα', () => {
  /**
   * 🔴 **Ο λόγος που χρησιμοποιείται `atan2` και όχι `asin`.** Σε αντιδιαμετρικά
   * σημεία το `h` φτάνει το 1 και το αριθμητικό σφάλμα μπορεί να το περάσει· η
   * `asin(√h)` τότε γυρίζει **NaN** χωρίς ρητό `Math.min(1, …)` — φρουρό που είχε
   * **μία** από τις τέσσερις υλοποιήσεις. Η `atan2` δεν έχει πεδίο ορισμού να σπάσει.
   */
  it('Κ7 — αντιδιαμετρικά σημεία δίνουν πεπερασμένο μισό μέγιστου κύκλου', () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, 3);
  });

  it('Κ8 — οι πόλοι απέχουν μισό μέγιστο κύκλο', () => {
    const d = distanceMeters({ lat: 90, lng: 0 }, { lat: -90, lng: 0 });
    expect(d).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, 3);
  });

  it('Κ9 — το ±180 μήκους είναι ο ίδιος μεσημβρινός', () => {
    expect(distanceMeters({ lat: 40, lng: 180 }, { lat: 40, lng: -180 })).toBeCloseTo(0, 6);
  });
});
